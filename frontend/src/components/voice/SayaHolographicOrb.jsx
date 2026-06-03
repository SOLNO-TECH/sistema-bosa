import { useId, useMemo } from 'react';

const SIZE = 200;
const CX = 100;
const CY = 100;
const BAR_COUNT = 32;
const INNER_R = 58;

const BAR_HEIGHTS = [
  10, 14, 8, 18, 12, 22, 16, 9, 20, 13, 24, 11, 17, 7, 21, 15,
  19, 10, 23, 12, 16, 8, 14, 20, 11, 18, 9, 15, 22, 13, 17, 10,
];

const BAR_GAIN = BAR_HEIGHTS.map((_, i) => 0.52 + 0.48 * Math.sin(i * 0.92 + 0.4));

function barHeight(baseH, gain, energy, mode) {
  const floor = mode === 'speaking' ? 0.38 : mode === 'listening' ? 0.28 : 0.18;
  const boost = mode === 'speaking' ? 1.35 : mode === 'processing' ? 0.95 : 0.65;
  return Math.max(6, Math.round(baseH * (floor + energy * gain * boost)));
}

/**
 * Visualizador circular Saya — medidor reactivo al micrófono.
 */
export default function SayaHolographicOrb({
  mode = 'idle',
  voiceActive = false,
  micLevel = 0,
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const isProcessing = mode === 'processing';
  const isSpeaking = mode === 'speaking' || (mode === 'listening' && voiceActive);
  const isListening = mode === 'listening' && !voiceActive;
  const isLive = isSpeaking || isListening || isProcessing;

  const energy = useMemo(() => {
    if (isProcessing) return 0.55;
    if (isSpeaking) return Math.min(1, Math.max(0.12, micLevel / 38));
    if (isListening) return 0.3;
    return 0.15;
  }, [isProcessing, isSpeaking, isListening, micLevel]);

  const modeClass = isProcessing
    ? 'saya-holo-orb--processing'
    : isSpeaking
      ? 'saya-holo-orb--speaking'
      : isListening
        ? 'saya-holo-orb--listening'
        : 'saya-holo-orb--idle';

  const bars = useMemo(() => {
    const meterMode = isProcessing ? 'processing' : isSpeaking ? 'speaking' : isListening ? 'listening' : 'idle';
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const angle = (360 / BAR_COUNT) * i - 90;
      const baseH = BAR_HEIGHTS[i % BAR_HEIGHTS.length];
      const h = barHeight(baseH, BAR_GAIN[i], energy, meterMode);
      return {
        id: i,
        angle,
        h,
        delay: (i * 0.04).toFixed(2),
        peak: isSpeaking && i % 5 === 0,
      };
    });
  }, [energy, isProcessing, isSpeaking, isListening]);

  const ticks = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const angle = (360 / 48) * i;
        const rad = ((angle - 90) * Math.PI) / 180;
        const major = i % 6 === 0;
        const r1 = 94;
        const r2 = major ? 86 : 90;
        return {
          id: i,
          x1: CX + r1 * Math.cos(rad),
          y1: CY + r1 * Math.sin(rad),
          x2: CX + r2 * Math.cos(rad),
          y2: CY + r2 * Math.sin(rad),
          major,
        };
      }),
    [],
  );

  return (
    <div
      className={`saya-holo-orb ${modeClass} ${className}`.trim()}
      aria-hidden
      data-mode={mode}
      style={{ '--orb-energy': energy }}
    >
      <div className="saya-holo-orb__stage">
        <div className="saya-holo-orb__plate" />
        <div className="saya-holo-orb__bezel" />

        <svg className="saya-holo-orb__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} width={240} height={240} role="presentation">
          <defs>
            <radialGradient id={`${uid}-core`} cx="48%" cy="42%" r="62%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="38%" stopColor="rgba(203,172,128,0.14)" />
              <stop offset="100%" stopColor="#071221" />
            </radialGradient>
            <radialGradient id={`${uid}-core-edge`} cx="50%" cy="50%" r="50%">
              <stop offset="82%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
            </radialGradient>
            <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(203,172,128,0.5)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(91,124,154,0.3)" />
            </linearGradient>
            <linearGradient id={`${uid}-bar`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(203,172,128,0.15)" />
              <stop offset="100%" stopColor="rgba(232,212,168,0.95)" />
            </linearGradient>
            <linearGradient id={`${uid}-bar-cool`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(91,124,154,0.1)" />
              <stop offset="100%" stopColor="rgba(180,200,220,0.7)" />
            </linearGradient>
          </defs>

          <g className="saya-holo-orb__dial">
            {ticks.map((t) => (
              <line
                key={t.id}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                className={t.major ? 'saya-holo-orb__tick saya-holo-orb__tick--major' : 'saya-holo-orb__tick'}
              />
            ))}
          </g>

          <g className="saya-holo-orb__ring-wrap">
            <circle
              cx={CX}
              cy={CY}
              r={86}
              fill="none"
              stroke={`url(#${uid}-rim)`}
              strokeWidth="0.85"
              className="saya-holo-orb__ring-outer"
            />
          </g>

          <g className="saya-holo-orb__meters" transform={`translate(${CX}, ${CY})`}>
            {bars.map((b) => (
              <g key={b.id} transform={`rotate(${b.angle})`}>
                <rect
                  x={-1.35}
                  y={-INNER_R - b.h}
                  width={2.7}
                  height={b.h}
                  rx={1.35}
                  className={`saya-holo-orb__bar${b.peak ? ' saya-holo-orb__bar--peak' : ''}`}
                  fill={isListening && !isSpeaking ? `url(#${uid}-bar-cool)` : `url(#${uid}-bar)`}
                  style={{ animationDelay: `${b.delay}s` }}
                />
              </g>
            ))}
          </g>

          <circle cx={CX} cy={CY} r={44} fill="rgba(0,0,0,0.2)" className="saya-holo-orb__disc-shadow" />
          <circle cx={CX} cy={CY} r={40} fill={`url(#${uid}-core)`} className="saya-holo-orb__disc" />
          <circle cx={CX} cy={CY} r={40} fill={`url(#${uid}-core-edge)`} className="saya-holo-orb__disc-vignette" />
          <circle
            cx={CX}
            cy={CY}
            r={40}
            fill="none"
            stroke="rgba(203,172,128,0.3)"
            strokeWidth="0.85"
            className="saya-holo-orb__disc-rim"
          />

          {isProcessing && (
            <circle
              cx={CX}
              cy={CY}
              r={46}
              fill="none"
              stroke="rgba(203,172,128,0.35)"
              strokeWidth="1.5"
              strokeDasharray="40 200"
              className="saya-holo-orb__process-ring"
            />
          )}

          <g className="saya-holo-orb__mic" transform={`translate(${CX}, ${CY})`}>
            <circle r={24} fill="none" stroke="currentColor" strokeWidth="0.75" className="saya-holo-orb__mic-ring" />
            {isProcessing ? (
              <g className="saya-holo-orb__mic-icon" transform="translate(-12, -12)">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.22" />
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  d="M12 3a9 9 0 019 9"
                  className="saya-holo-orb__spinner-arc"
                />
              </g>
            ) : (
              <g className="saya-holo-orb__mic-icon" transform="translate(-12, -12.5)">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </g>
            )}
          </g>
        </svg>

        {isLive && <div className="saya-holo-orb__halo" />}
        {isSpeaking && (
          <>
            <div className="saya-holo-orb__ripple" />
            <div className="saya-holo-orb__ripple saya-holo-orb__ripple--2" />
          </>
        )}
      </div>

    </div>
  );
}
