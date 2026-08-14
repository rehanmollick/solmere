import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { dayState } from './day.js'
import { mulberry } from './paintUtils.js'

// Terns, mostly. Two wings on a hinge, a flap-and-glide state machine,
// and loose loops over the water. No two ever do the same thing at once.

const FLOCK_PATHS = [
  {
    // mid-distance flock, working the shallows and passing the arch
    points: [
      [38, 9, -62],
      [12, 13, -96],
      [-24, 8, -82],
      [-42, 12, -46],
      [-12, 15, -34],
      [22, 10, -42],
    ],
    count: 5,
    scale: 1.0,
    duration: 82,
  },
  {
    // far flock near the horizon
    points: [
      [64, 15, -222],
      [0, 19, -258],
      [-72, 13, -232],
      [-18, 21, -198],
    ],
    count: 3,
    scale: 1.7,
    duration: 130,
  },
  {
    // one loner on a lazy loop, closer in
    points: [
      [14, 6.5, -30],
      [-8, 9.5, -48],
      [-24, 5.5, -32],
      [-4, 7.5, -19],
    ],
    count: 1,
    scale: 0.8,
    duration: 58,
  },
]

function makeBirdConfigs() {
  const rand = mulberry(404)
  const birds = []
  FLOCK_PATHS.forEach((flock, fi) => {
    const curve = new THREE.CatmullRomCurve3(
      flock.points.map((p) => new THREE.Vector3(...p)),
      true,
      'centripetal'
    )
    for (let i = 0; i < flock.count; i++) {
      birds.push({
        curve,
        flock: fi,
        scale: flock.scale * (0.9 + rand() * 0.2),
        duration: flock.duration * (0.88 + rand() * 0.24),
        tOffset: rand(),
        lateral: new THREE.Vector3((rand() - 0.5) * 9, (rand() - 0.5) * 3, (rand() - 0.5) * 9),
        flapHz: 2.3 + rand() * 0.9,
        phase: rand() * Math.PI * 2,
        mode: rand() > 0.5 ? 'flap' : 'glide',
        modeLeft: 1 + rand() * 3,
        seed: rand,
      })
    }
  })
  return birds
}

function makeWingGeometry(side) {
  // one swept, tapered wing: wide at the shoulder, a point at the tip
  const g = new THREE.BufferGeometry()
  const s = side
  const verts = new Float32Array([
    0, 0, 0.16,
    0, 0, -0.2,
    s * 0.72, 0.02, -0.02,
    s * 0.72, 0.02, -0.02,
    0, 0, -0.2,
    s * 1.12, 0.05, -0.26,
  ])
  g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  g.computeVertexNormals()
  return g
}

export default function Birds() {
  const configs = useMemo(makeBirdConfigs, [])
  const groups = useRef([])
  const wingsL = useRef([])
  const wingsR = useRef([])
  const wingGeoL = useMemo(() => makeWingGeometry(-1), [])
  const wingGeoR = useMemo(() => makeWingGeometry(1), [])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#6A5F63',
        side: THREE.DoubleSide,
        transparent: true,
      }),
    []
  )

  const scratch = useMemo(
    () => ({ pos: new THREE.Vector3(), tan: new THREE.Vector3(), ahead: new THREE.Vector3() }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    material.color.copy(dayState.colors.bird)
    material.opacity = 1 - dayState.dusk * 0.75

    for (let i = 0; i < configs.length; i++) {
      const b = configs[i]
      const g = groups.current[i]
      if (!g) continue

      // advance the flap/glide state machine
      b.modeLeft -= delta
      if (b.modeLeft <= 0) {
        if (b.mode === 'flap') {
          b.mode = 'glide'
          b.modeLeft = 2 + b.seed() * 3
        } else {
          b.mode = 'flap'
          b.modeLeft = 1.5 + b.seed() * 1.5
        }
      }

      const u = (t / b.duration + b.tOffset) % 1
      b.curve.getPointAt(u, scratch.pos)
      scratch.pos.add(b.lateral)
      // effort moves altitude: climb while flapping, sink on the glide
      scratch.pos.y += b.mode === 'flap' ? Math.min(1, 2 - b.modeLeft) * 0.5 : -0.3
      b.curve.getTangentAt(u, scratch.tan)
      scratch.ahead.copy(scratch.pos).add(scratch.tan)
      g.position.copy(scratch.pos)
      g.lookAt(scratch.ahead)
      g.scale.setScalar(b.scale)

      let wing
      if (b.mode === 'flap') {
        const s = Math.sin(t * b.flapHz * Math.PI * 2 + b.phase)
        wing = s * 0.7 - 0.12 // downstroke digs deeper
      } else {
        wing = 0.2 + Math.sin(t * 0.32 * Math.PI * 2 + b.phase) * 0.06 // shallow V, lazy rock
      }
      const wl = wingsL.current[i]
      const wr = wingsR.current[i]
      if (wl) wl.rotation.z = wing
      if (wr) wr.rotation.z = -wing
    }
  })

  const setRef = (arr, i) => (ref) => {
    arr.current[i] = ref
  }

  return (
    <group>
      {configs.map((b, i) => (
        <group key={i} ref={setRef(groups, i)}>
          <mesh position={[0, 0, 0]} scale={[0.16, 0.1, 0.5]} material={material}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
          <group ref={setRef(wingsL, i)}>
            <mesh geometry={wingGeoL} rotation={[0, 0.22, 0]} material={material} />
          </group>
          <group ref={setRef(wingsR, i)}>
            <mesh geometry={wingGeoR} rotation={[0, -0.22, 0]} material={material} />
          </group>
        </group>
      ))}
    </group>
  )
}
