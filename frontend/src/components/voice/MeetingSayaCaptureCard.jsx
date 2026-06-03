/**
 * Botón para iniciar grabación de la reunión con Saya AI.
 */
export default function MeetingSayaCaptureCard({ processing = false, onStart }) {
  return (
    <button
      type="button"
      disabled={processing}
      onClick={onStart}
      className="meeting-sheet__minute-btn saya-capture-card__btn"
    >
      {processing ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950" />
          Procesando…
        </>
      ) : (
        <>
          <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
          Grabar reunión
        </>
      )}
    </button>
  );
}
