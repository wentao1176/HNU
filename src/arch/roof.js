/**
 * 中国古建屋顶生成器
 * 支持：庑殿(hip)、歇山(xieshan)、悬山/硬山(gable)、攒尖(pyramid)、卷棚(roll)
 *
 * 核心算法：矩形「环」逐层内缩抬升，高度按举折曲线变化，
 * 四角施加起翘与出翘，从而自然生成戗脊、垂脊与翼角。
 */
import * as THREE from 'three';
import { MeshBuilder, box, cylinder, merge, place, lathe, smoothstep } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** 瓦面材质选择 */
function tileMatOf(tile) {
  if (tile === 'glazed') return MAT.glazed;
  if (tile === 'glazedYellow') return MAT.glazedYellow;
  return MAT.tile;
}
function ridgeMatOf(tile) {
  if (tile === 'glazed') return MAT.glazed;
  if (tile === 'glazedYellow') return MAT.glazedYellow;
  return MAT.tileDark;
}

/**
 * @param {object} o
 * @param {number} o.width   面阔（柱中距，不含出檐）
 * @param {number} o.depth   进深
 * @param {number} o.eaveY   檐口高度（相对本组原点）
 * @param {number} o.rise    脊高 - 檐高
 * @param {string} o.style   hip | xieshan | gable | pyramid | roll
 */
export function createRoof(o = {}) {
  const {
    width = 12,
    depth = 8,
    eaveY = 0,
    rise = 3.0,
    style = 'xieshan',
    overhangX = 1.0,
    overhangZ = 1.0,
    curve = 1.45,
    lift = 0.36,
    flare = 0.24,
    tile = 'grey',
    segPerSide = 12,
    ringCount = 12,
    detail = 'normal',   // normal | high
    shouShan = null,   // 歇山收山宽度
    ornament = true,
    ridgeScale = 1.25,
  } = o;

  const g = new THREE.Group();
  g.name = 'roof';

  const hi = detail === 'high';
  const segN = hi ? 20 : segPerSide;
  const ringN = hi ? 22 : ringCount;
  const hw0 = width / 2 + overhangX;
  const hd0 = depth / 2 + overhangZ;
  const w0 = hw0 * 2;
  const d0 = hd0 * 2;
  const ridgeY = eaveY + rise;

  // 收山
  const sw = shouShan != null ? shouShan : Math.min(depth * 0.3, 3.0);
  const t1 = style === 'xieshan' ? Math.min(0.95, sw / hd0) : 1;

  /* ── 环参数 ── */
  function ringSpec(t) {
    let hw, hd;
    if (style === 'pyramid') {
      hw = hw0 * (1 - t);
      hd = hd0 * (1 - t);
    } else if (style === 'gable') {
      hw = hw0;
      hd = hd0 * (1 - t);
    } else if (style === 'xieshan') {
      hd = hd0 * (1 - t);
      const ix = Math.min(hd0 * t, sw);
      hw = hw0 - ix;
    } else {
      // hip / roll
      hd = hd0 * (1 - t);
      hw = hw0 - hd0 * t;
    }
    const y = eaveY + rise * Math.pow(t, curve);
    return { hw: Math.max(hw, 0.001), hd: Math.max(hd, 0.001), y, t };
  }

  /* ── 翼角起翘权重 ── */
  const lambda = Math.min(w0, d0) * 0.34;
  function cornerWeight(hw, hd, x, z) {
    const dx = Math.max(0, hw - Math.abs(x));
    const dz = Math.max(0, hd - Math.abs(z));
    const dist = Math.hypot(dx, dz);
    return Math.exp(-dist / lambda);
  }

  /* ── 生成一个环 ── */
  function makeRing(spec) {
    const { hw, hd, y, t } = spec;
    const n = segN;
    const pts = [];
    const decay = Math.pow(1 - t, 2.0);
    const push = (x, z) => {
      const w = cornerWeight(hw, hd, x, z) * decay;
      let px = x, pz = z, py = y;
      if (w > 0.001) {
        const r = Math.hypot(x, z) || 1;
        px += (x / r) * flare * w;
        pz += (z / r) * flare * w;
        py += lift * w;
      }
      pts.push([px, py, pz]);
    };
    for (let i = 0; i < n; i++) push(-hw + (2 * hw) * (i / n), hd);
    for (let i = 0; i < n; i++) push(hw, hd - (2 * hd) * (i / n));
    for (let i = 0; i < n; i++) push(hw - (2 * hw) * (i / n), -hd);
    for (let i = 0; i < n; i++) push(-hw, -hd + (2 * hd) * (i / n));
    return pts;
  }

  /* ── 屋面 ── */
  const rings = [];
  const specs = [];
  for (let k = 0; k <= ringN; k++) {
    const t = Math.pow(k / ringN, 0.92);
    const spec = ringSpec(t);
    specs.push(spec);
    rings.push(makeRing(spec));
  }

  const mb = new MeshBuilder();
  const N = segN * 4;
  const cover = COVER.tile;
  const uvOf = (p) => {
    const slope = Math.hypot(hd0 - Math.abs(p[2]), p[1] - eaveY);
    return [p[0] / cover, slope / cover];
  };

  for (let k = 0; k < rings.length - 1; k++) {
    const outer = rings[k];
    const inner = rings[k + 1];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a = outer[i], b = outer[j], c = inner[j], d = inner[i];
      // 退化保护
      const degenerate = (Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[2] - b[2]) < 1e-4);
      if (degenerate) continue;
      mb.quad(a, b, c, d, uvOf(a), uvOf(b), uvOf(c), uvOf(d));
    }
  }
  const roofGeo = mb.build();

  const tileMat = tileMatOf(tile).clone();
  tileMat.side = THREE.DoubleSide;
  tileMat.shadowSide = THREE.FrontSide;
  const roofMesh = new THREE.Mesh(roofGeo, tileMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  g.add(roofMesh);

  /* ── 真实瓦垄（高精度档，一次性构建网格） ── */
  if (hi && !window.__NORIDGE) {
    const spacing = 0.36;
    const tileW = 0.14;
    const tileH = 0.05;
    const mbR = new MeshBuilder();
    const up = V(0, 1, 0);

    for (const side of [0, 2]) {
      const startIdx = side === 0 ? 0 : 2 * segN;
      const edgeLen = w0;
      const numRidges = Math.max(3, Math.round(edgeLen / spacing));
      for (let r = 0; r < numRidges; r++) {
        const f = (r + 0.5) / numRidges;
        const idx = startIdx + Math.min(segN - 1, Math.floor(f * segN));
        let vAcc = 0;
        for (let k = 0; k < rings.length - 1; k++) {
          const a = rings[k][idx];
          const b = rings[k + 1][idx];
          const dir = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          const len = dir.length();
          if (len < 0.02) continue;
          dir.normalize();
          // 横向（水平，垂直于坡向）
          const lat = new THREE.Vector3().crossVectors(dir, up).normalize();
          if (lat.lengthSq() < 0.01) continue;
          const nor = new THREE.Vector3().crossVectors(lat, dir).normalize();
          const hw = tileW / 2;
          const a0 = [
            a[0] - lat.x * hw, a[1] - lat.y * hw, a[2] - lat.z * hw,
          ];
          const a1 = [
            a[0] + lat.x * hw, a[1] + lat.y * hw, a[2] + lat.z * hw,
          ];
          const b0 = [
            b[0] - lat.x * hw, b[1] - lat.y * hw, b[2] - lat.z * hw,
          ];
          const b1 = [
            b[0] + lat.x * hw, b[1] + lat.y * hw, b[2] + lat.z * hw,
          ];
          const lift = (p) => [
            p[0] + nor.x * tileH, p[1] + nor.y * tileH, p[2] + nor.z * tileH,
          ];
          const A0 = lift(a0), A1 = lift(a1), B0 = lift(b0), B1 = lift(b1);
          const v0 = vAcc / COVER.tile;
          const v1 = (vAcc + len) / COVER.tile;
          // 顶面
          mbR.quad(A0, A1, B1, B0, [0, v0], [1, v0], [1, v1], [0, v1]);
          // 两侧
          mbR.quad(a0, A0, B0, b0, [0, v0], [1, v0], [1, v1], [0, v1]);
          mbR.quad(a1, A1, B1, b1, [0, v0], [1, v0], [1, v1], [0, v1]);
          vAcc += len;
        }
      }
    }
    const rg = mbR.build();
    if (rg) {
      const rm = new THREE.Mesh(rg, ridgeMatOf(tile));
      rm.castShadow = true;
      rm.receiveShadow = true;
      g.add(rm);
    }
  }

  // 望板：屋面内侧的木板，让檐下不露黑
  // 望板：压暗并收进屋面内，避免檐口露出一条亮边
  const soffitMat = MAT.woodPlank.clone();
  soffitMat.side = THREE.BackSide;
  soffitMat.color.setHex(0x3b2d1f);
  const soffit = new THREE.Mesh(roofGeo, soffitMat);
  soffit.scale.set(0.996, 0.996, 0.996);
  soffit.position.y = -0.035;
  soffit.receiveShadow = true;
  g.add(soffit);

  /* ── 檐口封边（瓦口） ── */
  const edgePts = rings[0];
  const edgeGeo = [];
  const eh = 0.2;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const a = edgePts[i], b = edgePts[j];
    const bm = new MeshBuilder();
    bm.quad(
      [a[0], a[1], a[2]], [b[0], b[1], b[2]],
      [b[0], b[1] - eh, b[2]], [a[0], a[1] - eh, a[2]],
      [0, 0], [1, 0], [1, 0.2], [0, 0.2],
    );
    edgeGeo.push(bm.build());
  }
  const eGeo = merge(edgeGeo);
  if (eGeo) {
    const eMesh = new THREE.Mesh(eGeo, ridgeMatOf(tile));
    eMesh.castShadow = true;
    eMesh.receiveShadow = true;
    g.add(eMesh);
  }

  /* ── 山花（歇山） ── */
  if (style === 'xieshan') {
    const sSpec = ringSpec(t1);
    const gx = sSpec.hw;
    const gz = sSpec.hd;
    const gy = sSpec.y;
    const buildGable = (side) => {
      const m = new MeshBuilder();
      // 采样 t1→1 的轮廓
      const prof = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const t = t1 + (1 - t1) * (s / steps);
        const sp = ringSpec(t);
        prof.push([sp.hd, sp.y]);
      }
      const X = gx * side;
      for (let s = 0; s < steps; s++) {
        const [z0, y0] = prof[s];
        const [z1, y1] = prof[s + 1];
        const a = [X, y0, z0], b = [X, y1, z1];
        const c = [X, y1, -z1], d = [X, y0, -z0];
        if (side > 0) m.quad(a, b, c, d, [z0 / 2, y0 / 2], [z1 / 2, y1 / 2], [-z1 / 2, y1 / 2], [-z0 / 2, y0 / 2]);
        else m.quad(d, c, b, a, [-z0 / 2, y0 / 2], [-z1 / 2, y1 / 2], [z1 / 2, y1 / 2], [z0 / 2, y0 / 2]);
      }
      return m.build();
    };
    const gGeo = merge([buildGable(1), buildGable(-1)]);
    if (gGeo) {
      const gm = new THREE.Mesh(gGeo, MAT.plaster);
      gm.castShadow = true;
      gm.receiveShadow = true;
      g.add(gm);
    }
    // 博风板（沿山花斜边）
    const bofeng = [];
    for (const side of [1, -1]) {
      for (let s = 0; s < 10; s++) {
        const tA = t1 + (1 - t1) * (s / 10);
        const tB = t1 + (1 - t1) * ((s + 1) / 10);
        const A = ringSpec(tA), B = ringSpec(tB);
        for (const zs of [1, -1]) {
          const p0 = V(gx * side, A.y + 0.06, A.hd * zs);
          const p1 = V(gx * side, B.y + 0.06, B.hd * zs);
          const len = p0.distanceTo(p1);
          const bg = box(0.1, 0.26, len, 1.2);
          const mid = p0.clone().add(p1).multiplyScalar(0.5);
          const dir = p1.clone().sub(p0).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir);
          bg.applyMatrix4(new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
          bofeng.push(bg);
        }
      }
    }
    const bfGeo = merge(bofeng);
    if (bfGeo) {
      const bf = new THREE.Mesh(bfGeo, MAT.woodBeam);
      bf.castShadow = true;
      g.add(bf);
    }
  }

  /* ── 脊：正脊 + 垂脊/戗脊 ── */
  const ridgeGeos = [];
  const ridgeMat = ridgeMatOf(tile);

  // 正脊
  const ridgeSpec = style === 'xieshan' ? ringSpec(t1) : ringSpec(0.999);
  const ridgeHalf = style === 'xieshan' ? ridgeSpec.hw : (style === 'gable' ? hw0 : Math.max(0.01, hw0 - hd0));
  const rH = 0.42 * ridgeScale;
  const rW = 0.36 * ridgeScale;
  if (style !== 'pyramid' && ridgeHalf > 0.2) {
    // 脊座（压在瓦面上的胎子）
    const seat = box(ridgeHalf * 2 + 0.26, rH * 0.26, rW * 1.5, 1.2);
    seat.translate(0, ridgeY + rH * 0.1, 0);
    ridgeGeos.push(seat);
    // 脊筒主体（略带收分）
    const rb = box(ridgeHalf * 2 + 0.2, rH * 0.62, rW, 1.2);
    rb.translate(0, ridgeY + rH * 0.5, 0);
    ridgeGeos.push(rb);
    // 上枭混
    const rb2 = box(ridgeHalf * 2 + 0.32, rH * 0.16, rW * 1.16, 1.2);
    rb2.translate(0, ridgeY + rH * 0.87, 0);
    ridgeGeos.push(rb2);
    // 瓦条（脊顶压条）
    const rb3 = box(ridgeHalf * 2 + 0.14, rH * 0.12, rW * 0.76, 1.2);
    rb3.translate(0, ridgeY + rH * 0.99, 0);
    ridgeGeos.push(rb3);
    // 脊头小翘（两端）
    for (const sx of [1, -1]) {
      const tip = box(0.24, rH * 0.9, rW * 0.9, 1.2);
      tip.translate(sx * (ridgeHalf + 0.02), ridgeY + rH * 0.62, 0);
      ridgeGeos.push(tip);
    }
  }

  // 四角脊线轨迹
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (const [sx, sz] of corners) {
    const path = [];
    for (let k = 0; k < rings.length; k++) {
      const sp = specs[k];
      const w = cornerWeight(sp.hw, sp.hd, sp.hw * sx, sp.hd * sz) * Math.pow(1 - sp.t, 2);
      const r = Math.hypot(sp.hw, sp.hd) || 1;
      const x = sp.hw * sx + (sp.hw * sx / r) * flare * w;
      const z = sp.hd * sz + (sp.hd * sz / r) * flare * w;
      const y = sp.y + lift * w;
      path.push(V(x, y, z));
    }
    // 沿路径放样脊筒
    for (let k = 0; k < path.length - 1; k++) {
      const p0 = path[k], p1 = path[k + 1];
      const len = p0.distanceTo(p1);
      if (len < 0.01) continue;
      const seg = box(0.3 * ridgeScale, 0.34 * ridgeScale, len + 0.04, 1.2);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      mid.y += 0.1 * ridgeScale;
      const dir = p1.clone().sub(p0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir);
      // 让脊筒的宽面朝外
      seg.applyMatrix4(new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
      ridgeGeos.push(seg);
    }
    // 翼角起翘的脊头
    const tip = path[0];
    const tipG = box(0.26 * ridgeScale, 0.5 * ridgeScale, 0.26 * ridgeScale, 1.2);
    tipG.translate(tip.x * 0.985, tip.y + 0.2 * ridgeScale, tip.z * 0.985);
    ridgeGeos.push(tipG);
  }

  const ridgeGeo = merge(ridgeGeos);
  if (ridgeGeo) {
    const rm = new THREE.Mesh(ridgeGeo, ridgeMat);
    rm.castShadow = true;
    rm.receiveShadow = true;
    g.add(rm);
  }

  /* ── 正脊两端鸱吻 ── */
  if (ornament && style !== 'pyramid' && style !== 'roll' && ridgeHalf > 0.4) {
    for (const sx of [1, -1]) {
      const ch = createChiwen(0.95 * ridgeScale);
      ch.position.set(sx * (ridgeHalf + 0.02), ridgeY + rH * 0.35, 0);
      ch.rotation.y = sx > 0 ? 0 : Math.PI;
      g.add(ch);
    }
  }

  /* ── 垂脊走兽（高精度档） ── */
  if (hi && ornament && ridgeHalf > 0.4) {
    const beastGeos = [];
    for (const [sx, sz] of corners) {
      const path = [];
      for (let k = 0; k < rings.length; k++) {
        const sp = specs[k];
        const w = cornerWeight(sp.hw, sp.hd, sp.hw * sx, sp.hd * sz) * Math.pow(1 - sp.t, 2);
        const r = Math.hypot(sp.hw, sp.hd) || 1;
        path.push(V(
          sp.hw * sx + (sp.hw * sx / r) * flare * w,
          sp.y + lift * w,
          sp.hd * sz + (sp.hd * sz / r) * flare * w,
        ));
      }
      // 沿戗脊布 5 只小兽，由檐向脊逐渐变小
      for (let b = 0; b < 5; b++) {
        const f = 0.10 + b * 0.075;
        const fi = f * (path.length - 1);
        const i0 = Math.floor(fi);
        const i1 = Math.min(path.length - 1, i0 + 1);
        const ft = fi - i0;
        const px = path[i0].x + (path[i1].x - path[i0].x) * ft;
        const py = path[i0].y + (path[i1].y - path[i0].y) * ft;
        const pz = path[i0].z + (path[i1].z - path[i0].z) * ft;
        const s2 = (0.2 - b * 0.022) * ridgeScale;
        // 兽身
        const body = box(s2 * 0.9, s2 * 1.5, s2 * 1.7, 1.2);
        body.translate(px, py + s2 * 1.0, pz);
        beastGeos.push(body);
        // 兽头
        const head = box(s2 * 0.7, s2 * 0.8, s2 * 0.7, 1.2);
        head.translate(px, py + s2 * 1.9, pz + s2 * 0.55);
        beastGeos.push(head);
      }
    }
    const bg = merge(beastGeos);
    if (bg) {
      const bm = new THREE.Mesh(bg, ridgeMatOf(tile));
      bm.castShadow = true;
      g.add(bm);
    }
  }

  /* ── 檐口瓦当 + 滴水 ── */
  if (ornament) {
    const dg = [];
    const step = 0.34;
    let acc = 0;
    for (let i = 0; i < N; i++) {
      const a = edgePts[i];
      const b = edgePts[(i + 1) % N];
      const segLen = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (segLen < 1e-4) continue;
      let d = step - acc;
      while (d < segLen) {
        const f = d / segLen;
        const x = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        const z = a[2] + (b[2] - a[2]) * f;
        const outX = x, outZ = z;
        const rl = Math.hypot(outX, outZ) || 1;
        const nx = outX / rl, nz = outZ / rl;
        // 瓦当：小圆盘
        const wd = cylinder(0.075, 0.075, 0.03, 8, 1);
        wd.rotateX(Math.PI / 2);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(nx, 0, nz));
        wd.applyMatrix4(new THREE.Matrix4().compose(
          V(x + nx * 0.02, y - 0.055, z + nz * 0.02), q, V(1, 1, 1),
        ));
        dg.push(wd);
        // 滴水：下垂小三角
        const tri = new MeshBuilder();
        tri.tri(
          [-0.07, 0, 0], [0.07, 0, 0], [0, -0.13, 0.02],
          [0, 0], [1, 0], [0.5, 1],
        );
        const tg = tri.build(false);
        tg.applyMatrix4(new THREE.Matrix4().compose(
          V(x + nx * 0.04, y - 0.16, z + nz * 0.04), q, V(1, 1, 1),
        ));
        dg.push(tg);
        d += step;
      }
      acc = (acc + segLen) % step;
    }
    const dGeo = merge(dg);
    if (dGeo) {
      const dm = new THREE.Mesh(dGeo, ridgeMat);
      dm.castShadow = false;
      dm.receiveShadow = true;
      g.add(dm);
    }
  }

  /* ── 椽头（檐下露明的椽子端头） ── */
  if (ornament) {
    const rg = [];
    const step = 0.42;
    for (let i = 0; i < N; i++) {
      const a = edgePts[i];
      const b = edgePts[(i + 1) % N];
      const segLen = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (segLen < 1e-4) continue;
      let d = step * 0.5;
      while (d < segLen) {
        const f = d / segLen;
        const x = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        const z = a[2] + (b[2] - a[2]) * f;
        const rl = Math.hypot(x, z) || 1;
        const nx = x / rl, nz = z / rl;
        const cb = box(0.07, 0.07, 0.86, 1.2);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(nx * 0.55, -0.83, nz * 0.55).normalize());
        cb.applyMatrix4(new THREE.Matrix4().compose(
          V(x - nx * 0.42, y - 0.32, z - nz * 0.42), q, V(1, 1, 1),
        ));
        rg.push(cb);
        d += step;
      }
    }
    const rGeo = merge(rg);
    if (rGeo) {
      const rm2 = new THREE.Mesh(rGeo, MAT.woodBeam);
      rm2.castShadow = true;
      rm2.receiveShadow = true;
      g.add(rm2);
    }
  }

  g.userData.ridgeY = ridgeY;
  g.userData.ridgeHalf = ridgeHalf;
  g.userData.eave = { hw: hw0, hd: hd0, y: eaveY };
  return g;
}

/* ─────────────────────────────────────────────
   鸱吻（正脊两端的鱼龙形脊饰）
   用侧影轮廓挤出，再做卷尾
   ───────────────────────────────────────────── */
export function createChiwen(scale = 1) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  // 侧影：底座宽，向上内收，尾部外卷
  s.moveTo(-0.34, 0);
  s.lineTo(0.34, 0);
  s.lineTo(0.30, 0.22);
  s.lineTo(0.20, 0.34);
  s.quadraticCurveTo(0.26, 0.52, 0.16, 0.66);
  s.quadraticCurveTo(0.05, 0.80, 0.20, 0.92);
  s.quadraticCurveTo(0.36, 1.02, 0.26, 1.14);
  s.quadraticCurveTo(0.16, 1.22, 0.06, 1.12);
  s.quadraticCurveTo(-0.02, 1.00, -0.06, 0.86);
  s.quadraticCurveTo(-0.14, 0.70, -0.18, 0.52);
  s.lineTo(-0.26, 0.30);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.16, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10,
  });
  geo.translate(0, 0, -0.08);
  const mesh = new THREE.Mesh(geo, MAT.tileDark);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  // 吻上的小剑把
  const sword = box(0.05, 0.34, 0.05, 1);
  sword.translate(0.0, 1.18, 0);
  const sm = new THREE.Mesh(sword, MAT.iron);
  sm.castShadow = true;
  g.add(sm);

  g.scale.setScalar(scale);
  return g;
}

/* ─────────────────────────────────────────────
   宝顶（攒尖顶用）
   ───────────────────────────────────────────── */
export function createBaoding(scale = 1) {
  const g = new THREE.Group();
  const pts = [
    [0.0, 0], [0.26, 0], [0.26, 0.1], [0.18, 0.16],
    [0.22, 0.26], [0.14, 0.36], [0.17, 0.44],
    [0.10, 0.56], [0.12, 0.64], [0.05, 0.78], [0.0, 0.86],
  ];
  const geo = lathe(pts, 20, 1);
  const m = new THREE.Mesh(geo, MAT.bronze);
  m.castShadow = true;
  g.add(m);
  g.scale.setScalar(scale);
  return g;
}
