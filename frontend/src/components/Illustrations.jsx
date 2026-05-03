const g = (op) => `rgba(203,172,128,${op})`;

/* ── Helper: estrella de 4 puntas ── */
function Star({ x, y, r, op = 0.5 }) {
  const p = r * 0.38;
  return (
    <path
      d={`M${x},${y - r} L${x + p},${y - p} L${x + r},${y} L${x + p},${y + p} L${x},${y + r} L${x - p},${y + p} L${x - r},${y} L${x - p},${y - p}Z`}
      fill={g(op)}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   1. ILUSTRACIÓN PRINCIPAL — panel izquierdo del Login
   Torre de hotel de lujo + alas laterales + pool + horizonte
   ══════════════════════════════════════════════════════════ */
export function BuildingIllustration({ className = '' }) {
  // Líneas de pisos por edificio
  const towerFloors = Array.from({ length: 24 }, (_, i) => 72 + i * 18);
  const leftFloors  = Array.from({ length: 14 }, (_, i) => 200 + i * 22);
  const rightFloors = Array.from({ length: 16 }, (_, i) => 178 + i * 22);

  // Ventanas iluminadas en la torre central [col 0-3, fila 0-23]
  const litWindows = [
    [0, 1], [2, 1], [3, 3], [1, 5], [0, 7], [3, 7],
    [2, 9], [0, 11],[3, 11],[1, 13],[2, 15],[3, 17],
    [0, 19],[1, 21],[2, 21],[3, 20],[0, 16],[1, 8],
  ];

  // Ventanas iluminadas en ala izquierda [col 0-2, fila 0-13]
  const litLeft = [[0, 2], [2, 4], [1, 7], [0, 10], [2, 12]];
  // Ventanas iluminadas en ala derecha [col 0-2, fila 0-15]
  const litRight = [[1, 1], [0, 5], [2, 8], [1, 11], [0, 14], [2, 14]];

  return (
    <svg
      viewBox="0 0 480 680"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Resplandor atmosférico */}
        <radialGradient id="bg-glow" cx="50%" cy="74%" r="55%">
          <stop offset="0%"   stopColor="#CBAC80" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#CBAC80" stopOpacity="0"   />
        </radialGradient>
        {/* Gradiente para fade del cielo */}
        <linearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#CBAC80" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#CBAC80" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* ── ATMÓSFERA ── */}
      <rect width="480" height="680" fill="url(#bg-glow)" />
      <rect width="480" height="260" fill="url(#sky-fade)" />

      {/* ── ESTRELLAS ── */}
      <Star x={24}  y={48}  r={3.5} op={0.55} />
      <Star x={88}  y={22}  r={2.5} op={0.42} />
      <Star x={152} y={60}  r={2}   op={0.45} />
      <Star x={240} y={28}  r={4}   op={0.58} />
      <Star x={318} y={52}  r={2.5} op={0.42} />
      <Star x={398} y={20}  r={3}   op={0.50} />
      <Star x={456} y={68}  r={2}   op={0.36} />
      <Star x={48}  y={110} r={2}   op={0.30} />
      <Star x={186} y={124} r={1.5} op={0.35} />
      <Star x={424} y={108} r={2}   op={0.30} />
      {/* Puntitos */}
      {[[105,36],[198,62],[298,20],[366,82],[475,44],[66,78],[132,98],[450,135]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1} fill={g(0.28)} />
      ))}

      {/* ── ARC DE LUNA ── */}
      <path d="M 218 10 A 52 52 0 0 1 186 58" stroke={g(0.22)} strokeWidth="0.8" />

      {/* ══ ALA IZQUIERDA ══ */}
      <rect x={28} y={196} width={122} height={299} stroke={g(0.48)} strokeWidth={0.75} />
      {/* Pisos */}
      {leftFloors.map(y => (
        <line key={`lf-${y}`} x1={28} y1={y} x2={150} y2={y} stroke={g(0.18)} strokeWidth={0.4} />
      ))}
      {/* Columnas */}
      <line x1={68}  y1={196} x2={68}  y2={495} stroke={g(0.18)} strokeWidth={0.4} />
      <line x1={109} y1={196} x2={109} y2={495} stroke={g(0.18)} strokeWidth={0.4} />
      {/* Ventanas iluminadas (col w=40, h=22) */}
      {litLeft.map(([col, row]) => (
        <rect key={`wl-${col}-${row}`}
          x={28 + col * 40.7 + 3} y={196 + row * 22 + 3}
          width={34} height={16} rx={0.5}
          fill={g(0.15)} />
      ))}
      {/* Remate superior ala izquierda */}
      <line x1={28} y1={186} x2={150} y2={186} stroke={g(0.3)} strokeWidth={0.6} />
      <line x1={28} y1={186} x2={28}  y2={196} stroke={g(0.2)} strokeWidth={0.5} />
      <line x1={150} y1={186} x2={150} y2={196} stroke={g(0.2)} strokeWidth={0.5} />

      {/* ══ TORRE CENTRAL ══ */}
      <rect x={150} y={55} width={180} height={440} stroke={g(0.78)} strokeWidth={1.1} />
      {/* Pisos */}
      {towerFloors.map(y => (
        <line key={`tf-${y}`} x1={150} y1={y} x2={330} y2={y} stroke={g(0.2)} strokeWidth={0.45} />
      ))}
      {/* Columnas (4 cols = 45px cada una) */}
      <line x1={195} y1={55} x2={195} y2={495} stroke={g(0.2)} strokeWidth={0.45} />
      <line x1={240} y1={55} x2={240} y2={495} stroke={g(0.2)} strokeWidth={0.45} />
      <line x1={285} y1={55} x2={285} y2={495} stroke={g(0.2)} strokeWidth={0.45} />
      {/* Ventanas iluminadas (col w=45, h=18) */}
      {litWindows.map(([col, row]) => (
        <rect key={`wt-${col}-${row}`}
          x={150 + col * 45 + 3} y={55 + row * 18 + 3}
          width={39} height={12} rx={0.5}
          fill={g(0.17)} />
      ))}
      {/* Corona/remate de la torre */}
      <rect x={162} y={40} width={156} height={15} stroke={g(0.55)} strokeWidth={0.8} />
      <line x1={193} y1={40} x2={193} y2={55} stroke={g(0.28)} strokeWidth={0.5} />
      <line x1={240} y1={40} x2={240} y2={55} stroke={g(0.28)} strokeWidth={0.5} />
      <line x1={287} y1={40} x2={287} y2={55} stroke={g(0.28)} strokeWidth={0.5} />
      {/* Antena / pinnacle */}
      <line x1={240} y1={25} x2={240} y2={40} stroke={g(0.4)} strokeWidth={0.7} />
      <circle cx={240} cy={23} r={2.5} stroke={g(0.5)} strokeWidth={0.6} />

      {/* ══ ALA DERECHA ══ */}
      <rect x={330} y={175} width={122} height={320} stroke={g(0.48)} strokeWidth={0.75} />
      {rightFloors.map(y => (
        <line key={`rf-${y}`} x1={330} y1={y} x2={452} y2={y} stroke={g(0.18)} strokeWidth={0.4} />
      ))}
      <line x1={371} y1={175} x2={371} y2={495} stroke={g(0.18)} strokeWidth={0.4} />
      <line x1={411} y1={175} x2={411} y2={495} stroke={g(0.18)} strokeWidth={0.4} />
      {litRight.map(([col, row]) => (
        <rect key={`wr-${col}-${row}`}
          x={330 + col * 40.7 + 3} y={175 + row * 22 + 3}
          width={34} height={16} rx={0.5}
          fill={g(0.15)} />
      ))}
      <line x1={330} y1={165} x2={452} y2={165} stroke={g(0.3)} strokeWidth={0.6} />
      <line x1={330} y1={165} x2={330} y2={175} stroke={g(0.2)} strokeWidth={0.5} />
      <line x1={452} y1={165} x2={452} y2={175} stroke={g(0.2)} strokeWidth={0.5} />

      {/* ══ BASE / TERRAZA ══ */}
      <rect x={28} y={495} width={424} height={18} stroke={g(0.45)} strokeWidth={0.75} />
      {/* Escalones sutiles */}
      <line x1={80}  y1={513} x2={400} y2={513} stroke={g(0.2)} strokeWidth={0.4} />
      <line x1={110} y1={518} x2={370} y2={518} stroke={g(0.15)} strokeWidth={0.35} />

      {/* ══ POOL ══ */}
      <ellipse cx={240} cy={545} rx={108} ry={16} stroke={g(0.42)} strokeWidth={0.75} />
      <ellipse cx={240} cy={545} rx={80}  ry={11} stroke={g(0.18)} strokeWidth={0.4} />
      {/* Reflejo en el pool */}
      <line x1={200} y1={545} x2={280} y2={545} stroke={g(0.12)} strokeWidth={0.35} />

      {/* ══ PALMERAS (geométricas) ══ */}
      {/* Izquierda */}
      <line x1={12} y1={495} x2={6} y2={400} stroke={g(0.28)} strokeWidth={0.9} />
      <path d="M6 400 Q-18 372 -28 352" stroke={g(0.22)} strokeWidth={0.7} fill="none"/>
      <path d="M6 400 Q-4 376 0 356"   stroke={g(0.22)} strokeWidth={0.7} fill="none"/>
      <path d="M6 400 Q24 378 36 366"  stroke={g(0.22)} strokeWidth={0.7} fill="none"/>
      <path d="M6 400 Q26 392 48 397"  stroke={g(0.18)} strokeWidth={0.6} fill="none"/>
      {/* Derecha */}
      <line x1={468} y1={495} x2={476} y2={392} stroke={g(0.28)} strokeWidth={0.9} />
      <path d="M476 392 Q502 362 518 344" stroke={g(0.22)} strokeWidth={0.7} fill="none"/>
      <path d="M476 392 Q494 372 498 354" stroke={g(0.22)} strokeWidth={0.7} fill="none"/>
      <path d="M476 392 Q458 374 444 364" stroke={g(0.22)} strokeWidth={0.7} fill="none"/>
      <path d="M476 392 Q460 386 436 392" stroke={g(0.18)} strokeWidth={0.6} fill="none"/>

      {/* ══ HORIZONTE ══ */}
      <line x1={0} y1={582} x2={480} y2={582} stroke={g(0.32)} strokeWidth={0.65} />

      {/* ══ AGUA ══ */}
      <line x1={25}  y1={595} x2={185} y2={595} stroke={g(0.18)} strokeWidth={0.5} />
      <line x1={255} y1={595} x2={458} y2={595} stroke={g(0.18)} strokeWidth={0.5} />
      <line x1={55}  y1={608} x2={158} y2={608} stroke={g(0.12)} strokeWidth={0.4} />
      <line x1={225} y1={608} x2={415} y2={608} stroke={g(0.12)} strokeWidth={0.4} />
      <line x1={80}  y1={620} x2={200} y2={620} stroke={g(0.08)} strokeWidth={0.35}/>
      <line x1={290} y1={620} x2={430} y2={620} stroke={g(0.08)} strokeWidth={0.35}/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   2. DIVISOR DORADO — línea ornamental con diamante central
   ══════════════════════════════════════════════════════════ */
export function GoldRule({ className = '' }) {
  return (
    <svg viewBox="0 0 240 14" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="rl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#CBAC80" stopOpacity="0" />
          <stop offset="100%" stopColor="#CBAC80" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="rr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#CBAC80" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#CBAC80" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Línea izquierda */}
      <line x1="0" y1="7" x2="108" y2="7" stroke="url(#rl)" strokeWidth="0.75" />
      {/* Diamante central */}
      <rect x="114" y="3" width="8" height="8" transform="rotate(45 118 7)"
            stroke="#CBAC80" strokeWidth="0.75" strokeOpacity="0.85" />
      <circle cx="118" cy="7" r="1.5" fill="#CBAC80" fillOpacity="0.6" />
      {/* Línea derecha */}
      <line x1="128" y1="7" x2="240" y2="7" stroke="url(#rr)" strokeWidth="0.75" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   3. ORNAMENTO DE ESQUINA — para cards o secciones
   ══════════════════════════════════════════════════════════ */
export function CornerMark({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="0" y1="0" x2="12" y2="0" stroke="#CBAC80" strokeWidth="1" strokeOpacity="0.6" />
      <line x1="0" y1="0" x2="0"  y2="12" stroke="#CBAC80" strokeWidth="1" strokeOpacity="0.6" />
      <circle cx="0" cy="0" r="1.5" fill="#CBAC80" fillOpacity="0.5" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   4. EMPTY STATE — panel sin contenido (dashboard)
   ══════════════════════════════════════════════════════════ */
export function EmptyStateIllustration({ className = '' }) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    const isMajor = i % 3 === 0;
    const r1 = isMajor ? 26 : 28;
    return {
      x1: 50 + r1 * Math.cos(a), y1: 48 + r1 * Math.sin(a),
      x2: 50 + 32 * Math.cos(a), y2: 48 + 32 * Math.sin(a),
      major: isMajor,
    };
  });

  return (
    <svg viewBox="0 0 100 90" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Círculo exterior */}
      <circle cx="50" cy="48" r="32" stroke={g(0.28)} strokeWidth="0.7" />
      <circle cx="50" cy="48" r="26" stroke={g(0.12)} strokeWidth="0.5" />
      {/* Marcas */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={g(t.major ? 0.45 : 0.22)} strokeWidth={t.major ? 0.8 : 0.5} />
      ))}
      {/* Manecilla hora */}
      <line x1="50" y1="48" x2="50" y2="28" stroke={g(0.55)} strokeWidth="0.8" strokeLinecap="round" />
      {/* Manecilla minutos */}
      <line x1="50" y1="48" x2="65" y2="54" stroke={g(0.4)} strokeWidth="0.65" strokeLinecap="round" />
      {/* Centro */}
      <circle cx="50" cy="48" r="2.5" stroke={g(0.55)} strokeWidth="0.6" />
      <circle cx="50" cy="48" r="1"   fill={g(0.6)} />
      {/* Base */}
      <line x1="15" y1="85" x2="85" y2="85" stroke={g(0.18)} strokeWidth="0.6" />
      <line x1="25" y1="85" x2="25" y2="82" stroke={g(0.14)} strokeWidth="0.5" />
      <line x1="75" y1="85" x2="75" y2="82" stroke={g(0.14)} strokeWidth="0.5" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   5. CHISPA DORADA — ícono decorativo pequeño (4 puntas)
   ══════════════════════════════════════════════════════════ */
export function SparkleIcon({ className = '', size = 16 }) {
  const r = size / 2;
  const p = r * 0.38;
  const cx = size / 2, cy = size / 2;
  return (
    <svg 
      viewBox={`0 0 ${size} ${size}`} 
      width={size} 
      height={size} 
      className={className} 
      fill="none" 
      aria-hidden="true"
    >
      <path
        d={`M${cx},${cy-r} L${cx+p},${cy-p} L${cx+r},${cy} L${cx+p},${cy+p} L${cx},${cy+r} L${cx-p},${cy+p} L${cx-r},${cy} L${cx-p},${cy-p}Z`}
        fill={g(0.7)}
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   6. LOGO MONOGRAMA — marca BOSA geométrica refinada
   ══════════════════════════════════════════════════════════ */
export function BosaMonogram({ className = '' }) {
  return (
    <svg viewBox="0 0 44 44" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Marco exterior */}
      <rect x="1" y="1" width="42" height="42" stroke="#CBAC80" strokeWidth="0.75" strokeOpacity="0.6" />
      {/* Marco interior */}
      <rect x="5" y="5" width="34" height="34" stroke="#CBAC80" strokeWidth="0.4" strokeOpacity="0.25" />
      {/* Letra B geométrica */}
      {/* Palo vertical */}
      <rect x="14" y="12" width="3" height="20" fill="#CBAC80" fillOpacity="0.75" />
      {/* Panza superior */}
      <path d="M17 12 L24 12 Q30 12 30 18 Q30 22 24 22 L17 22Z"
            fill="#CBAC80" fillOpacity="0.2"
            stroke="#CBAC80" strokeWidth="0.5" strokeOpacity="0.7" />
      {/* Panza inferior */}
      <path d="M17 22 L25 22 Q32 22 32 28 Q32 32 25 32 L17 32Z"
            fill="#CBAC80" fillOpacity="0.2"
            stroke="#CBAC80" strokeWidth="0.5" strokeOpacity="0.7" />
    </svg>
  );
}
