import * as THREE from 'three'

// One map of the world, shared by every component.
// The camera stands on the sand looking out over -z.

export const SHORELINE_Z = 5

// Mirror of the ocean vertex swell so floating things agree with the water
export function waterHeightAt(x, z, t) {
  let h = 0
  h += 0.5 * Math.sin(x * 0.16 + z * 0.07 + t * 0.9)
  h += 0.26 * Math.sin(x * -0.11 + z * 0.21 + t * 0.68 + 1.7)
  h += 0.15 * Math.sin(x * 0.34 + z * 0.27 + t * 1.24 + 4.2)
  h += 0.09 * Math.sin(x * -0.53 + z * 0.41 + t * 1.71 + 2.3)
  const shoreCalm = THREE.MathUtils.smoothstep(Math.abs(z - SHORELINE_Z), 2, 26)
  return h * 0.55 * (0.35 + 0.65 * shoreCalm)
}

// The Keyhole: a stone arch in the sea, right of center
export const ARCH_POS = new THREE.Vector3(30, 0, -108)
export const ARCH_HOLE = new THREE.Vector3(30, 11.5, -108) // center of the opening

// Where the cast line lands
export const BOBBER_POS = new THREE.Vector3(6.5, 0, -16)

// Rod anchor relative to the camera rig (bottom right of frame)
export const ROD_ROOT = new THREE.Vector3(1.55, -1.25, -1.1)

// Camera choreography: {p, pos, look} keyframes sampled by eased progress
export const CAMERA_PATH = [
  { p: 0.0, pos: [0, 3.6, 13], look: [3.5, 1.2, -40] },
  { p: 0.16, pos: [0.4, 3.3, 11], look: [-4, 0.6, -55] },
  { p: 0.4, pos: [1.0, 3.4, 9.6], look: [33, 9.5, -103] },
  { p: 0.58, pos: [0.2, 3.4, 11.0], look: [12, 4.5, -65] },
  { p: 0.74, pos: [0, 3.5, 11.8], look: [4, 7, -50] },
  { p: 0.88, pos: [0.5, 3.4, 11.6], look: [5.5, 0.4, -18] },
  { p: 1.0, pos: [0, 3.5, 12.5], look: [3.5, 2.8, -45] },
]
