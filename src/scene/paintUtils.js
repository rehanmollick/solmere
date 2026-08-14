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

/* Foliage for the arch ledges: dense leafy clumps, two tones of gray
 * so a single tint gives lit and shaded leaves */
export function makeBushTexture(seed) {
  const s = 256
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  // soft mass first
  for (let i = 0; i < 10; i++) {
    const x = s * (0.5 + (rand() - 0.5) * 0.45)
    const y = s * (0.55 + (rand() - 0.5) * 0.38)
    const r = s * (0.12 + rand() * 0.1)
    const shade = 120 + Math.floor(rand() * 50)
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r)
    g.addColorStop(0, `rgba(${shade},${shade},${shade},0.9)`)
    g.addColorStop(1, `rgba(${shade},${shade},${shade},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // then leaf chatter: many small crisp dabs, brighter on top
  for (let i = 0; i < 90; i++) {
    const x = s * (0.5 + (rand() - 0.5) * 0.6)
    const y = s * (0.55 + (rand() - 0.5) * 0.5)
    const up = 1 - (y / s)
    const shade = 130 + Math.floor(up * 95 + rand() * 30)
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.9)`
    ctx.beginPath()
    ctx.ellipse(x, y, 3 + rand() * 6, 2 + rand() * 4, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* Vines that hang off the arch: strands swaying down with leaf pairs */
export function makeVineTexture(seed) {
  const s = 512
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  const strands = 6
  for (let v = 0; v < strands; v++) {
    const x0 = s * (0.1 + (v / strands) * 0.8 + (rand() - 0.5) * 0.14)
    const len = s * (0.5 + rand() * 0.46)
    const sway = (rand() - 0.5) * s * 0.28
    const steps = 34
    for (let i = 0; i < steps; i++) {
      const k = i / steps
      if (k * s > len) break
      const x = x0 + Math.sin(k * Math.PI * 1.4 + v * 2.1) * sway * k
      const y = k * len
      // stem
      ctx.fillStyle = 'rgba(90,90,90,0.9)'
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.fill()
      // leaves in loose clumps, brighter near the top light
      if (rand() < 0.5) {
        const shade = 115 + Math.floor((1 - k) * 95 + rand() * 40)
        const side = rand() > 0.5 ? 1 : -1
        ctx.fillStyle = `rgba(${shade},${shade},${shade},0.94)`
        ctx.beginPath()
        ctx.ellipse(
          x + side * (6 + rand() * 5),
          y + 2 + rand() * 3,
          6.5 + rand() * 5,
          3.6 + rand() * 2,
          side * (0.4 + rand() * 0.5),
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* A handful of tiny blossoms to scatter over the greenery */
export function makeFlowerTexture(seed) {
  const s = 256
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < 26; i++) {
    const x = s * (0.5 + (rand() - 0.5) * 0.8)
    const y = s * (0.5 + (rand() - 0.5) * 0.8)
    const r = 2.5 + rand() * 3.5
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + rand()
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,236,180,0.95)'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.4, 0, Math.PI * 2)
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

/* ------------------------------------------------------------------
 * Little treasures painted in dabs: things the tide left on the sand,
 * and one paper boat for the horizon. Colored textures for flat decals.
 * ------------------------------------------------------------------ */
export function makePropTexture(kind, seed) {
  const s = 256
  const rand = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  const R = (a, b) => a + (b - a) * rand()

  const dab = (x, y, r, color, alpha, soft = false) => {
    if (soft) {
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r)
      g.addColorStop(0, color.replace('ALPHA', String(alpha)))
      g.addColorStop(1, color.replace('ALPHA', '0'))
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = color.replace('ALPHA', String(alpha))
    }
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const rgba = (r, g, b) => `rgba(${r},${g},${b},ALPHA)`

  const cx = s / 2
  const cy = s / 2

  if (kind === 'shell') {
    const cream = rgba(242, 227, 206)
    const roseC = rgba(217, 160, 138)
    const shadowC = rgba(150, 112, 96)
    // soft ground shadow
    dab(cx + 8, cy + 12, 62, rgba(96, 78, 70), 0.28, true)
    // the spiral, wound in dabs
    let ang = 0
    let r = 6
    while (r < 58) {
      const x = cx + Math.cos(ang) * r * 0.62
      const y = cy + Math.sin(ang) * r * 0.5
      dab(x, y, 10 + r * 0.16, Math.floor(ang / 1.6) % 2 ? roseC : cream, 0.95)
      ang += 0.5
      r += 1.7
    }
    // ridge shadows along the whorl
    ang = 0.7
    r = 12
    while (r < 56) {
      dab(cx + Math.cos(ang) * r * 0.62, cy + Math.sin(ang) * r * 0.5, 3.5, shadowC, 0.5)
      ang += 0.85
      r += 3
    }
    dab(cx - 14, cy - 12, 9, rgba(255, 248, 234), 0.85)
  }

  if (kind === 'star') {
    const coral = rgba(215, 119, 87)
    const pale = rgba(242, 201, 168)
    const deep = rgba(150, 74, 58)
    dab(cx + 6, cy + 10, 66, rgba(96, 78, 70), 0.26, true)
    for (let arm = 0; arm < 5; arm++) {
      const a = (arm / 5) * Math.PI * 2 - Math.PI / 2 + R(-0.06, 0.06)
      for (let k = 0; k < 12; k++) {
        const t = k / 11
        const rr = 12 + t * 62
        const w = 16 * (1 - t * 0.8)
        dab(cx + Math.cos(a) * rr + R(-2, 2), cy + Math.sin(a) * rr + R(-2, 2), w, coral, 0.95)
      }
      // arm crease
      dab(cx + Math.cos(a + 0.35) * 26, cy + Math.sin(a + 0.35) * 26, 7, deep, 0.4, true)
    }
    dab(cx, cy, 20, coral, 1)
    for (let i = 0; i < 26; i++) {
      const a = R(0, Math.PI * 2)
      const rr = R(4, 62)
      dab(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, R(1.5, 3.2), pale, 0.9)
    }
  }

  if (kind === 'pebbles') {
    const stones = [
      [cx - 40, cy + 18, 34, [169, 155, 168]],
      [cx + 34, cy + 4, 42, [141, 130, 144]],
      [cx + 2, cy - 38, 26, [186, 172, 180]],
    ]
    for (const [x, y, r, c] of stones) {
      dab(x + 5, y + 8, r * 1.1, rgba(96, 78, 70), 0.24, true)
      dab(x, y, r, rgba(c[0], c[1], c[2]), 1)
      for (let i = 0; i < 10; i++) {
        const a = R(0, Math.PI * 2)
        dab(
          x + Math.cos(a) * r * R(0.2, 0.75),
          y + Math.sin(a) * r * R(0.2, 0.75) * 0.85,
          R(2, 5),
          rand() > 0.5 ? rgba(c[0] + 25, c[1] + 22, c[2] + 20) : rgba(c[0] - 20, c[1] - 20, c[2] - 16),
          0.5
        )
      }
      dab(x - r * 0.3, y - r * 0.34, r * 0.3, rgba(214, 204, 210), 0.75)
    }
  }

  if (kind === 'wood') {
    const bark = rgba(176, 141, 102)
    const grain = rgba(126, 99, 74)
    const lightw = rgba(214, 184, 142)
    dab(cx, cy + 10, 70, rgba(96, 78, 70), 0.22, true)
    // a bent twig: chain of dabs along a slight curve
    for (let k = 0; k < 34; k++) {
      const t = k / 33
      const x = 30 + t * 196
      const y = cy + Math.sin(t * Math.PI * 0.9 + 0.4) * 22 + R(-1.5, 1.5)
      const w = 9 * (1 - Math.abs(t - 0.45) * 1.1) + 2
      dab(x, y, w, bark, 0.96)
      if (k % 3 === 0) dab(x, y - w * 0.4, w * 0.45, lightw, 0.7)
      if (k % 4 === 1) dab(x, y + w * 0.35, w * 0.4, grain, 0.6)
    }
    dab(96, cy - 4, 4.5, grain, 0.9)
    // one stub branch
    for (let k = 0; k < 7; k++) {
      const t = k / 6
      dab(150 + t * 26, cy - 8 - t * 22, 4.5 * (1 - t * 0.6), bark, 0.95)
    }
  }

  if (kind === 'boat') {
    const paper = rgba(247, 241, 230)
    const fold = rgba(202, 192, 178)
    const shade = rgba(150, 140, 132)
    // hull: two folded triangles
    for (let i = 0; i < 60; i++) {
      const t = i / 59
      const x = 48 + t * 160
      const yTop = 150
      const yBot = 150 + 44 * Math.sin(Math.min(1, Math.max(0, (t - 0.06) / 0.88)) * Math.PI)
      for (let y = yTop; y < yBot; y += 6) {
        dab(x + R(-1, 1), y + R(-1, 1), 5, t > 0.52 ? fold : paper, 0.95)
      }
    }
    // sail
    for (let i = 0; i < 40; i++) {
      const t = i / 39
      const x = 128
      const h = 92 * (1 - t)
      for (let k = 0; k < 8; k++) {
        dab(x - (k / 8) * 52 * (1 - t) + R(-1, 1), 148 - t * 92 + h * 0 + R(-1, 1), 4.5, paper, 0.9)
      }
      dab(x + 2, 148 - t * 92, 3.5, shade, 0.5)
    }
    // waterline shadow
    for (let i = 0; i < 22; i++) {
      dab(60 + i * 7, 196 + R(-2, 2), 5, shade, 0.4, true)
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  return tex
}

/* Long ragged horizontal brush pulls for the CSS overlay */
export function makeStrokeDataURL() {
  const s = 256
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  const rand = mulberry(4211)
  ctx.fillStyle = 'rgb(128,128,128)'
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 90; i++) {
    const y = rand() * s
    const x = rand() * s
    const len = 30 + rand() * 150
    const v = 108 + Math.floor(rand() * 40)
    const alpha = 0.05 + rand() * 0.1
    ctx.strokeStyle = `rgba(${v},${v},${v},${alpha})`
    ctx.lineWidth = 1 + rand() * 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(
      x + len * 0.3, y + (rand() - 0.5) * 6,
      x + len * 0.7, y + (rand() - 0.5) * 6,
      x + len, y + (rand() - 0.5) * 4
    )
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
