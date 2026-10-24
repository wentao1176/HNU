/**
 * 几何工具
 * 统一约定：所有 UV 以「米」为单位烘焙，除以材质覆盖尺寸后可直接使用。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 按法线主方向投影烘焙 box 类几何的 UV（单位：米 / cover） */
export function bakeBoxUV(geo, cover = 1) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = pz; v = py; }
    else if (ny >= nx && ny >= nz) { u = px; v = pz; }
    else { u = px; v = py; }
    uv[i * 2] = u / cover;
    uv[i * 2 + 1] = v / cover;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** 带米制 UV 的长方体 */
export function box(w, h, d, cover = 1, segs = 1) {
  const g = new THREE.BoxGeometry(w, h, d, segs, segs, segs);
  return bakeBoxUV(g, cover);
}

/** 圆柱（柱、檩、椽），UV：u 沿周向、v 沿轴向，单位米 */
export function cylinder(rTop, rBot, h, radial = 12, cover = 1, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, radial, 1, open);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const circ = Math.PI * (rTop + rBot);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const ang = Math.atan2(pz, px);
    uv[i * 2] = (ang / (Math.PI * 2)) * (circ / cover);
    uv[i * 2 + 1] = (py / cover);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** 平面（水平），UV 单位米 */
export function plane(w, d, cover = 1, segW = 1, segD = 1) {
  const g = new THREE.PlaneGeometry(w, d, segW, segD);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / cover, pos.getZ(i) / cover);
  }
  uv.needsUpdate = true;
  return g;
}

/** 合并几何体数组（自动忽略缺失属性） */
export function merge(geos, useGroups = false) {
  const list = geos.filter(Boolean);
  if (!list.length) return null;
  // 统一属性集合，避免 merge 报错
  // 只有当所有输入都带顶点色时才保留 color，避免误删或误加
  const keepColor = list.every((g) => !!g.attributes.color);
  const allowed = keepColor
    ? ['position', 'normal', 'uv', 'color']
    : ['position', 'normal', 'uv'];
  for (const g of list) {
    for (const k of Object.keys(g.attributes)) {
      if (!allowed.includes(k)) g.deleteAttribute(k);
    }
    for (const k of allowed) {
      if (!g.attributes[k]) {
        const count = g.attributes.position.count;
        const arr = new Float32Array(count * (k === 'uv' ? 2 : 3));
        g.setAttribute(k, new THREE.BufferAttribute(arr, k === 'uv' ? 2 : 3));
      }
    }
    if (!g.index) {
      const count = g.attributes.position.count;
      const idx = new Uint32Array(count);
      for (let i = 0; i < count; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
  }
  const out = mergeGeometries(list, useGroups);
  return out;
}

/** 把几何体变换后加入列表 */
export function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  const g = geo.clone();
  g.applyMatrix4(m);
  return g;
}

/** 旋转体（柱础、宝顶、香炉、瓦当） */
export function lathe(points, segs = 24, cover = 1) {
  const v2 = points.map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(v2, segs);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const ang = Math.atan2(pz, px);
    uv[i * 2] = (ang / (Math.PI * 2)) * 2;
    uv[i * 2 + 1] = py / cover;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** 沿曲线的方截面梁（用于檩条、额枋、栏杆扶手） */
export function beamAlong(p0, p1, w, h, cover = 1) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const g = box(w, h, len, cover);
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  const m = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

/** 楔形（用于椽子、脊饰的斜切件） */
export function wedge(w, h, d, cover = 1) {
  const g = new THREE.BufferGeometry();
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const v = new Float32Array([
    // 底面
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd,
    -hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    // 顶面（收窄）
    -hw * 0.6, hh, -hd, hw * 0.6, hh, hd, hw * 0.6, hh, -hd,
    -hw * 0.6, hh, -hd, -hw * 0.6, hh, hd, hw * 0.6, hh, hd,
    // 侧面
    -hw, -hh, -hd, -hw * 0.6, hh, -hd, hw * 0.6, hh, -hd,
    -hw, -hh, -hd, hw * 0.6, hh, -hd, hw, -hh, -hd,
    hw, -hh, -hd, hw * 0.6, hh, -hd, hw * 0.6, hh, hd,
    hw, -hh, -hd, hw * 0.6, hh, hd, hw, -hh, hd,
    hw, -hh, hd, hw * 0.6, hh, hd, -hw * 0.6, hh, hd,
    hw, -hh, hd, -hw * 0.6, hh, hd, -hw, -hh, hd,
    -hw, -hh, hd, -hw * 0.6, hh, hd, -hw * 0.6, hh, -hd,
    -hw, -hh, hd, -hw * 0.6, hh, -hd, -hw, -hh, -hd,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  const uv = new Float32Array((v.length / 3) * 2);
  for (let i = 0; i < v.length / 3; i++) {
    uv[i * 2] = v[i * 3] / cover;
    uv[i * 2 + 1] = v[i * 3 + 1] / cover;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** 网格辅助：把三角形/四边形列表拼成几何 */
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.idx = [];
    this.nor = [];
    this.count = 0;
  }

  /** 四点四边形（逆时针），uv 直接给出 */
  quad(a, b, c, d, ua, ub, uc, ud) {
    const base = this.count;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1], ud[0], ud[1]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count += 4;
  }

  tri(a, b, c, ua, ub, uc) {
    const base = this.count;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    this.idx.push(base, base + 1, base + 2);
    this.count += 3;
  }

  build(computeNormals = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    if (computeNormals) g.computeVertexNormals();
    return g;
  }
}

/** 平滑步进 */
export function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** 顶点着色：给几何体写入统一的 color 属性（供树叶等使用） */
export function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
