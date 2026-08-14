import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'
import { SHORELINE_Z } from './layout.js'

const OceanMat = shaderMaterial(
  {
    uTime: 0,
    uSwellAmp: 0.55,
    uDeep: new THREE.Color('#3F7590'),
    uShallow: new THREE.Color('#8FC5C4'),
    uFoam: new THREE.Color('#F7EFE2'),
    uHaze: new THREE.Color('#E8D5C0'),
    uSparkleColor: new THREE.Color('#FBE9C8'),
    uSunDir: new THREE.Vector3(0.2, 0.3, -1),
    uShorelineZ: SHORELINE_Z,
    uGlitter: 0.4,
  },
  /* glsl */ `
  uniform float uTime;
  uniform float uSwellAmp;

  varying vec3 vWorldPos;
  varying float vSwell;

  float swell(vec2 p, float t) {
    float h = 0.0;
    h += 0.50 * sin(dot(p, vec2( 0.16, 0.07)) + t * 0.90);
    h += 0.26 * sin(dot(p, vec2(-0.11, 0.21)) + t * 0.68 + 1.7);
    h += 0.15 * sin(dot(p, vec2( 0.34, 0.27)) + t * 1.24 + 4.2);
    h += 0.09 * sin(dot(p, vec2(-0.53, 0.41)) + t * 1.71 + 2.3);
    return h;
  }

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = swell(wp.xz, uTime) * uSwellAmp;
    // waves settle as they reach the sand
    float shoreCalm = smoothstep(2.0, 26.0, abs(wp.z - ${SHORELINE_Z.toFixed(1)}));
    wp.y += h * mix(0.35, 1.0, shoreCalm);
    vSwell = h / max(uSwellAmp, 1e-4);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
  `,
  /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uHaze;
  uniform vec3 uSparkleColor;
  uniform vec3 uSunDir;
  uniform float uShorelineZ;
  uniform float uGlitter;

  varying vec3 vWorldPos;
  varying float vSwell;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
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
  float sparkle(vec2 p, float t) {
    vec2 ip = floor(p), fp = fract(p);
    float dmin = 8.0, tw = 0.0;
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(ip + g);
      vec2 pt = g + 0.5 + 0.35 * sin(t * 0.7 + 6.2831 * o) - fp;
      float d = dot(pt, pt);
      if (d < dmin) { dmin = d; tw = o.x; }
    }
    float d = sqrt(dmin);
    float pin = smoothstep(0.10, 0.02, d);
    float blink = smoothstep(0.35, 0.95, 0.5 + 0.5 * sin(t * (1.5 + tw * 3.0) + tw * 6.2831));
    return pin * blink;
  }
  float steppedRamp(float x, float steps, float soft) {
    float s = x * steps;
    return clamp((floor(s) + smoothstep(0.5 - soft, 0.5 + soft, fract(s))) / steps, 0.0, 1.0);
  }

  void main() {
    vec3 P = vWorldPos;
    float t = uTime;

    // Shallow green gives up, the blue takes over: banded ramp offshore
    float shoreDist = abs(P.z - uShorelineZ);
    float depth01 = clamp(shoreDist / 150.0, 0.0, 1.0);
    depth01 = clamp(depth01 + (fbm(P.xz * 0.045) - 0.5) * 0.22, 0.0, 1.0);
    vec3 col = mix(uShallow, uDeep, steppedRamp(depth01, 5.0, 0.10));

    // Horizontal brush streaks
    float streak = 0.6 * fbm(vec2(P.x * 0.06 + t * 0.03, P.z * 0.70))
                 + 0.4 * fbm(vec2(P.x * 0.11 - t * 0.02, P.z * 1.30));
    col *= 1.0 + (streak - 0.5) * 0.16;

    // Lighter swell crests
    col *= 1.0 + vSwell * 0.06;

    // Sun glitter lane
    vec3 toFrag = P - cameraPosition;
    float camDist = length(toFrag);
    float lane = pow(max(dot(normalize(toFrag.xz), normalize(uSunDir.xz)), 0.0), 6.0);
    float sp = sparkle(P.xz * 0.9, t) * smoothstep(190.0, 40.0, camDist);
    col += uSparkleColor * sp * (0.1 + 1.3 * lane) * uGlitter;

    // Foam: rings crawling shoreward plus a lacy solid edge
    float foamN = fbm(P.xz * 0.5 + vec2(0.0, t * 0.06));
    float ring = sin(shoreDist * 0.9 - t * 1.2 + foamN * 3.0);
    float ringMask = smoothstep(7.5, 0.0, shoreDist);
    float foam = smoothstep(0.3, 0.55, ring * ringMask);
    float edge = smoothstep(0.9, 0.0, shoreDist + (foamN - 0.5) * 1.6);
    foam = smoothstep(0.40, 0.62, clamp(foam + edge, 0.0, 1.0));
    col = mix(col, uFoam, foam * 0.92);

    // Melt into the sky at the horizon
    float fogF = pow(smoothstep(120.0, 330.0, camDist), 1.3);
    col = mix(col, uHaze, fogF);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
  `
)

extend({ OceanMat })

export default function Ocean() {
  const mat = useRef()

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(640, 430, 200, 200)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  useFrame((state) => {
    const m = mat.current
    if (!m) return
    m.uTime = state.clock.elapsedTime
    m.uniforms.uDeep.value.copy(dayState.colors.oceanDeep)
    m.uniforms.uShallow.value.copy(dayState.colors.oceanShallow)
    m.uniforms.uFoam.value.copy(dayState.colors.foam)
    m.uniforms.uHaze.value.copy(dayState.colors.hazeColor)
    m.uniforms.uSparkleColor.value.copy(dayState.colors.oceanSparkle)
    m.uniforms.uSunDir.value.copy(dayState.sunDir)
    m.uGlitter = 0.35 + dayState.golden * 0.75
  })

  return (
    <mesh geometry={geometry} position={[0, 0, -180]}>
      <oceanMat ref={mat} key={OceanMat.key} fog={false} />
    </mesh>
  )
}
