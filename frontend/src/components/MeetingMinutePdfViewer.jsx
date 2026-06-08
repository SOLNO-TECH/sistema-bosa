import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createMinutaPdfBlobUrl } from '../utils/exportMinutaPdf';

export default function MeetingMinutePdfViewer({ minute, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (!minute) return undefined;
    let url = null;
    try {
      url = createMinutaPdfBlobUrl(minute);
      setPdfUrl(url);
    } catch (e) {
      console.error(e);
      alert('No se pudo generar la vista previa.');
      onClose?.();
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [minute]);

  if (!minute) return null;

  return createPortal(
    <div
      className="meeting-sheet-overlay z-[140] animate-fade-in"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
      role="presentation"
    >
      <div
        className="meeting-minute-pdf-viewer meeting-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="minute-pdf-viewer-title"
      >
        <div className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="meeting-sheet__pill meeting-sheet__pill--gold">Vista previa</span>
              <h3 id="minute-pdf-viewer-title" className="meeting-sheet__hero-title mt-2">
                {minute.tema || 'Minuta de reunión'}
              </h3>
              <p className="meeting-sheet__hero-subtitle">Formato PDF · consulta en pantalla</p>
            </div>
            <button type="button" onClick={onClose} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="meeting-minute-pdf-viewer__body">
          {pdfUrl ? (
            <iframe
              title={`Vista previa: ${minute.tema || 'Minuta'}`}
              src={pdfUrl}
              className="meeting-minute-pdf-viewer__frame"
            />
          ) : (
            <div className="meeting-minute-pdf-viewer__loading">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden />
              <p>Generando vista previa…</p>
            </div>
          )}
        </div>

        <div className="meeting-sheet__footer shrink-0">
          <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="voice-minute-footer__btn voice-minute-footer__btn--primary w-full !flex-none"
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
              Cerrar vista
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
