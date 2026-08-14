import { useRef, useState } from 'react'

// A small surf synthesizer. No audio files: brown noise pushed through
// slow-breathing filters until it sounds like water minding its own business.
function buildSurf() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const seconds = 4
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  noise.loop = true

  // The low wash of water further out
  const wash = ctx.createBiquadFilter()
  wash.type = 'lowpass'
  wash.frequency.value = 520
  wash.Q.value = 0.5
  const washGain = ctx.createGain()
  washGain.gain.value = 0.5
  noise.connect(wash)
  wash.connect(washGain)
  washGain.connect(master)

  // The closer hiss of foam on sand
  const foam = ctx.createBiquadFilter()
  foam.type = 'bandpass'
  foam.frequency.value = 1900
  foam.Q.value = 0.7
  const foamGain = ctx.createGain()
  foamGain.gain.value = 0.06
  noise.connect(foam)
  foam.connect(foamGain)
  foamGain.connect(master)

  // Two slow tides of loudness, out of phase so no two waves match
  const swellA = ctx.createOscillator()
  swellA.frequency.value = 1 / 9.2
  const swellAGain = ctx.createGain()
  swellAGain.gain.value = 0.24
  swellA.connect(swellAGain)
  swellAGain.connect(washGain.gain)

  const swellB = ctx.createOscillator()
  swellB.frequency.value = 1 / 13.7
  const swellBGain = ctx.createGain()
  swellBGain.gain.value = 0.15
  swellB.connect(swellBGain)
  swellBGain.connect(washGain.gain)

  // Let the wash filter breathe with the bigger swell
  const swellToFilter = ctx.createGain()
  swellToFilter.gain.value = 260
  swellA.connect(swellToFilter)
  swellToFilter.connect(wash.frequency)

  noise.start()
  swellA.start()
  swellB.start()

  return { ctx, master }
}

export default function SoundToggle() {
  const surfRef = useRef(null)
  const [on, setOn] = useState(false)

  const toggle = () => {
    if (!surfRef.current) surfRef.current = buildSurf()
    const { ctx, master } = surfRef.current
    if (ctx.state === 'suspended') ctx.resume()
    const next = !on
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(next ? 0.42 : 0, ctx.currentTime, next ? 1.8 : 0.5)
    setOn(next)
  }

  return (
    <button
      type="button"
      className={`sound-toggle${on ? ' on' : ''}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'hush the water' : 'listen to the water'}
    >
      <span className="sound-waves" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {on ? 'hush' : 'listen'}
    </button>
  )
}
