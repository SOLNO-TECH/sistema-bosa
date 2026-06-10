import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import MeetingMinuteAudioPlayer from './MeetingMinuteAudioPlayer';
import SayaBrandMark from './voice/SayaBrandMark';
import {
  MinutaSaveProLock,
  MinutaSynerteamProLockedPreview,
} from './MinutaProSections';
import { minuteHasManualActa } from '../utils/minuteContent';

function formatDisplayDate(iso) {
  if (!iso) return '—';
  try {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function buildFormFromDraft(draft) {
  return {
    lugar: draft.lugar || '',
    fecha: draft.fecha || '',
    hora_inicio: draft.hora_inicio || '',
    hora_cierre: draft.hora_cierre || '',
    tema: draft.tema || '',
    attendees: Array.isArray(draft.attendees) ? [...draft.attendees] : [],
    transcript_text: draft.transcript_text || '',
  };
}

function MinutePreview({
  form,
  transcript,
  transcriptSegments = [],
  audioUrl,
  audioBlob = null,
  minuteId = null,
  showRecordingSection = false,
}) {
  const filledAttendees = (form.attendees || []).filter((a) => (a.nombre || '').trim());
  const transcriptText = String(transcript || form.transcript_text || '').trim();
  const hasSegments = transcriptSegments?.length > 0;
  const showTranscript = Boolean(transcriptText || hasSegments);

  return (
    <div className="voice-minute-preview">
      <div className="voice-minute-card">
        <div className="voice-minute-card__hero">
          <p className="voice-minute-card__eyebrow">Minuta de reunión</p>
          <h3 className="voice-minute-card__title">{form.tema || 'Sin tema'}</h3>
          <p className="voice-minute-card__meta">
            {formatDisplayDate(form.fecha)}
            {form.hora_inicio ? ` · ${form.hora_inicio}` : ''}
            {form.hora_cierre ? ` – ${form.hora_cierre}` : ''}
            {form.lugar ? ` · ${form.lugar}` : ''}
          </p>
        </div>

        {filledAttendees.length > 0 && (
          <div className="voice-minute-card__block">
            <p className="meeting-sheet__section-label mt-0 mb-2">Asistentes</p>
            <div className="meeting-sheet__group overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#071221] text-white">
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide">Nombre</th>
                    <th className="hidden px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide sm:table-cell">Cargo</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide">Asist.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filledAttendees.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{row.nombre}</td>
                      <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">{row.cargo || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{row.asistencia || 'Presente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <MinutaSynerteamProLockedPreview />

      {showRecordingSection ? (
        <section className="voice-minute-card">
          <div className="voice-minute-audio-head">
            <p className="voice-minute-audio-head__label">Audio de la reunión</p>
            <p className="voice-minute-audio-head__sub">Escucha la grabación completa</p>
          </div>
          <div className="voice-minute-audio-body">
            {audioUrl || audioBlob?.size || minuteId ? (
              <MeetingMinuteAudioPlayer
                audioBlob={audioBlob}
                audioUrl={audioUrl}
                minuteId={minuteId}
                variant="plain"
              />
            ) : (
              <p className="voice-minute-empty">
                No se detectó archivo de audio. Vuelve a grabar la reunión para conservar el audio.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {showTranscript ? (
        <details className="voice-minute-transcript" open>
          <summary>Transcripción detectada</summary>
          <p className="voice-minute-transcript__hint">
            Texto capturado en vivo durante la reunión para confirmar que Saya escuchó correctamente.
          </p>
          <div className="voice-minute-transcript__body">
            {hasSegments ? (
              <div className="space-y-3">
                {transcriptSegments.map((seg, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-bold text-slate-900">[{seg.speaker}]</span>{' '}
                    <span className="text-slate-600">{seg.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{transcriptText}</p>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function MeetingVoiceMinuteModal({
  open,
  onClose,
  draft: initialDraft,
  transcript,
  transcriptSegments = [],
  linkedMinute = null,
  existingMinuteId,
  recordingAudioUrl = null,
  recordingAudioBlob = null,
  showRecordingSection = false,
}) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (open && initialDraft) {
      setForm(buildFormFromDraft(initialDraft));
    }
  }, [open, initialDraft]);

  if (!open || !form) return null;

  const saveLabel = minuteHasManualActa(linkedMinute) ? 'Actualizar minuta' : 'Crear minuta';

  return createPortal(
    <div className="voice-minute-overlay animate-fade-in" onClick={onClose} role="presentation">
      <div
        className="voice-minute-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-minute-title"
      >
        <header className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="voice-minute-sheet__brand-row">
                <SayaBrandMark variant="hero" className="voice-minute-sheet__brand" />
                <span className="voice-minute-sheet__brand-tag">· Minuta con Saya</span>
              </div>
              <p id="voice-minute-title" className="meeting-sheet__hero-subtitle voice-minute-sheet__intro">
                Audio y transcripción ya quedaron guardados. El acta con análisis IA es Pro.
              </p>
            </div>
            <button type="button" onClick={onClose} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="voice-minute-sheet__body">
          <MinutePreview
            form={form}
            transcript={transcript}
            transcriptSegments={transcriptSegments}
            audioUrl={recordingAudioUrl}
            audioBlob={recordingAudioBlob}
            minuteId={existingMinuteId}
            showRecordingSection={showRecordingSection}
          />
        </div>

        <footer className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
          <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
            >
              <svg
                className="voice-minute-footer__icon voice-minute-footer__icon--close"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              Cerrar
            </button>
            <MinutaSaveProLock label={saveLabel} />
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
