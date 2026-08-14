import { useMemo } from 'react'
import { EffectComposer, Bloom, HueSaturation, Vignette } from '@react-three/postprocessing'
import { PaperStrokeEffect } from './PaperStroke.js'

export default function Effects() {
  const strokes = useMemo(
    () => new PaperStrokeEffect({ strength: 0.19, spacing: 7, hueVar: 0.08 }),
    []
  )

  return (
    <EffectComposer multisampling={4}>
      <primitive object={strokes} dispose={null} />
      <Bloom
        mipmapBlur
        intensity={0.45}
        luminanceThreshold={0.86}
        luminanceSmoothing={0.18}
        radius={0.55}
      />
      <HueSaturation saturation={0.12} />
      <Vignette offset={0.24} darkness={0.28} eskil={false} />
    </EffectComposer>
  )
}
