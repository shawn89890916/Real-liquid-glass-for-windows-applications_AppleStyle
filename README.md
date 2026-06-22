# Liquid Glass Lab for Windows

An interactive Windows demo that recreates the optical character of Apple's Liquid Glass design language with a real-time WebGL2 shader.

The glass is not a static translucent panel. It samples and bends the scene behind it, softens the sampled image, separates color at curved edges, and moves its highlight according to pointer position. The large rounded rectangle can be dragged across the canvas while every optical parameter updates live.

## Features

- GPU-rendered refraction and background-dependent distortion
- Edge chromatic aberration, internal shading, and specular response
- Clear, Balanced, and Dense material presets
- Live controls for refraction, blur, dispersion, lighting, tint, and corner radius
- Frameless Windows desktop shell with installer and portable builds
- Reduced-motion support and WebGL2 fallback guidance

## Run locally

```powershell
npm install
npm run dev
```

In another terminal:

```powershell
npm start
```

## Build for Windows

```powershell
npm run dist
```

Artifacts are written to `release/`.

## Design notes

Apple describes Liquid Glass as a dynamic material combining the optical properties of glass with fluidity. This demo focuses on those material cues rather than treating the effect as a conventional blur card: content remains the visual foundation, color is restrained, the glass has no hard border, and its edge response changes with context and input.

References:

- [Apple Developer: Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react)
- [shuding/liquid-glass](https://github.com/shuding/liquid-glass)
- [iyinchao/liquid-glass-studio](https://github.com/iyinchao/liquid-glass-studio)

## License

MIT
