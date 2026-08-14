// The painting pass. Reads the frame's own contours and pulls directional
// brush strokes along them: horizontal drags across open sky and water,
// curved strokes hugging every form. Each stroke carries its own lean of
// pigment (broken color) and a faint impasto ridge where the paint piles.

import { Uniform } from 'three'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'

const fragmentShader = /* glsl */ `
uniform float strength;   // stroke value contrast
uniform float spacing;    // stroke spacing in device px
uniform float hueVar;     // per-stroke pigment variance

float psLuma(const in vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}
float psHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float psNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(psHash(i), psHash(i + vec2(1.0, 0.0)), u.x),
             mix(psHash(i + vec2(0.0, 1.0)), psHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // contour direction from a wide luminance gradient
  vec2 o = texelSize * 2.5;
  float lL = psLuma(texture2D(inputBuffer, uv - vec2(o.x, 0.0)).rgb);
  float lR = psLuma(texture2D(inputBuffer, uv + vec2(o.x, 0.0)).rgb);
  float lD = psLuma(texture2D(inputBuffer, uv - vec2(0.0, o.y)).rgb);
  float lU = psLuma(texture2D(inputBuffer, uv + vec2(0.0, o.y)).rgb);
  vec2 grad = vec2(lR - lL, lU - lD);
  float gm = length(grad);

  // strokes run along iso-lines; flat fields get a near-horizontal drag.
  // direction is quantized so strokes gather into coherent patches.
  vec2 flow = gm > 1e-4 ? normalize(vec2(-grad.y, grad.x)) : vec2(1.0, 0.06);
  float angRaw = atan(flow.y, flow.x);
  float qs = 3.14159265 / 9.0;
  float ang = floor(angRaw / qs + 0.5) * qs + 0.03;
  vec2 dir = vec2(cos(ang), sin(ang));

  // stroke-space coordinates: dense across the stroke, long along it
  vec2 px = uv / texelSize;
  float across = dot(px, vec2(-dir.y, dir.x)) / spacing;
  float along = dot(px, dir) / (spacing * 6.5);

  float body = psNoise(vec2(across, along));
  float bristle = psNoise(vec2(across * 3.6, along * 5.0) + 13.0);
  float brush = (body - 0.5) * 0.72 + (bristle - 0.5) * 0.28;

  // the ridge: light catches the top edge of each pull of paint
  float above = psNoise(vec2(across - 0.85, along));
  float ridge = max(above - body, 0.0);

  vec3 col = inputColor.rgb * (1.0 + brush * strength);
  col += vec3(1.0, 0.98, 0.93) * ridge * strength * 0.55;

  // broken color: every stroke leans its own way
  float id = psHash(vec2(floor(across), floor(along)));
  vec3 lean = vec3(psHash(vec2(id, 1.0)), psHash(vec2(id, 2.0)), psHash(vec2(id, 3.0)));
  col *= vec3(1.0) + (lean - 0.5) * hueVar;

  outputColor = vec4(max(col, 0.0), inputColor.a);
}
`

export class PaperStrokeEffect extends Effect {
  constructor({ blendFunction = BlendFunction.NORMAL, strength = 0.16, spacing = 7.0, hueVar = 0.07 } = {}) {
    super('PaperStrokeEffect', fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['strength', new Uniform(strength)],
        ['spacing', new Uniform(spacing)],
        ['hueVar', new Uniform(hueVar)],
      ]),
    })
  }
}
