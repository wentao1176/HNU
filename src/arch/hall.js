/**
 * 殿堂生成器
 * 台基 → 柱网 → 墙体 → 门窗装修 → 额枋斗拱 → 屋顶 → 匾联
 * 局部坐标：建筑中心在原点，正面朝 +z，台基顶面 y = 0。
 */
import * as THREE from 'three';
import { createRoof } from './roof.js';
import {
  createColumn, createDougongSet, createLatticeDoor, createLatticeWindow,
  createRailing, createSteps, createDrumStone, createPlankDoor,
  columnGeo, columnBaseGeo, createQueti, createGualuo, createChitou,
} from './details.js';
import { box, cylinder, merge, place, plane, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';
import { createPlaque, createCouplet } from '../gfx/text.js';
import {
  roomLecture, roomLibrary, roomShrine, roomDorm, roomClassroom, roomLounge, roomGate,
} from './interior.js';

class Batch {
  constructor() { this.map = new Map(); }
  add(geo, mat) {
    if (!geo) return;
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(geo);
  }
  flush(parent, cast = true) {
    for (const [mat, geos] of this.map) {
      const g = merge(geos);
      if (!g) continue;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = cast;
      m.receiveShadow = true;
      parent.add(m);
    }
    this.map.clear();
  }
}

/** 按开间宽度求柱位（居中） */
function bayCenters(bayWidths) {
  const total = bayWidths.reduce((a, b) => a + b, 0);
  let acc = -total / 2;
  const edges = [acc];
  for (const w of bayWidths) { acc += w; edges.push(acc); }
  const centers = [];
  for (let i = 0; i < bayWidths.length; i++) centers.push((edges[i] + edges[i + 1]) / 2);
  return { edges, centers, total };
}

export function createHall(o = {}) {
  const {
    width = 18,
    depth = 11,
    bayWidths = null,
    columnH = 4.4,
    columnR = 0.24,
    platformH = 0.85,
    platformPad = 1.5,
    roofStyle = 'xieshan',
    roofRise = null,
    overhangX = 1.25,
    overhangZ = 1.15,
    curve = 1.32,
    lift = 0.55,
    flare = 0.34,
    tile = 'grey',
    frontPorch = 0,          // 前廊深度
    frontType = 'door',      // door | wall | open | gate | gate3
    backType = 'wall',
    sideType = 'wall',
    hasDougong = true,
    dougongScale = 1,
    steps = true,
    stepsWidth = null,
    plaque = null,           // { text, width, height, y, bg, fg }
    plaqueBack = null,       // 背面匾（二门「潇湘槐市」）
    couplets = null,         // { left, right }
    drumStones = true,
    railing = false,
    ornament = true,
    detail = 'normal',
    interior = true,      // true | false | { room, opts }
    wallMat = 'brick',       // brick | plaster（大门/二门白墙青瓦）
    screenGables = 0,        // 三山屏风墙层数（0 = 无）
    generalDoor = false,     // 将军门式（门簪抱鼓高门槛）
    xuanLang = null,         // 前出轩廊 { width, depth, columnH, rise }
    baiTing = null,          // 后连拜厅 { width, depth, columnH, rise }
    name = '',
  } = o;

  const g = new THREE.Group();
  g.name = name || 'hall';

  const bw = bayWidths || (width > 20 ? [width * 0.17, width * 0.2, width * 0.26, width * 0.2, width * 0.17] : [width / 3, width / 3, width / 3]);
  const { edges, centers } = bayCenters(bw);
  const halfD = depth / 2;
  const halfW = width / 2;

  const outWallMat = wallMat === 'plaster' ? COVER.plaster : COVER.brick;
  const outWallMAT = wallMat === 'plaster' ? MAT.plaster : MAT.brick;

  const dougongH = hasDougong ? 0.92 * dougongScale : 0.24;
  const eaveY = columnH + dougongH;
  const rise = roofRise != null ? roofRise : Math.max(2.4, depth * 0.36);

  const batch = new Batch();

  /* ── 台基（轩廊/拜厅外扩） ── */
  const frontExt = xuanLang ? xuanLang.depth : 0;
  const backExt = baiTing ? baiTing.depth : 0;
  const pw = Math.max(width, xuanLang ? xuanLang.width : 0, baiTing ? baiTing.width : 0) + platformPad * 2;
  const pd = depth + frontExt + backExt + platformPad * 2;
  const pdCenter = (frontExt - backExt) / 2;  // 台基中心相对建筑中心的 z 偏移
  const baseGeos = [];
  // 须弥座式台基：圭角 → 下枋 → 束腰 → 上枋 → 压阑石
  if (detail === 'high' && platformH > 0.55) {
    const H = platformH;
    const layers = [
      { h: 0.10, inset: 0.00 },   // 圭角
      { h: 0.16, inset: 0.02 },   // 下枋
      { h: 0.10, inset: 0.10 },   // 下枭
      { h: H * 0.30, inset: 0.16 }, // 束腰（内收）
      { h: 0.10, inset: 0.06 },   // 上枭
      { h: 0.16, inset: 0.00 },   // 上枋
    ];
    let y = -H;
    for (const L of layers) {
      const w2 = pw - L.inset * 2;
      const d2 = pd - L.inset * 2;
      const b = box(w2, L.h, d2, COVER.granite);
      b.translate(0, y + L.h / 2, pdCenter);
      baseGeos.push(b);
      y += L.h;
    }
    // 补齐到台面
    if (y < -0.001) {
      const b = box(pw, -y, pd, COVER.granite);
      b.translate(0, y + (-y) / 2, pdCenter);
      baseGeos.push(b);
    }
  } else {
    const baseBody = box(pw, platformH, pd, COVER.granite);
    baseBody.translate(0, -platformH / 2, pdCenter);
    baseGeos.push(baseBody);
  }
  // 压阑石（台基边缘一圈）
  const lipH = 0.14;
  const lipT = 0.34;
  baseGeos.push(place(box(pw + lipT * 2, lipH, lipT, COVER.granite), { y: -lipH / 2, z: pdCenter + pd / 2 + lipT / 2 }));
  baseGeos.push(place(box(pw + lipT * 2, lipH, lipT, COVER.granite), { y: -lipH / 2, z: pdCenter - pd / 2 - lipT / 2 }));
  baseGeos.push(place(box(lipT, lipH, pd, COVER.granite), { y: -lipH / 2, x: pw / 2 + lipT / 2, z: pdCenter }));
  baseGeos.push(place(box(lipT, lipH, pd, COVER.granite), { y: -lipH / 2, x: -pw / 2 - lipT / 2, z: pdCenter }));
  batch.add(merge(baseGeos), MAT.granite);

  // 台基铺地
  const floor = new THREE.Mesh(plane(pw, pd, COVER.paving), MAT.paving);
  floor.position.set(0, 0.002, pdCenter);
  floor.receiveShadow = true;
  g.add(floor);

  // 室内地面（略深，示意金砖）
  if (interior) {
    const inner = new THREE.Mesh(plane(width - 0.8, depth - 0.8, COVER.paving), MAT.paving.clone());
    inner.material.color.setHex(0xb0aca4);
    inner.position.y = 0.006;
    inner.receiveShadow = true;
    g.add(inner);
  }

  /* ── 踏跺 ── */
  if (steps) {
    const sw = stepsWidth || Math.min(width * 0.42, bw[Math.floor(bw.length / 2)] + 2.4);
    const st = createSteps({
      width: sw, height: platformH + 0.14, depth: Math.max(1.4, platformH * 2.2),
      treads: Math.max(3, Math.round(platformH / 0.14)),
      yulLu: width > 16, mat: MAT.granite,
    });
    st.position.set(0, -platformH, pdCenter + pd / 2 + lipT + 0.02);
    g.add(st);
  }

  /* ── 柱网 ── */
  const colGeos = [];
  const colXs = edges;
  // 前后檐柱
  const shaftGeo = columnGeo(columnR, columnH, detail === 'high' ? 28 : 18);
  for (const x of colXs) {
    for (const z of [halfD, -halfD]) {
      colGeos.push(place(shaftGeo, { x, y: 0, z }));
    }
  }
  // 山面中柱（进深较大时）
  const midZ = 0;
  if (depth > 8) {
    for (const x of [halfW, -halfW]) {
      colGeos.push(place(shaftGeo, { x, y: 0, z: midZ }));
    }
  }
  // 柱础
  const baseGeo = columnBaseGeo(columnR);
  for (const x of colXs) {
    for (const z of [halfD, -halfD]) {
      colGeos.push(place(baseGeo, { x, y: 0, z }));
    }
  }
  batch.add(merge(colGeos), MAT.woodLacquer);

  /* ── 额枋（柱顶联系梁） ── */
  const fangGeos = [];
  const fangH = 0.36;
  const fangT = 0.22;
  for (const z of [halfD, -halfD]) {
    const f = box(width + columnR * 2, fangH, fangT, COVER.caihua);
    f.translate(0, columnH - fangH / 2 - 0.02, z);
    fangGeos.push(f);
  }
  for (const x of [halfW, -halfW]) {
    const f = box(fangT, fangH, depth + columnR * 2, COVER.caihua);
    f.translate(x, columnH - fangH / 2 - 0.02, 0);
    fangGeos.push(f);
  }
  batch.add(merge(fangGeos), MAT.caihua);

  /* ── 斗拱 ── */
  if (hasDougong) {
    const dgGeos = [];
    const placeRow = (len, axis, offset, sign) => {
      const count = Math.max(2, Math.round(len / (1.15 * dougongScale)));
      const spacing = len / count;
      const row = createDougongSet({ count: count + 1, spacing, scale: dougongScale });
      // 手动重排：从 -len/2 到 len/2
      row.position.set(0, 0, 0);
      const geo = row.geometry.clone();
      row.traverse(() => {});
      return geo;
    };
    // 前檐
    for (let i = 0; i <= Math.round(width / 1.15); i++) {
      const x = -halfW + (width / Math.round(width / 1.15)) * i;
      const d = createDougongSet({ count: 1, spacing: 0, scale: dougongScale });
      d.geometry.translate(x, columnH, halfD + 0.06);
      dgGeos.push(d.geometry);
    }
    // 后檐
    for (let i = 0; i <= Math.round(width / 1.15); i++) {
      const x = -halfW + (width / Math.round(width / 1.15)) * i;
      const d = createDougongSet({ count: 1, spacing: 0, scale: dougongScale });
      d.geometry.translate(x, columnH, -halfD - 0.06);
      d.geometry.rotateY(0);
      dgGeos.push(d.geometry);
    }
    // 山面
    for (const sx of [-1, 1]) {
      const n = Math.max(2, Math.round(depth / 1.15));
      for (let i = 0; i <= n; i++) {
        const z = -halfD + (depth / n) * i;
        const d = createDougongSet({ count: 1, spacing: 0, scale: dougongScale });
        d.geometry.rotateY(Math.PI / 2);
        d.geometry.translate(sx * (halfW + 0.06), columnH, z);
        dgGeos.push(d.geometry);
      }
    }
    batch.add(merge(dgGeos), MAT.caihua);
  }

  /* ── 雀替 / 挂落（高精度档） ── */
  if (detail === 'high') {
    // 雀替：柱头与额枋交接处，柱两侧各一
    const qProto = createQueti({ length: 0.56, height: 0.4, thickness: 0.1 });
    const qGeoBase = qProto.geometry;
    const qGeos = [];
    for (const x of colXs) {
      for (const z of [halfD, -halfD]) {
        for (const sx of [-1, 1]) {
          qGeos.push(place(qGeoBase, {
            x: x + sx * (columnR + 0.3),
            y: columnH - fangH + 0.01,
            z,
            ry: sx > 0 ? 0 : Math.PI,
          }));
        }
      }
    }
    // 山面柱
    for (const x of [halfW, -halfW]) {
      for (const z of [0]) {
        for (const sz of [-1, 1]) {
          qGeos.push(place(qGeoBase, {
            x, y: columnH - fangH + 0.01, z: z + sz * (columnR + 0.3),
            ry: sz > 0 ? -Math.PI / 2 : Math.PI / 2,
          }));
        }
      }
    }
    const qGeo = merge(qGeos);
    if (qGeo) {
      const qm = new THREE.Mesh(qGeo, MAT.woodBeam);
      qm.castShadow = true;
      qm.receiveShadow = true;
      g.add(qm);
    }

    // 挂落：前廊额枋下逐间布置
    if (frontPorch > 0) {
      for (let b = 0; b < bw.length; b++) {
        const gl = createGualuo({ length: bw[b] - 0.45, height: 0.3 });
        gl.position.set(centers[b], columnH - fangH - 0.04, halfD - frontPorch + 0.24);
        g.add(gl);
      }
    }
  }

  /* ── 墙体 ── */
  const wallGeos = [];
  const wallT = 0.42;
  const wallTop = columnH - fangH;
  const isGable = roofStyle === 'gable';

  // 山墙
  if (sideType === 'wall') {
    for (const sx of [-1, 1]) {
      if (isGable) {
        // 随屋顶轮廓的三角山墙
        const s = new THREE.Shape();
        s.moveTo(-halfD, 0);
        s.lineTo(halfD, 0);
        s.lineTo(halfD, wallTop);
        s.lineTo(0, eaveY + rise * 0.98);
        s.lineTo(-halfD, wallTop);
        s.closePath();
        const geo = new THREE.ExtrudeGeometry(s, { depth: wallT, bevelEnabled: false, curveSegments: 1 });
        geo.rotateY(-Math.PI / 2);
        geo.translate(sx * halfW + (sx > 0 ? wallT : 0), 0, 0);
        // UV 以米计
        const uv = geo.attributes.uv;
        const cov = wallMat === 'plaster' ? COVER.plaster : COVER.brick;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / cov, uv.getY(i) / cov);
        wallGeos.push(geo);
      } else {
        const w = box(wallT, wallTop, depth - 0.1, outWallMat);
        w.translate(sx * (halfW - wallT / 2 + 0.02), wallTop / 2, 0);
        wallGeos.push(w);
      }
    }
  }

  // 后墙
  if (backType === 'wall') {
    const w = box(width - 0.1, wallTop, wallT, outWallMat);
    w.translate(0, wallTop / 2, -halfD + wallT / 2 - 0.02);
    wallGeos.push(w);
  }

  // 前檐：墙 or 装修
  const frontZ = halfD - frontPorch;
  if (frontPorch > 0) {
    // 廊下墙体
    if (frontType === 'wall') {
      const w = box(width - 0.1, wallTop, wallT, outWallMat);
      w.translate(0, wallTop / 2, frontZ);
      wallGeos.push(w);
    }
    // 廊下不做天花，露明斗拱（中国建筑「彻上露明造」）
  }

  batch.add(merge(wallGeos), outWallMAT);

  /* ── 三山屏风墙（湖南硬山做法：山墙升高出屋面，三叠收进，叠顶压瓦） ── */
  if (screenGables > 0 && isGable) {
    const sgGeos = [];
    const capGeos = [];
    const steps = screenGables;
    const ridgeY = eaveY + rise * 0.98;
    const cov = wallMat === 'plaster' ? COVER.plaster : COVER.brick;
    // 屋面高度近似（随进深位置），用于让每叠略高于屋面
    const roofYAt = (z) => eaveY + rise * Math.pow(Math.max(0, 1 - Math.abs(z) / (halfD + overhangZ)), curve);
    for (const sx of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-halfD, 0);
      shape.lineTo(halfD, 0);
      shape.lineTo(halfD, wallTop);
      const segW = (halfD * 0.9) / steps;
      let z = halfD * 0.9;
      shape.lineTo(z, roofYAt(z) - 0.12);
      const stepPts = [];
      for (let k = 0; k < steps; k++) {
        const zk = z - segW * (k === 0 ? 0.55 : 1);
        const yk = roofYAt(zk) + (steps - k) * 0.42 + 0.3;
        shape.lineTo(z, yk);
        shape.lineTo(zk, yk);
        stepPts.push({ z, y: yk });
        z = zk;
      }
      const yTop = Math.max(ridgeY + 0.45, roofYAt(0) + 0.45);
      shape.lineTo(0, yTop);
      shape.lineTo(-halfD, wallTop);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: wallT + 0.06, bevelEnabled: false, curveSegments: 1 });
      geo.rotateY(-Math.PI / 2);
      geo.translate(sx * halfW + (sx > 0 ? wallT + 0.03 : -0.03), 0, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / cov, uv.getY(i) / cov);
      sgGeos.push(geo);
      // 叠顶压顶灰条（沿每叠水平段）
      for (const p of stepPts) {
        const cap = box(0.52, 0.1, 0.16, 1.2);
        cap.translate(0, p.y + 0.05, p.z);
        capGeos.push(cap);
      }
    }
    batch.add(merge(sgGeos), outWallMAT);
    const capGeo = merge(capGeos);
    if (capGeo) {
      const cm2 = new THREE.Mesh(capGeo, MAT.tileDark);
      cm2.castShadow = true;
      g.add(cm2);
    }
  }

  /* ── 前檐装修：隔扇门 / 槛窗 ── */
  if (frontType === 'open') {
    // 中间开间完全敞开（可通行），两侧砌墙开窗
    const doorH = columnH - fangH - 0.12;
    const midIdx = Math.floor(bw.length / 2);
    for (let b = 0; b < bw.length; b++) {
      const bwid = bw[b];
      const cx = centers[b];
      if (b === midIdx) {
        // 门框
        const frameGeos = [];
        frameGeos.push(place(box(bwid - 0.2, 0.3, 0.36, COVER.woodBeam), { x: cx, y: doorH - 0.08, z: frontZ + 0.02 }));
        for (const sx of [-1, 1]) {
          frameGeos.push(place(box(0.28, doorH, 0.36, COVER.woodBeam), { x: cx + sx * (bwid - 0.28) / 2, y: doorH / 2, z: frontZ + 0.02 }));
        }
        // 门槛
        frameGeos.push(place(box(bwid - 0.2, 0.14, 0.34, COVER.granite), { x: cx, y: 0.07, z: frontZ + 0.02 }));
        const fm = new THREE.Mesh(merge(frameGeos), MAT.woodBeam);
        fm.castShadow = true;
        g.add(fm);
      } else {
        const sw = box(bwid - 0.06, doorH, 0.36, COVER.brick);
        sw.translate(cx, doorH / 2, frontZ + 0.02);
        const swm = new THREE.Mesh(sw, MAT.brick);
        swm.castShadow = true; swm.receiveShadow = true;
        g.add(swm);
        const sillH = 1.15;
        const winH = doorH - sillH - 0.5;
        if (winH > 0.5) {
          const win = createLatticeWindow({ width: bwid - 0.7, height: winH, detail });
          win.position.set(cx, sillH + winH / 2 + 0.45, frontZ + 0.22);
          g.add(win);
        }
      }
      if (b < bw.length - 1) {
        const x = edges[b + 1];
        const pw2 = box(0.2, doorH, 0.36, COVER.brick);
        pw2.translate(x, doorH / 2, frontZ + 0.02);
        const m = new THREE.Mesh(pw2, MAT.brick);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      }
    }
  }

  if (frontType === 'gate' || frontType === 'gate3') {
    // 门屋：中开门（gate：明间一门；gate3：中三间各一门），两侧砌墙
    const doorH = columnH - fangH - 0.12;
    const midIdx = Math.floor(bw.length / 2);
    for (let b = 0; b < bw.length; b++) {
      const bwid = bw[b];
      const cx = centers[b];
      const isDoor = frontType === 'gate'
        ? b === midIdx
        : Math.abs(b - midIdx) <= 1;
      if (isDoor) {
        const dh = generalDoor ? doorH - 0.04 : doorH - 0.1;
        const d = createPlankDoor({ width: bwid - 0.5, height: dh });
        d.position.set(cx, dh / 2 + 0.04, frontZ + 0.04);
        g.add(d);
        // 门框（将军门式加门簪）
        const frameGeos = [];
        frameGeos.push(place(box(bwid - 0.3, 0.28, 0.32, COVER.woodBeam), { x: cx, y: doorH - 0.05, z: frontZ + 0.04 }));
        for (const sx of [-1, 1]) {
          frameGeos.push(place(box(0.26, doorH, 0.32, COVER.woodBeam), { x: cx + sx * (bwid - 0.3) / 2, y: doorH / 2, z: frontZ + 0.04 }));
        }
        if (generalDoor) {
          // 门簪（六角短柱）一对
          for (const sx of [-1, 1]) {
            const mz = cylinder(0.09, 0.09, 0.22, 6, COVER.woodBeam);
            mz.rotateX(Math.PI / 2);
            mz.translate(cx + sx * 0.55, doorH - 0.32, frontZ + 0.22);
            frameGeos.push(mz);
          }
          // 高门枕石
          for (const sx of [-1, 1]) {
            frameGeos.push(place(box(0.34, 0.5, 0.6, COVER.granite), { x: cx + sx * (bwid / 2 - 0.32), y: 0.25, z: frontZ + 0.1 }));
          }
        }
        // 门槛
        frameGeos.push(place(box(bwid - 0.5, generalDoor ? 0.22 : 0.12, 0.3, COVER.woodBeam), { x: cx, y: generalDoor ? 0.19 : 0.06, z: frontZ + 0.05 }));
        const fm = new THREE.Mesh(merge(frameGeos), MAT.woodBeam);
        fm.castShadow = true;
        g.add(fm);
      } else {
        // 两侧：实墙
        const sw = box(bwid - 0.06, doorH, 0.36, outWallMat);
        sw.translate(cx, doorH / 2, frontZ + 0.02);
        const swm = new THREE.Mesh(sw, outWallMAT);
        swm.castShadow = true; swm.receiveShadow = true;
        g.add(swm);
      }
      if (b < bw.length - 1) {
        const x = edges[b + 1];
        const pw2 = box(0.2, doorH, 0.34, outWallMat);
        pw2.translate(x, doorH / 2, frontZ + 0.02);
        const m = new THREE.Mesh(pw2, outWallMAT);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      }
    }
  }

  if (frontType === 'door') {
    const doorH = columnH - fangH - 0.12;
    for (let b = 0; b < bw.length; b++) {
      const bwid = bw[b];
      const cx = centers[b];
      const n = Math.max(2, Math.round(bwid / 0.62));
      const dw = (bwid - 0.16) / n;
      const isCenter = b === Math.floor(bw.length / 2);
      for (let i = 0; i < n; i++) {
        const x = cx - (bwid - 0.16) / 2 + dw * (i + 0.5);
        if (isCenter) {
          const door = createLatticeDoor({ width: dw - 0.015, height: doorH, detail });
          door.position.set(x, doorH / 2 + 0.02, frontZ + 0.02);
          g.add(door);
        } else {
          // 两侧开间：上为槛窗，下为槛墙
          const sillH = 0.95;
          const winH = doorH - sillH - 0.08;
          const win = createLatticeWindow({ width: dw - 0.02, height: winH, detail });
          win.position.set(x, sillH + winH / 2 + 0.04, frontZ + 0.02);
          g.add(win);
          const sillWall = box(dw - 0.02, sillH, 0.3, COVER.brick);
          sillWall.translate(x, sillH / 2, frontZ + 0.02);
          const m = new THREE.Mesh(sillWall, MAT.brick);
          m.castShadow = true; m.receiveShadow = true;
          g.add(m);
        }
      }
      // 间壁（开间之间的窄墙）
      if (b < bw.length - 1) {
        const x = edges[b + 1];
        const pw2 = box(0.16, doorH, 0.3, COVER.brick);
        pw2.translate(x, doorH / 2, frontZ + 0.02);
        const m = new THREE.Mesh(pw2, MAT.brick);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      }
    }
  }

  /* ── 背面门洞（二门背面「潇湘槐市」，同样中三间开三门） ── */
  if (backType === 'gate' || backType === 'gate3') {
    const doorH = columnH - fangH - 0.12;
    const midIdx = Math.floor(bw.length / 2);
    const backZ2 = -halfD + 0.02;
    for (let b = 0; b < bw.length; b++) {
      const bwid = bw[b];
      const cx = centers[b];
      const isDoor = backType === 'gate' ? b === midIdx : Math.abs(b - midIdx) <= 1;
      if (isDoor) {
        const d = createPlankDoor({ width: bwid - 0.5, height: doorH - 0.1 });
        d.position.set(cx, (doorH - 0.1) / 2 + 0.04, backZ2 - 0.04);
        d.rotation.y = Math.PI;
        g.add(d);
        const frameGeos = [];
        frameGeos.push(place(box(bwid - 0.3, 0.28, 0.32, COVER.woodBeam), { x: cx, y: doorH - 0.05, z: backZ2 - 0.04 }));
        for (const sx of [-1, 1]) {
          frameGeos.push(place(box(0.26, doorH, 0.32, COVER.woodBeam), { x: cx + sx * (bwid - 0.3) / 2, y: doorH / 2, z: backZ2 - 0.04 }));
        }
        const fm = new THREE.Mesh(merge(frameGeos), MAT.woodBeam);
        fm.castShadow = true;
        g.add(fm);
      } else {
        const sw = box(bwid - 0.06, doorH, 0.36, outWallMat);
        sw.translate(cx, doorH / 2, backZ2 - 0.02);
        const swm = new THREE.Mesh(sw, outWallMAT);
        swm.castShadow = true; swm.receiveShadow = true;
        g.add(swm);
      }
      if (b < bw.length - 1) {
        const x = edges[b + 1];
        const pw2 = box(0.2, doorH, 0.34, outWallMat);
        pw2.translate(x, doorH / 2, backZ2 - 0.02);
        const m = new THREE.Mesh(pw2, outWallMAT);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      }
    }
  }

  /* ── 匾额 ── */
  if (plaque) {
    const p = createPlaque(plaque.text, {
      width: plaque.width || Math.min(3.4, bw[Math.floor(bw.length / 2)] * 0.62),
      height: plaque.height || 1.05,
      bg: plaque.bg || '#0e0b08',
      fg: plaque.fg || '#c9a35c',
      reverse: plaque.reverse !== false,
    });
    // 有前廊：匾挂在檐下（廊外沿），正对院落；无廊：贴门额
    const hasPorch = frontPorch > 1.0;
    const py = plaque.y != null
      ? plaque.y
      : hasPorch
        ? columnH - fangH - (plaque.height || 1.05) * 0.62
        : columnH - 0.95;
    const pz = hasPorch ? halfD - 0.06 : frontZ + 0.34;
    p.position.set(0, py, pz);
    g.add(p);

    // 匾下的挂枋（承托匾额的横木）
    if (hasPorch) {
      const hb = box((plaque.width || 3.4) + 0.5, 0.1, 0.14, COVER.woodBeam);
      hb.translate(0, py + (plaque.height || 1.05) / 2 + 0.05, pz);
      const hbm = new THREE.Mesh(hb, MAT.woodBeam);
      hbm.castShadow = true;
      g.add(hbm);
      // 吊挂
      for (const sx of [-1, 1]) {
        const rod = box(0.05, 0.3, 0.05, COVER.woodBeam);
        rod.translate(sx * (plaque.width || 3.4) * 0.3, py + (plaque.height || 1.05) / 2 + 0.2, pz);
        g.add(new THREE.Mesh(rod, MAT.woodBeam));
      }
    }
  }

  // 背面匾（挂在后檐下，面向后院）
  if (plaqueBack) {
    const p2 = createPlaque(plaqueBack.text, {
      width: plaqueBack.width || 2.4,
      height: plaqueBack.height || 0.8,
      bg: plaqueBack.bg || '#0e0b08',
      fg: plaqueBack.fg || '#c9a35c',
      reverse: false,
    });
    p2.position.set(0, plaqueBack.y != null ? plaqueBack.y : columnH - 1.0, -halfD - 0.1);
    p2.rotation.y = Math.PI;
    g.add(p2);
  }

  /* ── 楹联 ── */
  if (couplets) {
    const ch = Math.min(2.9, columnH * 0.64);
    const cy = columnH * 0.46;
    const hasPorch2 = frontPorch > 1.0;
    const cz = hasPorch2 ? halfD - 0.1 : frontZ + 0.3;
    const midB = bw[Math.floor(bw.length / 2)];
    for (const [txt, sx] of [[couplets.left, -1], [couplets.right, 1]]) {
      if (!txt) continue;
      const c = createCouplet(txt, { width: 0.5, height: ch });
      c.position.set(sx * (midB / 2 + (hasPorch2 ? 0.18 : 0.42)), cy, cz);
      g.add(c);
    }
  }

  /* ── 抱鼓石 ── */
  if (drumStones) {
    for (const sx of [-1, 1]) {
      const d = createDrumStone(0.95);
      d.position.set(sx * (bw[Math.floor(bw.length / 2)] / 2 + 0.28), 0, frontZ + 0.36);
      g.add(d);
    }
  }

  /* ── 前出轩廊（讲堂：七间，宽于堂，自身低矮卷棚） ── */
  if (xuanLang) {
    const xlW = xuanLang.width;
    const xlD = xuanLang.depth;
    const xlH = xuanLang.columnH || columnH * 0.72;
    const xlRise = xuanLang.rise || 1.6;
    const xlZ = halfD + xlD / 2;
    const xlCols = [];
    const nBay = Math.max(4, Math.round(xlW / 3.4));
    const bayW2 = xlW / nBay;
    for (let i = 0; i <= nBay; i++) {
      const x = -xlW / 2 + bayW2 * i;
      // 外檐柱
      xlCols.push(place(cylinder(columnR * 0.85, columnR * 0.9, xlH, 12, COVER.woodLacquer), { x, y: xlH / 2, z: xlZ }));
      // 内柱（贴堂前檐）
      xlCols.push(place(cylinder(columnR * 0.85, columnR * 0.9, xlH, 12, COVER.woodLacquer), { x, y: xlH / 2, z: halfD - 0.3 }));
    }
    const xcm = new THREE.Mesh(merge(xlCols), MAT.woodLacquer);
    xcm.castShadow = true; xcm.receiveShadow = true;
    g.add(xcm);
    // 轩廊额枋
    const xf = [];
    xf.push(place(box(xlW + 0.3, 0.26, 0.18, COVER.caihua), { y: xlH - 0.13, z: xlZ }));
    xf.push(place(box(xlW + 0.3, 0.26, 0.18, COVER.caihua), { y: xlH - 0.13, z: halfD - 0.3 }));
    // 两侧山墙（封轩廊端头，白墙）
    for (const sx of [-1, 1]) {
      xf.push(place(box(0.3, xlH, xlD + 0.6, outWallMat), { x: sx * (xlW / 2 - 0.15), y: xlH / 2, z: xlZ - xlD / 2 + 0.3 }));
    }
    const xfm = new THREE.Mesh(merge(xf), MAT.caihua);
    xfm.castShadow = true;
    g.add(xfm);
    // 轩廊低顶：双坡小顶（卷棚感）
    const xlRoof = createRoof({
      width: xlW, depth: xlD + 1.2,
      eaveY: xlH + 0.1, rise: xlRise,
      style: 'roll', overhangX: 0.55, overhangZ: 0.7,
      lift: 0.3, flare: 0.16, ringCount: 8, ornament: false,
    });
    xlRoof.position.z = xlZ - 0.2;
    g.add(xlRoof);
  }

  /* ── 后连拜厅（讲堂后，硬山低廊） ── */
  if (baiTing) {
    const btW = baiTing.width;
    const btD = baiTing.depth;
    const btH = baiTing.columnH || columnH * 0.78;
    const btRise = baiTing.rise || 2.0;
    const btZ = -halfD - btD / 2;
    const btCols = [];
    const nBay = Math.max(4, Math.round(btW / 3.6));
    const bayW2 = btW / nBay;
    for (let i = 0; i <= nBay; i++) {
      const x = -btW / 2 + bayW2 * i;
      btCols.push(place(cylinder(columnR * 0.85, columnR * 0.9, btH, 12, COVER.woodLacquer), { x, y: btH / 2, z: btZ }));
    }
    const bcm = new THREE.Mesh(merge(btCols), MAT.woodLacquer);
    bcm.castShadow = true; bcm.receiveShadow = true;
    g.add(bcm);
    // 拜厅墙体：后墙封闭，两侧接堂后墙
    const btWalls = [];
    btWalls.push(place(box(btW - 0.2, btH, 0.32, outWallMat), { y: btH / 2, z: btZ - btD / 2 + 0.16 }));
    for (const sx of [-1, 1]) {
      btWalls.push(place(box(0.32, btH, btD, outWallMat), { x: sx * (btW / 2 - 0.16), y: btH / 2, z: btZ }));
    }
    const bwm2 = new THREE.Mesh(merge(btWalls), outWallMAT);
    bwm2.castShadow = true; bwm2.receiveShadow = true;
    g.add(bwm2);
    // 拜厅额枋 + 低顶
    const bf = place(box(btW + 0.3, 0.26, 0.18, COVER.caihua), { y: btH - 0.13, z: btZ + btD / 2 - 0.1 });
    const bfm = new THREE.Mesh(bf, MAT.caihua);
    bfm.castShadow = true;
    g.add(bfm);
    const btRoof = createRoof({
      width: btW, depth: btD + 1.0,
      eaveY: btH + 0.1, rise: btRise,
      style: 'gable', overhangX: 0.6, overhangZ: 0.75,
      lift: 0.28, flare: 0.14, ringCount: 8, ornament: false,
    });
    btRoof.position.z = btZ;
    g.add(btRoof);
  }

  /* ── 屋顶 ── */
  const roof = createRoof({
    width, depth, eaveY, rise, style: roofStyle,
    overhangX, overhangZ, curve, lift, flare, tile,
    ornament,
    detail,
    shouShan: roofStyle === 'xieshan' ? Math.min(depth * 0.28, 2.8) : null,
  });
  g.add(roof);

  /* ── 室内 ── */
  const roomType = typeof interior === 'object' ? interior.room : null;
  const roomOpts = (typeof interior === 'object' && interior.opts) || {};
  if (interior) {
    const innerW = width - 0.9;
    const innerD = depth - frontPorch - 0.9;
    const innerZ = -frontPorch / 2;

    // 金砖地面（比室外更细腻、更深）
    const floorMat = MAT.paving.clone();
    floorMat.color.setHex(0x8a867c);
    floorMat.emissive = new THREE.Color(0x1a1712);
    floorMat.emissiveIntensity = 0.5;
    const fl = new THREE.Mesh(plane(innerW, innerD, COVER.paving), floorMat);
    fl.position.set(0, 0.014, innerZ);
    fl.receiveShadow = true;
    g.add(fl);

    // 内墙抹灰（比外墙更白净）
    const wallMat = MAT.plaster.clone();
    wallMat.color.setHex(0xe8e2d2);
    wallMat.emissive = new THREE.Color(0x1d1a14);
    wallMat.emissiveIntensity = 0.44;
    const iwGeos = [];
    // 后墙内衬（薄体，双面可见）——后墙留空时不做，否则门洞被堵
    if (backType === 'wall') {
      iwGeos.push(place(box(width - 0.7, wallTop, 0.07, COVER.plaster), {
        y: wallTop / 2, z: -halfD + wallT + 0.05,
      }));
    }
    // 两侧山墙内衬
    for (const sx of [-1, 1]) {
      iwGeos.push(place(box(0.07, wallTop, depth - 0.7, COVER.plaster), {
        x: sx * (halfW - wallT - 0.05), y: wallTop / 2, z: 0,
      }));
    }
    const iwGeo = merge(iwGeos);
    if (iwGeo) {
      const iw = new THREE.Mesh(iwGeo, wallMat);
      iw.receiveShadow = true;
      g.add(iw);
    }

    // 梁架：每榀「大梁 + 瓜柱 + 三架梁 + 脊瓜柱 + 檩」
    const beamGeos = [];
    const trussN = Math.max(3, Math.round(depth / 3.2));
    for (let i = 0; i <= trussN; i++) {
      const z = -halfD + 0.7 + ((depth - 1.4) / trussN) * i;
      const yBeam = columnH - fangH - 0.32;
      const bm = box(width - 0.7, 0.3, 0.24, COVER.woodBeam);
      bm.translate(0, yBeam, z);
      beamGeos.push(bm);
      // 瓜柱
      for (const sx of [-1, 1]) {
        const p = box(0.18, 0.7, 0.18, COVER.woodBeam);
        p.translate(sx * (width * 0.22), yBeam + 0.5, z);
        beamGeos.push(p);
      }
      // 三架梁
      const bm2 = box(width * 0.5, 0.22, 0.2, COVER.woodBeam);
      bm2.translate(0, yBeam + 0.92, z);
      beamGeos.push(bm2);
      // 脊瓜柱
      const cp = box(0.16, 0.5, 0.16, COVER.woodBeam);
      cp.translate(0, yBeam + 1.26, z);
      beamGeos.push(cp);
    }
    // 檩条（纵向）
    for (const [x, y] of [[0, columnH + 0.62], [width * 0.22, columnH + 0.12], [-width * 0.22, columnH + 0.12]]) {
      const p = cylinder(0.09, 0.09, depth - 0.6, 8, COVER.woodBeam);
      p.rotateX(Math.PI / 2);
      p.translate(x, y, 0);
      beamGeos.push(p);
    }
    // 金柱
    for (const x of [edges[1], edges[edges.length - 2]]) {
      for (const z of [-halfD * 0.42, halfD * 0.42]) {
        beamGeos.push(place(cylinder(columnR * 0.92, columnR * 0.96, columnH - fangH, 12, COVER.woodLacquer), { x, y: (columnH - fangH) / 2, z }));
      }
    }
    const bg = merge(beamGeos);
    if (bg) {
      const beamMat = MAT.woodBeam.clone();
      beamMat.emissive = new THREE.Color(0x1a1208);
      beamMat.emissiveIntensity = 0.46;
      const bmMesh = new THREE.Mesh(bg, beamMat);
      bmMesh.castShadow = true;
      bmMesh.receiveShadow = true;
      g.add(bmMesh);
    }

    // 陈设
    const furnishers = {
      lecture: roomLecture,
      library: roomLibrary,
      shrine: roomShrine,
      dorm: roomDorm,
      classroom: roomClassroom,
      lounge: roomLounge,
      gate: roomGate,
    };
    const fn = roomType ? furnishers[roomType] : null;
    if (fn) {
      const room = fn({
        width: width - 1.0,
        depth: depth - frontPorch - 0.8,
        height: columnH - 0.4,
        ...roomOpts,
      });
      room.position.set(0, 0, innerZ);
      g.add(room);
    }

    // 室内补光（门屋贯通，光要弱，否则像个发光的洞）
    const isGateRoom = roomType === 'gate';
    if (typeof interior === 'object' && interior.light !== false) {
      const pl = new THREE.PointLight(0xfff0d8, isGateRoom ? 10 : 62, Math.max(width, depth) * 1.8, isGateRoom ? 2.2 : 1.5);
      pl.position.set(0, columnH * 0.66, innerZ + innerD * 0.18);
      g.add(pl);
      const pl2 = new THREE.PointLight(0xffe8c8, isGateRoom ? 6 : 38, Math.max(width, depth) * 1.4, isGateRoom ? 2.2 : 1.6);
      pl2.position.set(0, columnH * 0.55, innerZ - innerD * 0.22);
      g.add(pl2);
    }
  }

  /* ── 栏杆（前廊） ── */
  if (railing && frontPorch > 0) {
    const r = createRailing({ length: width - 0.4, height: 0.95, type: 'wood' });
    r.position.set(0, 0, halfD - 0.1);
    g.add(r);
  }

  g.userData.footprint = { w: pw, d: pd, h: eaveY + rise };
  g.userData.eaveY = eaveY;
  g.userData.ridgeY = eaveY + rise;
  g.userData.center = new THREE.Vector3(0, 0, pdCenter);
  g.userData.platform = { h: platformH, w: pw, d: pd, z: pdCenter };

  /* 墙体碰撞盒（局部坐标），前后檐门洞留空 */
  const midIdx = Math.floor(bw.length / 2);
  const midHalf = frontType === 'open' || frontType === 'door' || frontType === 'gate' || frontType === 'gate3'
    ? bw[midIdx] / 2 : 0;
  const backOpen = backType === 'gate' || backType === 'gate3';
  const backHalf = backOpen ? bw[midIdx] / 2 : (backType === 'wall' ? 0 : halfW);
  const t = 0.34;
  const walls = [];
  if (backType === 'wall') {
    walls.push({ x0: -halfW - t, x1: halfW + t, z0: -halfD - t, z1: -halfD + t });
  } else if (backOpen) {
    walls.push({ x0: -halfW - t, x1: -backHalf, z0: -halfD - t, z1: -halfD + t });
    walls.push({ x0: backHalf, x1: halfW + t, z0: -halfD - t, z1: -halfD + t });
  }
  walls.push({ x0: -halfW - t, x1: -halfW + t, z0: -halfD, z1: halfD });
  walls.push({ x0: halfW - t, x1: halfW + t, z0: -halfD, z1: halfD });
  if (midHalf > 0.2) {
    walls.push({ x0: -halfW, x1: -midHalf, z0: frontZ - t, z1: frontZ + t });
    walls.push({ x0: midHalf, x1: halfW, z0: frontZ - t, z1: frontZ + t });
  } else if (frontType === 'wall') {
    walls.push({ x0: -halfW, x1: halfW, z0: frontZ - t, z1: frontZ + t });
  }
  g.userData.walls = walls;
  g.userData.doorZ = frontZ;
  return g;
}
