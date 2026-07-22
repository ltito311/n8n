# 🍉 Fruit Ninja

A 3D Fruit Ninja clone for the browser, built with [three.js](https://threejs.org/).
Real 3D fruit gets tossed up in front of a wooden dojo wall — swipe to slice it in
half, dodge the bombs, chase combos.

## Run it

It's a fully static app (no build step). Serve this folder with any static file
server and open it in a browser:

```bash
cd fruit-ninja
python3 -m http.server 8000
# or: npx serve .
```

Then visit http://localhost:8000. Works with mouse or touch.

## How to play

- **Swipe** (hold and drag) through fruit to slice it — each fruit is +1 point.
- **Criticals** happen at random for +10.
- Slice **3+ fruit in one swipe** for a combo bonus.
- **Don't slice bombs.** One bomb ends the run.
- Letting a fruit fall unsliced costs one of your 3 lives.
- Best score is saved locally.

## How it works

- The 15 fruit models come from a single GLTF pack sharing one texture atlas.
  Each mesh is baked, centered, and normalized to unit radius at load time.
- Slicing swaps the fruit for two copies of the same mesh, each clipped by a
  world-space clipping plane derived from your swipe direction. Halves only spin
  around the cut normal (a rotation that leaves the clip plane consistent), and
  the plane is re-anchored to each half as it flies, so the cut face never drifts.
- The dojo wall is a procedurally painted plank canvas; juice splats are drawn
  into a separate canvas layer that fades out over a few seconds before being
  composited back onto the wall texture.
- Blade trail, juice droplets, score popups, and flashes are drawn on a 2D
  overlay canvas. All sound effects are synthesized live with the Web Audio API —
  there are no audio assets.

## Credits

This work is based on
["Free Pack - Fruits"](https://sketchfab.com/3d-models/free-pack-fruits-ae101b55893843d7aacc6f2809fec387)
by [PolyOne Studio](https://sketchfab.com/polyone) licensed under
[CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).

three.js (MIT) is vendored in `vendor/`.
