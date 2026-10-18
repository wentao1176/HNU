import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import campus from "./data/campus.json";
import { centroid, pointInPolygon, seeded } from "./geo.js";

const rand = seeded(120427);
const buildingById = new Map(campus.buildings.map((b) => [b.id, b]));
const areaById = new Map(
  [...campus.zones, ...campus.areas].map((a) => [a.id, a]),
);
const GRAD_IDS = new Set([1150591611, 1150591612, 1150591613, 1150591614]);
const HERITAGE_IDS = new Set([
  337142416, 272516790, 1544616076, 1544616077, 1544616078, 1544616081,
  1544638581, 1544638585, 1544638586, 1544638594, 1544638595, 1544638596,
  1544638610,
]);
const academy = areaById.get(272516791);

function color(hex) {
  return new THREE.Color(hex);
}

function shapeFrom(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) =>
    i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
  );
  shape.closePath();
  return shape;
}

function flatPolygon(points, material, y = 0, userData = null) {
  const geometry = new THREE.ShapeGeometry(shapeFrom(points));
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  if (userData) mesh.userData = userData;
  return mesh;
}

function makeFacadeTexture(style) {
  const palette = {
    glass: ["#acc8d0", "#244f5d", "#d1e8e8", "#78979f"],
    grad: ["#c9ad8c", "#293e48", "#e5d3b9", "#a28568"],
    campus: ["#d8d3bd", "#42636a", "#f1ead7", "#aaa894"],
    brick: ["#bd8870", "#364b56", "#ecd4b7", "#986650"],
    dorm: ["#e1cfad", "#536973", "#f2e8d2", "#ae8f6e"],
    heritage: ["#ddc5a0", "#3c4141", "#f2dfbd", "#9b7d5d"],
    other: ["#c8c8b7", "#49606a", "#e5e4d7", "#969887"],
  }[style];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.scale(4, 4);
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) {
    const v = rand() > 0.5 ? 255 : 20;
    ctx.fillStyle = `rgba(${v},${v},${v},${rand() * 0.09})`;
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  if (style === "glass") {
    const g = ctx.createLinearGradient(35, 0, 215, 256);
    g.addColorStop(0, "#2f6570");
    g.addColorStop(0.47, "#a9c7cd");
    g.addColorStop(1, "#173a48");
    ctx.fillStyle = g;
    ctx.fillRect(14, 14, 228, 224);
    ctx.fillStyle = "rgba(233,249,245,.34)";
    ctx.beginPath();
    ctx.moveTo(80, 14);
    ctx.lineTo(132, 14);
    ctx.lineTo(72, 238);
    ctx.lineTo(26, 238);
    ctx.fill();
    ctx.fillStyle = "#d5dfd9";
    ctx.fillRect(0, 0, 9, 256);
    ctx.fillRect(247, 0, 9, 256);
    ctx.fillRect(0, 122, 256, 9);
    ctx.fillStyle = "#849da0";
    ctx.fillRect(0, 247, 256, 9);
  } else {
    ctx.fillStyle = palette[3];
    ctx.fillRect(0, 0, 256, 12);
    ctx.fillRect(0, 238, 256, 18);
    if (style === "brick") {
      ctx.strokeStyle = "rgba(250,227,201,.22)";
      ctx.lineWidth = 2;
      for (let y = 16; y < 240; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(52,49,42,.30)";
    ctx.fillRect(40, 39, 178, 164);
    ctx.fillStyle = palette[2];
    ctx.fillRect(34, 31, 178, 164);
    const g = ctx.createLinearGradient(45, 40, 205, 200);
    g.addColorStop(0, palette[1]);
    g.addColorStop(0.52, "#76939a");
    g.addColorStop(1, "#1d3947");
    ctx.fillStyle = g;
    ctx.fillRect(46, 43, 154, 148);
    ctx.fillStyle = "rgba(225,244,238,.34)";
    ctx.beginPath();
    ctx.moveTo(76, 44);
    ctx.lineTo(102, 44);
    ctx.lineTo(64, 190);
    ctx.lineTo(48, 190);
    ctx.fill();
    ctx.fillStyle = palette[2];
    ctx.fillRect(119, 43, 7, 148);
    ctx.fillRect(46, 112, 154, 7);
    if (style === "dorm") {
      ctx.fillStyle = "#8d9b9a";
      ctx.fillRect(20, 192, 218, 8);
      ctx.fillStyle = "#c1b5a0";
      ctx.fillRect(22, 200, 6, 31);
      ctx.fillRect(230, 200, 6, 31);
    }
    if (style === "heritage") {
      ctx.fillStyle = "#6b5142";
      ctx.fillRect(0, 25, 256, 7);
      ctx.fillRect(0, 216, 256, 9);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildingStyle(b) {
  if (b.id === 272516773) return "glass";
  if (GRAD_IDS.has(b.id)) return "grad";
  if (
    HERITAGE_IDS.has(b.id) ||
    pointInPolygon(centroid(b.points), academy.points)
  )
    return "heritage";
  if (b.id === 307871886) return "brick";
  if (
    campus.zones
      .slice(1)
      .some((z) => pointInPolygon(centroid(b.points), z.points)) ||
    /dormitory|apartments|residential/.test(b.kind)
  )
    return "dorm";
  if (b.kind === "university" || b.kind === "school") return "campus";
  return "other";
}

function buildingHeight(b, style) {
  if (b.id === 54827271) return 13;
  if (b.id === 272516773) return 17;
  if (GRAD_IDS.has(b.id)) return 15;
  if (style === "heritage") return b.id === 337142416 ? 13 : 7.2;
  if (b.levels) return Math.min(12, Number(b.levels)) * 3.4;
  if (style === "dorm") return 17 + (b.id % 3) * 2.7;
  if (style === "campus") return 15 + (b.id % 3) * 2;
  return 9 + (b.id % 4) * 2;
}

function wallGeometry(points, height) {
  const vertices =
    points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]
      ? points.slice(0, -1)
      : points;
  const positions = [],
    uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.35) continue;
    const u = Math.max(1, Math.round(length / 3.6)),
      v = Math.max(1, Math.round(height / 3.4));
    positions.push(
      a[0],
      0,
      a[1],
      b[0],
      0,
      b[1],
      b[0],
      height,
      b[1],
      a[0],
      0,
      a[1],
      b[0],
      height,
      b[1],
      a[0],
      height,
      a[1],
    );
    uvs.push(0, 0, u, 0, u, v, 0, 0, u, v, 0, v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function edgeLines(points, height, colorValue, group, levels = 0) {
  const vertices = points.slice(0, -1),
    coords = [];
  const ys = levels
    ? Array.from({ length: levels + 1 }, (_, i) => (i * height) / levels)
    : [height];
  for (const y of ys)
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i],
        b = vertices[(i + 1) % vertices.length];
      coords.push(a[0], y + 0.05, a[1], b[0], y + 0.05, b[1]);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3));
  group.add(
    new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: colorValue,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  );
}

function gableRoof(b, height, group) {
  const p = b.points.slice(0, -1),
    xs = p.map((v) => v[0]),
    zs = p.map((v) => v[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs);
  if (Math.max(x1 - x0, z1 - z0) > 90) return;
  const longX = x1 - x0 >= z1 - z0,
    peak = height + 2.5;
  const a = [x0 - 0.6, height, z0 - 0.6],
    b0 = [x1 + 0.6, height, z0 - 0.6];
  const c = [x1 + 0.6, height, z1 + 0.6],
    d = [x0 - 0.6, height, z1 + 0.6];
  const r0 = longX
    ? [x0 - 0.6, peak, (z0 + z1) / 2]
    : [(x0 + x1) / 2, peak, z0 - 0.6];
  const r1 = longX
    ? [x1 + 0.6, peak, (z0 + z1) / 2]
    : [(x0 + x1) / 2, peak, z1 + 0.6];
  const tri = longX
    ? [
        ...a,
        ...b0,
        ...r1,
        ...a,
        ...r1,
        ...r0,
        ...d,
        ...r0,
        ...r1,
        ...d,
        ...r1,
        ...c,
      ]
    : [
        ...a,
        ...d,
        ...r1,
        ...a,
        ...r1,
        ...r0,
        ...b0,
        ...r0,
        ...r1,
        ...b0,
        ...r1,
        ...c,
      ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3));
  geo.computeVertexNormals();
  group.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: "#475852",
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    ),
  );
}

function addEntrance(group, b, h) {
  const p = b.points.slice(0, -1);
  let longest = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      c = p[(i + 1) % p.length],
      length = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (!longest || length > longest.length) longest = { a, c, length };
  }
  if (!longest || longest.length < 8) return;
  const x = (longest.a[0] + longest.c[0]) / 2,
    z = (longest.a[1] + longest.c[1]) / 2;
  const angle = Math.atan2(
    longest.c[1] - longest.a[1],
    longest.c[0] - longest.a[0],
  );
  const center = centroid(b.points),
    nx = -Math.sin(angle),
    nz = Math.cos(angle);
  const outward = (x - center[0]) * nx + (z - center[1]) * nz > 0 ? 0 : Math.PI;
  const dark = new THREE.MeshStandardMaterial({
    color: "#253f47",
    roughness: 0.35,
    metalness: 0.26,
  });
  const frame = new THREE.MeshStandardMaterial({
    color: "#e8dfcc",
    roughness: 0.7,
  });
  const doorway = new THREE.Group();
  doorway.position.set(x, 0, z);
  doorway.rotation.y = -angle + outward;
  const door = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.8, 0.18), dark);
  door.position.set(0, 1.9, 0);
  doorway.add(door);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.4, 3), frame);
  canopy.position.set(0, 4.25, 1.25);
  canopy.castShadow = true;
  doorway.add(canopy);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4, 0.35), frame);
    pillar.position.set(side * 3.8, 2, 2.35);
    doorway.add(pillar);
  }
  for (let step = 0; step < 3; step++) {
    const stair = new THREE.Mesh(
      new THREE.BoxGeometry(5.8 + step * 0.55, 0.14, 0.8),
      frame,
    );
    stair.position.set(0, 0.09 + (2 - step) * 0.12, 2.25 + step * 0.65);
    doorway.add(stair);
  }
  group.add(doorway);
}

function makeGymRoof(b, height, group) {
  const p = b.points,
    xs = p.map((v) => v[0]),
    zs = p.map((v) => v[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs);
  const pos = [],
    idx = [];
  for (let j = 0; j <= 12; j++) {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pos.push(
        x0 + t * (x1 - x0),
        height + 1.5 + Math.sin(Math.PI * t) * 4.5,
        z0 + (j / 12) * (z1 - z0),
      );
    }
  }
  for (let j = 0; j < 12; j++)
    for (let i = 0; i < 24; i++) {
      const a = j * 25 + i,
        c = a + 25;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const canopy = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: "#e9ece9",
      metalness: 0.37,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  canopy.castShadow = true;
  group.add(canopy);
  for (let j = 0; j <= 12; j += 3) {
    const rib = [],
      z = z0 + (j / 12) * (z1 - z0);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      rib.push(
        x0 + t * (x1 - x0),
        height + 1.62 + Math.sin(Math.PI * t) * 4.5,
        z,
      );
    }
    const line = new THREE.BufferGeometry();
    line.setAttribute("position", new THREE.Float32BufferAttribute(rib, 3));
    group.add(
      new THREE.Line(line, new THREE.LineBasicMaterial({ color: "#71868b" })),
    );
  }
}

function addArchitecturalDepth(group, buildings) {
  const trim = [],
    metal = [];
  const featured = new Set([272516773, 307871886, 272516776, ...GRAD_IDS]);
  const addBox = (list, width, height, depth, x, y, z, rotation) => {
    const g = new THREE.BoxGeometry(width, height, depth);
    g.rotateY(rotation);
    g.translate(x, y, z);
    list.push(g);
  };
  for (const b of buildings) {
    if (!featured.has(b.id) && !(b.style === "dorm" && b.id % 4 === 0))
      continue;
    const points = b.points.slice(0, -1),
      center = b.center;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        c = points[(i + 1) % points.length],
        length = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (length < 8) continue;
      const angle = Math.atan2(c[1] - a[1], c[0] - a[0]);
      let nx = -Math.sin(angle),
        nz = Math.cos(angle);
      const x = (a[0] + c[0]) / 2,
        z = (a[1] + c[1]) / 2;
      if ((x - center[0]) * nx + (z - center[1]) * nz < 0) {
        nx *= -1;
        nz *= -1;
      }
      const floors = Math.max(1, Math.round(b.height / 3.4));
      for (let floor = 1; floor <= floors; floor++) {
        addBox(
          trim,
          length + 0.2,
          0.18,
          b.style === "dorm" ? 1 : 0.65,
          x + nx * 0.25,
          (floor / floors) * b.height,
          z + nz * 0.25,
          -angle,
        );
      }
      if (b.style === "glass" || b.style === "grad") {
        const count = Math.floor(length / 6);
        for (let j = 1; j <= count; j++) {
          const t = j / (count + 1);
          addBox(
            metal,
            0.22,
            b.height + 0.35,
            0.85,
            a[0] + (c[0] - a[0]) * t + nx * 0.22,
            b.height / 2,
            a[1] + (c[1] - a[1]) * t + nz * 0.22,
            -angle,
          );
        }
      }
    }
    if (pointInPolygon(center, b.points) && featured.has(b.id)) {
      addBox(metal, 3, 0.85, 2, center[0], b.height + 0.45, center[1], 0);
    }
  }
  for (const [parts, tint] of [
    [trim, "#d4cbb5"],
    [metal, "#839599"],
  ]) {
    if (!parts.length) continue;
    const geometry = mergeGeometries(parts, false);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: tint,
        roughness: 0.7,
        metalness: 0.15,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    parts.forEach((g) => g.dispose());
  }
}

function roadGeometry(roads) {
  const vertices = [];
  for (const road of roads) {
    const width =
      road.kind === "primary"
        ? 13
        : road.kind === "secondary"
          ? 9
          : road.kind === "tertiary"
            ? 7
            : road.kind === "residential"
              ? 5
              : 2.6;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i],
        b = road.points[i + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 0.15) continue;
      const nx = ((dz / length) * width) / 2,
        nz = ((-dx / length) * width) / 2;
      vertices.push(
        a[0] - nx,
        0.16,
        a[1] - nz,
        b[0] - nx,
        0.16,
        b[1] - nz,
        b[0] + nx,
        0.16,
        b[1] + nz,
        a[0] - nx,
        0.16,
        a[1] - nz,
        b[0] + nx,
        0.16,
        b[1] + nz,
        a[0] + nx,
        0.16,
        a[1] + nz,
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

function addStadium(group, area) {
  const xs = area.points.map((p) => p[0]),
    zs = area.points.map((p) => p[1]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2;
  const rx = Math.min(80, (Math.max(...xs) - Math.min(...xs)) * 0.48),
    rz = Math.min(115, (Math.max(...zs) - Math.min(...zs)) * 0.48);
  const earth = new THREE.Mesh(
    new THREE.CircleGeometry(1, 80),
    new THREE.MeshStandardMaterial({ color: "#b65d4e", roughness: 1 }),
  );
  earth.scale.set(rx, rz, 1);
  earth.rotation.x = -Math.PI / 2;
  earth.position.set(x, 0.36, z);
  group.add(earth);
  const field = new THREE.Mesh(
    new THREE.CircleGeometry(1, 80),
    new THREE.MeshStandardMaterial({ color: "#4e815b", roughness: 1 }),
  );
  field.scale.set(rx * 0.65, rz * 0.77, 1);
  field.rotation.x = -Math.PI / 2;
  field.position.set(x, 0.39, z);
  group.add(field);
  for (let lane = 0; lane < 5; lane++) {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          x + Math.cos(a) * (rx - 3.5 - lane * 2.2),
          0.42,
          z + Math.sin(a) * (rz - 3.5 - lane * 2.2),
        ),
      );
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: "#f9e3c4",
          transparent: true,
          opacity: 0.86,
        }),
      ),
    );
  }
  const centerLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x - rx * 0.55, 0.43, z),
    new THREE.Vector3(x + rx * 0.55, 0.43, z),
  ]);
  group.add(
    new THREE.Line(
      centerLine,
      new THREE.LineBasicMaterial({ color: "#dfebd8" }),
    ),
  );
}

function addTrees(group, buildings) {
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }),
    880,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.3, 1, 7),
    new THREE.MeshStandardMaterial({ color: "#79674c", roughness: 1 }),
    880,
  );
  const dummy = new THREE.Object3D();
  let count = 0,
    tries = 0;
  const zones = campus.zones;
  const noTrees = campus.areas.filter((area) =>
    [
      272514061, 585142566, 586904398, 272516772, 153312635, 404043864,
      586904395, 586904437, 1019024282,
    ].includes(area.id),
  );
  const roadSegments = campus.roads.flatMap((road) =>
    road.points.slice(1).map((b, i) => {
      const a = road.points[i],
        width = ["primary", "secondary"].includes(road.kind)
          ? 7.5
          : road.kind === "tertiary"
            ? 5
            : 3.5;
      return { a, b, width };
    }),
  );
  while (count < 880 && tries++ < 30000) {
    const north = count >= 680;
    const x = north ? -1800 + rand() * 850 : -750 + rand() * 1300;
    const z = north ? -3520 + rand() * 1000 : -1400 + rand() * 2700;
    const inCampus = zones.some((zone) => pointInPolygon([x, z], zone.points));
    const hillside = !north && x < -520 && rand() < 0.88;
    if (!inCampus && !hillside) continue;
    if (
      noTrees.some((area) => {
        if ([272514061, 585142566, 586904398].includes(area.id)) {
          return (
            x > Math.min(...area.points.map((p) => p[0])) - 4 &&
            x < Math.max(...area.points.map((p) => p[0])) + 4 &&
            z > Math.min(...area.points.map((p) => p[1])) - 4 &&
            z < Math.max(...area.points.map((p) => p[1])) + 4
          );
        }
        return pointInPolygon([x, z], area.points);
      })
    )
      continue;
    if (
      roadSegments.some(({ a, b, width }) => {
        if (
          x < Math.min(a[0], b[0]) - width ||
          x > Math.max(a[0], b[0]) + width ||
          z < Math.min(a[1], b[1]) - width ||
          z > Math.max(a[1], b[1]) + width
        )
          return false;
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          length = dx * dx + dz * dz;
        const t = length
          ? Math.max(
              0,
              Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length),
            )
          : 0;
        return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < width;
      })
    )
      continue;
    if (
      buildings.some(
        (b) =>
          Math.abs(b.center[0] - x) < b.radius + 3 &&
          Math.abs(b.center[1] - z) < b.radius + 3 &&
          pointInPolygon([x, z], b.points),
      )
    )
      continue;
    const scale = hillside ? 2.6 + rand() * 2.2 : 2.5 + rand() * 2.6;
    const elevation = hillsideHeight(x, z);
    dummy.position.set(x, elevation + scale * 0.7 + 1.5, z);
    dummy.scale.set(scale, scale * (1.15 + rand() * 0.4), scale);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    crowns.setMatrixAt(count, dummy.matrix);
    crowns.setColorAt(
      count,
      color(
        ["#6f9365", "#839e6e", "#5f875f", "#8b9b69"][Math.floor(rand() * 4)],
      ),
    );
    dummy.position.set(x, elevation + 1.7, z);
    dummy.scale.set(1, 3.4, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(count, dummy.matrix);
    count++;
  }
  crowns.count = trunks.count = count;
  crowns.castShadow = false;
  trunks.castShadow = false;
  group.add(crowns, trunks);
}

function hillsideHeight(x, z) {
  if (z < -1450 || z > 1450) return 0;
  const rise = Math.max(0, Math.min(1, (-x - 760) / 840));
  const taper = Math.max(0, Math.min(1, (z + 1450) / 200, (1450 - z) / 200));
  return (
    Math.pow(rise, 1.7) *
    taper *
    (250 + Math.sin(z * 0.006) * 36 + Math.cos(z * 0.011) * 17)
  );
}

function addHillside(group) {
  const nx = 44,
    nz = 60,
    positions = [],
    indices = [];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = -1600 + (i / nx) * 840,
        z = -1450 + (j / nz) * 2900;
      positions.push(x, hillsideHeight(x, z), z);
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i,
        b = a + nx + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: "#66845f",
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  mesh.receiveShadow = true;
  group.add(mesh);
}

export function createCampus() {
  const group = new THREE.Group();
  const pickables = [];
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 6500),
    new THREE.MeshStandardMaterial({ color: "#829779", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-400, -0.12, -1100);
  ground.receiveShadow = true;
  group.add(ground);
  addHillside(group);
  const zoneMaterials = [
    new THREE.MeshStandardMaterial({ color: "#acb79a", roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: "#aab69d", roughness: 1 }),
  ];
  for (const [i, zone] of campus.zones.entries()) {
    const patch = flatPolygon(zone.points, zoneMaterials[i ? 1 : 0], -0.03, {
      poiId: zone.id,
    });
    group.add(patch);
    pickables.push(patch);
  }
  for (const area of campus.areas) {
    if ([272514061, 585142566, 586904398].includes(area.id)) continue;
    const kind = [
      272516772, 153312635, 404043864, 586904395, 586904437, 1019024282,
    ].includes(area.id)
      ? "water"
      : "land";
    const mat = new THREE.MeshStandardMaterial({
      color:
        kind === "water"
          ? "#6da7b1"
          : area.id === 272516791
            ? "#c8bea3"
            : "#89a782",
      roughness: kind === "water" ? 0.32 : 1,
      metalness: kind === "water" ? 0.1 : 0,
      side: THREE.DoubleSide,
    });
    const mesh = flatPolygon(area.points, mat, 0.2, { poiId: area.id });
    group.add(mesh);
    pickables.push(mesh);
  }
  const vehicleRoads = campus.roads.filter(
    (r) => !["footway", "path", "pedestrian", "cycleway"].includes(r.kind),
  );
  const paths = campus.roads.filter((r) =>
    ["footway", "path", "pedestrian", "cycleway"].includes(r.kind),
  );
  group.add(
    new THREE.Mesh(
      roadGeometry(vehicleRoads),
      new THREE.MeshStandardMaterial({
        color: "#788382",
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    ),
  );
  group.add(
    new THREE.Mesh(
      roadGeometry(paths),
      new THREE.MeshStandardMaterial({
        color: "#c8c5ae",
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    ),
  );
  for (const area of campus.areas.filter((a) =>
    [272514061, 585142566, 586904398].includes(a.id),
  )) {
    addStadium(group, area);
    const proxy = flatPolygon(
      area.points,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      0.46,
      { poiId: area.id },
    );
    group.add(proxy);
    pickables.push(proxy);
  }
  const textures = Object.fromEntries(
    ["glass", "grad", "campus", "brick", "dorm", "heritage", "other"].map(
      (s) => [s, makeFacadeTexture(s)],
    ),
  );
  const wallMaterials = Object.fromEntries(
    Object.entries(textures).map(([s, map]) => [
      s,
      new THREE.MeshStandardMaterial({
        map,
        roughness: s === "glass" ? 0.38 : 0.88,
        metalness: s === "glass" ? 0.2 : 0,
        side: THREE.DoubleSide,
      }),
    ]),
  );
  const roofMaterials = Object.fromEntries(
    Object.entries({
      glass: "#a4b9bc",
      grad: "#c7ac8d",
      campus: "#c2c2ae",
      brick: "#aa816f",
      dorm: "#b4a990",
      heritage: "#65685b",
      other: "#a8aca1",
    }).map(([s, c]) => [
      s,
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.91,
        side: THREE.DoubleSide,
      }),
    ]),
  );
  const buildings = [];
  for (const b of campus.buildings) {
    const style = buildingStyle(b),
      h = buildingHeight(b, style),
      c = centroid(b.points);
    const radius = Math.max(
      ...b.points.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])),
    );
    const walls = new THREE.Mesh(
      wallGeometry(b.points, h),
      wallMaterials[style],
    );
    walls.userData = { poiId: b.id };
    walls.castShadow = [272516773, 307871886, 54827271, 337142416].includes(
      b.id,
    );
    group.add(walls);
    pickables.push(walls);
    const roof = flatPolygon(b.points, roofMaterials[style], h, {
      poiId: b.id,
    });
    group.add(roof);
    pickables.push(roof);
    const featured =
      [
        272516773, 307871886, 54827271, 337142416, 272516790, 272516776,
      ].includes(b.id) || GRAD_IDS.has(b.id);
    if (featured) {
      edgeLines(
        b.points,
        h,
        style === "glass" ? "#eaf1ec" : "#ece0c8",
        group,
        style === "glass" ? 5 : 0,
      );
      addEntrance(group, b, h);
      if (b.id === 54827271) makeGymRoof(b, h, group);
    }
    if (
      style === "heritage" &&
      (HERITAGE_IDS.has(b.id) || pointInPolygon(c, academy.points))
    )
      gableRoof(b, h, group);
    buildings.push({ ...b, center: c, radius, height: h, style });
  }
  addArchitecturalDepth(group, buildings);
  addTrees(group, buildings);
  return {
    group,
    pickables,
    buildings,
    buildingById,
    areaById,
    campus,
    heightAt: hillsideHeight,
  };
}
