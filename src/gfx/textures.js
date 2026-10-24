/**
 * 程序化 PBR 贴图库
 * 全部由 Canvas 实时绘制，零外部依赖、零网络请求。
 * 返回 { map, normalMap, roughnessMap }，UV 以「米」为单位在几何阶段烘焙。
 */
import * as THREE from 'three';
import {
  makeCanvas, fbm, tileNoise, worley, ridged, mulberry32,
  heightToNormalCanvas, grayToCanvas, grain, weather, clamp01,
} from './noise.js';

let ANISO = 8;
export function setAnisotropy(v) { ANISO = v; }

const cache = new Map();

function tex(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  return t;
}

/** 组装一套贴图 */
function pack(mapC, normalC, roughC) {
  return {
    map: tex(mapC, true),
    normalMap: normalC ? tex(normalC, false) : null,
    roughnessMap: roughC ? tex(roughC, false) : null,
  };
}

/* ─────────────────────────────────────────────
   1. 青砖墙 —— 书院最主要的墙体材料
   UV 覆盖 1.8m × 1.8m，24 皮砖、每皮 8 块
   ───────────────────────────────────────────── */
function buildBrick(size = 1024) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rows = 24;
  const cols = 8;
  const rowH = size / rows;
  const colW = size / cols;
  const height = new Float32Array(size * size).fill(0.12);
  const rough = new Float32Array(size * size).fill(0.94);
  const rnd = mulberry32(20240976);

  ctx.fillStyle = 'rgb(48, 50, 48)';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? 0 : colW * 0.5;
    for (let k = -1; k <= cols; k++) {
      const x = k * colW + off;
      const y = r * rowH;
      const w = colW - 2.2;
      const h = rowH - 2.2;
      // 每块砖独立的色差与质感
      const v = 0.86 + rnd() * 0.26;
      const warm = 0.98 + rnd() * 0.07;
      const R = 138 * v * warm;
      const G = 143 * v;
      const B = 145 * v * (1.02 - (warm - 1) * 0.6);
      ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      ctx.fillRect(x + 1.1, y + 1.1, w, h);

      // 砖面细微斑驳
      const spot = 3 + (rnd() * 5) | 0;
      for (let s = 0; s < spot; s++) {
        const sx = x + 1.1 + rnd() * w;
        const sy = y + 1.1 + rnd() * h;
        const sr = 1 + rnd() * 7;
        const dark = rnd() > 0.45;
        ctx.fillStyle = dark
          ? `rgba(60,62,62,${0.04 + rnd() * 0.09})`
          : `rgba(168,168,160,${0.03 + rnd() * 0.07})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * (0.5 + rnd()), rnd() * 3.14, 0, 6.283);
        ctx.fill();
      }

      // 高度：砖面凸起，四边略塌
      const y0 = Math.max(0, Math.floor(y + 1.1));
      const y1 = Math.min(size, Math.ceil(y + 1.1 + h));
      const x0 = Math.max(0, Math.floor(x + 1.1));
      const x1 = Math.min(size, Math.ceil(x + 1.1 + w));
      for (let py = y0; py < y1; py++) {
        const ey = Math.min(py - (y + 1.1), (y + 1.1 + h) - py);
        const eyy = Math.min(1, ey / 5);
        for (let px = x0; px < x1; px++) {
          const ex = Math.min(px - (x + 1.1), (x + 1.1 + w) - px);
          const exx = Math.min(1, ex / 5);
          const i = py * size + px;
          height[i] = 0.55 + 0.35 * exx * eyy;
          rough[i] = 0.9 + 0.06 * (1 - exx * eyy);
        }
      }
    }
  }

  // 砖缝里长出的苔痕与雨痕
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.fillStyle = `rgba(${86 + rnd() * 30 | 0},${96 + rnd() * 26 | 0},${70 + rnd() * 20 | 0},${0.05 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rnd() * 26, 3 + rnd() * 14, rnd() * 3.14, 0, 6.283);
    ctx.fill();
  }

  // 雨痕：从上方垂下的纵向水渍
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size;
    const w = 2 + rnd() * 22;
    const len = size * (0.2 + rnd() * 0.75);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(52,54,52,${0.05 + rnd() * 0.12})`);
    g.addColorStop(0.7, `rgba(52,54,52,${0.02 + rnd() * 0.05})`);
    g.addColorStop(1, 'rgba(52,54,52,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, len);
  }
  // 底部潮痕
  const damp = ctx.createLinearGradient(0, size * 0.72, 0, size);
  damp.addColorStop(0, 'rgba(48,52,46,0)');
  damp.addColorStop(1, 'rgba(48,52,46,0.22)');
  ctx.fillStyle = damp;
  ctx.fillRect(0, size * 0.72, size, size * 0.28);

  weather(ctx, size, { strength: 0.2, freq: 3, octaves: 5, seed: 11 });
  grain(ctx, size, 12, 77);

  return pack(c, heightToNormalCanvas(height, size, 1.6), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   2. 白粉墙 —— 山墙、院墙内侧
   ───────────────────────────────────────────── */
function buildPlaster(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = fbm(u, v, 3, 5, 5);
      const n2 = fbm(u, v, 12, 4, 21);
      const n3 = tileNoise(u * 160, v * 160, 160, 9);
      // 石灰抹面：暖白，略有起伏
      const base = 0.855 + (n1 - 0.5) * 0.1 + (n2 - 0.5) * 0.05;
      const r = clamp01(base * 1.005) * 255;
      const g = clamp01(base * 0.995) * 255;
      const b = clamp01(base * 0.945) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.12;
      rough[idx] = 0.88 + (n2 - 0.5) * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 雨渍：从上部垂下的淡色水痕
  const rnd = mulberry32(404);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size;
    const w = 2 + rnd() * 16;
    const len = size * (0.15 + rnd() * 0.6);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(150,148,138,${0.05 + rnd() * 0.07})`);
    g.addColorStop(1, 'rgba(150,148,138,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, len);
  }
  // 霉斑：低处成片的灰绿
  for (let i = 0; i < 120; i++) {
    const x = rnd() * size;
    const y = size * (0.55 + rnd() * 0.45);
    const r = 6 + rnd() * 42;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(96,102,84,${0.03 + rnd() * 0.07})`);
    g.addColorStop(1, 'rgba(96,102,84,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 剥落：露出底层的浅色斑块
  for (let i = 0; i < 18; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rnd() * 16, 3 + rnd() * 12, rnd() * 3.14, 0, 6.283);
    ctx.fillStyle = `rgba(210,204,188,${0.10 + rnd() * 0.14})`;
    ctx.fill();
  }

  weather(ctx, size, { strength: 0.1, freq: 5, octaves: 4, seed: 33, tint: [1, 1, 0.96] });
  grain(ctx, size, 9, 12);

  return pack(c, heightToNormalCanvas(height, size, 1.1), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   3. 木作
   variant: 'lacquer' 朱漆柱 | 'beam' 深褐梁枋 | 'plank' 木板
   ───────────────────────────────────────────── */
function buildWood(size = 512, variant = 'lacquer') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const img = ctx.createImageData(size, size);

  const palette = {
    lacquer: [104, 40, 30],
    beam: [66, 46, 33],
    plank: [92, 70, 48],
  }[variant];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // 沿 v 方向的木纹：高频横向 + 低频扭曲
      const warp = fbm(u, v, 3, 3, 61) * 1.6;
      const rings = Math.sin((u * 34 + warp * 2.4) * Math.PI) * 0.5 + 0.5;
      const fine = tileNoise(u * 90, v * 6, 90, 71) * 0.35;
      const knot = Math.pow(1 - Math.abs(fbm(u, v, 6, 3, 83) - 0.5) * 2, 6);
      let k = 0.78 + rings * 0.16 + fine * 0.18 - knot * 0.22;
      if (variant === 'lacquer') {
        // 漆面：纹路被漆覆盖，只留极淡的起伏
        k = 0.94 + rings * 0.05 + fine * 0.04;
      }
      const i = (y * size + x) * 4;
      img.data[i] = clamp01((palette[0] / 255) * k) * 255;
      img.data[i + 1] = clamp01((palette[1] / 255) * k) * 255;
      img.data[i + 2] = clamp01((palette[2] / 255) * k) * 255;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + rings * 0.16 + fine * 0.1;
      rough[idx] = variant === 'lacquer'
        ? 0.34 + fine * 0.14
        : 0.72 + rings * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);

  if (variant === 'lacquer') {
    // 漆面开裂：细密的不规则裂纹
    const cr = mulberry32(313);
    for (let i = 0; i < 90; i++) {
      let x = cr() * size;
      let y = cr() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 3 + Math.floor(cr() * 5);
      for (let k = 0; k < segs; k++) {
        x += (cr() - 0.5) * size * 0.06;
        y += (cr() - 0.5) * size * 0.06;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(30,16,10,${0.06 + cr() * 0.12})`;
      ctx.lineWidth = 0.6 + cr() * 1.4;
      ctx.stroke();
    }
  }
  grain(ctx, size, 6, 5);
  return pack(c, heightToNormalCanvas(height, size, 1.4), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   4. 花岗岩 / 条石
   ───────────────────────────────────────────── */
function buildGranite(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(9091);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u, v, 6, 5, 17);
      const speck = tileNoise(u * 260, v * 260, 260, 23);
      const dark = speck > 0.78 ? 1 : 0;
      let base = 0.52 + (n - 0.5) * 0.18 - dark * 0.18 + (speck - 0.5) * 0.1;
      const i = (y * size + x) * 4;
      img.data[i] = clamp01(base * 1.02) * 255;
      img.data[i + 1] = clamp01(base * 1.0) * 255;
      img.data[i + 2] = clamp01(base * 0.95) * 255;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + (n - 0.5) * 0.5 + (speck - 0.5) * 0.25;
      rough[idx] = 0.74 + (speck - 0.5) * 0.12;
    }
  }
  ctx.putImageData(img, 0, 0);
  grain(ctx, size, 16, 41);
  return pack(c, heightToNormalCanvas(height, size, 1.8), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   5. 方砖铺地
   UV 覆盖 2.4m × 2.4m，6×6 块 40cm 方砖
   ───────────────────────────────────────────── */
function buildPaving(size = 1024) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const n = 6;
  const cell = size / n;
  const height = new Float32Array(size * size).fill(0.1);
  const rough = new Float32Array(size * size).fill(0.9);
  const rnd = mulberry32(555);

  ctx.fillStyle = 'rgb(58,60,58)';
  ctx.fillRect(0, 0, size, size);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cell;
      const y = j * cell;
      const v = 0.82 + rnd() * 0.3;
      const R = 118 * v;
      const G = 120 * v;
      const B = 116 * v;
      ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      const pad = 2.5;
      ctx.fillRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);
      // 砖面磨损斑
      for (let s = 0; s < 14; s++) {
        const sx = x + pad + rnd() * (cell - pad * 2);
        const sy = y + pad + rnd() * (cell - pad * 2);
        ctx.fillStyle = rnd() > 0.5
          ? `rgba(150,150,144,${0.03 + rnd() * 0.07})`
          : `rgba(62,64,62,${0.03 + rnd() * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 2 + rnd() * 18, 2 + rnd() * 12, rnd() * 3, 0, 6.283);
        ctx.fill();
      }
      for (let py = Math.floor(y + pad); py < Math.min(size, y + cell - pad); py++) {
        for (let px = Math.floor(x + pad); px < Math.min(size, x + cell - pad); px++) {
          const idx = py * size + px;
          height[idx] = 0.62 + rnd() * 0.02;
          rough[idx] = 0.82;
        }
      }
    }
  }
  weather(ctx, size, { strength: 0.12, freq: 4, octaves: 4, seed: 71 });
  grain(ctx, size, 10, 3);
  return pack(c, heightToNormalCanvas(height, size, 1.2), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   6. 青瓦屋面（配合几何瓦垄使用）
   UV 覆盖 1.2m
   ───────────────────────────────────────────── */
function buildTile(size = 512, tint = [70, 76, 78]) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u, v, 5, 5, 101);
      const fine = tileNoise(u * 140, v * 140, 140, 37);
      const moss = Math.max(0, fbm(u, v, 3, 4, 55) - 0.58) * 2.2;
      // 瓦垄：u 方向 4 垄 / 1.2m，垄间为板瓦凹槽
      const flute = Math.cos(v * Math.PI * 2 * 4);
      const fluteShade = 0.70 + flute * 0.30;
      const k = (0.8 + (n - 0.5) * 0.34 + (fine - 0.5) * 0.16) * fluteShade;
      const i = (y * size + x) * 4;
      img.data[i] = clamp01((tint[0] / 255) * k + moss * 0.05) * 255;
      img.data[i + 1] = clamp01((tint[1] / 255) * k + moss * 0.13) * 255;
      img.data[i + 2] = clamp01((tint[2] / 255) * k + moss * 0.03) * 255;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + (n - 0.5) * 0.5 + (fine - 0.5) * 0.3 + flute * 0.26;
      rough[idx] = 0.68 + (fine - 0.5) * 0.2 + moss * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  grain(ctx, size, 8, 19);
  return pack(c, heightToNormalCanvas(height, size, 1.7), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   7. 绿琉璃瓦
   ───────────────────────────────────────────── */
function buildGlazed(size = 512, tint = [0.10, 0.36, 0.22]) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u, v, 4, 4, 211);
      const streak = tileNoise(u * 8, v * 220, 220, 13);
      const flute = Math.cos(v * Math.PI * 2 * 4);
      const k = (0.86 + (n - 0.5) * 0.3 + (streak - 0.5) * 0.14) * (0.9 + flute * 0.1);
      const i = (y * size + x) * 4;
      img.data[i] = clamp01(tint[0] * k) * 255;
      img.data[i + 1] = clamp01(tint[1] * k) * 255;
      img.data[i + 2] = clamp01(tint[2] * k) * 255;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + (n - 0.5) * 0.35 + flute * 0.16;
      rough[idx] = 0.16 + (n - 0.5) * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  return pack(c, heightToNormalCanvas(height, size, 0.9), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   8. 梁枋彩画（青绿旋子）
   ───────────────────────────────────────────── */
function buildCaihua(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d4a49';
  ctx.fillRect(0, 0, size, size);

  // 上下箍头
  ctx.fillStyle = '#12353a';
  ctx.fillRect(0, 0, size, size * 0.1);
  ctx.fillRect(0, size * 0.9, size, size * 0.1);
  ctx.fillStyle = '#c8a86a';
  ctx.fillRect(0, size * 0.095, size, 2);
  ctx.fillRect(0, size * 0.895, size, 2);

  // 旋花
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r0 = size * 0.3;
  const drawPetal = (r, w, color, rot) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(r, 0, w, w * 0.55, 0, 0, 6.283);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };
  for (let ring = 0; ring < 3; ring++) {
    const rr = r0 * (0.42 + ring * 0.3);
    const count = 8 + ring * 4;
    for (let i = 0; i < count; i++) {
      drawPetal(rr, r0 * 0.13, ring % 2 ? '#d8c48e' : '#7fb0a8', (i / count) * Math.PI * 2);
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r0 * 0.2, 0, 6.283);
  ctx.fillStyle = '#c8a86a';
  ctx.fill();

  // 退晕
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.62);
  g.addColorStop(0, 'rgba(255,240,200,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  grain(ctx, size, 7, 66);
  const rough = new Float32Array(size * size).fill(0.62);
  return pack(c, null, grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   9. 汉白玉 / 碑石
   ───────────────────────────────────────────── */
function buildMarble(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const vein = Math.abs(Math.sin((u * 6 + fbm(u, v, 3, 4, 91) * 5) * Math.PI));
      const base = 0.88 - Math.pow(vein, 8) * 0.12 + (fbm(u, v, 8, 3, 3) - 0.5) * 0.05;
      const i = (y * size + x) * 4;
      img.data[i] = clamp01(base * 1.0) * 255;
      img.data[i + 1] = clamp01(base * 0.995) * 255;
      img.data[i + 2] = clamp01(base * 0.96) * 255;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + (fbm(u, v, 10, 3, 7) - 0.5) * 0.3;
      rough[idx] = 0.3 + (fbm(u, v, 6, 3, 12) - 0.5) * 0.12;
    }
  }
  ctx.putImageData(img, 0, 0);
  grain(ctx, size, 5, 8);
  return pack(c, heightToNormalCanvas(height, size, 0.7), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   10. 地面：草地 / 泥土
   ───────────────────────────────────────────── */
function buildGround(size = 512, kind = 'grass') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const img = ctx.createImageData(size, size);
  const palette = kind === 'grass'
    ? { r: 88, g: 100, b: 66, varr: 26 }
    : { r: 132, g: 118, b: 90, varr: 20 };
  const rnd = mulberry32(kind === 'grass' ? 31 : 57);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = fbm(u, v, 4, 5, 41);
      const n2 = fbm(u, v, 16, 4, 67);
      const blade = tileNoise(u * 300, v * 300, 300, 5);
      const dry = Math.max(0, fbm(u * 0.5, v * 0.5, 3, 4, 919) - 0.56) * 1.8;
      const k = 0.74 + n1 * 0.34 + (n2 - 0.5) * 0.18 + (blade - 0.5) * 0.14;
      const i = (y * size + x) * 4;
      img.data[i] = clamp01((palette.r / 255) * k + dry * 0.16) * 255;
      img.data[i + 1] = clamp01((palette.g / 255) * k + dry * 0.10) * 255;
      img.data[i + 2] = clamp01((palette.b / 255) * k + dry * 0.02) * 255;
      img.data[i + 3] = 255;
      const idx = y * size + x;
      height[idx] = 0.5 + (n2 - 0.5) * 0.6 + (blade - 0.5) * 0.5;
      rough[idx] = 0.92;
    }
  }
  ctx.putImageData(img, 0, 0);
  grain(ctx, size, 14, 21);
  return pack(c, heightToNormalCanvas(height, size, 1.3), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   11. 树皮
   ───────────────────────────────────────────── */
function buildBark(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size).fill(0.9);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const r = ridged(u, v * 0.25, 7, 4, 13);
      const n = fbm(u, v, 9, 4, 77);
      const k = 0.42 + r * 0.55 + (n - 0.5) * 0.2;
      const i = (y * size + x) * 4;
      img.data[i] = clamp01(0.30 * k) * 255;
      img.data[i + 1] = clamp01(0.24 * k) * 255;
      img.data[i + 2] = clamp01(0.19 * k) * 255;
      img.data[i + 3] = 255;
      height[y * size + x] = r;
    }
  }
  ctx.putImageData(img, 0, 0);
  return pack(c, heightToNormalCanvas(height, size, 2.4), grayToCanvas(rough, size));
}

/* ─────────────────────────────────────────────
   12. 黑漆匾额底板（金字由 text.js 另绘）
   ───────────────────────────────────────────── */
function buildLacquerBoard(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14100d';
  ctx.fillRect(0, 0, size, size);
  weather(ctx, size, { strength: 0.24, freq: 5, octaves: 4, seed: 88 });
  grain(ctx, size, 8, 44);
  const rough = new Float32Array(size * size).fill(0.22);
  return pack(c, null, grayToCanvas(rough, size));
}

const BUILDERS = {
  brick: () => buildBrick(1024),
  plaster: () => buildPlaster(768),
  woodLacquer: () => buildWood(768, 'lacquer'),
  woodBeam: () => buildWood(512, 'beam'),
  woodPlank: () => buildWood(512, 'plank'),
  granite: () => buildGranite(512),
  paving: () => buildPaving(1024),
  tile: () => buildTile(768, [82, 88, 92]),
  tileDark: () => buildTile(512, [62, 68, 72]),
  glazed: () => buildGlazed(512, [0.08, 0.27, 0.17]),
  glazedYellow: () => buildGlazed(512, [0.50, 0.35, 0.06]),
  caihua: () => buildCaihua(512),
  marble: () => buildMarble(512),
  grass: () => buildGround(512, 'grass'),
  earth: () => buildGround(512, 'earth'),
  bark: () => buildBark(256),
  lacquerBoard: () => buildLacquerBoard(256),
};

export const TEX = new Proxy({}, {
  get(_, key) {
    if (!BUILDERS[key]) return undefined;
    if (!cache.has(key)) cache.set(key, BUILDERS[key]());
    return cache.get(key);
  },
});

/** 预热：载入阶段依次生成，配合进度回调 */
export async function prewarmTextures(onProgress) {
  const keys = Object.keys(BUILDERS);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!cache.has(k)) cache.set(k, BUILDERS[k]());
    if (onProgress) onProgress((i + 1) / keys.length, k);
    // 让出主线程，避免白屏
    if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
  }
}
