/**
 * 场地陈设：甬道、石桌凳、水缸、竹篱、旗杆、碑廊
 */
import * as THREE from 'three';
import { box, cylinder, merge, place, lathe, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';
import { createStele } from '../arch/details.js';

/** 沿折线的石板甬道（getY 传高度采样函数时贴地形爬坡） */
export function createPath(points, width = 2.2, y = 0.03, getY = null) {
  const geos = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.01) continue;
    const ya = getY ? getY(a.x, a.z) : y;
    const yb = getY ? getY(b.x, b.z) : y;
    const ym = (ya + yb) / 2;
    const g = box(width, 0.1, len + width * 0.55, COVER.paving);
    const mid = new THREE.Vector3((a.x + b.x) / 2, ym - 0.05, (a.z + b.z) / 2);
    const dir = new THREE.Vector3(b.x - a.x, yb - ya, b.z - a.z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    geos.push(g);
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, MAT.paving);
  m.receiveShadow = true;
  return m;
}

/** 石桌 + 四个石凳 */
export function createStoneTable(scale = 1) {
  const g = [];
  const top = cylinder(0.62, 0.62, 0.12, 16, COVER.granite);
  top.translate(0, 0.72, 0);
  g.push(top);
  const leg = cylinder(0.18, 0.24, 0.72, 10, COVER.granite);
  leg.translate(0, 0.36, 0);
  g.push(leg);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const st = cylinder(0.18, 0.2, 0.44, 10, COVER.granite);
    st.translate(Math.cos(a) * 1.05, 0.22, Math.sin(a) * 1.05);
    g.push(st);
  }
  const m = new THREE.Mesh(merge(g), MAT.granite);
  m.castShadow = true;
  m.receiveShadow = true;
  m.scale.setScalar(scale);
  return m;
}

/** 大水缸（种荷） */
export function createVat(scale = 1) {
  const pts = [
    [0, 0], [0.34, 0], [0.42, 0.08], [0.5, 0.26],
    [0.54, 0.5], [0.52, 0.62], [0.55, 0.66], [0.5, 0.68], [0, 0.68],
  ];
  const geo = lathe(pts, 18, COVER.granite);
  const m = new THREE.Mesh(geo, MAT.graniteDark);
  m.castShadow = true;
  m.receiveShadow = true;
  m.scale.setScalar(scale);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.47, 16),
    new THREE.MeshStandardMaterial({ color: 0x24322c, roughness: 0.12, metalness: 0.3 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55 * scale;
  m.add(water);
  return m;
}

/** 竹篱 */
export function createFence({ length = 10, height = 1.1, step = 0.22 } = {}) {
  const geos = [];
  const n = Math.round(length / step);
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + (length / n) * i;
    const h = height * (0.9 + Math.random() * 0.18);
    const p = cylinder(0.025, 0.03, h, 5, 1.2);
    p.translate(x, h / 2, 0);
    geos.push(p);
  }
  for (const y of [height * 0.32, height * 0.72]) {
    const rail = cylinder(0.022, 0.022, length, 5, 1.2);
    rail.rotateZ(Math.PI / 2);
    rail.translate(0, y, 0);
    geos.push(rail);
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, MAT.bark);
  m.castShadow = true;
  return m;
}

/** 碑廊：一排石碑 + 檐廊 */
export function createSteleCorridor({ length = 16, depth = 2.6, count = 8 } = {}) {
  const g = new THREE.Group();
  const geos = [];
  // 基座
  geos.push(place(box(length, 0.3, depth, COVER.granite), { y: 0.15 }));
  // 柱 + 顶
  const n = Math.max(3, Math.round(length / 3.4));
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (length / n) * i;
    geos.push(place(cylinder(0.13, 0.15, 2.9, 10, COVER.woodBeam), { x, y: 0.3 + 1.45, z: depth / 2 - 0.2 }));
  }
  const beam = new THREE.Mesh(merge(geos), MAT.woodBeam);
  beam.castShadow = true;
  beam.receiveShadow = true;
  g.add(beam);

  // 简单披檐
  for (const sz of [-1, 1]) {
    const roof = box(length + 0.8, 0.14, depth * 0.72, COVER.tile);
    roof.rotateX(sz * 0.36);
    roof.translate(0, 3.3, sz * depth * 0.22);
    const rm = new THREE.Mesh(roof, MAT.tileDark);
    rm.castShadow = true;
    g.add(rm);
  }
  // 石碑
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + (length / count) * (i + 0.5);
    const s = createStele({ width: 0.72, height: 1.55, thickness: 0.13 });
    s.position.set(x, 0.3, -depth * 0.18);
    g.add(s);
  }
  return g;
}

/** 旗杆（夹杆石 + 木杆） */
export function createFlagpole(height = 9) {
  const g = [];
  for (const dz of [-0.35, 0.35]) {
    const st = box(0.42, 1.0, 0.4, COVER.granite);
    st.translate(0, 0.5, dz);
    g.push(st);
  }
  const pole = cylinder(0.11, 0.16, height, 10, COVER.woodBeam);
  pole.translate(0, height / 2 + 0.6, 0);
  g.push(pole);
  const m = new THREE.Mesh(merge(g), MAT.granite);
  m.castShadow = true;
  const poleMesh = new THREE.Mesh(merge([pole]), MAT.woodBeam);
  poleMesh.castShadow = true;
  const grp = new THREE.Group();
  grp.add(m, poleMesh);
  return grp;
}
