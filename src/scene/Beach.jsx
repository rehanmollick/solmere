import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'
import { SHORELINE_Z } from './layout.js'
import { makeNoise2, fbm2, makeGrassTexture } from './paintUtils.js'

// One deterministic dune field, shared with anything that stands on the sand
const sandNoise = makeNoise2(41)
export function sandHeightAt(x, z) {
  const rise = z - SHORELINE_Z
  let y = rise > 0 ? rise * 0.24 : rise * 0.1
  const duneMask = Math.min(1, Math.max(0, (rise - 2) / 8))
  y += fbm2(sandNoise, x * 0.05, z * 0.05, 3) * 0.9 * duneMask
  return y
}

const SandMat = shaderMaterial(
  {
    uTime: 0,
    uSandLit: new THREE.Color('#EAD3AC'),
    uSandShadow: new THREE.Color('#BFA291'),
    uWetTint: new THREE.Color('#F6D9B8'),
    uHaze: new THREE.Color('#E8D5C0'),
    uShorelineZ: SHORELINE_Z,
    uGlint: 0.15,
  },
  /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  /* glsl */ `
  uniform float uTime;
  uniform vec3 uSandLit;
  uniform vec3 uSandShadow;
  uniform vec3 uWetTint;
  uniform vec3 uHaze;
  uniform float uShorelineZ;
  uniform float uGlint;

  varying vec3 vWorldPos;

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
    for (int i = 0; i < 3; i++) {
      s += a * vnoise(p);
      p = p * 2.13 + vec2(7.7, 3.1);
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 P = vWorldPos;

    // Warm mottled sand, big soft patches over fine tooth
    float patchy = fbm(P.xz * 0.10);
    float tooth = fbm(P.xz * 1.9);
    float mixv = clamp(patchy * 0.72 + tooth * 0.28 + 0.16, 0.0, 1.0);
    vec3 col = mix(uSandShadow, uSandLit, mixv);

    // stray pigment: rose pooled in some hollows, cool mauve in others,
    // the way a painter lets the underlayer bleed through
    vec3 rose = uSandLit * vec3(1.04, 0.86, 0.8);
    vec3 mauve = mix(uSandShadow, uWetTint, 0.45) * vec3(0.94, 0.9, 1.06);
    float rosePatch = fbm(P.xz * 0.07 + vec2(31.0, 7.0));
    float mauvePatch = fbm(P.xz * 0.09 + vec2(3.0, 53.0));
    col = mix(col, rose, smoothstep(0.58, 0.85, rosePatch) * 0.3);
    col = mix(col, mauve, smoothstep(0.62, 0.88, mauvePatch) * 0.26);

    // rake of the wind: two directions of long shallow strokes
    float rake = fbm(vec2(P.x * 0.3, P.z * 1.6));
    float rakeB = fbm(vec2(P.x * 0.7 + P.z * 0.2, P.z * 2.8 + 17.0));
    col *= 1.0 + (rake - 0.5) * 0.16 + (rakeB - 0.5) * 0.08;

    // the paper ground surfacing where the sand wash ran dry
    float thin = fbm(P.xz * 0.42 + 91.0);
    col = mix(col, uWetTint * 0.92, smoothstep(0.7, 0.9, thin) * 0.13);

    // the pepper and the mica: dark grains and bright ones
    float fleck = hash12(floor(P.xz * 9.0) + 4.7);
    col *= 1.0 - step(0.978, fleck) * 0.16;
    float mica = hash12(floor(P.xz * 16.0) + 9.1);
    col += vec3(1.0, 0.96, 0.85) * step(0.988, mica) * 0.12;

    // broken shells the tide ground down: rose and seafoam chips up close
    float nearField = smoothstep(42.0, 10.0, length(P - cameraPosition));
    float chip = hash12(floor(P.xz * 5.0) + 77.0);
    vec2 chipUv = fract(P.xz * 5.0) - 0.5;
    float chipShape = smoothstep(0.3, 0.16, length(chipUv + (fbm(P.xz * 3.0) - 0.5) * 0.3));
    vec3 chipCol = mix(vec3(0.93, 0.68, 0.64), vec3(0.64, 0.82, 0.77),
      step(0.5, hash12(floor(P.xz * 5.0) + 123.0)));
    col = mix(col, chipCol, step(0.955, chip) * chipShape * 0.6 * nearField);

    // the whole beach holds a little more light than it should
    col *= 1.045;

    // The tide's reach: a wet band that breathes near the waterline
    float waver = sin(P.x * 0.075) * 1.8 + sin(P.x * 0.028 + 2.0) * 1.4;
    float tide = sin(uTime * 0.35) * 0.7 + sin(uTime * 0.13 + 2.0) * 0.4;
    float wetEdge = uShorelineZ + waver + 2.4 + tide + (fbm(P.xz * 0.3) - 0.5) * 1.6;
    float wet = 1.0 - smoothstep(wetEdge - 2.0, wetEdge + 0.4, P.z);
    vec3 wetCol = col * 0.78 + uWetTint * 0.10;
    col = mix(col, wetCol, wet * 0.9);

    // Scattered bright grains catching the sun
    float g = hash12(floor(P.xz * 14.0));
    float glint = step(0.992, g) * smoothstep(30.0, 8.0, length(P - cameraPosition));
    col += vec3(1.0, 0.95, 0.8) * glint * uGlint;

    // Slight settle into haze toward the edges of the cove
    float d = length(P.xz - cameraPosition.xz);
    col = mix(col, uHaze, smoothstep(40.0, 130.0, d) * 0.6);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
  `
)

extend({ SandMat })

function GrassTuft({ position, scale, phase, texture, matRef }) {
  const mesh = useRef()
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.7 + phase) * 0.045
    }
  })
  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent
        alphaTest={0.3}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function Beach() {
  const mat = useRef()
  const grassMats = useRef([])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(260, 44, 120, 60)
    g.rotateX(-Math.PI / 2)
    const meshZ = SHORELINE_Z + 16 // must match the mesh position below
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, sandHeightAt(pos.getX(i), pos.getZ(i) + meshZ))
    }
    g.computeVertexNormals()
    return g
  }, [])

  const grassTextures = useMemo(() => [makeGrassTexture(7), makeGrassTexture(23)], [])

  useFrame((state) => {
    const m = mat.current
    if (m) {
      m.uTime = state.clock.elapsedTime
      m.uniforms.uSandLit.value.copy(dayState.colors.sandLit)
      m.uniforms.uSandShadow.value.copy(dayState.colors.sandShadow)
      m.uniforms.uWetTint.value.copy(dayState.colors.skyHorizon)
      m.uniforms.uHaze.value.copy(dayState.colors.hazeColor)
      m.uGlint = 0.12 + dayState.golden * 0.3
    }
    for (const gm of grassMats.current) {
      if (gm) gm.color.copy(dayState.colors.grassLit).lerp(dayState.colors.sandLit, 0.28)
    }
  })

  const setGrassMat = (i) => (ref) => {
    grassMats.current[i] = ref
  }

  return (
    <group>
      <mesh geometry={geometry} position={[0, 0, SHORELINE_Z + 16]}>
        <sandMat ref={mat} key={SandMat.key} fog={false} />
      </mesh>
      <GrassTuft
        position={[-3.4, 1.55, 6.2]}
        scale={[2.4, 2.1, 1]}
        phase={0}
        texture={grassTextures[0]}
        matRef={setGrassMat(0)}
      />
      <GrassTuft
        position={[-5.2, 1.85, 7.4]}
        scale={[3.1, 2.7, 1]}
        phase={1.7}
        texture={grassTextures[1]}
        matRef={setGrassMat(1)}
      />
      <GrassTuft
        position={[-8.5, 1.5, 6.8]}
        scale={[2.2, 2.0, 1]}
        phase={3.1}
        texture={grassTextures[0]}
        matRef={setGrassMat(2)}
      />
    </group>
  )
}
