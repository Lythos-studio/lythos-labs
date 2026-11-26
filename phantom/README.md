# Phantom

Images that only exist while they move. Every single frame is pure noise, yet your eyes see a turning 3D shape, your own words or your own drawing. Pause it, or take a screenshot, and it is gone.

Try it at [labs.lythos.nl/phantom](https://labs.lythos.nl/phantom) (Dutch: [/nl/fantoom](https://labs.lythos.nl/nl/fantoom)). Status: prototype.

- **Four 3D shapes made of nothing but motion.** A torus, a gyroid, a Mandelbulb and a twisted box are ray marched per noise cell in a WebGL2 fragment shader. The cells on their surface carry noise that is glued to the surface, so as the shape turns you see it in depth (the kinetic depth effect), but no single frame contains it. Drag or use the arrow keys to turn it.
- **Your words, your drawing.** Type up to 40 characters or draw with mouse, finger or pen. Inside the letters or lines the noise slides along; outside it stands still. The words go into the link after the `#`, never to a server.
- **It proves itself.** When paused, the frame on screen is rendered again off screen and every cell is counted: the share of light cells and of alike neighbours, inside and outside the shape. Both sit at about 50%, like pure noise.
- **And shows how to break it.** "Show what a computer needs" compares two frames with the background motion taken out, and the shape lights up. One frame gives nothing away; two frames do.
- Grain from 2 to 8 pixels, speed, four colour pairs, and a calm mode with a still background. With `prefers-reduced-motion` nothing plays by itself.

## How it works

Each cell is one bit from an integer hash (pcg3d, Jarzynski and Olano 2020) on the GPU. Outside the shape the bits come from a background field; inside, from a field attached to the shape: in object space for 3D (`floor(p * density)` of the hit point), or shifted in screen space for words and drawings. Both are independent fair bits, so a frame is the same noise everywhere. Only how cells move over time differs.

Where a 3D surface turns away from the viewer, object-space cells would stretch into blobs larger than a screen cell, which is a texture difference an attentive eye could see in a still frame. There the background bits are used instead. The density of the surface noise is tuned so that, measured on real frames, inside and outside agree within about one percentage point on both measures.

The perceptual effects are old and well documented: the kinetic depth effect (Wallach and O'Connell, 1953) and random-dot stimuli (Julesz, 1960). This experiment makes them interactive, in 3D, with your own content, in a browser.

## What it is not

Not encryption: comparing two frames reveals the shape (the page shows how). It hides from single images, such as screenshots and thumbnails. Video compression smooths noise away, so recordings usually lose the effect. The proof measures two statistics, not every possible one.

Moving noise can be uncomfortable for people who are sensitive to motion or flicker; the page says so before it starts and offers a calm mode.

## Use

```tsx
import { Phantom } from "@lythos-labs/phantom";

<Phantom locale="en" />;
```

`Phantom` is a React 19 client component with English and Dutch copy. It needs WebGL 2 and shows a message without it. Its styles are a CSS module; it makes no network requests and renders no inline style attributes, so the host page needs no extra Content-Security-Policy entry. The pieces are exported too: `createRenderer`, the GLSL in `FRAGMENT`, the JavaScript copy of the hash (`pcg3d`, `bit`) and `frameStats`.

## Develop

```bash
npm install
npm test
npm run typecheck
```

## License

[Mozilla Public License 2.0](LICENSE). The Lythos name and logo are not covered by this license.
