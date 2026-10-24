/**
 * 室内陈设库
 * 讲台、供桌、书架、书案、床榻、牌位、碑刻、屏风、灯具
 * 全部为程序化几何，按材质合并以控制 draw call。
 */
import * as THREE from 'three';
import { box, cylinder, merge, place, lathe, MeshBuilder } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';
import { verticalTextTexture, bookLabelTexture, plaqueTexture, coupletTexture, createCouplet } from '../gfx/text.js';

/* ── 室内材质：略微自发光，弥补室内进光不足 ── */
const _cache = new Map();
function indoor(base, emissive = 0x1a1408, ei = 0.22) {
  const key = base.uuid + ':' + ei;
  if (_cache.has(key)) return _cache.get(key);
  const m = base.clone();
  m.emissive = new THREE.Color(emissive);
  m.emissiveIntensity = ei;
  m.emissiveMap = base.map;
  _cache.set(key, m);
  return m;
}

const M = {
  get wood() { return indoor(MAT.woodBeam, 0x1c1409, 0.26); },
  get dark() { return indoor(MAT.blackLacquer, 0x120e08, 0.3); },
  get red() { return indoor(MAT.woodLacquer, 0x220c06, 0.24); },
  get paper() { return indoor(MAT.paper, 0x2a2318, 0.3); },
  get stone() { return indoor(MAT.marble, 0x1a1814, 0.2); },
  get bronze() { return indoor(MAT.bronze, 0x181206, 0.3); },
  get cloth() {
    if (!_cache.has('cloth')) {
      _cache.set('cloth', new THREE.MeshStandardMaterial({
        color: 0x5a2020, roughness: 0.92, metalness: 0,
        emissive: 0x180806, emissiveIntensity: 0.22,
      }));
    }
    return _cache.get('cloth');
  },
  get gold() { return indoor(MAT.gold, 0x2a1e08, 0.35); },
};

/* ── 批处理 ── */
class RB {
  constructor() { this.map = new Map(); }
  add(geo, mat) {
    if (!geo) return;
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(geo);
  }
  flush(parent) {
    for (const [mat, geos] of this.map) {
      const g = merge(geos);
      if (!g) continue;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
    }
    this.map.clear();
  }
}

/* ─────────────────────────────────────────────
   基础家具
   ───────────────────────────────────────────── */

/** 桌案（带牙板） */
export function table(w = 1.8, d = 0.7, h = 0.82, mat = M.wood) {
  const g = [];
  const top = box(w, 0.06, d, COVER.woodBeam);
  top.translate(0, h - 0.03, 0);
  g.push(top);
  const apron = box(w - 0.12, 0.12, 0.04, COVER.woodBeam);
  apron.translate(0, h - 0.12, d / 2 - 0.03);
  g.push(apron);
  const apron2 = apron.clone();
  apron2.translate(0, 0, -(d - 0.06));
  g.push(apron2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = box(0.07, h - 0.06, 0.07, COVER.woodBeam);
      leg.translate(sx * (w / 2 - 0.07), (h - 0.06) / 2, sz * (d / 2 - 0.07));
      g.push(leg);
    }
  }
  return { geo: merge(g), mat };
}

/** 靠背椅 */
export function chair(mat = M.wood) {
  const g = [];
  const seat = box(0.46, 0.05, 0.44, COVER.woodBeam);
  seat.translate(0, 0.45, 0);
  g.push(seat);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = box(0.05, 0.45, 0.05, COVER.woodBeam);
      leg.translate(sx * 0.19, 0.225, sz * 0.18);
      g.push(leg);
    }
  }
  // 靠背
  for (const sx of [-1, 1]) {
    const post = box(0.05, 0.56, 0.05, COVER.woodBeam);
    post.translate(sx * 0.19, 0.73, -0.19);
    g.push(post);
  }
  const back = box(0.42, 0.1, 0.03, COVER.woodBeam);
  back.translate(0, 0.94, -0.19);
  g.push(back);
  const back2 = box(0.42, 0.06, 0.03, COVER.woodBeam);
  back2.translate(0, 0.7, -0.19);
  g.push(back2);
  return { geo: merge(g), mat };
}

/** 书架（格架） */
export function shelf(w = 2.0, h = 2.3, d = 0.45, levels = 5, mat = M.wood) {
  const g = [];
  for (const sx of [-1, 1]) {
    const side = box(0.05, h, d, COVER.woodBeam);
    side.translate(sx * (w / 2 - 0.025), h / 2, 0);
    g.push(side);
  }
  const backP = box(w, h, 0.03, COVER.woodBeam);
  backP.translate(0, h / 2, -d / 2 + 0.015);
  g.push(backP);
  for (let i = 0; i <= levels; i++) {
    const y = 0.08 + (h - 0.12) * (i / levels);
    const b = box(w - 0.06, 0.04, d - 0.03, COVER.woodBeam);
    b.translate(0, y, 0.01);
    g.push(b);
  }
  // 竖棂（每层分隔）
  for (let i = 0; i < levels; i++) {
    const y = 0.08 + (h - 0.12) * (i / levels);
    for (let k = 1; k < 3; k++) {
      const x = -w / 2 + (w / 3) * k;
      const v = box(0.035, (h - 0.12) / levels - 0.06, d - 0.06, COVER.woodBeam);
      v.translate(x, y + (h - 0.12) / levels / 2, 0);
      g.push(v);
    }
  }
  return { geo: merge(g), mat };
}

/** 一摞线装书 */
export function bookStack(n = 5, w = 0.24, d = 0.17, mat = M.paper) {
  const g = [];
  for (let i = 0; i < n; i++) {
    const b = box(w, 0.032, d, 1);
    b.translate((Math.random() - 0.5) * 0.02, 0.016 + i * 0.034, (Math.random() - 0.5) * 0.02);
    g.push(b);
  }
  return { geo: merge(g), mat };
}

/** 立着的书函（带书根题名） */
export function bookVolumes(count = 8, height = 0.28, mat = M.paper) {
  const g = [];
  for (let i = 0; i < count; i++) {
    const b = box(0.035, height, 0.19, 1);
    b.translate(i * 0.042, height / 2, 0);
    g.push(b);
  }
  return { geo: merge(g), mat };
}

/** 供桌（带围裙与束腰） */
export function altar(w = 2.4, d = 0.9, h = 0.95, mat = M.red) {
  const g = [];
  const top = box(w, 0.1, d, COVER.woodLacquer);
  top.translate(0, h - 0.05, 0);
  g.push(top);
  const waist = box(w - 0.2, 0.22, d - 0.18, COVER.woodLacquer);
  waist.translate(0, h - 0.21, 0);
  g.push(waist);
  const skirt = box(w - 0.1, 0.28, 0.05, COVER.woodLacquer);
  skirt.translate(0, h - 0.44, d / 2 - 0.04);
  g.push(skirt);
  for (const sx of [-1, 1]) {
    const leg = box(0.11, h - 0.55, 0.11, COVER.woodLacquer);
    leg.translate(sx * (w / 2 - 0.09), (h - 0.55) / 2, 0);
    g.push(leg);
  }
  return { geo: merge(g), mat };
}

/** 孔子塑像（高约 2.3m，据载殿内孔子像高 2.3 米） */
export function confuciusStatue(scale = 1) {
  const g = new THREE.Group();
  const parts = [];
  const robe = [];
  // 须弥座
  robe.push(place(box(1.05, 0.1, 0.8, COVER.marble), { y: 0.05 }));
  robe.push(place(box(0.95, 0.08, 0.72, COVER.marble), { y: 0.14 }));
  robe.push(place(box(0.88, 0.12, 0.66, COVER.marble), { y: 0.24 }));
  const baseMesh = new THREE.Mesh(merge(robe), M.stone);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  g.add(baseMesh);

  // 袍身（下宽上收，垂足而坐）
  const body = lathe([
    [0, 0.30], [0.44, 0.30], [0.46, 0.52], [0.42, 0.78],
    [0.34, 1.06], [0.26, 1.30], [0.20, 1.46], [0.17, 1.54], [0, 1.54],
  ], 20, 1);
  const bodyMesh = new THREE.Mesh(body, M.red);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  g.add(bodyMesh);

  // 胸前交领
  const collar = box(0.34, 0.1, 0.2, 1);
  collar.rotateY(Math.PI / 4);
  collar.translate(0, 1.42, 0.12);
  g.add(new THREE.Mesh(collar, M.gold));

  // 双臂（拱手）
  for (const sx of [-1, 1]) {
    const arm = cylinder(0.075, 0.09, 0.5, 10, 1);
    arm.rotateZ(sx * 0.5);
    arm.rotateX(-0.35);
    arm.translate(sx * 0.26, 1.18, 0.18);
    g.add(new THREE.Mesh(arm, M.red));
  }
  // 手（合于胸前）
  const hands = new THREE.SphereGeometry(0.085, 10, 8);
  hands.scale(1.3, 0.8, 0.9);
  hands.translate(0, 1.16, 0.34);
  g.add(new THREE.Mesh(hands, M.stone));

  // 头
  const head = new THREE.SphereGeometry(0.155, 16, 14);
  head.scale(0.94, 1.08, 0.96);
  head.translate(0, 1.72, 0.02);
  g.add(new THREE.Mesh(head, M.stone));
  // 须
  const beard = new THREE.SphereGeometry(0.11, 12, 10);
  beard.scale(0.8, 1.5, 0.6);
  beard.translate(0, 1.6, 0.12);
  g.add(new THREE.Mesh(beard, M.stone));

  // 冕冠
  const crown = box(0.36, 0.06, 0.24, 1);
  crown.translate(0, 1.90, 0.0);
  g.add(new THREE.Mesh(crown, M.dark));
  const crownTop = box(0.3, 0.04, 0.2, 1);
  crownTop.translate(0, 1.95, 0.0);
  g.add(new THREE.Mesh(crownTop, M.dark));
  // 旒（前后垂珠）
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const bead = new THREE.SphereGeometry(0.014, 6, 5);
      bead.translate(-0.09 + i * 0.06, 1.86, sz * 0.13);
      g.add(new THREE.Mesh(bead, M.gold));
    }
  }

  g.scale.setScalar(scale);
  return g;
}

/** 牌位（木座 + 竖排文字） */
export function tablet(text, { w = 0.22, h = 0.46, color = '#c9a35c', bg = '#1a0f08' } = {}) {
  const group = new THREE.Group();
  const g = [];
  const base = box(w * 1.6, 0.06, w * 0.8, COVER.woodBeam);
  base.translate(0, 0.03, 0);
  g.push(base);
  const slot = box(w * 1.2, 0.05, w * 0.5, COVER.woodBeam);
  slot.translate(0, 0.08, 0);
  g.push(slot);
  const body = box(w, h, 0.035, COVER.woodBeam);
  body.translate(0, 0.1 + h / 2, 0);
  g.push(body);
  const m = new THREE.Mesh(merge(g), M.wood);
  m.castShadow = true;
  group.add(m);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.82, h * 0.9),
    new THREE.MeshStandardMaterial({
      map: verticalTextTexture(text, { w: 128, h: 512, bg, fg: color, fontSize: 0.78 }),
      roughness: 0.6, metalness: 0.1, envMapIntensity: 0.25,
      emissive: new THREE.Color(0x120c06), emissiveIntensity: 0.35,
    }),
  );
  face.position.set(0, 0.1 + h / 2, 0.019);
  group.add(face);
  return group;
}

/** 屏风（多扇折叠） */
export function screen(panels = 4, w = 0.62, h = 2.3, mat = M.wood) {
  const g = [];
  const gap = 0.045;
  for (let i = 0; i < panels; i++) {
    const cx = (i - (panels - 1) / 2) * (w + gap);
    // 门板（略薄，留出框）
    const p = box(w - 0.03, h - 0.1, 0.045, COVER.woodBeam);
    p.translate(cx, h / 2, 0);
    g.push(p);
    // 四边框
    const fr = box(w, 0.07, 0.07, COVER.woodBeam);
    fr.translate(cx, h - 0.035, 0);
    g.push(fr);
    const fb = box(w, 0.09, 0.07, COVER.woodBeam);
    fb.translate(cx, 0.045, 0);
    g.push(fb);
    for (const sx of [-1, 1]) {
      const fs = box(0.055, h, 0.07, COVER.woodBeam);
      fs.translate(cx + sx * (w / 2 - 0.027), h / 2, 0);
      g.push(fs);
    }
  }
  return { geo: merge(g), mat };
}

/** 嵌墙壁碑（含碑文） */
export function wallStele(text, { w = 1.1, h = 1.9, title = '' } = {}) {
  const group = new THREE.Group();
  const frame = box(w + 0.16, h + 0.16, 0.1, COVER.granite);
  frame.translate(0, 0, -0.05);
  const fm = new THREE.Mesh(frame, indoor(MAT.graniteDark, 0x14120e, 0.2));
  fm.receiveShadow = true;
  group.add(fm);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: verticalTextTexture(text, { w: 256, h: 512, bg: '#5e5a52', fg: '#d9d2c0', fontSize: 0.72 }),
      roughness: 0.9, metalness: 0,
      emissive: new THREE.Color(0x1a1814), emissiveIntensity: 0.25,
    }),
  );
  face.position.z = 0.012;
  group.add(face);
  return group;
}

/** 烛台 */
export function candle(height = 0.42) {
  const g = [];
  const base = lathe([[0, 0], [0.075, 0], [0.06, 0.03], [0.03, 0.06], [0.028, 0.1], [0.05, 0.14], [0.03, 0.2], [0, 0.21]], 12, 1);
  g.push(base);
  const stick = cylinder(0.012, 0.016, height - 0.2, 8, 1);
  stick.translate(0, (height - 0.2) / 2 + 0.2, 0);
  g.push(stick);
  const cup = cylinder(0.05, 0.04, 0.05, 10, 1);
  cup.translate(0, height, 0);
  g.push(cup);
  const wax = cylinder(0.022, 0.022, 0.14, 8, 1);
  wax.translate(0, height + 0.09, 0);
  g.push(wax);
  return { geo: merge(g), mat: M.bronze, flameY: height + 0.17 };
}

/** 油灯 / 长明灯 */
export function oilLamp() {
  const g = [];
  const base = lathe([[0, 0], [0.1, 0], [0.09, 0.05], [0.05, 0.1], [0.045, 0.22], [0.12, 0.26], [0.13, 0.3], [0, 0.3]], 14, 1);
  g.push(base);
  return { geo: merge(g), mat: M.bronze, flameY: 0.34 };
}

/** 香炉（室内小件） */
export function smallCenser() {
  const g = [];
  const body = lathe([[0, 0], [0.11, 0.01], [0.15, 0.07], [0.16, 0.16], [0.14, 0.22], [0, 0.23]], 14, 1);
  g.push(body);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cylinder(0.022, 0.03, 0.1, 6, 1);
    leg.translate(Math.cos(a) * 0.1, -0.05, Math.sin(a) * 0.1);
    g.push(leg);
  }
  for (const sx of [-1, 1]) {
    const ear = new THREE.TorusGeometry(0.04, 0.01, 5, 10, Math.PI);
    ear.rotateY(Math.PI / 2);
    ear.translate(sx * 0.15, 0.2, 0);
    g.push(ear);
  }
  return { geo: merge(g), mat: M.bronze };
}

/** 床榻 */
export function bed(w = 1.1, l = 2.0, h = 0.5, mat = M.wood) {
  const g = [];
  const frame = box(w, 0.16, l, COVER.woodBeam);
  frame.translate(0, h - 0.08, 0);
  g.push(frame);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = box(0.1, h - 0.16, 0.1, COVER.woodBeam);
      leg.translate(sx * (w / 2 - 0.08), (h - 0.16) / 2, sz * (l / 2 - 0.08));
      g.push(leg);
    }
  }
  // 靠背（罗汉床式）
  for (const sz of [-1, 1]) {
    const back = box(w, 0.5, 0.06, COVER.woodBeam);
    back.translate(0, h + 0.2, sz * (l / 2 - 0.05));
    g.push(back);
  }
  return { geo: merge(g), mat };
}

/** 被褥 */
export function bedding(w = 1.0, l = 1.6, mat = M.cloth) {
  const g = [];
  const quilt = box(w, 0.12, l, 1);
  quilt.translate(0, 0.56, 0.1);
  g.push(quilt);
  const pillow = box(w * 0.6, 0.1, 0.3, 1);
  pillow.translate(0, 0.62, -l / 2 + 0.28);
  g.push(pillow);
  return { geo: merge(g), mat };
}

/** 书案（含笔墨纸砚） */
export function deskSet() {
  const g = [];
  const ink = box(0.14, 0.025, 0.09, 1);
  ink.translate(0.3, 0.83, 0.12);
  g.push(ink);
  const brush = cylinder(0.008, 0.006, 0.22, 6, 1);
  brush.rotateZ(Math.PI / 2);
  brush.translate(0.12, 0.84, 0.1);
  g.push(brush);
  const rest = box(0.16, 0.03, 0.05, 1);
  rest.translate(0.12, 0.82, 0.04);
  g.push(rest);
  const paper = box(0.3, 0.004, 0.4, 1);
  paper.translate(-0.2, 0.82, 0.05);
  g.push(paper);
  const book = box(0.24, 0.05, 0.17, 1);
  book.translate(-0.42, 0.84, -0.1);
  g.push(book);
  return { geo: merge(g), mat: M.paper };
}

/* ─────────────────────────────────────────────
   房间装配
   ───────────────────────────────────────────── */

/** 讲堂：讲台、屏门、朱子碑、供桌、坐席 */
export function roomLecture({ width = 18, depth = 11, height = 4.6, plaques = {} } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;

  // 讲台（后部高台，据载「正中一米高的长方形讲台」）
  const stageH = 1.0;
  const stageD = 3.8;
  const stageW = Math.min(width - 1.2, 12);
  const stage = box(stageW, stageH, stageD, COVER.woodPlank);
  stage.translate(0, stageH / 2, -halfD + stageD / 2 + 0.3);
  rb.add(stage, M.wood);
  // 台沿
  const edge = box(stageW + 0.1, 0.08, 0.12, COVER.woodBeam);
  edge.translate(0, stageH - 0.04, -halfD + stageD + 0.3);
  rb.add(edge, M.dark);

  // 屏门（讲台后壁，六扇）
  const screenH = Math.min(2.5, height - 1.6);
  const sp = screen(6, 0.78, screenH);
  const spMesh = new THREE.Mesh(sp.geo, sp.mat);
  spMesh.position.set(0, stageH, -halfD + 0.22);
  spMesh.castShadow = true;
  g.add(spMesh);

  // 台上两把椅子：纪念朱熹、张栻会讲
  for (const sx of [-1, 1]) {
    const ch = chair(M.red);
    const cm = new THREE.Mesh(ch.geo, ch.mat);
    cm.position.set(sx * 0.72, stageH, -halfD + 2.0);
    cm.rotation.y = Math.PI;
    cm.castShadow = true;
    g.add(cm);
    // 椅间小几
    if (sx > 0) continue;
    const t = table(0.5, 0.42, 0.7, M.wood);
    const tm = new THREE.Mesh(t.geo, t.mat);
    tm.position.set(0, stageH, -halfD + 2.0);
    tm.castShadow = true;
    g.add(tm);
  }

  // 两侧碑：忠孝廉节 / 整齐严肃
  // 「忠孝廉节」四字碑，每字一碑，分嵌讲堂左右两侧
  const fourChars = [
    { ch: '忠', sx: -1, z: -1.6 }, { ch: '孝', sx: -1, z: 1.6 },
    { ch: '廉', sx: 1, z: -1.6 }, { ch: '节', sx: 1, z: 1.6 },
  ];
  for (const f of fourChars) {
    const st = wallStele(f.ch, { w: 1.05, h: 2.1, cols: 1 });
    st.position.set(f.sx * (width / 2 - 0.46), 2.35, f.z);
    st.rotation.y = f.sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(st);
  }
  // 「整齐严肃」碑（朱熹手书，嵌后壁两隅）
  for (const sx of [-1, 1]) {
    const st = wallStele(sx < 0 ? '整齐' : '严肃', { w: 0.85, h: 1.6 });
    st.position.set(sx * 3.4, 1.95, -halfD + 0.5);
    g.add(st);
  }

  // 后墙横匾：道南正脉（乾隆御赐）
  const makePlaque = (text, w2, h2, y, bg, fg) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(w2, h2),
      new THREE.MeshStandardMaterial({
        map: plaqueTexture(text, { w: 1024, h: 340, bg, fg }),
        roughness: 0.55, metalness: 0.06,
        emissive: new THREE.Color(0x1a1408), emissiveIntensity: 0.5,
      }),
    );
    p.position.set(0, y, -halfD + 0.56);
    g.add(p);
    // 匾框
    const fr = box(w2 + 0.16, h2 + 0.16, 0.1, COVER.woodBeam);
    fr.translate(0, y, -halfD + 0.5);
    const fm = new THREE.Mesh(fr, M.dark);
    g.add(fm);
  };
  makePlaque('道南正脉', 2.6, 0.84, Math.min(height - 0.75, 4.0), '#12303a', '#d8bc78');
  // 「学达性天」康熙三十五年御赐，悬于道南正脉之前
  const xd = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.82),
    new THREE.MeshStandardMaterial({
      map: plaqueTexture('学达性天', { w: 1024, h: 340, bg: '#12303a', fg: '#d8bc78' }),
      roughness: 0.55, metalness: 0.06,
      emissive: new THREE.Color(0x1a1408), emissiveIntensity: 0.5,
    }),
  );
  xd.position.set(0, Math.min(height - 0.95, 3.95), -halfD + 1.9);
  xd.rotation.y = Math.PI;
  g.add(xd);

  // 坐席（两列蒲团）
  for (let i = 0; i < 6; i++) {
    for (const sx of [-1, 1]) {
      const cushion = cylinder(0.32, 0.34, 0.1, 12, 1);
      cushion.translate(sx * (1.1 + (i % 3) * 1.25), 0.05, -1.4 + Math.floor(i / 3) * 1.7 + 1.0);
      rb.add(cushion, M.cloth);
    }
  }

  // 香炉（台前）
  const c = smallCenser();
  const cMesh = new THREE.Mesh(c.geo, c.mat);
  cMesh.position.set(0, 0.3, -halfD + stageD + 0.9);
  cMesh.castShadow = true;
  g.add(cMesh);

  // 长明灯（两盏）
  for (const sx of [-1, 1]) {
    const l = oilLamp();
    const lm = new THREE.Mesh(l.geo, l.mat);
    lm.position.set(sx * (stageW / 2 - 0.4), stageH, -halfD + 0.8);
    g.add(lm);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffb45a, emissive: 0xff9a3a, emissiveIntensity: 2.2 }),
    );
    flame.position.set(sx * (stageW / 2 - 0.4), stageH + l.flameY, -halfD + 0.8);
    g.add(flame);
  }

  rb.flush(g);
  return g;
}

/** 御书楼一层：书架、书函、书案 */
export function roomLibrary({ width = 16, depth = 10, height = 3.6 } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;
  const halfW = width / 2;

  // 靠墙书架（后墙 + 两侧）
  const shelfH = Math.min(2.5, height - 0.6);
  for (let i = 0; i < 4; i++) {
    const w = (width - 2.4) / 4 - 0.12;
    const s = shelf(w, shelfH, 0.42, 5);
    const m = new THREE.Mesh(s.geo, s.mat);
    m.position.set(-width / 2 + 1.2 + (w + 0.12) * (i + 0.5), 0, -halfD + 0.24);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);

    // 书函
    for (let lv = 0; lv < 5; lv++) {
      const y = 0.08 + (shelfH - 0.12) * (lv / 5) + 0.03;
      for (let k = 0; k < 3; k++) {
        const bv = bookVolumes(5 + Math.floor(Math.random() * 4), 0.26);
        const bm = new THREE.Mesh(bv.geo, bv.mat);
        bm.position.set(-width / 2 + 1.2 + (w + 0.12) * (i + 0.5) - w / 2 + 0.14 + k * (w / 3), y, -halfD + 0.26);
        g.add(bm);
      }
    }
  }

  // 两侧矮架
  for (const sx of [-1, 1]) {
    const s = shelf(depth - 2.6, 1.5, 0.4, 3);
    const m = new THREE.Mesh(s.geo, s.mat);
    m.position.set(sx * (halfW - 0.3), 0, 0);
    m.rotation.y = Math.PI / 2;
    m.castShadow = true;
    g.add(m);
  }

  // 中央书案
  const t = table(2.6, 1.1, 0.82, M.wood);
  const tm = new THREE.Mesh(t.geo, t.mat);
  tm.position.set(0, 0, 0.4);
  tm.castShadow = true;
  g.add(tm);
  const ds = deskSet();
  const dm = new THREE.Mesh(ds.geo, ds.mat);
  dm.position.set(0, 0, 0.4);
  g.add(dm);

  // 案后椅
  const ch = chair();
  const cm = new THREE.Mesh(ch.geo, ch.mat);
  cm.position.set(0, 0, -0.55);
  cm.rotation.y = Math.PI;
  g.add(cm);

  // 书架前梯
  const ladder = [];
  for (const sx of [-1, 1]) {
    const rail = box(0.05, 2.4, 0.05, COVER.woodBeam);
    rail.rotateX(0.18);
    rail.translate(sx * 0.22, 1.2, 0);
    ladder.push(rail);
  }
  for (let i = 0; i < 6; i++) {
    const r = box(0.48, 0.04, 0.06, COVER.woodBeam);
    r.translate(0, 0.3 + i * 0.36, -0.06 * i + 0.4);
    ladder.push(r);
  }
  rb.add(merge(ladder), M.wood);

  rb.flush(g);
  return g;
}

/** 大成殿：神龛、孔子牌位、四配、供桌、钟磬 */
export function roomShrine({ width = 20, depth = 14, height = 5.6 } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;

  // 神龛（后部）
  const nicheW = Math.min(width - 4, 12);
  const nicheH = Math.min(4.2, height - 1.2);
  const nicheD = 2.4;
  const nicheZ = -halfD + nicheD / 2 + 0.4;

  // 龛座
  const plinth = box(nicheW + 0.6, 0.55, nicheD + 0.5, COVER.marble);
  plinth.translate(0, 0.275, nicheZ);
  rb.add(plinth, M.stone);

  // 龛身（三面围合）
  const backW = box(nicheW, nicheH, 0.16, COVER.woodLacquer);
  backW.translate(0, 0.55 + nicheH / 2, nicheZ - nicheD / 2);
  rb.add(backW, M.red);
  for (const sx of [-1, 1]) {
    const side = box(0.16, nicheH, nicheD, COVER.woodLacquer);
    side.translate(sx * nicheW / 2, 0.55 + nicheH / 2, nicheZ);
    rb.add(side, M.red);
  }
  // 龛顶
  const cap = box(nicheW + 0.5, 0.22, nicheD + 0.4, COVER.woodLacquer);
  cap.translate(0, 0.55 + nicheH, nicheZ);
  rb.add(cap, M.red);
  // 龛内金柱
  for (const sx of [-1, 1]) {
    const col = cylinder(0.13, 0.14, nicheH, 12, COVER.woodLacquer);
    col.translate(sx * (nicheW / 2 - 0.35), 0.55 + nicheH / 2, nicheZ + nicheD / 2 - 0.1);
    rb.add(col, M.red);
  }

  // 孔子塑像（居中，高约 2.3m）
  const kz = nicheZ - 0.1;
  const statue = confuciusStatue(1.0);
  statue.position.set(0, 0.55, kz);
  g.add(statue);
  // 塑像前神位牌
  const kt = tablet('至圣先师孔子神位', { w: 0.3, h: 0.95 });
  kt.position.set(0, 0.55, kz + 0.75);
  g.add(kt);
  // 牌位后屏
  const halo = box(1.3, 1.9, 0.08, COVER.woodLacquer);
  halo.translate(0, 0.55 + 1.0, kz - 0.12);
  rb.add(halo, M.dark);

  // 四配牌位（两侧）
  const four = ['复圣颜子', '宗圣曾子', '述圣子思', '亚圣孟子'];
  four.forEach((nm, i) => {
    const sx = i < 2 ? -1 : 1;
    const off = i % 2 === 0 ? 1.9 : 3.3;
    const tb = tablet(nm, { w: 0.24, h: 0.95 });
    tb.position.set(sx * off, 0.55, kz + 0.1);
    g.add(tb);
  });

  // 供桌（龛前）
  const a = altar(nicheW * 0.62, 0.95, 0.98, M.red);
  const am = new THREE.Mesh(a.geo, a.mat);
  am.position.set(0, 0.02, nicheZ + nicheD / 2 + 0.75);
  am.castShadow = true;
  g.add(am);

  // 供器：香炉 + 一对烛台 + 供果盘
  const c = smallCenser();
  const cm = new THREE.Mesh(c.geo, c.mat);
  cm.position.set(0, 1.0, nicheZ + nicheD / 2 + 0.75);
  g.add(cm);
  for (const sx of [-1, 1]) {
    const cd = candle(0.55);
    const cdm = new THREE.Mesh(cd.geo, cd.mat);
    cdm.position.set(sx * 0.75, 1.0, nicheZ + nicheD / 2 + 0.7);
    g.add(cdm);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2.4 }),
    );
    flame.position.set(sx * 0.75, 1.0 + cd.flameY, nicheZ + nicheD / 2 + 0.7);
    g.add(flame);
  }

  // 两侧配享龛（东西序）
  for (const sx of [-1, 1]) {
    const sw = 1.5;
    const sd = 1.2;
    const bx = sx * (width / 2 - 1.1);
    const base2 = box(sw + 0.3, 0.4, sd + 0.3, COVER.marble);
    base2.translate(bx, 0.2, -halfD + 2.2);
    rb.add(base2, M.stone);
    for (let i = 0; i < 2; i++) {
      const tb = tablet(i === 0 ? '先贤' : '先儒', { w: 0.2, h: 0.8 });
      tb.position.set(bx, 0.4, -halfD + 2.0 + i * 0.55);
      g.add(tb);
    }
  }

  // 编钟架（东侧）
  const bellX = width / 2 - 1.4;
  const frame = [];
  for (const sz of [-1, 1]) {
    const post = box(0.12, 2.2, 0.12, COVER.woodLacquer);
    post.translate(bellX, 1.1, sz * 1.1);
    frame.push(post);
  }
  const beamTop = box(0.14, 0.16, 2.4, COVER.woodLacquer);
  beamTop.translate(bellX, 2.16, 0);
  frame.push(beamTop);
  rb.add(merge(frame), M.red);
  for (let i = 0; i < 5; i++) {
    const bell = lathe([[0, 0], [0.11, 0.02], [0.13, 0.1], [0.12, 0.2], [0.06, 0.24], [0, 0.25]], 12, 1);
    bell.translate(bellX, 1.86 - i * 0.02, -0.9 + i * 0.45);
    rb.add(bell, M.bronze);
  }

  // 蒲团
  for (let i = 0; i < 3; i++) {
    const cu = cylinder(0.36, 0.38, 0.11, 12, 1);
    cu.translate(0, 0.055, 1.2 + i * 1.3);
    rb.add(cu, M.cloth);
  }

  rb.flush(g);
  return g;
}

/** 斋舍：书案、床榻、书架、衣箱 */
export function roomDorm({ width = 44, depth = 9.5, height = 3.2, bays = 9 } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;
  const bayW = width / bays;

  for (let b = 0; b < bays; b++) {
    const cx = -width / 2 + bayW * (b + 0.5);
    // 书案靠窗
    const t = table(1.15, 0.6, 0.78, M.wood);
    const tm = new THREE.Mesh(t.geo, t.mat);
    tm.position.set(cx - bayW * 0.18, 0, halfD - 1.0);
    tm.castShadow = true;
    g.add(tm);
    const ds = deskSet();
    const dm = new THREE.Mesh(ds.geo, ds.mat);
    dm.position.set(cx - bayW * 0.18, 0, halfD - 1.0);
    g.add(dm);
    const ch = chair();
    const cm = new THREE.Mesh(ch.geo, ch.mat);
    cm.position.set(cx - bayW * 0.18, 0, halfD - 1.75);
    cm.rotation.y = Math.PI;
    g.add(cm);

    // 床榻靠后墙
    const bd = bed(1.05, 1.95, 0.5);
    const bm = new THREE.Mesh(bd.geo, bd.mat);
    bm.position.set(cx + bayW * 0.2, 0, -halfD + 1.3);
    bm.rotation.y = Math.PI / 2;
    bm.castShadow = true;
    g.add(bm);
    const bl = bedding(0.95, 1.5);
    const blm = new THREE.Mesh(bl.geo, bl.mat);
    blm.position.set(cx + bayW * 0.2, 0, -halfD + 1.3);
    blm.rotation.y = Math.PI / 2;
    g.add(blm);

    // 衣箱
    const chest = box(0.62, 0.42, 0.42, COVER.woodBeam);
    chest.translate(cx + bayW * 0.42, 0.21, -halfD + 2.9);
    rb.add(chest, M.wood);
    const lid = box(0.64, 0.05, 0.44, COVER.woodBeam);
    lid.translate(cx + bayW * 0.42, 0.44, -halfD + 2.9);
    rb.add(lid, M.dark);

    // 书架
    if (b % 2 === 0) {
      const s = shelf(1.0, 1.8, 0.34, 4);
      const sm = new THREE.Mesh(s.geo, s.mat);
      sm.position.set(cx + bayW * 0.46, 0, -halfD + 0.28);
      sm.rotation.y = 0;
      g.add(sm);
      for (let lv = 0; lv < 4; lv++) {
        const bk = bookStack(3 + Math.floor(Math.random() * 3));
        const bkm = new THREE.Mesh(bk.geo, bk.mat);
        bkm.position.set(cx + bayW * 0.46 - 0.2, 0.1 + (1.68 / 4) * lv, -halfD + 0.3);
        g.add(bkm);
      }
    }
  }

  rb.flush(g);
  return g;
}

/** 明伦堂：课桌列 + 讲案 */
export function roomClassroom({ width = 22, depth = 12, height = 4.2 } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;

  // 讲案（前部）
  const t = table(2.2, 0.8, 0.86, M.red);
  const tm = new THREE.Mesh(t.geo, t.mat);
  tm.position.set(0, 0, -halfD + 2.2);
  tm.castShadow = true;
  g.add(tm);
  const ch = chair();
  const cm = new THREE.Mesh(ch.geo, ch.mat);
  cm.position.set(0, 0, -halfD + 1.4);
  g.add(cm);

  // 课桌（四列 × 三排）
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = -6.6 + c * 4.4;
      const z = -1.4 + r * 2.6;
      const d = table(1.5, 0.6, 0.76, M.wood);
      const dm = new THREE.Mesh(d.geo, d.mat);
      dm.position.set(x, 0, z);
      dm.castShadow = true;
      g.add(dm);
      for (const sx of [-1, 1]) {
        const st = new THREE.Mesh(chair().geo, M.wood);
        st.position.set(x + sx * 0.5, 0, z + 0.75);
        st.rotation.y = Math.PI;
        g.add(st);
      }
      const bk = bookStack(2);
      const bkm = new THREE.Mesh(bk.geo, bk.mat);
      bkm.position.set(x, 0.76, z);
      g.add(bkm);
    }
  }

  // 后墙书架
  const s = shelf(6, 2.0, 0.4, 4);
  const sm = new THREE.Mesh(s.geo, s.mat);
  sm.position.set(0, 0, -halfD + 0.3);
  g.add(sm);

  rb.flush(g);
  return g;
}

/** 百泉轩：茶室 */
export function roomLounge({ width = 13, depth = 7.5, height = 3.4 } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;

  // 茶桌
  const t = table(1.6, 0.9, 0.7, M.wood);
  const tm = new THREE.Mesh(t.geo, t.mat);
  tm.position.set(0, 0, 0.2);
  tm.castShadow = true;
  g.add(tm);
  // 茶具
  const pot = lathe([[0, 0], [0.09, 0.01], [0.11, 0.08], [0.08, 0.14], [0.04, 0.16], [0, 0.17]], 14, 1);
  pot.translate(0.2, 0.7, 0.2);
  rb.add(pot, M.stone);
  for (let i = 0; i < 4; i++) {
    const cup = lathe([[0, 0], [0.035, 0.005], [0.042, 0.04], [0.036, 0.06], [0, 0.062]], 10, 1);
    cup.translate(-0.4 + i * 0.24, 0.7, 0.05);
    rb.add(cup, M.stone);
  }
  for (const [x, z, ry] of [[-0.7, 0.9, 0], [0.7, 0.9, 0], [0, -0.55, Math.PI]]) {
    const st = new THREE.Mesh(chair().geo, M.wood);
    st.position.set(x, 0, z);
    st.rotation.y = ry;
    g.add(st);
  }

  // 榻（靠侧墙）
  const bd = bed(1.2, 2.1, 0.46);
  const bm = new THREE.Mesh(bd.geo, bd.mat);
  bm.position.set(-width / 2 + 1.3, 0, -halfD + 1.6);
  bm.rotation.y = Math.PI / 2;
  g.add(bm);

  // 屏风
  const sp = screen(3, 0.6, 2.1);
  const spm = new THREE.Mesh(sp.geo, sp.mat);
  spm.position.set(width / 2 - 1.6, 0, -halfD + 1.2);
  spm.rotation.y = -0.4;
  g.add(spm);

  // 香炉
  const c = smallCenser();
  const cm = new THREE.Mesh(c.geo, c.mat);
  cm.position.set(0, 0.42, -halfD + 0.8);
  g.add(cm);

  rb.flush(g);
  return g;
}

/** 门厅：门吏案、灯笼、门闩 */
export function roomGate({ width = 16, depth = 7, height = 4.2 } = {}) {
  const g = new THREE.Group();
  const rb = new RB();
  const halfD = depth / 2;

  for (const sx of [-1, 1]) {
    const t = table(1.1, 0.6, 0.8, M.wood);
    const tm = new THREE.Mesh(t.geo, t.mat);
    tm.position.set(sx * (width / 2 - 2.0), 0, -halfD + 1.4);
    g.add(tm);
    const st = new THREE.Mesh(chair().geo, M.wood);
    st.position.set(sx * (width / 2 - 2.0), 0, -halfD + 2.2);
    st.rotation.y = Math.PI;
    g.add(st);
  }

  // 门闩架
  const bar = box(3.2, 0.14, 0.14, COVER.woodBeam);
  bar.translate(0, 1.4, halfD - 0.5);
  rb.add(bar, M.wood);

  rb.flush(g);
  return g;
}
