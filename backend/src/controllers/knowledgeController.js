const fs = require('fs');
const path = require('path');
const { getDb } = require('../database/init');

const THEMES = new Set(['navy', 'gold', 'muted', 'emerald', 'indigo', 'rose', 'teal', 'amber', 'custom']);
const CONTENT_TYPES = new Set(['link', 'media']);
const ICON_IDS = new Set([
  'folder', 'cloud', 'video', 'link', 'database', 'users', 'calendar',
  'chart', 'book', 'shield', 'mail', 'building', 'toolbox', 'globe', 'camera',
]);

const COLOR_DEFAULTS = {
  icon: 'folder',
  bg_color: '#071221',
  bg_color_end: '#0a1930',
  text_color: '#f0f4fa',
  subtext_color: 'rgba(240,244,250,0.72)',
  icon_color: 'rgba(255,255,255,0.22)',
  badge_bg: 'rgba(255,255,255,0.14)',
  badge_text: 'rgba(255,255,255,0.85)',
};

const UPLOADS_DIR = path.join(__dirname, '../../data/uploads');

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || '').trim());
}

function isColorValue(value) {
  const v = String(value || '').trim();
  return isHexColor(v) || /^rgba?\(/i.test(v);
}

function safeMediaBasename(mediaPath) {
  const base = path.basename(String(mediaPath || '').trim());
  if (!base || base.includes('..') || base.includes('/') || base.includes('\\')) return null;
  return base;
}

function mediaUrlFromPath(mediaPath) {
  const base = safeMediaBasename(mediaPath);
  if (!base) return null;
  const full = path.join(UPLOADS_DIR, base);
  if (!fs.existsSync(full)) return null;
  return `/api/uploads/${base}`;
}

function deleteMediaFile(mediaPath) {
  const base = safeMediaBasename(mediaPath);
  if (!base) return;
  const full = path.join(UPLOADS_DIR, base);
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.warn('[knowledge] no se pudo borrar archivo:', err.message);
  }
}

function mapRow(row) {
  if (!row) return null;
  const comingSoon = Number(row.coming_soon) === 1;
  const contentType = CONTENT_TYPES.has(row.content_type) ? row.content_type : 'link';
  const hasMedia = contentType === 'media' && Boolean(row.media_path);
  const hasLink = contentType === 'link' && Boolean(row.href);
  const available = Number(row.available) === 1 && !comingSoon && (hasLink || hasMedia);
  return {
    id: row.slug,
    dbId: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    href: row.href || null,
    contentType,
    mediaPath: row.media_path || null,
    mediaFilename: row.media_filename || null,
    mediaMimetype: row.media_mimetype || null,
    mediaUrl: hasMedia ? mediaUrlFromPath(row.media_path) : null,
    available,
    comingSoon,
    theme: THEMES.has(row.theme) ? row.theme : 'navy',
    icon: ICON_IDS.has(row.icon) ? row.icon : COLOR_DEFAULTS.icon,
    bg_color: row.bg_color || COLOR_DEFAULTS.bg_color,
    bg_color_end: row.bg_color_end || COLOR_DEFAULTS.bg_color_end,
    text_color: row.text_color || COLOR_DEFAULTS.text_color,
    subtext_color: row.subtext_color || COLOR_DEFAULTS.subtext_color,
    icon_color: row.icon_color || COLOR_DEFAULTS.icon_color,
    badge_bg: row.badge_bg || COLOR_DEFAULTS.badge_bg,
    badge_text: row.badge_text || COLOR_DEFAULTS.badge_text,
    sort_order: row.sort_order ?? 0,
  };
}

function normalizePayload(body, { existing = null } = {}) {
  const title = String(body?.title || '').trim();
  const subtitle = String(body?.subtitle || '').trim();
  const href = String(body?.href || '').trim();
  const comingSoon = Boolean(body?.comingSoon ?? body?.coming_soon);
  let contentType = CONTENT_TYPES.has(body?.contentType) ? body.contentType : 'link';
  const theme = THEMES.has(body?.theme) ? body.theme : 'custom';
  const icon = ICON_IDS.has(body?.icon) ? body.icon : COLOR_DEFAULTS.icon;

  const mediaPathRaw = String(body?.media_path || body?.mediaPath || '').trim();
  const mediaFilename = String(body?.media_filename || body?.mediaFilename || '').trim() || null;
  const mediaMimetype = String(body?.media_mimetype || body?.mediaMimetype || '').trim() || null;
  const mediaPath = safeMediaBasename(mediaPathRaw);

  const colors = {
    bg_color: String(body?.bg_color || COLOR_DEFAULTS.bg_color).trim(),
    bg_color_end: String(body?.bg_color_end || COLOR_DEFAULTS.bg_color_end).trim(),
    text_color: String(body?.text_color || COLOR_DEFAULTS.text_color).trim(),
    subtext_color: String(body?.subtext_color || COLOR_DEFAULTS.subtext_color).trim(),
    icon_color: String(body?.icon_color || COLOR_DEFAULTS.icon_color).trim(),
    badge_bg: String(body?.badge_bg || COLOR_DEFAULTS.badge_bg).trim(),
    badge_text: String(body?.badge_text || COLOR_DEFAULTS.badge_text).trim(),
  };

  if (!title) return { error: 'El título es obligatorio.' };
  if (!subtitle) return { error: 'El subtítulo es obligatorio.' };

  if (comingSoon) {
    contentType = 'link';
  } else if (contentType === 'media') {
    const resolvedMedia = mediaPath || safeMediaBasename(existing?.media_path);
    if (!resolvedMedia || !mediaUrlFromPath(resolvedMedia)) {
      return { error: 'Sube un archivo o imagen para este acceso multimedia.' };
    }
    if (!isHexColor(colors.bg_color) || !isHexColor(colors.bg_color_end)) {
      return { error: 'Los colores de fondo deben ser hex (#RRGGBB).' };
    }
    for (const key of ['text_color', 'subtext_color', 'icon_color', 'badge_bg', 'badge_text']) {
      if (!isColorValue(colors[key])) {
        return { error: `Color inválido en ${key}.` };
      }
    }
    return {
      title,
      subtitle,
      href: null,
      content_type: 'media',
      media_path: resolvedMedia,
      media_filename: mediaFilename || existing?.media_filename || resolvedMedia,
      media_mimetype: mediaMimetype || existing?.media_mimetype || null,
      available: 1,
      coming_soon: 0,
      theme,
      icon,
      ...colors,
    };
  }

  if (!href) return { error: 'Indica la URL del acceso directo.' };
  if (!/^https?:\/\//i.test(href)) {
    return { error: 'La URL debe comenzar con http:// o https://' };
  }

  if (!isHexColor(colors.bg_color) || !isHexColor(colors.bg_color_end)) {
    return { error: 'Los colores de fondo deben ser hex (#RRGGBB).' };
  }
  for (const key of ['text_color', 'subtext_color', 'icon_color', 'badge_bg', 'badge_text']) {
    if (!isColorValue(colors[key])) {
      return { error: `Color inválido en ${key}.` };
    }
  }

  return {
    title,
    subtitle,
    href,
    content_type: 'link',
    media_path: null,
    media_filename: null,
    media_mimetype: null,
    available: 1,
    coming_soon: 0,
    theme,
    icon,
    ...colors,
  };
}

function normalizeComingSoonPayload(body) {
  const title = String(body?.title || '').trim();
  const subtitle = String(body?.subtitle || '').trim();
  const theme = THEMES.has(body?.theme) ? body.theme : 'custom';
  const icon = ICON_IDS.has(body?.icon) ? body.icon : COLOR_DEFAULTS.icon;
  const colors = {
    bg_color: String(body?.bg_color || COLOR_DEFAULTS.bg_color).trim(),
    bg_color_end: String(body?.bg_color_end || COLOR_DEFAULTS.bg_color_end).trim(),
    text_color: String(body?.text_color || COLOR_DEFAULTS.text_color).trim(),
    subtext_color: String(body?.subtext_color || COLOR_DEFAULTS.subtext_color).trim(),
    icon_color: String(body?.icon_color || COLOR_DEFAULTS.icon_color).trim(),
    badge_bg: String(body?.badge_bg || COLOR_DEFAULTS.badge_bg).trim(),
    badge_text: String(body?.badge_text || COLOR_DEFAULTS.badge_text).trim(),
  };

  if (!title) return { error: 'El título es obligatorio.' };
  if (!subtitle) return { error: 'El subtítulo es obligatorio.' };
  if (!isHexColor(colors.bg_color) || !isHexColor(colors.bg_color_end)) {
    return { error: 'Los colores de fondo deben ser hex (#RRGGBB).' };
  }
  for (const key of ['text_color', 'subtext_color', 'icon_color', 'badge_bg', 'badge_text']) {
    if (!isColorValue(colors[key])) {
      return { error: `Color inválido en ${key}.` };
    }
  }

  return {
    title,
    subtitle,
    href: null,
    content_type: 'link',
    media_path: null,
    media_filename: null,
    media_mimetype: null,
    available: 0,
    coming_soon: 1,
    theme,
    icon,
    ...colors,
  };
}

function resolvePayload(body, existing = null) {
  const comingSoon = Boolean(body?.comingSoon ?? body?.coming_soon);
  if (comingSoon) return normalizeComingSoonPayload(body);
  return normalizePayload(body, { existing });
}

function getLinkById(db, id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  return db.prepare('SELECT * FROM knowledge_links WHERE id = ? AND is_active = 1').get(numericId);
}

const listKnowledgeLinks = (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM knowledge_links
         WHERE is_active = 1
         ORDER BY sort_order ASC, id ASC`,
      )
      .all();
    res.json(rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener accesos de Knowledge.' });
  }
};

const uploadKnowledgeMedia = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    const media_path = req.file.filename;
    res.status(201).json({
      media_path,
      media_url: `/api/uploads/${media_path}`,
      media_filename: req.file.originalname,
      media_mimetype: req.file.mimetype,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo subir el archivo.' });
  }
};

const createKnowledgeLink = (req, res) => {
  try {
    const payload = resolvePayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    const db = getDb();
    let slug = slugify(req.body?.slug || payload.title);
    if (!slug) slug = `acceso-${Date.now()}`;

    const exists = db.prepare('SELECT id FROM knowledge_links WHERE slug = ?').get(slug);
    if (exists) slug = `${slug}-${Date.now()}`;

    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM knowledge_links').get();
    const sortOrder = (maxOrder?.max_order ?? 0) + 1;

    const info = db
      .prepare(
        `INSERT INTO knowledge_links
         (slug, title, subtitle, href, content_type, media_path, media_filename, media_mimetype,
          available, coming_soon, theme, icon,
          bg_color, bg_color_end, text_color, subtext_color, icon_color, badge_bg, badge_text,
          sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        payload.title,
        payload.subtitle,
        payload.href,
        payload.content_type,
        payload.media_path,
        payload.media_filename,
        payload.media_mimetype,
        payload.available,
        payload.coming_soon,
        payload.theme,
        payload.icon,
        payload.bg_color,
        payload.bg_color_end,
        payload.text_color,
        payload.subtext_color,
        payload.icon_color,
        payload.badge_bg,
        payload.badge_text,
        sortOrder,
        req.user?.id ?? null,
      );

    const row = db.prepare('SELECT * FROM knowledge_links WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ message: 'Acceso directo creado.', item: mapRow(row) });
  } catch (err) {
    console.error(err);
    if (String(err.message || '').includes('CHECK constraint failed')) {
      return res.status(400).json({
        error: 'Paleta de color no válida en la base de datos. Reinicia el servidor para aplicar la migración.',
      });
    }
    res.status(500).json({ error: 'Error al crear el acceso directo.' });
  }
};

const updateKnowledgeLink = (req, res) => {
  try {
    const db = getDb();
    const existing = getLinkById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Acceso no encontrado.' });

    const payload = resolvePayload(req.body, existing);
    if (payload.error) return res.status(400).json({ error: payload.error });

    if (existing.media_path && existing.media_path !== payload.media_path) {
      deleteMediaFile(existing.media_path);
    }

    db.prepare(
      `UPDATE knowledge_links SET
        title = ?, subtitle = ?, href = ?, content_type = ?,
        media_path = ?, media_filename = ?, media_mimetype = ?,
        available = ?, coming_soon = ?, theme = ?, icon = ?,
        bg_color = ?, bg_color_end = ?, text_color = ?, subtext_color = ?,
        icon_color = ?, badge_bg = ?, badge_text = ?
       WHERE id = ?`,
    ).run(
      payload.title,
      payload.subtitle,
      payload.href,
      payload.content_type,
      payload.media_path,
      payload.media_filename,
      payload.media_mimetype,
      payload.available,
      payload.coming_soon,
      payload.theme,
      payload.icon,
      payload.bg_color,
      payload.bg_color_end,
      payload.text_color,
      payload.subtext_color,
      payload.icon_color,
      payload.badge_bg,
      payload.badge_text,
      existing.id,
    );

    const row = db.prepare('SELECT * FROM knowledge_links WHERE id = ?').get(existing.id);
    res.json({ message: 'Acceso actualizado.', item: mapRow(row) });
  } catch (err) {
    console.error(err);
    if (String(err.message || '').includes('CHECK constraint failed')) {
      return res.status(400).json({
        error: 'Paleta de color no válida en la base de datos. Reinicia el servidor para aplicar la migración.',
      });
    }
    res.status(500).json({ error: 'Error al actualizar el acceso directo.' });
  }
};

const deleteKnowledgeLink = (req, res) => {
  try {
    const db = getDb();
    const existing = getLinkById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Acceso no encontrado.' });

    if (existing.media_path) deleteMediaFile(existing.media_path);

    db.prepare('UPDATE knowledge_links SET is_active = 0 WHERE id = ?').run(existing.id);
    res.json({ message: 'Acceso eliminado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el acceso directo.' });
  }
};

module.exports = {
  listKnowledgeLinks,
  uploadKnowledgeMedia,
  createKnowledgeLink,
  updateKnowledgeLink,
  deleteKnowledgeLink,
};
