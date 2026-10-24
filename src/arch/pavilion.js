/**
 * 亭 / 台 / 楼阁
 * 支持多边形攒尖顶、重檐楼阁、戏台
 */
import * as THREE from 'three';
import { createRoof, createBaoding, createChiwen } from './roof.js';
import { createColumn, createRailing, createSteps, createLatticeDoor, createLatticeWindow } from './details.js';
import { box, cylinder, merge, place, lathe, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';
import { createPlaque } from '../gfx/text.js';
import { roomLibrary, roomShrine, roomLecture } from './interior.js';

/* ─────────────────────────────────────────────
   多边形攒尖顶（六角、八角）
   ───────────────────────────────────────────── */
export function createPolygonRoof(o = {}) {
  const {
    sides = 6, radius = 3.2, eaveY = 0, rise = 2.4,
    overhang = 0.9, lift = 0.34, flare = 0.22,
    curve = 1.4, tile = 'grey', ringCount = 8,
    topR = 0,             // 收口半径（重檐下檐用，>0 时不封顶）
    withBaoding = true,
  } = o;
  const g = new THREE.Group();
  const R = radius + overhang;
  const ridgeY = eaveY + rise;

  const rings = [];
  const specs = [];
  for (let k = 0; k <= ringCount; k++) {
    const t = Math.pow(k / ringCount, 0.92);
    const r = Math.max(topR, R * (1 - t));
    const y = eaveY + rise * Math.pow(t, curve);
    specs.push({ r, y, t });
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
      const decay = Math.pow(1 - t, 2);
      const w = decay;
      const rr = r + flare * w;
      pts.push([Math.cos(a) * rr, y + lift * w, Math.sin(a) * rr]);
    }
    rings.push(pts);
  }

  const mb = new MeshBuilder();
  const cover = COVER.tile;
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k];
    const B = rings[k + 1];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = A[i], b = A[j], c = B[j], d = B[i];
      const slope = Math.hypot(R - Math.hypot(a[0], a[2]), a[1] - eaveY);
      mb.quad(a, b, c, d,
        [a[0] / cover, slope / cover], [b[0] / cover, slope / cover],
        [c[0] / cover, (slope + 0.4) / cover], [d[0] / cover, (slope + 0.4) / cover]);
    }
  }
  const geo = mb.build();
  const mat = (tile === 'glazedYellow' ? MAT.glazedYellow : tile === 'glazed' ? MAT.glazed : MAT.tile).clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  // 垂脊
  const ridgeGeos = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    const path = [];
    for (const sp of specs) {
      const decay = Math.pow(1 - sp.t, 2);
      path.push(new THREE.Vector3(
        Math.cos(a) * (sp.r + flare * decay),
        sp.y + lift * decay,
        Math.sin(a) * (sp.r + flare * decay),
      ));
    }
    for (let k = 0; k < path.length - 1; k++) {
      const p0 = path[k], p1 = path[k + 1];
      const len = p0.distanceTo(p1);
      if (len < 0.02) continue;
      const seg = box(0.2, 0.22, len + 0.03, 1.2);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      mid.y += 0.07;
      const dir = p1.clone().sub(p0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      seg.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
      ridgeGeos.push(seg);
    }
  }
  const rg = merge(ridgeGeos);
  if (rg) {
    const rm = new THREE.Mesh(rg, tile === 'glazedYellow' ? MAT.glazedYellow : tile === 'glazed' ? MAT.glazed : MAT.tileDark);
    rm.castShadow = true;
    g.add(rm);
  }

  // 宝顶（重檐下檐不装）
  if (withBaoding && topR <= 0.001) {
    const bd = createBaoding(1.0);
    bd.position.y = ridgeY;
    g.add(bd);
  }

  g.userData.ridgeY = ridgeY;
  return g;
}

/* ─────────────────────────────────────────────
   亭
   eightPosts：爱晚亭式内外八柱——外圈花岗岩方柱承下檐，
   内圈丹漆金柱通高承上檐；caisson：亭顶彩绘藻井
   ───────────────────────────────────────────── */
export function createPavilion(o = {}) {
  const {
    sides = 4, radius = 2.6, columnH = 3.0, platformH = 0.45,
    roofRise = 2.2, overhang = 0.85, lift = 0.32, flare = 0.2,
    tile = 'grey', railing = true, plaque = null, stone = false,
    columnR = 0.16, steps = true, doubleEave = false,
    eightPosts = null,      // { innerR, innerExtra, stoneOuter }
    caisson = false,        // 彩绘藻井
    innerBoard = null,      // 亭内横匾 { text, w, h }
    railingFront = true,    // 正面是否设坐凳栏杆
  } = o;

  const g = new THREE.Group();
  const R = radius;

  // 台基
  const pad = o.basePad != null ? o.basePad : 0.55;
  const baseShape = new THREE.Shape();
  const n = sides;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = Math.cos(a) * (R + pad);
    const y = Math.sin(a) * (R + pad);
    if (i === 0) baseShape.moveTo(x, y); else baseShape.lineTo(x, y);
  }
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: platformH, bevelEnabled: false, curveSegments: 1 });
  baseGeo.rotateX(-Math.PI / 2);
  baseGeo.translate(0, 0, 0);
  const uv = baseGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / COVER.granite, uv.getY(i) / COVER.granite);
  const baseMat = stone ? MAT.marble : MAT.granite;
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -platformH;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  // 柱：外圈（八柱式为花岗岩方柱，否则丹漆圆柱）
  const colGeos = [];
  if (eightPosts) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const sq = box(0.3, columnH, 0.3, COVER.granite);
      sq.translate(x, columnH / 2, z);
      colGeos.push(sq);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      colGeos.push(place(cylinder(columnR * 0.94, columnR, columnH, 12, COVER.woodLacquer), { x, y: columnH / 2, z }));
    }
  }
  const cm = new THREE.Mesh(merge(colGeos), eightPosts ? MAT.granite : MAT.woodLacquer);
  cm.castShadow = true;
  cm.receiveShadow = true;
  g.add(cm);

  // 额枋（连接柱顶）
  const fangGeos = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.PI / n;
    const a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / n;
    const p0 = new THREE.Vector3(Math.cos(a0) * R, columnH - 0.16, Math.sin(a0) * R);
    const p1 = new THREE.Vector3(Math.cos(a1) * R, columnH - 0.16, Math.sin(a1) * R);
    const len = p0.distanceTo(p1);
    const b = box(0.14, 0.3, len, COVER.caihua);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const dir = p1.clone().sub(p0).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    b.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    fangGeos.push(b);
  }
  const fm = new THREE.Mesh(merge(fangGeos), MAT.caihua);
  fm.castShadow = true;
  g.add(fm);

  // 坐凳栏杆（railingFront=false 时正面敞开）
  if (railing) {
    const railGeos = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + Math.PI / n;
      const a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / n;
      const midA = (a0 + a1) / 2;
      // 正面（局部 +z）敞开：跳过中线最靠近 +z 的一段
      if (!railingFront && Math.sin(midA) > 0.6 && Math.abs(Math.cos(midA)) < 0.75) continue;
      const p0 = new THREE.Vector3(Math.cos(a0) * (R - 0.16), 0.42, Math.sin(a0) * (R - 0.16));
      const p1 = new THREE.Vector3(Math.cos(a1) * (R - 0.16), 0.42, Math.sin(a1) * (R - 0.16));
      const len = p0.distanceTo(p1);
      const b = box(0.36, 0.08, len, COVER.woodLacquer);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const dir = p1.clone().sub(p0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      b.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
      railGeos.push(b);
    }
    const rm = new THREE.Mesh(merge(railGeos), MAT.woodLacquer);
    rm.castShadow = true;
    g.add(rm);
  }

  // 屋顶
  //  八柱式：内金柱通高直达上檐，下檐自外圈石柱收口于内圈
  //  普通重檐：下檐收口于 0.62R，上檐立于短柱之上
  let topEaveY = columnH;
  if (eightPosts) {
    const innerR = eightPosts.innerR;
    const halfSide = innerR / Math.SQRT2;   // 内圈方柱在对角上，边到中轴 = R/√2
    topEaveY = columnH + (eightPosts.innerExtra || 1.15);
    // 内圈金柱（圆木丹漆，通高插入上檐内）
    const inCols = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const x = Math.cos(a) * innerR;
      const z = Math.sin(a) * innerR;
      inCols.push(place(cylinder(0.21, 0.24, topEaveY + 0.95, 12, COVER.woodLacquer), { x, y: (topEaveY + 0.95) / 2, z }));
    }
    // 内圈井字枋（连接内柱，沿边布置）
    for (const sx of [-1, 1]) {
      inCols.push(place(box(halfSide * 2 + 0.3, 0.26, 0.16, COVER.caihua), { y: topEaveY - 0.13, x: 0, z: sx * halfSide }));
      inCols.push(place(box(0.16, 0.26, halfSide * 2 + 0.3, COVER.caihua), { y: topEaveY - 0.13, x: sx * halfSide, z: 0 }));
    }
    const im = new THREE.Mesh(merge(inCols), MAT.woodLacquer);
    im.castShadow = true;
    im.receiveShadow = true;
    g.add(im);
    // 下檐：自外圈石柱向内收口（檐口落在柱头）
    const lower = createPolygonRoof({
      sides: n, radius: R, eaveY: columnH - 0.03, rise: roofRise * 0.5,
      overhang: Math.min(overhang, 0.85), lift: lift * 0.8, flare: flare * 0.8,
      tile, ringCount: 6, topR: halfSide + 0.9, withBaoding: false,
    });
    g.add(lower);
  } else if (doubleEave) {
    const lowerR = R * 0.62;
    const lower = createPolygonRoof({
      sides: n, radius: R * 0.94, eaveY: columnH + 0.06, rise: roofRise * 0.52,
      overhang: overhang * 0.9, lift: lift * 0.8, flare: flare * 0.8,
      tile, ringCount: 6, topR: lowerR, withBaoding: false,
    });
    g.add(lower);
    topEaveY = columnH + 0.06 + roofRise * 0.52;
    // 上层短柱（井字梁上的檐柱）
    const upCols = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n + Math.PI / n;
      const rr = R * 0.5;
      upCols.push(place(cylinder(columnR * 0.8, columnR * 0.8, 1.15, 10, COVER.woodLacquer), {
        x: Math.cos(a) * rr, y: topEaveY + 0.575, z: Math.sin(a) * rr,
      }));
    }
    const um = new THREE.Mesh(merge(upCols), MAT.woodLacquer);
    um.castShadow = true;
    g.add(um);
    topEaveY += 1.15;
  }
  const roof = createPolygonRoof({
    sides: n,
    radius: eightPosts ? eightPosts.innerR + 0.5 : (doubleEave ? R * 0.52 : R),
    eaveY: topEaveY,
    rise: eightPosts ? roofRise : (doubleEave ? roofRise * 0.62 : roofRise),
    overhang, lift, flare, tile,
  });
  g.add(roof);

  // 匾（八柱式挂上檐柱间正面；普通亭挂下檐）
  if (plaque) {
    const isObj = typeof plaque === 'object';
    const text = isObj ? plaque.text : plaque;
    const pw2 = isObj && plaque.width ? plaque.width : 1.5;
    const ph2 = isObj && plaque.height ? plaque.height : 0.52;
    const p = createPlaque(text, {
      width: pw2, height: ph2,
      bg: isObj && plaque.bg ? plaque.bg : undefined,
      fg: isObj && plaque.fg ? plaque.fg : undefined,
    });
    if (eightPosts) {
      p.position.set(0, topEaveY - ph2 * 0.62, eightPosts.innerR / Math.SQRT2 + 0.12);
    } else {
      p.position.set(0, columnH - 0.62, R + 0.06);
    }
    g.add(p);
  }

  // 彩绘藻井（顶棚）：方形井字天花 + 金绿同心环圆藻井
  if (caisson && eightPosts) {
    const halfSide = eightPosts.innerR / Math.SQRT2;
    // 井字天花底板
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(halfSide * 2 + 0.2, 0.1, halfSide * 2 + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.95 }),
    );
    ceil.position.y = topEaveY + 0.32;
    g.add(ceil);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#14303c';
    c2.fillRect(0, 0, 256, 256);
    const rings = [118, 96, 74, 52, 32];
    const cols = ['#2c5a68', '#c8a54c', '#39634a', '#8f2a1e', '#b09246'];
    rings.forEach((r, i) => {
      c2.beginPath();
      c2.arc(128, 128, r, 0, Math.PI * 2);
      c2.fillStyle = cols[i % cols.length];
      c2.fill();
    });
    // 放射莲瓣短线
    c2.strokeStyle = '#e8d9a0';
    c2.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      c2.beginPath();
      c2.moveTo(128 + Math.cos(a) * 34, 128 + Math.sin(a) * 34);
      c2.lineTo(128 + Math.cos(a) * 72, 128 + Math.sin(a) * 72);
      c2.stroke();
    }
    c2.beginPath();
    c2.arc(128, 128, 14, 0, Math.PI * 2);
    c2.fillStyle = '#f0d488';
    c2.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(halfSide - 0.35, 24),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }),
    );
    disc.rotation.x = Math.PI / 2;   // 面朝下
    disc.position.y = topEaveY + 0.26;
    g.add(disc);
  }

  // 亭内横匾（爱晚亭内《沁园春·长沙》）
  if (innerBoard && eightPosts) {
    const b2 = createPlaque(innerBoard.text, {
      width: innerBoard.w || 2.4, height: innerBoard.h || 0.62,
      bg: innerBoard.bg || '#1d1710', fg: innerBoard.fg || '#d8c48a',
      reverse: false,
    });
    b2.position.set(0, topEaveY - 1.3, -(eightPosts.innerR / Math.SQRT2 - 0.3));
    g.add(b2);
  }

  g.userData.footprint = { w: (R + pad) * 2, d: (R + pad) * 2, h: topEaveY + roofRise };
  return g;
}

/* ─────────────────────────────────────────────
   重檐楼阁（御书楼 / 文昌阁 / 大成殿）
   ───────────────────────────────────────────── */
export function createTower(o = {}) {
  const {
    width = 18, depth = 12, bayWidths = null,
    floorH = 3.6, floors = 3,
    platformH = 1.3, platformPad = 2.0,
    roofStyle = 'xieshan', roofRise = 3.6,
    overhangX = 1.5, overhangZ = 1.3,
    tile = 'grey', plaque = null, plaqueText = '',
    veranda = true,
    detail = 'normal',
    yuetai = null,          // 月台 { w, d }（前出月台，大成殿）
    interiorRoom = null,    // 底层室内 { room: 'library' | 'shrine' }
  } = o;

  const g = new THREE.Group();
  const halfW = width / 2;
  const halfD = depth / 2;

  // 台基
  const pw = width + platformPad * 2;
  const pd = depth + platformPad * 2 + (yuetai ? yuetai.d : 0);
  const pdC = -(yuetai ? yuetai.d / 2 : 0);
  const baseGeos = [];
  const b = box(pw, platformH, pd, COVER.granite);
  b.translate(0, -platformH / 2, pdC);
  baseGeos.push(b);
  // 须弥座束腰
  const waist = box(pw + 0.3, platformH * 0.28, pd + 0.3, COVER.granite);
  waist.translate(0, -platformH * 0.55, pdC);
  baseGeos.push(waist);
  const bm = new THREE.Mesh(merge(baseGeos), MAT.granite);
  bm.castShadow = true;
  bm.receiveShadow = true;
  g.add(bm);

  // 台阶（有月台时移到月台前缘）
  const stZ = yuetai ? pdC + pd / 2 : pd / 2;
  const st = createSteps({ width: Math.min(width * 0.52, 9), height: platformH, depth: platformH * 2.6, treads: 8, yulLu: width > 18 });
  st.position.set(0, -platformH, stZ + 0.02);
  g.add(st);

  // 逐层
  let curY = 0;
  let curW = width;
  let curD = depth;
  const tierGeos = [];
  const winGroup = new THREE.Group();
  g.add(winGroup);
  for (let f = 0; f < floors; f++) {
    const h = floorH * (f === 0 ? 1.15 : 1.0);
    // 柱
    const cols = [];
    const nx = Math.max(3, Math.round(curW / 3.6));
    const nz = Math.max(2, Math.round(curD / 3.6));
    for (let i = 0; i <= nx; i++) {
      const x = -curW / 2 + (curW / nx) * i;
      for (const z of [curD / 2, -curD / 2]) {
        cols.push(place(cylinder(0.19, 0.21, h, 12, COVER.woodLacquer), { x, y: curY + h / 2, z }));
      }
    }
    for (let j = 1; j < nz; j++) {
      const z = -curD / 2 + (curD / nz) * j;
      for (const x of [curW / 2, -curW / 2]) {
        cols.push(place(cylinder(0.19, 0.21, h, 12, COVER.woodLacquer), { x, y: curY + h / 2, z }));
      }
    }
    tierGeos.push(...cols);

    // 额枋
    const fh = 0.34;
    for (const z of [curD / 2, -curD / 2]) {
      const fb = box(curW + 0.3, fh, 0.2, COVER.caihua);
      fb.translate(0, curY + h - fh / 2, z);
      tierGeos.push(fb);
    }
    for (const x of [curW / 2, -curW / 2]) {
      const fb = box(0.2, fh, curD + 0.3, COVER.caihua);
      fb.translate(x, curY + h - fh / 2, 0);
      tierGeos.push(fb);
    }

    // 中间层墙体（顶层的墙在循环后单独建）
    if (f < floors - 1) {
      const wlH = h * 0.88;
      const wlGeos = [];
      // 后墙 + 两山墙
      const bw3 = box(curW, wlH, 0.35, COVER.plaster);
      bw3.translate(0, curY + wlH / 2, -curD / 2);
      wlGeos.push(bw3);
      for (const sx of [-1, 1]) {
        const sw2 = box(0.35, wlH, curD, COVER.plaster);
        sw2.translate(sx * curW / 2, curY + wlH / 2, 0);
        wlGeos.push(sw2);
      }
      if (f === 0) {
        // 底层前檐：中央开门洞（可入室），两侧槛墙+隔扇窗
        const gapW = Math.min(curW * 0.38, 4.2);
        const segW = (curW - gapW) / 2;
        for (const sx of [-1, 1]) {
          const seg = box(segW, wlH, 0.32, COVER.plaster);
          seg.translate(sx * (gapW / 2 + segW / 2), curY + wlH / 2, curD / 2);
          wlGeos.push(seg);
        }
        const lintel = box(gapW + 0.5, 0.32, 0.36, COVER.woodBeam);
        lintel.translate(0, curY + wlH - 0.16, curD / 2);
        wlGeos.push(lintel);
        // 两侧隔扇窗
        for (const sx of [-1, 1]) {
          const win = createLatticeWindow({ width: segW * 0.62, height: wlH * 0.52 });
          win.position.set(sx * (gapW / 2 + segW / 2), curY + wlH * 0.48, curD / 2 + 0.18);
          winGroup.add(win);
        }
      } else {
        // 上层：整排隔扇
        const nD = Math.max(4, Math.round(curW / 1.05));
        const dw2 = curW / nD;
        for (let i = 0; i < nD; i++) {
          const d = createLatticeDoor({ width: dw2 - 0.03, height: wlH * 0.94 });
          d.position.set(-curW / 2 + dw2 * (i + 0.5), curY + wlH * 0.47 + 0.03, curD / 2 + 0.02);
          winGroup.add(d);
        }
      }
      const wlm = new THREE.Mesh(merge(wlGeos), MAT.plaster);
      wlm.castShadow = true;
      wlm.receiveShadow = true;
      g.add(wlm);
    }

    // 楼层间：腰檐（两层重檐时下檐用低缓披檐，避免叠成塔式）
    if (f < floors - 1) {
      const isTop = f === floors - 2 && floors > 2;
      const eave = createRoof({
        width: curW, depth: curD,
        eaveY: curY + h + 0.1,
        rise: isTop ? roofRise * 0.9 : 1.35,
        style: isTop ? roofStyle : 'hip',
        overhangX: isTop ? overhangX : 1.05,
        overhangZ: isTop ? overhangZ : 1.0,
        lift: isTop ? 0.6 : 0.4,
        flare: isTop ? 0.36 : 0.24,
        tile, ornament: isTop, ringCount: isTop ? 12 : 8, detail: isTop ? detail : 'normal',
        shouShan: isTop && roofStyle === 'xieshan' ? Math.min(curD * 0.28, 2.6) : null,
      });
      g.add(eave);

      // 平座栏杆
      const rl = createRailing({ length: curW + 1.4, height: 0.72, type: 'wood', postEvery: 1.4 });
      rl.position.set(0, curY + h + 0.1, curD / 2 + 0.6);
      g.add(rl);
      const rl2 = createRailing({ length: curW + 1.4, height: 0.72, type: 'wood', postEvery: 1.4 });
      rl2.position.set(0, curY + h + 0.1, -curD / 2 - 0.6);
      g.add(rl2);

      // 二层收进
      curY += h + 0.85;
      curW *= 0.9;
      curD *= 0.88;
    } else {
      // 顶层：墙 + 窗
      curY += h;
    }
  }

  const tg = merge(tierGeos);
  const tm = new THREE.Mesh(tg, MAT.woodLacquer);
  tm.castShadow = true;
  tm.receiveShadow = true;
  g.add(tm);

  // 顶层墙
  const wallH = floorH * 0.86;
  const wallGeos = [];
  const backW = box(curW, wallH, 0.35, COVER.brick);
  backW.translate(0, curY - wallH / 2, -curD / 2);
  wallGeos.push(backW);
  for (const sx of [-1, 1]) {
    const sw = box(0.35, wallH, curD, COVER.brick);
    sw.translate(sx * curW / 2, curY - wallH / 2, 0);
    wallGeos.push(sw);
  }
  const wm = new THREE.Mesh(merge(wallGeos), MAT.plaster);
  wm.castShadow = true;
  wm.receiveShadow = true;
  g.add(wm);

  // 顶层隔扇
  const doorH = wallH * 0.92;
  const nDoor = Math.max(4, Math.round(curW / 1.0));
  const dw = curW / nDoor;
  for (let i = 0; i < nDoor; i++) {
    const d = createLatticeDoor({ width: dw - 0.03, height: doorH });
    d.position.set(-curW / 2 + dw * (i + 0.5), curY - wallH + doorH / 2 + 0.05, curD / 2 + 0.02);
    g.add(d);
  }

  // 顶层屋顶
  const topRoof = createRoof({
    width: curW, depth: curD,
    eaveY: curY + 0.05,
    rise: roofRise,
    style: roofStyle,
    overhangX, overhangZ,
    lift: 0.62, flare: 0.38,
    tile, ringCount: 14, detail,
    shouShan: roofStyle === 'xieshan' ? Math.min(curD * 0.28, 2.8) : null,
  });
  g.add(topRoof);

  // 匾
  if (plaque) {
    const p = createPlaque(plaqueText || plaque, { width: Math.min(3.0, curW * 0.4), height: 0.95 });
    p.position.set(0, curY - wallH * 0.42, curD / 2 + 0.3);
    g.add(p);
  }

  // 底层室内（御书楼书架环列 / 大成殿神龛）
  if (interiorRoom) {
    const furnishers = { library: roomLibrary, shrine: roomShrine, lecture: roomLecture };
    const fn = furnishers[interiorRoom.room];
    if (fn) {
      const room = fn({
        width: width - 1.2,
        depth: depth - 1.2,
        height: floorH * 1.1,
      });
      room.position.set(0, 0.02, 0);
      g.add(room);
      // 底层补光
      const pl = new THREE.PointLight(0xfff0d8, 50, Math.max(width, depth) * 1.6, 1.6);
      pl.position.set(0, floorH * 0.62, 0);
      g.add(pl);
      const pl2 = new THREE.PointLight(0xffe8c8, 30, Math.max(width, depth) * 1.2, 1.7);
      pl2.position.set(0, floorH * 0.5, -depth * 0.2);
      g.add(pl2);
      // 金砖地面
      const floorMat = MAT.paving.clone();
      floorMat.color.setHex(0x8a867c);
      floorMat.emissive = new THREE.Color(0x1a1712);
      floorMat.emissiveIntensity = 0.5;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.9, depth - 0.9), floorMat);
      fl.rotation.x = -Math.PI / 2;
      fl.position.y = 0.016;
      fl.receiveShadow = true;
      g.add(fl);
    }
  }

  g.userData.footprint = { w: pw, d: pd, h: curY + roofRise };
  g.userData.platform = { h: platformH, w: pw, d: pd, z: pdC };
  return g;
}

/* ─────────────────────────────────────────────
   赫曦台：前部单檐歇山戏台，后部三间弓形硬山，凸形平面
   ───────────────────────────────────────────── */
export function createHexiTai(o = {}) {
  const {
    frontW = 10.2, frontD = 6.4,
    backW = 10.2, backD = 7.0,
    platformH = 1.15,
    columnH = 4.0,
    roofRise = 2.6,
  } = o;

  const g = new THREE.Group();

  // 凸形台基
  const shape = new THREE.Shape();
  const fw = frontW / 2, bw = backW / 2;
  const fd = frontD, bd = backD;
  shape.moveTo(-bw - 0.6, -bd / 2 - 0.6);
  shape.lineTo(bw + 0.6, -bd / 2 - 0.6);
  shape.lineTo(bw + 0.6, 0);
  shape.lineTo(fw + 0.6, 0);
  shape.lineTo(fw + 0.6, fd + 0.6);
  shape.lineTo(-fw - 0.6, fd + 0.6);
  shape.lineTo(-fw - 0.6, 0);
  shape.lineTo(-bw - 0.6, 0);
  shape.closePath();
  const baseGeo = new THREE.ExtrudeGeometry(shape, { depth: platformH, bevelEnabled: false });
  baseGeo.rotateX(-Math.PI / 2);
  baseGeo.translate(0, 0, -bd / 2);
  const uv = baseGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / COVER.granite, uv.getY(i) / COVER.granite);
  const base = new THREE.Mesh(baseGeo, MAT.granite);
  base.position.y = -platformH;
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  // 台面铺地
  const floorGeo = new THREE.ShapeGeometry(shape);
  floorGeo.rotateX(Math.PI / 2);
  floorGeo.translate(0, 0.005, -bd / 2);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) / COVER.paving, fuv.getY(i) / COVER.paving);
  const floor = new THREE.Mesh(floorGeo, MAT.paving);
  floor.receiveShadow = true;
  g.add(floor);

  // 前部戏台：四柱 + 单檐歇山
  const fz = fd * 0.5;
  const colGeos = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      colGeos.push(place(cylinder(0.2, 0.22, columnH, 12, COVER.woodLacquer), {
        x: sx * (fw - 0.4), y: columnH / 2, z: fz + sz * (fd / 2 - 0.4),
      }));
    }
  }
  const cm = new THREE.Mesh(merge(colGeos), MAT.woodLacquer);
  cm.castShadow = true; cm.receiveShadow = true;
  g.add(cm);

  const roofFront = createRoof({
    width: frontW + 0.4, depth: fd + 0.1,
    eaveY: columnH, rise: roofRise,
    style: 'xieshan', overhangX: 1.15, overhangZ: 0.55,
    lift: 0.62, flare: 0.4, ringCount: 12,
    shouShan: 1.9,
  });
  roofFront.position.z = fz;
  g.add(roofFront);

  // 后部三间硬山
  const backH = columnH * 0.86;
  const backWallGeos = [];
  const bw2 = box(backW, backH, 0.4, COVER.brick);
  bw2.translate(0, backH / 2, -bd / 2 + 0.2);
  backWallGeos.push(bw2);
  for (const sx of [-1, 1]) {
    const sw = box(0.4, backH, bd, COVER.brick);
    sw.translate(sx * (bw / 2 - 0.2), backH / 2, -bd / 4);
    backWallGeos.push(sw);
    // 后堂前壁（舞台两侧，福寿二字的壁面）
    const segW2 = (bw - fw) / 2 - 0.2;
    if (segW2 > 0.4) {
      const fw2 = box(segW2, backH, 0.34, COVER.brick);
      fw2.translate(sx * (fw / 2 + segW2 / 2), backH / 2, 0);
      backWallGeos.push(fw2);
    }
  }
  const bwm = new THREE.Mesh(merge(backWallGeos), MAT.plaster);
  bwm.castShadow = true; bwm.receiveShadow = true;
  g.add(bwm);

  const roofBack = createRoof({
    width: backW, depth: bd + 0.6,
    eaveY: backH + 0.08, rise: roofRise * 0.78,
    style: 'gable', overhangX: 0.75, overhangZ: 0.35,
    lift: 0.3, flare: 0.16, ringCount: 10,
  });
  roofBack.position.z = -bd / 2 - 0.3;
  g.add(roofBack);

  // 台前石阶
  const st = createSteps({ width: frontW * 0.6, height: platformH, depth: 1.6, treads: 6 });
  st.position.set(0, -platformH, fd + 0.6 + 0.02);
  g.add(st);

  // 台上内壁「福」「寿」二大字（传为朱熹、张栻所书；福朱色，寿墨色）
  function bigChar(ch, color) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const c2 = cv.getContext('2d');
    c2.clearRect(0, 0, 256, 256);
    c2.font = '190px "KaiTi","STKaiti","楷体",serif';
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillStyle = color;
    c2.fillText(ch, 128, 138);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    return new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), mat);
  }
  const fu = bigChar('福', '#a83226');
  fu.position.set(-(fw / 2 + (bw - fw) / 4), 2.55, 0.21);
  g.add(fu);
  const shou = bigChar('寿', '#1d1a14');
  shou.position.set(fw / 2 + (bw - fw) / 4, 2.55, 0.21);
  g.add(shou);

  // 匾
  const p = createPlaque('赫曦台', { width: 1.9, height: 0.66 });
  p.position.set(0, columnH - 0.7, fd + 0.62);
  g.add(p);

  g.userData.footprint = { w: frontW + 1.2, d: fd + bd + 1.2, h: columnH + roofRise };
  return g;
}
