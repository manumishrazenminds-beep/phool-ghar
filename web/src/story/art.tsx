import { motion, useTransform, type MotionValue } from 'motion/react'

export type MV = MotionValue<number>

/** Flat-vector palette with a hand-inked outline, in the spirit of risograph illustration. */
export const C = {
  ink: '#2a211c',
  mari: '#f08a1c',
  mariD: '#e8650f',
  saff: '#f6b33c',
  rose: '#ee8fa3',
  roseD: '#c24a6a',
  leaf: '#6aa84f',
  leafD: '#3c7a3f',
  leafL: '#a9cf8a',
  kraft: '#dcb98c',
  kraftD: '#c19a68',
  skin: '#b97b52',
  skinL: '#d79a72',
  saree: '#b5304f',
  cream: '#fbf5ea',
  wood: '#c8935a',
  woodD: '#a8743f',
  white: '#fffaf0',
  sky: '#bfe3f2',
  hair: '#2b1d17',
}
const SW = 2.2

/* ------------------------------------------------------------------ flowers */

export function Marigold({ r = 40, tone = 0 }: { r?: number; tone?: 0 | 1 }) {
  const outer = tone ? C.saff : C.mari
  const mid = tone ? C.mari : C.mariD
  const sw = Math.max(1.2, SW * Math.sqrt(r / 40))
  return (
    <g stroke={C.ink} strokeWidth={sw} strokeLinejoin="round">
      {Array.from({ length: 13 }, (_, i) => (
        <ellipse key={`o${i}`} cy={-r * 0.64} rx={r * 0.28} ry={r * 0.4} fill={outer} transform={`rotate(${(i * 360) / 13})`} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={`m${i}`} cy={-r * 0.42} rx={r * 0.23} ry={r * 0.31} fill={mid} transform={`rotate(${i * 40 + 18})`} />
      ))}
      <circle r={r * 0.27} fill={C.saff} />
      <path d={`M${-r * 0.12} ${-r * 0.04} q${r * 0.12} ${-r * 0.12} ${r * 0.24} 0`} fill="none" strokeWidth={sw * 0.7} />
    </g>
  )
}

export function Rose({ r = 34 }: { r?: number }) {
  const sw = Math.max(1.2, SW * Math.sqrt(r / 34))
  return (
    <g stroke={C.ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      <circle r={r} fill={C.rose} />
      <path d={`M${-r * 0.78} ${-r * 0.1} Q${-r * 0.6} ${r * 0.8} ${r * 0.2} ${r * 0.86}`} fill="none" />
      <circle r={r * 0.68} fill="#f6a9b8" />
      <path d={`M${-r * 0.5} ${r * 0.1} Q${-r * 0.3} ${-r * 0.62} ${r * 0.34} ${-r * 0.4} Q${r * 0.66} ${r * 0.1} ${r * 0.1} ${r * 0.44}`} fill="none" />
      <path d={`M${-r * 0.16} ${r * 0.02} Q${-r * 0.04} ${-r * 0.3} ${r * 0.2} ${-r * 0.1} Q${r * 0.3} ${r * 0.14} ${r * 0.04} ${r * 0.2}`} fill="#e46a85" />
    </g>
  )
}

export function Mogra({ r = 16 }: { r?: number }) {
  return (
    <g stroke={C.ink} strokeWidth={Math.max(1.1, r / 10)} strokeLinejoin="round">
      {Array.from({ length: 6 }, (_, i) => (
        <ellipse key={i} cy={-r * 0.62} rx={r * 0.3} ry={r * 0.5} fill={C.white} transform={`rotate(${i * 60})`} />
      ))}
      <circle r={r * 0.2} fill={C.saff} />
    </g>
  )
}

export function Leaf({ len = 60, rot = 0, fill = C.leaf }: { len?: number; rot?: number; fill?: string }) {
  return (
    <g transform={`rotate(${rot})`} stroke={C.ink} strokeWidth={SW * 0.85} strokeLinejoin="round" strokeLinecap="round">
      <path d={`M0 0 Q${len * 0.45} ${-len * 0.34} ${len} 0 Q${len * 0.5} ${len * 0.3} 0 0 Z`} fill={fill} />
      <path d={`M${len * 0.06} 0 L${len * 0.78} 0`} fill="none" strokeWidth={SW * 0.55} />
    </g>
  )
}

/** A sketched stem that draws itself. `p` is 0..1. */
export function Stem({ d, p, w = 4 }: { d: string; p: MV; w?: number }) {
  return <motion.path d={d} fill="none" stroke={C.leafD} strokeWidth={w} strokeLinecap="round" style={{ pathLength: p }} />
}

/* ------------------------------------------------------------------- hands */

/** Hand drawn centred on its own origin so rotation pivots at the palm. Points along +x. */
export function Hand({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} stroke={C.ink} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" fill={C.skinL}>
      {/* thumb behind the palm */}
      <path d="M-4 -9 Q2 -21 13 -17 Q17 -13 11 -9" />
      {/* palm and curled fingers */}
      <path d="M-13 -9 Q-13 -12 -8 -12 L9 -12 Q17 -12 17 -5 L17 6 Q17 12 9 12 L-8 12 Q-13 12 -13 8 Z" />
      <path d="M6 -6 H16 M6 0 H17 M6 6 H15" fill="none" strokeWidth={1.4} />
    </g>
  )
}

/**
 * Arm from a fixed shoulder to a moving hand. hx/hy are MotionValues, so a pose is
 * just a set of keyframes over scroll progress.
 */
export function Arm({ sx, sy, hx, hy, sleeve = C.saff, bend = 36, handScale = 1.15 }: { sx: number; sy: number; hx: MV; hy: MV; sleeve?: string; bend?: number; handScale?: number }) {
  const elbow = (x: number, y: number): [number, number] => [(sx + x) / 2, (sy + y) / 2 + bend]
  const d = useTransform([hx, hy], ([x, y]: number[]) => {
    const [ex, ey] = elbow(x, y)
    return `M${sx} ${sy} Q${ex} ${ey} ${x} ${y}`
  })
  const ang = useTransform([hx, hy], ([x, y]: number[]) => {
    const [ex, ey] = elbow(x, y)
    return (Math.atan2(y - ey, x - ex) * 180) / Math.PI
  })
  return (
    <g>
      <motion.path d={d} fill="none" stroke={C.ink} strokeWidth={22} strokeLinecap="round" />
      <motion.path d={d} fill="none" stroke={sleeve} strokeWidth={17.5} strokeLinecap="round" />
      <motion.g style={{ x: hx, y: hy, rotate: ang }}>
        <Hand s={handScale} />
      </motion.g>
    </g>
  )
}

/* --------------------------------------------------------------- character */

/** The florist, front-facing, feet on y=0. Arms are drawn separately by the scene. */
export function Florist({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={C.ink} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      {/* saree skirt */}
      <path d="M-52 0 L52 0 L36 -112 L-36 -112 Z" fill={C.saree} />
      <path d="M-30 -6 L-24 -108 M0 -6 L0 -108 M30 -6 L24 -108" fill="none" strokeWidth={1.2} opacity={0.45} />
      {/* feet */}
      <ellipse cx={-20} cy={2} rx={14} ry={5} fill={C.skin} />
      <ellipse cx={20} cy={2} rx={14} ry={5} fill={C.skin} />
      {/* blouse + apron */}
      <path d="M-33 -112 L-30 -196 Q0 -208 30 -196 L33 -112 Z" fill={C.saff} />
      <path d="M-22 -112 L-20 -176 L20 -176 L22 -112 Z" fill={C.leaf} />
      <rect x={-12} y={-146} width={24} height={20} rx={4} fill={C.leafD} />
      {/* dupatta */}
      <path d="M-28 -196 Q-44 -150 -30 -112 L-36 -112 Q-54 -150 -36 -198 Z" fill={C.roseD} />
      {/* neck + head */}
      <rect x={-8} y={-216} width={16} height={22} rx={5} fill={C.skin} />
      <circle cx={0} cy={-238} r={27} fill={C.skinL} />
      {/* hair + bun */}
      <path d="M-27 -240 Q-26 -272 0 -271 Q27 -272 27 -240 Q16 -258 0 -256 Q-16 -258 -27 -240 Z" fill={C.hair} />
      <circle cx={2} cy={-276} r={13} fill={C.hair} />
      <g transform="translate(-13 -264) scale(.28)"><Marigold r={40} /></g>
      {/* face */}
      <circle cx={0} cy={-247} r={2.6} fill={C.saree} strokeWidth={0} />
      <path d="M-12 -238 q4 -4 8 0 M4 -238 q4 -4 8 0" fill="none" strokeWidth={1.8} />
      <path d="M-6 -224 q6 6 12 0" fill="none" strokeWidth={1.8} />
      <circle cx={-16} cy={-228} r={4} fill={C.rose} strokeWidth={0} opacity={0.6} />
      <circle cx={16} cy={-228} r={4} fill={C.rose} strokeWidth={0} opacity={0.6} />
    </g>
  )
}

/* ------------------------------------------------------------------- props */

export function Basket({ x, y, w = 120 }: { x: number; y: number; w?: number }) {
  const h = w * 0.5
  return (
    <g transform={`translate(${x} ${y})`} stroke={C.ink} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <path d={`M${-w / 2} 0 L${-w * 0.4} ${h} Q0 ${h * 1.12} ${w * 0.4} ${h} L${w / 2} 0 Z`} fill={C.kraft} />
      <path d={`M${-w * 0.45} ${h * 0.34} L${w * 0.45} ${h * 0.34} M${-w * 0.42} ${h * 0.68} L${w * 0.42} ${h * 0.68}`} fill="none" strokeWidth={1.3} />
      <path d={`M${-w * 0.2} 0 L${-w * 0.14} ${h * 1.05} M${w * 0.2} 0 L${w * 0.14} ${h * 1.05} M0 0 L0 ${h * 1.1}`} fill="none" strokeWidth={1.2} />
      <ellipse cx={0} cy={0} rx={w / 2} ry={h * 0.2} fill={C.kraftD} />
    </g>
  )
}

export function Sun({ x, y, r = 60 }: { x: number | MV; y: number | MV; r?: number }) {
  return (
    <motion.g style={{ x, y }}>
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1={0} y1={-r * 1.25} x2={0} y2={-r * 1.55} stroke={C.saff} strokeWidth={4} strokeLinecap="round" transform={`rotate(${i * 22.5})`} />
      ))}
      <circle r={r} fill="#ffd36b" stroke={C.ink} strokeWidth={SW} />
      <circle r={r * 0.72} fill="#ffe08f" />
    </motion.g>
  )
}

export function Cloud({ x, y, s = 1, o = 0.9 }: { x: number | MV; y: number; s?: number; o?: number }) {
  return (
    <motion.g style={{ x }} opacity={o}>
      <g transform={`translate(0 ${y}) scale(${s})`} stroke={C.ink} strokeWidth={SW * 0.8} fill={C.white} strokeLinejoin="round">
        <path d="M0 40 q-6 -34 30 -34 q8 -26 46 -18 q34 -12 46 20 q36 0 28 32 Z" />
      </g>
    </motion.g>
  )
}
