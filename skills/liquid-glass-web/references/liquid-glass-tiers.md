# Liquid Glass Web Tiers

Use the lowest tier that satisfies the product goal. Higher fidelity costs more browser support, complexity, or GPU budget.

## Tier 1: Universal Frosted Glass

```css
.glass {
  --glass-radius: 24px;
  --glass-bg: color-mix(in srgb, white 18%, transparent);
  --glass-border: color-mix(in srgb, white 34%, transparent);
  --glass-highlight: color-mix(in srgb, white 46%, transparent);
  --glass-shadow: 0 18px 55px color-mix(in srgb, black 22%, transparent);

  position: relative;
  border-radius: var(--glass-radius);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
}

.glass::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(180deg, var(--glass-highlight), transparent 42%),
    radial-gradient(circle at 18% 0%, color-mix(in srgb, white 30%, transparent), transparent 34%);
  opacity: 0.8;
}

.glass > * {
  position: relative;
  z-index: 1;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass {
    background: color-mix(in srgb, white 88%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glass {
    transition: none;
  }
}

@media (prefers-contrast: more) {
  .glass {
    background: color-mix(in srgb, Canvas 92%, transparent);
    border-color: color-mix(in srgb, CanvasText 35%, transparent);
  }
}
```

Use Tier 1 for most production UI. It is often the best answer.

## Tier 2: Chromium SVG-Displacement Refraction

Use Tier 2 as a progressive enhancement over Tier 1.

```html
<svg aria-hidden="true" width="0" height="0" class="glass-filters">
  <filter id="liquidGlass" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feImage id="liquidGlassMap" href="data:image/png;base64,..." result="map" />
    <feDisplacementMap
      in="SourceGraphic"
      in2="map"
      scale="18"
      xChannelSelector="R"
      yChannelSelector="G"
      result="refracted"
    />
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="rimSoft" />
    <feSpecularLighting in="rimSoft" surfaceScale="3" specularConstant="0.45" specularExponent="18" lighting-color="#ffffff" result="specular">
      <feDistantLight azimuth="225" elevation="48" />
    </feSpecularLighting>
    <feBlend in="refracted" in2="specular" mode="screen" />
  </filter>
</svg>
```

```css
.glass {
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
}

@supports (backdrop-filter: url("#liquidGlass")) {
  .glass[data-refraction="svg"] {
    backdrop-filter: blur(14px) saturate(180%) url("#liquidGlass");
  }
}
```

Notes:

- `@supports` can be optimistic. Validate visually in Chromium and keep Tier 1 as the real fallback.
- Filter regions and maps do not automatically fit every element. Generate maps for the rendered element size or a stable preset.
- Resize requires regeneration. Avoid continuous size animation.

## Tier 3: WebGL Refraction

Use Tier 3 only when real refraction must work beyond Chromium and the project can handle WebGL testing.

Decision rules:

- Use a library only after license review. `naughtyduk/liquidGL` currently advertises MIT in its README, but check the current repo state before adopting it.
- Treat Andrew Prifer's `liquid-dom` (`https://github.com/AndrewPrifer/liquid-dom`) as inspiration only because it is unlicensed; do not copy its code.
- Credit kube.io's SVG displacement technique (`https://kube.io/blog/liquid-glass-css-svg/`) when using Tier 2-style refraction, and review licenses before borrowing from `nikdelvin/liquid-glass`, `rizroze/liquid-glass`, `Z1Code/glass-refraction`, `naughtyduk/liquidGL`, or `dashersw/liquid-glass-js`.
- Prefer original shaders when the project already owns a WebGL/Three/Pixi rendering layer.
- Snapshot or render the backdrop explicitly. Browser security rules prevent arbitrary live screen-pixel reads.
- Add a no-WebGL/Tier 1 fallback and detect context loss.

Example guard:

```js
function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

if (canUseWebGL() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.dataset.glassTier = "webgl";
} else {
  document.documentElement.dataset.glassTier = "frosted";
}
```

Keep WebGL glass rare: hero lens, nav, dock, or one signature surface. Do not apply it to every repeated card.
