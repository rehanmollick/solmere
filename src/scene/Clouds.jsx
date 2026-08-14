import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { dayState } from './day.js'
import { makeCloudTexture, mulberry } from './paintUtils.js'

const WRAP_X = 380

export default function Clouds() {
  const groups = useRef([])
  const litMats = useRef([])
  const shadowMats = useRef([])
  const shadowSprites = useRef([])

  const { textures, clouds } = useMemo(() => {
    const textures = [
      makeCloudTexture(11, true),
      makeCloudTexture(27, true),
      makeCloudTexture(43, true),
      makeCloudTexture(61, true),
      makeCloudTexture(77, false),
      makeCloudTexture(93, false),
    ]
    const rand = mulberry(2026)
    const clouds = []
    // Far ring: hugging the horizon, half-dissolved in haze
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: -300 + i * 82 + rand() * 46,
        y: 8 + rand() * 14,
        z: -318 + rand() * 52,
        s: 58 + rand() * 44,
        tex: Math.floor(rand() * 4),
        speed: 0.55 + rand() * 0.3,
        phase: rand() * 20,
        hazeMix: 0.55,
        shadow: false,
      })
    }
    // Mid ring
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: -260 + i * 125 + rand() * 60,
        y: 20 + rand() * 18,
        z: -205 + rand() * 40,
        s: 42 + rand() * 22,
        tex: Math.floor(rand() * 4),
        speed: 1.0 + rand() * 0.45,
        phase: rand() * 20,
        hazeMix: 0.28,
        shadow: true,
      })
    }
    // Two towers framing the arch
    clouds.push({ x: 88, y: 30, z: -168, s: 66, tex: 4, speed: 1.35, phase: 3, hazeMix: 0.12, shadow: true })
    clouds.push({ x: -72, y: 33, z: -182, s: 74, tex: 5, speed: 1.2, phase: 9, hazeMix: 0.12, shadow: true })
    return { textures, clouds }
  }, [])

  const scratchLit = useMemo(() => new THREE.Color(), [])
  const scratchShadow = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const sunX = dayState.sunDir.x
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]
      const g = groups.current[i]
      if (!g) continue
      c.x += c.speed * delta
      if (c.x > WRAP_X) c.x = -WRAP_X
      const breathe = 1 + 0.016 * Math.sin(t * (0.06 + (i % 5) * 0.013) + c.phase)
      g.position.set(c.x, c.y, c.z)
      g.scale.setScalar(breathe)

      const edgeFade = THREE.MathUtils.smoothstep(WRAP_X - Math.abs(c.x), 18, 60)

      scratchLit.copy(dayState.colors.cloudLit).lerp(dayState.colors.hazeColor, c.hazeMix)
      scratchShadow.copy(dayState.colors.cloudShadow).lerp(dayState.colors.hazeColor, c.hazeMix)
      const lm = litMats.current[i]
      const sm = shadowMats.current[i]
      if (lm) {
        lm.color.copy(scratchLit)
        lm.opacity = 0.97 * edgeFade * (1 - dayState.dusk * 0.12)
      }
      if (sm) {
        sm.color.copy(scratchShadow)
        sm.opacity = (c.shadow ? 0.62 : 0) * edgeFade
      }
      // The shaded underside swings away from the sun
      const ss = shadowSprites.current[i]
      if (ss) ss.position.set(-sunX * c.s * 0.035, -c.s * 0.04, 0)
    }
  })

  const setRef = (arr, i) => (ref) => {
    arr.current[i] = ref
  }

  return (
    <group>
      {clouds.map((c, i) => {
        const tex = textures[c.tex]
        const aspect = tex.image.width / tex.image.height
        return (
          <group key={i} ref={setRef(groups, i)}>
            <sprite ref={setRef(shadowSprites, i)} scale={[c.s * 1.06 * aspect * 0.5, c.s * 1.06 * 0.5, 1]}>
              <spriteMaterial
                ref={setRef(shadowMats, i)}
                map={tex}
                transparent
                depthWrite={false}
                opacity={0.8}
              />
            </sprite>
            <sprite scale={[c.s * aspect * 0.5, c.s * 0.5, 1]}>
              <spriteMaterial
                ref={setRef(litMats, i)}
                map={tex}
                transparent
                depthWrite={false}
                opacity={0.94}
              />
            </sprite>
          </group>
        )
      })}
    </group>
  )
}
