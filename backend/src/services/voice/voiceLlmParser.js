/**
 * Refinamiento opcional con LLM (OpenAI-compatible).
 * Solo se activa si VOICE_LLM_API_KEY está definida. Las reglas siguen validando al final.
 */
const { finalizeVoiceParse, mergeParseParams, shouldUseLlmRefinement } = require('./voicePrecision');
const { resolveAssignee } = require('./voiceAssigneeResolver');
const { localDateYMD } = require('../../utils/localDate');

const ALLOWED_INTENTS = [
  'create_ticket',
  'create_task',
  'create_meeting',
  'assign_ticket',
  'create_aviso',
  'update_ticket_status',
  'update_ticket',
  'update_task_status',
  'update_task',
  'update_meeting',
  'query_meetings',
  'query_tickets',
  'query_tasks',
  'query_avisos',
  'query_minutas',
  'query_notifications',
  'navigate',
  'help',
  'open_minute',
  'unknown',
];

function isLlmConfigured() {
  return Boolean(String(process.env.VOICE_LLM_API_KEY || '').trim());
}

function llmConfig() {
  return {
    apiKey: String(process.env.VOICE_LLM_API_KEY || '').trim(),
    baseUrl: String(process.env.VOICE_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: String(process.env.VOICE_LLM_MODEL || 'gpt-4o-mini').trim(),
    timeoutMs: Number(process.env.VOICE_LLM_TIMEOUT_MS || 12000),
  };
}

function buildContextBlock(ctx = {}) {
  const users = (ctx.users || []).slice(0, 40);
  const userLines = users.map((u) => {
    const name = `${u.name || ''} ${u.apellido || ''}`.trim();
    return `- ${name}${u.departamento ? ` · ${u.departamento}` : ''}${u.puesto ? ` · ${u.puesto}` : ''}`;
  });
  const depts = [...new Set(users.map((u) => u.departamento).filter(Boolean))];

  return [
    ctx.activeModule ? `Módulo activo en pantalla: ${ctx.activeModule}` : '',
    ctx.session?.intent ? `Sesión previa: ${ctx.session.intent}, clarificación pendiente: ${ctx.session.needsClarification}` : '',
    ctx.postExecute?.ticket_id ? `Ticket recién creado #${ctx.postExecute.ticket_id} (asignación implícita posible)` : '',
    depts.length ? `Departamentos: ${depts.join(', ')}` : '',
    userLines.length ? `Usuarios:\n${userLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function systemPrompt(ctx) {
  return `Eres el intérprete de comandos de voz de BOSA Hub (español mexicano).
Tu trabajo: entender EXACTAMENTE qué acción quiere el usuario y devolver JSON estructurado.
NO inventes IDs de ticket/tarea/reunión. NO inventes usuarios que no estén en la lista.
Si falta un dato obligatorio, indica missing[] pero conserva lo extraído.

Intents permitidos: ${ALLOWED_INTENTS.join(', ')}

Campos por intent:
- create_ticket: title, description, priority (urgent|high|medium|low), category (departamento)
- create_task: title, description, assigned_to_hint (nombre), department, start_date (YYYY-MM-DD), end_date
- create_meeting: title, date (YYYY-MM-DD), start_time (HH:MM), end_time, location_type (sala_juntas|virtual), recurrence (none|weekly|biweekly|monthly), recurrence_until, attendee_hints[], description
- assign_ticket: ticket_id, assignee_hint
- create_aviso: title, content, category
- update_ticket_status: ticket_id, status (open|in_progress|resolved|closed)
- query_*: sin params extra salvo module para navigate
- navigate: module (overview|calendar|tickets|tasks|avisos|minutas|foro|notifications|settings|users)

Fechas relativas: interpreta "mañana", "hoy", "el viernes", "15 de junio" a YYYY-MM-DD usando hoy=${localDateYMD()}.
Horas: "a las 10", "10 de la mañana" → HH:MM 24h.

Responde SOLO JSON válido:
{"intent":"...","params":{...},"missing":[],"confidence":0.0,"summary":"..."}

${buildContextBlock(ctx)}`;
}

function parseLlmJson(content) {
  const raw = String(content || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1]?.trim() || raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function resolveHintsInParams(intent, params, users = []) {
  const p = { ...(params || {}) };
  if (p.assignee_hint && !p.assigned_to) {
    const r = resolveAssignee(users, p.assignee_hint, p.department || null);
    if (r.assigned_to) {
      p.assigned_to = r.assigned_to;
      p.assignee_label = r.assignee_label;
    } else if (r.needsVoicePick) {
      p.pendingVoicePick = r.needsVoicePick;
    }
  }
  if (Array.isArray(p.attendee_hints) && p.attendee_hints.length) {
    const attendees = Array.isArray(p.attendees) ? [...p.attendees] : [];
    for (const hint of p.attendee_hints) {
      const r = resolveAssignee(users, hint, null);
      if (r.assigned_to && !attendees.includes(r.assigned_to)) attendees.push(r.assigned_to);
    }
    p.attendees = attendees;
    delete p.attendee_hints;
  }
  return p;
}

function mapLlmToParsed(llm, transcript, ctx = {}) {
  if (!llm || typeof llm !== 'object') return null;
  const intent = ALLOWED_INTENTS.includes(llm.intent) ? llm.intent : 'unknown';
  if (intent === 'unknown') return null;

  let params = resolveHintsInParams(intent, llm.params || {}, ctx.users || []);
  let pendingVoicePick = params.pendingVoicePick || null;
  delete params.pendingVoicePick;

  const missingKey =
    intent === 'create_ticket'
      ? 'ticketMissing'
      : intent === 'create_task'
        ? 'taskMissing'
        : intent === 'create_meeting'
          ? 'meetingMissing'
          : intent === 'assign_ticket'
            ? 'assignMissing'
            : null;

  const parsed = {
    intent,
    confidence: llm.confidence >= 0.85 ? 'high' : llm.confidence >= 0.6 ? 'medium' : 'low',
    params,
    summary: String(llm.summary || '').slice(0, 200) || transcript.slice(0, 80),
    allowed: intent !== 'unknown',
    denyReason: null,
    llmRefined: true,
    llmConfidence: Number(llm.confidence) || 0.7,
    pendingVoicePick,
  };

  if (missingKey && Array.isArray(llm.missing) && llm.missing.length) {
    parsed[missingKey] = llm.missing;
  }

  return finalizeVoiceParse(parsed, { ...ctx, raw: transcript, transcript });
}

async function callLlm(transcript, ctx = {}, ruleParse = null) {
  const cfg = llmConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  const userContent = [
    `Comando del usuario: "${transcript}"`,
    ruleParse?.intent && ruleParse.intent !== 'unknown'
      ? `Interpretación preliminar (reglas): intent=${ruleParse.intent}, params=${JSON.stringify(ruleParse.params || {})}`
      : 'Interpretación preliminar: no reconocida por reglas.',
  ].join('\n');

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(ctx) },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const json = parseLlmJson(content);
    return mapLlmToParsed(json, transcript, ctx);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refina parseo con LLM si está configurado y el parseo por reglas es débil.
 */
async function refineParseWithLlm(transcript, ruleParse, ctx = {}) {
  if (!isLlmConfigured()) return ruleParse;
  if (!shouldUseLlmRefinement(ruleParse, transcript)) return ruleParse;

  try {
    const llmParse = await callLlm(transcript, ctx, ruleParse);
    if (!llmParse?.allowed || llmParse.intent === 'unknown') return ruleParse;

    if (!ruleParse?.allowed || ruleParse.intent === 'unknown') {
      return llmParse;
    }

    if (ruleParse.intent === llmParse.intent) {
      return finalizeVoiceParse(
        {
          ...ruleParse,
          params: mergeParseParams(ruleParse.params, llmParse.params),
          llmRefined: true,
          llmConfidence: llmParse.llmConfidence,
          confidence: llmParse.llmConfidence >= 0.85 ? 'high' : ruleParse.confidence,
          pendingVoicePick: ruleParse.pendingVoicePick || llmParse.pendingVoicePick,
          ticketMissing: llmParse.ticketMissing || ruleParse.ticketMissing,
          taskMissing: llmParse.taskMissing || ruleParse.taskMissing,
          meetingMissing: llmParse.meetingMissing || ruleParse.meetingMissing,
          assignMissing: llmParse.assignMissing || ruleParse.assignMissing,
        },
        { ...ctx, raw: transcript, transcript },
      );
    }

    const { scoreParseQuality } = require('./voicePrecision');
    const ruleQ = scoreParseQuality(ruleParse, transcript, ctx);
    const llmQ = scoreParseQuality(llmParse, transcript, ctx);
    return llmQ >= ruleQ + 8 ? llmParse : ruleParse;
  } catch (err) {
    console.warn('[voiceLlm]', err.message);
    return ruleParse;
  }
}

module.exports = {
  isLlmConfigured,
  refineParseWithLlm,
  shouldUseLlmRefinement,
};
