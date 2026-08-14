import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { dayState } from './day.js'
import CameraRig from './CameraRig.jsx'
import Sky from './Sky.jsx'
import Ocean from './Ocean.jsx'
import Beach from './Beach.jsx'
import BeachLife from './BeachLife.jsx'
import Arch from './Arch.jsx'
import Clouds from './Clouds.jsx'
import Birds from './Birds.jsx'
import FishingRod from './FishingRod.jsx'
import Fireflies from './Fireflies.jsx'
import Effects from './Effects.jsx'

function Atmosphere() {
  const fogRef = useRef()
  const hemi = useRef()
  const sun = useRef()
  const scratch = useMemo(() => ({ sky: new THREE.Color(), ground: new THREE.Color() }), [])

  useFrame(() => {
    if (fogRef.current) fogRef.current.color.copy(dayState.colors.hazeColor)
    if (hemi.current) {
      scratch.sky.copy(dayState.colors.skyZenith).lerp(scratch.ground.set('#ffffff'), 0.25)
      hemi.current.color.copy(scratch.sky)
      scratch.ground.copy(dayState.colors.sandLit).multiplyScalar(0.85)
      hemi.current.groundColor.copy(scratch.ground)
    }
    if (sun.current) {
      sun.current.color.copy(dayState.colors.sunHalo)
      sun.current.intensity = 1.05 + dayState.golden * 0.5 - dayState.dusk * 0.55
      sun.current.position.copy(dayState.sunDir).multiplyScalar(140)
    }
  })

  return (
    <>
      <fog ref={fogRef} attach="fog" args={['#E8D5C0', 65, 360]} />
      <hemisphereLight ref={hemi} intensity={0.95} />
      <directionalLight ref={sun} intensity={1.15} />
    </>
  )
}

function FirstFrame({ onReady }) {
  const fired = useRef(false)
  useFrame(() => {
    if (!fired.current) {
      fired.current = true
      setTimeout(onReady, 60)
    }
  })
  return null
}

export default function Scene({ onReady, started }) {
  return (
    <Canvas
      flat
      dpr={[1, 1.25]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 55, near: 0.1, far: 900, position: [0, 3, 10] }}
      aria-hidden="true"
    >
      <CameraRig />
      <Atmosphere />
      <Sky />
      <Ocean />
      <Beach />
      <BeachLife />
      <Arch />
      <Clouds />
      <Birds />
      <FishingRod started={started} />
      <Fireflies />
      <Effects />
      <FirstFrame onReady={onReady} />
    </Canvas>
  )
}
