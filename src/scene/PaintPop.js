// The anti-flattener: a small unsharp mask that makes every fbm stroke,
// dab and grain in the frame push forward. Detail amplification, not
// detail averaging.

import { Uniform } from 'three'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'

const fragmentShader = /* glsl */ `
uniform float amount;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 sum = vec3(0.0);
  sum += texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
  sum += texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;
  sum += texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;
  sum += texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb;
  sum += texture2D(inputBuffer, uv + texelSize).rgb;
  sum += texture2D(inputBuffer, uv - texelSize).rgb;
  sum += texture2D(inputBuffer, uv + vec2(texelSize.x, -texelSize.y)).rgb;
  sum += texture2D(inputBuffer, uv - vec2(texelSize.x, -texelSize.y)).rgb;
  vec3 blur = (sum + inputColor.rgb * 4.0) / 12.0;
  vec3 sharp = inputColor.rgb + (inputColor.rgb - blur) * amount;
  outputColor = vec4(max(sharp, 0.0), inputColor.a);
}
`

export class PaintPopEffect extends Effect {
  constructor({ blendFunction = BlendFunction.NORMAL, amount = 0.8 } = {}) {
    super('PaintPopEffect', fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([['amount', new Uniform(amount)]]),
    })
  }

  get amount() {
    return this.uniforms.get('amount').value
  }
  set amount(value) {
    this.uniforms.get('amount').value = value
  }
}
