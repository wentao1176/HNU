/**
 * PBR 材质库
 * 所有贴图以「米」为 UV 单位烘焙，材质内 repeat 保持 1，
 * 因此同一材质可复用于任意尺寸的构件。
 */
import * as THREE from 'three';
import { TEX } from './textures.js';

const cache = new Map();

function make(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

function std(params, set, normalScale = 1) {
  const m = new THREE.MeshStandardMaterial({
    map: set.map,
    normalMap: set.normalMap,
    roughnessMap: set.roughnessMap,
    metalness: 0.0,
    envMapIntensity: 0.85,
    ...params,
  });
  if (m.normalMap) m.normalScale = new THREE.Vector2(normalScale, normalScale);
  return m;
}

/** 贴图覆盖的米数 —— 几何阶段用它换算 UV */
export const COVER = {
  brick: 1.8,
  plaster: 2.0,
  woodLacquer: 1.1,
  woodBeam: 1.4,
  woodPlank: 1.4,
  granite: 1.6,
  paving: 2.4,
  tile: 1.2,
  glazed: 1.0,
  caihua: 1.4,
  marble: 1.6,
  grass: 4.0,
  earth: 6.0,
  bark: 1.6,
  lacquerBoard: 1.0,
};

export const MAT = {
  get brick() {
    return make('brick', () => std({ roughness: 1.0 }, TEX.brick, 1.0));
  },
  get plaster() {
    return make('plaster', () => std({ roughness: 1.0, color: 0xbfb8a4 }, TEX.plaster, 0.8));
  },
  get plasterWarm() {
    return make('plasterWarm', () => {
      const m = std({ roughness: 1.0, color: 0xe8ddc8 }, TEX.plaster, 0.8);
      return m;
    });
  },
  get woodLacquer() {
    return make('woodLacquer', () => std({ roughness: 0.9, color: 0x6b4034 }, TEX.woodLacquer, 0.9));
  },
  get woodBeam() {
    return make('woodBeam', () => std({ roughness: 1.0 }, TEX.woodBeam, 1.0));
  },
  get woodPlank() {
    return make('woodPlank', () => std({ roughness: 1.0 }, TEX.woodPlank, 1.0));
  },
  get granite() {
    return make('granite', () => std({ roughness: 1.0, color: 0x94908a }, TEX.granite, 1.0));
  },
  get graniteDark() {
    return make('graniteDark', () => {
      const m = std({ roughness: 1.0, color: 0x84847e }, TEX.granite, 1.0);
      return m;
    });
  },
  get paving() {
    return make('paving', () => std({ roughness: 1.0, color: 0x93918a }, TEX.paving, 0.9));
  },
  get tile() {
    return make('tile', () => std({ roughness: 0.97, envMapIntensity: 0.28 }, TEX.tile, 1.1));
  },
  get tileDark() {
    return make('tileDark', () => std({ roughness: 0.96, envMapIntensity: 0.24 }, TEX.tileDark, 1.1));
  },
  get glazed() {
    return make('glazed', () => std({ roughness: 0.62, envMapIntensity: 0.8 }, TEX.glazed, 0.7));
  },
  get glazedYellow() {
    return make('glazedYellow', () => std({ roughness: 0.58, envMapIntensity: 0.85 }, TEX.glazedYellow, 0.7));
  },
  get caihua() {
    return make('caihua', () => std({ roughness: 1.0 }, TEX.caihua, 0.5));
  },
  get marble() {
    return make('marble', () => std({ roughness: 0.85 }, TEX.marble, 0.6));
  },
  get grass() {
    return make('grass', () => std({ roughness: 1.0, color: 0xa8b884 }, TEX.grass, 1.0));
  },
  get earth() {
    return make('earth', () => std({ roughness: 1.0, color: 0x9c8e74 }, TEX.earth, 1.0));
  },
  get bark() {
    return make('bark', () => std({ roughness: 1.0 }, TEX.bark, 1.2));
  },
  get lacquerBoard() {
    return make('lacquerBoard', () => std({ roughness: 0.4, envMapIntensity: 0.5 }, TEX.lacquerBoard, 0.4));
  },

  /* —— 无贴图的补充材质 —— */
  get gold() {
    return make('gold', () => new THREE.MeshStandardMaterial({
      color: 0xb98a3c, metalness: 0.92, roughness: 0.32, envMapIntensity: 1.6,
    }));
  },
  get blackLacquer() {
    return make('blackLacquer', () => new THREE.MeshStandardMaterial({
      color: 0x14100e, metalness: 0.05, roughness: 0.36, envMapIntensity: 0.6,
    }));
  },
  get redLacquer() {
    return make('redLacquer', () => new THREE.MeshStandardMaterial({
      color: 0x7a2a1e, metalness: 0.0, roughness: 0.45, envMapIntensity: 0.7,
    }));
  },
  get paper() {
    return make('paper', () => new THREE.MeshStandardMaterial({
      color: 0xe2d8c0, roughness: 0.96, metalness: 0, side: THREE.DoubleSide,
      transparent: false, envMapIntensity: 0.5,
      emissive: new THREE.Color(0x6b6048), emissiveIntensity: 0.95,
    }));
  },
  get darkInterior() {
    return make('darkInterior', () => new THREE.MeshStandardMaterial({
      color: 0x0c0a08, roughness: 1.0, metalness: 0,
    }));
  },
  get iron() {
    return make('iron', () => new THREE.MeshStandardMaterial({
      color: 0x2b2b2c, metalness: 0.75, roughness: 0.55, envMapIntensity: 1.0,
    }));
  },
  get bronze() {
    return make('bronze', () => new THREE.MeshStandardMaterial({
      color: 0x7a6540, metalness: 0.8, roughness: 0.42, envMapIntensity: 1.3,
    }));
  },
  get stoneCarve() {
    return make('stoneCarve', () => new THREE.MeshStandardMaterial({
      color: 0xa8a49a, metalness: 0.0, roughness: 0.86, envMapIntensity: 0.8,
    }));
  },
  get whitewash() {
    return make('whitewash', () => new THREE.MeshStandardMaterial({
      color: 0xd8d2c4, metalness: 0.0, roughness: 0.95, envMapIntensity: 0.6,
    }));
  },
  get greenPaint() {
    return make('greenPaint', () => new THREE.MeshStandardMaterial({
      color: 0x1f4a44, metalness: 0.0, roughness: 0.55, envMapIntensity: 0.7,
    }));
  },
  get bluePaint() {
    return make('bluePaint', () => new THREE.MeshStandardMaterial({
      color: 0x1b3350, metalness: 0.0, roughness: 0.55, envMapIntensity: 0.7,
    }));
  },
  get water() {
    return make('water', () => new THREE.MeshStandardMaterial({
      color: 0x2c4a45, metalness: 0.25, roughness: 0.08,
      transparent: true, opacity: 0.86, envMapIntensity: 1.8,
    }));
  },
  get leaf() {
    return make('leaf', () => new THREE.MeshStandardMaterial({
      color: 0x4a6b35, roughness: 0.82, metalness: 0.0,
      side: THREE.DoubleSide, envMapIntensity: 0.7,
      vertexColors: true,
    }));
  },
  get bambooLeaf() {
    return make('bambooLeaf', () => new THREE.MeshStandardMaterial({
      color: 0x5c7a3a, roughness: 0.75, metalness: 0.0,
      side: THREE.DoubleSide, envMapIntensity: 0.7,
      vertexColors: true,
    }));
  },
  get lotus() {
    return make('lotus', () => new THREE.MeshStandardMaterial({
      color: 0x3f6b38, roughness: 0.7, metalness: 0.0,
      side: THREE.DoubleSide, envMapIntensity: 0.8,
      vertexColors: true,
    }));
  },
};

/** 统一设置环境贴图强度（天空生成后调用） */
export function setEnvIntensity(v) {
  for (const m of cache.values()) {
    if (m.isMeshStandardMaterial) m.envMapIntensity = v;
  }
}
