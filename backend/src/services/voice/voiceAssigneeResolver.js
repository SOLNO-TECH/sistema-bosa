/**
 * Resolución de responsables por voz — sin clics en UI.
 */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function userFullName(u) {
  return `${u.name || ''} ${u.apellido || ''}`.trim();
}

function actorPermissionLevel(actor) {
  if (!actor) return 'user';
  return (
    actor.permission_level ||
    (actor.role === 'superadmin'
      ? 'superadmin'
      : actor.role === 'administrator'
        ? 'administrator'
        : actor.role === 'manager'
          ? 'manager'
          : 'user')
  );
}

function levenshtein(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x === y) return 0;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  const row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= y.length; j += 1) {
      const val = x[i - 1] === y[j - 1] ? row[j - 1] : Math.min(row[j], row[j - 1], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[y.length] = prev;
  }
  return row[y.length];
}

function fuzzyWordMatch(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const maxLen = Math.max(x.length, y.length);
  if (maxLen < 3) return 0;
  const dist = levenshtein(x, y);
  const ratio = 1 - dist / maxLen;
  return ratio >= 0.78 ? ratio * 0.88 : 0;
}

function scoreUserMatch(user, hint) {
  const q = normalizeText(hint);
  if (!q) return 0;
  const hay = normalizeText(
    [userFullName(user), user.email, user.departamento, user.name, user.apellido].filter(Boolean).join(' '),
  );
  if (hay === q) return 1;
  if (hay.includes(q)) return 0.92;
  const parts = q.split(/\s+/).filter((w) => w.length > 1);
  if (parts.length >= 2) {
    const nameScore = parts.reduce((acc, w) => acc + Math.max(fuzzyWordMatch(user.name, w), fuzzyWordMatch(user.apellido, w)), 0) / parts.length;
    if (parts.every((w) => hay.includes(w))) return 0.88;
    if (nameScore >= 0.75) return 0.82 + nameScore * 0.08;
  }
  if (parts.length === 1) {
    const w = parts[0];
    const first = normalizeText(user.name || '');
    const last = normalizeText(user.apellido || '');
    const fuzzyFirst = fuzzyWordMatch(first, w);
    const fuzzyLast = fuzzyWordMatch(last, w);
    if (first === w || last === w) return 0.85;
    if (fuzzyFirst >= 0.7 || fuzzyLast >= 0.7) return Math.max(fuzzyFirst, fuzzyLast);
    if (first.startsWith(w.slice(0, Math.min(4, w.length))) || last.startsWith(w.slice(0, Math.min(4, w.length)))) {
      return 0.72;
    }
    if (w.length >= 3 && hay.includes(w)) return 0.65;
  }
  return 0;
}

function filterUsersForActor(users, actor) {
  const level = actorPermissionLevel(actor);
  const actorDept = actor?.departamento ? normalizeText(actor.departamento) : '';
  if (level !== 'manager' || !actorDept) return users.filter((u) => u.is_active !== 0);
  return users.filter((u) => {
    if (u.is_active === 0) return false;
    const ud = normalizeText(u.departamento || '');
    return !ud || ud === actorDept || ud.includes(actorDept) || actorDept.includes(ud);
  });
}

function findUsersByHint(users, hint) {
  const q = normalizeText(hint);
  if (!q || q.length < 2) return [];
  const parts = q.split(/\s+/).filter((w) => w.length > 1);

  return users.filter((u) => {
    const hay = normalizeText(
      [userFullName(u), u.email, u.departamento, u.name, u.apellido, u.puesto].filter(Boolean).join(' '),
    );
    if (hay.includes(q)) return true;
    if (parts.length >= 2 && parts.every((w) => w.length > 2 && hay.includes(w))) return true;
    if (parts.length === 1) {
      const w = parts[0];
      const first = normalizeText(u.name || '');
      const last = normalizeText(u.apellido || '');
      if (first.startsWith(w.slice(0, Math.min(4, w.length)))) return true;
      if (last.startsWith(w.slice(0, Math.min(4, w.length)))) return true;
      if (w.length >= 3 && hay.includes(w)) return true;
    }
    return false;
  });
}

/**
 * Resuelve responsable: auto-elige si hay un ganador claro; si no, pide desambiguación por voz.
 */
function resolveAssignee(users, hint, actor = null, { maxOptions = 4 } = {}) {
  const pool = filterUsersForActor(users, actor);
  if (!hint) {
    return { assigned_to: null, needsVoicePick: null, assignee_hint: null };
  }

  let matches = findUsersByHint(pool, hint);
  if (matches.length === 0) {
    matches = findUsersByHint(users.filter((u) => u.is_active !== 0), hint);
  }

  if (matches.length === 1) {
    return { assigned_to: matches[0].id, needsVoicePick: null, assignee_hint: hint };
  }

  if (matches.length > 1) {
    const scored = matches
      .map((u) => ({ u, score: scoreUserMatch(u, hint) }))
      .sort((a, b) => b.score - a.score);
    if (scored.length >= 2 && scored[0].score - scored[1].score >= 0.12 && scored[0].score >= 0.7) {
      return { assigned_to: scored[0].u.id, needsVoicePick: null, assignee_hint: hint };
    }
    const options = scored.slice(0, maxOptions).map(({ u }) => ({
      id: u.id,
      label: userFullName(u),
      dept: u.departamento || '',
    }));
    return {
      assigned_to: null,
      needsVoicePick: { field: 'assigned_to', options, hint },
      assignee_hint: hint,
    };
  }

  const fuzzyPool = pool.length ? pool : users.filter((u) => u.is_active !== 0);
  const fuzzyScored = fuzzyPool
    .map((u) => ({ u, score: scoreUserMatch(u, hint) }))
    .filter((x) => x.score >= 0.72)
    .sort((a, b) => b.score - a.score);

  if (fuzzyScored.length === 1) {
    return { assigned_to: fuzzyScored[0].u.id, needsVoicePick: null, assignee_hint: hint };
  }
  if (fuzzyScored.length > 1 && fuzzyScored[0].score - fuzzyScored[1].score >= 0.08) {
    return { assigned_to: fuzzyScored[0].u.id, needsVoicePick: null, assignee_hint: hint };
  }

  return { assigned_to: null, needsVoicePick: null, assignee_hint: hint };
}

function buildVoicePickPrompt(pick, fieldLabel = 'responsable') {
  const opts = pick?.options || [];
  if (opts.length < 2) return '';
  const parts = opts.map((o, i) => {
    const dept = o.dept ? ` de ${o.dept}` : '';
    return `${i + 1}, ${o.label}${dept}`;
  });
  return `Encontré varias personas. ¿Cuál es el ${fieldLabel}? Di el nombre o el número: ${parts.join('; ')}.`;
}

function resolveVoicePick(transcript, options) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const t = normalizeText(transcript);
  if (!t) return null;

  for (const opt of options) {
    const label = normalizeText(opt.label || '');
    if (label && (t === label || t.includes(label) || label.includes(t))) return opt.id;
    const parts = label.split(/\s+/).filter((w) => w.length > 2);
    if (parts.length >= 2 && parts.every((w) => t.includes(w))) return opt.id;
    const first = parts[0];
    if (first && first.length >= 3 && t.includes(first)) {
      const sameFirst = options.filter((o) => normalizeText(o.label || '').startsWith(first));
      if (sameFirst.length === 1) return sameFirst[0].id;
    }
  }

  const ordinals = [
    [/^(la\s+)?(primera|primer|uno|una|1)\b/, 0],
    [/^(la\s+)?(segunda|segundo|dos|2)\b/, 1],
    [/^(la\s+)?(tercera|tercero|tres|3)\b/, 2],
    [/^(la\s+)?(cuarta|cuarto|cuatro|4)\b/, 3],
  ];
  for (const [re, idx] of ordinals) {
    if (re.test(t) && options[idx]) return options[idx].id;
  }

  const num = t.match(/\b(opcion|numero|n[uú]mero)?\s*(\d)\b/);
  if (num) {
    const idx = Number(num[2]) - 1;
    if (options[idx]) return options[idx].id;
  }

  return null;
}

module.exports = {
  resolveAssignee,
  resolveVoicePick,
  buildVoicePickPrompt,
  findUsersByHint,
  userFullName,
  scoreUserMatch,
};
