/**
 * 古建细部构件库
 * 柱、斗拱、隔扇、栏杆、踏跺、石狮、香炉、灯笼、碑
 */
import * as THREE from 'three';
import { box, cylinder, merge, place, lathe, beamAlong, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';

/* ─────────────────────────────────────────────
   柱 + 柱础
   ───────────────────────────────────────────── */

/** 柱身几何：24 边、收分（上细下粗）、柱头卷杀 */
export function columnGeo(radius = 0.24, height = 4.4, segs = 24) {
  // 卷杀：柱身上段按《营造法式》收分，柱头略作圆弧
  const pts = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // 梭柱：中段略鼓，上下收
    const r = radius * (1.0 - t * 0.12 + Math.sin(t * Math.PI) * 0.035);
    pts.push([r, height * t]);
  }
  const geo = new THREE.LatheGeometry(
    pts.map((p) => new THREE.Vector2(p[0], p[1])),
    segs,
  );
  // 米制 UV
  const uv = new Float32Array(geo.attributes.position.count * 2);
  const circ = Math.PI * 2 * radius;
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const px = geo.attributes.position.getX(i);
    const py = geo.attributes.position.getY(i);
    const pz = geo.attributes.position.getZ(i);
    uv[i * 2] = (Math.atan2(pz, px) / (Math.PI * 2)) * (circ / COVER.woodLacquer);
    uv[i * 2 + 1] = py / COVER.woodLacquer;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** 柱础几何：圭角 + 下枋 + 束腰 + 上枋 + 覆盆 */
export function columnBaseGeo(radius = 0.24) {
  const R = radius;
  const pts = [
    [0, 0], [R * 1.86, 0], [R * 1.86, 0.05],
    [R * 1.78, 0.08], [R * 1.72, 0.13],
    [R * 1.56, 0.15], [R * 1.52, 0.20],
    [R * 1.40, 0.22], [R * 1.36, 0.27],
    [R * 1.46, 0.30], [R * 1.44, 0.34],
    [R * 1.28, 0.38], [R * 1.20, 0.44],
    [R * 1.14, 0.48], [R * 1.06, 0.50], [0, 0.50],
  ];
  return lathe(pts, 24, COVER.granite);
}

export function createColumn({ height = 4.2, radius = 0.22, base = true, material = MAT.woodLacquer } = {}) {
  const g = [];
  g.push(columnGeo(radius, height, 24));
  if (base) g.push(columnBaseGeo(radius));
  const geo = merge(g);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ─────────────────────────────────────────────
   斗拱（一朵，清式单翘单昂五踩简化）
   坐斗 → 翘（两跳）→ 昂 → 耍头 → 横拱（泥道/慢/令）→ 升
   局部坐标：原点在坐斗底面中心，+z 为出跳方向
   ───────────────────────────────────────────── */
export function createDougongSet({ count = 6, spacing = 1.15, depthOut = 0.42, scale = 1, mat = null } = {}) {
  const geos = [];
  const s = scale;
  const M = mat || MAT.greenPaint;
  const push = (g, x, y, z) => { g.translate(x, y, z); geos.push(g); };

  /** 斗：下小上大的方斗，带斗欹（用三层叠出） */
  const douBlock = (w, h, d, x, y, z, taper = 0.72) => {
    const layers = 3;
    for (let k = 0; k < layers; k++) {
      const t = k / (layers - 1);
      const ww = w * (taper + (1 - taper) * t);
      const dd = d * (taper + (1 - taper) * t);
      const g = box(ww, h / layers, dd, COVER.caihua);
      push(g, x, y + (h / layers) * (k + 0.5), z);
    }
  };

  /** 拱：细长横木，端部做卷杀（用端头小方块示意） */
  const gong = (len, h, d, x, y, z, axis = 'x') => {
    if (axis === 'x') {
      const g = box(len, h, d, COVER.caihua);
      push(g, x, y, z);
      // 两端卷杀
      for (const sx of [-1, 1]) {
        const e = box(h * 0.9, h * 0.86, d * 0.9, COVER.caihua);
        push(e, x + sx * (len / 2 - h * 0.3), y - h * 0.05, z);
      }
    } else {
      const g = box(d, h, len, COVER.caihua);
      push(g, x, y, z);
      for (const sz of [-1, 1]) {
        const e = box(d * 0.9, h * 0.86, h * 0.9, COVER.caihua);
        push(e, x, y - h * 0.05, z + sz * (len / 2 - h * 0.3));
      }
    }
  };

  for (let i = 0; i < count; i++) {
    const X = (i - (count - 1) / 2) * spacing;
    const y0 = 0;

    // ① 坐斗
    douBlock(0.34 * s, 0.2 * s, 0.34 * s, X, y0, 0, 0.66);

    // ② 第一跳：翘（沿 z 出跳）+ 泥道拱（沿 x）
    const y1 = y0 + 0.2 * s;
    const out1 = depthOut * 0.62;
    const q1 = box(0.13 * s, 0.14 * s, out1 + 0.3 * s, COVER.caihua);
    push(q1, X, y1 + 0.07 * s, out1 * 0.5 - 0.1 * s);
    gong(0.78 * s, 0.14 * s, 0.16 * s, X, y1 + 0.07 * s, 0, 'x');
    // 升（拱端小斗）
    for (const sx of [-1, 1]) {
      douBlock(0.16 * s, 0.1 * s, 0.16 * s, X + sx * 0.3 * s, y1 + 0.14 * s, 0, 0.78);
    }
    douBlock(0.15 * s, 0.09 * s, 0.15 * s, X, y1 + 0.14 * s, out1 * 0.5 - 0.1 * s, 0.78);

    // ③ 第二跳：翘 + 慢拱
    const y2 = y1 + 0.24 * s;
    const out2 = depthOut * 1.05;
    const q2 = box(0.12 * s, 0.13 * s, out2 + 0.2 * s, COVER.caihua);
    push(q2, X, y2 + 0.065 * s, out2 * 0.5 - 0.05 * s);
    gong(1.0 * s, 0.13 * s, 0.15 * s, X, y2 + 0.065 * s, 0, 'x');
    for (const sx of [-1, 1]) {
      douBlock(0.15 * s, 0.09 * s, 0.15 * s, X + sx * 0.4 * s, y2 + 0.13 * s, 0, 0.78);
    }
    douBlock(0.14 * s, 0.09 * s, 0.14 * s, X, y2 + 0.13 * s, out2 * 0.55, 0.78);

    // ④ 昂：斜向下的挑出构件
    const y3 = y2 + 0.22 * s;
    const angGeo = new THREE.BoxGeometry(0.11 * s, 0.1 * s, depthOut * 2.0 * s);
    angGeo.rotateX(-0.34);
    angGeo.translate(0, 0, 0);
    const auv = angGeo.attributes.uv;
    for (let k = 0; k < auv.count; k++) auv.setXY(k, auv.getX(k) * 0.4, auv.getY(k) * 0.4);
    push(angGeo, X, y3 + 0.05 * s, depthOut * 0.62);

    // ⑤ 令拱（最外一跳的横拱）+ 耍头
    gong(0.9 * s, 0.12 * s, 0.14 * s, X, y3 + 0.1 * s, depthOut * 1.18, 'x');
    const shuatou = box(0.12 * s, 0.11 * s, 0.34 * s, COVER.caihua);
    push(shuatou, X, y3 + 0.1 * s, depthOut * 1.32);

    // ⑥ 挑檐枋（承托屋檐的通长构件）
    const tiaoyan = box(0.14 * s, 0.14 * s, 0.16 * s, COVER.caihua);
    push(tiaoyan, X, y3 + 0.22 * s, depthOut * 1.3);

    // ⑦ 散斗（令拱两端）
    for (const sx of [-1, 1]) {
      douBlock(0.14 * s, 0.09 * s, 0.14 * s, X + sx * 0.36 * s, y3 + 0.17 * s, depthOut * 1.18, 0.78);
    }
  }

  const geo = merge(geos);
  const m = new THREE.Mesh(geo, M);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ─────────────────────────────────────────────
   隔扇门（格心 + 绦环板 + 裙板）
   ───────────────────────────────────────────── */
export function createLatticeDoor({
  width = 0.62,
  height = 2.55,
  frame = 0.055,
  latticeStep = 0.118,
  detail = 'normal',
  panelMat = MAT.woodBeam,
  paperMat = MAT.paper,
} = {}) {
  const g = new THREE.Group();
  const geos = [];
  const t = frame;

  // 外框
  const top = box(width, t, t, COVER.woodLacquer);
  top.translate(0, height / 2 - t / 2, 0);
  const bot = box(width, t, t, COVER.woodLacquer);
  bot.translate(0, -height / 2 + t / 2, 0);
  const lf = box(t, height, t, COVER.woodLacquer);
  lf.translate(-width / 2 + t / 2, 0, 0);
  const rt = box(t, height, t, COVER.woodLacquer);
  rt.translate(width / 2 - t / 2, 0, 0);
  geos.push(top, bot, lf, rt);

  // 格心区域：上 58%
  const gx0 = -width / 2 + t;
  const gx1 = width / 2 - t;
  const gy0 = height * 0.06;
  const gy1 = height / 2 - t;
  const gw = gx1 - gx0;
  const gh = gy1 - gy0;

  // 步步锦格心
  const nx = Math.max(2, Math.round(gw / (latticeStep * 0.86)));
  const ny = Math.max(2, Math.round(gh / latticeStep));
  const barW = 0.026;
  for (let i = 1; i < nx; i++) {
    const x = gx0 + (gw / nx) * i;
    const b = box(barW, gh, barW * 0.8, COVER.woodLacquer);
    b.translate(x, (gy0 + gy1) / 2, 0);
    geos.push(b);
  }
  for (let j = 1; j < ny; j++) {
    const y = gy0 + (gh / ny) * j;
    const b = box(gw, barW, barW * 0.8, COVER.woodLacquer);
    b.translate((gx0 + gx1) / 2, y, 0);
    geos.push(b);
  }
  // 短棂（步步锦特征：交错短线）
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = gx0 + (gw / nx) * (i + 0.5);
      const y = gy0 + (gh / ny) * (j + 0.5);
      const b = box(barW * 0.9, gh / ny * 0.5, barW * 0.7, COVER.woodLacquer);
      b.translate(x, y, 0);
      geos.push(b);
    }
  }
  // 卡子花：格心交叉点上的十字小件（仅高精度）
  if (detail === 'high') {
    for (let i = 1; i < nx; i++) {
      for (let j = 1; j < ny; j++) {
        if ((i + j) % 3 !== 0) continue;
        const x = gx0 + (gw / nx) * i;
        const y = gy0 + (gh / ny) * j;
        const a = box(0.075, 0.02, 0.03, 1);
        a.translate(x, y, 0.01);
        geos.push(a);
        const b = box(0.02, 0.075, 0.03, 1);
        b.translate(x, y, 0.01);
        geos.push(b);
      }
    }
  }

  // 格心背板（窗纸）
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(gw, gh),
    paperMat,
  );
  paper.position.set((gx0 + gx1) / 2, (gy0 + gy1) / 2, -0.012);
  g.add(paper);

  // 绦环板
  const bandY = gy0 - height * 0.03;
  const band = box(gw, height * 0.05, t * 0.9, COVER.woodLacquer);
  band.translate((gx0 + gx1) / 2, bandY, 0);
  geos.push(band);

  // 裙板（下部实心，带浅浮雕线脚）
  const pkH = height * 0.06 + (bandY - height * 0.05 / 2 - (-height / 2 + t));
  const pk = box(gw, pkH, t * 0.8, COVER.woodLacquer);
  pk.translate((gx0 + gx1) / 2, -height / 2 + t + pkH / 2, 0);
  geos.push(pk);
  // 裙板线脚
  const inset = box(gw * 0.86, pkH * 0.84, t * 0.5, COVER.woodLacquer);
  inset.translate((gx0 + gx1) / 2, -height / 2 + t + pkH / 2, t * 0.24);
  geos.push(inset);

  const geo = merge(geos);
  const m = new THREE.Mesh(geo, panelMat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  g.userData.door = m;
  return g;
}

/* ─────────────────────────────────────────────
   板门（实木大门，带门钉与门环）
   ───────────────────────────────────────────── */
export function createPlankDoor({ width = 1.4, height = 2.9, mat = MAT.blackLacquer } = {}) {
  const g = new THREE.Group();
  const geos = [];
  const leafW = width / 2 - 0.01;
  for (const sx of [-1, 1]) {
    const leaf = box(leafW, height, 0.1, COVER.woodPlank);
    leaf.translate(sx * (leafW / 2 + 0.01), 0, 0);
    geos.push(leaf);
    // 门钉
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const stud = new THREE.SphereGeometry(0.045, 8, 6);
        stud.translate(
          sx * (leafW * 0.25 + c * leafW * 0.25),
          height * 0.28 + r * height * 0.16,
          0.06,
        );
        geos.push(stud);
      }
    }
    // 门环
    const ring = new THREE.TorusGeometry(0.09, 0.018, 6, 12);
    ring.translate(sx * leafW * 0.32, 0, 0.09);
    geos.push(ring);
    const plate = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10);
    plate.rotateX(Math.PI / 2);
    plate.translate(sx * leafW * 0.32, 0.02, 0.06);
    geos.push(plate);
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

/* ─────────────────────────────────────────────
   槛窗（下部为槛墙，上部格心）
   ───────────────────────────────────────────── */
export function createLatticeWindow({ width = 1.4, height = 1.5, sillH = 0.95 } = {}) {
  const g = new THREE.Group();
  const geos = [];
  const t = 0.06;
  const gw = width - t * 2;
  const gh = height - t * 2;
  // 框
  geos.push(place(box(width, t, t, COVER.woodLacquer), { y: height / 2 - t / 2 }));
  geos.push(place(box(width, t, t, COVER.woodLacquer), { y: -height / 2 + t / 2 }));
  geos.push(place(box(t, height, t, COVER.woodLacquer), { x: -width / 2 + t / 2 }));
  geos.push(place(box(t, height, t, COVER.woodLacquer), { x: width / 2 - t / 2 }));

  const nx = Math.max(3, Math.round(gw / 0.11));
  const ny = Math.max(3, Math.round(gh / 0.11));
  const barW = 0.028;
  for (let i = 1; i < nx; i++) {
    geos.push(place(box(barW, gh, barW * 0.8, COVER.woodLacquer), { x: -gw / 2 + (gw / nx) * i }));
  }
  for (let j = 1; j < ny; j++) {
    geos.push(place(box(gw, barW, barW * 0.8, COVER.woodLacquer), { y: -gh / 2 + (gh / ny) * j }));
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, MAT.woodBeam);
  m.castShadow = true;
  g.add(m);

  const paper = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), MAT.paper);
  paper.position.z = -0.012;
  g.add(paper);
  g.userData.height = height;
  return g;
}

/* ─────────────────────────────────────────────
   栏杆
   type: 'wood' 寻杖栏杆 | 'stone' 石栏板
   ───────────────────────────────────────────── */
export function createRailing({ length = 6, height = 1.0, type = 'wood', postEvery = 1.6 } = {}) {
  const geos = [];
  const mat = type === 'stone' ? MAT.marble : MAT.woodLacquer;
  const half = length / 2;

  const n = Math.max(1, Math.round(length / postEvery));
  for (let i = 0; i <= n; i++) {
    const x = -half + (length / n) * i;
    if (type === 'stone') {
      const post = box(0.16, height + 0.12, 0.16, COVER.marble);
      post.translate(x, (height + 0.12) / 2, 0);
      geos.push(post);
      // 望柱头
      const head = lathe([[0, 0], [0.1, 0], [0.1, 0.05], [0.07, 0.12], [0.05, 0.2], [0, 0.22]], 10, COVER.marble);
      head.translate(x, height + 0.12, 0);
      geos.push(head);
    } else {
      const post = box(0.1, height, 0.1, COVER.woodLacquer);
      post.translate(x, height / 2, 0);
      geos.push(post);
    }
  }

  if (type === 'stone') {
    // 栏板
    for (let i = 0; i < n; i++) {
      const x = -half + (length / n) * (i + 0.5);
      const p = box((length / n) - 0.18, height * 0.72, 0.1, COVER.marble);
      p.translate(x, height * 0.36 + 0.04, 0);
      geos.push(p);
      // 地栿
    }
    const base = box(length, 0.12, 0.26, COVER.marble);
    base.translate(0, 0.06, 0);
    geos.push(base);
  } else {
    // 寻杖 + 净瓶
    const hand = box(length, 0.075, 0.075, COVER.woodLacquer);
    hand.translate(0, height - 0.04, 0);
    geos.push(hand);
    const mid = box(length, 0.055, 0.055, COVER.woodLacquer);
    mid.translate(0, height * 0.56, 0);
    geos.push(mid);
    const base = box(length, 0.09, 0.11, COVER.woodLacquer);
    base.translate(0, 0.045, 0);
    geos.push(base);
    // 净瓶（小立柱）
    const bn = Math.round(length / 0.28);
    for (let i = 0; i < bn; i++) {
      const x = -half + (length / bn) * (i + 0.5);
      const b = lathe([[0, 0], [0.026, 0], [0.03, 0.05], [0.016, 0.12], [0.03, 0.2], [0.026, 0.28], [0, 0.3]], 8, COVER.woodLacquer);
      b.translate(x, 0.09, 0);
      geos.push(b);
    }
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ─────────────────────────────────────────────
   踏跺（台阶）+ 垂带 + 御路
   ───────────────────────────────────────────── */
export function createSteps({
  width = 5, height = 0.8, depth = 1.6, treads = 5,
  yulLu = false, mat = MAT.granite,
} = {}) {
  const geos = [];
  const rise = height / treads;
  const run = depth / treads;
  for (let i = 0; i < treads; i++) {
    const h = rise * (i + 1);
    const d = run;
    const s = box(width, h, d, COVER.granite);
    s.translate(0, h / 2, -depth / 2 + d * (i + 0.5));
    geos.push(s);
  }
  // 垂带石
  for (const sx of [-1, 1]) {
    const b = new THREE.BufferGeometry();
    const w = 0.42;
    const x0 = sx > 0 ? width / 2 : -width / 2 - w;
    const mb = new MeshBuilder();
    const A = [x0, 0, -depth / 2];
    const B = [x0 + w, 0, -depth / 2];
    const C = [x0 + w, height, depth / 2];
    const D = [x0, height, depth / 2];
    const E = [x0, height, -depth / 2];
    const F = [x0 + w, height, -depth / 2];
    // 斜面
    mb.quad(A, B, C, D, [0, 0], [1, 0], [1, 1], [0, 1]);
    // 顶面
    mb.quad(D, C, F, E, [0, 0], [1, 0], [1, 1], [0, 1]);
    // 侧面
    mb.quad(A, D, E, E, [0, 0], [1, 0], [1, 1], [0, 1]);
    geos.push(mb.build());
  }
  // 御路石（浮雕龙纹示意：浅浮雕几何）
  if (yulLu) {
    const yl = box(width * 0.36, 0.06, depth * 1.0, COVER.marble);
    yl.rotateX(-Math.atan2(height, depth));
    yl.translate(0, height / 2 + 0.03, 0);
    geos.push(yl);
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ─────────────────────────────────────────────
   抱鼓石
   ───────────────────────────────────────────── */
export function createDrumStone(scale = 1) {
  const g = [];
  const base = box(0.62, 0.3, 0.34, COVER.granite);
  base.translate(0, 0.15, 0);
  g.push(base);
  const drum = cylinder(0.26, 0.26, 0.16, 18, COVER.granite);
  drum.rotateZ(Math.PI / 2);
  drum.rotateY(Math.PI / 2);
  drum.translate(0, 0.62, 0);
  g.push(drum);
  const top = box(0.34, 0.16, 0.24, COVER.granite);
  top.translate(0, 0.9, 0);
  g.push(top);
  const geo = merge(g);
  const m = new THREE.Mesh(geo, MAT.granite);
  m.castShadow = true;
  m.receiveShadow = true;
  m.scale.setScalar(scale);
  return m;
}

/* ─────────────────────────────────────────────
   石狮
   ───────────────────────────────────────────── */
export function createLion(scale = 1) {
  const g = new THREE.Group();
  const geos = [];
  const mat = MAT.graniteDark;
  // 须弥座
  geos.push(place(box(1.05, 0.16, 0.86, COVER.granite), { y: 0.08 }));
  geos.push(place(box(0.92, 0.12, 0.74, COVER.granite), { y: 0.22 }));
  // 后身
  const body = new THREE.SphereGeometry(0.36, 14, 12);
  body.scale(0.9, 1.05, 1.25);
  body.translate(0, 0.86, -0.1);
  geos.push(body);
  // 前胸
  const chest = new THREE.SphereGeometry(0.3, 14, 12);
  chest.scale(1.0, 1.05, 0.85);
  chest.translate(0, 0.95, 0.24);
  geos.push(chest);
  // 前腿
  for (const sx of [-0.2, 0.2]) {
    const leg = cylinder(0.085, 0.095, 0.5, 10, COVER.granite);
    leg.translate(sx, 0.53, 0.3);
    geos.push(leg);
    const paw = box(0.2, 0.12, 0.28, COVER.granite);
    paw.translate(sx, 0.34, 0.34);
    geos.push(paw);
  }
  // 头
  const head = new THREE.SphereGeometry(0.27, 14, 12);
  head.scale(1.05, 0.95, 0.95);
  head.translate(0, 1.36, 0.28);
  geos.push(head);
  // 吻部
  const snout = box(0.24, 0.16, 0.18, COVER.granite);
  snout.translate(0, 1.28, 0.48);
  geos.push(snout);
  // 鬃毛（一圈卷）
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 0.26;
    const curl = new THREE.SphereGeometry(0.075, 8, 6);
    curl.translate(Math.cos(a) * r, 1.36 + Math.sin(a) * r * 0.85, 0.16);
    geos.push(curl);
  }
  // 尾巴
  const tail = lathe([[0, 0], [0.09, 0.04], [0.11, 0.16], [0.06, 0.3], [0.1, 0.42], [0, 0.46]], 10, COVER.granite);
  tail.translate(0, 1.0, -0.46);
  geos.push(tail);

  const geo = merge(geos);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  g.scale.setScalar(scale);
  return g;
}

/* ─────────────────────────────────────────────
   香炉（三足鼎式）
   ───────────────────────────────────────────── */
export function createCenser(scale = 1) {
  const g = new THREE.Group();
  const geos = [];
  const body = lathe([
    [0, 0.0], [0.26, 0.02], [0.34, 0.16], [0.38, 0.34],
    [0.36, 0.48], [0.3, 0.56], [0.32, 0.6], [0.3, 0.62], [0, 0.62],
  ], 18, COVER.granite);
  geos.push(body);
  // 三足
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = cylinder(0.055, 0.075, 0.3, 8, COVER.granite);
    leg.translate(Math.cos(a) * 0.24, -0.14, Math.sin(a) * 0.24);
    geos.push(leg);
  }
  // 双耳
  for (const sx of [-1, 1]) {
    const ear = new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI);
    ear.rotateY(Math.PI / 2);
    ear.translate(sx * 0.36, 0.6, 0);
    geos.push(ear);
  }
  // 盖
  const lid = lathe([[0, 0], [0.3, 0.02], [0.26, 0.14], [0.12, 0.22], [0.06, 0.26], [0, 0.28]], 18, COVER.granite);
  lid.translate(0, 0.62, 0);
  geos.push(lid);
  const knob = new THREE.SphereGeometry(0.06, 10, 8);
  knob.translate(0, 0.94, 0);
  geos.push(knob);
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, MAT.bronze);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  g.scale.setScalar(scale);
  return g;
}

/* ─────────────────────────────────────────────
   宫灯
   ───────────────────────────────────────────── */
export function createLantern(scale = 1) {
  const g = new THREE.Group();
  const frame = [];
  const body = new THREE.CylinderGeometry(0.19, 0.19, 0.42, 8);
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xd8a86a, emissive: 0xff8c3a, emissiveIntensity: 0.9, roughness: 0.8,
  });
  const b = new THREE.Mesh(body, glowMat);
  g.add(b);
  frame.push(place(box(0.4, 0.04, 0.4, 1), { y: 0.22 }));
  frame.push(place(box(0.4, 0.04, 0.4, 1), { y: -0.22 }));
  // 立柱
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = box(0.022, 0.44, 0.022, 1);
    p.translate(Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19);
    frame.push(p);
  }
  const fm = new THREE.Mesh(merge(frame), MAT.blackLacquer);
  fm.castShadow = true;
  g.add(fm);
  // 顶盖
  const cap = lathe([[0, 0], [0.14, 0], [0.1, 0.06], [0.03, 0.1], [0, 0.12]], 10, 1);
  cap.translate(0, 0.24, 0);
  const cm = new THREE.Mesh(cap, MAT.blackLacquer);
  g.add(cm);
  // 吊链
  const chain = cylinder(0.008, 0.008, 0.5, 4, 1);
  chain.translate(0, 0.6, 0);
  g.add(new THREE.Mesh(chain, MAT.iron));
  g.scale.setScalar(scale);
  g.userData.glow = b;
  return g;
}

/* ─────────────────────────────────────────────
   石碑（含碑座）
   ───────────────────────────────────────────── */
export function createStele({ width = 0.9, height = 1.9, thickness = 0.16, texture = null } = {}) {
  const g = new THREE.Group();
  const geos = [];
  geos.push(place(box(width + 0.3, 0.18, thickness + 0.3, COVER.granite), { y: 0.09 }));
  geos.push(place(box(width + 0.12, 0.22, thickness + 0.16, COVER.granite), { y: 0.29 }));
  const slab = box(width, height, thickness, COVER.granite);
  slab.translate(0, 0.4 + height / 2, 0);
  geos.push(slab);
  // 碑首（圆角）
  const cap = new THREE.CylinderGeometry(width / 2, width / 2, thickness, 16, 1, false, 0, Math.PI);
  cap.rotateX(Math.PI / 2);
  cap.rotateZ(Math.PI);
  cap.translate(0, 0.4 + height, 0);
  geos.push(cap);
  const m = new THREE.Mesh(merge(geos), MAT.graniteDark);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  if (texture) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.9, height * 0.92),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }),
    );
    face.position.set(0, 0.4 + height / 2, thickness / 2 + 0.002);
    g.add(face);
  }
  return g;
}

/* ─────────────────────────────────────────────
   院墙（带瓦顶）
   ───────────────────────────────────────────── */
export function createWallRun({ length = 10, height = 2.6, thickness = 0.4, capStyle = 'tile' } = {}) {
  const geos = [];
  const body = box(length, height, thickness, COVER.brick);
  body.translate(0, height / 2, 0);
  geos.push(body);
  // 墙帽：两坡瓦顶
  if (capStyle === 'tile') {
    for (const sz of [-1, 1]) {
      const slope = box(length, 0.1, thickness * 0.75, COVER.tile);
      slope.rotateX(sz * 0.42);
      slope.translate(0, height + 0.12, sz * thickness * 0.2);
      geos.push(slope);
    }
    const ridge = box(length, 0.14, 0.16, COVER.tileDark);
    ridge.translate(0, height + 0.2, 0);
    geos.push(ridge);
  }
  const geo = merge(geos);
  const m = new THREE.Mesh(geo, MAT.brick);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ─────────────────────────────────────────────
   雀替：柱与额枋交接处的托木
   侧面轮廓为「卷草 + 蝉肚」，用 Shape 挤出
   ───────────────────────────────────────────── */
export function createQueti({ length = 0.62, height = 0.42, thickness = 0.1, mat = MAT.woodBeam } = {}) {
  const s = new THREE.Shape();
  const L = length;
  const H = height;
  // 上沿平直贴枋底，下沿做蝉肚曲线收至柱边
  s.moveTo(0, 0);
  s.lineTo(L, 0);
  s.lineTo(L, -0.06);
  s.quadraticCurveTo(L * 0.78, -0.02, L * 0.62, -H * 0.28);
  s.quadraticCurveTo(L * 0.42, -H * 0.72, L * 0.24, -H * 0.86);
  s.quadraticCurveTo(L * 0.1, -H * 0.96, 0, -H);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012,
    bevelSegments: 1, curveSegments: 8,
  });
  geo.translate(0, 0, -thickness / 2);
  // 米制 UV
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / COVER.woodBeam, uv.getY(i) / COVER.woodBeam);
  }
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * 挂落：檐下额枋底的装饰棂条（步步锦简化）
 * 沿局部 +x 展开，原点在中点
 */
export function createGualuo({ length = 3.0, height = 0.34, mat = MAT.woodBeam } = {}) {
  const g = [];
  const half = length / 2;
  const barW = 0.032;
  // 上下边框
  for (const y of [0, -height]) {
    const b = box(length, barW * 1.4, barW * 1.2, COVER.woodBeam);
    b.translate(0, y, 0);
    g.push(b);
  }
  // 竖棂
  const n = Math.max(3, Math.round(length / 0.26));
  for (let i = 0; i <= n; i++) {
    const x = -half + (length / n) * i;
    const b = box(barW, height, barW, COVER.woodBeam);
    b.translate(x, -height / 2, 0);
    g.push(b);
  }
  // 中横棂 + 短棂（步步锦）
  const mid = box(length, barW * 0.9, barW * 0.9, COVER.woodBeam);
  mid.translate(0, -height / 2, 0);
  g.push(mid);
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const x = -half + (length / n) * (i + 0.5);
    const b = box(barW * 0.85, height * 0.45, barW * 0.8, COVER.woodBeam);
    b.translate(x, -height * 0.26, 0);
    g.push(b);
  }
  const geo = merge(g);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * 墀头：硬山山墙伸出檐柱的装饰段（带戗檐与盘头）
 */
export function createChitou({ width = 0.5, height = 1.6, thickness = 0.42, mat = MAT.brick } = {}) {
  const g = [];
  // 墙身
  const body = box(width, height, thickness, COVER.brick);
  body.translate(0, height / 2, 0);
  g.push(body);
  // 盘头（挑出的线脚）
  for (let i = 0; i < 3; i++) {
    const w = width + 0.06 + i * 0.05;
    const b = box(w, 0.09, thickness + 0.06 + i * 0.04, COVER.granite);
    b.translate(0, height - 0.34 + i * 0.11, 0);
    g.push(b);
  }
  // 戗檐（斜置方砖）
  const xz = box(width + 0.18, 0.1, thickness + 0.24, COVER.granite);
  xz.rotateX(-0.5);
  xz.translate(0, height - 0.02, 0.04);
  g.push(xz);
  const geo = merge(g);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
