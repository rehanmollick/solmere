import { useEffect } from 'react'
import { scrollBackToMorning } from '../scrollState.js'

function useReveal() {
  useEffect(() => {
    const blocks = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.3, rootMargin: '0px 0px -12% 0px' }
    )
    blocks.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

export default function Overlay() {
  useReveal()

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-inner" data-reveal>
          <p className="eyebrow">the far shore</p>
          <h1 className="hero-title">Solmere</h1>
          <p className="hero-line">
            Warm sand, slow water, one line cast out and no hurry about it.
          </p>
        </div>
        <div className="scroll-hint" aria-hidden="true">
          <span className="scroll-hint-line" />
          <span>scroll, the day is long</span>
        </div>
      </header>

      <section className="beat align-left ink">
        <div className="beat-inner" data-reveal>
          <p className="chapter">i. the water</p>
          <h2>Shallow for half a mile, then it is not</h2>
          <p>
            You can see the shelf from the beach, a clean line where the green
            gives up and the blue takes over. Fish cross it like commuters.
          </p>
          <p>
            The waves here do not break so much as arrive. They come in, take a
            slow look around, and head back out with whatever they came for.
          </p>
        </div>
      </section>

      <section className="beat align-right ink">
        <div className="beat-inner" data-reveal>
          <p className="chapter">ii. the keyhole</p>
          <h2>Nobody built it</h2>
          <p>
            That is the first question everyone asks, and the answer is no. The
            sea cut that opening on its own, grain by grain, over more mornings
            than anyone can hold in their head.
          </p>
          <p>
            Once a day the sun lines up with the gap and the whole bay goes
            gold. Locals stop what they are doing. There are no locals. You
            stop anyway.
          </p>
        </div>
      </section>

      <section className="beat align-left cream">
        <div className="beat-inner" data-reveal>
          <p className="chapter">iii. company</p>
          <h2>Terns, mostly</h2>
          <p>
            They work the shallows in twos and threes, and they will not share
            their opinion of your casting, though they clearly have one.
          </p>
          <p>
            Toward evening they head for the arch and vanish into the dark of
            it. Whatever waits in that cave, they trust it. That has always
            felt like enough.
          </p>
        </div>
      </section>

      <section className="beat align-right cream">
        <div className="beat-inner" data-reveal>
          <p className="chapter">iv. blue hour</p>
          <h2>The sky lets go of the gold slowly</h2>
          <p>
            Like it is counting it first. Stars come out in ones, then in
            crowds. Down at the waterline the cave begins to glow, faint and
            green blue, some patient light the water makes on its own.
          </p>
          <p>
            You could wade out and look. You could also stay right here, hands
            behind your head, and let it be a rumor.
          </p>
        </div>
      </section>

      <section className="beat align-center cream final">
        <div className="beat-inner" data-reveal>
          <p className="chapter">v. the line goes taut</p>
          <h2>Or it will, eventually</h2>
          <p>
            That was never really the point. The rod knows its job, the tide
            keeps its promises, and tomorrow the light through the Keyhole will
            land exactly where it always lands.
          </p>
          <button type="button" className="again" onClick={scrollBackToMorning}>
            watch the morning come back
          </button>
        </div>
      </section>

      <footer className="colophon">
        <p>Solmere is not on any map. Drawn in code, by hand.</p>
        <p className="fine">no photographs were taken · {new Date().getFullYear()}</p>
      </footer>
    </main>
  )
}
