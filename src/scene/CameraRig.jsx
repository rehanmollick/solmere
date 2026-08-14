import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { dayState, updateDay } from './day.js'
import { CAMERA_PATH } from './layout.js'
import { scrollState, pointerState, prefersReducedMotion } from '../scrollState.js'

const smooth = (t) => t * t * (3 - 2 * t)

export default function CameraRig() {
  const pointer = useRef({ x: 0, y: 0 })
  const scratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      posB: new THREE.Vector3(),
      look: new THREE.Vector3(),
      lookB: new THREE.Vector3(),
    }),
    []
  )

  // Runs before every other useFrame so the whole frame agrees on the hour
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    if (prefersReducedMotion) {
      scrollState.eased = scrollState.progress
    } else {
      scrollState.eased = THREE.MathUtils.damp(
        scrollState.eased,
        scrollState.progress,
        3.4,
        delta
      )
    }
    const p = scrollState.eased
    dayState.time = t

    // camera pose from the keyframe path
    let i = 0
    while (i < CAMERA_PATH.length - 2 && p > CAMERA_PATH[i + 1].p) i++
    const a = CAMERA_PATH[i]
    const b = CAMERA_PATH[i + 1]
    const k = smooth(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))))
    scratch.pos.fromArray(a.pos).lerp(scratch.posB.fromArray(b.pos), k)
    scratch.look.fromArray(a.look).lerp(scratch.lookB.fromArray(b.look), k)

    // the day needs to know where you stand: the setting sun aligns itself
    // to the keyhole as seen from this exact spot
    updateDay(p, scratch.pos)

    if (!prefersReducedMotion) {
      // breathing, and the gaze trailing the pointer
      scratch.pos.y += Math.sin(t * 0.45) * 0.05
      const damp = 1 - Math.exp(-3 * delta)
      pointer.current.x += (pointerState.x - pointer.current.x) * damp
      pointer.current.y += (pointerState.y - pointer.current.y) * damp
      scratch.look.x += pointer.current.x * 1.6
      scratch.look.y -= pointer.current.y * 1.0
    }

    // wider lens on tall screens so the rod and the arch both stay in frame
    const wantFov = state.size.width / state.size.height < 0.75 ? 68 : 55
    if (state.camera.fov !== wantFov) {
      state.camera.fov = wantFov
      state.camera.updateProjectionMatrix()
    }

    state.camera.position.copy(scratch.pos)
    state.camera.lookAt(scratch.look)
  }, -10)

  return null
}
