import * as THREE from 'three'

// The whole site is one day on the shore. Scroll progress moves the clock:
// dawn at the top of the page, blue hour at the bottom. Everything that has
// a color reads it from here, so the scene always agrees with itself.

const STOPS = [0.0, 0.28, 0.58, 0.88]

const PALETTES = [
  // dawn
  {
    skyZenith: '#7BA6CE', skyHorizon: '#FAD5A0', sunCore: '#FFF3D6', sunHalo: '#FBD9A0',
    oceanDeep: '#45788F', oceanShallow: '#93BFBB', oceanSparkle: '#FBE9C8', foam: '#F7EFE2',
    sandLit: '#E9C89B', sandShadow: '#C29B72', cloudLit: '#FFEED6', cloudShadow: '#CFA6B4',
    rockLit: '#B5988A', rockShadow: '#7C6B72', hazeColor: '#E8D5C0',
    grassLit: '#8AA47A', grassShadow: '#5F7A62', bird: '#6A5F63',
    starColor: '#E8D5C0', lanternGlow: '#FFAE5C',
    washA: '#F2B0A0', washB: '#F8DCA8',
  },
  // midday
  {
    skyZenith: '#3B7EC8', skyHorizon: '#DCEEE6', sunCore: '#FFFDF4', sunHalo: '#FFF3D3',
    oceanDeep: '#23709A', oceanShallow: '#66C6B8', oceanSparkle: '#FFF6DA', foam: '#F8F5EA',
    sandLit: '#EFD5A2', sandShadow: '#C49E74', cloudLit: '#FFF9EC', cloudShadow: '#8FA8D0',
    rockLit: '#C4A183', rockShadow: '#8A6F6B', hazeColor: '#D7E6E2',
    grassLit: '#84A868', grassShadow: '#567B58', bird: '#5A5560',
    starColor: '#D7E6E2', lanternGlow: '#FFAE5C',
    washA: '#C9E4F2', washB: '#FFF3CD',
  },
  // golden hour
  {
    skyZenith: '#5F76B2', skyHorizon: '#FFC077', sunCore: '#FFF2C4', sunHalo: '#FCA452',
    oceanDeep: '#3E5F86', oceanShallow: '#7FA79E', oceanSparkle: '#FFD98F', foam: '#FBE9D3',
    sandLit: '#F0BB80', sandShadow: '#A87860', cloudLit: '#FFDCA0', cloudShadow: '#C27E8E',
    rockLit: '#D89C6E', rockShadow: '#7E5A66', hazeColor: '#F4C69A',
    grassLit: '#A8A26B', grassShadow: '#6E6B55', bird: '#6A4E56',
    starColor: '#F4C69A', lanternGlow: '#FFAE5C',
    washA: '#FF9E6A', washB: '#FFD98F',
  },
  // dusk
  {
    skyZenith: '#49538A', skyHorizon: '#E39A78', sunCore: '#FFDFA8', sunHalo: '#E88E6A',
    oceanDeep: '#33406A', oceanShallow: '#6B7B9B', oceanSparkle: '#EFBE8C', foam: '#DCD2DC',
    sandLit: '#C9A58F', sandShadow: '#7A6A87', cloudLit: '#E9AC90', cloudShadow: '#77719A',
    rockLit: '#9A7B80', rockShadow: '#4E4766', hazeColor: '#AC8BA0',
    grassLit: '#5C6373', grassShadow: '#3E4356', bird: '#464258',
    starColor: '#FFF4D9', lanternGlow: '#7FE9C3',
    washA: '#B37BA0', washB: '#E39A78',
  },
]

// Sun path: [azimuth deg, elevation deg]. At golden hour the sun sits exactly
// on the camera-to-keyhole line, so the light threads the arch.
const SUN_PATH = [
  [-28, 18],
  [-6, 52],
  [15.3, 5.5],
  [15.3, -7],
]

const KEYS = Object.keys(PALETTES[0])

/* ---- OKLab, so blended hours never turn to gray mud ---- */

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function hexToOklab(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = srgbToLinear(((n >> 16) & 255) / 255)
  const g = srgbToLinear(((n >> 8) & 255) / 255)
  const b = srgbToLinear((n & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToColor(L, A, B, out) {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3)
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3)
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  out.setRGB(Math.max(0, r), Math.max(0, g), Math.max(0, b))
  return out
}

const LAB = PALETTES.map((p) => {
  const o = {}
  for (const k of KEYS) o[k] = hexToOklab(p[k])
  return o
})

/* ---- shared frame state ---- */

export const dayState = {
  p: 0, // eased scroll progress 0..1
  time: 0,
  colors: Object.fromEntries(KEYS.map((k) => [k, new THREE.Color(PALETTES[0][k])])),
  skyMid: new THREE.Color(),
  skyLow: new THREE.Color(),
  sunDir: new THREE.Vector3(0, 0.3, -1),
  midday: 0, // the heavenly hour
  golden: 0, // light threads the keyhole
  dusk: 0, // blue hour amount
  stars: 0,
  caveGlow: 0,
  tug: 0, // the line goes taut at the end
  intro: 0, // 0..1 through the opening cast
}

const smooth = (t) => t * t * (3 - 2 * t)

function segment(p) {
  let i = 0
  while (i < STOPS.length - 2 && p > STOPS[i + 1]) i++
  const span = STOPS[i + 1] - STOPS[i]
  const local = Math.min(1, Math.max(0, (p - STOPS[i]) / span))
  return [i, smooth(local)]
}

const DEG = Math.PI / 180

export function updateDay(p) {
  dayState.p = p
  const [i, t] = segment(p)
  const a = LAB[i]
  const b = LAB[i + 1]

  for (const k of KEYS) {
    const la = a[k]
    const lb = b[k]
    oklabToColor(
      la[0] + (lb[0] - la[0]) * t,
      la[1] + (lb[1] - la[1]) * t,
      la[2] + (lb[2] - la[2]) * t,
      dayState.colors[k]
    )
  }

  // Derived sky stops between zenith and horizon
  const zh = [a.skyZenith, b.skyZenith, a.skyHorizon, b.skyHorizon]
  const mixKey = (f, out) => {
    const L = (zh[0][0] + (zh[1][0] - zh[0][0]) * t) * (1 - f) + (zh[2][0] + (zh[3][0] - zh[2][0]) * t) * f
    const A = (zh[0][1] + (zh[1][1] - zh[0][1]) * t) * (1 - f) + (zh[2][1] + (zh[3][1] - zh[2][1]) * t) * f
    const B = (zh[0][2] + (zh[1][2] - zh[0][2]) * t) * (1 - f) + (zh[2][2] + (zh[3][2] - zh[2][2]) * t) * f
    oklabToColor(L, A, B, out)
  }
  mixKey(0.5, dayState.skyMid)
  mixKey(0.82, dayState.skyLow)

  const az = (SUN_PATH[i][0] + (SUN_PATH[i + 1][0] - SUN_PATH[i][0]) * t) * DEG
  const el = (SUN_PATH[i][1] + (SUN_PATH[i + 1][1] - SUN_PATH[i][1]) * t) * DEG
  dayState.sunDir
    .set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
    .normalize()

  const rise = (lo, hi) => Math.min(1, Math.max(0, (p - lo) / (hi - lo)))
  dayState.midday = smooth(rise(0.12, 0.24)) * (1 - smooth(rise(0.38, 0.52)))
  dayState.golden = smooth(rise(0.38, 0.54)) * (1 - smooth(rise(0.68, 0.82)))
  dayState.dusk = smooth(rise(0.72, 0.88))
  dayState.stars = smooth(rise(0.7, 0.85))
  dayState.caveGlow = smooth(rise(0.6, 0.8))
  dayState.tug = smooth(rise(0.8, 0.86))
}
