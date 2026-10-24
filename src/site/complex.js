/**
 * 场景总装：把地形、建筑、围墙、水体、植被、陈设装配成完整的岳麓书院
 */
import * as THREE from 'three';
import { createHall } from '../arch/hall.js';
import { createPavilion, createTower, createHexiTai } from '../arch/pavilion.js';
import { createWallRun, createLion, createCenser, createLantern } from '../arch/details.js';
import { createCorridor, createPaifang, createZhaobi, createSideGate } from '../arch/corridor.js';
import { createTerrain, createTerracePaving, heightAt, TERRACE } from './terrain.js';
import { createPond, updateWater } from './water.js';
import { Vegetation } from './vegetation.js';
import { createPath, createStoneTable, createVat, createFence, createSteleCorridor, createFlagpole } from './props.js';
import { BUILDINGS, WATER, WALLS, TREES, CORRIDORS, GATEWAYS, at, ROT, AXIS, RIGHT, ORIGIN } from './layout.js';
import { MAT } from '../gfx/materials.js';
import { mulberry32 } from '../gfx/noise.js';

export async function buildAcademy(scene, onProgress = () => {}) {
  const root = new THREE.Group();
  root.name = 'academy';
  scene.add(root);

  const interactive = [];
  const buildings = [];
  const colliders = [];
  const platforms = [];
  const tmpV = new THREE.Vector3();

  /** 局部矩形盒 → 世界 AABB 碰撞盒 */
  function pushBox(obj, x0, x1, z0, z1) {
    const m = obj.matrixWorld;
    const pts = [
      tmpV.set(x0, 0, z0).applyMatrix4(m).clone(),
      tmpV.set(x1, 0, z0).applyMatrix4(m).clone(),
      tmpV.set(x0, 0, z1).applyMatrix4(m).clone(),
      tmpV.set(x1, 0, z1).applyMatrix4(m).clone(),
    ];
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    colliders.push({
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs),
    });
  }

  const timings = [];
  window.__timings = timings;
  const step = async (label, fn, pct) => {
    onProgress(pct, label);
    await new Promise((r) => setTimeout(r, 0));
    const t0 = performance.now();
    const r = fn();
    timings.push({ label, ms: Math.round(performance.now() - t0) });
    return r;
  };

  /* ── 地形 ── */
  const terrain = await step('正在堆叠岳麓山体', () => createTerrain(), 0.12);
  root.add(terrain);
  root.add(createTerracePaving());

  /* ── 建筑 ── */
  let bi = 0;
  for (const b of BUILDINGS) {
    await step(`正在营造 ${b.name}`, () => {
      let obj;
      if (b.type === 'hall') {
        obj = createHall({
          ...b.opts,
          interior: b.interior !== undefined ? b.interior : (b.opts.interior !== undefined ? b.opts.interior : true),
          detail: b.detail || b.opts.detail || 'normal',
          name: b.name,
        });
      }
      else if (b.type === 'pavilion') obj = createPavilion({ ...b.opts, plaque: b.opts.plaque || (b.sides >= 6 ? b.name : null) });
      else if (b.type === 'tower') obj = createTower({ ...b.opts, detail: b.detail || 'normal', interiorRoom: b.interior || null });
      else if (b.type === 'hexitai') obj = createHexiTai({ ...b.opts });

      if (!obj) return;
      const p = at(b.u, b.v);
      const gy = heightAt(p.x, p.z);   // 院外建筑（如爱晚亭）落到地形高度
      obj.position.set(p.x, gy, p.z);
      obj.rotation.y = ROT + (b.rot || 0);
      obj.userData.building = b;
      obj.userData.anchor = new THREE.Vector3(p.x, gy + (obj.userData.eaveY || 4) * 0.55, p.z);
      root.add(obj);
      obj.updateMatrixWorld(true);
      interactive.push(obj);
      buildings.push({ data: b, object: obj, pos: new THREE.Vector3(p.x, gy, p.z) });

      // 墙体碰撞（门洞处不放盒）
      if (obj.userData.walls) {
        for (const wb of obj.userData.walls) pushBox(obj, wb.x0, wb.x1, wb.z0, wb.z1);
      }
      // 台基高度（供步行时抬升）
      if (obj.userData.platform) {
        const pf = obj.userData.platform;
        const hw = pf.w / 2;
        const hd = pf.d / 2;
        const zc = pf.z || 0;
        const m = obj.matrixWorld;
        const pts = [
          tmpV.set(-hw, 0, -hd + zc).applyMatrix4(m).clone(),
          tmpV.set(hw, 0, -hd + zc).applyMatrix4(m).clone(),
          tmpV.set(-hw, 0, hd + zc).applyMatrix4(m).clone(),
          tmpV.set(hw, 0, hd + zc).applyMatrix4(m).clone(),
        ];
        const xs = pts.map((q) => q.x);
        const zs = pts.map((q) => q.z);
        platforms.push({
          minX: Math.min(...xs), maxX: Math.max(...xs),
          minZ: Math.min(...zs), maxZ: Math.max(...zs),
          y: pf.h + gy,
        });
      }
    }, 0.12 + (bi / BUILDINGS.length) * 0.56);
    bi++;
  }

  /* ── 围墙（遇侧门处断开） ── */
  await step('正在砌筑院墙', () => {
    // 需要开口的位置：侧门 + 头门（头门坐在东墙上）
    const gatePts = [
      ...GATEWAYS.filter((g) => g.type === 'sidegate').map((g) => ({ ...at(g.u, g.v), r: 5.0 })),
      { ...at(-16, 0), r: 8.0 },
      { ...at(168, 0), r: 5.5 },
    ];

    for (const w of WALLS) {
      const a = at(w.u0, w.v0);
      const c = at(w.u1, w.v1);
      const len = Math.hypot(c.x - a.x, c.z - a.z);
      if (len < 1) continue;
      const segs = Math.ceil(len / 6);
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs;
        const t1 = (i + 1) / segs;
        const p0 = { x: a.x + (c.x - a.x) * t0, z: a.z + (c.z - a.z) * t0 };
        const p1 = { x: a.x + (c.x - a.x) * t1, z: a.z + (c.z - a.z) * t1 };
        const mid = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 };
        // 门洞跳过
        if (gatePts.some((g) => Math.hypot(g.x - mid.x, g.z - mid.z) < g.r)) continue;
        const sl = Math.hypot(p1.x - p0.x, p1.z - p0.z);
        const wall = createWallRun({ length: sl + 0.15, height: w.h, thickness: 0.42 });
        wall.position.set(mid.x, 0, mid.z);
        wall.rotation.y = Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
        root.add(wall);
        // 墙体碰撞
        wall.updateMatrixWorld(true);
        pushBox(wall, -sl / 2 - 0.1, sl / 2 + 0.1, -0.35, 0.35);
      }
    }
  }, 0.7);

  /* ── 游廊 ── */
  await step('正在架设游廊', () => {
    for (const c of CORRIDORS) {
      const a = at(c.u0, c.v0);
      const b = at(c.u1, c.v1);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1.5) continue;
      const corr = createCorridor({
        length: len,
        width: c.width || 2.6,
        open: c.open !== false,
        wallSide: c.wallSide || 1,
      });
      corr.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      corr.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      root.add(corr);
      corr.updateMatrixWorld(true);
      // 廊墙碰撞
      if (c.open === false) {
        const ws = c.wallSide || 1;
        const hw = (c.width || 2.6) / 2;
        pushBox(corr, -len / 2, len / 2, ws > 0 ? hw - 0.1 : -hw - 0.3, ws > 0 ? hw + 0.3 : -hw + 0.1);
      }
    }
  }, 0.73);

  /* ── 牌坊、照壁、侧门 ── */
  await step('正在立牌坊设门', () => {
    for (const gw of GATEWAYS) {
      let obj;
      if (gw.type === 'paifang') obj = createPaifang({ width: 9.6, height: 7.4 });
      else if (gw.type === 'zhaobi') obj = createZhaobi({ width: 6.4, height: 3.3 });
      else obj = createSideGate({ width: 3.8, depth: 3.4, height: 3.5 });
      const p = at(gw.u, gw.v);
      obj.position.set(p.x, 0, p.z);
      obj.rotation.y = ROT + (gw.rot || 0);
      obj.userData.building = { ...gw, tag: gw.type === 'sidegate' ? '门' : '牌坊' };
      obj.userData.anchor = new THREE.Vector3(p.x, 3, p.z);
      root.add(obj);
      obj.updateMatrixWorld(true);
      interactive.push(obj);
      buildings.push({ data: { ...gw, tag: gw.type === 'sidegate' ? '门' : '牌坊' }, object: obj, pos: new THREE.Vector3(p.x, 0, p.z) });
      if (obj.userData.walls) {
        for (const wb of obj.userData.walls) pushBox(obj, wb.x0, wb.x1, wb.z0, wb.z1);
      }
    }
  }, 0.76);

  /* ── 水体 ── */
  await step('正在引泉注池', () => {
    for (const w of WATER) {
      const p = at(w.u, w.v);
      const pond = createPond({ w: w.w, d: w.d });
      pond.position.set(p.x, heightAt(p.x, p.z), p.z);
      pond.rotation.y = ROT + (w.rot || 0);
      root.add(pond);
    }
  }, 0.74);

  /* ── 甬道 ── */
  await step('正在铺设甬道', () => {
    // 中轴主路：自卑亭 → 头门 → 大门 → 二门 → 讲堂 → 御书楼 → 西门
    const axisPts = [];
    for (let u = -146; u <= 166; u += 10) {
      const p = at(u, 0);
      axisPts.push({ x: p.x, z: p.z });
    }
    root.add(createPath(axisPts, 3.2));

    // 前庭广场（头门—赫曦台—大门之间）
    {
      const pts = [];
      for (let u = -13; u <= 15; u += 4) {
        const p = at(u, 0);
        pts.push({ x: p.x, z: p.z });
      }
      root.add(createPath(pts, 16));
    }

    // 横向支路
    const cross = [
      { u: 0.6, v0: -46, v1: 46 },
      { u: 52, v0: -38, v1: 42 },
      { u: 87.5, v0: -30, v1: 30 },
      { u: 104, v0: -50, v1: 22 },
      { u: 136, v0: -44, v1: 44 },
      { u: 44, v0: 30, v1: 78 },
      { u: 85, v0: 40, v1: 88 },
      { u: 117, v0: 42, v1: 70 },
    ];
    for (const c of cross) {
      const pts = [];
      for (let v = c.v0; v <= c.v1; v += 6) {
        const p = at(c.u, v);
        pts.push({ x: p.x, z: p.z });
      }
      root.add(createPath(pts, 2.2));
    }

    // 西门外官道：西门 → 爱晚亭 → 清风峡 → 山上（贴地形爬坡）
    const westPts = [];
    for (const [u, v] of [[168, 0], [182, -3], [200, -8], [220, -14], [240, -20], [256, -22.5], [270, -21.5], [288, -19], [310, -23], [336, -33], [358, -45], [374, -55], [392, -62]]) {
      const p = at(u, v);
      westPts.push({ x: p.x, z: p.z });
    }
    root.add(createPath(westPts, 2.6, 0.03, heightAt));
    // 爱晚亭支路（自官道岔向亭前）
    const aiwanPts = [];
    for (const [u, v] of [[252, -21], [258, -18.5], [263, -16.5]]) {
      const p = at(u, v);
      aiwanPts.push({ x: p.x, z: p.z });
    }
    root.add(createPath(aiwanPts, 1.8, 0.03, heightAt));
  }, 0.78);

  /* ── 陈设 ── */
  await step('正在安放陈设', () => {
    // 大门前石狮（清代遗物）
    for (const s of [-1, 1]) {
      const lion = createLion(1.0);
      const off = at(13.4, s * 5.6);
      lion.position.set(off.x, 0, off.z);
      lion.rotation.y = ROT + Math.PI;
      root.add(lion);
    }
    // 讲堂前香炉
    const jt = BUILDINGS.find((b) => b.id === 'jiangtang');
    const jp = at(jt.u - 11, jt.v);
    const censer = createCenser(1.25);
    censer.position.set(jp.x, 0, jp.z);
    root.add(censer);

    // 御书楼前石桌
    const ys = BUILDINGS.find((b) => b.id === 'yushulou');
    for (const s of [-1, 1]) {
      const p = at(ys.u - 12, s * 8);
      const t = createStoneTable(1.0);
      t.position.set(p.x, 0, p.z);
      root.add(t);
    }

    // 水缸
    for (const [u, v] of [[36, -16], [36, 15], [74, 18], [112, -20]]) {
      const p = at(u, v);
      const vat = createVat(0.9);
      vat.position.set(p.x, 0, p.z);
      root.add(vat);
    }

    // 碑廊（麓山寺碑亭南侧）
    const bl = createSteleCorridor({ length: 15, depth: 2.8, count: 7 });
    const blp = at(26, -30);
    bl.position.set(blp.x, 0, blp.z);
    bl.rotation.y = ROT + Math.PI / 2;
    root.add(bl);

    // 竹篱（园林区）
    for (const [u, v, len, rot] of [[108, -30, 14, 0.5], [98, -44, 12, 2.3], [24, 74, 18, 0.2]]) {
      const p = at(u, v);
      const f = createFence({ length: len, height: 1.05 });
      f.position.set(p.x, 0, p.z);
      f.rotation.y = ROT + rot;
      root.add(f);
    }

    // 旗杆（头门两侧）
    for (const s of [-1, 1]) {
      const p = at(-17, s * 8.5);
      const fp = createFlagpole(9);
      fp.position.set(p.x, 0, p.z);
      root.add(fp);
    }

    // 灯笼（讲堂轩廊檐下）
    for (const s of [-1, 1]) {
      const p = at(jt.u - 3.2, s * 9.5);
      const l = createLantern(1.0);
      l.position.set(p.x, 3.6, p.z);
      root.add(l);
    }
  }, 0.82);

  /* ── 植被 ── */
  await step('正在种植林木', () => {
    const veg = new Vegetation(root);
    const items = [];

    // 院中古树
    for (const t of TREES) {
      const p = at(t.u, t.v);
      items.push({ x: p.x, z: p.z, y: 0, kind: t.kind, scale: t.scale, rotY: Math.random() * 6.28 });
    }

    // 山坡森林：近景完整树，山坡与远山用低模，按"看得见"分配密度
    const rng = mulberry32(4242);
    const nearKinds = ['camphor', 'maple', 'pine', 'maple', 'camphor', 'pine'];
    const farKinds = ['camphorFar', 'pineFar', 'camphorFar', 'pineFar', 'camphorFar'];

    const scatter = (count, uMin, uMax, vMin, vMax, kinds, opts = {}) => {
      let placed = 0;
      let t = 0;
      const maxT = count * 12;
      while (placed < count && t < maxT) {
        t++;
        const u = uMin + rng() * (uMax - uMin);
        const v = vMin + rng() * (vMax - vMin);
        // 爱晚亭周边留出林间空地（清风峡亭坪）
        if (Math.abs(u - 267) < 15 && Math.abs(v + 17) < 14) continue;
        const p = at(u, v);
        const h = heightAt(p.x, p.z);
        if (h < (opts.hMin ?? 0.3)) continue;
        items.push({
          x: p.x, z: p.z, y: h - 0.3,
          kind: kinds[Math.floor(rng() * kinds.length)],
          scale: (opts.sMin ?? 0.9) + rng() * (opts.sRange ?? 0.8),
          rotY: rng() * 6.28,
          far: !!opts.far,
        });
        placed++;
      }
    };

    // ① 院墙外近坡：完整模型，看得清枝干
    scatter(380, 210, 320, -300, 320, nearKinds, { hMin: 0.05, sMin: 0.85, sRange: 0.9 });
    // ② 山坡主体：低模，铺满
    scatter(1300, 235, 470, -420, 440, farKinds, { hMin: 0.5, sMin: 1.1, sRange: 0.9, far: true });
    // ③ 远山：低模，更大
    scatter(2000, 430, 1050, -560, 620, farKinds, { hMin: 1.0, sMin: 1.45, sRange: 1.2, far: true });
    // ④ 南北两翼低丘
    scatter(600, -140, 520, 120, 520, farKinds, { hMin: 0.8, sMin: 1.2, sRange: 0.9, far: true });
    scatter(600, -140, 520, -520, -100, farKinds, { hMin: 0.8, sMin: 1.2, sRange: 0.9, far: true });

    // 东侧校道林带：书院门外的梧桐夹道
    for (let i = 0; i < 46; i++) {
      for (const sgn of [-1, 1]) {
        const u = -148 + rng() * 76;
        const v = sgn * (15 + rng() * 26);
        const p = at(u, v);
        const h = heightAt(p.x, p.z);
        items.push({
          x: p.x, z: p.z, y: h - 0.2,
          kind: rng() > 0.4 ? 'camphor' : 'maple',
          scale: 0.75 + rng() * 0.55, rotY: rng() * 6.28,
        });
      }
    }

    // 竹林（百泉轩、曲涧一带，疏植留出院路）
    for (let i = 0; i < 24; i++) {
      const p = at(98 + rng() * 24, -36 + rng() * -12);
      items.push({ x: p.x, z: p.z, y: 0, kind: 'bamboo', scale: 0.9 + rng() * 0.4, rotY: rng() * 6.28 });
    }

    // 院内点景小树（代替灌木，避免远处噪点）
    const isOccupied = (u, v) => {
      for (const b of buildings) {
        const o = b.data.opts || {};
        const bw = (o.width || 12) * 0.5 + 2.6;
        const bd = (o.depth || 9) * 0.5 + 2.6;
        if (Math.abs(b.data.u - u) < bw && Math.abs(b.data.v - v) < bd) return true;
      }
      return false;
    };
    let sTries = 0;
    let placed = 0;
    while (placed < 14 && sTries < 2000) {
      sTries++;
      const u = -24 + rng() * 178;
      const v = -46 + rng() * 82;
      if (Math.abs(v) < 12) continue;
      // 避开专祠对角带与文庙院落
      if (u > 88 && v < -12 && v > u * -0.9 - 60) continue;
      if (u > 44 && u < 140 && v > 36 && v < 94) continue;
      if (isOccupied(u, v)) continue;
      const p = at(u, v);
      items.push({
        x: p.x, z: p.z, y: 0, kind: rng() > 0.45 ? 'maple' : 'camphor',
        scale: 0.3 + rng() * 0.22, rotY: rng() * 6.28,
      });
      placed++;
    }

    // 柳（吹香池边）
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2;
      const p = at(-8 + Math.cos(a) * 16, 91.5 + Math.sin(a) * 11);
      items.push({ x: p.x, z: p.z, y: 0, kind: 'willow', scale: 0.9 + rng() * 0.4, rotY: rng() * 6.28 });
    }

    // 爱晚亭周边枫林（红绿相间，「霜叶红于二月花」；亭坪留空）
    for (let i = 0; i < 56; i++) {
      const uu = 232 + rng() * 74;
      const vv = -56 + rng() * 72;
      if (Math.abs(uu - 267) < 11 && Math.abs(vv + 17) < 10) continue;
      const p = at(uu, vv);
      const h = heightAt(p.x, p.z);
      items.push({
        x: p.x, z: p.z, y: h - 0.2,
        kind: rng() > 0.42 ? 'mapleAutumn' : 'maple',
        scale: 0.9 + rng() * 0.7, rotY: rng() * 6.28,
      });
    }

    veg.plant(items);

    // 灌木：沿墙、路边、建筑角落
    // 灌木改用低矮树替代，避免小体量几何在远处成噪点

    // 景石
    const rocks = [];
    for (const [u, v, sz] of [[110, -31, 0.9], [114, -34, 0.7], [20, 74, 0.85], [8, 84, 0.65], [148, 8, 0.8], [40, -18, 0.6]]) {
      const p = at(u, v);
      rocks.push({ x: p.x, z: p.z, size: sz });
    }
    // veg.addRocks(rocks);  // 暂不放置，待石形调整

    // 地表散落物
    veg.addGroundLitter(items.filter((i) => i.kind !== 'bamboo'), at);

    // 荷叶（吹香池）
    const cp = at(-8, 91.5);
    veg.addLotus({ x: cp.x, y: 0.0, z: cp.z }, 12, 110);
  }, 0.92);

  /* ── 阴影设置 ── */
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.castShadow !== false;
      o.receiveShadow = true;
    }
  });

  onProgress(1, '落成');
  return { root, interactive, buildings, colliders, platforms };
}

/** 每帧更新 */
export function updateSite(t) {
  updateWater(t);
}
