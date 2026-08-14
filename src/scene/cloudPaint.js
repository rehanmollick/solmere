import * as THREE from 'three'
import { mulberry } from './paintUtils.js'

// Gouache clouds baked as thousands of discrete brush dabs in grayscale.
// Five quantized values only, crisp light strokes over wet-blended darks,
// light always from the upper left. A runtime shader turns value into color.

const V = [0.32, 0.46, 0.62, 0.8, 0.97]
const LIGHT = Math.atan2(-0.83, -0.55)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function makePainter(ctx, rnd) {
  const R = (a, b) => a + (b - a) * rnd()
  const dab = (x, y, r, v, alpha, soft, squash = 0.78, rot = 0) => {
    const b = Math.round(clamp(v + R(-0.015, 0.015), 0, 1) * 255)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.scale(1, squash)
    if (soft) {
      const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r)
      g.addColorStop(0, `rgba(${b},${b},${b},${alpha})`)
      g.addColorStop(1, `rgba(${b},${b},${b},0)`)
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = `rgba(${b},${b},${b},${alpha})`
    }
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  return { R, dab }
}

/**
 * Paint a cumulus mass from a tier table.
 * tiers: [{y, halfW, r, count}] bottom-to-top in canvas px.
 */
function paintCumulus(ctx, rnd, W, H, tiers, baseY, opts = {}) {
  const { R, dab } = makePainter(ctx, rnd)
  const wispCount = opts.wisps ?? 8

  // 1. skeleton
  const lobes = []
  const lean = R(-30, 30)
  const nT = tiers.length
  tiers.forEach((tier, ti) => {
    const frac = nT > 1 ? ti / (nT - 1) : 0
    for (let i = 0; i < tier.count; i++) {
      const spread = tier.count > 1 ? (i / (tier.count - 1)) * 2 - 1 : 0
      lobes.push({
        x: W / 2 + spread * tier.halfW * R(0.78, 1.0) + R(-14, 14) + lean * frac,
        y: tier.y + R(-14, 14),
        r: tier.r * R(0.85, 1.15),
        tier: frac,
      })
    }
    // shoulder lobes bulging past the silhouette
    if (ti < nT - 1 && rnd() < 0.75) {
      const side = rnd() > 0.5 ? 1 : -1
      lobes.push({
        x: W / 2 + side * tier.halfW * R(1.0, 1.14),
        y: tier.y + R(-10, 18),
        r: tier.r * R(0.55, 0.8),
        tier: frac,
      })
    }
  })

  // 2. mass fill
  for (const L of lobes) dab(L.x, L.y, L.r * 0.94, V[2], 1, false, 0.92)

  // 3. global gradients over existing paint only
  ctx.globalCompositeOperation = 'source-atop'
  const vg = ctx.createLinearGradient(0, baseY - H * 0.32, 0, baseY + 6)
  const v1 = Math.round(V[1] * 255)
  vg.addColorStop(0, `rgba(${v1},${v1},${v1},0)`)
  vg.addColorStop(1, `rgba(${v1},${v1},${v1},0.55)`)
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
  const hg = ctx.createLinearGradient(0, 0, W, 0)
  const v3 = Math.round(V[3] * 255)
  hg.addColorStop(0, `rgba(${v3},${v3},${v3},0.16)`)
  hg.addColorStop(1, `rgba(${v1},${v1},${v1},0.16)`)
  ctx.fillStyle = hg
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'

  // 4. interior brush texture
  for (const L of lobes) {
    const n = Math.round(L.r * 0.8)
    for (let i = 0; i < n; i++) {
      const th = R(0, Math.PI * 2)
      const rho = L.r * 0.7 * Math.sqrt(rnd())
      const pickV = rnd() < 0.2 ? V[1] : rnd() < 0.75 ? V[2] : V[3]
      dab(
        L.x + Math.cos(th) * rho,
        L.y + Math.sin(th) * rho,
        clamp(L.r * R(0.1, 0.2), 5, 16),
        pickV,
        0.45,
        true
      )
    }
  }

  // 5. rim cauliflower: one banding rule gives crisp sunlit scallops on the
  // upper left and soft shade on the lower right
  for (const L of lobes) {
    const n = Math.round(L.r * 1.3)
    for (let i = 0; i < n; i++) {
      const th = R(0, Math.PI * 2)
      const rho = L.r * R(0.72, 1.03)
      const x = L.x + Math.cos(th) * rho + R(-3, 3)
      const y = L.y + Math.sin(th) * rho + R(-3, 3)
      const rr = clamp(L.r * R(0.1, 0.22), 5, 18)
      const t =
        0.5 * (Math.cos(th - LIGHT) + 1) + 0.12 * L.tier - 0.1 * (y / H) + R(-0.05, 0.05)
      if (t > 0.8 && L.tier >= 0.55) dab(x, y, rr, V[4], 1, false, 0.78, th + Math.PI / 2)
      else if (t > 0.62) dab(x, y, rr, V[3], 0.95, false, 0.78, th + Math.PI / 2)
      else if (t > 0.38) dab(x, y, rr, V[2], 0.8, false, 0.78, th + Math.PI / 2)
      else dab(x, y, rr * 1.15, V[1], 0.6, true, 0.78, th + Math.PI / 2)
    }
  }

  // 6. underside shade, wet-blended
  for (const L of lobes) {
    const n = Math.round(L.r * 0.45)
    for (let i = 0; i < n; i++) {
      const th = R(Math.PI * 0.08, Math.PI * 0.7) // lower right arc, y-down
      const rho = L.r * R(0.5, 0.95)
      dab(
        L.x + Math.cos(th) * rho,
        L.y + Math.sin(th) * rho,
        clamp(L.r * R(0.12, 0.24), 6, 20),
        rnd() < 0.25 ? V[0] : V[1],
        R(0.5, 0.8),
        true
      )
    }
  }

  // 7. crease darks where lobes press together: these sell the 3D form
  for (let a = 0; a < lobes.length; a++) {
    for (let b = a + 1; b < lobes.length; b++) {
      const A = lobes[a]
      const B = lobes[b]
      const d = Math.hypot(A.x - B.x, A.y - B.y)
      if (d < 0.9 * (A.r + B.r) && Math.abs(A.tier - B.tier) < 0.45) {
        const mx = (A.x + B.x) / 2
        const my = (A.y + B.y) / 2
        const n = 4 + Math.floor(rnd() * 5)
        for (let i = 0; i < n; i++) {
          dab(mx + R(-10, 10), my + R(-10, 10), R(4, 9), V[0], 0.45, true)
        }
      }
    }
  }

  // 8. crown highlights: crisp, last, always
  for (const L of lobes) {
    const isCrown = L.tier >= 0.55
    const n = Math.round(L.r * (isCrown ? 0.85 : 0.5))
    for (let i = 0; i < n; i++) {
      const th = LIGHT + R(-0.96, 0.96)
      const rho = L.r * R(0.86, 1.04)
      dab(
        L.x + Math.cos(th) * rho,
        L.y + Math.sin(th) * rho,
        R(4, 10),
        isCrown ? V[4] : V[3],
        1,
        false,
        0.85,
        th + Math.PI / 2
      )
    }
  }

  // 9. wisps pulled off the flanks
  for (let wi = 0; wi < wispCount; wi++) {
    const L = lobes[Math.floor(rnd() * lobes.length)]
    const side = rnd() > 0.5 ? 1 : -1
    let x = L.x + side * L.r * 0.9
    let y = L.y + R(-L.r * 0.3, L.r * 0.3)
    const steps = 14 + Math.floor(rnd() * 10)
    const dx = side * R(4, 9)
    const dy = R(-2.5, 2.5)
    for (let s = 0; s < steps; s++) {
      const k = s / steps
      dab(x, y, Math.max(1.5, 6 * (1 - k)), V[2] + k * (V[3] - V[2]), 0.3 * (1 - k) + 0.05, true)
      x += dx
      y += dy + Math.sin(k * Math.PI * 2) * 1.5
    }
  }

  // 10. dead-flat base cut, then scalloped under-pods resting on the line
  ctx.globalCompositeOperation = 'destination-out'
  const cut = ctx.createLinearGradient(0, baseY - 6, 0, baseY)
  cut.addColorStop(0, 'rgba(0,0,0,0)')
  cut.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = cut
  ctx.fillRect(0, baseY - 6, W, 6)
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(0, baseY, W, H - baseY)
  ctx.globalCompositeOperation = 'source-over'
  const pods = 6 + Math.floor(rnd() * 4)
  for (let i = 0; i < pods; i++) {
    dab(W * R(0.2, 0.8), baseY - R(2, 7), R(16, 26), V[0], 0.35, true, 0.4)
  }
}

function finishTexture(canvas, rnd) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const mx = w * 0.04
  const my = h * 0.04
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3
      if (d[i] === 0) continue
      const ex = Math.min(x / mx, (w - 1 - x) / mx, 1)
      const ey = Math.min(y / my, (h - 1 - y) / my, 1)
      d[i] = Math.max(0, Math.min(255, d[i] * ex * ey + (rnd() - 0.5) * 22))
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  return tex
}

/* A long horizontal cumulus bank: the workhorse of the sky */
export function makeBankTexture(seed) {
  const W = 1024
  const H = 448
  const rnd = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const tiers = [
    { y: H * 0.74, halfW: W * 0.4, r: H * 0.17, count: 6 },
    { y: H * 0.56, halfW: W * 0.31, r: H * 0.15, count: 4 },
    { y: H * 0.42, halfW: W * 0.21, r: H * 0.12, count: 3 },
    { y: H * 0.3, halfW: W * 0.12, r: H * 0.09, count: 2 },
  ]
  paintCumulus(ctx, rnd, W, H, tiers, H * 0.8, { wisps: 12 })
  return finishTexture(canvas, rnd)
}

/* A towering build-up, taller than wide, for the heroes */
export function makeTowerTexture(seed) {
  const W = 512
  const H = 768
  const rnd = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const tiers = [
    { y: H * 0.82, halfW: W * 0.38, r: H * 0.115, count: 3 },
    { y: H * 0.68, halfW: W * 0.33, r: H * 0.105, count: 3 },
    { y: H * 0.55, halfW: W * 0.27, r: H * 0.09, count: 3 },
    { y: H * 0.42, halfW: W * 0.2, r: H * 0.078, count: 2 },
    { y: H * 0.3, halfW: W * 0.14, r: H * 0.062, count: 2 },
    { y: H * 0.2, halfW: W * 0.09, r: H * 0.05, count: 1 },
  ]
  paintCumulus(ctx, rnd, W, H, tiers, H * 0.88, { wisps: 8 })
  return finishTexture(canvas, rnd)
}

/* A small tumbling puff for the horizon line */
export function makePuffTexture(seed) {
  const W = 512
  const H = 256
  const rnd = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const tiers = [
    { y: H * 0.68, halfW: W * 0.34, r: H * 0.24, count: 4 },
    { y: H * 0.42, halfW: W * 0.2, r: H * 0.19, count: 2 },
  ]
  paintCumulus(ctx, rnd, W, H, tiers, H * 0.78, { wisps: 5 })
  return finishTexture(canvas, rnd)
}

/* High thin cirrus: long combed streaks */
export function makeCirrusTexture(seed) {
  const w = 1024
  const h = 256
  const rnd = mulberry(seed)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const streaks = 6 + Math.floor(rnd() * 4)
  for (let s = 0; s < streaks; s++) {
    const y0 = h * (0.2 + rnd() * 0.6)
    const x0 = w * rnd() * 0.3
    const len = w * (0.4 + rnd() * 0.55)
    const arc = (rnd() - 0.5) * h * 0.3
    const steps = 40
    for (let i = 0; i < steps; i++) {
      const k = i / steps
      const x = x0 + len * k
      if (x > w) break
      const y = y0 + Math.sin(k * Math.PI) * arc + (rnd() - 0.5) * 2
      const taper = Math.sin(Math.min(1, k) * Math.PI)
      const v = 205 + Math.floor(rnd() * 40)
      ctx.fillStyle = `rgba(${v},${v},${v},${0.2 * taper * (0.6 + rnd() * 0.4)})`
      ctx.beginPath()
      ctx.ellipse(x, y, 16 + rnd() * 20, 3 + rnd() * 3.5, arc / w, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return finishTexture(canvas, rnd)
}
