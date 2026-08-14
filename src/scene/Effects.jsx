import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { KuwaharaEffect } from './KuwaharaEffect.js'
import { dayState } from './day.js'

export default function Effects() {
  const kuwahara = useMemo(
    () => new KuwaharaEffect({ radius: 4, sectors: 6, anisotropy: 0.72, scale: 1.3 }),
    []
  )
  const holder = useRef()

  useFrame(() => {
    // ease the paint off a little at dusk so the stars stay pinpricks
    kuwahara.blendMode.opacity.value = 1 - dayState.dusk * 0.35
  })

  return (
    <EffectComposer ref={holder} multisampling={0}>
      <primitive object={kuwahara} dispose={null} />
      <Bloom
        mipmapBlur
        intensity={0.35}
        luminanceThreshold={0.88}
        luminanceSmoothing={0.12}
        radius={0.45}
      />
      <Vignette offset={0.26} darkness={0.42} eskil={false} />
    </EffectComposer>
  )
}
