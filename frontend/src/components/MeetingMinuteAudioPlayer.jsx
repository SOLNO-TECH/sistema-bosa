import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

function apiUrl(path) {
  const base = axios.defaults.baseURL || '';
  if (!path) return null;
  if (path.startsWith('blob:') || path.startsWith('http')) return path;
  return `${base}${path}`;
}

/** Misma origen / blob: el <audio> nativo usa Range y metadatos WebM correctamente. */
function shouldUseDirectPlayback(url) {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) return true;
  return url.startsWith('/api/uploads/');
}

/** MediaRecorder suele dejar duration en Infinity; forzar lectura del final del WebM. */
function fixWebmDuration(audioEl) {
  const repair = () => {
    const d = audioEl.duration;
    if (!Number.isFinite(d) || d === Infinity || d <= 0) {
      const onTimeUpdate = () => {
        audioEl.removeEventListener('timeupdate', onTimeUpdate);
        if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
          audioEl.currentTime = 0;
        }
      };
      audioEl.addEventListener('timeupdate', onTimeUpdate);
      try {
        audioEl.currentTime = 1e10;
      } catch (_) {
        /* noop */
      }
    }
  };
  audioEl.addEventListener('loadedmetadata', repair);
  if (audioEl.readyState >= 1) repair();
  return () => audioEl.removeEventListener('loadedmetadata', repair);
}

/**
 * Reproductor de la grabación completa de la reunión.
 * @param {string|null} audioUrl — blob:, /api/uploads/… o URL absoluta
 * @param {number|null} minuteId — si existe, usa /api/minutes/:id/audio (con auth)
 */
export default function MeetingMinuteAudioPlayer({
  audioUrl,
  minuteId = null,
  className = '',
  variant = 'card',
}) {
  const audioRef = useRef(null);
  const revokeRef = useRef(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const requestUrl = useMemo(() => {
    const direct = apiUrl(audioUrl);
    if (direct) return direct;
    if (minuteId) return apiUrl(`/api/minutes/${minuteId}/audio`);
    return null;
  }, [audioUrl, minuteId]);

  useEffect(() => {
    if (!requestUrl) {
      setPlaybackUrl(null);
      setLoadError('');
      return undefined;
    }

    if (shouldUseDirectPlayback(requestUrl)) {
      setPlaybackUrl(requestUrl);
      setLoadError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    (async () => {
      try {
        const res = await axios.get(requestUrl, {
          responseType: 'blob',
          timeout: 120000,
        });
        if (cancelled) return;

        const rawType = (res.headers['content-type'] || 'audio/webm').split(';')[0].trim();
        const type =
          rawType === 'video/webm' || rawType === 'application/octet-stream' ? 'audio/webm' : rawType;
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type });

        if (!blob.size) {
          setLoadError('El archivo de audio está vacío.');
          setPlaybackUrl(null);
          return;
        }

        if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
        const objectUrl = URL.createObjectURL(blob);
        revokeRef.current = objectUrl;
        setPlaybackUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err.response?.data?.message ||
          (err.response?.status === 404
            ? 'No se encontró la grabación.'
            : 'No se pudo cargar el audio.');
        setLoadError(msg);
        setPlaybackUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, [requestUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playbackUrl) return undefined;
    return fixWebmDuration(el);
  }, [playbackUrl]);

  if (!requestUrl && !audioUrl && !minuteId) return null;

  const audioControl = loading ? (
    <p className="meeting-minute-audio__status">Cargando audio…</p>
  ) : loadError ? (
    <p className="meeting-minute-audio__status meeting-minute-audio__status--error">{loadError}</p>
  ) : playbackUrl ? (
    <audio
      ref={audioRef}
      key={playbackUrl}
      controls
      preload="auto"
      className={
        variant === 'embed' ? 'meeting-minute-audio__player--embed' : 'meeting-minute-audio__player w-full'
      }
      src={playbackUrl}
    >
      Tu navegador no puede reproducir este audio.
    </audio>
  ) : null;

  if (variant === 'embed') {
    return <div className={`meeting-minute-audio--embed ${className}`.trim()}>{audioControl}</div>;
  }

  const player = (
    <div className="meeting-minute-audio__inner">
      <div className="meeting-minute-audio__icon" aria-hidden>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        {variant === 'card' ? (
          <>
            <p className="meeting-minute-audio__title">Grabación de la reunión</p>
            <p className="meeting-minute-audio__hint">Audio completo de la reunión</p>
          </>
        ) : null}
        {audioControl}
      </div>
    </div>
  );

  if (variant === 'plain') {
    return <div className={className}>{player}</div>;
  }

  return (
    <div className={`meeting-minute-audio ${className}`.trim()}>
      {player}
    </div>
  );
}
