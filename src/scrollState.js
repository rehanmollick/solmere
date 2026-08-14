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
  const onPointer = (e) => {
    pointerState.x = (e.clientX / window.innerWidth) * 2 - 1
    pointerState.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  if (prefersReducedMotion) {
    // Native scroll, no inertia: motion tracks the finger exactly.
    const onScroll = () => {
      const limit = document.documentElement.scrollHeight - window.innerHeight
      scrollState.progress = limit > 0 ? Math.min(1, Math.max(0, window.scrollY / limit)) : 0
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
    }
  }

  lenis = new Lenis({
    autoRaf: false,
    duration: 1.35,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  })

  const off = lenis.on('scroll', ({ scroll, limit }) => {
    scrollState.progress = limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0
  })

  let rafId = requestAnimationFrame(function raf(time) {
    lenis.raf(time)
    rafId = requestAnimationFrame(raf)
  })

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('pointermove', onPointer)
    off()
    lenis.destroy()
    lenis = null
  }
}

export function scrollBackToMorning() {
  if (lenis) {
    lenis.scrollTo(0, { duration: 4.5 })
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
}
