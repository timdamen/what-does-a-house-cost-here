/**
 * Price pills are a symbol layer whose icon is a stretchable rounded rectangle
 * (`icon-text-fit: both`). The image is generated as raw RGBA so it needs no canvas and can be
 * unit-tested in Node.
 */

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PillStyle {
  /** CSS hex colour, `#rrggbb`. */
  fill: string;
  stroke: string;
}

/** Device pixels per CSS pixel the pill image is drawn at. */
const PILL_PIXEL_RATIO = 2;

/** Image edge in device pixels; the pill is a full circle at rest and stretches from the middle. */
export const PILL_SIZE = 48;

const STROKE_WIDTH = 3;
const STRETCH_START = PILL_SIZE / 2 - 2;
const STRETCH_END = PILL_SIZE / 2 + 2;
const CONTENT_INSET = 12;

/** Metadata MapLibre needs to stretch the pill around its text (`addImage` options). */
export const PILL_IMAGE_OPTIONS = {
  pixelRatio: PILL_PIXEL_RATIO,
  stretchX: [[STRETCH_START, STRETCH_END]] as Array<[number, number]>,
  stretchY: [[STRETCH_START, STRETCH_END]] as Array<[number, number]>,
  content: [CONTENT_INSET, CONTENT_INSET, PILL_SIZE - CONTENT_INSET, PILL_SIZE - CONTENT_INSET] as [
    number,
    number,
    number,
    number,
  ],
};

/** Anti-aliased filled circle with a stroke, `PILL_SIZE` square, non-premultiplied RGBA. */
export function createPillImage(style: PillStyle): RgbaImage {
  const size = PILL_SIZE;
  const data = new Uint8ClampedArray(size * size * 4);
  const fill = parseHex(style.fill);
  const stroke = parseHex(style.stroke);
  const centre = size / 2;
  const outerRadius = size / 2 - 0.5;
  const innerRadius = outerRadius - STROKE_WIDTH;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
      const outer = coverage(outerRadius - distance);
      const inner = coverage(innerRadius - distance);
      const strokeCoverage = outer - inner;
      const offset = (y * size + x) * 4;
      if (outer <= 0) continue;
      data[offset] = (fill[0] * inner + stroke[0] * strokeCoverage) / outer;
      data[offset + 1] = (fill[1] * inner + stroke[1] * strokeCoverage) / outer;
      data[offset + 2] = (fill[2] * inner + stroke[2] * strokeCoverage) / outer;
      data[offset + 3] = outer * 255;
    }
  }

  return { width: size, height: size, data };
}

/** Pixel coverage for a signed distance (positive = inside), clamped to one pixel of anti-aliasing. */
function coverage(signedDistance: number): number {
  return Math.min(1, Math.max(0, signedDistance + 0.5));
}

function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Pill colours must be #rrggbb, got "${hex}"`);
  const value = Number.parseInt(match[1] as string, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}
