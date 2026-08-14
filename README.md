# Solmere

A painted shore that lives in the browser. One page, one day: scroll and the
morning turns to gold, the gold lets go, the stars come out, and something
finally tugs the line.

Everything in the scene is drawn in code at runtime. There are no image
assets, no models, no photographs: the ocean, the sky, the keyhole arch, the
clouds, the terns, and the rod are all procedural geometry and shaders, and
the surf sound is synthesized from filtered noise.

## Run it

```
npm install
npm run dev
```

## How it works

- React Three Fiber scene on a fixed canvas behind normal scrolling prose,
  with Lenis smoothing the scroll and one eased progress value driving
  everything.
- `src/scene/day.js` is the clock: four hand-mixed gouache palettes (dawn,
  midday, golden hour, dusk) interpolated in OKLab so the hours never blend
  to gray.
- Custom GLSL for the water (banded depth ramp, sun-glitter lane, shoreline
  foam), the sky dome (four-stop gradient, sun, hash stars), the sand, the
  god rays through the arch, and the little rings around the bobber.
- Clouds are canvas-painted cumulus sprites in three depth rings. Birds are
  six triangles each, running a flap-and-glide state machine on looping
  paths.
- Honors prefers-reduced-motion, and the whole thing holds 60fps.
