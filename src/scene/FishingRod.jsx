import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial, QuadraticBezierLine } from '@react-three/drei'
import { dayState } from './day.js'
import { BOBBER_POS, ROD_ROOT, SHORELINE_Z } from './layout.js'
import { getToonRamp } from './paintUtils.js'
import { prefersReducedMotion } from '../scrollState.js'

// Mirror of the ocean vertex swell so floating things agree with the water
function waterHeight(x, z, t) {
  let h = 0
  h += 0.5 * Math.sin(x * 0.16 + z * 0.07 + t * 0.9)
  h += 0.26 * Math.sin(x * -0.11 + z * 0.21 + t * 0.68 + 1.7)
  h += 0.15 * Math.sin(x * 0.34 + z * 0.27 + t * 1.24 + 4.2)
  h += 0.09 * Math.sin(x * -0.53 + z * 0.41 + t * 1.71 + 2.3)
  const shoreCalm = THREE.MathUtils.smoothstep(Math.abs(z - SHORELINE_Z), 2, 26)
  return h * 0.55 * (0.35 + 0.65 * shoreCalm)
}

const RippleMat = shaderMaterial(
  { uPhase: 0, uColor: new THREE.Color('#F7EFE2'), uStrength: 0.5 },
  /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  /* glsl */ `
  uniform float uPhase;
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float r = uPhase * 0.92;
    float ring = smoothstep(0.10, 0.02, abs(d - r));
    float alpha = ring * (1.0 - uPhase) * uStrength;
    gl_FragColor = vec4(uColor, alpha);
  }
  `
)

extend({ RippleMat })

const CAST_START = 0.9
const CAST_END = 2.1

export default function FishingRod({ started }) {
  const rig = useRef()
  const rodPivot = useRef()
  const lineRef = useRef()
  const bobber = useRef()
  const rippleMats = useRef([])
  const rippleMeshes = useRef([])
  const introStart = useRef(-1)

  const ramp = getToonRamp()

  const { tubes, tipLocal, guides } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.12, 0.55, -0.75),
      new THREE.Vector3(-0.5, 1.15, -1.55),
      new THREE.Vector3(-1.05, 1.8, -2.3),
    ])
    const pts = curve.getPoints(36)
    const seg = (a, b, r) =>
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(a, b + 1)), 12, r, 7, false)
    const tubes = [seg(0, 13, 0.028), seg(12, 25, 0.018), seg(24, 36, 0.01)]
    const tipLocal = pts[36].clone()
    const guides = [0.42, 0.66, 0.88].map((t) => {
      const p = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan)
      return { p: p.add(new THREE.Vector3(0, -0.045, 0)), q, s: 0.05 - t * 0.03 }
    })
    return { tubes, tipLocal, guides }
  }, [])

  const scratch = useMemo(
    () => ({
      tip: new THREE.Vector3(),
      end: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      bob: new THREE.Vector3(),
    }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const cam = state.camera
    const g = rig.current
    if (!g) return

    // The rod is your hands: it goes where you look, a half-beat behind
    g.position.copy(cam.position)
    if (prefersReducedMotion) {
      g.quaternion.copy(cam.quaternion)
    } else {
      g.quaternion.slerp(cam.quaternion, 1 - Math.exp(-14 * delta))
    }

    // Opening cast timeline
    if (started && introStart.current < 0) introStart.current = t
    let introT = prefersReducedMotion ? 99 : introStart.current < 0 ? 0 : t - introStart.current
    const tug = dayState.tug

    // Rod posture: idle sway, the backswing and flick, the end-of-day tug
    let pitch = Math.sin(t * 0.6) * 0.02 + Math.sin(t * 1.7) * 0.008
    if (introT < CAST_START) {
      pitch += 0.1
    } else if (introT < CAST_START + 0.45) {
      const k = (introT - CAST_START) / 0.45
      pitch += 0.1 - Math.sin(k * Math.PI) * 0.55 // back, then whip forward
    } else if (introT < CAST_END + 0.5) {
      const k = Math.min(1, (introT - CAST_START - 0.45) / 0.7)
      pitch += (1 - k) * 0.3
    }
    pitch += tug * (0.16 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.02)
    rodPivot.current.rotation.x = pitch
    rodPivot.current.rotation.z = Math.sin(t * 0.8 + 1) * 0.012

    // Bobber: flies out on the cast, then rides the swell
    const castK =
      introT <= CAST_START ? 0 : Math.min(1, (introT - CAST_START - 0.3) / (CAST_END - CAST_START - 0.3))
    scratch.tip.copy(tipLocal)
    rodPivot.current.localToWorld(scratch.tip)

    const waterY = waterHeight(BOBBER_POS.x, BOBBER_POS.z, t)
    if (castK < 1) {
      const k = 1 - Math.pow(1 - castK, 2) // drag slows the flight
      scratch.bob.lerpVectors(scratch.tip, BOBBER_POS, k)
      scratch.bob.y += Math.sin(k * Math.PI) * 4.2 * (1 - k * 0.3)
    } else {
      const drift = Math.sin(t * 0.26) * 0.2
      const dip = tug * (0.22 + Math.sin(t * 7) * 0.12)
      scratch.bob.set(BOBBER_POS.x + drift, waterY + 0.1 - dip, BOBBER_POS.z + drift * 0.6)
    }
    bobber.current.position.copy(scratch.bob)
    bobber.current.rotation.set(Math.sin(t * 1.3) * 0.14 + tug * 0.3, 0, Math.sin(t * 0.9) * 0.12)

    // The line: lazy sag most of the day, taut when something argues
    scratch.end.copy(scratch.bob)
    scratch.end.y += 0.16
    const sag = castK < 1 ? 0.6 + (1 - castK) * 1.2 : THREE.MathUtils.lerp(1.05, 0.12, tug)
    scratch.mid.lerpVectors(scratch.tip, scratch.end, 0.55)
    scratch.mid.y -= sag * (1 + Math.sin(t * 0.5) * 0.06)
    scratch.mid.y = Math.max(scratch.mid.y, 0.45)
    if (lineRef.current) lineRef.current.setPoints(scratch.tip, scratch.end, scratch.mid)

    // Ripples spreading from the bobber
    const landed = castK >= 1
    for (let i = 0; i < 3; i++) {
      const m = rippleMats.current[i]
      const mesh = rippleMeshes.current[i]
      if (!m || !mesh) continue
      const speed = 0.22 * (1 + tug * 2.2)
      const phase = (t * speed + i / 3) % 1
      m.uPhase = phase
      m.uStrength = landed ? 0.42 + tug * 0.35 : 0
      m.uniforms.uColor.value.copy(dayState.colors.foam)
      mesh.position.set(scratch.bob.x, waterY + 0.04, scratch.bob.z)
      const size = 2.6 * (1 + tug * 0.5)
      mesh.scale.setScalar(size)
    }
  })

  const setRippleMat = (i) => (ref) => {
    rippleMats.current[i] = ref
  }
  const setRippleMesh = (i) => (ref) => {
    rippleMeshes.current[i] = ref
  }

  return (
    <group>
      {/* rod rig follows the camera like a pair of hands */}
      <group ref={rig}>
        <group position={ROD_ROOT.toArray()} rotation={[0.06, -0.12, 0]}>
          <group ref={rodPivot}>
            {tubes.map((geo, i) => (
              <mesh key={i} geometry={geo}>
                <meshToonMaterial color={i === 0 ? '#6b5138' : '#54402f'} gradientMap={ramp} />
              </mesh>
            ))}
            {/* cork grip */}
            <mesh position={[-0.02, 0.14, -0.2]} rotation={[-0.62, 0, 0.06]}>
              <cylinderGeometry args={[0.036, 0.04, 0.52, 10]} />
              <meshToonMaterial color="#c9a77b" gradientMap={ramp} />
            </mesh>
            {/* reel */}
            <mesh position={[0.0, 0.02, -0.42]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.085, 0.085, 0.045, 18]} />
              <meshToonMaterial color="#8a6f4d" gradientMap={ramp} />
            </mesh>
            <mesh position={[0.055, -0.04, -0.46]}>
              <sphereGeometry args={[0.022, 8, 6]} />
              <meshToonMaterial color="#54402f" gradientMap={ramp} />
            </mesh>
            {/* guides */}
            {guides.map((gd, i) => (
              <mesh key={i} position={gd.p.toArray()} quaternion={gd.q}>
                <torusGeometry args={[gd.s, 0.006, 6, 14]} />
                <meshToonMaterial color="#8a6f4d" gradientMap={ramp} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      <QuadraticBezierLine
        ref={lineRef}
        start={[0, 0, 0]}
        end={[0, 0, 0]}
        color="#4a3a30"
        lineWidth={1.1}
        transparent
        opacity={0.85}
      />

      {/* the bobber, red cap and cream belly */}
      <group ref={bobber} scale={0.24}>
        <mesh>
          <sphereGeometry args={[1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshToonMaterial color="#c65440" gradientMap={ramp} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshToonMaterial color="#f2e8d5" gradientMap={ramp} />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.1, 0.16, 0.9, 8]} />
          <meshToonMaterial color="#c65440" gradientMap={ramp} />
        </mesh>
      </group>

      {/* rings the water keeps making around it */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={setRippleMesh(i)} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <planeGeometry args={[1, 1]} />
          <rippleMat
            ref={setRippleMat(i)}
            key={RippleMat.key}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}
