import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={0.5}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.22}
        radius={0.72}
      />
      <Vignette offset={0.26} darkness={0.42} eskil={false} />
    </EffectComposer>
  )
}
