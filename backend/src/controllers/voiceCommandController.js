const fs = require('fs');
const { preprocessTranscript } = require('../utils/voiceTranscriptNormalize');
const { repairTranscript, buildParseVariants } = require('../utils/voiceTranscriptRepair');
const { mergeTranscripts } = require('../utils/mergeTranscripts');
const { getDb } = require('../database/init');
const { parseVoiceCommand } = require('../services/voiceCommandParserService');
const { executeVoiceCommand } = require('../services/voiceCommandExecutorService');
const { transcribeAudioFile, isConfigured } = require('../services/voiceTranscriptionService');
const { warmupWhisper } = require('../services/whisperServerService');
const { synthesizeSpeechWav, isServerTtsAvailable } = require('../services/ttsService');
const {
  findLearnedMatch,
  logVoiceAttempt,
  learnFromSuccess,
  getUserWhisperHints,
  getLearningStats,
} = require('../services/voice/voiceLearningService');
const { buildSuggestions, suggestionHintMessage } = require('../services/voice/voiceIntentSuggestions');
const {
  mergeWithSessionContext,
  rememberSession,
  clearSession,
  getSessionForParse,
  rememberPostExecute,
  clearPostExecute,
  getPostExecute,
} = require('../services/voice/voiceSessionContext');
const { pickBestParse, reconcileLearnedWithFresh } = require('../services/voice/voicePrecision');
const { refineParseWithLlm, isLlmConfigured } = require('../services/voice/voiceLlmParser');

const HELP_EXAMPLES = [
  '“Crear ticket impresora dañada prioridad alta”',
  '“Cerrar ticket 12” / “Ticket 5 en progreso”',
  '“Crear tarea revisar inventario asignar a María López”',
  '“Asignar ticket 12 a Juan Pérez” / tras crear ticket: “asignar a María López”',
  '“Agenda reunión revisión semanal de obra mañana a las 10 virtual”',
  '“Reunión semanal hasta el 30 de junio, título seguimiento de obra, a las 9”',
  '“Publicar aviso corte de agua el viernes”',
  '“Abrir calendario” / “Ir a tickets” / “Ver minutas”',
];

function loadActiveUsers(db) {
  return db
    .prepare(
      `SELECT id, name, apellido, email, departamento, puesto, role, is_active
       FROM users WHERE is_active = 1 ORDER BY name`,
    )
    .all();
}

/**
 * POST /api/voice/commands/parse
 * body: { transcript } o multipart audio + transcript opcional
 */
const parseCommand = async (req, res) => {
  let audioPath = null;
  try {
    const clientTranscript = String(req.body?.transcript || '').trim();
    let whisperText = '';
    let transcript = clientTranscript;

    if (req.file?.path) {
      audioPath = req.file.path;

      if (!isConfigured()) {
        if (!clientTranscript) {
          return res.status(400).json({
            message:
              'Whisper no está configurado en el servidor. Usa Chrome o Edge para que Saya AI transcriba en el navegador, o define WHISPER_BIN y WHISPER_MODEL en backend/.env.',
            code: 'WHISPER_NOT_CONFIGURED',
            whisperConfigured: false,
          });
        }
        // Usar transcripción del navegador (local / sin Whisper)
      } else {
        try {
          whisperText = (await transcribeAudioFile(audioPath, { userId: req.user?.id, users })) || '';
        } catch (sttErr) {
          if (clientTranscript) {
            transcript = clientTranscript;
          } else {
            return res.status(503).json({
              message: sttErr.message || 'No se pudo transcribir el audio.',
              code: sttErr.code || 'STT_ERROR',
              whisperConfigured: isConfigured(),
            });
          }
        }
        if (whisperText || clientTranscript) {
          transcript = mergeTranscripts(whisperText, clientTranscript);
        }
      }
    }

    if (!transcript) {
      return res.status(400).json({ message: 'Envía texto o audio del comando.' });
    }

    const userId = req.user?.id;
    const db = getDb();
    const users = loadActiveUsers(db);
    const activeModule = String(req.body?.activeModule || '').trim();
    const parseCtx = {
      users,
      actor: req.user,
      activeModule,
      session: getSessionForParse(userId),
      postExecute: getPostExecute(userId),
    };

    const prepareTranscript = (raw) => {
      let t = preprocessTranscript(String(raw || '').trim());
      return mergeWithSessionContext(t, userId);
    };

    const tryParse = async (raw) => {
      const prepared = prepareTranscript(raw);
      if (!prepared) return null;

      const attempts = [];
      const variants = buildParseVariants(prepared);

      for (const variant of variants) {
        const prep = variant === prepared ? prepared : prepareTranscript(variant);
        if (!prep) continue;

        const learned = findLearnedMatch(userId, prep, users);
        const fresh = parseVoiceCommand(prep, parseCtx);
        let parsed = learned ? reconcileLearnedWithFresh(learned, fresh, prep) : fresh;

        if (isLlmConfigured()) {
          parsed = await refineParseWithLlm(prep, parsed, { ...parseCtx, raw: prep, transcript: prep });
        }

        attempts.push({ transcript: prep, parsed, ctx: parseCtx });
      }

      const best = pickBestParse(attempts);
      if (best) {
        if (best.parsed && !best.parsed.repaired && best.transcript !== prepared) {
          best.parsed.repaired = best.transcript !== prepared;
        }
        return best;
      }

      return { transcript: prepared, parsed: parseVoiceCommand(prepared, parseCtx), ctx: parseCtx };
    };

    const candidates = [transcript];
    if (clientTranscript && clientTranscript !== transcript) candidates.push(clientTranscript);
    if (whisperText && whisperText !== transcript && whisperText !== clientTranscript) {
      candidates.push(whisperText);
    }

    let parsed = null;
    for (const candidate of candidates) {
      const attempt = await tryParse(candidate);
      if (!attempt?.parsed) continue;
      if (attempt.parsed.allowed && attempt.parsed.intent !== 'unknown') {
        transcript = attempt.transcript;
        parsed = attempt.parsed;
        break;
      }
      if (!parsed || (attempt.parsed.parseQuality || 0) > (parsed.parseQuality || 0)) {
        transcript = attempt.transcript;
        parsed = attempt.parsed;
      }
    }

    if (!parsed) {
      transcript = prepareTranscript(transcript);
      parsed = parseVoiceCommand(transcript, parseCtx);
      if (isLlmConfigured()) {
        parsed = await refineParseWithLlm(transcript, parsed, { ...parseCtx, raw: transcript, transcript });
      }
    }

    const suggestions = buildSuggestions(transcript, parsed, activeModule);
    if ((!parsed?.allowed || parsed?.intent === 'unknown') && suggestions.length) {
      parsed = parsed || { intent: 'unknown', allowed: false, params: {} };
      parsed.suggestions = suggestions;
      parsed.suggestionHint = suggestionHintMessage(suggestions);
      if (!parsed.allowed) parsed.denyReason = parsed.suggestionHint;
    }

    rememberSession(userId, transcript, parsed, activeModule);

    logVoiceAttempt(userId, transcript, parsed, { activeModule });

    res.json({
      transcript,
      parsed,
      whisperConfigured: isConfigured(),
      llmConfigured: isLlmConfigured(),
      helpExamples: HELP_EXAMPLES,
      learning: {
        fromMemory: Boolean(parsed?.learned),
        memoryHits: parsed?.memoryHits || 0,
        stats: getLearningStats(userId),
      },
    });
  } catch (err) {
    console.error('[voiceCommand parse]', err);
    res.status(500).json({ message: err.message || 'Error al interpretar comando.' });
  } finally {
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (_) { /* noop */ }
    }
  }
};

/**
 * POST /api/voice/commands/execute
 * body: { intent, params, confirmed: true }
 */
const executeCommand = (req, res) => {
  try {
    if (req.body?.confirmed !== true && req.body?.confirmed !== 'true') {
      return res.status(400).json({
        message: 'Debes confirmar la acción antes de ejecutarla (confirmed: true).',
      });
    }

    const { intent, params } = req.body;
    if (!intent) return res.status(400).json({ message: 'Falta intent.' });

    const transcript = String(req.body?.transcript || '').trim();
    const summary = String(req.body?.summary || '').trim();

    if (intent === 'navigate' || intent === 'help' || intent === 'open_minute') {
      if (transcript) {
        learnFromSuccess(req.user.id, transcript, {
          intent,
          params: params || {},
          summary: summary || 'Navegación',
          allowed: true,
        });
        logVoiceAttempt(req.user.id, transcript, { intent, allowed: true }, { executed: true });
      }
      return res.json({
        success: true,
        clientOnly: true,
        intent,
        params: params || {},
        module: intent === 'open_minute' ? 'minutas' : params?.module,
        related_id: intent === 'open_minute' ? Number(params?.minute_id) : undefined,
        message:
          intent === 'help'
            ? 'Saya AI está listo.'
            : intent === 'open_minute'
              ? 'Abriendo minuta.'
              : 'Navegación solicitada.',
        helpExamples: HELP_EXAMPLES,
        learning: getLearningStats(req.user?.id),
      });
    }

    const result = executeVoiceCommand(intent, params || {}, req.user);

    if (intent === 'create_ticket' && result?.related_id) {
      rememberPostExecute(req.user.id, {
        ticket_id: result.related_id,
        category: params?.category || '',
      });
    }
    if (intent === 'assign_ticket') {
      clearPostExecute(req.user.id);
    }

    if (transcript) {
      learnFromSuccess(req.user.id, transcript, {
        intent,
        params: params || {},
        summary: summary || result.message,
        allowed: true,
      });
      logVoiceAttempt(req.user.id, transcript, { intent, allowed: true }, { executed: true });
    }

    clearSession(req.user.id);

    res.json({ ...result, intent, learning: getLearningStats(req.user?.id) });
  } catch (err) {
    console.error('[voiceCommand execute]', err);
    res.status(400).json({ message: err.message || 'No se pudo ejecutar el comando.' });
  }
};

const postWarmup = async (req, res) => {
  if (!isConfigured()) {
    return res.json({ ok: false, whisperConfigured: false });
  }
  try {
    const ready = await warmupWhisper();
    res.json({ ok: ready, whisperConfigured: true, mode: ready ? 'server' : 'cli' });
  } catch (err) {
    res.status(503).json({ ok: false, message: err.message || 'Warmup falló.' });
  }
};

const postReinforce = (req, res) => {
  try {
    const transcript = String(req.body?.transcript || '').trim();
    const { intent, params, summary } = req.body;
    if (!transcript || !intent) {
      return res.status(400).json({ message: 'Faltan transcript e intent.' });
    }
    learnFromSuccess(req.user.id, transcript, {
      intent,
      params: params || {},
      summary: summary || '',
      allowed: true,
    });
    logVoiceAttempt(req.user.id, transcript, { intent, allowed: true }, { executed: true });
    res.json({ ok: true, learning: getLearningStats(req.user?.id) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'No se pudo reforzar aprendizaje.' });
  }
};

const getCommandHelp = (req, res) => {
  res.json({
    whisperConfigured: isConfigured(),
    llmConfigured: isLlmConfigured(),
    ttsAvailable: isServerTtsAvailable(),
    learning: getLearningStats(req.user?.id),
    examples: HELP_EXAMPLES,
    intents: [
      'create_ticket',
      'update_ticket',
      'assign_ticket',
      'update_ticket_status',
      'create_task',
      'update_task',
      'update_task_status',
      'create_meeting',
      'update_meeting',
      'create_aviso',
      'append_minute_note',
      'open_minute',
      'query_meetings',
      'query_tickets',
      'query_tasks',
      'query_avisos',
      'query_minutas',
      'query_notifications',
      'navigate',
      'help',
    ],
  });
};

const postTts = async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Falta texto.' });

    const wavPath = await synthesizeSpeechWav(text);
    if (!wavPath) {
      return res.status(503).json({
        message: 'TTS del servidor no disponible en este equipo.',
        ttsAvailable: false,
      });
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(wavPath);
    stream.on('close', () => {
      try {
        fs.unlinkSync(wavPath);
      } catch (_) { /* noop */ }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[voice TTS]', err);
    res.status(500).json({ message: err.message || 'Error al sintetizar voz.' });
  }
};

module.exports = {
  parseCommand,
  executeCommand,
  getCommandHelp,
  postWarmup,
  postReinforce,
  postTts,
};
