import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { dayState } from './day.js'
import { sandHeightAt } from './Beach.jsx'
import { waterHeightAt } from './layout.js'
import { makePropTexture } from './paintUtils.js'

// The whimsy layer: treasures the tide left on the sand, two butterflies
// who own the grass until the fireflies clock in, and one paper boat
// sailing the far water like it knows where it is going.

const DECALS = [
  { kind: 'shell', seed: 5, x: 2.6, z: 8.4, size: 1.0, rot: 0.7 },
  { kind: 'star', seed: 9, x: -1.9, z: 7.2, size: 1.15, rot: 2.1 },
  { kind: 'pebbles', seed: 13, x: 4.9, z: 9.6, size: 1.5, rot: 4.2 },
  { kind: 'wood', seed: 21, x: -6.4, z: 8.8, size: 2.4, rot: 5.6 },
  { kind: 'shell', seed: 33, x: 0.4, z: 10.1, size: 0.62, rot: 3.3 },
]

const BUTTERFLIES = [
  { cx: -3.6, cy: 1.5, cz: 6.4, wing: '#E08560', speed: 1.0, phase: 0 },
  { cx: -7.8, cy: 1.8, cz: 6.2, wing: '#EFD3A0', speed: 0.8, phase: 2.6 },
]

export default function BeachLife() {
  const decalMats = useRef([])
  const flies = useRef([])
  const flyMats = useRef([])
  const boat = useRef()
  const boatMat = useRef()

  const textures = useMemo(() => {
    const m = {}
    for (const d of DECALS) {
      m[`${d.kind}${d.seed}`] = makePropTexture(d.kind, d.seed)
    }
    m.boat = makePropTexture('boat', 71)
    return m
  }, [])

  const boatState = useRef({ x: -95 })

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // decals take the hour's light
    for (const dm of decalMats.current) {
      if (dm) dm.color.copy(dayState.colors.sandLit).lerp(dayState.colors.foam, 0.55)
    }

    // butterflies flutter until the light goes; fireflies take the shift
    const flutterAlpha = Math.max(0, 1 - dayState.dusk * 1.4)
    BUTTERFLIES.forEach((b, i) => {
      const g = flies.current[i]
      if (!g) return
      const tt = t * b.speed + b.phase
      const x = b.cx + Math.sin(tt * 0.7) * 1.4 + Math.sin(tt * 1.7) * 0.4
      const z = b.cz + Math.cos(tt * 0.55) * 1.1
      const y = b.cy + Math.sin(tt * 1.3) * 0.5 + Math.sin(tt * 3.7) * 0.12
      const dx = x - g.position.x
      const dz = z - g.position.z
      g.position.set(x, y, z)
      if (Math.abs(dx) + Math.abs(dz) > 0.0001) g.rotation.y = Math.atan2(dx, dz)
      const flap = Math.sin(tt * 8.5) * 1.05
      if (g.children[0]) g.children[0].rotation.z = flap
      if (g.children[1]) g.children[1].rotation.z = -flap
      g.visible = flutterAlpha > 0.02
    })
    for (const fm of flyMats.current) {
      if (fm) fm.opacity = flutterAlpha
    }

    // the paper boat: far out, patient, rocking on the swell
    const bs = boatState.current
    bs.x += delta * 0.55
    if (bs.x > 60) bs.x = -130
    if (boat.current) {
      const bz = -238
      const wy = waterHeightAt(bs.x, bz, t)
      boat.current.position.set(bs.x, wy + 2.1, bz)
      boat.current.rotation.z = Math.sin(t * 0.5) * 0.05
      boat.current.rotation.y = Math.atan2(state.camera.position.x - bs.x, state.camera.position.z - bz)
    }
    if (boatMat.current) {
      boatMat.current.color.copy(dayState.colors.foam).lerp(dayState.colors.hazeColor, 0.35 + dayState.dusk * 0.3)
    }
  })

  const setRef = (arr, i) => (ref) => {
    arr.current[i] = ref
  }

  return (
    <group>
      {DECALS.map((d, i) => (
        <mesh
          key={i}
          position={[d.x, sandHeightAt(d.x, d.z) + 0.03, d.z]}
          rotation={[-Math.PI / 2, 0, d.rot]}
        >
          <planeGeometry args={[d.size, d.size]} />
          <meshBasicMaterial
            ref={setRef(decalMats, i)}
            map={textures[`${d.kind}${d.seed}`]}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}

      {BUTTERFLIES.map((b, i) => (
        <group key={i} ref={setRef(flies, i)} position={[b.cx, b.cy, b.cz]} scale={0.55}>
          <group>
            <mesh position={[-0.08, 0.02, 0]} rotation={[0.2, 0, 0]}>
              <planeGeometry args={[0.15, 0.2]} />
              <meshBasicMaterial
                ref={setRef(flyMats, i * 2)}
                color={b.wing}
                transparent
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
          <group>
            <mesh position={[0.08, 0.02, 0]} rotation={[0.2, 0, 0]}>
              <planeGeometry args={[0.15, 0.2]} />
              <meshBasicMaterial
                ref={setRef(flyMats, i * 2 + 1)}
                color={b.wing}
                transparent
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        </group>
      ))}

      <mesh ref={boat}>
        <planeGeometry args={[7.2, 7.2]} />
        <meshBasicMaterial
          ref={boatMat}
          map={textures.boat}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>
    </group>
  )
}
