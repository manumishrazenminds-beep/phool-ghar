import { motion, useMotionValue, useTransform } from 'motion/react'
import { Arm, Basket, C, Cloud, Florist, Leaf, Marigold, Mogra, Rose, Stem, Sun, type MV } from './art'

/* ------------------------------------------------------------------ helpers */

const useKf = (lp: MV, xs: number[], ys: number[]) => useTransform(lp, xs, ys)
const useStep = (lp: MV, a: number, b: number) => useTransform(lp, [a, b], [0, 1], { clamp: true })
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))
const INK = C.ink

function Sway({ children, d = 4, dur = 4.5, delay = 0 }: { children: React.ReactNode; d?: number; dur?: number; delay?: number }) {
  return (
    <motion.g animate={{ x: [0, d, 0, -d, 0] }} transition={{ repeat: Infinity, duration: dur, ease: 'easeInOut', delay }}>
      {children}
    </motion.g>
  )
}

function Plant({ x, head, r = 34, tone = 0, delay = 0, base = 525, stubOnly = false }: { x: number; head: number; r?: number; tone?: 0 | 1; delay?: number; base?: number; stubOnly?: boolean }) {
  const mid = (base + head) / 2
  return (
    <g>
      <path d={`M${x} ${base} Q${x - 8} ${mid} ${x} ${head + r * 0.5}`} fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d={`M${x} ${base} Q${x - 8} ${mid} ${x} ${head + r * 0.5}`} fill="none" stroke={C.leafD} strokeWidth={4.4} strokeLinecap="round" />
      <g transform={`translate(${x} ${mid + 24})`}><Leaf len={50} rot={-38} /></g>
      <g transform={`translate(${x} ${mid + 54})`}><Leaf len={44} rot={-142} /></g>
      {!stubOnly && (
        <Sway d={3} dur={4 + delay} delay={delay}>
          <g transform={`translate(${x} ${head})`}><Marigold r={r} tone={tone} /></g>
        </Sway>
      )}
    </g>
  )
}

/** Wall + table used by the workshop scenes. */
function Workshop({ tint = '#fde6c4' }: { tint?: string }) {
  return (
    <g>
      <rect width={1200} height={620} fill={tint} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={i * 110 + 20} y1={0} x2={i * 110 + 20} y2={470} stroke="rgba(42,33,28,.06)" strokeWidth={2} />
      ))}
      <rect y={585} width={1200} height={35} fill="#e6c79b" />
      {/* window with morning light */}
      <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <path d="M240 300 V170 Q240 112 300 112 Q360 112 360 170 V300 Z" fill="#cfeaf5" />
        <path d="M300 112 V300 M240 206 H360" fill="none" />
        <path d="M228 300 H372" strokeWidth={6} strokeLinecap="round" fill="none" />
      </g>
      {/* hanging sprigs */}
      {[880, 940, 1010].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={60} x2={x} y2={150 + i * 16} stroke={INK} strokeWidth={2} />
          <g transform={`translate(${x} ${156 + i * 16})`}><Marigold r={16 + i * 2} tone={(i % 2) as 0 | 1} /></g>
        </g>
      ))}
      {/* shelf + jars */}
      <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <rect x={760} y={250} width={260} height={10} rx={3} fill={C.woodD} />
        <rect x={780} y={206} width={34} height={44} rx={8} fill="#d9eef0" />
        <rect x={826} y={214} width={30} height={36} rx={8} fill="#f7d7dd" />
        <rect x={870} y={200} width={40} height={50} rx={8} fill="#e8efd6" />
      </g>
      <g transform="translate(797 200)"><Leaf len={34} rot={-80} /></g>
      <g transform="translate(891 194)"><Rose r={13} /></g>
    </g>
  )
}

function Table() {
  return (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <rect x={300} y={470} width={720} height={22} rx={4} fill={C.wood} />
      <rect x={316} y={492} width={688} height={128} fill={C.woodD} />
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={316 + (i + 1) * 98} y1={492} x2={316 + (i + 1) * 98} y2={620} strokeWidth={1.4} opacity={0.5} />)}
    </g>
  )
}

/* ============================================================== 1. THE FIELD */

export function Scene1({ lp }: { lp: MV }) {
  const sunY = useKf(lp, [0, 1], [320, 190])
  // The florist WALKS to the plant and back; hands stay in character space, so reach stays short.
  const T = [0, 0.12, 0.42, 0.46, 0.5, 0.78, 0.86, 1]
  const charX = useKf(lp, T, [0, 0, 230, 230, 230, 100, 100, 100])
  const hx = useKf(lp, T, [535, 535, 507, 507, 507, 570, 570, 545])
  const hy = useKf(lp, T, [480, 480, 352, 346, 352, 505, 505, 470])
  const bob = useTransform(lp, (v) => ((v > 0.12 && v < 0.42) || (v > 0.5 && v < 0.78) ? -Math.abs(Math.sin(v * 110)) * 5 : 0))
  const fx = useTransform([hx, charX, lp] as const, ([h, c, v]: number[]) => (v < 0.46 ? 760 : v < 0.8 ? h + c + 23 : lerp(h + c + 23, 670, (v - 0.8) / 0.08)))
  const fy = useTransform([hy, lp] as const, ([h, v]: number[]) => (v < 0.46 ? 352 : v < 0.8 ? h - 3 : lerp(h - 3, 523, (v - 0.8) / 0.1)))
  const fs = useKf(lp, [0, 0.88, 1], [1, 1, 0.7])
  const lx = useMotionValue(418)
  const ly = useMotionValue(508)
  const cloudA = useKf(lp, [0, 1], [-20, 140])
  const cloudB = useKf(lp, [0, 1], [700, 560])
  const char = { x: charX, y: bob }

  return (
    <g>
      <rect width={1200} height={620} fill="url(#sky1)" />
      <Sun x={900} y={sunY} r={62} />
      <Cloud x={cloudA} y={120} s={0.9} />
      <Cloud x={cloudB} y={190} s={0.7} o={0.8} />
      <path d="M0 400 Q140 318 300 372 T620 362 T940 376 T1200 340 V440 H0 Z" fill="#cfe2b0" stroke={INK} strokeWidth={2.2} />
      <path d="M0 430 Q200 380 420 418 T800 410 T1200 400 V470 H0 Z" fill={C.leafL} stroke={INK} strokeWidth={2.2} />
      <rect y={440} width={1200} height={44} fill={C.saff} />
      <rect y={484} width={1200} height={44} fill={C.mari} />
      <rect y={440} width={1200} height={88} fill="url(#dots)" />
      <path d="M0 440 H1200 M0 484 H1200 M0 528 H1200" stroke={INK} strokeWidth={2} />
      <rect y={526} width={1200} height={94} fill={C.leafL} />
      {Array.from({ length: 22 }, (_, i) => (
        <path key={i} d={`M${i * 56 + 10} 552 q4 -16 8 0 M${i * 56 + 22} 552 q4 -22 8 0`} stroke={C.leafD} strokeWidth={3} fill="none" strokeLinecap="round" />
      ))}

      <Plant x={840} head={376} delay={0.4} tone={1} />
      <Plant x={925} head={352} delay={0.9} />
      <Plant x={1010} head={392} delay={1.4} tone={1} />
      <Plant x={1095} head={364} delay={0.2} />
      <Plant x={760} head={352} stubOnly base={525} />
      <path d="M752 372 l16 0" stroke={INK} strokeWidth={3} strokeLinecap="round" />

      <motion.g style={char}><Florist x={450} y={600} /></motion.g>

      <Basket x={670} y={536} w={124} />
      <g transform="translate(642 534)"><Marigold r={22} tone={1} /></g>
      <g transform="translate(676 526)"><Marigold r={22} /></g>
      <g transform="translate(704 536)"><Marigold r={21} tone={1} /></g>
      <motion.g style={{ x: fx, y: fy, scale: fs }}><Marigold r={34} /></motion.g>
      <clipPath id="bFront"><rect x={570} y={550} width={200} height={70} /></clipPath>
      <g clipPath="url(#bFront)"><Basket x={670} y={536} w={124} /></g>

      <motion.g style={char}>
        <Arm sx={423} sy={410} hx={lx} hy={ly} sleeve={C.saff} bend={26} />
        <Arm sx={477} sy={410} hx={hx} hy={hy} sleeve={C.saff} bend={30} />
      </motion.g>
    </g>
  )
}

/* ============================================================= 2. THE GARLAND */

export function Scene2({ lp }: { lp: MV }) {
  const N = 7
  const x0 = 640
  const gap = 36
  const lead = useKf(lp, [0.08, 0.92], [x0, x0 + (N - 1) * gap])
  const thread = useStep(lp, 0.06, 0.94)
  // she slides along the table as the garland grows; hands keep a short, constant reach
  const charX = useTransform(lead, (l) => l - 660)
  const bob = useTransform(lp, (v) => -Math.abs(Math.sin(v * 46)) * 3)
  const rhx = useTransform(lp, (v) => 646 + Math.sin(v * 46) * 5)
  const rhy = useTransform(lp, (v) => 428 - Math.abs(Math.sin(v * 46)) * 14)
  const lhx = useMotionValue(590)
  const lhy = useMotionValue(448)
  const char = { x: charX, y: bob }

  return (
    <g>
      <Workshop />
      <motion.g style={char}><Florist x={520} y={600} /></motion.g>
      <Table />
      <g transform="translate(910 462)">
        <path d="M-52 0 Q0 46 52 0 Z" fill={C.kraft} stroke={INK} strokeWidth={2.2} />
        {[[-26, -6, 0], [0, -14, 1], [26, -6, 0], [-10, -26, 1], [14, -28, 0]].map(([x, y, tn], i) => (
          <g key={i} transform={`translate(${x} ${y})`}><Marigold r={22} tone={tn as 0 | 1} /></g>
        ))}
      </g>
      <motion.path d={`M${x0 - 30} 452 L${x0 + (N - 1) * gap + 10} 452`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" style={{ pathLength: thread }} />
      {Array.from({ length: N }, (_, i) => {
        const a = 0.08 + (i / (N - 1)) * 0.84
        return <GarlandBloom key={i} lp={lp} at={a} x={x0 + i * gap} y={446} tone={(i % 2) as 0 | 1} />
      })}
      <motion.g style={char}>
        <Arm sx={493} sy={410} hx={lhx} hy={lhy} sleeve={C.saff} bend={26} />
        <Arm sx={547} sy={410} hx={rhx} hy={rhy} sleeve={C.saff} bend={30} />
      </motion.g>
    </g>
  )
}

function GarlandBloom({ lp, at, x, y, tone }: { lp: MV; at: number; x: number; y: number; tone: 0 | 1 }) {
  const s = useKf(lp, [at - 0.03, at + 0.02], [0, 1])
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g style={{ scale: s }}><Marigold r={26} tone={tone} /></motion.g>
    </g>
  )
}

/* ============================================================= 3. THE BOUQUET */

const STEMS = [
  { a: -40, L: 170, kind: 'mari' }, { a: 40, L: 176, kind: 'rose' }, { a: -26, L: 196, kind: 'rose' }, { a: 26, L: 190, kind: 'mari' },
  { a: -12, L: 214, kind: 'mogra' }, { a: 13, L: 212, kind: 'rose' }, { a: 0, L: 236, kind: 'mari' }, { a: -33, L: 150, kind: 'mogra' }, { a: 34, L: 152, kind: 'mogra' },
] as const

export function Scene3({ lp }: { lp: MV }) {
  const bx = 780
  const by = 464
  const wrapY = useKf(lp, [0.56, 0.78], [by + 16, 322])
  const wrapH = useTransform(wrapY, (v) => by + 16 - v + 4)
  const bow = useStep(lp, 0.8, 0.96)
  const rhx = useTransform(lp, (v) => (v < 0.78 ? bx + 46 + Math.sin(v * 34) * 22 : lerp(bx + 46, bx + 12, (v - 0.78) / 0.14)))
  const rhy = useTransform(lp, (v) => (v < 0.78 ? 396 + Math.cos(v * 34) * 16 : lerp(396, 402, (v - 0.78) / 0.14)))
  const lhx = useMotionValue(bx - 14)
  const lhy = useMotionValue(by - 14)

  return (
    <g>
      <Workshop tint="#fbe3d0" />
      <Florist x={640} y={600} />
      <Table />
      {/* kraft paper sheet */}
      <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <path d={`M${bx - 120} ${by + 14} L${bx + 120} ${by + 14} L${bx + 150} ${by + 4} L${bx - 90} ${by + 4} Z`} fill={C.kraft} />
      </g>
      {/* foliage first */}
      {[-50, -20, 18, 48].map((a, i) => (
        <LeafGrow key={i} lp={lp} at={0.02 + i * 0.015} x={bx} y={by} a={a} />
      ))}
      {STEMS.map((s, i) => (
        <BouquetStem key={i} lp={lp} i={i} s={s} bx={bx} by={by} />
      ))}
      {/* paper wrap, revealed upward */}
      <clipPath id="wrapClip"><motion.rect x={bx - 160} width={320} y={wrapY} height={wrapH} /></clipPath>
      <g clipPath="url(#wrapClip)" stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <path d={`M${bx - 34} ${by + 14} L${bx + 34} ${by + 14} L${bx + 92} ${by - 118} Q${bx} ${by - 146} ${bx - 92} ${by - 118} Z`} fill={C.kraft} />
        <path d={`M${bx - 8} ${by + 14} L${bx + 30} ${by - 134} M${bx - 40} ${by - 20} L${bx + 40} ${by - 30}`} fill="none" strokeWidth={1.4} opacity={0.6} />
      </g>
      {/* ribbon bow */}
      <g stroke={C.roseD} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <motion.path d={`M${bx} ${by - 62} C${bx - 46} ${by - 98} ${bx - 56} ${by - 50} ${bx} ${by - 62} C${bx + 46} ${by - 98} ${bx + 56} ${by - 50} ${bx} ${by - 62}`} style={{ pathLength: bow }} />
        <motion.path d={`M${bx} ${by - 62} L${bx - 26} ${by - 14} M${bx} ${by - 62} L${bx + 26} ${by - 12}`} style={{ pathLength: bow }} />
      </g>
      <motion.circle cx={bx} cy={by - 62} r={7} fill={C.roseD} stroke={INK} strokeWidth={2} style={{ scale: bow }} />
      <Arm sx={613} sy={410} hx={lhx} hy={lhy} sleeve={C.saff} bend={28} />
      <Arm sx={667} sy={410} hx={rhx} hy={rhy} sleeve={C.saff} bend={36} />
    </g>
  )
}

function LeafGrow({ lp, at, x, y, a }: { lp: MV; at: number; x: number; y: number; a: number }) {
  const s = useKf(lp, [at, at + 0.05], [0, 1])
  return (
    <g transform={`translate(${x} ${y}) rotate(${a - 90})`}>
      <motion.g style={{ scale: s }}><Leaf len={96} rot={0} fill={C.leafL} /></motion.g>
    </g>
  )
}

function BouquetStem({ lp, i, s, bx, by }: { lp: MV; i: number; s: { a: number; L: number; kind: string }; bx: number; by: number }) {
  const at = 0.06 + i * 0.05
  const rad = (s.a * Math.PI) / 180
  const tx = bx + Math.sin(rad) * s.L
  const ty = by - Math.cos(rad) * s.L
  const draw = useStep(lp, at, at + 0.05)
  const pop = useKf(lp, [at + 0.04, at + 0.09], [0, 1])
  const d = `M${bx} ${by} Q${bx + Math.sin(rad) * s.L * 0.4} ${by - Math.cos(rad) * s.L * 0.55} ${tx} ${ty}`
  return (
    <g>
      <Stem d={d} p={draw} w={4.4} />
      <g transform={`translate(${tx} ${ty})`}>
        <motion.g style={{ scale: pop }}>
          {s.kind === 'mari' && <Marigold r={32} tone={(i % 2) as 0 | 1} />}
          {s.kind === 'rose' && <Rose r={28} />}
          {s.kind === 'mogra' && (
            <g>
              <g transform="translate(-9 6)"><Mogra r={13} /></g>
              <g transform="translate(10 4)"><Mogra r={13} /></g>
              <g transform="translate(0 -9)"><Mogra r={13} /></g>
            </g>
          )}
        </motion.g>
      </g>
    </g>
  )
}

/* ============================================================== 4. THE PACKET */

function MiniBouquet() {
  return (
    <g>
      {[-30, -15, 0, 15, 30].map((a, i) => {
        const r = (a * Math.PI) / 180
        return <path key={i} d={`M0 120 Q${Math.sin(r) * 30} 60 ${Math.sin(r) * 78} ${-Math.cos(r) * 78 + 60}`} stroke={C.leafD} strokeWidth={4.4} fill="none" strokeLinecap="round" />
      })}
      <g transform="translate(-60 32)"><Rose r={25} /></g>
      <g transform="translate(60 30)"><Marigold r={26} tone={1} /></g>
      <g transform="translate(-30 -14)"><Marigold r={29} /></g>
      <g transform="translate(34 -12)"><Rose r={26} /></g>
      <g transform="translate(0 -40)"><Marigold r={30} tone={1} /></g>
      <g transform="translate(-4 14)"><Mogra r={14} /></g>
      <g transform="translate(20 22)"><Mogra r={13} /></g>
    </g>
  )
}

export function Scene4({ lp }: { lp: MV }) {
  const bx = 780
  const by = 470
  const drop = useKf(lp, [0.04, 0.5], [-70, 0])
  const tag = useKf(lp, [0.54, 0.68], [0, 1])
  const stamp = useKf(lp, [0.7, 0.8], [0, 1])
  const twine = useStep(lp, 0.82, 0.98)
  const rhx = useKf(lp, [0, 0.05, 0.5, 0.6, 0.72, 0.9, 1], [690, 778, 778, 802, 746, 790, 710])
  const rhy = useTransform(lp, (v) => {
    const o = lerp(-70, 0, (v - 0.04) / 0.46)
    if (v < 0.04) return lerp(470, 330 - 70, v / 0.04)
    if (v < 0.5) return 330 + o
    if (v < 0.6) return lerp(330, 428, (v - 0.5) / 0.1)
    if (v < 0.72) return lerp(428, 436, (v - 0.6) / 0.12)
    if (v < 0.9) return lerp(436, 424, (v - 0.72) / 0.18)
    return lerp(424, 470, (v - 0.9) / 0.1)
  })
  const lhx = useMotionValue(700)
  const lhy = useMotionValue(430)

  return (
    <g>
      <Workshop tint="#f7e2c3" />
      <Florist x={640} y={600} />
      <Table />
      {/* bag back */}
      <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <path d={`M${bx - 86} ${by} L${bx - 70} ${by - 142} L${bx + 70} ${by - 142} L${bx + 86} ${by} Z`} fill={C.kraftD} />
      </g>
      {/* bouquet sliding in */}
      <motion.g style={{ y: drop }}>
        <g transform={`translate(${bx} ${by - 150})`}><MiniBouquet /></g>
      </motion.g>
      {/* bag front */}
      <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <path d={`M${bx - 86} ${by} L${bx - 74} ${by - 98} L${bx + 74} ${by - 98} L${bx + 86} ${by} Z`} fill={C.kraft} />
        <path d={`M${bx - 74} ${by - 98} L${bx + 74} ${by - 98}`} strokeWidth={5} />
        <path d={`M${bx - 56} ${by - 70} L${bx - 52} ${by - 6} M${bx + 56} ${by - 70} L${bx + 52} ${by - 6}`} fill="none" strokeWidth={1.3} opacity={0.5} />
      </g>
      {/* twine */}
      <motion.path d={`M${bx - 76} ${by - 82} L${bx + 76} ${by - 82}`} stroke={C.roseD} strokeWidth={5} strokeLinecap="round" style={{ pathLength: twine }} />
      {/* stamp */}
      <g transform={`translate(${bx - 36} ${by - 38})`}>
        <motion.g style={{ scale: stamp, rotate: -10 }}>
          <circle r={26} fill={C.cream} stroke={C.roseD} strokeWidth={2.6} />
          <circle r={21} fill="none" stroke={C.roseD} strokeWidth={1.2} strokeDasharray="3 3" />
          <g transform="scale(.5)"><Marigold r={26} /></g>
        </motion.g>
      </g>
      {/* hanging tag */}
      <g transform={`translate(${bx + 34} ${by - 96})`}>
        <motion.g style={{ scale: tag }}>
          <motion.g animate={{ rotate: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
            <path d="M0 0 L0 22" stroke={INK} strokeWidth={2} />
            <rect x={-26} y={22} width={52} height={36} rx={5} fill={C.white} stroke={INK} strokeWidth={2.2} />
            <circle cy={30} r={3} fill={C.cream} stroke={INK} strokeWidth={1.6} />
            <text y={46} textAnchor="middle" fontSize={8.5} fontFamily="JetBrains Mono Variable, monospace" fill={INK} fontWeight={600}>FRESH BY</text>
            <text y={55} textAnchor="middle" fontSize={8.5} fontFamily="JetBrains Mono Variable, monospace" fill={C.roseD} fontWeight={700}>8 AM</text>
          </motion.g>
        </motion.g>
      </g>
      <Arm sx={613} sy={410} hx={lhx} hy={lhy} sleeve={C.saff} bend={26} />
      <Arm sx={667} sy={410} hx={rhx} hy={rhy} sleeve={C.saff} bend={36} />
    </g>
  )
}

/* ================================================================== 5. THE RIDE */

function Wheel({ cx, cy, rot }: { cx: number; cy: number; rot: MV }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={36} fill="#3a2f2a" stroke={INK} strokeWidth={2.2} />
      <motion.g style={{ rotate: rot }}>
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={0} y1={-24} x2={0} y2={24} stroke={C.cream} strokeWidth={3} strokeLinecap="round" transform={`rotate(${i * 30})`} />)}
        <circle r={10} fill={C.saff} stroke={INK} strokeWidth={2} />
      </motion.g>
    </g>
  )
}

function Houses({ offset }: { offset: MV }) {
  const set = [
    { x: 0, w: 150, h: 120, wall: '#f4e3c8', roof: '#d8553a' },
    { x: 190, w: 130, h: 160, wall: '#f6cfa0', roof: '#c8402e' },
    { x: 360, w: 170, h: 110, wall: '#e9efd9', roof: '#d8553a' },
    { x: 560, w: 120, h: 150, wall: '#f4e3c8', roof: '#e07a2e' },
  ]
  return (
    <motion.g style={{ x: offset }}>
      {[0, 1, 2, 3].map((rep) => (
        <g key={rep} transform={`translate(${rep * 720 - 60} 0)`} stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
          {set.map((h, i) => (
            <g key={i} transform={`translate(${h.x} ${500 - h.h})`}>
              <rect width={h.w} height={h.h} fill={h.wall} />
              <path d={`M-10 2 L${h.w / 2} -44 L${h.w + 10} 2 Z`} fill={h.roof} />
              <rect x={h.w * 0.2} y={h.h * 0.3} width={22} height={28} rx={3} fill="#cfeaf5" />
              <rect x={h.w * 0.6} y={h.h * 0.3} width={22} height={28} rx={3} fill="#cfeaf5" />
              <path d={`M${h.w * 0.4} ${h.h} v-34 q${h.w * 0.1} -16 ${h.w * 0.2} 0 v34 Z`} fill={C.woodD} />
            </g>
          ))}
        </g>
      ))}
    </motion.g>
  )
}

export function Scene5({ lp }: { lp: MV }) {
  const far = useTransform(lp, (v) => -((v * 700) % 360))
  const mid = useTransform(lp, (v) => -((v * 1800) % 720))
  const lamps = useTransform(lp, (v) => -((v * 3000) % 500))
  const dashes = useTransform(lp, (v) => -((v * 3600) % 160))
  const cloud = useKf(lp, [0, 1], [-60, 320])
  const spin = useKf(lp, [0, 1], [0, 2600])
  const bob = useTransform(lp, (v) => Math.sin(v * 160) * 2.4)
  const scarf = useTransform(lp, (v) => `M648 392 q ${34 + Math.sin(v * 90) * 8} ${-10 + Math.cos(v * 70) * 6} ${70 + Math.sin(v * 80) * 8} ${6 + Math.sin(v * 60) * 8}`)

  return (
    <g>
      <rect width={1200} height={620} fill="url(#sky5)" />
      <Sun x={300} y={330} r={50} />
      <Cloud x={cloud} y={110} s={0.9} />
      <Cloud x={useTransform(cloud, (v) => v + 560)} y={170} s={0.65} o={0.8} />
      {/* far skyline */}
      <motion.g style={{ x: far }} fill="#e0cdb6" stroke={INK} strokeWidth={2}>
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} transform={`translate(${i * 180 - 120} 0)`}>
            <rect x={0} y={360 - (i % 3) * 30} width={70} height={140 + (i % 3) * 30} />
            <rect x={80} y={330 - ((i + 1) % 3) * 24} width={60} height={170 + ((i + 1) % 3) * 24} />
            {i % 3 === 0 && <path d="M150 400 L168 330 L186 400 Z" />}
          </g>
        ))}
      </motion.g>
      <Houses offset={mid} />
      {/* road */}
      <rect y={500} width={1200} height={120} fill="#6b625a" stroke={INK} strokeWidth={2.2} />
      <rect y={500} width={1200} height={14} fill="#8a7e73" />
      <motion.g style={{ x: dashes }}>
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 160} y={576} width={80} height={8} rx={4} fill={C.cream} />)}
      </motion.g>
      {/* scooter + rider */}
      <motion.g style={{ y: bob }}>
        <motion.path d={scarf} stroke={C.roseD} strokeWidth={9} strokeLinecap="round" fill="none" />
        <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
          {/* rear box */}
          <rect x={486} y={392} width={74} height={62} rx={6} fill={C.kraft} />
          <g transform="translate(523 424)"><Marigold r={15} /></g>
          {/* body */}
          <path d="M556 470 L556 430 L690 430 Q724 430 736 470 L716 486 L560 486 Z" fill={C.mariD} />
          <path d="M690 430 L700 372 L722 372" fill="none" strokeWidth={5} />
          <path d="M716 372 q16 -4 22 6" fill="none" strokeWidth={4} />
          <circle cx={744} cy={410} r={7} fill="#ffe08f" />
          <rect x={560} y={414} width={92} height={18} rx={9} fill="#3a2f2a" />
          {/* rider */}
          <path d="M600 414 L612 346 Q630 332 650 342 L660 414 Z" fill={C.leaf} />
          <path d="M646 352 L704 384 L700 396 L640 372 Z" fill={C.leaf} />
          <circle cx={706} cy={390} r={7} fill={C.skinL} />
          <path d="M610 414 L640 470 L688 470 L664 430 Z" fill="#324a6b" />
          <rect x={628} y={468} width={30} height={12} rx={5} fill={INK} />
          <circle cx={640} cy={316} r={26} fill={C.skinL} />
          <path d="M612 314 Q614 282 642 284 Q668 284 668 314 Q660 304 640 304 Q620 304 612 314 Z" fill={C.saff} />
          <path d="M660 322 q8 4 14 0" fill="none" strokeWidth={1.8} />
          <circle cx={652} cy={314} r={2} fill={INK} stroke="none" />
        </g>
        <Wheel cx={570} cy={502} rot={spin} />
        <Wheel cx={716} cy={502} rot={spin} />
      </motion.g>
      {/* foreground lamp posts */}
      <motion.g style={{ x: lamps }} stroke={INK} strokeWidth={2.4} strokeLinecap="round">
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i} transform={`translate(${i * 500 + 120} 0)`}>
            <path d="M0 520 V250 q0 -22 26 -22" fill="none" strokeWidth={6} />
            <path d="M0 520 V250 q0 -22 26 -22" fill="none" stroke="#7a6f64" strokeWidth={3} />
            <circle cx={30} cy={232} r={9} fill="#ffe08f" />
          </g>
        ))}
      </motion.g>
    </g>
  )
}

/* ================================================================ 6. DOORSTEP */

export function Scene6({ lp }: { lp: MV }) {
  const dx = 700
  const dy = 520
  const bagDrop = useKf(lp, [0, 0.28], [-230, 0])
  const open = useStep(lp, 0.2, 0.6)
  const doorD = useTransform(open, (o) => {
    const wR = lerp(80, 14, o)
    const skew = lerp(0, 22, o)
    return `M${dx - 80} ${dy} L${dx - 80} ${dy - 250} Q${dx - 80} ${dy - 322} ${dx} ${dy - 322} Q${dx - 80 + wR * 2 - 0} ${dy - 322 + skew} ${dx - 80 + wR * 2} ${dy - 250 - skew * 0.4} L${dx - 80 + wR * 2} ${dy - skew * 0.2} Z`
  })
  const glow = useStep(lp, 0.28, 0.62)
  const rug = useStep(lp, 0.05, 0.4)
  const hx = useKf(lp, [0, 0.55, 0.7, 0.88, 1], [dx - 30, dx - 30, 596, 596, dx - 10])
  const hy = useKf(lp, [0, 0.55, 0.7, 0.88, 1], [dy - 140, dy - 140, 468, 468, dy - 150])
  const bq = useKf(lp, [0.72, 0.88, 1], [0, 1, 1])
  const bqx = useKf(lp, [0.72, 0.88, 1], [560, 596, dx - 10])
  const bqy = useKf(lp, [0.72, 0.88, 1], [470, 440, dy - 160])

  return (
    <g>
      <rect width={1200} height={620} fill="#f3d9c4" />
      {Array.from({ length: 7 }, (_, r) => Array.from({ length: 14 }, (_, c) => (
        <rect key={`${r}-${c}`} x={c * 90 - (r % 2) * 45} y={r * 40} width={90} height={40} fill="none" stroke="rgba(42,33,28,.08)" strokeWidth={2} />
      )))}
      <rect y={520} width={1200} height={100} fill="#c9b79e" stroke={INK} strokeWidth={2.2} />
      <Sun x={1010} y={130} r={44} />
      <Cloud x={120} y={100} s={0.8} />
      {/* doorway */}
      <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
        <path d={`M${dx - 104} ${dy} V${dy - 252} Q${dx - 104} ${dy - 348} ${dx} ${dy - 348} Q${dx + 104} ${dy - 348} ${dx + 104} ${dy - 252} V${dy} Z`} fill={C.woodD} />
        <path d={`M${dx - 80} ${dy} V${dy - 250} Q${dx - 80} ${dy - 322} ${dx} ${dy - 322} Q${dx + 80} ${dy - 322} ${dx + 80} ${dy - 250} V${dy} Z`} fill="#2d2118" />
      </g>
      {/* warm interior */}
      <motion.g style={{ opacity: glow }}>
        <path d={`M${dx - 80} ${dy} V${dy - 250} Q${dx - 80} ${dy - 322} ${dx} ${dy - 322} Q${dx + 80} ${dy - 322} ${dx + 80} ${dy - 250} V${dy} Z`} fill="#ffd98a" />
        <rect x={dx - 62} y={dy - 130} width={124} height={8} rx={3} fill={C.woodD} stroke={INK} strokeWidth={2} />
        <g transform={`translate(${dx - 30} ${dy - 142})`}>
          <path d="M-12 12 L12 12 L8 0 L-8 0 Z" fill={C.saff} stroke={INK} strokeWidth={2} />
          <motion.path d="M0 -2 q-8 -14 0 -26 q8 12 0 26 Z" fill="#ff9a3c" stroke={INK} strokeWidth={1.6} animate={{ scale: [1, 1.12, 0.95, 1], opacity: [1, 0.85, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
        </g>
        <g transform={`translate(${dx + 30} ${dy - 146})`}><Marigold r={14} /></g>
        <path d={`M${dx - 70} ${dy - 250} Q${dx} ${dy - 200} ${dx + 70} ${dy - 250}`} fill="none" stroke={C.mari} strokeWidth={9} strokeLinecap="round" strokeDasharray="1 12" />
      </motion.g>
      {/* door panel swings */}
      <motion.path d={doorD} fill={C.wood} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={dx + 56} cy={dy - 130} r={5} fill={C.saff} stroke={INK} strokeWidth={2} />
      {/* rangoli at the threshold */}
      <g transform={`translate(${dx} ${dy + 34})`}>
        <ellipse rx={92} ry={20} fill="none" stroke={C.roseD} strokeWidth={0} />
        {[88, 60, 34].map((rx, i) => (
          <motion.ellipse key={i} rx={rx} ry={rx * 0.22} fill="none" stroke={[C.roseD, C.mari, C.saff][i]} strokeWidth={5} strokeDasharray="1 9" strokeLinecap="round" style={{ pathLength: rug }} />
        ))}
        <motion.g style={{ scale: rug }}><Marigold r={14} tone={1} /></motion.g>
      </g>
      {/* plants */}
      {[dx - 190, dx + 190].map((x, i) => (
        <g key={x} transform={`translate(${x} ${dy})`} stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
          <path d="M-26 -52 L26 -52 L20 0 L-20 0 Z" fill="#c8553b" />
          <g transform="translate(0 -52)"><Leaf len={70} rot={-100} /><Leaf len={62} rot={-62} /><Leaf len={62} rot={-138} /></g>
          <g transform="translate(0 -118)"><Marigold r={20} tone={i as 0 | 1} /></g>
        </g>
      ))}
      {/* the packet drops onto the step */}
      <motion.g style={{ y: bagDrop }}>
        <g transform={`translate(${dx - 150} ${dy + 20})`} stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
          <path d="M-46 0 L-38 -76 L38 -76 L46 0 Z" fill={C.kraft} />
          <path d="M-38 -76 H38" strokeWidth={5} />
          <g transform="translate(0 -30) scale(.8)"><Marigold r={20} /></g>
        </g>
      </motion.g>
      {/* the bouquet is lifted out and carried inside */}
      <motion.g style={{ opacity: bq, x: bqx, y: bqy }}>
        <g transform="scale(.42) translate(0 -100)"><MiniBouquet /></g>
      </motion.g>
      <motion.g style={{ opacity: glow }}><Arm sx={dx + 36} sy={dy - 190} hx={hx} hy={hy} sleeve="#2f6f6a" bend={34} /></motion.g>
    </g>
  )
}
