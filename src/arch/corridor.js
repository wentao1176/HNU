/**
 * 游廊 / 连廊 / 门屋 / 牌坊 / 照壁
 * 中国书院靠廊把各院落串成整体，这是「建筑群」而非「单体集合」的关键。
 */
import * as THREE from 'three';
import { box, cylinder, merge, place, lathe, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';
import { createRoof } from './roof.js';
import { createColumn } from './details.js';

/**
 * 直廊：柱列 + 卷棚顶 + 坐凳栏杆
 * 沿局部 +x 方向延伸，原点在一端中点
 */
export function createCorridor({
  length = 12,
  width = 2.8,
  columnH = 2.9,
  platformH = 0.32,
  bay = 3.0,
  tile = 'grey',
  railing = true,
  open = true,          // true 两侧通透；false 一侧砌墙
  wallSide = 1,         // open=false 时墙在哪一侧（+1 = +z）
} = {}) {
  const g = new THREE.Group();
  const half = length / 2;
  const n = Math.max(2, Math.round(length / bay));
  const step = length / n;

  // 台基
  const base = box(length + 0.4, platformH, width + 0.5, COVER.granite);
  base.translate(0, -platformH / 2, 0);
  const bm = new THREE.Mesh(base, MAT.granite);
  bm.receiveShadow = true;
  bm.castShadow = true;
  g.add(bm);

  // 地面
  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    MAT.paving,
  );
  fl.rotation.x = -Math.PI / 2;
  fl.position.y = 0.005;
  fl.receiveShadow = true;
  g.add(fl);

  // 柱
  const colGeos = [];
  for (let i = 0; i <= n; i++) {
    const x = -half + step * i;
    for (const sz of [-1, 1]) {
      colGeos.push(place(cylinder(0.13, 0.15, columnH, 10, COVER.woodLacquer), {
        x, y: columnH / 2, z: sz * (width / 2 - 0.12),
      }));
    }
  }
  const cm = new THREE.Mesh(merge(colGeos), MAT.woodLacquer);
  cm.castShadow = true;
  cm.receiveShadow = true;
  g.add(cm);

  // 额枋
  const fangGeos = [];
  for (const sz of [-1, 1]) {
    const f = box(length, 0.2, 0.16, COVER.caihua);
    f.translate(0, columnH - 0.1, sz * (width / 2 - 0.12));
    fangGeos.push(f);
  }
  // 横向穿插枋
  for (let i = 0; i <= n; i++) {
    const x = -half + step * i;
    const f = box(0.14, 0.16, width - 0.24, COVER.caihua);
    f.translate(x, columnH - 0.12, 0);
    fangGeos.push(f);
  }
  g.add(new THREE.Mesh(merge(fangGeos), MAT.caihua));

  // 卷棚顶（两坡，无正脊）
  const roof = createRoof({
    width: length,
    depth: width,
    eaveY: columnH,
    rise: width * 0.34,
    style: 'roll',
    overhangX: 0.5,
    overhangZ: 0.55,
    lift: 0,
    flare: 0,
    curve: 1.15,
    tile,
    ornament: false,
    segPerSide: Math.max(6, Math.round(length / 2)),
    ringCount: 6,
    ridgeScale: 0.5,
  });
  roof.rotation.y = Math.PI / 2;
  g.add(roof);

  // 坐凳栏杆
  if (railing) {
    const rg = [];
    for (const sz of [-1, 1]) {
      const seat = box(length - 0.2, 0.07, 0.3, COVER.woodBeam);
      seat.translate(0, 0.42, sz * (width / 2 - 0.24));
      rg.push(seat);
      const rail = box(length - 0.2, 0.05, 0.06, COVER.woodBeam);
      rail.translate(0, 0.78, sz * (width / 2 - 0.1));
      rg.push(rail);
      // 净瓶
      const bn = Math.round(length / 0.34);
      for (let i = 0; i < bn; i++) {
        const x = -half + (length / bn) * (i + 0.5);
        const b = box(0.05, 0.36, 0.05, COVER.woodBeam);
        b.translate(x, 0.6, sz * (width / 2 - 0.22));
        rg.push(b);
      }
    }
    g.add(new THREE.Mesh(merge(rg), MAT.woodBeam));
  }

  // 一侧砌墙（廊墙）
  if (!open) {
    const w = box(length, columnH - 0.1, 0.34, COVER.brick);
    w.translate(0, (columnH - 0.1) / 2, wallSide * (width / 2 + 0.1));
    const wm = new THREE.Mesh(w, MAT.brick);
    wm.castShadow = true;
    wm.receiveShadow = true;
    g.add(wm);
  }

  g.userData.footprint = { w: length, d: width + 0.5, h: columnH + width * 0.34 };
  g.userData.platform = { h: platformH, w: length + 0.4, d: width + 0.5 };
  return g;
}

/**
 * 牌坊（三间四柱）
 */
export function createPaifang({
  width = 9,
  height = 7.2,
  tile = 'grey',
} = {}) {
  const g = new THREE.Group();
  const geos = [];
  const bays = [width * 0.26, width * 0.48, width * 0.26];
  const total = bays.reduce((a, b) => a + b, 0);
  let acc = -total / 2;
  const xs = [acc];
  for (const b of bays) { acc += b; xs.push(acc); }
  const midX = [xs[0] + bays[0] / 2, xs[1] + bays[1] / 2, xs[2] + bays[2] / 2];

  // 四柱
  for (const x of xs) {
    const col = cylinder(0.24, 0.28, height, 12, COVER.woodLacquer);
    col.translate(x, height / 2, 0);
    geos.push(col);
    // 夹杆石
    const st = box(0.62, 0.9, 0.62, COVER.granite);
    st.translate(x, 0.45, 0);
    geos.push(st);
  }
  // 额枋（三间）
  const heights = [height * 0.62, height * 0.74, height * 0.62];
  for (let i = 0; i < 3; i++) {
    const w = bays[i];
    const cx = midX[i];
    for (const k of [0, 0.16]) {
      const f = box(w, 0.26, 0.28, COVER.caihua);
      f.translate(cx, heights[i] - k * height, 0);
      geos.push(f);
    }
  }
  const body = new THREE.Mesh(merge(geos), MAT.woodLacquer);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 三间屋顶
  for (let i = 0; i < 3; i++) {
    const r = createRoof({
      width: bays[i] + 0.6,
      depth: 1.5,
      eaveY: heights[i] + 0.1,
      rise: 0.9,
      style: i === 1 ? 'xieshan' : 'gable',
      overhangX: 0.55,
      overhangZ: 0.55,
      lift: 0.26,
      flare: 0.16,
      tile,
      ornament: false,
      ringCount: 6,
      segPerSide: 6,
      ridgeScale: 0.6,
    });
    r.position.x = midX[i];
    r.scale.z = 0.55;
    g.add(r);
  }

  g.userData.footprint = { w: width, d: 2, h: height };
  return g;
}

/**
 * 照壁（影壁）
 */
export function createZhaobi({ width = 6, height = 3.2, thickness = 0.5 } = {}) {
  const g = new THREE.Group();
  const geos = [];
  // 壁座
  const base = box(width + 0.5, 0.4, thickness + 0.4, COVER.granite);
  base.translate(0, 0.2, 0);
  geos.push(base);
  // 壁身
  const body = box(width, height, thickness, COVER.brick);
  body.translate(0, 0.4 + height / 2, 0);
  geos.push(body);
  // 瓦顶
  for (const sz of [-1, 1]) {
    const slope = box(width + 0.9, 0.12, thickness * 0.9, COVER.tile);
    slope.rotateX(sz * 0.4);
    slope.translate(0, 0.4 + height + 0.16, sz * thickness * 0.24);
    geos.push(slope);
  }
  const ridge = box(width + 1.0, 0.16, 0.2, COVER.tileDark);
  ridge.translate(0, 0.4 + height + 0.28, 0);
  geos.push(ridge);
  // 壁心（白灰方框）
  const center = box(width * 0.86, height * 0.8, thickness + 0.06, COVER.plaster);
  center.translate(0, 0.4 + height / 2, 0);
  geos.push(center);

  const m = new THREE.Mesh(merge(geos), MAT.brick);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  g.userData.footprint = { w: width + 0.9, d: thickness + 0.6, h: height + 0.6 };
  return g;
}

/**
 * 院门 / 角门（小门屋，带门洞）
 */
export function createSideGate({ width = 3.6, depth = 3.2, height = 3.4 } = {}) {
  const g = new THREE.Group();
  const geos = [];
  // 台基
  const base = box(width + 0.6, 0.34, depth + 0.6, COVER.granite);
  base.translate(0, 0.17, 0);
  geos.push(base);
  // 两侧墙垛
  for (const sx of [-1, 1]) {
    const w = box(width * 0.28, height, 0.42, COVER.brick);
    w.translate(sx * (width / 2 - width * 0.14), height / 2 + 0.34, 0);
    geos.push(w);
  }
  // 门楣
  const lintel = box(width, 0.36, 0.4, COVER.woodBeam);
  lintel.translate(0, height + 0.16, 0);
  geos.push(lintel);
  const m = new THREE.Mesh(merge(geos), MAT.brick);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);

  // 门扇（半开）
  const leaves = [];
  for (const sx of [-1, 1]) {
    const leaf = box(width * 0.34, height - 0.4, 0.08, COVER.woodPlank);
    leaf.translate(sx * width * 0.17, (height - 0.4) / 2 + 0.34, 0);
    leaf.rotateY(sx * 0.9);
    leaves.push(leaf);
  }
  g.add(new THREE.Mesh(merge(leaves), MAT.blackLacquer));

  // 小屋顶
  const roof = createRoof({
    width: width + 0.9,
    depth: depth + 0.4,
    eaveY: height + 0.34,
    rise: 1.1,
    style: 'gable',
    overhangX: 0.6,
    overhangZ: 0.7,
    lift: 0.22,
    flare: 0.14,
    tile: 'grey',
    ornament: false,
    ringCount: 6,
    segPerSide: 6,
    ridgeScale: 0.7,
  });
  g.add(roof);

  g.userData.footprint = { w: width + 1.2, d: depth + 1.2, h: height + 1.6 };
  g.userData.platform = { h: 0.34, w: width + 0.6, d: depth + 0.6 };
  g.userData.walls = [
    { x0: -width / 2 - 0.3, x1: -width * 0.22, z0: -0.3, z1: 0.3 },
    { x0: width * 0.22, x1: width / 2 + 0.3, z0: -0.3, z1: 0.3 },
  ];
  return g;
}

/**
 * 围墙段（带瓦顶，可选门洞）
 */
export function createWallSegment({ length = 12, height = 2.7, thickness = 0.42, gate = 0 } = {}) {
  const g = new THREE.Group();
  const geos = [];
  if (gate > 0) {
    // 中间留门洞
    const side = (length - gate) / 2;
    for (const sx of [-1, 1]) {
      const w = box(side, height, thickness, COVER.brick);
      w.translate(sx * (gate / 2 + side / 2), height / 2, 0);
      geos.push(w);
      // 门洞上方过梁
    }
    const lintel = box(gate, height * 0.22, thickness, COVER.brick);
    lintel.translate(0, height - height * 0.11, 0);
    geos.push(lintel);
  } else {
    const w = box(length, height, thickness, COVER.brick);
    w.translate(0, height / 2, 0);
    geos.push(w);
  }
  // 墙帽
  for (const sz of [-1, 1]) {
    const slope = box(length, 0.1, thickness * 0.8, COVER.tile);
    slope.rotateX(sz * 0.42);
    slope.translate(0, height + 0.12, sz * thickness * 0.2);
    geos.push(slope);
  }
  const ridge = box(length, 0.14, 0.16, COVER.tileDark);
  ridge.translate(0, height + 0.2, 0);
  geos.push(ridge);

  const m = new THREE.Mesh(merge(geos), MAT.brick);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  g.userData.wall = { length, height, thickness, gate };
  return g;
}
