/**
 * 匾额 / 楹联 / 碑刻 文字贴图
 * 全部用 Canvas 绘制，字体走系统宋楷，保证中文书法感。
 */
import * as THREE from 'three';

const SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif SC", "Source Han Serif SC", serif';
const KAI = '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif';

const cache = new Map();

function canvasTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** 做旧：轻微不均匀的明度与颗粒 */
function ageCanvas(c, seed = 1) {
  const ctx = c.getContext('2d');
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  let s = seed * 9301;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 8) continue;
    const k = 0.94 + rnd() * 0.12;
    img.data[i] = Math.min(255, img.data[i] * k);
    img.data[i + 1] = Math.min(255, img.data[i + 1] * k);
    img.data[i + 2] = Math.min(255, img.data[i + 2] * k);
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * 横匾
 * @param {string} text 文字（横排，从右到左传统读法可传 reverse）
 */
export function plaqueTexture(text, o = {}) {
  const {
    w = 1024, h = 340,
    bg = '#0e0b08',
    fg = '#c9a35c',
    border = '#6b4f2a',
    font = SERIF,
    reverse = true,      // 传统匾额自右向左
    padding = 0.14,
    bold = true,
    key = null,
  } = o;
  const ck = key || `p:${text}:${w}:${h}:${bg}:${fg}`;
  if (cache.has(ck)) return cache.get(ck);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // 底
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(0.5, shadeHex(bg, 1.18));
  grad.addColorStop(1, shadeHex(bg, 0.82));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 边框
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(3, h * 0.022);
  ctx.strokeRect(ctx.lineWidth * 1.6, ctx.lineWidth * 1.6, w - ctx.lineWidth * 3.2, h - ctx.lineWidth * 3.2);

  const chars = [...text];
  const n = chars.length;
  const innerW = w * (1 - padding * 2);
  const size = Math.min(h * 0.66, (innerW / n) * 0.92);
  ctx.font = `${bold ? '700 ' : ''}${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const startX = w * padding + innerW / n / 2;
  for (let i = 0; i < n; i++) {
    const ch = reverse ? chars[n - 1 - i] : chars[i];
    const x = startX + (innerW / n) * i;
    const y = h / 2 + size * 0.02;
    // 阴刻阴影
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(ch, x + size * 0.018, y + size * 0.018);
    // 字面
    const g2 = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g2.addColorStop(0, shadeHex(fg, 1.22));
    g2.addColorStop(0.55, fg);
    g2.addColorStop(1, shadeHex(fg, 0.72));
    ctx.fillStyle = g2;
    ctx.fillText(ch, x, y);
  }
  ageCanvas(c, 7);
  const t = canvasTex(c);
  cache.set(ck, t);
  return t;
}

/** 竖联（楹联） */
export function coupletTexture(text, o = {}) {
  const {
    w = 220, h = 1024,
    bg = '#e8e0cc',
    fg = '#1a1712',
    font = KAI,
    border = null,
    key = null,
  } = o;
  const ck = key || `c:${text}:${w}:${h}:${bg}:${fg}`;
  if (cache.has(ck)) return cache.get(ck);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 木纹感
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    ctx.strokeStyle = `rgba(120,104,78,${0.02 + Math.random() * 0.05})`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 12, h * 0.35, x + (Math.random() - 0.5) * 12, h * 0.7, x, h);
    ctx.stroke();
  }

  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }

  const chars = [...text];
  const n = chars.length;
  const size = Math.min(w * 0.72, (h * 0.86) / n * 0.9);
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const top = h * 0.07 + size * 0.5;
  for (let i = 0; i < n; i++) {
    const y = top + ((h * 0.86) / n) * i;
    ctx.fillStyle = fg;
    ctx.fillText(chars[i], w / 2, y);
  }
  ageCanvas(c, 13);
  const t = canvasTex(c);
  cache.set(ck, t);
  return t;
}

/** 碑刻（深色石面 + 浅刻字） */
export function steleTexture(title, body, o = {}) {
  const { w = 512, h = 768, bg = '#6e6a60', fg = '#d8d2c2' } = o;
  const ck = `s:${title}:${body}:${w}:${h}`;
  if (cache.has(ck)) return cache.get(ck);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ts = w * 0.16;
  ctx.font = `700 ${ts}px ${SERIF}`;
  [...title].forEach((ch, i) => {
    ctx.fillText(ch, w / 2, h * 0.1 + ts * 1.2 * i);
  });
  const bs = w * 0.062;
  ctx.font = `${bs}px ${KAI}`;
  const lines = body.match(/.{1,9}/g) || [];
  lines.slice(0, 9).forEach((ln, i) => {
    ctx.fillText(ln, w / 2, h * 0.55 + bs * 1.7 * i);
  });
  ageCanvas(c, 21);
  const t = canvasTex(c);
  cache.set(ck, t);
  return t;
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * k) | 0;
  const b = Math.min(255, (n & 255) * k) | 0;
  return `rgb(${r},${g},${b})`;
}

/** 生成匾额网格（含木框） */
export function createPlaque(text, opts = {}) {
  const { width = 3.2, height = 1.05, depth = 0.14, ...texOpts } = opts;
  const g = new THREE.Group();
  const faceMat = new THREE.MeshStandardMaterial({
    map: plaqueTexture(text, texOpts),
    roughness: 0.62, metalness: 0.0, envMapIntensity: 0.22,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c10, roughness: 0.5, metalness: 0.05,
  });
  const face = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth * 0.5), [
    frameMat, frameMat, frameMat, frameMat, faceMat, frameMat,
  ]);
  face.castShadow = true;
  g.add(face);
  // 外框
  const t = depth * 0.5;
  const top = new THREE.Mesh(new THREE.BoxGeometry(width + t * 2, t, depth), frameMat);
  top.position.set(0, height / 2 + t / 2, 0);
  const bot = top.clone(); bot.position.y = -height / 2 - t / 2;
  const lf = new THREE.Mesh(new THREE.BoxGeometry(t, height + t * 2, depth), frameMat);
  lf.position.set(-width / 2 - t / 2, 0, 0);
  const rt = lf.clone(); rt.position.x = width / 2 + t / 2;
  [top, bot, lf, rt].forEach((m) => { m.castShadow = true; g.add(m); });
  return g;
}

/** 生成竖联网格 */
export function createCouplet(text, opts = {}) {
  const { width = 0.52, height = 2.6, depth = 0.08, ...texOpts } = opts;
  const mat = new THREE.MeshStandardMaterial({
    map: coupletTexture(text, texOpts),
    roughness: 0.62, metalness: 0.02, envMapIntensity: 0.6,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * 竖排文字（碑刻、牌位、书根）
 * 自右向左分列，每列自上而下
 */
export function verticalTextTexture(text, o = {}) {
  const {
    w = 256, h = 512,
    bg = '#5e5a52', fg = '#d9d2c0',
    font = KAI,
    fontSize = 0.7,
    cols = 1,
    border = false,
    key = null,
  } = o;
  const ck = key || `v:${text}:${w}:${h}:${bg}:${fg}:${cols}`;
  if (cache.has(ck)) return cache.get(ck);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 石面/木面颗粒
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  if (border) {
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(2, w * 0.02);
    ctx.strokeRect(ctx.lineWidth * 2, ctx.lineWidth * 2, w - ctx.lineWidth * 4, h - ctx.lineWidth * 4);
  }

  const chars = [...text];
  const nCol = cols;
  const perCol = Math.ceil(chars.length / nCol);
  const colW = (w * 0.9) / nCol;
  const size = Math.min(colW * 0.92, (h * 0.9) / perCol * 0.92, h * fontSize);

  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < chars.length; i++) {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    // 自右向左排列
    const x = w * 0.95 - colW * (col + 0.5);
    const y = h * 0.05 + ((h * 0.9) / perCol) * (row + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(chars[i], x + size * 0.02, y + size * 0.02);
    ctx.fillStyle = fg;
    ctx.fillText(chars[i], x, y);
  }

  ageCanvas(c, 29);
  const t = canvasTex(c);
  cache.set(ck, t);
  return t;
}

/** 书根 / 函套题签（窄横条） */
export function bookLabelTexture(text, o = {}) {
  const { w = 128, h = 48, bg = '#d8cba8', fg = '#2a2018' } = o;
  const ck = `b:${text}:${w}:${h}`;
  if (cache.has(ck)) return cache.get(ck);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(90,70,40,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  const size = h * 0.6;
  ctx.font = `${size}px ${KAI}`;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  ageCanvas(c, 17);
  const t = canvasTex(c);
  cache.set(ck, t);
  return t;
}
