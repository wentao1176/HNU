/**
 * 水体：池塘、曲涧
 */
import * as THREE from 'three';
import { fbm, makeCanvas, tileNoise, mulberry32 } from '../gfx/noise.js';
import { merge, box, place } from '../gfx/geometry.js';
import { MAT, COVER } from '../gfx/materials.js';

/** 水波法线贴图 */
function waterNormal(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = fbm(u, v, 4, 4, 601);
      const n2 = fbm(u * 2, v * 2, 8, 3, 733);
      h[y * size + x] = n1 * 0.7 + n2 * 0.3;
    }
  }
  const at = (x, y) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = at(x - 1, y) - at(x + 1, y);
      const dy = at(x, y - 1) - at(x, y + 1);
      const nx = dx * 3.2, ny = dy * 3.2, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

let _normal = null;
const _maps = [];

export function createPond({ w = 20, d = 14, depth = 0.9, stone = true } = {}) {
  const g = new THREE.Group();

  // 池底（贴地，透过半透水面呈深色）
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x23261f, roughness: 1 }),
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 0.015;
  bed.receiveShadow = true;
  g.add(bed);

  // 水面（略高于地形，避免被台地盖住）
  if (!_normal) _normal = waterNormal(256);
  const nrm = _normal.clone();
  nrm.needsUpdate = true;
  nrm.repeat.set(w / 5, d / 5);
  const mat = MAT.water.clone();
  mat.normalMap = nrm;
  mat.normalScale = new THREE.Vector2(0.28, 0.28);
  mat.color.setHex(0x27423e);
  mat.opacity = 0.94;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.06;
  water.receiveShadow = true;
  g.add(water);
  g.userData.water = water;
  _maps.push(nrm);

  // 石岸（高出地面一圈）
  if (stone) {
    const geos = [];
    const t = 0.45;
    geos.push(place(box(w + t * 2, 0.5, t, COVER.granite), { z: d / 2 + t / 2, y: 0.03 }));
    geos.push(place(box(w + t * 2, 0.5, t, COVER.granite), { z: -d / 2 - t / 2, y: 0.03 }));
    geos.push(place(box(t, 0.5, d, COVER.granite), { x: w / 2 + t / 2, y: 0.03 }));
    geos.push(place(box(t, 0.5, d, COVER.granite), { x: -w / 2 - t / 2, y: 0.03 }));
    const m = new THREE.Mesh(merge(geos), MAT.granite);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  return g;
}

export function updateWater(t) {
  for (const m of _maps) {
    m.offset.x = t * 0.006;
    m.offset.y = t * 0.004;
  }
}
