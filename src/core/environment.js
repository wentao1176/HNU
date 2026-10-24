/**
 * 环境系统：物理天空、太阳、云、IBL 环境贴图、阴影相机
 */
import * as THREE from 'three';
import { makeCanvas, fbm, mulberry32 } from '../gfx/noise.js';

/** 程序化云层贴图 */
function cloudTexture(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(777);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let n = fbm(u, v, 4, 6, 301);
      // 拉长成层积云
      const n2 = fbm(u * 0.5, v * 1.8, 6, 5, 411);
      n = n * 0.6 + n2 * 0.4;
      const a = Math.max(0, (n - 0.62) * 2.6);
      const i = (y * size + x) * 4;
      // 云底略灰，云顶亮
      const bright = 208 + Math.min(1, a * 1.6) * 46 + rnd() * 10;
      img.data[i] = bright;
      img.data[i + 1] = bright;
      img.data[i + 2] = bright * 0.99;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 天空穹顶：天顶蓝 → 地平线雾白 的渐变，叠加太阳圆盘与光晕、程序化云
 * 输出线性色，交给渲染器的 ACES + sRGB 处理
 */
function createSkyDome() {
  const geo = new THREE.SphereGeometry(4000, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunPosition: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color(0x1a55a0) },
      uHorizon: { value: new THREE.Color(0x9fbdd4) },
      uGround: { value: new THREE.Color(0x93a294) },
      uSunColor: { value: new THREE.Color(0xfff2d8) },
      uTime: { value: 0 },
      uCloud: { value: 0.85 },
      uHaze: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 sunPosition;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform vec3 uSunColor;
      uniform float uTime;
      uniform float uCloud;
      uniform float uHaze;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          s += a * vnoise(p);
          p *= 2.04;
          a *= 0.5;
        }
        return s;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;

        // 天顶 → 地平线渐变（地平线附近压得更扁，接近真实大气）
        float t = clamp(h, 0.0, 1.0);
        float g = pow(1.0 - t, 2.6);
        vec3 col = mix(uZenith, uHorizon, g);

        // 地平线以下：接地面雾
        col = mix(col, uGround, smoothstep(0.0, -0.14, h));

        // 地平线附近的大气霾
        float haze = pow(1.0 - clamp(abs(h) * 9.0, 0.0, 1.0), 4.0) * uHaze;
        col = mix(col, uHorizon * 1.04, haze * 0.42);

        // 太阳
        float sd = max(dot(dir, normalize(sunPosition)), 0.0);
        // 光晕：两层，内紧外松
        col += uSunColor * pow(sd, 420.0) * 2.4;
        col += uSunColor * pow(sd, 18.0) * 0.16;
        col += uSunColor * pow(sd, 3.0) * 0.05;

        // 云：投影到高空平面，fbm 造絮状
        if (h > 0.015) {
          vec2 cp = dir.xz / (h + 0.10) * 0.30;
          cp += vec2(uTime * 0.010, uTime * 0.004);
          float n = fbm(cp);
          float n2 = fbm(cp * 2.6 + 11.0);
          float dens = n * 0.70 + n2 * 0.30;
          float cov = smoothstep(0.44, 0.66, dens) * uCloud;
          // 边缘再叠一层细絮，破掉"色块感"
          cov += smoothstep(0.58, 0.74, fbm(cp * 5.1 + 31.0)) * 0.18 * uCloud;
          // 靠近地平线渐隐
          cov *= smoothstep(0.008, 0.10, h);
          // 云的明暗：向阳面亮，背阴面灰蓝
          float lit = smoothstep(0.35, 0.85, dens);
          vec3 cloudCol = mix(vec3(0.52, 0.58, 0.66), vec3(1.02, 1.0, 0.97), lit);
          cloudCol += uSunColor * pow(sd, 6.0) * 0.30 * lit;
          col = mix(col, cloudCol, cov * 0.92);
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    // 天空：自写穹顶着色器（渐变 + 太阳 + 程序化云）
    this.sky = createSkyDome();
    scene.add(this.sky);

    // 太阳光晕
    const gc = makeCanvas(256);
    const gctx = gc.getContext('2d');
    const grd = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,246,224,1)');
    grd.addColorStop(0.12, 'rgba(255,238,200,0.85)');
    grd.addColorStop(0.35, 'rgba(255,224,170,0.28)');
    grd.addColorStop(1, 'rgba(255,214,150,0)');
    gctx.fillStyle = grd;
    gctx.fillRect(0, 0, 256, 256);
    const gt = new THREE.CanvasTexture(gc);
    gt.colorSpace = THREE.SRGBColorSpace;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: gt, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      transparent: true, opacity: 0.22, fog: false,
    }));
    this.glow.scale.setScalar(420);
    this.glow.renderOrder = -2;
    scene.add(this.glow);

    // 太阳
    this.sunDir = new THREE.Vector3();
    this.sun = new THREE.DirectionalLight(0xfff0dc, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.bias = -0.00018;
    this.sun.shadow.normalBias = 0.012;
    this.sun.shadow.radius = 1.1;
    // 阴影不完全吃黑：保留环境光在暗部的层次
    this.sun.shadow.intensity = 0.78;
    scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    // 天光
    this.hemi = new THREE.HemisphereLight(0xbcd2e8, 0x6a6248, 0.5);
    scene.add(this.hemi);

    // 补光（背光面不死黑）
    this.fill = new THREE.DirectionalLight(0xa8c4e0, 0.35);
    this.fill.position.set(-0.6, 0.5, -0.7);
    scene.add(this.fill);

    // 地面反弹光：从下往上，避免檐下与廊内死黑
    this.bounce = new THREE.DirectionalLight(0xbfae8c, 0.34);
    this.bounce.position.set(0.1, -1, 0.15);
    this.bounce.castShadow = false;
    scene.add(this.bounce);

    // 轮廓光：从太阳反方向斜上方打冷光，勾出屋脊与檐口
    this.rim = new THREE.DirectionalLight(0x9fc0e8, 0.5);
    this.rim.castShadow = false;
    scene.add(this.rim);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envRT = null;
    this.hour = 15.2;
    this.setTime(this.hour);
  }

  /** 设置时刻（0-24），生成对应的天空与光照 */
  setTime(hour) {
    this.hour = hour;
    // 太阳高度角：6 点日出，18 点日落，正午最高约 68°
    const dayT = (hour - 6) / 12;
    const elevation = Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI) * 66 + 2;
    const azimuth = 96 + (dayT - 0.5) * 150;  // 东南升起，西南落下

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);

    // 光色随高度角变化
    const warm = 1 - Math.min(1, elevation / 34);
    this.sun.color.setRGB(1.0, 0.94 - warm * 0.16, 0.86 - warm * 0.34);
    this.sun.intensity = 3.5 * Math.min(1, elevation / 12) + 0.28;

    this.hemi.intensity = 0.26 + Math.min(1, elevation / 40) * 0.22;
    this.rim.position.copy(this.sunDir).multiplyScalar(-1).setY(0.42).normalize().multiplyScalar(300);
    this.rim.intensity = 0.34 + Math.min(1, elevation / 40) * 0.2;
    this.fill.intensity = 0.3 + Math.min(1, elevation / 40) * 0.22;

    // 雾色跟随天空：远山淡蓝，近处通透
    const fogCol = new THREE.Color().setHSL(0.565, 0.20 - warm * 0.08, 0.70 - warm * 0.08);
    this.scene.fog.color.copy(fogCol);
    this.renderer.setClearColor(fogCol);


    this.updateEnvMap();
  }

  updateEnvMap() {
    const old = this.envRT;
    const envScene = new THREE.Scene();
    const skyClone = this.sky.clone();
    skyClone.material = this.sky.material;
    envScene.add(skyClone);
    const rt = this.pmrem.fromScene(envScene, 0, 1, 6000);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.88;
    this.envRT = rt;
    if (old) old.dispose();
  }

  /** 阴影相机跟随视点，保证近处阴影清晰 */
  updateShadow(target, radius = 70) {
    const cam = this.sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.far = radius * 6 + 200;
    cam.updateProjectionMatrix();

    this.sunTarget.position.copy(target);
    this.sunTarget.updateMatrixWorld();
    this.sun.position.copy(target).addScaledVector(this.sunDir, radius * 2.6);
    this.sun.shadow.needsUpdate = true;
  }

  update(dt, camera) {
    // 云层缓慢漂移
    this.sky.material.uniforms.uTime.value += dt * 0.006;
    this.glow.position.copy(camera.position).addScaledVector(this.sunDir, 2200);
    this.sky.position.copy(camera.position);
  }
}
