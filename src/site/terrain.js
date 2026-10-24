/**
 * 地形：岳麓山东麓，书院坐落在山脚台地上
 * 坐标：x 东，z 南（与 OSM 一致，z = -纬度偏移）
 */
import * as THREE from 'three';
import { fbm, tileNoise, mulberry32, makeCanvas } from '../gfx/noise.js';
import { MAT } from '../gfx/materials.js';

/** 书院台地范围（局部 u/v 坐标，见 layout.js） */
export const TERRACE = { u0: -150, u1: 205, v0: -88, v1: 112 };

const AXIS = { x: -0.9835, z: -0.18 };
const RIGHT = { x: 0.18, z: -0.9835 };
const ORIGIN = { x: -60.8, z: 187.5 };

export function toUV(x, z) {
  const dx = x - ORIGIN.x;
  const dz = z - ORIGIN.z;
  return {
    u: dx * AXIS.x + dz * AXIS.z,
    v: dx * RIGHT.x + dz * RIGHT.z,
  };
}

export function fromUV(u, v) {
  return {
    x: ORIGIN.x + AXIS.x * u + RIGHT.x * v,
    z: ORIGIN.z + AXIS.z * u + RIGHT.z * v,
  };
}

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/**
 * 高度场
 * 书院台地为 0；西侧（u 大）抬升为岳麓山坡；东侧（u 小）缓缓下降至校园
 */
export function heightAt(x, z) {
  const { u, v } = toUV(x, z);

  // 台地掩膜（1 = 台地内）
  const inU = smoothstep(TERRACE.u0 - 16, TERRACE.u0 + 4, u) * (1 - smoothstep(TERRACE.u1 - 4, TERRACE.u1 + 22, u));
  const inV = smoothstep(TERRACE.v0 - 16, TERRACE.v0 + 4, v) * (1 - smoothstep(TERRACE.v1 - 4, TERRACE.v1 + 22, v));
  const terrace = inU * inV;

  // 岳麓山体：越往西越高（近坡放缓——清风峡口仍在山脚）
  const west = smoothstep(220, 560, u);
  const ridge = fbm(x * 0.0016 + 0.5, z * 0.0016 + 0.5, 4, 5, 71);
  const ridge2 = fbm(x * 0.005, z * 0.005, 6, 4, 133);
  let mountain = west * (78 + ridge * 138 + ridge2 * 30);
  // 后山近处的坡
  mountain += smoothstep(230, 400, u) * 22 * (0.6 + ridge2 * 0.8);

  // 南北两侧的低丘
  const north = smoothstep(120, 420, Math.abs(v)) * 26 * (0.5 + ridge * 0.7);

  // 东侧缓降（校园方向）
  const east = smoothstep(20, 300, -u) * 9;

  // 细部起伏
  const detail = (fbm(x * 0.02, z * 0.02, 8, 3, 9) - 0.5) * 0.5;

  let h = mountain + north - east + detail * (1 - terrace);
  h = h * (1 - terrace) + 0 * terrace;

  // 清风峡口爱晚亭小台地（实测亭位 u≈267, v≈-17）
  const awU = smoothstep(246, 260, u) * (1 - smoothstep(276, 292, u));
  const awV = smoothstep(-34, -26, v) * (1 - smoothstep(-2, 8, v));
  const aiwanT = awU * awV;
  h = h * (1 - aiwanT) + 13 * aiwanT;

  // 台地外沿略微下沉，形成挡土墙基
  h -= (1 - terrace) * 0.6 * (1 - aiwanT);
  return h;
}

/** 生成地形网格 */
export function createTerrain() {
  const size = 1700;
  const seg = 320;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rnd = mulberry32(1234);
  const cGrass = new THREE.Color(0x6f7f52);
  const cGrassDry = new THREE.Color(0x8e8a5e);
  const cForest = new THREE.Color(0x4a6340);
  const cRock = new THREE.Color(0x7d786c);
  const cEarth = new THREE.Color(0x8a7a5c);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);

    const { u } = toUV(x, z);
    const alt = Math.max(0, y);
    const n = fbm(x * 0.03, z * 0.03, 6, 3, 55);
    const macro = fbm(x * 0.0045, z * 0.0045, 4, 3, 21);

    // 坡度：用邻域高差近似（陡坡露岩）
    const dx = heightAt(x + 2.5, z) - y;
    const dz = heightAt(x, z + 2.5) - y;
    const slope = Math.hypot(dx, dz) / 2.5;

    // 低处草地，高处森林，陡坡露岩
    tmp.copy(cGrass).lerp(cGrassDry, n * 0.55 + macro * 0.25);
    // 大尺度斑驳：林下阴翳与草甸交替
    tmp.multiplyScalar(0.82 + macro * 0.36);
    if (alt > 3) tmp.lerp(cForest, Math.min(1, (alt - 3) / 16));
    // 陡坡（>0.5 的坡度）逐渐露岩
    const rockK = Math.min(0.85, Math.max(0, (slope - 0.42) / 0.55));
    if (rockK > 0) tmp.lerp(cRock, rockK * (0.55 + n * 0.4));
    if (alt > 70) tmp.lerp(cRock, Math.min(0.4, (alt - 70) / 140));
    if (u < -20 && alt < 3) tmp.lerp(cEarth, 0.25 * (1 - Math.abs(u + 60) / 200));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / 26, pos.getZ(i) / 26);
  }

  const mat = MAT.grass.clone();
  mat.vertexColors = true;
  mat.color.setHex(0xffffff);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain';
  return mesh;
}

/**
 * 石板路网：中轴御道 + 各院支路 + 文庙前庭
 * 全部按 u/v 局部坐标定义，宽度单位米
 */
function addStrip(g, u0, v0, u1, v1, width, y = 0.016) {
  const a = fromUV(u0, v0);
  const b = fromUV(u1, v1);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 0.3) return;
  const geo = new THREE.PlaneGeometry(len, width, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * len) / 2.4, (uv.getY(i) * width) / 2.4);
  }
  const m = new THREE.Mesh(geo, MAT.paving);
  m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
  m.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
  m.receiveShadow = true;
  g.add(m);
}

/** 矩形铺地（广场） */
function addPlaza(g, u0, v0, u1, v1, y = 0.008) {
  const du = u1 - u0;
  const dv = v1 - v0;
  const geo = new THREE.PlaneGeometry(du, dv, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * du) / 2.4, (uv.getY(i) * dv) / 2.4);
  }
  const c = fromUV((u0 + u1) / 2, (v0 + v1) / 2);
  const m = new THREE.Mesh(geo, MAT.paving);
  m.position.set(c.x, y, c.z);
  m.rotation.y = Math.atan2(-AXIS.x, -AXIS.z);
  m.receiveShadow = true;
  g.add(m);
}

export function createTerracePaving() {
  const g = new THREE.Group();

  /* 中轴御道：东门外 → 大门 → 赫曦台 → 二门 → 讲堂 → 御书楼 → 西门 */
  addStrip(g, -88, 0, -60, 0, 5.2);
  addStrip(g, -60, 0, -38, 0, 7.0);
  addStrip(g, -38, 0, 160, 0, 6.4);
  addStrip(g, 160, 0, 215, 0, 2.6);   // 出西门，转后山石径

  /* 大门前庭 */
  addPlaza(g, -38, -13, -22, 13);
  /* 赫曦台院 */
  addPlaza(g, -12, -11, 8, 11);
  /* 二门内院（讲堂前庭） */
  addPlaza(g, 20, -14, 52, 14);
  /* 御书楼前庭 */
  addPlaza(g, 126, -12, 152, 12);

  /* 讲堂两厢支路 */
  addStrip(g, 20, -14, 20, -36, 3.2);
  addStrip(g, 20, 14, 20, 36, 3.2);
  addStrip(g, 44, -14, 44, -36, 3.0);
  addStrip(g, 44, 14, 44, 36, 3.0);
  /* 斋舍门前横路 */
  addStrip(g, 20, -24, 60, -24, 2.6);
  addStrip(g, 20, 24, 60, 24, 2.6);

  /* 百泉轩、竹林小径 */
  addStrip(g, 104, 0, 104, 20, 2.4);
  addStrip(g, 104, 20, 126, 26, 2.0);

  /* 文庙：照壁 → 大成门 → 大成殿 → 崇圣祠 */
  addStrip(g, 60, 52, 96, 52, 5.0);
  addPlaza(g, 70, 42, 98, 62);
  addStrip(g, 84, 62, 84, 86, 3.6);
  addStrip(g, 84, 52, 84, 42, 4.0);
  /* 文庙东西庑前廊路 */
  addStrip(g, 70, 40, 70, 74, 2.4);
  addStrip(g, 98, 40, 98, 74, 2.4);
  /* 中轴 → 文庙 的连接 */
  addStrip(g, 60, 0, 60, 52, 3.4);

  /* 南北角门小路 */
  addStrip(g, 40, -14, 40, -50, 2.4);
  addStrip(g, 36, 14, 36, 40, 2.4);
  addStrip(g, 36, 40, 36, 74, 2.2);

  return g;
}
