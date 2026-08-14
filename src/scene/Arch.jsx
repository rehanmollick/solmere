import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'
import { ARCH_POS } from './layout.js'
import {
  makeNoise2,
  fbm2,
  makeBushTexture,
  makeVineTexture,
  makeFlowerTexture,
} from './paintUtils.js'

const RockMat = shaderMaterial(
  {
    uLit: new THREE.Color('#B5988A'),
    uShadow: new THREE.Color('#7C6B72'),
    uMoss: new THREE.Color('#8AA47A'),
    uRim: new THREE.Color('#FBD9A0'),
    uHaze: new THREE.Color('#E8D5C0'),
    uSunDir: new THREE.Vector3(0, 0.4, -1),
    uGolden: 0,
  },
  /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  /* glsl */ `
  uniform vec3 uLit;
  uniform vec3 uShadow;
  uniform vec3 uMoss;
  uniform vec3 uRim;
  uniform vec3 uHaze;
  uniform vec3 uSunDir;
  uniform float uGolden;

  varying vec3 vWorldPos;
  varying vec3 vNormal;

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
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = p * 2.13 + vec2(7.7, 3.1);
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 P = vWorldPos;
    // paint in facets: flat planes from screen derivatives, softened by the smooth normal
    vec3 facetN = normalize(cross(dFdx(P), dFdy(P)));
    vec3 N = normalize(mix(facetN, normalize(vNormal), 0.35));
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - P);

    // three tones of poster paint
    float light = dot(N, L) * 0.5 + 0.5;
    float band = smoothstep(0.3, 0.46, light) * 0.62 + smoothstep(0.54, 0.72, light) * 0.38;
    vec3 col = mix(uShadow, uLit, band);

    // strata: sideways brush pulls following the rock's grain
    float strata = fbm(vec2(P.y * 0.32, P.x * 0.05 + P.z * 0.05));
    col *= 1.0 + (strata - 0.5) * 0.2;

    // fine chatter of the dry brush
    float chatter = fbm(P.xy * 0.9 + P.z * 0.4);
    col *= 1.0 + (chatter - 0.5) * 0.1;

    // moss holds on wherever the rock lies flat enough
    float mossMask = smoothstep(0.35, 0.7, N.y)
      * smoothstep(0.4, 0.75, fbm(P.xz * 0.25 + vec2(P.y * 0.18, 3.7)))
      * smoothstep(3.0, 10.0, P.y);
    col = mix(col, uMoss, mossMask * 0.85);

    // lichen: soft colonies of sage and rust drifting across the faces
    float lichen = smoothstep(0.6, 0.82, fbm(P.xy * 0.5 + P.z * 0.3 + 13.0))
      * smoothstep(0.72, 0.45, fbm(P.xy * 1.7 + 31.0));
    vec3 lichenCol = mix(vec3(0.71, 0.76, 0.6), vec3(0.85, 0.6, 0.42),
      smoothstep(0.45, 0.55, fbm(P.xy * 0.16 + 91.0)));
    col = mix(col, lichenCol * (0.6 + 0.4 * band), lichen * 0.28);

    // the sea keeps the feet of the rock dark
    col *= 1.0 - smoothstep(2.2, -0.5, P.y) * 0.22;

    // backlit rim, strongest when the light threads the keyhole
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6) * clamp(dot(N, L) + 0.4, 0.0, 1.0);
    col += uRim * rim * (0.16 + uGolden * 0.55);

    // breathe into the haze with distance
    float d = length(P - cameraPosition);
    col = mix(col, uHaze, clamp((d - 70.0) / 300.0, 0.0, 1.0) * 0.75);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
  `
)

extend({ RockMat })

const GlowMat = shaderMaterial(
  { uColor: new THREE.Color('#7FE9C3'), uAmount: 0 },
  /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  /* glsl */ `
  uniform vec3 uColor;
  uniform float uAmount;
  varying vec2 vUv;
  void main() {
    vec2 d = (vUv - vec2(0.5, 0.42)) * vec2(2.4, 1.6);
    float fall = exp(-dot(d, d) * 2.2);
    gl_FragColor = vec4(uColor, fall * uAmount);
  }
  `
)

extend({ GlowMat })

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
  [-7.5, 29.5, 10, 4.4],
  [8.5, 29.8, 10, 4.2],
  [-11, 24.5, 9.5, 3.8],
  [11.5, 24, 9.5, 3.6],
  [-13.5, 18.5, 9, 3.2],
  [14, 18, 9, 3.0],
  [-15, 11.5, 8.5, 2.8],
  [15.5, 11, 8.5, 2.6],
  [2, 30.5, 11, 3.4],
]

const VINE_SPOTS = [
  // [x, topY, z, width, height] — one trails over the keyhole's brow
  [0, 21.5, 8.5, 9, 10],
  [-9, 27.5, 9, 7, 11],
  [7.5, 28.5, 9, 6, 9],
  [13, 21, 8.5, 5, 8],
]

const FLOWER_SPOTS = [
  [-3, 33.5, 11, 4.2],
  [1.5, 36.2, 10.5, 4.6],
  [-11.5, 25, 10, 3.0],
  [9, 30.2, 10.5, 3.2],
]

export default function Arch() {
  const bushMats = useRef([])
  const shaftA = useRef()
  const shaftB = useRef()
  const glowMat = useRef()

  const archGeo = useMemo(buildArchGeometry, [])
  const isletGeoA = useMemo(() => buildIsletGeometry(55, 0.62), [])
  const isletGeoB = useMemo(() => buildIsletGeometry(89, 0.5), [])
  const bushTexture = useMemo(() => makeBushTexture(31), [])
  const vineTexture = useMemo(() => makeVineTexture(17), [])
  const flowerTexture = useMemo(() => makeFlowerTexture(43), [])
  const rockMat = useMemo(() => new RockMat(), [])
  const mossScratch = useMemo(() => new THREE.Color(), [])
  const vineMats = useRef([])
  const flowerMats = useRef([])

  const shaftPose = useMemo(() => {
    // steep enough that the camera sees the shaft side-on, never down its throat
    const dir = new THREE.Vector3(-7, -13, 9).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate())
    const mid = new THREE.Vector3(0, 11.5, 0).addScaledVector(dir, 10)
    return { quat, mid }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    rockMat.uniforms.uLit.value.copy(dayState.colors.rockLit)
    rockMat.uniforms.uShadow.value.copy(dayState.colors.rockShadow)
    mossScratch.copy(dayState.colors.grassLit).lerp(dayState.colors.rockShadow, 0.25)
    rockMat.uniforms.uMoss.value.copy(mossScratch)
    rockMat.uniforms.uRim.value.copy(dayState.colors.sunHalo)
    rockMat.uniforms.uHaze.value.copy(dayState.colors.hazeColor)
    rockMat.uniforms.uSunDir.value.copy(dayState.sunDir)
    rockMat.uGolden = dayState.golden
    for (const bm of bushMats.current) {
      if (bm) bm.color.copy(dayState.colors.grassLit).lerp(dayState.colors.rockShadow, 0.22)
    }
    for (const vm of vineMats.current) {
      if (vm) vm.color.copy(dayState.colors.grassLit).lerp(dayState.colors.rockShadow, 0.32)
    }
    for (const fm of flowerMats.current) {
      if (fm) {
        fm.color.set('#F2A0B4').lerp(dayState.colors.rockShadow, dayState.dusk * 0.55)
        fm.opacity = 0.95 - dayState.dusk * 0.25
      }
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
      glowMat.current.uniforms.uColor.value.copy(dayState.colors.lanternGlow)
      glowMat.current.uAmount = dayState.caveGlow * (0.25 + dayState.dusk * 0.65)
    }
  })

  const setBushMat = (i) => (ref) => {
    bushMats.current[i] = ref
  }

  return (
    <group position={ARCH_POS} rotation={[0, -0.22, 0]}>
      <mesh geometry={archGeo}>
        <primitive object={rockMat} attach="material" />
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

      {/* vines trailing off the ledges and over the keyhole's brow */}
      {VINE_SPOTS.map(([x, topY, z, w, h], i) => (
        <mesh key={`v${i}`} position={[x, topY - h / 2, z]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial
            ref={(ref) => {
              vineMats.current[i] = ref
            }}
            map={vineTexture}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            fog={false}
          />
        </mesh>
      ))}

      {/* blossoms scattered through the green */}
      {FLOWER_SPOTS.map(([x, y, z, s], i) => (
        <sprite key={`f${i}`} position={[x, y, z]} scale={[s, s, 1]}>
          <spriteMaterial
            ref={(ref) => {
              flowerMats.current[i] = ref
            }}
            map={flowerTexture}
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
        <planeGeometry args={[7.5, 10]} />
        <glowMat
          ref={glowMat}
          key={GlowMat.key}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      {/* Far islets balancing the composition */}
      <mesh geometry={isletGeoA} position={[-74, -1.5, -48]} scale={[15, 9, 11]}>
        <primitive object={rockMat} attach="material" />
      </mesh>
      <mesh geometry={isletGeoB} position={[54, -1.5, -46]} scale={[19, 10, 13]}>
        <primitive object={rockMat} attach="material" />
      </mesh>
    </group>
  )
}
