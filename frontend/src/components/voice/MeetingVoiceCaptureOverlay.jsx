import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SayaBrandMark from './SayaBrandMark';
import SayaHolographicOrb from './SayaHolographicOrb';

/**
 * Pantalla fullscreen — grabación de reunión con Saya AI.
 */
export default function MeetingVoiceCaptureOverlay({
  open,
  onClose,
  meetingTitle = '',
  captureMode = 'sala_juntas',
  attendees = [],
  voice,
  processing = false,
  error = '',
  onStopAndProcess,
}) {
  const autoStarted = useRef(false);
  const transcriptScrollRef = useRef(null);
  const isVirtual = captureMode === 'virtual';

  const startCapture = async () => {
    try {
      await voice.beginCapture({ includeTabAudio: isVirtual });
    } catch {
      /* parent */
    }
  };

  useEffect(() => {
    if (!open) {
      autoStarted.current = false;
      voice.teardownListening();
      return undefined;
    }
    if (processing) return undefined;

    voice.prepareListening({ includeTabAudio: isVirtual });
    const t = setTimeout(() => {
      if (!autoStarted.current && !voice.isRecording) {
        autoStarted.current = true;
        startCapture();
      }
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isVirtual, processing]);

  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [voice.transcriptFinal, voice.transcriptInterim, voice.browserTranscript]);

  if (!open) return null;

  const livePreview = voice.browserTranscript?.trim() || '';
  const speechErr = voice.speechError || error;
  const isLive = voice.isRecording && !processing;
  const voiceActive =
    Boolean(voice.userSpeaking || voice.micActive || voice.micSpeechDetected || voice.transcriptInterim);
  const orbMode = processing
    ? 'processing'
    : isLive
      ? voiceActive
        ? 'speaking'
        : 'listening'
      : 'idle';

  const statusLine = processing
    ? 'Transcribiendo y estructurando la acta…'
    : isLive
      ? voiceActive
        ? 'Procesando lenguaje en tiempo real'
        : isVirtual
          ? voice.tabAudioActive
            ? 'Escuchando · micrófono y pestaña'
            : 'Escuchando · micrófono'
          : 'Escuchando la sala'
      : 'Preparando…';

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex flex-col bg-[#050d1a] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saya-voice-brand"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="saya-voice-glow absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2" />
      </div>

      <header className="meeting-sheet__hero saya-voice-header relative z-10 shrink-0">
        <button
          type="button"
          disabled={processing}
          onClick={() => {
            voice.teardownListening();
            onClose();
          }}
          className="saya-voice-exit"
          aria-label="Cerrar"
        >
          <svg
            className="saya-voice-exit__icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="saya-voice-header__content">
          <SayaBrandMark variant="hero" id="saya-voice-brand" className="saya-voice-header__brand" />
          <p className="saya-voice-header__promise">
            {processing
              ? 'Con Saya trabajamos para ti — estamos cuidando cada detalle de tu minuta.'
              : 'Con Saya trabajamos para ti — tu junta queda bien registrada, sin que te preocupes.'}
          </p>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-4">
        <SayaHolographicOrb
          mode={orbMode}
          voiceActive={voiceActive}
          micLevel={voice.micLevel}
          className="mb-3 shrink-0"
        />

        {meetingTitle?.trim() ? (
          <p className="saya-voice-meeting-name" title={meetingTitle.trim()}>
            {meetingTitle.trim()}
          </p>
        ) : null}

        <p className="text-center text-sm text-white/80">{statusLine}</p>
        {isLive && (
          <p className="mt-1 font-mono text-2xl tabular-nums text-gold">{voice.elapsedLabel}</p>
        )}

        {!isLive && !processing && (
          <div className="mt-4 w-full max-w-md rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/65">
            {isVirtual ? (
              <p>
                Al iniciar, elige la pestaña de Teams, Meet o Zoom y marca{' '}
                <span className="text-white">Compartir audio</span>.
              </p>
            ) : (
              <>
                <p>
                  Coloca el dispositivo al centro. Cada persona puede decir su nombre antes de hablar.
                </p>
                {attendees.length > 0 && (
                  <p className="mt-2 text-white/40">
                    {attendees.slice(0, 6).join(', ')}
                    {attendees.length > 6 ? '…' : ''}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="voice-capture-transcript mt-5 w-full max-w-md shrink-0">
          <p className="voice-capture-transcript__label">Transcripción en vivo</p>
          <div ref={transcriptScrollRef} className="voice-capture-transcript__body">
            <p className="text-sm leading-relaxed text-white/90">
              {livePreview ? (
                <>
                  {voice.transcriptFinal ? <span>{voice.transcriptFinal}</span> : null}
                  {voice.transcriptInterim ? (
                    <span className="text-gold/90">
                      {voice.transcriptFinal ? ' ' : ''}
                      {voice.transcriptInterim}
                    </span>
                  ) : null}
                </>
              ) : isLive ? (
                <span className="text-white/40">
                  {voice.speechListening ? 'Esperando voz…' : 'Activando…'}
                </span>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>

        {speechErr ? <p className="mt-3 max-w-md text-center text-xs text-red-300">{speechErr}</p> : null}
      </div>

      <footer className="voice-capture-footer relative z-10 shrink-0 border-t border-white/10 bg-black/30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {isLive ? (
          <div className="voice-capture-footer__actions">
            <button
              type="button"
              onClick={() => {
                voice.cancelRecording();
                onClose();
              }}
              className="voice-capture-footer__btn voice-capture-footer__btn--secondary"
            >
              <svg
                className="voice-capture-footer__icon voice-capture-footer__icon--cancel"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              Cancelar
            </button>
            <button
              type="button"
              onClick={onStopAndProcess}
              className="voice-capture-footer__btn voice-capture-footer__btn--primary"
            >
              <svg
                className="voice-capture-footer__icon voice-capture-footer__icon--done"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
                <path d="M15 4v3h3" />
                <path d="M9 14l2 2 4-4.5" />
              </svg>
              Terminar
            </button>
          </div>
        ) : processing ? (
          <p className="text-center text-xs text-white/60">
            <span className="text-gold/90 font-semibold">Saya AI</span> · generando minuta…
          </p>
        ) : (
          <button type="button" onClick={startCapture} className="meeting-sheet__minute-btn mx-auto block max-w-xs">
            {isVirtual ? 'Iniciar grabación' : 'Iniciar junta'}
          </button>
        )}
      </footer>
    </div>,
    document.body,
  );
}
