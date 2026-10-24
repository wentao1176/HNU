/**
 * 树叶：程序化叶片纹理 + 交叉面片叶簇
 * 用 alphaTest 保持镂空感，避免"实心球"的塑料感
 */
import * as THREE from 'three';
import { makeCanvas, mulberry32 } from '../gfx/noise.js';

let _leafTex = null;
let _coniferTex = null;

/** 阔叶：一簇叶子（带 alpha） */
export function leafTexture(size = 256) {
  if (_leafTex) return _leafTex;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const rnd = mulberry32(20261021);

  // 画一片叶子：卵形 + 主脉 + 侧脉
  const drawLeaf = (cx, cy, len, wid, ang, hue, light) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, -len / 2, 0, len / 2);
    g.addColorStop(0, `hsl(${hue}, 42%, ${light + 12}%)`);
    g.addColorStop(1, `hsl(${hue}, 48%, ${light - 10}%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -len / 2);
    ctx.bezierCurveTo(wid, -len * 0.24, wid * 0.86, len * 0.24, 0, len / 2);
    ctx.bezierCurveTo(-wid * 0.86, len * 0.24, -wid, -len * 0.24, 0, -len / 2);
    ctx.fill();
    // 主脉
    ctx.strokeStyle = `hsla(${hue}, 34%, ${light - 18}%, 0.7)`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -len / 2);
    ctx.lineTo(0, len / 2);
    ctx.stroke();
    // 侧脉
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const y = -len / 2 + len * t;
      const w = wid * 0.7 * Math.sin(Math.PI * t);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(w * 0.6, y + len * 0.06, w, y + len * 0.12);
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(-w * 0.6, y + len * 0.06, -w, y + len * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  };

  // 随机铺满，形成一簇
  for (let i = 0; i < 46; i++) {
    const cx = size * (0.12 + rnd() * 0.76);
    const cy = size * (0.12 + rnd() * 0.76);
    const len = size * (0.16 + rnd() * 0.16);
    const wid = len * (0.34 + rnd() * 0.14);
    drawLeaf(cx, cy, len, wid, rnd() * Math.PI * 2, 86 + rnd() * 22, 26 + rnd() * 12);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  _leafTex = t;
  return t;
}

/** 针叶：松针簇 */
export function coniferTexture(size = 256) {
  if (_coniferTex) return _coniferTex;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const rnd = mulberry32(771);
  for (let i = 0; i < 90; i++) {
    const cx = size * (0.5 + (rnd() - 0.5) * 0.5);
    const cy = size * (0.5 + (rnd() - 0.5) * 0.5);
    const len = size * (0.12 + rnd() * 0.2);
    const ang = rnd() * Math.PI * 2;
    ctx.strokeStyle = `hsl(${112 + rnd() * 22}, ${34 + rnd() * 16}%, ${18 + rnd() * 14}%)`;
    ctx.lineWidth = 1.2 + rnd() * 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  _coniferTex = t;
  return t;
}

/** 交叉面片（3 片），一个叶簇 */
export function crossQuadGeometry(size = 1.0) {
  const h = size / 2;
  const pos = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    const ca = Math.cos(a), sa = Math.sin(a);
    // 每片四边形，绕 Y 轴旋转
    const p = [
      [-h * ca, -h, -h * sa],
      [h * ca, -h, h * sa],
      [h * ca, h, h * sa],
      [-h * ca, h, -h * sa],
    ];
    for (const v of p) pos.push(...v);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 叶簇材质 */
export function foliageMaterial(kind = 'broad') {
  return new THREE.MeshStandardMaterial({
    map: kind === 'conifer' ? coniferTexture() : leafTexture(),
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.86,
    metalness: 0,
    envMapIntensity: 0.55,
    transparent: false,
    depthWrite: true,
  });
}
