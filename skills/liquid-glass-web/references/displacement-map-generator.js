// Browser-side helper for generating liquid-glass displacement maps.
// The output is a PNG data URL suitable for feImage href in an SVG filter.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function squircleProfile(t) {
  const x = clamp(t, 0, 1);
  return Math.pow(1 - Math.pow(1 - x, 4), 0.25);
}

function edgeNormal(x, y, width, height, radius) {
  const left = x;
  const right = width - 1 - x;
  const top = y;
  const bottom = height - 1 - y;
  const edgeDistance = Math.min(left, right, top, bottom);
  const t = clamp(1 - edgeDistance / Math.max(1, radius), 0, 1);
  const strength = squircleProfile(t);
  const nx = left < right ? -strength : strength;
  const ny = top < bottom ? -strength : strength;
  const cornerBias = Math.abs(left - right) < width * 0.45 && Math.abs(top - bottom) < height * 0.45 ? 0.45 : 1;
  return { x: nx * cornerBias, y: ny * cornerBias };
}

export function createLiquidGlassDisplacementMap({
  width = 320,
  height = 160,
  radius = 32,
  strength = 1
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normal = edgeNormal(x, y, width, height, radius);
      const offset = (y * width + x) * 4;
      data[offset] = Math.round(clamp(128 + normal.x * 127 * strength, 0, 255));
      data[offset + 1] = Math.round(clamp(128 + normal.y * 127 * strength, 0, 255));
      data[offset + 2] = 128;
      data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export function createCommonLiquidGlassMaps() {
  return {
    roundedRect: createLiquidGlassDisplacementMap({ width: 320, height: 160, radius: 36 }),
    capsule: createLiquidGlassDisplacementMap({ width: 320, height: 88, radius: 44 }),
    circle: createLiquidGlassDisplacementMap({ width: 192, height: 192, radius: 96 })
  };
}

export function applyDisplacementMap(filterImageElement, dataUrl) {
  filterImageElement.setAttribute("href", dataUrl);
}
