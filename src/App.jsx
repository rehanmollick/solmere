import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { initSmoothScroll } from './scrollState.js'
import Overlay from './ui/Overlay.jsx'
import Loader from './ui/Loader.jsx'
import SoundToggle from './ui/SoundToggle.jsx'

const Scene = lazy(() => import('./scene/Scene.jsx'))

const MIN_LOADER_MS = 1700

export default function App() {
  const [ready, setReady] = useState(false)
  const mountedAt = useRef(performance.now())

  useEffect(() => initSmoothScroll(), [])

  const handleSceneReady = () => {
    const elapsed = performance.now() - mountedAt.current
    const wait = Math.max(0, MIN_LOADER_MS - elapsed)
    setTimeout(() => setReady(true), wait)
  }

  return (
    <>
      <div id="canvas-root">
        <Suspense fallback={null}>
          <Scene onReady={handleSceneReady} />
        </Suspense>
      </div>
      <Overlay />
      <SoundToggle />
      <Loader ready={ready} />
    </>
  )
}
