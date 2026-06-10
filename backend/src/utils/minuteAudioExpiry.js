const { deleteAudioFileIfExists } = require('./minuteAudio');

const TEMP_AUDIO_HOURS = 24;

function applySayaAudioRetentionSql() {
  return {
    expiresExpr: `datetime('now', '+${TEMP_AUDIO_HOURS} hours')`,
    permanent: 0,
  };
}

function isMinuteAudioExpired(row) {
  if (!row?.audio_path) return false;
  if (Number(row.audio_permanent) === 1) return false;
  if (!row.audio_expires_at) return false;
  return true;
}

/**
 * Si el audio temporal ya venció, borra el archivo y limpia la fila.
 * Devuelve la fila actualizada (audio_path puede quedar null).
 */
function ensureMinuteAudioNotExpired(db, row) {
  if (!row?.id || !row.audio_path) return row;
  if (Number(row.audio_permanent) === 1) return row;
  if (!row.audio_expires_at) return row;

  const expired = db
    .prepare(
      `SELECT id, audio_path FROM meeting_minutes
       WHERE id = ? AND audio_expires_at IS NOT NULL AND audio_expires_at <= datetime('now')`,
    )
    .get(row.id);

  if (!expired) return row;

  deleteAudioFileIfExists(expired.audio_path);
  db.prepare(
    `UPDATE meeting_minutes SET
      audio_path = NULL,
      audio_expires_at = NULL,
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(row.id);

  return { ...row, audio_path: null, audio_expires_at: null };
}

function purgeExpiredMinuteAudio(db) {
  const expired = db
    .prepare(
      `SELECT id, audio_path FROM meeting_minutes
       WHERE audio_path IS NOT NULL AND TRIM(audio_path) != ''
         AND COALESCE(audio_permanent, 0) = 0
         AND audio_expires_at IS NOT NULL
         AND audio_expires_at <= datetime('now')`,
    )
    .all();

  for (const row of expired) {
    deleteAudioFileIfExists(row.audio_path);
    db.prepare(
      `UPDATE meeting_minutes SET
        audio_path = NULL,
        audio_expires_at = NULL,
        updated_at = datetime('now')
       WHERE id = ?`,
    ).run(row.id);
  }

  return expired.length;
}

function startMinuteAudioExpiryJanitor(getDb) {
  const run = () => {
    try {
      const purged = purgeExpiredMinuteAudio(getDb());
      if (purged > 0) {
        console.log(`[audio-expiry] ${purged} grabación(es) temporal(es) eliminada(s).`);
      }
    } catch (err) {
      console.warn('[audio-expiry]', err.message);
    }
  };
  run();
  return setInterval(run, 60 * 60 * 1000);
}

module.exports = {
  TEMP_AUDIO_HOURS,
  applySayaAudioRetentionSql,
  isMinuteAudioExpired,
  ensureMinuteAudioNotExpired,
  purgeExpiredMinuteAudio,
  startMinuteAudioExpiryJanitor,
};
