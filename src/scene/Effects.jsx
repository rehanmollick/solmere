import { useMemo } from 'react'
import { EffectComposer, Bloom, HueSaturation, Vignette } from '@react-three/postprocessing'
import { PaintPopEffect } from './PaintPop.js'

export default function Effects() {
  const pop = useMemo(() => new PaintPopEffect({ amount: 0.75 }), [])

  return (
    <EffectComposer multisampling={4}>
      <primitive object={pop} dispose={null} />
      <Bloom
        mipmapBlur
        intensity={0.5}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.18}
        radius={0.55}
      />
      <HueSaturation saturation={0.14} />
      <Vignette offset={0.24} darkness={0.28} eskil={false} />
    </EffectComposer>
  )
}
