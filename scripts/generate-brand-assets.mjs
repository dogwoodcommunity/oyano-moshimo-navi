import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname;

const colors = {
  green: [39, 100, 71, 255],
  greenDark: [24, 63, 46, 255],
  paper: [246, 247, 241, 255],
  surface: [255, 253, 250, 255],
  line: [217, 226, 220, 255],
  blue: [40, 79, 121, 255],
  gold: [165, 111, 36, 255],
  rose: [154, 63, 86, 255],
  ink: [24, 35, 31, 255],
  white: [255, 255, 255, 255],
  transparent: [0, 0, 0, 0]
};

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function createImage(width, height, bg = colors.transparent) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data.set(bg, i);
  }
  return { width, height, data };
}

function blendPixel(img, x, y, rgba) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const index = (Math.floor(y) * img.width + Math.floor(x)) * 4;
  const alpha = rgba[3] / 255;
  const inv = 1 - alpha;
  img.data[index] = Math.round(rgba[0] * alpha + img.data[index] * inv);
  img.data[index + 1] = Math.round(rgba[1] * alpha + img.data[index + 1] * inv);
  img.data[index + 2] = Math.round(rgba[2] * alpha + img.data[index + 2] * inv);
  img.data[index + 3] = Math.round(255 * (alpha + (img.data[index + 3] / 255) * inv));
}

function rect(img, x, y, w, h, color) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(img.height, Math.ceil(y + h)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(img.width, Math.ceil(x + w)); xx += 1) {
      blendPixel(img, xx, yy, color);
    }
  }
}

function roundedRect(img, x, y, w, h, r, color) {
  const x2 = x + w;
  const y2 = y + h;
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(img.height, Math.ceil(y2)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(img.width, Math.ceil(x2)); xx += 1) {
      const cx = xx < x + r ? x + r : xx > x2 - r ? x2 - r : xx;
      const cy = yy < y + r ? y + r : yy > y2 - r ? y2 - r : yy;
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) blendPixel(img, xx, yy, color);
    }
  }
}

function circle(img, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let yy = Math.max(0, Math.floor(cy - radius)); yy < Math.min(img.height, Math.ceil(cy + radius)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(cx - radius)); xx < Math.min(img.width, Math.ceil(cx + radius)); xx += 1) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r2) blendPixel(img, xx, yy, color);
    }
  }
}

function line(img, x1, y1, x2, y2, width, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 1.7;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    circle(img, x1 + dx * t, y1 + dy * t, width / 2, color);
  }
}

function mark(img, cx, cy, size, bgColor = colors.green) {
  roundedRect(img, cx - size / 2, cy - size / 2, size, size, size * 0.18, bgColor);
  roundedRect(img, cx - size * 0.2, cy - size * 0.28, size * 0.4, size * 0.48, size * 0.035, colors.surface);
  rect(img, cx - size * 0.13, cy - size * 0.16, size * 0.26, size * 0.035, colors.line);
  rect(img, cx - size * 0.13, cy - size * 0.06, size * 0.22, size * 0.035, colors.line);
  rect(img, cx - size * 0.13, cy + size * 0.04, size * 0.18, size * 0.035, colors.line);
  line(img, cx - size * 0.25, cy + size * 0.16, cx - size * 0.08, cy + size * 0.32, size * 0.055, colors.white);
  line(img, cx - size * 0.08, cy + size * 0.32, cx + size * 0.28, cy - size * 0.16, size * 0.055, colors.white);
  circle(img, cx - size * 0.22, cy - size * 0.26, size * 0.08, colors.white);
  circle(img, cx + size * 0.22, cy - size * 0.26, size * 0.08, colors.white);
  circle(img, cx, cy - size * 0.34, size * 0.095, colors.white);
}

function writePng(filePath, img) {
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) {
    const rowStart = y * (img.width * 4 + 1);
    raw[rowStart] = 0;
    raw.set(img.data.slice(y * img.width * 4, (y + 1) * img.width * 4), rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, png);
}

function iconImage(size, transparent = false) {
  const img = createImage(size, size, transparent ? colors.transparent : colors.greenDark);
  if (!transparent) {
    roundedRect(img, size * 0.05, size * 0.05, size * 0.9, size * 0.9, size * 0.19, colors.green);
    circle(img, size * 0.78, size * 0.22, size * 0.1, [255, 255, 255, 30]);
    circle(img, size * 0.2, size * 0.82, size * 0.16, [24, 63, 46, 44]);
  }
  mark(img, size / 2, size / 2, size * 0.66, transparent ? colors.white : colors.greenDark);
  return img;
}

function splashImage() {
  const img = createImage(1242, 2436, colors.paper);
  roundedRect(img, 196, 660, 850, 850, 70, [255, 253, 250, 255]);
  rect(img, 390, 642, 460, 32, [239, 230, 209, 255]);
  mark(img, 621, 1085, 440, colors.green);
  roundedRect(img, 306, 1510, 630, 34, 17, colors.line);
  roundedRect(img, 370, 1580, 500, 22, 11, [217, 226, 220, 210]);
  roundedRect(img, 420, 1640, 400, 22, 11, [217, 226, 220, 170]);
  circle(img, 260, 1900, 34, [39, 100, 71, 28]);
  circle(img, 982, 500, 48, [40, 79, 121, 22]);
  circle(img, 998, 2020, 42, [165, 111, 36, 24]);
  return img;
}

const mobileAssets = join(root, "apps/mobile/assets");
const webBrand = join(root, "apps/web/public/brand");

writePng(join(mobileAssets, "icon.png"), iconImage(1024));
writePng(join(mobileAssets, "adaptive-icon.png"), iconImage(1024));
writePng(join(mobileAssets, "splash.png"), splashImage());
writePng(join(mobileAssets, "notification-icon.png"), iconImage(96, true));
writePng(join(webBrand, "logo-mark.png"), iconImage(512));
writePng(join(webBrand, "apple-touch-icon.png"), iconImage(180));

console.log("Brand assets generated.");
