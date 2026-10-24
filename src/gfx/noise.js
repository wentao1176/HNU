/**
 * 噪声与程序化贴图基础工具
 * 全部为可平铺（tileable）噪声，保证贴图重复时无缝。
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 周期性 value noise，period 为整数格数 */
export function tileNoise(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

/** 分形叠加，uv ∈ [0,1)，baseFreq 为基础格数 */
export function fbm(u, v, baseFreq, octaves, seed, gain = 0.5) {
  let amp = 1;
  let freq = baseFreq;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(u * freq, v * freq, freq, seed + o * 97);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

/** 脊状噪声，用于岩石、树皮 */
export function ridged(u, v, baseFreq, octaves, seed) {
  let amp = 1;
  let freq = baseFreq;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(u * freq, v * freq, freq, seed + o * 131);
    sum += amp * (1 - Math.abs(n * 2 - 1));
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** 可平铺 worley（细胞）噪声，返回 [F1, F2, cellRand] */
export function worley(u, v, cells, seed) {
  const x = u * cells;
  const y = v * cells;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 1e9;
  let f2 = 1e9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const wx = ((cx % cells) + cells) % cells;
      const wy = ((cy % cells) + cells) % cells;
      const px = cx + hash2(wx, wy, seed);
      const py = cy + hash2(wx, wy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(wx, wy, seed + 13);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return [f1, f2, id];
}

export function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** 从高度数据（Float32Array, 0..1）生成法线贴图 canvas */
export function heightToNormalCanvas(height, size, strength = 2.2) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      let nx = dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 灰度数组 → canvas（用于粗糙度/环境遮蔽） */
export function grayToCanvas(gray, size) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const g = clamp01(gray[i]) * 255;
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function rgb(r, g, b) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function shade(base, amount) {
  return [
    clamp01(base[0] * amount) * 255,
    clamp01(base[1] * amount) * 255,
    clamp01(base[2] * amount) * 255,
  ];
}

/** 在 canvas 上叠加细腻颗粒，模拟材质表面 */
export function grain(ctx, size, amount, seed, scale = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** 大尺度污渍 / 风化：用 fbm 调制明度，让墙面不平整 */
export function weather(ctx, size, opts = {}) {
  const { strength = 0.16, freq = 4, octaves = 5, seed = 3, tint = [0.62, 0.64, 0.6] } = opts;
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u, v, freq, octaves, seed);
      const k = 1 + (n - 0.5) * 2 * strength;
      const i = (y * size + x) * 4;
      img.data[i] = clamp01((img.data[i] / 255) * k * (1 - strength * 0.4 + n * strength * 0.4 * tint[0])) * 255;
      img.data[i + 1] = clamp01((img.data[i + 1] / 255) * k * (1 - strength * 0.4 + n * strength * 0.4 * tint[1])) * 255;
      img.data[i + 2] = clamp01((img.data[i + 2] / 255) * k * (1 - strength * 0.4 + n * strength * 0.4 * tint[2])) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
