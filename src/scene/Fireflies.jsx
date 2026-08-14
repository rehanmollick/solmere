import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'
import { mulberry } from './paintUtils.js'

// Little warm lights that only believe in the blue hour.

const FireflyMat = shaderMaterial(
  { uTime: 0, uDusk: 0, uColor: new THREE.Color('#ffc37a') },
  /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    p.x += sin(uTime * 0.31 + aSeed * 17.0) * 0.7;
    p.y += sin(uTime * 0.43 + aSeed * 29.0) * 0.4;
    p.z += cos(uTime * 0.27 + aSeed * 11.0) * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (34.0 + aSeed * 26.0) / max(1.0, -mv.z);
  }
  `,
  /* glsl */ `
  uniform float uTime;
  uniform float uDusk;
  uniform vec3 uColor;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float body = smoothstep(1.0, 0.15, d);
    float pulse = 0.35 + 0.65 * smoothstep(0.2, 0.9, 0.5 + 0.5 * sin(uTime * (0.8 + vSeed) + vSeed * 40.0));
    float a = body * pulse * uDusk;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
  `
)

extend({ FireflyMat })

export default function Fireflies() {
  const mat = useRef()

  const { positions, seeds } = useMemo(() => {
    const rand = mulberry(881)
    const count = 46
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // most drift over the dune grass, a few stray over the shallows
      const overWater = rand() > 0.75
      positions[i * 3] = overWater ? rand() * 14 - 4 : -8 + rand() * 10
      positions[i * 3 + 1] = 1.6 + rand() * 2.4
      positions[i * 3 + 2] = overWater ? -2 - rand() * 10 : 3.5 + rand() * 5
      seeds[i] = rand()
    }
    return { positions, seeds }
  }, [])

  useFrame((state) => {
    if (!mat.current) return
    mat.current.uTime = state.clock.elapsedTime
    mat.current.uDusk = dayState.dusk
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <fireflyMat
        ref={mat}
        key={FireflyMat.key}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </points>
  )
}
