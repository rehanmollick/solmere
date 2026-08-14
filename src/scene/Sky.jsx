import * as THREE from 'three'
import { useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { dayState } from './day.js'

const SkyMat = shaderMaterial(
  {
    uTime: 0,
    uZenith: new THREE.Color('#82A7C7'),
    uMid: new THREE.Color('#b9cdd3'),
    uLow: new THREE.Color('#ecd4b8'),
    uHorizon: new THREE.Color('#F6D9B8'),
    uSunDir: new THREE.Vector3(0, 0.3, -1),
    uSunCore: new THREE.Color('#FFF3D6'),
    uSunHalo: new THREE.Color('#FBD9A0'),
    uSunSize: 0.042,
    uStarColor: new THREE.Color('#FFF4D9'),
    uStars: 0,
  },
  /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    clip.z = clip.w * 0.99999;
    gl_Position = clip;
  }
  `,
  /* glsl */ `
  uniform float uTime;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uLow;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunCore;
  uniform vec3 uSunHalo;
  uniform float uSunSize;
  uniform vec3 uStarColor;
  uniform float uStars;

  varying vec3 vWorldPos;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm2(vec2 p) {
    return 0.667 * vnoise(p) + 0.333 * vnoise(p * 2.31 + vec2(5.2, 1.3));
  }

  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    float y = clamp(dir.y, -0.05, 1.0);

    // Four pigment stops, blended wet-into-wet
    vec3 col = uHorizon;
    col = mix(col, uLow, smoothstep(0.00, 0.15, y));
    col = mix(col, uMid, smoothstep(0.12, 0.42, y));
    col = mix(col, uZenith, smoothstep(0.38, 0.85, y));

    // A whisper of stepped banding so the gradient reads brush-mixed
    float band = smoothstep(-0.05, 0.9, y);
    float stepped = floor(band * 26.0) / 26.0;
    col = mix(col, mix(uHorizon, uZenith, stepped), 0.10);

    // Uneven pigment on wet paper
    vec2 suv = vec2(atan(dir.x, dir.z) * 2.0, dir.y * 3.0);
    col *= 1.0 + (fbm2(suv * 1.5) - 0.5) * 0.07;

    // Sun disc and a warm double halo
    float ang = acos(clamp(dot(dir, normalize(uSunDir)), -1.0, 1.0));
    float disc = smoothstep(uSunSize, uSunSize * 0.55, ang);
    float halo = exp(-ang * 5.5) * 0.5 + exp(-ang * 18.0) * 0.35;
    col = mix(col, uSunCore, disc);
    col += uSunHalo * halo;

    // Stars: still points in a slow sky, only after the gold lets go
    if (uStars > 0.001) {
      vec3 cell = dir * 78.0;
      vec3 base = floor(cell);
      float star = 0.0;
      float h = hash13(base);
      if (h > 0.82) {
        vec3 centerOffset = fract(vec3(h * 7.13, h * 3.71, h * 9.53)) - 0.5;
        float d = length(fract(cell) - 0.5 - centerOffset * 0.6);
        float tw = 0.72 + 0.28 * sin(uTime * (0.6 + h * 1.4) + h * 40.0);
        star = smoothstep(0.16, 0.02, d) * tw;
      }
      float horizonFade = smoothstep(0.04, 0.32, dir.y);
      col += uStarColor * star * uStars * horizonFade;
    }

    // Grain doubles as dither so the gradient never bands
    float g = hash12(gl_FragCoord.xy);
    col += (g - 0.5) * 0.018;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
  `
)

extend({ SkyMat })

export default function Sky() {
  const mat = useRef()
  const mesh = useRef()

  useFrame((state) => {
    const m = mat.current
    if (!m) return
    m.uTime = state.clock.elapsedTime
    m.uniforms.uZenith.value.copy(dayState.colors.skyZenith)
    m.uniforms.uMid.value.copy(dayState.skyMid)
    m.uniforms.uLow.value.copy(dayState.skyLow)
    m.uniforms.uHorizon.value.copy(dayState.colors.skyHorizon)
    m.uniforms.uSunCore.value.copy(dayState.colors.sunCore)
    m.uniforms.uSunHalo.value.copy(dayState.colors.sunHalo)
    m.uniforms.uStarColor.value.copy(dayState.colors.starColor)
    m.uniforms.uSunDir.value.copy(dayState.sunDir)
    m.uStars = dayState.stars
    mesh.current.position.copy(state.camera.position)
  })

  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 48, 32]} />
      <skyMat ref={mat} key={SkyMat.key} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}
