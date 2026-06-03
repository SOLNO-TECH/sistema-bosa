import { useCallback, useEffect, useRef, useState } from 'react';

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const SPEECH_ERROR_MESSAGES = {
  network:
    'Chrome no puede transcribir: revisa tu internet o firewall (el reconocimiento usa servidores de Google).',
  'not-allowed': 'Permiso de micrófono denegado. Actívalo en el candado del navegador.',
  'no-speech': '',
  aborted: '',
  'audio-capture': 'No se pudo usar el micrófono.',
  'service-not-allowed': 'Reconocimiento de voz bloqueado. Usa Chrome/Edge en localhost o HTTPS.',
};

/** Un solo idioma arranca más rápido; solo se cambia si hay error de red. */
const SPEECH_LANGS = ['es-MX', 'es-ES'];
const RESTART_MS = 40;
const STALL_WARN_MS = 6000;
const STALL_ERROR_MS = 18000;

function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

function audioFilenameForBlob(blob) {
  const type = (blob?.type || '').toLowerCase();
  if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'comando.m4a';
  if (type.includes('ogg')) return 'comando.ogg';
  return 'comando.webm';
}

async function buildCombinedAudioStream({ includeTabAudio }) {
  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: { ideal: 1 },
    },
  });
  if (!includeTabAudio || !navigator.mediaDevices?.getDisplayMedia) {
    return { stream: micStream, tabCapture: false, audioContext: null };
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    displayStream.getVideoTracks().forEach((t) => t.stop());

    const tabTrack = displayStream.getAudioTracks()[0];
    if (!tabTrack) {
      return { stream: micStream, tabCapture: false, audioContext: null };
    }

    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(micStream).connect(dest);
    ctx.createMediaStreamSource(new MediaStream([tabTrack])).connect(dest);
    return { stream: dest.stream, tabCapture: true, audioContext: ctx };
  } catch {
    return { stream: micStream, tabCapture: false, audioContext: null };
  }
}

export function useMeetingVoiceRecorder({ serverSttAvailable = false } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcriptFinal, setTranscriptFinal] = useState('');
  const [transcriptInterim, setTranscriptInterim] = useState('');
  const [speechSupported, setSpeechSupported] = useState(() => !!getSpeechRecognition());
  const [speechListening, setSpeechListening] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micSpeechDetected, setMicSpeechDetected] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speechStalled, setSpeechStalled] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [speechDebugCode, setSpeechDebugCode] = useState('');
  const [tabAudioActive, setTabAudioActive] = useState(false);
  const [lastSpeechEndAt, setLastSpeechEndAt] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const watchdogRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const micMonitorCtxRef = useRef(null);
  const levelRafRef = useRef(null);
  const micLevelEmitRef = useRef(0);
  const transcriptRef = useRef('');
  const finalizedRef = useRef('');
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef(null);
  const preparePromiseRef = useRef(null);
  const langIndexRef = useRef(0);
  const lastResultAtRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const speechEngineStartedRef = useRef(false);
  const speechListeningRef = useRef(false);
  const createRecognitionRef = useRef(null);
  const interimRef = useRef('');
  const lastSpeechEndAtRef = useRef(0);
  const serverSttRef = useRef(serverSttAvailable);

  const applyTranscript = useCallback((finalPart, interimPart) => {
    const full = `${finalPart}${interimPart}`.trim();
    if (full) {
      lastResultAtRef.current = Date.now();
      setSpeechStalled(false);
      setSpeechError('');
    }
    transcriptRef.current = full;
    setTranscriptFinal(finalPart.trim());
    setTranscriptInterim(interimPart.trim());
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopMicLevelMonitor = useCallback(() => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (micMonitorCtxRef.current) {
      try {
        micMonitorCtxRef.current.close();
      } catch (_) { /* noop */ }
      micMonitorCtxRef.current = null;
    }
    setMicActive(false);
    setMicSpeechDetected(false);
    setMicLevel(0);
  }, []);

  const startMicLevelMonitor = useCallback((stream) => {
    stopMicLevelMonitor();
    try {
      const ctx = new AudioContext();
      micMonitorCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!streamRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const level = sum / data.length;
        const active = level > 5;
        setMicActive(active);
        if (active) setMicSpeechDetected(true);
        const now = performance.now();
        if (now - micLevelEmitRef.current > 70) {
          micLevelEmitRef.current = now;
          setMicLevel(level);
        }
        levelRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* noop */
    }
  }, [stopMicLevelMonitor]);

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    stopWatchdog();
    setUserSpeaking(false);
    const prev = recognitionRef.current;
    recognitionRef.current = null;
    if (prev) {
      prev.onend = null;
      prev.onerror = null;
      prev.onresult = null;
      try {
        prev.stop();
      } catch (_) { /* noop */ }
      try {
        prev.abort();
      } catch (_) { /* noop */ }
    }
    speechListeningRef.current = false;
    setSpeechListening(false);
  }, [clearRestartTimer, stopWatchdog]);

  useEffect(() => {
    serverSttRef.current = serverSttAvailable;
    if (serverSttAvailable) {
      setSpeechStalled(false);
      setSpeechDebugCode('');
      setSpeechError((prev) => {
        if (!prev) return prev;
        if (
          prev.includes('No se captó voz') ||
          prev.includes('Chrome no puede transcribir') ||
          prev.includes('Reconocimiento de voz bloqueado')
        ) {
          return '';
        }
        return prev;
      });
      if (
        speechEngineStartedRef.current &&
        shouldListenRef.current &&
        !speechListeningRef.current &&
        !recognitionRef.current
      ) {
        createRecognitionRef.current?.();
      }
    }
  }, [serverSttAvailable]);

  const createAndStartRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || !shouldListenRef.current) return;

    setSpeechSupported(true);

    if (recognitionRef.current && speechListeningRef.current) {
      return;
    }

    const prev = recognitionRef.current;
    if (prev) {
      prev.onend = null;
      prev.onerror = null;
      prev.onresult = null;
      try {
        prev.abort();
      } catch (_) { /* noop */ }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = SPEECH_LANGS[langIndexRef.current] || 'es-MX';

    recognition.onstart = () => {
      speechListeningRef.current = true;
      setSpeechListening(true);
    };

    recognition.onspeechstart = () => {
      setUserSpeaking(true);
      setSpeechStalled(false);
    };
    recognition.onspeechend = () => {
      setUserSpeaking(false);
      const ts = Date.now();
      lastSpeechEndAtRef.current = ts;
      setLastSpeechEndAt(ts);
      const pending = interimRef.current.trim();
      if (pending) {
        if (finalizedRef.current && !/\s$/.test(finalizedRef.current)) {
          finalizedRef.current += ' ';
        }
        finalizedRef.current += pending;
        interimRef.current = '';
        applyTranscript(finalizedRef.current, '');
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        let piece = result[0]?.transcript || '';
        if (!piece && result.length > 1) {
          piece = result[1]?.transcript || '';
        }
        piece = piece.trim();
        if (!piece) continue;
        if (result.isFinal) {
          if (finalizedRef.current && !/\s$/.test(finalizedRef.current)) {
            finalizedRef.current += ' ';
          }
          finalizedRef.current += piece;
          interimRef.current = '';
        } else {
          interim += (interim ? ' ' : '') + piece;
        }
      }
      interimRef.current = interim;
      applyTranscript(finalizedRef.current, interim);
    };

    recognition.onerror = (event) => {
      const code = event.error || 'unknown';
      setSpeechDebugCode(code);
      const msg = SPEECH_ERROR_MESSAGES[code];
      const skipBrowserError =
        serverSttRef.current &&
        (code === 'network' || code === 'service-not-allowed' || code === 'no-speech');
      if (msg && !skipBrowserError) setSpeechError(msg);
      if (code === 'no-speech' && shouldListenRef.current && !serverSttRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => createRecognitionRef.current?.(), RESTART_MS);
        return;
      }
      if (code === 'network') {
        if (langIndexRef.current < SPEECH_LANGS.length - 1) {
          langIndexRef.current += 1;
        }
        if (shouldListenRef.current) {
          clearRestartTimer();
          restartTimerRef.current = setTimeout(
            () => createRecognitionRef.current?.(),
            serverSttRef.current ? 600 : 300,
          );
        }
        if (serverSttRef.current) return;
        setSpeechError(SPEECH_ERROR_MESSAGES.network);
        return;
      }
      speechListeningRef.current = false;
      setSpeechListening(false);
      if (
        !serverSttRef.current &&
        code !== 'network' &&
        shouldListenRef.current &&
        code !== 'aborted'
      ) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => createRecognitionRef.current?.(), RESTART_MS);
      }
    };

    recognition.onend = () => {
      speechListeningRef.current = false;
      setSpeechListening(false);
      setUserSpeaking(false);
      recognitionRef.current = null;
      if (!shouldListenRef.current) return;
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        createRecognitionRef.current?.();
      }, RESTART_MS);
    };

    try {
      recognition.start();
    } catch (err) {
      const msg = String(err?.message || err);
      if (!msg.includes('already started')) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          createRecognitionRef.current?.();
        }, RESTART_MS);
      }
    }
  }, [applyTranscript, clearRestartTimer]);

  createRecognitionRef.current = createAndStartRecognition;

  const startSpeechAfterMic = useCallback(() => {
    if (speechEngineStartedRef.current) return;
    speechEngineStartedRef.current = true;
    setSpeechError('');
    setSpeechStalled(false);

    if (!getSpeechRecognition()) return;

    shouldListenRef.current = true;
    sessionStartedAtRef.current = Date.now();
    lastResultAtRef.current = 0;
    langIndexRef.current = 0;
    createAndStartRecognition();

    if (serverSttRef.current) return;

    stopWatchdog();
    watchdogRef.current = setInterval(() => {
      if (!shouldListenRef.current || serverSttRef.current) return;
      const hasText = !!transcriptRef.current.trim();
      const elapsed = Date.now() - sessionStartedAtRef.current;
      const sinceResult = Date.now() - (lastResultAtRef.current || sessionStartedAtRef.current);

      if (!hasText && elapsed > STALL_WARN_MS && sinceResult > STALL_WARN_MS) {
        setSpeechStalled(true);
      }

      if (!hasText && elapsed > STALL_ERROR_MS && sinceResult > STALL_ERROR_MS) {
        if (!serverSttRef.current) {
          setSpeechError(
            'No se captó voz. Habla cerca del micrófono en Chrome o Edge (localhost o HTTPS).',
          );
        }
      }
    }, 1000);
  }, [createAndStartRecognition, stopWatchdog]);

  const prepareListening = useCallback(
    async (options = {}) => {
      if (preparePromiseRef.current) return preparePromiseRef.current;

      const run = async () => {
        if (options.serverSttAvailable != null) {
          serverSttRef.current = !!options.serverSttAvailable;
        }
        setSpeechError('');
        setSpeechStalled(false);

        if (!streamRef.current) {
          try {
            const { stream, tabCapture, audioContext } = await buildCombinedAudioStream({
              includeTabAudio: !!options.includeTabAudio,
            });
            streamRef.current = stream;
            if (audioContext) audioContextRef.current = audioContext;
            setTabAudioActive(tabCapture);
            startMicLevelMonitor(stream);
          } catch {
            setSpeechError(SPEECH_ERROR_MESSAGES['not-allowed']);
            throw new Error('mic');
          }
        }

        if (!speechEngineStartedRef.current) {
          startSpeechAfterMic();
        }
        setIsPrepared(true);
      };

      preparePromiseRef.current = run()
        .catch(() => {})
        .finally(() => {
          preparePromiseRef.current = null;
        });

      return preparePromiseRef.current;
    },
    [startSpeechAfterMic, startMicLevelMonitor],
  );

  const beginCapture = useCallback(
    async (options = {}) => {
      if (isRecording && mediaRecorderRef.current) return;

      await prepareListening(options);

      if (!streamRef.current) {
        throw new Error('No hay micrófono activo.');
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        if (mediaRecorderRef.current?.state === 'inactive') {
          mediaRecorderRef.current = null;
        }
        finalizedRef.current = '';
        interimRef.current = '';
        applyTranscript('', '');
        chunksRef.current = [];
        const mimeType = pickRecorderMimeType();
        const recorderOptions = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(streamRef.current, recorderOptions);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data?.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(250);
      }

      if (!timerRef.current) {
        setElapsedSec(0);
        timerRef.current = setInterval(() => {
          setElapsedSec((s) => s + 1);
        }, 1000);
      }
      setIsRecording(true);
    },
    [isRecording, prepareListening],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    stopMicLevelMonitor();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_) { /* noop */ }
      audioContextRef.current = null;
    }
    setTabAudioActive(false);
    setIsPrepared(false);
  }, [stopMicLevelMonitor]);

  const startRecording = useCallback(
    async (options = {}) => {
      if (isRecording) return;
      finalizedRef.current = '';
      interimRef.current = '';
      applyTranscript('', '');
      setSpeechError('');
      setMicSpeechDetected(false);
      await beginCapture(options);
    },
    [isRecording, beginCapture, applyTranscript],
  );

  const stopRecording = useCallback(({ keepStream = true } = {}) => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      const text = transcriptRef.current.trim();

      if (!recorder || recorder.state === 'inactive') {
        stopTimer();
        if (!keepStream) {
          stopTracks();
          stopRecognition();
          speechEngineStartedRef.current = false;
        }
        setIsRecording(false);
        resolve({
          blob: new Blob([], { type: 'audio/webm' }),
          browserTranscript: text,
          tabAudioUsed: tabAudioActive,
          audioFilename: 'comando.webm',
        });
        return;
      }

      const finish = () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm',
        });
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        if (keepStream) {
          stopRecognition();
          speechEngineStartedRef.current = false;
        } else {
          stopTracks();
          stopRecognition();
          speechEngineStartedRef.current = false;
        }

        setIsRecording(false);
        resolve({
          blob,
          browserTranscript: transcriptRef.current.trim() || text,
          tabAudioUsed: tabAudioActive,
          audioFilename: audioFilenameForBlob(blob),
        });
      };

      recorder.onstop = () => setTimeout(finish, 400);
      recorder.onerror = () => reject(new Error('Error al finalizar la grabación.'));
      try {
        if (typeof recorder.requestData === 'function') recorder.requestData();
        recorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }, [stopRecognition, stopTimer, stopTracks, tabAudioActive]);

  const teardownListening = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (_) { /* noop */ }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopRecognition();
    stopTimer();
    stopTracks();
    setIsRecording(false);
    setElapsedSec(0);
    applyTranscript('', '');
    finalizedRef.current = '';
    interimRef.current = '';
    setSpeechStalled(false);
    setSpeechError('');
    setSpeechDebugCode('');
    setMicSpeechDetected(false);
    speechEngineStartedRef.current = false;
  }, [stopRecognition, stopTimer, stopTracks, applyTranscript]);

  const cancelRecording = useCallback(() => {
    teardownListening();
  }, [teardownListening]);

  useEffect(
    () => () => {
      stopRecognition();
      stopTimer();
      stopTracks();
    },
    [stopRecognition, stopTimer, stopTracks],
  );

  const formatElapsed = useCallback(() => {
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [elapsedSec]);

  const liveTranscript = `${transcriptFinal}${transcriptInterim ? ` ${transcriptInterim}` : ''}`.trim();

  return {
    isRecording,
    isPrepared,
    elapsedSec,
    elapsedLabel: formatElapsed(),
    browserTranscript: liveTranscript,
    transcriptFinal,
    transcriptInterim,
    speechSupported,
    speechListening,
    userSpeaking,
    micActive,
    micSpeechDetected,
    micLevel,
    speechStalled,
    speechError,
    speechDebugCode,
    tabAudioActive,
    lastSpeechEndAt,
    prepareListening,
    beginCapture,
    teardownListening,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
