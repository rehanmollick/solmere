import Lenis from 'lenis'

// Shared mutable state, read inside useFrame without triggering React renders.
export const scrollState = {
  progress: 0, // raw 0..1 across the whole document
  eased: 0, // smoothed copy, advanced by the scene each frame
}

export const pointerState = {
  x: 0, // -1..1, left to right
  y: 0, // -1..1, top to bottom
}

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let lenis = null

export function initSmoothScroll() {
  lenis = new Lenis({
    duration: prefersReducedMotion ? 0 : 1.35,
    smoothWheel: !prefersReducedMotion,
  })

  lenis.on('scroll', ({ scroll, limit }) => {
    scrollState.progress = limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0
  })

  let rafId = requestAnimationFrame(function raf(time) {
    lenis.raf(time)
    rafId = requestAnimationFrame(raf)
  })

  const onPointer = (e) => {
    pointerState.x = (e.clientX / window.innerWidth) * 2 - 1
    pointerState.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('pointermove', onPointer)
    lenis.destroy()
    lenis = null
  }
}

export function scrollBackToMorning() {
  if (lenis) {
    lenis.scrollTo(0, { duration: prefersReducedMotion ? 0 : 4.5 })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
