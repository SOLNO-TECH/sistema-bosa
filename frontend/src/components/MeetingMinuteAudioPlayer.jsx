import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

function apiUrl(path) {
  const base = axios.defaults.baseURL || '';
  if (!path) return null;
  if (path.startsWith('blob:') || path.startsWith('http')) return path;
  return `${base}${path}`;
}

/** Misma origen: el <audio> nativo puede usar Range (M4A/WebM con metadatos). */
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

async function fetchAudioAsObjectUrl(requestUrl, revokeRef) {
  const res = await axios.get(requestUrl, {
    responseType: 'blob',
    timeout: 120000,
  });
  const rawType = (res.headers['content-type'] || 'audio/mp4').split(';')[0].trim();
  const type =
    rawType === 'video/webm' || rawType === 'application/octet-stream'
      ? 'audio/webm'
      : rawType === 'video/mp4'
        ? 'audio/mp4'
        : rawType;
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type });
  if (!blob.size) {
    throw new Error('El archivo de audio está vacío.');
  }
  if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
  const objectUrl = URL.createObjectURL(blob);
  revokeRef.current = objectUrl;
  return objectUrl;
}

/**
 * Reproductor de la grabación completa de la reunión.
 * @param {Blob|null} audioBlob — grabación local (previsualización)
 * @param {string|null} audioUrl — /api/uploads/… o URL absoluta
 * @param {number|null} minuteId — /api/minutes/:id/audio (con auth)
 */
export default function MeetingMinuteAudioPlayer({
  audioBlob = null,
  audioUrl,
  minuteId = null,
  className = '',
  variant = 'card',
}) {
  const audioRef = useRef(null);
  const revokeRef = useRef(null);
  const blobRevokeRef = useRef(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [useDirect, setUseDirect] = useState(false);

  const serverRequestUrl = useMemo(() => {
    const direct = apiUrl(audioUrl);
    if (direct) return direct;
    if (minuteId) return apiUrl(`/api/minutes/${minuteId}/audio`);
    return null;
  }, [audioUrl, minuteId]);

  const hasLocalBlob = Boolean(audioBlob && audioBlob.size > 64);

  useEffect(() => {
    let cancelled = false;

    const reset = () => {
      setPlaybackUrl(null);
      setLoadError('');
      setUseDirect(false);
      setLoading(false);
    };

    if (!hasLocalBlob && !serverRequestUrl) {
      reset();
      return undefined;
    }

    if (blobRevokeRef.current) {
      URL.revokeObjectURL(blobRevokeRef.current);
      blobRevokeRef.current = null;
    }
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = null;
    }

    (async () => {
      setLoading(true);
      setLoadError('');

      try {
        if (serverRequestUrl && shouldUseDirectPlayback(serverRequestUrl)) {
          if (!cancelled) {
            setUseDirect(true);
            setPlaybackUrl(serverRequestUrl);
          }
          return;
        }

        if (serverRequestUrl) {
          const objectUrl = await fetchAudioAsObjectUrl(serverRequestUrl, revokeRef);
          if (!cancelled) {
            setUseDirect(false);
            setPlaybackUrl(objectUrl);
          }
          return;
        }

        if (hasLocalBlob) {
          const objectUrl = URL.createObjectURL(audioBlob);
          blobRevokeRef.current = objectUrl;
          if (!cancelled) {
            setUseDirect(false);
            setPlaybackUrl(objectUrl);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (hasLocalBlob) {
          try {
            const objectUrl = URL.createObjectURL(audioBlob);
            blobRevokeRef.current = objectUrl;
            setUseDirect(false);
            setPlaybackUrl(objectUrl);
            setLoadError('');
            return;
          } catch (_) {
            /* noop */
          }
        }
        const msg =
          err.response?.data?.message ||
          err.message ||
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
      if (blobRevokeRef.current) {
        URL.revokeObjectURL(blobRevokeRef.current);
        blobRevokeRef.current = null;
      }
    };
  }, [serverRequestUrl, hasLocalBlob, audioBlob]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playbackUrl) return undefined;
    return fixWebmDuration(el);
  }, [playbackUrl]);

  const handleAudioError = () => {
    if (!serverRequestUrl || !useDirect) {
      setLoadError('No se pudo reproducir este formato de audio en el navegador.');
      return;
    }
    setUseDirect(false);
    setLoading(true);
    fetchAudioAsObjectUrl(serverRequestUrl, revokeRef)
      .then((url) => {
        setPlaybackUrl(url);
        setLoadError('');
      })
      .catch((err) => {
        setLoadError(err.message || 'No se pudo cargar el audio.');
        setPlaybackUrl(null);
      })
      .finally(() => setLoading(false));
  };

  if (!hasLocalBlob && !serverRequestUrl && !audioUrl && !minuteId) return null;

  const audioControl = loading ? (
    <p className="meeting-minute-audio__status">Cargando audio…</p>
  ) : loadError ? (
    <p className="meeting-minute-audio__status meeting-minute-audio__status--error">{loadError}</p>
  ) : playbackUrl ? (
    <audio
      ref={audioRef}
      key={playbackUrl}
      controls
      preload="metadata"
      className={
        variant === 'embed' ? 'meeting-minute-audio__player--embed' : 'meeting-minute-audio__player w-full'
      }
      src={playbackUrl}
      onError={handleAudioError}
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
