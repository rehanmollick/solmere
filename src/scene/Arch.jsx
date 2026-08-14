import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'
import { ARCH_POS } from './layout.js'
import { makeNoise2, fbm2, makeBushTexture, getToonRamp } from './paintUtils.js'

const ShaftMat = shaderMaterial(
  {
    uColor: new THREE.Color(1.0, 0.86, 0.58),
    uIntensity: 0.0,
    uTime: 0,
  },
  /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec3 V = normalize(cameraPosition - vWorldPos);
    float core = pow(abs(dot(V, normalize(vWorldNormal))), 1.6);
    float ends = smoothstep(0.0, 0.20, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
    float shimmer = 0.70 + 0.30 * vnoise(vec2(vUv.x * 7.0, vUv.y * 2.5 + uTime * 0.12));
    float streaks = 0.80 + 0.20 * vnoise(vec2(vUv.x * 18.0, vUv.y * 1.0));
    float a = core * ends * shimmer * streaks * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
  `
)

extend({ ShaftMat })

function buildArchGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-16, -2)
  shape.splineThru([
    new THREE.Vector2(-14.8, 8),
    new THREE.Vector2(-11.2, 18),
    new THREE.Vector2(-6.5, 28),
    new THREE.Vector2(-1, 35.5),
    new THREE.Vector2(4.5, 33.5),
    new THREE.Vector2(9.5, 27),
    new THREE.Vector2(13, 17.5),
    new THREE.Vector2(15.2, 8),
    new THREE.Vector2(15.8, -2),
  ])
  shape.lineTo(-16, -2)

  // The keyhole: a circle for the light, a flared slot down to the water
  const C = new THREE.Vector2(0, 13.5)
  const R = 5.0
  const slotHalf = 3.1
  const joinY = 9.4
  const joinX = 2.3
  const aL = Math.atan2(joinY - C.y, -joinX - C.x)
  const aR = Math.atan2(joinY - C.y, joinX - C.x)
  // the slot must stay strictly inside the outline or the cut collapses
  const hole = new THREE.Path()
  hole.moveTo(-slotHalf, -1.5)
  hole.lineTo(-joinX, joinY)
  hole.absarc(C.x, C.y, R, aL, aR, true)
  hole.lineTo(slotHalf, -1.5)
  hole.lineTo(-slotHalf, -1.5)
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 12,
    curveSegments: 28,
    steps: 3,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 1.9,
    bevelSegments: 5,
  })
  geo.translate(0, 0, -6)
  geo.computeVertexNormals()

  // Sculpt: displace along normals, but keep the keyhole rim readable
  const noise = makeNoise2(1207)
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i)
    const dCircle = Math.abs(Math.hypot(v.x - C.x, v.y - C.y) - R)
    const dSlot = v.y <= 11 && v.y >= -3 ? Math.abs(Math.abs(v.x) - slotHalf) : 999
    const dHole = Math.min(dCircle, dSlot)
    const rimMask = THREE.MathUtils.smoothstep(dHole, 1.3, 5.5)
    const rough =
      fbm2(noise, v.x * 0.09 + v.z * 0.05, v.y * 0.09, 3) * 2.5 +
      fbm2(noise, v.x * 0.35, v.y * 0.35 + v.z * 0.2, 2) * 0.7
    v.addScaledVector(n, rough * rimMask)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

function buildIsletGeometry(seed, squash) {
  const geo = new THREE.SphereGeometry(1, 32, 20)
  const noise = makeNoise2(seed)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = 1 + fbm2(noise, v.x * 1.6 + 3, v.y * 1.6 + v.z, 3) * 0.42
    v.multiplyScalar(r)
    v.y *= squash
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

const BUSH_SPOTS = [
  [-3.5, 33, 10.5, 5.6],
  [0.5, 35.8, 10, 6.4],
  [4.5, 33.2, 10.5, 5.0],
]

export default function Arch() {
  const rockMat = useRef()
  const isletMatA = useRef()
  const isletMatB = useRef()
  const bushMats = useRef([])
  const shaftA = useRef()
  const shaftB = useRef()
  const glowMat = useRef()

  const archGeo = useMemo(buildArchGeometry, [])
  const isletGeoA = useMemo(() => buildIsletGeometry(55, 0.62), [])
  const isletGeoB = useMemo(() => buildIsletGeometry(89, 0.5), [])
  const bushTexture = useMemo(() => makeBushTexture(31), [])
  const ramp = getToonRamp()

  const shaftPose = useMemo(() => {
    // steep enough that the camera sees the shaft side-on, never down its throat
    const dir = new THREE.Vector3(-7, -13, 9).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate())
    const mid = new THREE.Vector3(0, 11.5, 0).addScaledVector(dir, 10)
    return { quat, mid }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (rockMat.current) rockMat.current.color.copy(dayState.colors.rockLit)
    if (isletMatA.current) isletMatA.current.color.copy(dayState.colors.rockLit)
    if (isletMatB.current) isletMatB.current.color.copy(dayState.colors.rockShadow)
    for (const bm of bushMats.current) {
      if (bm) bm.color.copy(dayState.colors.grassLit).lerp(dayState.colors.rockShadow, 0.3)
    }
    const intensity = dayState.golden * 0.42
    for (const s of [shaftA.current, shaftB.current]) {
      if (s) {
        s.uIntensity = intensity
        s.uTime = t
        s.uniforms.uColor.value.copy(dayState.colors.sunHalo)
      }
    }
    if (glowMat.current) {
      glowMat.current.color.copy(dayState.colors.lanternGlow)
      glowMat.current.opacity = dayState.caveGlow * (0.2 + dayState.dusk * 0.6)
    }
  })

  const setBushMat = (i) => (ref) => {
    bushMats.current[i] = ref
  }

  return (
    <group position={ARCH_POS} rotation={[0, -0.22, 0]}>
      <mesh geometry={archGeo}>
        <meshToonMaterial ref={rockMat} gradientMap={ramp} flatShading />
      </mesh>

      {BUSH_SPOTS.map(([x, y, z, s], i) => (
        <sprite key={i} position={[x, y, z]} scale={[s, s * 0.72, 1]}>
          <spriteMaterial
            ref={setBushMat(i)}
            map={bushTexture}
            transparent
            depthWrite={false}
          />
        </sprite>
      ))}

      {/* Light through the keyhole at golden hour */}
      <mesh ref={(m) => m && m.quaternion.copy(shaftPose.quat)} position={shaftPose.mid} renderOrder={10}>
        <cylinderGeometry args={[1.0, 3.4, 26, 24, 1, true]} />
        <shaftMat
          ref={shaftA}
          key={ShaftMat.key}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh
        ref={(m) => m && m.quaternion.copy(shaftPose.quat)}
        position={[shaftPose.mid.x + 1.5, shaftPose.mid.y + 1, shaftPose.mid.z]}
        renderOrder={10}
      >
        <cylinderGeometry args={[0.45, 1.6, 30, 18, 1, true]} />
        <shaftMat
          ref={shaftB}
          key={ShaftMat.key}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      {/* Some patient light the water makes on its own */}
      <mesh position={[0, 3.2, 0]} renderOrder={9}>
        <planeGeometry args={[4.6, 7]} />
        <meshBasicMaterial
          ref={glowMat}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      {/* Far islets balancing the composition */}
      <mesh geometry={isletGeoA} position={[-74, -1.5, -48]} scale={[15, 9, 11]}>
        <meshToonMaterial ref={isletMatA} gradientMap={ramp} flatShading />
      </mesh>
      <mesh geometry={isletGeoB} position={[54, -1.5, -46]} scale={[19, 10, 13]}>
        <meshToonMaterial ref={isletMatB} gradientMap={ramp} flatShading />
      </mesh>
    </group>
  )
}
