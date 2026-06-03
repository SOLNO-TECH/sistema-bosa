import { createPortal } from 'react-dom';
import MeetingMinuteAudioPlayer from './MeetingMinuteAudioPlayer';

function formatFecha(fecha) {
  if (!fecha) return null;
  try {
    const d = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return fecha;
  }
}

function formatHorario(inicio, cierre) {
  if (!inicio && !cierre) return null;
  if (inicio && cierre) return `${inicio} – ${cierre}`;
  return inicio || cierre;
}

export default function MinutaListenModal({ record, onClose, onViewFull }) {
  if (!record) return null;

  const fecha = formatFecha(record.fecha);
  const horario = formatHorario(record.hora_inicio, record.hora_cierre);
  const metaLine = [fecha, record.lugar, horario].filter(Boolean).join(' · ');

  return createPortal(
    <div
      className="meeting-sheet-overlay z-[120] animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="meeting-sheet meeting-sheet--form meeting-sheet--listen animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="minuta-listen-title"
      >
        <header className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="meeting-sheet__pill meeting-sheet__pill--gold">Minutas</span>
              <h2 id="minuta-listen-title" className="meeting-sheet__hero-title mt-2">
                {record.tema || 'Sin tema'}
              </h2>
              {metaLine ? <p className="meeting-sheet__hero-subtitle">{metaLine}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="meeting-sheet__scroll meeting-sheet__scroll--listen">
          <p className="meeting-sheet__section-label mt-0">Grabación de la reunión</p>
          <MeetingMinuteAudioPlayer
            minuteId={record.id}
            audioUrl={record.audio_url}
            variant="card"
          />
          <p className="meeting-sheet__cell-note mt-4 text-center">
            Audio vinculado a la reunión registrada en el calendario.
          </p>
        </div>

        <footer className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
          <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
            <button
              type="button"
              onClick={onViewFull}
              className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
            >
              <svg
                className="voice-minute-footer__icon voice-minute-footer__icon--edit"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Ver minuta completa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="voice-minute-footer__btn voice-minute-footer__btn--primary"
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
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
