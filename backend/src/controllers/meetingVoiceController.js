const fs = require('fs');
const path = require('path');
const { getDb } = require('../database/init');
const { parseMeetingAttendees } = require('../utils/participantNotify');
const { buildMinuteDraftFromTranscript } = require('../services/minuteFromTranscriptService');
const { structureTranscript } = require('../services/transcriptSpeakerService');
const { transcribeAudioFile, isConfigured } = require('../services/voiceTranscriptionService');
const { relativeAudioPath, uploadsRoot } = require('../utils/minuteAudio');
const { ensurePlaybackAudioFile } = require('../utils/audioPlayback');
function parseMeetingRow(row) {
  if (!row) return null;
  return {
    ...row,
    attendees: parseMeetingAttendees(row.attendees),
  };
}

function userCanAccessMeeting(meeting, user) {
  if (!meeting || !user) return false;
  const uid = Number(user.id);
  if (Number(meeting.created_by) === uid) return true;
  if (user.role === 'superadmin' || user.role === 'administrator') return true;
  return (meeting.attendees || []).some((id) => Number(id) === uid);
}

function loadUsersMap(db) {
  const users = db.prepare('SELECT id, name, apellido, puesto, departamento FROM users').all();
  const map = new Map();
  for (const u of users) map.set(Number(u.id), u);
  return map;
}

/**
 * POST /api/meetings/:id/generate-minute-from-voice
 * multipart: audio (file), transcript (optional text fallback)
 */
const generateMinuteFromVoice = async (req, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!meetingId) return res.status(400).json({ message: 'ID de reunión inválido.' });

    const db = getDb();
    const meeting = parseMeetingRow(db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId));
    if (!meeting) return res.status(404).json({ message: 'Reunión no encontrada.' });
    if (!userCanAccessMeeting(meeting, req.user)) {
      return res.status(403).json({ message: 'No tienes permiso para generar minuta de esta reunión.' });
    }

    const clientTranscript = String(req.body?.transcript || '').trim();
    if (!req.file && !clientTranscript) {
      return res.status(400).json({
        message: 'Envía un archivo de audio o una transcripción de respaldo.',
      });
    }

    let transcript = clientTranscript;
    let transcriptionSource = clientTranscript ? 'client' : null;
    let audioPath = null;
    let audioUrl = null;
    let audioSize = 0;

    if (req.file) {
      const audioFilePath = req.file.path;
      const fileSize = fs.statSync(audioFilePath).size;
      if (fileSize < 64) {
        try {
          if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
        } catch (_) { /* noop */ }
        if (!clientTranscript) {
          return res.status(400).json({
            message: 'El archivo de audio está vacío. Graba al menos unos segundos e intenta de nuevo.',
          });
        }
      } else {
        let playbackFilePath = audioFilePath;
        try {
          const fromWhisper = await transcribeAudioFile(audioFilePath);
          if (fromWhisper) {
            transcript = fromWhisper;
            transcriptionSource = 'whisper';
          }
        } catch (sttErr) {
          if (sttErr.code === 'WHISPER_NOT_CONFIGURED' && clientTranscript) {
            transcript = clientTranscript;
            transcriptionSource = 'client_fallback';
          } else if (!clientTranscript) {
            try {
              if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
            } catch (_) { /* noop */ }
            return res.status(503).json({
              message: sttErr.message || 'No se pudo transcribir el audio.',
              code: sttErr.code || 'STT_ERROR',
              whisperConfigured: isConfigured(),
            });
          } else {
            transcriptionSource = 'client_fallback';
          }
        }

        try {
          playbackFilePath = await ensurePlaybackAudioFile(audioFilePath);
        } catch (convErr) {
          console.warn('[meetingVoice] conversión reproducción:', convErr.message);
          playbackFilePath = audioFilePath;
        }

        audioPath = relativeAudioPath(playbackFilePath);
        if (audioPath) {
          const saved = path.join(uploadsRoot(), audioPath);
          const savedSize = fs.existsSync(saved) ? fs.statSync(saved).size : 0;
          if (savedSize > 64) {
            audioUrl = `/api/uploads/${audioPath}`;
            audioSize = savedSize;
          } else {
            audioPath = null;
          }
        }
      }
    }

    if (!transcript.trim()) {
      return res.status(400).json({ message: 'No se obtuvo texto de la grabación.' });
    }

    const usersById = loadUsersMap(db);
    const attendeeUsers = (meeting.attendees || [])
      .map((id) => usersById.get(Number(id)))
      .filter(Boolean);
    const captureMode = String(req.body?.capture_mode || meeting.location_type || 'sala_juntas');
    const structured = structureTranscript(
      transcript,
      attendeeUsers,
      captureMode === 'virtual' ? 'virtual' : 'sala_juntas',
    );
    const draft = buildMinuteDraftFromTranscript(meeting, usersById, transcript, structured);

    const existing = db
      .prepare('SELECT id FROM meeting_minutes WHERE meeting_id = ? ORDER BY id DESC LIMIT 1')
      .get(meetingId);

    if (audioPath && existing?.id) {
      db.prepare(
        `UPDATE meeting_minutes SET audio_path = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(audioPath, existing.id);
    }

    res.json({
      draft,
      minute_brief: draft.minute_brief || null,
      transcript: structured.formattedText || transcript,
      transcript_segments: structured.segments,
      speaker_count: structured.speakerCount,
      transcriptionSource,
      capture_mode: captureMode,
      meeting_id: meetingId,
      existing_minute_id: existing?.id ?? null,
      audio_path: audioPath,
      audio_url: audioUrl,
      audio_size: audioSize,
      whisperConfigured: isConfigured(),
      diarizationHint:
        structured.speakerCount <= 1 && meeting.location_type === 'sala_juntas'
          ? 'Para identificar voces en sala, cada participante puede decir "Nombre Apellido:" antes de hablar.'
          : null,
    });
  } catch (err) {
    console.error('[meetingVoice]', err);
    res.status(500).json({ message: err.message || 'Error al generar minuta desde voz.' });
  }
};

const getVoiceStatus = (req, res) => {
  res.json({
    whisperConfigured: isConfigured(),
    diarizationConfigured: Boolean(process.env.DIARIZATION_BIN),
    hint: isConfigured()
      ? 'Listo para transcribir en servidor (whisper.cpp).'
      : 'Configura WHISPER_BIN y WHISPER_MODEL en .env, o usa transcripción del navegador como respaldo.',
    salaHint:
      'En sala física: micrófono central y que cada persona diga su nombre antes de intervenir (ej. "María López: …").',
    virtualHint:
      'En reunión virtual: puedes grabar micrófono + audio de la pestaña (Teams/Meet/Zoom).',
  });
};

module.exports = {
  generateMinuteFromVoice,
  getVoiceStatus,
};
