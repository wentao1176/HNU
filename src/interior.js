import * as THREE from "three";

const mat = (hex, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: 0.82, ...extra });
const M = {
  floor: mat("#c7bca8"),
  wall: mat("#e8e5d9"),
  ceiling: mat("#faf9f3"),
  trim: mat("#a6a99f"),
  wood: mat("#9f7855"),
  darkWood: mat("#554c43"),
  dark: mat("#35454a"),
  glass: mat("#99bfc8", { roughness: 0.2, metalness: 0.15 }),
  fabric: mat("#517472"),
  light: mat("#fff6cf", { emissive: "#bba975", emissiveIntensity: 0.65 }),
  red: mat("#b56752"),
  green: mat("#547960"),
  metal: mat("#75898c", { metalness: 0.6, roughness: 0.38 }),
};
const sharedMaterials = new Set(Object.values(M));
const sharedTextures = new Set();

function floorTexture(wood = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = wood ? "#bb9467" : "#cec8b7";
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 74831;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6500; i++) {
    ctx.fillStyle = `rgba(${wood ? "81,51,29" : "85,90,83"},${random() * 0.12})`;
    ctx.fillRect(
      random() * 1024,
      random() * 1024,
      wood ? random() * 80 + 15 : 2,
      1,
    );
  }
  ctx.strokeStyle = wood ? "#886b484a" : "#a2a59680";
  ctx.lineWidth = wood ? 2 : 3;
  for (let n = 0; n <= 1024; n += wood ? 128 : 512) {
    ctx.beginPath();
    ctx.moveTo(0, n);
    ctx.lineTo(1024, n);
    ctx.stroke();
    if (!wood) {
      ctx.beginPath();
      ctx.moveTo(n, 0);
      ctx.lineTo(n, 1024);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  texture.anisotropy = 8;
  sharedTextures.add(texture);
  return texture;
}
let stoneMap, woodMap;

function box(group, material, w, h, d, x, y, z, cast = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function sign(group, text, x, y, z, width = 4.5) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#253b40";
  ctx.fillRect(0, 0, 640, 160);
  ctx.fillStyle = "#e9ddc4";
  ctx.font = 'bold 62px "Noto Sans SC",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 320, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  mesh.position.set(x, y, z);
  group.add(mesh);
}

function table(group, x, z, width = 2.2) {
  box(group, M.wood, width, 0.13, 1.1, x, 0.85, z, true);
  for (const dx of [-width / 2 + 0.13, width / 2 - 0.13])
    for (const dz of [-0.42, 0.42])
      box(group, M.metal, 0.09, 0.8, 0.09, x + dx, 0.4, z + dz);
}

function chair(group, x, z, rotation = 0) {
  const part = new THREE.Group();
  part.position.set(x, 0, z);
  part.rotation.y = rotation;
  group.add(part);
  box(part, M.fabric, 0.65, 0.1, 0.63, 0, 0.52, 0);
  box(part, M.fabric, 0.65, 0.7, 0.1, 0, 0.88, 0.3);
  for (const dx of [-0.25, 0.25])
    for (const dz of [-0.22, 0.22])
      box(part, M.metal, 0.06, 0.48, 0.06, dx, 0.24, dz);
}

function lightFixtures(group, width, depth, height) {
  for (let z = -depth / 2 + 4; z < depth / 2 - 1; z += 6)
    for (const x of [-width / 4, width / 4]) {
      box(group, M.light, 2.8, 0.07, 0.65, x, height - 0.14, z);
    }
}

function shell(group, width, depth, height, style = "modern") {
  const isHeritage = style === "heritage";
  const wall = isHeritage ? mat("#e4d1b0") : M.wall;
  const floor = isHeritage ? mat("#9c886f") : M.floor;
  box(group, floor, width, 0.25, depth, 0, -0.14, 0);
  box(group, M.ceiling, width, 0.24, depth, 0, height + 0.12, 0);
  box(group, wall, width, height, 0.28, 0, height / 2, -depth / 2);
  box(group, wall, 0.3, height, depth, -width / 2, height / 2, 0);
  box(group, wall, 0.3, height, depth, width / 2, height / 2, 0);
  box(
    group,
    wall,
    width / 2 - 1.15,
    height,
    0.28,
    -width / 4 - 0.57,
    height / 2,
    depth / 2,
  );
  box(
    group,
    wall,
    width / 2 - 1.15,
    height,
    0.28,
    width / 4 + 0.57,
    height / 2,
    depth / 2,
  );
  box(group, wall, 2.3, height - 3.35, 0.28, 0, (height + 3.35) / 2, depth / 2);
  box(group, M.dark, 2.4, 0.2, 0.38, 0, 3.42, depth / 2 - 0.01);
  box(group, M.trim, width, 0.22, 0.24, 0, 0.15, -depth / 2 + 0.18);
  for (const sx of [-1, 1]) {
    for (let z = -depth / 2 + 3.5; z < depth / 2 - 2; z += 6) {
      const window = box(
        group,
        M.glass,
        0.1,
        2.6,
        3.6,
        sx * (width / 2 - 0.18),
        height * 0.57,
        z,
      );
      window.material = M.glass;
      box(
        group,
        M.trim,
        0.17,
        0.1,
        3.8,
        sx * (width / 2 - 0.13),
        height * 0.57,
        z,
      );
      box(
        group,
        M.trim,
        0.17,
        2.7,
        0.08,
        sx * (width / 2 - 0.13),
        height * 0.57,
        z,
      );
    }
  }
  lightFixtures(group, width, depth, height);
  sign(group, "出口  EXIT", 0, height - 0.65, depth / 2 - 0.16, 2.8);
  const exitGlow = new THREE.PointLight("#b9e6cf", 0.8, 7);
  exitGlow.position.set(0, 2.7, depth / 2 - 1);
  group.add(exitGlow);
}

function classroom(group, w, d) {
  box(group, M.dark, 11, 3.2, 0.16, 0, 3.05, -d / 2 + 0.26);
  box(group, M.wood, 3.7, 1.3, 1.4, 0, 0.65, -d / 2 + 2.1);
  for (let row = 0; row < 4; row++)
    for (const x of [-5, 0, 5]) {
      const z = -d / 2 + 6 + row * 4.3;
      table(group, x, z, 3.6);
      chair(group, x - 0.95, z + 1.2, Math.PI);
      chair(group, x + 0.95, z + 1.2, Math.PI);
    }
  sign(group, "湖南大学 · 课堂空间", 0, 5.15, -d / 2 + 0.19, 6.2);
}

function library(group, w, d) {
  const colors = [
    mat("#c06f5f"),
    mat("#d9b177"),
    mat("#6e8180"),
    mat("#8e7769"),
    mat("#78906e"),
  ];
  for (const x of [-7, -2.5, 2.5, 7])
    for (const z of [-7.5, -1.5, 4.5]) {
      box(group, M.darkWood, 2.7, 3.7, 0.55, x, 1.86, z);
      for (let shelf = 0; shelf < 4; shelf++) {
        box(group, M.wood, 2.8, 0.1, 0.75, x, 0.48 + shelf * 0.9, z);
        for (let book = 0; book < 9; book++) {
          const color =
            colors[((book + shelf + Math.abs(x)) % colors.length) | 0];
          box(
            group,
            color,
            0.18,
            0.58 + (book % 3) * 0.06,
            0.42,
            x - 1.08 + book * 0.26,
            0.83 + shelf * 0.9,
            z,
          );
        }
      }
    }
  table(group, 0, 9, 5);
  for (const x of [-2, 0, 2]) chair(group, x, 10.5, Math.PI);
  sign(group, "阅见千年", 0, 5.25, -d / 2 + 0.18, 4.5);
}

function dorm(group, w, d) {
  const loft = (x, z) => {
    const side = x < 0 ? -1 : 1;
    box(group, M.wood, 3.2, 0.2, 2, x, 2.15, z, true);
    box(group, M.fabric, 2.95, 0.25, 1.8, x, 2.37, z);
    for (const dx of [-1.42, 1.42])
      for (const dz of [-0.84, 0.84])
        box(group, M.metal, 0.1, 2.2, 0.1, x + dx, 1.1, z + dz);
    box(group, M.metal, 3.2, 0.08, 0.08, x, 2.85, z + 1.02);
    table(group, x, z, 2.7);
    chair(group, x, z + 1.25, Math.PI);
    box(group, M.wood, 0.7, 1.8, 1.05, x + side * 2, 0.9, z - 0.45);
  };
  for (const x of [-5.5, 5.5]) for (const z of [-5.5, 2.5]) loft(x, z);
  box(group, M.green, 2.4, 0.09, 3.2, 0, 0.05, -4);
  box(group, M.wood, 4, 2.3, 0.8, 0, 1.15, -d / 2 + 1.1);
  sign(group, "天马 · 德智 生活空间", 0, 5.2, -d / 2 + 0.18, 5.2);
}

function canteen(group, w, d) {
  for (const x of [-6, 0, 6])
    for (const z of [-5, 0, 5, 10]) {
      table(group, x, z, 3);
      chair(group, x - 1, z + 1.15, Math.PI);
      chair(group, x + 1, z + 1.15, Math.PI);
    }
  box(group, M.wood, w - 4, 1.15, 1.5, 0, 0.58, -d / 2 + 2);
  box(group, M.metal, w - 4, 0.12, 1.6, 0, 1.17, -d / 2 + 2);
  for (const x of [-6, 0, 6])
    sign(
      group,
      ["风味窗口", "湖湘味道", "每日新鲜"][(x + 6) / 6],
      x,
      3.4,
      -d / 2 + 0.2,
      3.6,
    );
}

function gym(group, w, d) {
  woodMap ||= floorTexture(true);
  box(group, mat("#ffffff", { map: woodMap }), w - 3, 0.03, d - 3, 0, 0.02, 0);
  const mark = mat("#fff0d4");
  box(group, mark, w - 5, 0.04, 0.08, 0, 0.07, 0);
  for (const x of [-w / 2 + 2.5, w / 2 - 2.5])
    box(group, mark, 0.08, 0.04, d - 5, x, 0.07, 0);
  const ring = (x, z, radius) => {
    const geometry = new THREE.RingGeometry(radius - 0.045, radius + 0.045, 64);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, mark);
    mesh.position.set(x, 0.08, z);
    group.add(mesh);
  };
  ring(0, 0, 2.4);
  for (const z of [-d / 2 + 7, d / 2 - 7]) {
    ring(0, z, 3);
    box(group, mark, 6, 0.04, 0.08, 0, 0.07, z);
    for (const x of [-3, 3])
      box(group, mark, 0.08, 0.04, 4.5, x, 0.07, z > 0 ? z + 2.25 : z - 2.25);
  }
  for (const z of [-d / 2 + 6, d / 2 - 6]) {
    box(group, mark, w - 5, 0.04, 0.08, 0, 0.08, z);
    box(
      group,
      M.metal,
      0.15,
      5,
      0.15,
      0,
      2.5,
      z > 0 ? d / 2 - 1.6 : -d / 2 + 1.6,
    );
    box(
      group,
      M.glass,
      2.8,
      1.8,
      0.08,
      0,
      5,
      z > 0 ? d / 2 - 1.65 : -d / 2 + 1.65,
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.045, 8, 24),
      M.red,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 4, z > 0 ? d / 2 - 2.2 : -d / 2 + 2.2);
    group.add(ring);
  }
  for (const sx of [-1, 1])
    for (let i = 0; i < 4; i++)
      box(
        group,
        M.fabric,
        0.7,
        0.4,
        d - 7,
        sx * (w / 2 - 1.3 - i * 0.72),
        0.22 + i * 0.4,
        0,
      );
  sign(group, "运动不息", 0, 8.7, -d / 2 + 0.2, 4.8);
}

function hall(group, w, d) {
  box(group, M.darkWood, w - 3, 0.45, 5, 0, 0.22, -d / 2 + 2.6);
  box(group, M.red, w - 3, 3.2, 0.2, 0, 3.6, -d / 2 + 0.3);
  for (let row = 0; row < 6; row++)
    for (let col = -5; col <= 5; col++)
      chair(group, col * 1.38, -d / 2 + 7 + row * 2.55, Math.PI);
  sign(group, "惟楚有材 · 于斯为盛", 0, 5.15, -d / 2 + 0.45, 7.5);
}

export function createInterior(type = "study") {
  stoneMap ||= floorTexture();
  M.floor.map = stoneMap;
  M.floor.needsUpdate = true;
  const kind = type === "study" ? "classroom" : type;
  const isGym = kind === "gym",
    w = isGym ? 30 : 22,
    d = isGym ? 42 : 28,
    h = isGym ? 10 : 6;
  const group = new THREE.Group();
  shell(group, w, d, h, kind === "hall" ? "heritage" : "modern");
  ({ classroom, library, dorm, canteen, gym, hall })[kind]?.(group, w, d);
  const ambient = new THREE.PointLight("#fff5df", isGym ? 45 : 30, 38, 2);
  ambient.position.set(0, h - 1, 0);
  group.add(ambient);
  const dispose = () => {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : []) {
        if (!sharedMaterials.has(material)) {
          materials.add(material);
          if (material.map && !sharedTextures.has(material.map))
            textures.add(material.map);
        }
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  };
  return {
    group,
    width: w,
    depth: d,
    height: h,
    spawn: new THREE.Vector3(0, 1.72, d / 2 - 3.5),
    dispose,
  };
}
