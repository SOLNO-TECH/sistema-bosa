import BosaGoldButton from './BosaGoldButton';
import { exportMinutaPdf, previewMinutaPdf } from '../utils/exportMinutaPdf';
import { minuteHasUserContent } from '../utils/minuteContent';

export default function MeetingMinuteActaPanel({ minute, canManage = false, onCreate, onEdit }) {
  const hasContent = minuteHasUserContent(minute);

  if (!hasContent && !canManage) return null;

  const handleExport = () => {
    try {
      exportMinutaPdf(minute);
    } catch (e) {
      console.error(e);
      alert('No se pudo exportar el PDF.');
    }
  };

  const handleView = () => {
    try {
      previewMinutaPdf(minute);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'No se pudo abrir la vista previa. Permite ventanas emergentes en el navegador.');
    }
  };

  if (!hasContent) {
    return (
      <>
        <p className="meeting-sheet__section-label">Acta de la reunión</p>
        <div className="meeting-sheet__group">
          <div className="meeting-sheet__cell meeting-sheet__cell--field">
            <p className="meeting-sheet__cell-note mb-4">
              Aún no hay minuta con contenido. Al crearla, fecha, asistentes y lugar se cargan desde esta reunión.
            </p>
            <BosaGoldButton icon="minute" onClick={onCreate} className="w-full !flex-none">
              Crear minuta
            </BosaGoldButton>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="meeting-sheet__section-label">Acta de la reunión</p>
      <div className="meeting-sheet__group">
        <div className="meeting-sheet__cell">
          <p className="meeting-sheet__cell-label">Estado</p>
          <p className="meeting-sheet__cell-value">
            <span className="meeting-minute-acta__status-pill">Registrada</span>
          </p>
        </div>
        <div className="meeting-sheet__cell">
          <p className="meeting-sheet__cell-label">Título</p>
          <p className="meeting-sheet__cell-value meeting-sheet__cell-value--body">
            {minute.tema || '—'}
          </p>
        </div>
      </div>

      <div className="meeting-minute-acta__toolbar">
        <div className="meeting-minute-acta__visualizar-wrap">
          <button
            type="button"
            onClick={handleView}
            className="voice-minute-footer__btn voice-minute-footer__btn--primary meeting-minute-acta__visualizar-btn"
          >
            <svg
              className="voice-minute-footer__icon voice-minute-footer__icon--ticket"
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
            Visualizar
          </button>
        </div>
        <div className="meeting-minute-acta__secondary-actions">
          <button
            type="button"
            onClick={handleExport}
            className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
          >
            <svg
              className="voice-minute-footer__icon voice-minute-footer__icon--save"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
            </svg>
            Exportar PDF
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={onEdit}
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
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              Editar minuta
            </button>
          ) : null}
        </div>
      </div>

    </>
  );
}
