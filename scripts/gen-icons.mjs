// Generates the EpiCentre mark: a filled center point with concentric
// "ripple" rings, fading outward - literally an epicentre. Pure Node, no
// image library (none available without a C toolchain in some contexts),
// hand-rolled PNG encoder + 4x4 supersampled anti-aliasing.
import zlib from "node:zlib";
import fs from "node:fs";

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

// coverage: 0 (background) to 1 (fully accent-colored) for one sample point
function coverage(dx, dy, dist) {
  const dot = 0.09; // center dot radius (fraction of half-canvas)
  if (dist < dot) return { on: true, ring: 0 };
  const rings = [
    { r: 0.34, w: 0.035, shade: 0 }, // innermost, brightest
    { r: 0.52, w: 0.03, shade: 1 },
    { r: 0.70, w: 0.025, shade: 2 }, // outermost, dimmest
  ];
  for (const r of rings) {
    if (Math.abs(dist - r.r) < r.w) return { on: true, ring: r.shade };
  }
  return { on: false, ring: -1 };
}

function makeIcon(size, accentHex, bgHex, outPath) {
  const bg = hexToRgb(bgHex);
  const bright = hexToRgb(accentHex);
  const dim = mix(bright, bg, 0.55);
  const mid = mix(bright, bg, 0.25);
  const shades = [bright, mid, dim]; // center/innermost -> outermost

  const SS = 4; // supersample factor
  const half = size / 2;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const rowSize = size * 3 + 1;

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const dx = (px - half) / half;
          const dy = (py - half) / half;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const c = coverage(dx, dy, dist);
          const color = c.on ? shades[Math.max(0, c.ring)] ?? bright : bg;
          r += color[0]; g += color[1]; b += color[2];
        }
      }
      const n = SS * SS;
      const off = y * rowSize + 1 + x * 3;
      raw[off] = Math.round(r / n);
      raw[off + 1] = Math.round(g / n);
      raw[off + 2] = Math.round(b / n);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  console.log("wrote", outPath);
}

const BG = "#000000";
const RED = "#ff3b3b";
const BLUE = "#4d8dff";

makeIcon(192, RED, BG, "public/icon-192.png");
makeIcon(512, RED, BG, "public/icon-512.png");
makeIcon(192, BLUE, BG, "public/icon-192-uat.png");
makeIcon(512, BLUE, BG, "public/icon-512-uat.png");
