// Papari-style sectored Kuwahara with a single-pass structure-tensor
// anisotropy term: the whole frame becomes brush daubs, and the daubs
// stretch along wave crests and cloud edges instead of sitting in round
// blotches. Runs as its own convolution pass before Bloom, so the glow
// reads like varnish over the paint.

import { Uniform } from 'three'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'

const fragmentShader = /* glsl */ `
uniform float anisotropy; // 0.0 = classic isotropic kernel, 1.0 = full edge-flow stretch
uniform float scale;      // runtime stroke-size multiplier, 1.0 = default

#define KUWAHARA_PI  3.14159265359
#define KUWAHARA_TAU 6.28318530718

float kuwaharaLuma(const in vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 kuwaharaFetch(const in vec2 uv, const in vec2 offsetTexels) {
  return texture2D(inputBuffer, uv + offsetTexels * texelSize).rgb;
}

vec2 kuwaharaGradient(const in vec2 uv, const in vec2 centerTexels) {
  float l = kuwaharaLuma(kuwaharaFetch(uv, centerTexels + vec2(-1.0,  0.0)));
  float r = kuwaharaLuma(kuwaharaFetch(uv, centerTexels + vec2( 1.0,  0.0)));
  float d = kuwaharaLuma(kuwaharaFetch(uv, centerTexels + vec2( 0.0, -1.0)));
  float u = kuwaharaLuma(kuwaharaFetch(uv, centerTexels + vec2( 0.0,  1.0)));
  return 0.5 * vec2(r - l, u - d);
}

// Structure tensor averaged over 5 gradient samples; without the averaging
// the tensor is rank-1 and the anisotropy term is meaningless.
vec3 kuwaharaTensor(const in vec2 uv) {
  vec3 t = vec3(0.0);
  const float d = 1.5;
  vec2 g;
  g = kuwaharaGradient(uv, vec2(0.0, 0.0)); t += vec3(g.x * g.x, g.y * g.y, g.x * g.y);
  g = kuwaharaGradient(uv, vec2( d,  d));   t += vec3(g.x * g.x, g.y * g.y, g.x * g.y);
  g = kuwaharaGradient(uv, vec2(-d,  d));   t += vec3(g.x * g.x, g.y * g.y, g.x * g.y);
  g = kuwaharaGradient(uv, vec2( d, -d));   t += vec3(g.x * g.x, g.y * g.y, g.x * g.y);
  g = kuwaharaGradient(uv, vec2(-d, -d));   t += vec3(g.x * g.x, g.y * g.y, g.x * g.y);
  return t / 5.0;
}

void kuwaharaSector(const in vec2 uv, const in float sectorAngle, const in mat2 frame,
                    const in vec2 axes, out vec3 avgColor, out float variance) {
  vec3 colorSum = vec3(0.0);
  vec3 squaredSum = vec3(0.0);
  float weightSum = 0.0;

  const float halfArc = KUWAHARA_PI / float(SECTOR_COUNT);
  const float arcStep = halfArc * 0.5;
  const float sigma = KUWAHARA_RADIUS * 0.5;

  for (float r = 1.0; r <= KUWAHARA_RADIUS; r += 1.0) {
    float w = exp(-(r * r) / (2.0 * sigma * sigma));
    for (float a = -halfArc; a <= halfArc + 1e-4; a += arcStep) {
      vec2 unitDir = vec2(cos(sectorAngle + a), sin(sectorAngle + a));
      vec2 offset = frame * (unitDir * axes) * r * scale;
      vec3 c = kuwaharaFetch(uv, offset);
      colorSum   += c * w;
      squaredSum += c * c * w;
      weightSum  += w;
    }
  }

  avgColor = colorSum / weightSum;
  vec3 v = squaredSum / weightSum - avgColor * avgColor;
  variance = kuwaharaLuma(max(v, vec3(0.0)));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 t = kuwaharaTensor(uv);
  float tr  = t.x + t.y;
  float det = sqrt(max((t.x - t.y) * (t.x - t.y) + 4.0 * t.z * t.z, 0.0));
  float lambda1 = 0.5 * (tr + det);
  float lambda2 = 0.5 * (tr - det);

  vec2 v = vec2(lambda1 - t.x, -t.z);
  vec2 flowDir = (dot(v, v) > 1e-12) ? normalize(v) : vec2(0.0, 1.0);

  float A = (tr > 1e-7) ? (lambda1 - lambda2) / tr : 0.0;
  A *= anisotropy;

  vec2 axes = vec2(1.0 + A, 1.0 / (1.0 + A));
  mat2 frame = mat2(flowDir.x, flowDir.y, -flowDir.y, flowDir.x);

  vec3 bestColor = inputColor.rgb;
  float bestVariance = 1e5;

  for (int i = 0; i < SECTOR_COUNT; i++) {
    float sectorAngle = float(i) * (KUWAHARA_TAU / float(SECTOR_COUNT));
    vec3 avgColor;
    float variance;
    kuwaharaSector(uv, sectorAngle, frame, axes, avgColor, variance);
    if (variance < bestVariance) {
      bestVariance = variance;
      bestColor = avgColor;
    }
  }

  outputColor = vec4(bestColor, inputColor.a);
}
`

export class KuwaharaEffect extends Effect {
  constructor({
    blendFunction = BlendFunction.NORMAL,
    radius = 4,
    sectors = 8,
    anisotropy = 1.0,
    scale = 1.0,
  } = {}) {
    super('KuwaharaEffect', fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['anisotropy', new Uniform(anisotropy)],
        ['scale', new Uniform(scale)],
      ]),
      defines: new Map([
        ['KUWAHARA_RADIUS', radius.toFixed(1)],
        ['SECTOR_COUNT', String(Math.max(3, Math.round(sectors)))],
      ]),
    })
  }

  get anisotropy() {
    return this.uniforms.get('anisotropy').value
  }
  set anisotropy(value) {
    this.uniforms.get('anisotropy').value = value
  }

  get scale() {
    return this.uniforms.get('scale').value
  }
  set scale(value) {
    this.uniforms.get('scale').value = value
  }
}
