/**
 * 植被：香樟、枫香、马尾松、竹、柳、荷
 * 全部程序化生成并用 InstancedMesh 实例化
 */
import * as THREE from 'three';
import { merge, cylinder, tint, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';
import { mulberry32 } from '../gfx/noise.js';
import { heightAt } from './terrain.js';
import { crossQuadGeometry, foliageMaterial } from './foliage.js';

/* ── 树种参数 ── */
const TREE_CFG = {
  camphor: { hMin: 8.5, hMax: 12.5, rMin: 3.6, rMax: 5.0, crownY: 0.62, clusters: 78, color: 0x5e7d3c, trunkR: 0.56, trunkSeg: 10 },
  maple: { hMin: 6.2, hMax: 9.2, rMin: 2.8, rMax: 4.0, crownY: 0.66, clusters: 64, color: 0x6d8a40, trunkR: 0.40, trunkSeg: 8 },
  mapleAutumn: { hMin: 6.0, hMax: 9.0, rMin: 2.7, rMax: 3.9, crownY: 0.66, clusters: 64, color: 0xa04a24, trunkR: 0.40, trunkSeg: 8 },
  pine: { hMin: 7.5, hMax: 11.5, rMin: 2.3, rMax: 3.3, crownY: 0.42, clusters: 52, color: 0x44603a, conifer: true, trunkR: 0.36, trunkSeg: 8 },
  bamboo: { hMin: 5, hMax: 10, rMin: 1.4, rMax: 2.0, crownY: 0.55, clusters: 0, color: 0x6f8f46 },
  willow: { hMin: 4.2, hMax: 6.0, rMin: 2.4, rMax: 3.2, crownY: 0.62, clusters: 0, color: 0x78974a },
  // 远景：叶簇少而大，只求轮廓与色块，省几何
  camphorFar: { hMin: 9, hMax: 13.5, rMin: 4.2, rMax: 5.8, crownY: 0.60, clusters: 9, color: 0x54704a, clusterScale: 4.4 },
  pineFar: { hMin: 8, hMax: 12, rMin: 3.4, rMax: 4.6, crownY: 0.42, clusters: 9, color: 0x486243, conifer: true, clusterScale: 4.0 },
};

/* ── 树冠：多个不规则球体拼成团块 ── */
function crownGeometry(rng, radius, lobes = 5, flatten = 1) {
  const parts = [];
  // 用较多、较小的叶团堆出蓬松而不规则的冠形
  for (let i = 0; i < lobes; i++) {
    const r = radius * (0.26 + rng() * 0.3);
    const g = new THREE.IcosahedronGeometry(r, 1);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const k = 0.62 + rng() * 0.76;
      pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k * flatten, pos.getZ(v) * k);
    }
    const a = rng() * Math.PI * 2;
    const rad = radius * (0.18 + rng() * 0.62);
    const lift = (rng() - 0.28) * radius * 0.95;
    g.translate(Math.cos(a) * rad, lift, Math.sin(a) * rad);
    g.computeVertexNormals();
    parts.push(g);
  }
  const geo = merge(parts);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  for (let i = 0; i < pos.count; i++) {
    const y = (pos.getY(i) - minY) / (maxY - minY + 1e-5);
    // 上亮下暗（模拟环境遮蔽），并加随机色差
    const k = 0.28 + y * 0.62 + (rng() - 0.5) * 0.26;
    colors[i * 3] = 0.58 * k;
    colors[i * 3 + 1] = 0.8 * k;
    colors[i * 3 + 2] = 0.42 * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* ── 树干：主干 + 数条分枝 ── */
function trunkGeometry(rng, height, radius, branches = 3) {
  const parts = [];
  const main = cylinder(radius * 0.55, radius, height, 8, COVER.bark);
  main.translate(0, height / 2, 0);
  parts.push(main);
  for (let i = 0; i < branches; i++) {
    const a = rng() * Math.PI * 2;
    const h = height * (0.45 + rng() * 0.35);
    const len = height * (0.25 + rng() * 0.3);
    const b = cylinder(radius * 0.18, radius * 0.4, len, 6, COVER.bark);
    b.translate(0, len / 2, 0);
    b.rotateZ(0.5 + rng() * 0.5);
    b.rotateY(a);
    b.translate(0, h, 0);
    parts.push(b);
  }
  return merge(parts);
}

/* ── 竹 ── */
function bambooGeometry(rng) {
  const parts = [];
  const n = 7 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const h = 5 + rng() * 5;
    const r = 0.028 + rng() * 0.018;
    const lean = (rng() - 0.5) * 0.22;
    const g = cylinder(r * 0.7, r, h, 5, 1.2);
    g.translate(0, h / 2, 0);
    g.rotateZ(lean);
    const a = rng() * Math.PI * 2;
    const rad = rng() * 1.4;
    g.translate(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    parts.push(g);
    // 竹叶：几片小面
    for (let k = 0; k < 5; k++) {
      const ly = h * (0.55 + rng() * 0.42);
      const w = 0.5 + rng() * 0.5;
      const hh = 0.1;
      const mb = new MeshBuilder();
      mb.quad(
        [-w / 2, 0, 0], [w / 2, 0, 0], [w * 0.3, hh, 0.06], [-w * 0.3, hh, 0.06],
        [0, 0], [1, 0], [1, 1], [0, 1],
      );
      const lg = mb.build(false);
      lg.rotateZ((rng() - 0.5) * 0.9);
      lg.rotateY(rng() * Math.PI * 2);
      lg.translate(Math.cos(a) * rad + (rng() - 0.5) * 0.5, ly, Math.sin(a) * rad + (rng() - 0.5) * 0.5);
      parts.push(lg);
    }
  }
  return tint(merge(parts), 0xdce6c4);
}

/* ── 松：层叠的锥形树冠 ── */
function pineGeometry(rng) {
  const trunk = cylinder(0.16, 0.26, 6.5, 7, COVER.bark);
  trunk.translate(0, 3.25, 0);
  const parts = [trunk];
  const layers = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const r = 2.4 * (1 - t * 0.62);
    const h = 1.9;
    const cone = new THREE.ConeGeometry(r, h, 9, 1);
    const pos = cone.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const k = 0.85 + rng() * 0.3;
      pos.setXYZ(v, pos.getX(v) * k, pos.getY(v), pos.getZ(v) * k);
    }
    cone.computeVertexNormals();
    cone.translate((rng() - 0.5) * 0.5, 3.2 + t * 4.4, (rng() - 0.5) * 0.5);
    parts.push(cone);
  }
  const geo = merge(parts);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.55 + Math.min(1, pos.getY(i) / 8) * 0.35 + (rng() - 0.5) * 0.12;
    colors[i * 3] = 0.42 * k;
    colors[i * 3 + 1] = 0.78 * k;
    colors[i * 3 + 2] = 0.48 * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* ── 柳：下垂枝条 ── */
function willowGeometry(rng) {
  const trunk = cylinder(0.14, 0.24, 4.2, 7, COVER.bark);
  trunk.translate(0, 2.1, 0);
  const parts = [trunk];
  const n = 10 + Math.floor(rng() * 8);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const len = 2.2 + rng() * 2.6;
    const g = cylinder(0.02, 0.05, len, 4, 1.2);
    g.translate(0, -len / 2, 0);
    g.rotateZ((rng() - 0.5) * 0.5);
    g.translate(Math.cos(a) * (0.4 + rng() * 0.9), 4.0 + rng() * 0.8, Math.sin(a) * (0.4 + rng() * 0.9));
    parts.push(g);
  }
  const geo = merge(parts);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.6 + Math.min(1, pos.getY(i) / 5) * 0.4 + (rng() - 0.5) * 0.1;
    colors[i * 3] = 0.62 * k;
    colors[i * 3 + 1] = 0.86 * k;
    colors[i * 3 + 2] = 0.44 * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** 植被管理器 */
export class Vegetation {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    scene.add(this.group);
  }

  /**
   * 批量种树：树干用 InstancedMesh，树冠用叶簇 billboard
   * @param {Array} items [{ x, z, kind, scale, rotY, y? }]
   */
  plant(items) {
    const rng = mulberry32(2026);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    // 树干按树种分组
    const trunkGroups = new Map();
    // 叶簇：阔叶 / 针叶 两组
    const clusterSets = { broad: [], conifer: [], broadFar: [], coniferFar: [] };

    for (const it of items) {
      const cfg = TREE_CFG[it.kind] || TREE_CFG.camphor;
      const s = it.scale || 1;
      const gy = it.y ?? heightAt(it.x, it.z);
      const H = (cfg.hMin + rng() * (cfg.hMax - cfg.hMin)) * s;
      const R = (cfg.rMin + rng() * (cfg.rMax - cfg.rMin)) * s;

      // 树干
      if (cfg.trunkR && !it.far) {
        const key = it.kind;
        if (!trunkGroups.has(key)) trunkGroups.set(key, []);
        trunkGroups.get(key).push({ it, H, R, gy, s, cfg });
      }

      // 叶簇
      if (cfg.clusters > 0) {
        const cy = gy + H * cfg.crownY;
        const grp = (it.far ? (cfg.conifer ? 'coniferFar' : 'broadFar') : (cfg.conifer ? 'conifer' : 'broad'));
        if (!clusterSets[grp]) clusterSets[grp] = [];
        const set = clusterSets[grp];
        const n = Math.round(cfg.clusters * (0.8 + rng() * 0.4));
        for (let k = 0; k < n; k++) {
          // 球面分布，偏向表面
          const theta = rng() * Math.PI * 2;
          const phi = Math.acos(2 * rng() - 1);
          const rr = R * Math.pow(rng(), 0.42);
          const px = Math.sin(phi) * Math.cos(theta) * rr;
          const pz = Math.sin(phi) * Math.sin(theta) * rr;
          const py = Math.cos(phi) * rr * 0.82;
          const cs = (1.05 + rng() * 0.85) * s * (cfg.clusterScale || 1) * (cfg.conifer ? 0.72 : 1);
          // 边缘的叶簇略小
          const edge = rr / R;
          const shade = 0.80 + (1 - edge) * 0.26 + rng() * 0.14;
          set.push({
            x: it.x + px, y: cy + py, z: it.z + pz,
            s: cs * (1 - edge * 0.12),
            ry: rng() * Math.PI * 2,
            color: col.setHex(cfg.color).multiplyScalar(shade).clone(),
          });
        }
      }
    }

    // —— 树干实例 ——
    for (const [kind, list] of trunkGroups) {
      const cfg = TREE_CFG[kind];
      // 3 个变体几何
      const variants = [];
      for (let v = 0; v < 3; v++) {
        const r = mulberry32(1000 + v * 37 + kind.length * 11);
        variants.push(trunkGeometry(r, 10, cfg.trunkR, 4));
      }
      const buckets = variants.map(() => []);
      list.forEach((o, i) => buckets[i % 3].push(o));
      variants.forEach((geo, vi) => {
        const arr = buckets[vi];
        if (!arr.length) return;
        const im = new THREE.InstancedMesh(geo, MAT.bark, arr.length);
        im.castShadow = true;
        im.receiveShadow = true;
        arr.forEach((o, i) => {
          const { it, H, gy, s } = o;
          dummy.position.set(it.x, gy, it.z);
          dummy.rotation.set(0, it.rotY || 0, 0);
          dummy.scale.set(s * 0.95, (H * 0.76) / 10, s * 0.95);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true;
        this.group.add(im);
      });
    }

    // —— 竹、柳：整株几何实例化（细长枝干，不适合叶簇） ——
    for (const kind of ['bamboo', 'willow']) {
      const list = items.filter((it) => it.kind === kind);
      if (!list.length) continue;
      const variants = [0, 1, 2].map((v) =>
        (kind === 'bamboo' ? bambooGeometry(mulberry32(500 + v * 13)) : willowGeometry(mulberry32(600 + v * 17))));
      const buckets = variants.map(() => []);
      list.forEach((o, i) => buckets[i % 3].push(o));
      variants.forEach((geo, vi) => {
        const arr = buckets[vi];
        if (!arr.length) return;
        const im = new THREE.InstancedMesh(geo, kind === 'bamboo' ? MAT.bambooLeaf : MAT.leaf, arr.length);
        im.castShadow = true;
        im.receiveShadow = true;
        arr.forEach((o, i) => {
          const gy = o.y ?? heightAt(o.x, o.z);
          dummy.position.set(o.x, gy, o.z);
          dummy.rotation.set(0, o.rotY || 0, 0);
          dummy.scale.setScalar(o.scale || 1);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true;
        this.group.add(im);
      });
    }

    // —— 叶簇实例 ——
    for (const [key, arr] of Object.entries(clusterSets)) {
      if (!arr.length) continue;
      const geo = crossQuadGeometry(1.0);
      const mat = foliageMaterial(key.startsWith('conifer') ? 'conifer' : 'broad');
      const im = new THREE.InstancedMesh(geo, mat, arr.length);
      // 远景叶簇不投影：山体上万个实例投影开销太大，且看不出来
      im.castShadow = !key.endsWith('Far');
      im.receiveShadow = !key.endsWith('Far');
      arr.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z);
        dummy.rotation.set(0, o.ry, 0);
        dummy.scale.setScalar(o.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        im.setColorAt(i, o.color);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
    }

    return this.group;
  }

  /** 灌木丛（合并为单一几何，避免大量 draw call） */
  addShrubs(items) {
    const rng = mulberry32(555);
    const all = [];
    for (const it of items) {
      const parts = [];
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const r = 0.32 + rng() * 0.34;
        const g = new THREE.IcosahedronGeometry(r, 1);
        const pos = g.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          const k = 0.7 + rng() * 0.6;
          pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k * 0.8, pos.getZ(v) * k);
        }
        g.computeVertexNormals();
        g.translate((rng() - 0.5) * 0.7, r * 0.7 + rng() * 0.2, (rng() - 0.5) * 0.7);
        parts.push(g);
      }
      let geo = merge(parts);
      const s2 = it.scale || 1;
      geo.scale(s2, s2, s2);
      geo.rotateY(rng() * 6.28);
      // 顶点色必须在局部坐标下计算，再整体平移
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const k = 0.85 + Math.min(1, Math.max(0, pos.getY(i)) / 1.1) * 0.6 + (rng() - 0.5) * 0.16;
        colors[i * 3] = 0.72 * k;
        colors[i * 3 + 1] = 0.98 * k;
        colors[i * 3 + 2] = 0.5 * k;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.translate(it.x, it.y || 0, it.z);
      all.push(geo);
    }
    const geo = merge(all);
    if (!geo) return;
    const m = new THREE.Mesh(geo, MAT.leaf);
    m.castShadow = false;
    m.receiveShadow = false;
    this.group.add(m);
  }

  /** 景石 / 假山 */
  addRocks(items) {
    const rng = mulberry32(7777);
    for (const it of items) {
      const g = new THREE.IcosahedronGeometry(it.size || 0.8, 1);
      const pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const k = 0.88 + rng() * 0.24;
        pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k * 0.78, pos.getZ(v) * k);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, MAT.stoneCarve);
      m.position.set(it.x, (it.y || 0) + (it.size || 0.8) * 0.35, it.z);
      m.rotation.set(rng() * 0.4, rng() * 6.28, rng() * 0.3);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  /**
   * 地表散落物：落叶、碎石、枯枝
   * @param {Array} trees 树的位置，落叶围绕树聚集
   * @param {Function} at 坐标转换（u,v → 世界）
   */
  addGroundLitter(trees, at) {
    const rng = mulberry32(9182);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    /* 落叶 */
    const leafGeo = new THREE.PlaneGeometry(0.12, 0.075);
    leafGeo.rotateX(-Math.PI / 2);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
      envMapIntensity: 0.4,
    });
    const N_LEAF = 2600;
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, N_LEAF);
    leafMesh.receiveShadow = true;
    const leafColors = [0x8a6a2e, 0x9c7a34, 0x7a5c28, 0xa8843c, 0x6b5424, 0x8f7434];
    for (let i = 0; i < N_LEAF; i++) {
      let x, z;
      if (i % 3 !== 0 && trees.length) {
        // 树下聚集
        const t = trees[Math.floor(rng() * trees.length)];
        const a = rng() * Math.PI * 2;
        const r = Math.pow(rng(), 0.6) * (3.5 + rng() * 3.5);
        x = t.x + Math.cos(a) * r;
        z = t.z + Math.sin(a) * r;
      } else {
        // 院内散落
        const p = at(-24 + rng() * 180, -46 + rng() * 82);
        x = p.x; z = p.z;
      }
      dummy.position.set(x, 0.022 + rng() * 0.008, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      const sc = 0.7 + rng() * 0.9;
      dummy.scale.set(sc, 1, sc * (0.7 + rng() * 0.5));
      dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix);
      leafMesh.setColorAt(i, col.setHex(leafColors[Math.floor(rng() * leafColors.length)])
        .multiplyScalar(0.8 + rng() * 0.4));
    }
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    this.group.add(leafMesh);

    /* 碎石 */
    const rockGeo = new THREE.IcosahedronGeometry(0.055, 0);
    const rockMat = MAT.graniteDark.clone();
    rockMat.vertexColors = false;
    const N_ROCK = 900;
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, N_ROCK);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    for (let i = 0; i < N_ROCK; i++) {
      const p = at(-26 + rng() * 184, -48 + rng() * 86);
      dummy.position.set(p.x, 0.02 + rng() * 0.02, p.z);
      dummy.rotation.set(rng() * 3, rng() * 6.28, rng() * 3);
      const sc = 0.5 + rng() * 1.4;
      dummy.scale.set(sc, sc * (0.5 + rng() * 0.5), sc);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      rockMesh.setColorAt(i, col.setHSL(0.1, 0.06, 0.42 + rng() * 0.2));
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    this.group.add(rockMesh);
  }

  /** 荷叶（水面） */
  addLotus(center, radius, count = 90) {
    const rng = mulberry32(88);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 0.28 + rng() * 0.28;
      const leaf = new THREE.CircleGeometry(s, 9);
      leaf.rotateX(-Math.PI / 2);
      // 缺口
      leaf.translate(x, 0.04 + rng() * 0.05, z);
      parts.push(leaf);
      if (rng() > 0.86) {
        const bud = new THREE.SphereGeometry(s * 0.22, 8, 6);
        bud.scale(1, 1.5, 1);
        bud.translate(x + s * 0.3, 0.16, z + s * 0.2);
        parts.push(bud);
      }
    }
    const geo = merge(parts);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = 0.7 + rng() * 0.4;
      colors[i * 3] = 0.5 * k;
      colors[i * 3 + 1] = 0.78 * k;
      colors[i * 3 + 2] = 0.42 * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, MAT.lotus);
    m.position.set(center.x, center.y || 0.05, center.z);
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
}
