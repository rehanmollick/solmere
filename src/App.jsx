import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { initSmoothScroll } from './scrollState.js'
import { makeGrainDataURL, makeStrokeDataURL } from './scene/paintUtils.js'
import Overlay from './ui/Overlay.jsx'
import Loader from './ui/Loader.jsx'
import SoundToggle from './ui/SoundToggle.jsx'

const Scene = lazy(() => import('./scene/Scene.jsx'))

const MIN_LOADER_MS = 1700

export default function App() {
  const [ready, setReady] = useState(false)
  const mountedAt = useRef(performance.now())
  const grain = useMemo(makeGrainDataURL, [])
  const strokes = useMemo(makeStrokeDataURL, [])

  useEffect(() => initSmoothScroll(), [])

  const handleSceneReady = () => {
    const elapsed = performance.now() - mountedAt.current
    const wait = Math.max(0, MIN_LOADER_MS - elapsed)
    setTimeout(() => setReady(true), wait)
  }

  return (
    <>
      <div id="canvas-root" aria-hidden="true">
        <Suspense fallback={null}>
          <Scene onReady={handleSceneReady} started={ready} />
        </Suspense>
      </div>
      <div
        className="grain"
        aria-hidden="true"
        style={{ backgroundImage: `url(${grain})` }}
      />
      <div
        className="strokes"
        aria-hidden="true"
        style={{ backgroundImage: `url(${strokes})` }}
      />
      <Overlay />
      <SoundToggle />
      <Loader ready={ready} />
    </>
  )
}
