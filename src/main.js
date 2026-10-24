import './style.css';
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Environment } from './core/environment.js';
import { CameraController } from './core/controls.js';
import { prewarmTextures } from './gfx/textures.js';
import { buildAcademy, updateSite } from './site/complex.js';
import { UI } from './ui/ui.js';
import { at, ROUTE } from './site/layout.js';
import { heightAt } from './site/terrain.js';

const ui = new UI();
const canvas = document.getElementById('view');
const engine = new Engine(canvas);
const env = new Environment(engine.renderer, engine.scene);
env.setTime(10.2);
window.__scene = engine.scene;   // 调试探针用


// 调试参数：?q=smooth|hd|ultra  ?still=1（只渲染若干帧，便于无头截图）
const PARAMS = new URLSearchParams(location.search);
if (PARAMS.get('q') === 'smooth' || PARAMS.get('q') === 'ultra') {
  engine.setQuality(PARAMS.get('q'));
}
const STILL = PARAMS.get('still') === '1';
if (PARAMS.get('noout') === '1') window.__NOOUT = true;
if (PARAMS.get('nomsaa') === '1') window.__NOMSAA = true;
if (PARAMS.get('noridge') === '1') window.__NORIDGE = true;

// 静止时不必重绘阴影
engine.renderer.shadowMap.autoUpdate = false;

const controls = new CameraController(engine.camera, canvas, {
  onClick: (e) => pick(e),
  onDoubleClick: () => {},
});

const raycaster = new THREE.Raycaster();
raycaster.far = 600;
const ndc = new THREE.Vector2();

let interactive = [];
let buildings = [];
let current = null;
let shotRequested = false;

const TIMES = [
  { label: '辰时', h: 7.4 },
  { label: '巳时', h: 9.8 },
  { label: '午时', h: 12.4 },
  { label: '申时', h: 15.4 },
  { label: '酉时', h: 17.2 },
];
let timeIdx = 1;
const QS = ['smooth', 'hd', 'ultra'];
let qIdx = 1;

/* ── 启动 ── */
async function boot() {
  ui.progress(0.02, '正在备料');
  await new Promise((r) => setTimeout(r, 60));

  await prewarmTextures((p) => {
    ui.progress(0.02 + p * 0.34, '正在研制砖瓦木石');
  });

  const res = await buildAcademy(engine.scene, (p, label) => {
    ui.progress(0.38 + p * 0.58, label);
  });
  interactive = res.interactive;
  buildings = res.buildings;

  // 碰撞：只挡墙，不挡门洞
  controls.setColliders(res.colliders || []);
  // 地面高度：叠加建筑台基
  const plats = res.platforms || [];
  controls.setGroundFn((x, z) => {
    let h = heightAt(x, z);
    for (const p of plats) {
      if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) {
        if (p.y > h) h = p.y;
      }
    }
    return h;
  });

  // 底部索引
  ui.setDock(buildings.map((b) => b.data), (it) => {
    const found = buildings.find((b) => b.data.id === it.id);
    if (found) focusBuilding(found);
  });

  // 初始机位：东南方向鸟瞰（可用 ?cam=x,y,z&look=x,y,z 覆盖，便于取景）
  const c = at(72, 8);
  const camP = PARAMS.get('cam');
  const lookP = PARAMS.get('look');
  if (camP && lookP) {
    const [cx, cy, cz] = camP.split(',').map(Number);
    const [lx, ly, lz] = lookP.split(',').map(Number);
    controls.target.set(lx, ly, lz);
    controls.spherical.setFromVector3(new THREE.Vector3(cx - lx, cy - ly, cz - lz));
    controls.mode = 'orbit';
    controls._applyOrbit(1);
  } else {
    controls.target.set(c.x, 14, c.z);
    controls.spherical.set(168, Math.PI * 0.455, Math.PI * 0.5 + 0.66);
    controls.camera.position.copy(
      controls.target.clone().add(new THREE.Vector3().setFromSpherical(controls.spherical)),
    );
    controls.camera.lookAt(controls.target);
  }

  ui.progress(1, '落成');
  await new Promise((r) => setTimeout(r, 420));

  // 预热着色器
  try {
    engine.renderer.compile(engine.scene, engine.camera);
  } catch (e) { /* ignore */ }

  ui.ready();
  if (STILL && PARAMS.get('mirror') === '1') window.__mirrorOn();

  // 调试：?tour=N 直接跳到第 N 站
  const tourP = PARAMS.get('tour');
  if (tourP) setTimeout(() => tourGo(Math.max(0, parseInt(tourP, 10) || 0), STILL ? 0.02 : 2.1), 900);

  engine.start();

  if (STILL) {
    // 无头截图：留出时间让导览机位到位，再停住
    const delay = PARAMS.get('tour') ? 2600 : 400;
    setTimeout(() => {
      engine.stop();
      if (window.__mirror) window.__mirror();
      window.__READY__ = true;
      document.title = 'READY';
    }, delay);
  }
}

/* ── 拾取 ── */
function pick(e) {
  if (controls.mode !== 'orbit') return;
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, engine.camera);
  const hits = raycaster.intersectObjects(interactive, true);
  if (!hits.length) {
    ui.showPlace(null);
    current = null;
    return;
  }
  let o = hits[0].object;
  while (o && !o.userData.building) o = o.parent;
  if (o?.userData.building) {
    const found = buildings.find((b) => b.data.id === o.userData.building.id);
    if (found) {
      current = found;
      ui.showPlace(found.data);
    }
  }
}

function focusBuilding(b) {
  current = b;
  ui.showPlace(b.data);
  const h = b.object.userData.eaveY || 6;
  controls.focusOn(new THREE.Vector3(b.pos.x, h * 0.5, b.pos.z), Math.max(20, (b.data.opts?.width || 14) * 1.9));
}

/* ── 导览 ── */
let tourIdx = -1;

function tourGo(i, dur = 2.1) {
  const n = ROUTE.length;
  tourIdx = Math.max(0, Math.min(n - 1, i));
  const st = ROUTE[tourIdx];
  const camP = at(st.camU, st.camV);
  const lookP = at(st.lookU, st.lookV);
  controls.flyTo(
    new THREE.Vector3(camP.x, st.camY, camP.z),
    new THREE.Vector3(lookP.x, st.lookY, lookP.z),
    dur,
  );
  ui.showTour(st, tourIdx, n);
  ui.setButton('view', '导览中');
  ui.setCrosshair(false);
}

function tourExit() {
  tourIdx = -1;
  ui.hideTour();
  controls.endTour();
  ui.setButton('view', MODE_LABEL[controls.mode] || '鸟瞰');
  ui.showPlace(null);
}

ui.bindTour(() => tourGo(tourIdx - 1), () => tourGo(tourIdx + 1), tourExit);

/* ── 工具条 ── */
const MODES = ['orbit', 'walk', 'fly'];
const MODE_LABEL = { orbit: '鸟瞰', walk: '步行', fly: '飞行' };
let modeIdx = 0;

ui.on('view', () => {
  if (tourIdx >= 0) tourExit();
  modeIdx = (modeIdx + 1) % 3;
  const m = MODES[modeIdx];
  if (m === 'walk') {
    // 落在中轴上，面朝讲堂
    const p = at(10, 0);
    controls.walk.pos.set(p.x, 1.7, p.z);
    controls.walk.yaw = Math.atan2(-0.9835, -0.18) + Math.PI;
    controls.walk.pitch = 0.02;
  }
  controls.setMode(m);
  ui.setButton('view', MODE_LABEL[m]);
  ui.setCrosshair(m !== 'orbit');
  document.body.classList.toggle('walking', m !== 'orbit');
});

ui.on('tour', () => { tourGo(tourIdx < 0 ? 0 : tourIdx); });

ui.on('time', (btn) => {
  timeIdx = (timeIdx + 1) % TIMES.length;
  env.setTime(TIMES[timeIdx].h);
  btn.textContent = TIMES[timeIdx].label;
  engine.renderer.shadowMap.needsUpdate = true;
});

ui.on('quality', (btn) => {
  qIdx = (qIdx + 1) % QS.length;
  const name = engine.setQuality(QS[qIdx]);
  btn.textContent = name;
  engine.renderer.shadowMap.needsUpdate = true;
});

ui.on('shot', () => { shotRequested = true; });

/* ── 触屏摇杆 ── */
if ('ontouchstart' in window) {
  document.body.classList.add('touch');
  const touch = document.createElement('div');
  touch.id = 'touch';
  touch.innerHTML = '<div id="stick"><div id="stickKnob"></div></div>';
  document.body.appendChild(touch);
  const stick = touch.querySelector('#stick');
  const knob = touch.querySelector('#stickKnob');
  let active = null;
  const R = 42;

  const start = (e) => {
    active = e.pointerId;
    stick.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (active !== e.pointerId) return;
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    controls.setStick(dx / R, dy / R);
  };
  const end = (e) => {
    if (active !== e.pointerId) return;
    active = null;
    knob.style.transform = '';
    controls.setStick(0, 0);
  };
  stick.addEventListener('pointerdown', start);
  stick.addEventListener('pointermove', move);
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}

/* ── 渲染循环 ── */
const lastFocus = new THREE.Vector3(1e9, 0, 0);
let statTimer = 0;

engine.onFrame = (dt, t) => {
  controls.update(dt);
  env.update(dt, engine.camera);
  updateSite(t);

  // 阴影相机跟随
  const focus = controls.mode === 'orbit' ? controls.target : controls.walk.pos;
  const radius = controls.mode === 'orbit'
    ? Math.min(95, Math.max(26, controls.spherical.radius * 0.4))
    : 52;
  if (focus.distanceTo(lastFocus) > 1.5) {
    env.updateShadow(focus, radius);
    lastFocus.copy(focus);
    engine.renderer.shadowMap.needsUpdate = true;
  }

  // 截图
  if (shotRequested) {
    shotRequested = false;
    engine.composer.render(dt);
    const url = engine.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `岳麓书院-${Date.now()}.png`;
    a.click();
  }

  statTimer += dt;
  if (statTimer > 0.5) {
    statTimer = 0;
    ui.setStat(`${engine.stats.fps} FPS`);
  }
};

/**
 * 调试用：把 WebGL 帧镜像到一张 2D canvas 上
 * （无头浏览器的合成器抓不到 WebGL 图层，但能抓到 2D canvas）
 */
window.__mirrorOn = () => {
  const c2 = document.createElement('canvas');
  c2.id = 'mirror';
  c2.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:4;pointer-events:none';
  document.body.appendChild(c2);
  window.__mirror = () => {
    const r = engine.renderer;
    r.setRenderTarget(null);
    if (engine.useComposer && engine.composer) engine.composer.render(0.016);
    else r.render(engine.scene, engine.camera);
    const w = r.domElement.width;
    const h = r.domElement.height;
    c2.width = w; c2.height = h;
    const gl = r.getContext();
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const ctx = c2.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      img.data.set(buf.subarray(src, src + w * 4), y * w * 4);
    }
    ctx.putImageData(img, 0, 0);
  };
};

/**
 * 调试用：设定机位并重新镜像一帧
 * 供多机位截图脚本调用，避免每次重新加载场景
 */
window.__setCam = (px, py, pz, lx, ly, lz) => {
  controls.mode = 'orbit';
  controls.enabled = true;
  controls.target.set(lx, ly, lz);
  controls.camera.position.set(px, py, pz);
  controls.camera.lookAt(lx, ly, lz);
  controls.spherical.setFromVector3(controls.camera.position.clone().sub(controls.target));
  controls.spherical.phi = Math.max(0.05, Math.min(Math.PI * 0.495, controls.spherical.phi));
  env.update(0.016, controls.camera);
  env.updateShadow(controls.target, Math.max(30, Math.min(110, controls.spherical.radius * 0.9)));
  if (window.__mirror) window.__mirror();
  return true;
};

/** 调试用：按 u/v 坐标设定机位 */
window.__setCamUV = (cu, cv, cy, lu, lv, ly) => {
  const a = at(cu, cv);
  const b = at(lu, lv);
  return window.__setCam(a.x, cy, a.z, b.x, ly, b.z);
};

// 页面隐藏时暂停
document.addEventListener('visibilitychange', () => {
  if (document.hidden) engine.stop();
  else engine.start();
});

boot().catch((err) => {
  console.error(err);
  ui.progress(1, '营造失败：' + err.message);
});
