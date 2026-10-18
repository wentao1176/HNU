import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCampus } from "./scene.js";
import { createInterior } from "./interior.js";
import { centroid, pointInPolygon, walkDirection } from "./geo.js";
import {
  landmarks,
  categoryOrder,
  addMappedBuildings,
} from "./data/landmarks.js";
import "./style.css";

const root = document.querySelector("#app");
root.innerHTML = `
  <div class="scene-shell" id="viewport" aria-label="湖南大学交互式三维校园"></div>
  <div class="scene-shade"></div>
  <header class="topbar">
    <div class="brand"><div class="brand-mark">H<span>U</span></div><div><strong>湖大漫游</strong><small>HUNAN UNIVERSITY · 3D CAMPUS</small></div></div>
    <nav class="district-nav" aria-label="快速定位"><span>漫游分区</span><button data-district="north">南校区</button><button data-district="tianma">天马园</button><button data-district="dezhi">德智园</button><button data-district="finance">财院校区</button></nav>
    <div class="top-actions">
      <button class="icon-button" id="overviewButton" title="返回总览" aria-label="返回总览">⌖</button>
      <button class="icon-button" id="timeButton" title="切换日夜" aria-label="切换日夜">☼</button>
      <button class="icon-button" id="qualityButton" title="切换画质" aria-label="切换画质">HD</button>
      <button class="icon-button export-button" id="exportButton" title="导出超清视图" aria-label="导出超清视图">↓</button>
      <button class="icon-button" id="infoButton" title="数据与说明" aria-label="数据与说明">ⓘ</button>
    </div>
  </header>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-top"><span class="eyebrow">EXPLORE THE CAMPUS</span><button class="mobile-grip" id="sidebarToggle" aria-label="展开或收起地点列表"><span></span></button></div>
    <div class="sidebar-intro"><h1>一座可以<br><em>走进去</em>的湖大</h1><p>南校区、天马、德智与财院校区，沿着地图中的街巷与建筑轮廓，重新认识这片山水校园。</p></div>
    <label class="search-box"><span>⌕</span><input id="searchInput" type="search" placeholder="搜索建筑、地点…" autocomplete="off" aria-label="搜索建筑或地点" /><kbd> / </kbd></label>
    <div class="categories" id="categories" aria-label="地点分类"></div>
    <div class="list-heading"><span>地点与建筑</span><span id="resultCount"></span></div>
    <div class="place-list" id="placeList"></div>
    <div class="sidebar-foot"><span class="live-dot"></span> 430 个楼体轮廓 · 9 个区域 <span>2026</span></div>
  </aside>
  <aside class="detail-panel" id="detailPanel" aria-live="polite"></aside>
  <div class="scene-labels" id="sceneLabels"></div>
  <div class="mode-bar" id="modeBar"><span class="mode-kicker">探索方式</span><button class="mode-choice active" id="orbitButton">◈ <span>鸟瞰浏览</span></button><button class="mode-choice" id="walkButton">↟ <span>第一人称</span></button></div>
  <div class="compass" id="compass"><span>北</span><i></i><small>N</small></div>
  <div class="walk-hint" id="walkHint">W A S D 移动 · 鼠标环视 · Shift 加速 · Esc 退出</div>
  <div class="joystick" id="joystick"><div class="joystick-knob" id="joystickKnob"></div></div>
  <div class="interior-badge" id="interiorBadge"><span class="badge-dot"></span><span>室内示意空间</span><button id="exitInteriorButton">退出建筑 ↗</button></div>
  <div class="toast" id="toast" role="status"></div>
  <dialog id="infoDialog" class="info-dialog"><form method="dialog"><button class="dialog-close" aria-label="关闭">×</button><span class="eyebrow">ABOUT THE PROJECT</span><h2>关于这座三维校园</h2><p>这是根据公开资料制作的交互式艺术化复原。建筑位置、可获取的平面轮廓和道路参照 OpenStreetMap；区域关系核对湖南大学官方南、北校区总平面图。重点建筑外观依据学校公开文章描述重新建模。</p><p><strong>室内均为示意设计</strong>，不代表真实楼层、房间或通行安排。高度、立面、植被、地形和部分道路细节亦存在估计。望麓桥公寓目前仅展示园区边界，请以学校实地和官方信息为准。</p><div class="source-list"><a href="https://www.hnu.edu.cn/xysh/xydt/xxdt.htm" target="_blank" rel="noopener noreferrer">湖南大学 · 学校地图 ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL ↗</a><a href="https://news.hnu.edu.cn/info/1027/12780.htm" target="_blank" rel="noopener noreferrer">复临舍建筑介绍 ↗</a><a href="https://news.hnu.edu.cn/info/1023/15511.htm" target="_blank" rel="noopener noreferrer">研楼建筑介绍 ↗</a></div><button class="primary-button dialog-done">继续漫游</button></form></dialog>
  <div class="loading" id="loading"><div class="loading-emblem">湖</div><div class="loading-title">湖大漫游</div><div class="loading-sub">正在绘制山水与街巷</div><div class="loading-line"><span></span></div></div>
`;

const $ = (selector) => document.querySelector(selector);
const viewport = $("#viewport");
let renderer,
  scene,
  camera,
  orbit,
  campus,
  indoor = null,
  indoorContext = null;
let mode = "orbit",
  selected = null,
  activeCategory = "全部",
  night = false,
  quality = 1;
let yaw = 0,
  pitch = 0,
  lastFrame = performance.now(),
  lastPointer = null,
  dragDistance = 0;
let currentTransition = null,
  toastTimer = null;
const keys = new Set(),
  raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2();
const joystick = { x: 0, y: 0, pointerId: null };
const labels = new Map();
const sceneLabels = $("#sceneLabels");

function showToast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3500);
}

function getPosition(poi) {
  if (poi.members)
    return centroid(
      poi.members.map((id) => centroid(campus.buildingById.get(id).points)),
    );
  if (poi.position) return poi.position;
  const record = campus.buildingById.get(poi.id) || campus.areaById.get(poi.id);
  if (!record) return [0, 0];
  return centroid(record.points);
}

function poiHeight(poi) {
  return (
    poi.focusHeight ||
    campus.buildings.find((b) => b.id === poi.id)?.height ||
    12
  );
}

function findPoiForMesh(id) {
  const exact = landmarks.find((p) => p.id === id);
  if (exact) return exact;
  if ([1150591611, 1150591612, 1150591613, 1150591614].includes(id))
    return landmarks.find((p) => p.id === "grad");
  const building = campus.buildings.find((b) => b.id === id);
  if (!building) return null;
  const zone = campus.campus.zones
    .slice(1)
    .find((z) => pointInPolygon(building.center, z.points));
  if (zone) return landmarks.find((p) => p.id === zone.id) || null;
  if (pointInPolygon(building.center, campus.areaById.get(272516791).points))
    return landmarks.find((p) => p.id === 272516791);
  if (!building.name || /^[A-H\d-]+$/.test(building.name)) return null;
  const type =
    building.style === "heritage"
      ? "hall"
      : building.style === "dorm"
        ? "dorm"
        : "classroom";
  return {
    id: building.id,
    name: building.name,
    category: "校园",
    subtitle: "公开地图标注建筑",
    description: "位置与平面轮廓来自 OpenStreetMap；立面和室内是示意性复原。",
    icon: "▤",
    interior: type,
    source: "https://www.openstreetmap.org/copyright",
  };
}

function renderCategories() {
  $("#categories").innerHTML = categoryOrder
    .map(
      (category) =>
        `<button class="category ${category === activeCategory ? "selected" : ""}" data-category="${category}">${category}</button>`,
    )
    .join("");
}

function renderList() {
  const query = $("#searchInput").value.trim().toLocaleLowerCase();
  const matches = landmarks.filter(
    (p) =>
      (activeCategory === "全部" || p.category === activeCategory) &&
      `${p.name} ${p.subtitle} ${p.description}`
        .toLocaleLowerCase()
        .includes(query),
  );
  $("#resultCount").textContent = `${matches.length} 个地点`;
  $("#placeList").innerHTML = matches.length
    ? matches
        .map(
          (p) =>
            `<button class="place-item ${selected?.id === p.id ? "chosen" : ""}" data-id="${p.id}"><span class="place-icon">${p.icon}</span><span class="place-copy"><strong>${p.name}</strong><small>${p.subtitle}</small></span><span class="place-arrow">↗</span></button>`,
        )
        .join("")
    : '<div class="empty-state">没有找到匹配的地点<br><small>试试“复临舍”“体育馆”或“天马”</small></div>';
}

function renderDetail() {
  const panel = $("#detailPanel");
  if (!selected) {
    panel.classList.remove("visible");
    panel.innerHTML = "";
    return;
  }
  const position = getPosition(selected);
  const latitude = (campus.campus.origin[1] - position[1] / 110950).toFixed(5);
  const longitude = (
    campus.campus.origin[0] +
    position[0] / (111320 * Math.cos((campus.campus.origin[1] * Math.PI) / 180))
  ).toFixed(5);
  panel.innerHTML = `<button class="detail-close" id="detailClose" aria-label="关闭地点详情">×</button><div class="detail-num">01 — DESTINATION</div><div class="detail-symbol">${selected.icon}</div><div class="detail-category">${selected.category} · 湖南大学</div><h2>${selected.name}</h2><p class="detail-subtitle">${selected.subtitle}</p><p class="detail-description">${selected.description}</p><div class="detail-coord"><span>地理坐标</span><strong>${latitude}° N<br>${longitude}° E</strong></div><div class="detail-actions"><button class="primary-button" id="focusButton">聚焦建筑 <span>↗</span></button>${selected.interior ? `<button class="secondary-button" id="enterButton">进入建筑 <span>→</span></button>` : ""}</div><a class="detail-source" href="${selected.source}" target="_blank" rel="noopener noreferrer">查看相关公开资料 ↗</a><small class="detail-note">室内与部分外观为示意复原</small>`;
  panel.classList.add("visible");
  $("#detailClose").addEventListener("click", () => {
    selected = null;
    renderDetail();
    renderList();
  });
  $("#focusButton").addEventListener("click", () => focusPoi(selected));
  $("#enterButton")?.addEventListener("click", enterInterior);
}

function setSelected(poi, fly = true) {
  selected = poi;
  renderDetail();
  renderList();
  if (fly) focusPoi(poi);
  if (window.innerWidth < 760) $("#sidebar").classList.add("collapsed");
}

function transitionTo(position, target, duration = 1150) {
  const now = performance.now();
  currentTransition = {
    from: camera.position.clone(),
    to: position,
    targetFrom: orbit.target.clone(),
    targetTo: target,
    start: now,
    duration,
  };
}

function focusPoi(poi) {
  if (mode === "interior") exitInterior();
  if (mode === "walk") setMode("orbit");
  const [x, z] = getPosition(poi),
    h = poiHeight(poi);
  const record = campus.buildings.find((b) => b.id === poi.id);
  const area = campus.areaById.get(poi.id);
  const areaRadius = area
    ? Math.max(...area.points.map((p) => Math.hypot(p[0] - x, p[1] - z)))
    : 65;
  const distance = record
    ? Math.max(72, Math.min(230, record.radius * 2.15))
    : Math.max(95, Math.min(900, areaRadius * 1.65));
  transitionTo(
    new THREE.Vector3(
      x + distance * 0.63,
      h + distance * 0.82,
      z + distance * 0.86,
    ),
    new THREE.Vector3(x, h * 0.45, z),
  );
}

function setMode(next) {
  if (mode === "interior") exitInterior();
  mode = next;
  currentTransition = null;
  orbit.enabled = next === "orbit";
  $("#orbitButton").classList.toggle("active", next === "orbit");
  $("#walkButton").classList.toggle("active", next === "walk");
  $("#walkHint").classList.toggle("visible", next === "walk");
  $("#joystick").classList.toggle(
    "visible",
    next === "walk" && matchMedia("(pointer: coarse)").matches,
  );
  $("#modeBar").classList.toggle("walking", next === "walk");
  if (document.pointerLockElement) document.exitPointerLock();
  if (next === "walk") {
    const [x, z] = selected ? getPosition(selected) : [40, -430];
    const record =
      selected && campus.buildings.find((b) => b.id === selected.id);
    const radius = record ? Math.max(15, record.radius + 8) : 38;
    let spawn = [x + radius * 0.7, z + radius * 0.7];
    for (let i = 0; i < 32; i++) {
      const angle = (i / 16) * Math.PI * 2,
        distance = radius + Math.floor(i / 16) * 22;
      const candidate = [
        x + Math.sin(angle) * distance,
        z + Math.cos(angle) * distance,
      ];
      if (
        !campus.buildings.some(
          (b) =>
            Math.abs(b.center[0] - candidate[0]) < b.radius + 1 &&
            Math.abs(b.center[1] - candidate[1]) < b.radius + 1 &&
            pointInPolygon(candidate, b.points),
        )
      ) {
        spawn = candidate;
        break;
      }
    }
    camera.position.set(spawn[0], 1.72, spawn[1]);
    camera.lookAt(x, 3, z);
    camera.rotation.order = "YXZ";
    yaw = camera.rotation.y;
    pitch = camera.rotation.x;
    showToast("第一人称：拖动视角，使用 WASD 或左下摇杆移动");
  } else {
    camera.up.set(0, 1, 0);
    orbit.target.set(
      camera.position.x - Math.sin(yaw) * 45,
      0,
      camera.position.z - Math.cos(yaw) * 45,
    );
    transitionTo(
      new THREE.Vector3(camera.position.x + 110, 145, camera.position.z + 145),
      new THREE.Vector3(orbit.target.x, 0, orbit.target.z),
      850,
    );
  }
}

function enterInterior() {
  if (!selected?.interior || !renderer) return;
  if (mode === "interior") return;
  indoorContext = {
    mode,
    position: camera.position.clone(),
    yaw,
    pitch,
    target: orbit.target.clone(),
  };
  if (document.pointerLockElement) document.exitPointerLock();
  mode = "interior";
  orbit.enabled = false;
  currentTransition = null;
  campus.group.visible = false;
  document.body.classList.add("interior-mode");
  indoor = createInterior(selected.interior);
  scene.add(indoor.group);
  camera.position.copy(indoor.spawn);
  yaw = 0;
  pitch = 0;
  camera.rotation.order = "YXZ";
  camera.rotation.set(pitch, yaw, 0);
  $("#interiorBadge").classList.add("visible");
  $("#walkHint").classList.add("visible");
  $("#joystick").classList.toggle(
    "visible",
    matchMedia("(pointer: coarse)").matches,
  );
  $("#sidebar").classList.add("collapsed");
  $("#detailPanel").classList.remove("visible");
  showToast("已进入示意室内 · 靠近出口或点击“退出建筑”返回");
}

function exitInterior() {
  if (mode !== "interior") return;
  if (document.pointerLockElement) document.exitPointerLock();
  scene.remove(indoor.group);
  indoor.dispose();
  indoor = null;
  campus.group.visible = true;
  document.body.classList.remove("interior-mode");
  mode = indoorContext.mode;
  camera.position.copy(indoorContext.position);
  yaw = indoorContext.yaw;
  pitch = indoorContext.pitch;
  camera.rotation.set(pitch, yaw, 0);
  orbit.target.copy(indoorContext.target);
  orbit.enabled = mode === "orbit";
  $("#interiorBadge").classList.remove("visible");
  $("#walkHint").classList.toggle("visible", mode === "walk");
  $("#joystick").classList.toggle(
    "visible",
    mode === "walk" && matchMedia("(pointer: coarse)").matches,
  );
  renderDetail();
  indoorContext = null;
  showToast("已返回校园");
}

function updateWalk(delta) {
  if (!["walk", "interior"].includes(mode)) return;
  let forward =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
    joystick.y;
  let strafe =
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
    joystick.x;
  const norm = Math.hypot(forward, strafe);
  if (norm > 0) {
    forward /= norm;
    strafe /= norm;
    const speed =
      (keys.has("ShiftLeft") || keys.has("ShiftRight")
        ? 14
        : mode === "interior"
          ? 3.2
          : 5.2) * Math.min(delta, 0.05);
    const direction = walkDirection(yaw, forward, strafe);
    const dx = direction[0] * speed,
      dz = direction[1] * speed;
    let nx = camera.position.x + dx,
      nz = camera.position.z + dz;
    if (mode === "interior") {
      nx = THREE.MathUtils.clamp(
        nx,
        -indoor.width / 2 + 0.9,
        indoor.width / 2 - 0.9,
      );
      nz = THREE.MathUtils.clamp(
        nz,
        -indoor.depth / 2 + 0.9,
        indoor.depth / 2 - 0.9,
      );
      if (nz > indoor.depth / 2 - 1.7 && Math.abs(nx) < 1.4) {
        exitInterior();
        return;
      }
    } else {
      nx = THREE.MathUtils.clamp(nx, -2100, 1000);
      nz = THREE.MathUtils.clamp(nz, -3650, 1400);
      const collides = campus.buildings.some(
        (b) =>
          Math.abs(b.center[0] - nx) < b.radius + 1.5 &&
          Math.abs(b.center[1] - nz) < b.radius + 1.5 &&
          pointInPolygon([nx, nz], b.points),
      );
      if (collides) {
        nx = camera.position.x;
        nz = camera.position.z;
      }
    }
    camera.position.x = nx;
    camera.position.z = nz;
  }
  camera.position.y =
    1.72 +
    (mode === "walk"
      ? campus.heightAt(camera.position.x, camera.position.z)
      : 0);
  camera.rotation.set(pitch, yaw, 0);
}

function updateLabels() {
  if (mode === "interior") {
    for (const el of labels.values()) el.style.display = "none";
    return;
  }
  const box = viewport.getBoundingClientRect();
  for (const [id, el] of labels) {
    const poi = landmarks.find((p) => p.id === id),
      [x, z] = getPosition(poi);
    const pos = new THREE.Vector3(x, poiHeight(poi) + 8, z);
    const distance = camera.position.distanceTo(pos);
    pos.project(camera);
    const visible =
      pos.z < 1 &&
      pos.z > -1 &&
      Math.abs(pos.x) < 1.05 &&
      Math.abs(pos.y) < 1.05 &&
      distance <
        (mode === "walk" ? 190 : Math.max(1200, camera.position.y * 3));
    el.style.display = visible ? "" : "none";
    if (visible) {
      el.style.transform = `translate(${(pos.x * 0.5 + 0.5) * box.width}px,${(-pos.y * 0.5 + 0.5) * box.height}px)`;
      el.classList.toggle("active", selected?.id === id);
    }
  }
}

function resetOverview() {
  if (mode === "interior") exitInterior();
  mode = "orbit";
  orbit.enabled = true;
  $("#walkHint").classList.remove("visible");
  $("#joystick").classList.remove("visible");
  $("#orbitButton").classList.add("active");
  $("#walkButton").classList.remove("active");
  $("#detailPanel").classList.remove("visible");
  selected = null;
  renderList();
  document
    .querySelectorAll("[data-district]")
    .forEach((button) => button.classList.remove("active"));
  transitionTo(
    new THREE.Vector3(1200, 2450, 1350),
    new THREE.Vector3(-650, 0, -1100),
    1400,
  );
}

function focusDistrict(district) {
  if (mode === "interior") exitInterior();
  if (mode === "walk") setMode("orbit");
  selected = null;
  renderDetail();
  renderList();
  const places = {
    north: { target: [-145, -750], camera: [335, 600, -65] },
    tianma: { target: [35, 575], camera: [445, 500, 1050] },
    dezhi: { target: [-420, 840], camera: [-40, 430, 1290] },
    finance: { target: [-1400, -2980], camera: [-940, 540, -2420] },
  };
  const place = places[district];
  transitionTo(
    new THREE.Vector3(...place.camera),
    new THREE.Vector3(place.target[0], 0, place.target[1]),
    1200,
  );
  document
    .querySelectorAll("[data-district]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.district === district),
    );
}

function setupEvents() {
  $("#categories").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderCategories();
    renderList();
  });
  $("#searchInput").addEventListener("input", renderList);
  $("#searchInput").addEventListener("focus", () => {
    if (window.innerWidth < 760) $("#sidebar").classList.remove("collapsed");
  });
  $("#placeList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    const poi = landmarks.find((p) => String(p.id) === button.dataset.id);
    if (poi) setSelected(poi);
  });
  $("#sidebarToggle").addEventListener("click", () =>
    $("#sidebar").classList.toggle("collapsed"),
  );
  $("#overviewButton").addEventListener("click", resetOverview);
  $(".district-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-district]");
    if (button) focusDistrict(button.dataset.district);
  });
  $("#orbitButton").addEventListener("click", () =>
    mode === "orbit" ? resetOverview() : setMode("orbit"),
  );
  $("#walkButton").addEventListener("click", () => {
    if (mode !== "walk") setMode("walk");
  });
  $("#exitInteriorButton").addEventListener("click", exitInterior);
  $("#timeButton").addEventListener("click", () => {
    night = !night;
    document.body.classList.toggle("night", night);
    scene.background = colorValue(night ? "#102b3b" : "#dbe7e3");
    scene.fog.color.copy(scene.background);
    scene.userData.sun.intensity = night ? 0.22 : 1.8;
    scene.userData.hemi.intensity = night ? 0.4 : 1.05;
    scene.userData.ambient.intensity = night ? 0.38 : 0.36;
    $("#timeButton").textContent = night ? "☾" : "☼";
    showToast(night ? "夜色模式已开启" : "日光模式已开启");
  });
  $("#qualityButton").addEventListener("click", () => {
    quality = (quality + 1) % 3;
    resize();
    scene.userData.sun.castShadow =
      quality > 0 && !matchMedia("(pointer: coarse)").matches;
    $("#qualityButton").textContent = ["SD", "HD", "UHD"][quality];
    showToast(["流畅画质", "高清画质", "超清画质 · 最高 3 倍渲染"][quality]);
  });
  $("#exportButton").addEventListener("click", () => {
    const w = viewport.clientWidth,
      h = viewport.clientHeight,
      aspect = w / h;
    const exportW = aspect >= 1 ? 3840 : Math.round(3840 * aspect),
      exportH = aspect >= 1 ? Math.round(3840 / aspect) : 3840;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(exportW, exportH, false);
      renderer.render(scene, camera);
      const link = document.createElement("a");
      link.download = `HNU-${selected?.name || "campus"}-${exportW}x${exportH}.png`;
      link.href = renderer.domElement.toDataURL("image/png");
      link.click();
      showToast(`已导出 ${exportW} × ${exportH} 像素视图`);
    } finally {
      resize();
    }
  });
  $("#infoButton").addEventListener("click", () =>
    $("#infoDialog").showModal(),
  );
  sceneLabels.addEventListener("click", (event) => {
    const marker = event.target.closest("[data-label-id]");
    if (!marker) return;
    const poi = landmarks.find((p) => String(p.id) === marker.dataset.labelId);
    if (poi) setSelected(poi);
  });
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        event.code,
      )
    )
      event.preventDefault();
    keys.add(event.code);
    if (event.code === "Slash") {
      event.preventDefault();
      $("#searchInput").focus();
      $("#sidebar").classList.remove("collapsed");
    }
    if (event.code === "Escape" && mode === "interior") exitInterior();
    else if (event.code === "Escape" && mode === "walk") setMode("orbit");
    if (event.code === "KeyE" && mode === "walk" && selected?.interior) {
      const [x, z] = getPosition(selected);
      if (Math.hypot(camera.position.x - x, camera.position.z - z) < 85)
        enterInterior();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());
  viewport.addEventListener("pointerdown", (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
    dragDistance = 0;
  });
  viewport.addEventListener("pointermove", (event) => {
    if (mode !== "walk" && mode !== "interior") {
      if (lastPointer)
        dragDistance += Math.abs(event.movementX) + Math.abs(event.movementY);
      return;
    }
    if (
      document.pointerLockElement === renderer.domElement ||
      (lastPointer && event.buttons)
    ) {
      const dx = document.pointerLockElement
        ? event.movementX
        : event.clientX - lastPointer.x;
      const dy = document.pointerLockElement
        ? event.movementY
        : event.clientY - lastPointer.y;
      yaw -= dx * 0.0033;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0033, -1.35, 1.35);
      if (lastPointer) {
        lastPointer.x = event.clientX;
        lastPointer.y = event.clientY;
      }
    }
  });
  viewport.addEventListener("pointerup", (event) => {
    if (mode === "orbit" && dragDistance < 8) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = (-(event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(campus.pickables, false)[0];
      if (hit) {
        const poi = findPoiForMesh(hit.object.userData.poiId);
        if (poi) setSelected(poi);
      }
    } else if (mode === "walk" || mode === "interior") {
      if (
        !matchMedia("(pointer: coarse)").matches &&
        dragDistance < 8 &&
        document.pointerLockElement !== renderer.domElement
      )
        renderer.domElement
          .requestPointerLock?.()
          ?.catch?.(() => showToast("可直接按住画面拖动环视"));
    }
    lastPointer = null;
  });
  viewport.addEventListener("pointercancel", () => {
    lastPointer = null;
  });
  const joy = $("#joystick"),
    knob = $("#joystickKnob");
  const moveJoy = (event) => {
    const r = joy.getBoundingClientRect(),
      x = event.clientX - r.left - r.width / 2,
      y = event.clientY - r.top - r.height / 2;
    const length = Math.max(1, Math.hypot(x, y)),
      amount = Math.min(1, length / 43);
    joystick.x = (x / length) * amount;
    joystick.y = (y / length) * amount;
    knob.style.transform = `translate(${joystick.x * 42}px,${joystick.y * 42}px)`;
  };
  joy.addEventListener("pointerdown", (event) => {
    joystick.pointerId = event.pointerId;
    joy.setPointerCapture(event.pointerId);
    moveJoy(event);
  });
  joy.addEventListener("pointermove", (event) => {
    if (event.pointerId === joystick.pointerId) moveJoy(event);
  });
  const endJoy = () => {
    joystick.pointerId = null;
    joystick.x = joystick.y = 0;
    knob.style.transform = "";
  };
  joy.addEventListener("pointerup", endJoy);
  joy.addEventListener("pointercancel", endJoy);
  window.addEventListener("resize", resize);
}

function colorValue(hex) {
  return new THREE.Color(hex);
}

function resize() {
  if (!renderer) return;
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  renderer.setPixelRatio(
    Math.min([1, 2, 3][quality], Math.sqrt(9000000 / (w * h))),
  );
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (currentTransition) {
    const t = Math.min(
        1,
        (now - currentTransition.start) / currentTransition.duration,
      ),
      e = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(
      currentTransition.from,
      currentTransition.to,
      e,
    );
    orbit.target.lerpVectors(
      currentTransition.targetFrom,
      currentTransition.targetTo,
      e,
    );
    if (t >= 1) currentTransition = null;
  }
  if (mode === "orbit") orbit.update();
  else updateWalk(dt);
  const north = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion.clone().invert(),
  );
  $("#compass i").style.transform =
    `rotate(${Math.atan2(north.x, north.y)}rad)`;
  const lightingTarget = mode === "orbit" ? orbit.target : camera.position;
  scene.userData.sun.target.position.copy(lightingTarget);
  scene.userData.sun.position
    .copy(lightingTarget)
    .add(new THREE.Vector3(-370, 690, 430));
  updateLabels();
  renderer.render(scene, camera);
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
  } catch (error) {
    $("#loading").innerHTML =
      '<div class="loading-title">无法启动三维场景</div><p>请使用支持 WebGL 的现代浏览器，并尝试开启硬件加速。</p>';
    console.error(error);
    return;
  }
  renderer.setPixelRatio(2);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = !matchMedia("(pointer: coarse)").matches;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = colorValue("#dbe7e3");
  scene.fog = new THREE.FogExp2("#dbe7e3", 0.0001);
  camera = new THREE.PerspectiveCamera(55, 1, 0.08, 12000);
  camera.position.set(335, 600, -65);
  const hemi = new THREE.HemisphereLight("#f3faff", "#697455", 1.05);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight("#ffffff", 0.36);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff2d9", 1.8);
  sun.position.set(-370, 690, 430);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 2500;
  sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target);
  scene.userData = { sun, hemi, ambient };
  campus = createCampus();
  scene.add(campus.group);
  addMappedBuildings(campus.buildings);
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.07;
  orbit.maxPolarAngle = Math.PI * 0.47;
  orbit.minDistance = 25;
  orbit.maxDistance = 6500;
  orbit.target.set(-145, 0, -750);
  orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  orbit.touches.ONE = THREE.TOUCH.ROTATE;
  orbit.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  for (const p of landmarks.filter((item) =>
    [
      272516773,
      307871886,
      54827271,
      272516791,
      1545181609,
      1540099722,
      "grad",
      337142416,
      644418501,
      644677463,
    ].includes(item.id),
  )) {
    const el = document.createElement("button");
    el.className = "map-label";
    el.dataset.labelId = String(p.id);
    el.innerHTML = `<span class="label-pin"></span><strong>${p.name}</strong>`;
    sceneLabels.appendChild(el);
    labels.set(p.id, el);
  }
  renderCategories();
  renderList();
  resize();
  setupEvents();
  requestAnimationFrame(animate);
  document.querySelector('[data-district="north"]').classList.add("active");
  if (window.innerWidth < 760) $("#sidebar").classList.add("collapsed");
  setTimeout(() => $("#loading").classList.add("done"), 750);
}

init();
