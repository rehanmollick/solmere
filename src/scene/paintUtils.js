import * as THREE from 'three'

export function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Small value noise for geometry displacement on the CPU
export function makeNoise2(seed) {
  const rand = mulberry(seed)
  const perm = new Uint8Array(512)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]
  const grad = (h, x, y) => ((h & 1 ? -x : x) + (h & 2 ? -y : y)) * 0.7
  const fade = (t) => t * t * (3 - 2 * t)
  return (x, y) => {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const fx = x - Math.floor(x)
    const fy = y - Math.floor(y)
    const u = fade(fx)
    const v = fade(fy)
    const aa = perm[X + perm[Y]]
    const ab = perm[X + perm[Y + 1]]
    const ba = perm[X + 1 + perm[Y]]
    const bb = perm[X + 1 + perm[Y + 1]]
    const n =
      (1 - v) * ((1 - u) * grad(aa, fx, fy) + u * grad(ba, fx - 1, fy)) +
      v * ((1 - u) * grad(ab, fx, fy - 1) + u * grad(bb, fx - 1, fy - 1))
    return n // roughly -0.7..0.7
  }
}

export function fbm2(noise, x, y, octaves = 4) {
  let amp = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y)
    norm += amp
    amp *= 0.5
    x = x * 2.1 + 13.7
    y = y * 2.1 + 7.3
  }
  return sum / norm
}

/* ------------------------------------------------------------------
 * Painted cumulus cluster, composed once into a canvas: soft puffs
 * stacked in a cauliflower arc, a few hard brush dabs on the crown,
 * the base sliced flat, and the alpha roughed up so nothing looks
 * airbrushed. Drawn in white; tinted by the sprite material.
 * ------------------------------------------------------------------ */
export function makeCloudTexture(seed, wide = false) {
  const w = wide ? 1024 : 512
  const h = wide ? 512 : 512
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const cx = w * 0.5
  const baseY = h * 0.72
  const puff = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${0.98 * a})`)
    g.addColorStop(0.62, `rgba(255,255,255,${0.82 * a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Core mass sits low, mids ride the upper arc, crowns on top.
  // Everything overlaps hard so the mass reads solid, not bokeh.
  const spread = wide ? 0.34 : 0.24
  puff(cx, baseY - h * 0.2, h * 0.32, 1)
  puff(cx - w * spread * 0.4, baseY - h * 0.16, h * 0.26, 1)
  puff(cx + w * spread * 0.44, baseY - h * 0.15, h * 0.24, 1)
  const mids = 6 + Math.floor(rand() * 3)
  for (let i = 0; i < mids; i++) {
    const ang = Math.PI * (0.08 + (i / (mids - 1)) * 0.84)
    const dist = w * spread * (0.4 + rand() * 0.5)
    puff(
      cx + Math.cos(ang) * dist * (wide ? 1.35 : 1),
      baseY - h * 0.18 - Math.sin(ang) * h * 0.22 * (0.7 + rand() * 0.5),
      h * (0.14 + rand() * 0.1),
      1
    )
  }
  const crowns = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < crowns; i++) {
    puff(
      cx + (rand() - 0.5) * w * spread * 1.1,
      baseY - h * (0.42 + rand() * 0.13),
      h * (0.08 + rand() * 0.07),
      0.95
    )
  }

  // Hard brush dabs along the sunlit crown
  for (let i = 0; i < 4; i++) {
    const x = cx + (rand() - 0.6) * w * spread * 1.4
    const y = baseY - h * (0.4 + rand() * 0.16)
    const r = h * (0.025 + rand() * 0.03)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.8, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Flat cumulus base
  ctx.globalCompositeOperation = 'destination-out'
  const cut = ctx.createLinearGradient(0, baseY - h * 0.04, 0, h)
  cut.addColorStop(0, 'rgba(0,0,0,0)')
  cut.addColorStop(0.35, 'rgba(0,0,0,0.85)')
  cut.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = cut
  ctx.fillRect(0, baseY - h * 0.04, w, h)
  ctx.globalCompositeOperation = 'source-over'

  // Boost density toward opaque paint, feather the canvas border so no
  // sprite ever shows a straight cut edge, and rough up the alpha so the
  // result reads dry-brush, not airbrush
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const mx = w * 0.07
  const my = h * 0.07
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3
      if (d[i] === 0) continue
      const ex = Math.min(x / mx, (w - 1 - x) / mx, 1)
      const ey = Math.min(y / my, (h - 1 - y) / my, 1)
      const boosted = Math.pow(d[i] / 255, 0.72) * 255 * 1.12 * ex * ey
      const j = (rand() - 0.5) * 20
      d[i] = Math.max(0, Math.min(255, boosted + j))
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  return tex
}

/* ------------------------------------------------------------------
 * A tuft of dune grass: tapered blades fanning from one root, back
 * blades darker than front so a single tint gives two tones.
 * ------------------------------------------------------------------ */
export function makeGrassTexture(seed) {
  const s = 512
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')

  const blade = (rx, lean, len, width, shade) => {
    const x0 = s * (0.5 + rx)
    const y0 = s * 0.98
    const x1 = x0 + s * lean
    const y1 = y0 - s * len
    const cxp = x0 + s * lean * 0.25
    const cyp = y0 - s * len * 0.55
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.96)`
    ctx.beginPath()
    ctx.moveTo(x0 - width, y0)
    ctx.quadraticCurveTo(cxp - width * 0.6, cyp, x1, y1)
    ctx.quadraticCurveTo(cxp + width * 0.6, cyp, x0 + width, y0)
    ctx.closePath()
    ctx.fill()
  }

  for (let i = 0; i < 9; i++) {
    blade((rand() - 0.5) * 0.22, (rand() - 0.5) * 0.5, 0.5 + rand() * 0.3, 4 + rand() * 3, 120)
  }
  for (let i = 0; i < 11; i++) {
    blade((rand() - 0.5) * 0.26, (rand() - 0.5) * 0.56, 0.55 + rand() * 0.38, 4 + rand() * 4, 235)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* Foliage for the arch ledges: rounder, denser than a cloud */
export function makeBushTexture(seed) {
  const s = 256
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < 16; i++) {
    const x = s * (0.5 + (rand() - 0.5) * 0.5)
    const y = s * (0.55 + (rand() - 0.5) * 0.4)
    const r = s * (0.09 + rand() * 0.1)
    const shade = 150 + Math.floor(rand() * 105)
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r)
    g.addColorStop(0, `rgba(${shade},${shade},${shade},0.95)`)
    g.addColorStop(1, `rgba(${shade},${shade},${shade},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* Static paper grain tile for the CSS overlay */
export function makeGrainDataURL() {
  const s = 160
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(s, s)
  const rand = mulberry(9017)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(rand() * 42)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  // faint horizontal paper fibers
  ctx.strokeStyle = 'rgba(100,100,100,0.05)'
  for (let i = 0; i < 26; i++) {
    const y = Math.floor(rand() * s) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(s, y)
    ctx.stroke()
  }
  return canvas.toDataURL()
}

/* Shared three-step ramp for every toon material in the scene */
let toonRamp = null
export function getToonRamp() {
  if (!toonRamp) {
    const data = new Uint8Array([120, 200, 255])
    toonRamp = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
    toonRamp.minFilter = THREE.NearestFilter
    toonRamp.magFilter = THREE.NearestFilter
    toonRamp.needsUpdate = true
  }
  return toonRamp
}
