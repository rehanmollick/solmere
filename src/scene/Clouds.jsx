import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'
import { mulberry } from './paintUtils.js'
import {
  makeBankTexture,
  makeTowerTexture,
  makePuffTexture,
  makeCirrusTexture,
} from './cloudPaint.js'

// Grayscale paintings re-colored live: the texture holds the brushwork and
// the baked shading, the shader holds the hour. Every cumulus base sits in
// one shared altitude band, which is what makes the sky read as enormous.

const CloudMat = shaderMaterial(
  {
    map: null,
    uLit: new THREE.Color('#FDF0DC'),
    uMid: new THREE.Color('#E0CCC8'),
    uShadow: new THREE.Color('#C9B8C4'),
    uRimTint: new THREE.Color('#FFEBC2'),
    uDeepTint: new THREE.Color('#7E88B8'),
    uOpacity: 1,
  },
  /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uLit;
  uniform vec3 uMid;
  uniform vec3 uShadow;
  uniform vec3 uRimTint;
  uniform vec3 uDeepTint;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(map, vUv);
    // expand the baked value range so the floor hits pure shadow color
    float luma = smoothstep(0.26, 0.97, tex.r);
    vec3 col = mix(uShadow, uMid, smoothstep(0.16, 0.52, luma));
    col = mix(col, uLit, smoothstep(0.56, 0.93, luma));
    // the crowns catch the sun's own color, the caves go violet
    col = mix(col, uRimTint, smoothstep(0.86, 1.0, luma) * 0.5);
    col = mix(col, uDeepTint, (1.0 - smoothstep(0.05, 0.24, luma)) * 0.45);
    float a = tex.a * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
  `
)

extend({ CloudMat })

const WRAPS = { hero: 340, mid: 480, far: 680, cirrus: 520 }

export default function Clouds() {
  const groups = useRef([])
  const mats = useRef([])

  // quad pivot at bottom-center: position.y is the flat cloud-base altitude
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.translate(0, 0.5, 0)
    return g
  }, [])

  const clouds = useMemo(() => {
    const bank = [makeBankTexture(11), makeBankTexture(47), makeBankTexture(83)]
    const tower = [makeTowerTexture(101), makeTowerTexture(223)]
    const puff = [makePuffTexture(19), makePuffTexture(37), makePuffTexture(59)]
    const cirrus = [makeCirrusTexture(13), makeCirrusTexture(29)]
    const rand = mulberry(777)
    const list = []

    // hero banks: colossal, horizontal, close enough to feel
    list.push({ tex: bank[0], x: -120, y: 8, z: -200, w: 265, h: 108, band: 'hero', hazeMix: 0.13, opacity: 1 })
    list.push({ tex: bank[1], x: 140, y: 9, z: -258, w: 235, h: 94, band: 'hero', hazeMix: 0.17, opacity: 1 })

    // one tower far left, the day's only real weather
    list.push({ tex: tower[0], x: -235, y: 8, z: -245, w: 102, h: 152, band: 'hero', hazeMix: 0.2, opacity: 0.99 })

    // the halo: a bright build-up the keyhole aims at, far beyond the arch
    list.push({ tex: tower[1], x: 122, y: 12, z: -430, w: 130, h: 165, band: 'mid', hazeMix: 0.4, opacity: 0.97 })

    // mid-distance banks: every size, bases sharing one altitude band
    const midDefs = [
      [-195, 13, -330, 128, 52],
      [-15, 14, -352, 62, 25],
      [70, 15, -382, 92, 37],
      [215, 14, -402, 140, 56],
      [-320, 12, -362, 84, 33],
      [300, 13, -370, 70, 28],
      [-90, 15, -395, 48, 19],
    ]
    midDefs.forEach(([x, y, z, w, h], i) => {
      list.push({ tex: bank[i % 3], x, y, z, w, h, band: 'mid', hazeMix: 0.32, opacity: 0.96 })
    })

    // a second deck riding higher, staggered above the first
    const deckDefs = [
      [-150, 40, -290, 108, 40],
      [45, 46, -320, 76, 28],
      [230, 38, -305, 96, 36],
      [-330, 50, -335, 70, 26],
    ]
    deckDefs.forEach(([x, y, z, w, h], i) => {
      list.push({ tex: bank[(i + 1) % 3], x, y, z, w, h, band: 'mid', hazeMix: 0.28, opacity: 0.9 })
    })

    // horizon puffs, small and half-dissolved, wildly uneven sizes
    for (let i = 0; i < 9; i++) {
      const w = 30 + rand() * 58
      list.push({
        tex: puff[i % 3],
        x: -420 + i * 100 + rand() * 55,
        y: 3 + rand() * 3,
        z: -520 + rand() * 70,
        w,
        h: w * 0.42,
        band: 'far',
        hazeMix: 0.62,
        opacity: 0.85,
      })
    }

    // combed cirrus, very high, barely there
    for (let i = 0; i < 4; i++) {
      list.push({
        tex: cirrus[i % 2],
        x: -280 + i * 180 + rand() * 60,
        y: 85 + rand() * 45,
        z: -285 + rand() * 40,
        w: 230 + rand() * 90,
        h: 52 + rand() * 18,
        band: 'cirrus',
        hazeMix: 0.22,
        opacity: 0.4,
      })
    }

    for (const c of list) {
      c.speed = (0.9 + rand() * 0.5) * (c.band === 'cirrus' ? 0.35 : 1)
      c.phase = rand() * 20
    }
    return list
  }, [])

  const scratch = useMemo(
    () => ({ lit: new THREE.Color(), mid: new THREE.Color(), shadow: new THREE.Color() }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const cam = state.camera.position

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]
      const g = groups.current[i]
      const m = mats.current[i]
      if (!g || !m) continue

      const wrap = WRAPS[c.band]
      c.x += c.speed * delta
      if (c.x > wrap) c.x = -wrap
      const breathe = 1 + 0.012 * Math.sin(t * (0.05 + (i % 5) * 0.011) + c.phase)
      g.position.set(c.x, c.y, c.z)
      g.scale.set(c.w * breathe, c.h * breathe, 1)
      g.rotation.y = Math.atan2(cam.x - c.x, cam.z - c.z)

      const edgeFade = THREE.MathUtils.smoothstep(wrap - Math.abs(c.x), 15, 55)

      scratch.lit.copy(dayState.colors.cloudLit).lerp(dayState.colors.hazeColor, c.hazeMix)
      scratch.shadow.copy(dayState.colors.cloudShadow).lerp(dayState.colors.hazeColor, c.hazeMix * 1.15)
      scratch.mid.copy(scratch.shadow).lerp(scratch.lit, 0.55)

      m.uniforms.uLit.value.copy(scratch.lit)
      m.uniforms.uMid.value.copy(scratch.mid)
      m.uniforms.uShadow.value.copy(scratch.shadow)
      m.uniforms.uRimTint.value.copy(dayState.colors.sunHalo).lerp(scratch.lit, 0.35)
      m.uniforms.uDeepTint.value.copy(dayState.colors.skyZenith).lerp(scratch.shadow, 0.5)
      m.uOpacity = c.opacity * edgeFade * (1 - dayState.dusk * (c.band === 'cirrus' ? 0.5 : 0.08))
    }
  })

  const setRef = (arr, i) => (ref) => {
    arr.current[i] = ref
  }

  return (
    <group>
      {clouds.map((c, i) => (
        <group key={i} ref={setRef(groups, i)} position={[c.x, c.y, c.z]}>
          <mesh geometry={geometry}>
            <cloudMat
              ref={setRef(mats, i)}
              key={CloudMat.key}
              map={c.tex}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
