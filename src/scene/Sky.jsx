import * as THREE from 'three'
import { useMemo, useRef } from 'react'
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
    uWashRose: new THREE.Color('#E8B4A8'),
    uWashGold: new THREE.Color('#F5D9A0'),
    uWashCyan: new THREE.Color('#9FD4E0'),
    uWashAmp: new THREE.Vector3(0.1, 0.12, 0.06),
    uLuminist: new THREE.Color('#F1EEDC'),
    uLuministAmt: 0.3,
    uRayColor: new THREE.Color('#FFF6E2'),
    uRays: 0,
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
  uniform vec3 uWashRose;
  uniform vec3 uWashGold;
  uniform vec3 uWashCyan;
  uniform vec3 uWashAmp;
  uniform vec3 uLuminist;
  uniform float uLuministAmt;
  uniform vec3 uRayColor;
  uniform float uRays;

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
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.03;
      a *= 0.5;
    }
    return v;
  }

  // Painted crepuscular fan: two angular sine combs beat into 5-9 unequal
  // soft wedges, broken by fbm sampled on the unit circle, screen-blended
  // so it glazes instead of clipping to laser white.
  float crepuscularFan(vec3 D, vec3 S, float time) {
    vec3 ref = (abs(S.y) > 0.98) ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 T = normalize(cross(ref, S));
    vec3 B = cross(S, T);
    float ang = atan(dot(D, B), dot(D, T));
    float dist = acos(clamp(dot(D, S), -1.0, 1.0));

    vec2 c = vec2(cos(ang), sin(ang));
    float t1 = time * 0.005;
    float t2 = time * 0.008;
    float comb =
        (0.55 + 0.45 * sin(ang * 4.0 + t1 * 6.2831)) *
        (0.55 + 0.45 * sin(ang * 7.0 - t2 * 6.2831 + 1.7));

    float grain = fbm(c * 2.6 + vec2(t1 * 0.7, -t2 * 0.5) + dist * vec2(1.3, 0.9));
    float body = comb * (0.45 + 0.85 * grain);

    float beams = smoothstep(0.18, 0.72, body);
    beams = pow(beams, 1.35);

    float inner = smoothstep(0.035, 0.16, dist);
    float outer = pow(clamp(1.0 - dist / 1.15, 0.0, 1.0), 2.2);
    float taper = mix(1.0, grain, smoothstep(0.25, 1.0, dist));
    float horizonFade = smoothstep(-0.02, 0.14, D.y);

    float fan = beams * inner * outer * taper * horizonFade;
    fan += (hash12(D.xy * 512.0 + D.z) - 0.5) * 0.015;
    return clamp(fan, 0.0, 1.0);
  }

  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    float y = clamp(dir.y, -0.05, 1.0);
    vec3 sunD = normalize(uSunDir);

    // Four pigment stops, blended wet-into-wet
    vec3 col = uHorizon;
    col = mix(col, uLow, smoothstep(0.00, 0.15, y));
    col = mix(col, uMid, smoothstep(0.12, 0.42, y));
    col = mix(col, uZenith, smoothstep(0.38, 0.85, y));

    // Stepped banding so the gradient reads brush-mixed
    float band = smoothstep(-0.05, 0.9, y);
    float stepped = floor(band * 22.0) / 22.0;
    col = mix(col, mix(uHorizon, uZenith, stepped), 0.14);

    // Uneven pigment on wet paper, rough enough to see
    vec2 suv = vec2(atan(dir.x, dir.z) * 2.0, dir.y * 3.0);
    col *= 1.0 + (fbm(suv * 1.5) - 0.5) * 0.13;
    col *= 1.0 + (fbm(suv * 5.2 + 9.0) - 0.5) * 0.05;

    // Wet-on-wet washes: one warped field, band-pass cut into three pools
    // that sit side by side; each accent pre-mixed toward the local sky so
    // full strength can never gray out.
    vec2 p = vec2(dir.x * 1.6 + dir.z * 0.4, dir.y * 2.2 + dir.z * 0.3);
    vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm(p + 1.6 * q + vec2(1.7, 9.2) + uTime * 0.004),
                  fbm(p + 1.6 * q + vec2(8.3, 2.8) - uTime * 0.003));
    float f = fbm(p + 1.6 * r);

    float h = clamp(dir.y, 0.0, 1.0);
    float mRose = (smoothstep(0.28, 0.42, f) - smoothstep(0.46, 0.60, f)) * smoothstep(0.45, 0.10, h);
    float mGold = (smoothstep(0.50, 0.62, f) - smoothstep(0.66, 0.78, f))
      * smoothstep(0.05, 0.25, h) * smoothstep(0.85, 0.45, h);
    float mCyan = smoothstep(0.70, 0.80, f) * smoothstep(0.35, 0.75, h);

    col = mix(col, mix(col, uWashRose, 0.65), mRose * uWashAmp.x);
    col = mix(col, mix(col, uWashGold, 0.65), mGold * uWashAmp.y);
    col = mix(col, mix(col, uWashCyan, 0.65), mCyan * uWashAmp.z);

    // Luminism: a narrow band of cream light hanging at the horizon,
    // strongest toward the sun. The lightest air in the whole painting.
    float azToSun = dot(normalize(dir.xz), normalize(sunD.xz)) * 0.5 + 0.5;
    float lumBand = smoothstep(0.15, 0.0, y);
    col = mix(col, uLuminist, lumBand * uLuministAmt * (0.55 + 0.45 * azToSun));

    // Grace: crepuscular wedges, screen-blended like a glaze
    if (uRays > 0.004) {
      float fan = crepuscularFan(dir, sunD, uTime);
      vec3 rayLight = uRayColor * (fan * 0.55 * uRays);
      col = 1.0 - (1.0 - col) * (1.0 - rayLight);
    }

    // Sun disc and a warm double halo
    float ang = acos(clamp(dot(dir, sunD), -1.0, 1.0));
    float disc = smoothstep(uSunSize, uSunSize * 0.55, ang);
    float halo = exp(-ang * 5.5) * 0.5 + exp(-ang * 18.0) * 0.35;
    col = mix(col, uSunCore, disc);
    col += uSunHalo * halo;

    // Stars: still points in a slow sky, only after the gold lets go
    if (uStars > 0.001) {
      vec3 cell = dir * 78.0;
      vec3 base = floor(cell);
      float star = 0.0;
      float hh = hash13(base);
      if (hh > 0.82) {
        vec3 centerOffset = fract(vec3(hh * 7.13, hh * 3.71, hh * 9.53)) - 0.5;
        float d = length(fract(cell) - 0.5 - centerOffset * 0.6);
        float tw = 0.72 + 0.28 * sin(uTime * (0.6 + hh * 1.4) + hh * 40.0);
        star = smoothstep(0.16, 0.02, d) * tw;
      }
      float hFade = smoothstep(0.04, 0.32, dir.y);
      col += uStarColor * star * uStars * hFade;
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
  const scratch = useMemo(() => new THREE.Color(), [])

  useFrame((state) => {
    const m = mat.current
    if (!m) return
    const c = dayState.colors
    m.uTime = state.clock.elapsedTime
    m.uniforms.uZenith.value.copy(c.skyZenith)
    m.uniforms.uMid.value.copy(dayState.skyMid)
    m.uniforms.uLow.value.copy(dayState.skyLow)
    m.uniforms.uHorizon.value.copy(c.skyHorizon)
    m.uniforms.uSunCore.value.copy(c.sunCore)
    m.uniforms.uSunHalo.value.copy(c.sunHalo)
    m.uniforms.uStarColor.value.copy(c.starColor)
    m.uniforms.uSunDir.value.copy(dayState.sunDir)
    m.uniforms.uWashRose.value.copy(c.washA)
    m.uniforms.uWashGold.value.copy(c.washB)
    m.uStars = dayState.stars

    // wash amplitudes by hour: felt at midday, blooming at golden hour
    const g = dayState.golden
    const md = dayState.midday
    const du = dayState.dusk
    m.uniforms.uWashAmp.value.set(
      0.1 + g * 0.14 + du * 0.1,
      0.12 + md * 0.02 + g * 0.1,
      0.06 + md * 0.06
    )

    // the luminist horizon band: cream light, foam warmed by the sun
    scratch.copy(c.foam).lerp(c.sunHalo, 0.4)
    m.uniforms.uLuminist.value.copy(scratch)
    m.uLuministAmt = 0.24 + md * 0.14 + g * 0.1 - du * 0.08

    // rays: quiet in the morning, grace at midday, glory at golden hour
    scratch.copy(c.sunCore).lerp(c.sunHalo, 0.25 + g * 0.55)
    m.uniforms.uRayColor.value.copy(scratch)
    m.uRays = Math.min(1, 0.15 + md * 0.45 + g * 0.8) * (1 - du * 0.85)

    mesh.current.position.copy(state.camera.position)
  })

  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 48, 32]} />
      <skyMat ref={mat} key={SkyMat.key} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}
