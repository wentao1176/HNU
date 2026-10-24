/**
 * 渲染引擎
 * WebGL2 + PBR + 物理天空 + 后处理（GTAO / Bloom / SMAA）
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { setAnisotropy } from '../gfx/textures.js';

export const QUALITY = {
  smooth: { name: '流畅', pr: 1.0, shadow: 1024, ao: false },
  hd: { name: '高清', pr: 1.5, shadow: 2048, ao: false },
  ultra: { name: '超清', pr: 2.0, shadow: 4096, ao: true },
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = 'hd';
    this.clock = new THREE.Clock();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.hd.pr));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    this.renderer = renderer;

    setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xb6c8d4, 0.00115);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.15, 9000);
    this.camera.position.set(60, 42, 130);

    this.composer = null;
    this.useComposer = false;
    this._buildComposer();

    window.addEventListener('resize', () => this.resize());
    this.stats = { fps: 0, frames: 0, last: performance.now() };
    this.onFrame = null;
  }

  _buildComposer() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const q = QUALITY[this.quality];
    if (this.composer) {
      this.composer.dispose?.();
      this.composer = null;
    }
    if (this.gtao) { this.gtao = null; }

    // 无后处理需求时直接渲染到默认帧缓冲，保留原生 MSAA，最稳最快
    if (!q.ao) {
      this.useComposer = false;
      return;
    }

    const pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(w * pr)),
      Math.max(1, Math.floor(h * pr)),
      {
        type: THREE.HalfFloatType,
        colorSpace: THREE.LinearSRGBColorSpace,
        depthBuffer: true,
        stencilBuffer: false,
      },
    );
    const composer = new EffectComposer(this.renderer, rt);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const gtao = new GTAOPass(this.scene, this.camera, w, h);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.65;
    gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.3, thickness: 1.0, scale: 1.0, samples: 12 });
    composer.addPass(gtao);
    this.gtao = gtao;

    composer.addPass(new OutputPass());
    this.composer = composer;
    this.useComposer = true;
  }

  setQuality(level) {
    if (!QUALITY[level] || level === this.quality) return;
    this.quality = level;
    const q = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pr));
    this.renderer.shadowMap.needsUpdate = true;
    if (this.sun) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this._buildComposer();
    this.resize();
    return q.name;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    if (this.gtao) this.gtao.setSize(w, h);
    if (this.onResize) this.onResize(w, h);
  }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      if (this.onFrame) this.onFrame(dt, t);
      if (this.useComposer && this.composer) this.composer.render(dt);
      else this.renderer.render(this.scene, this.camera);

      this.stats.frames++;
      const now = performance.now();
      if (now - this.stats.last > 500) {
        this.stats.fps = Math.round((this.stats.frames * 1000) / (now - this.stats.last));
        this.stats.frames = 0;
        this.stats.last = now;
      }
    };
    loop();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
