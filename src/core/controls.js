/**
 * 相机控制：鸟瞰 / 步行 / 自由飞行
 * 统一处理鼠标、触摸、键盘
 */
import * as THREE from 'three';
import { heightAt } from '../site/terrain.js';

export class CameraController {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'orbit';

    this.target = new THREE.Vector3(0, 4, 0);
    this.spherical = new THREE.Spherical(150, Math.PI * 0.34, Math.PI * 0.25);
    this.damping = 0.09;

    this.walk = {
      pos: new THREE.Vector3(0, 1.7, 0),
      yaw: Math.PI,
      pitch: -0.05,
      vel: new THREE.Vector3(),
      eye: 1.68,
      speed: 5.4,
    };

    this.tour = { active: false, t: 0, dur: 1.8, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3() };
    this.keys = new Set();
    this.colliders = [];
    this.bounds = { min: -520, max: 520 };
    this.pointer = { down: false, x: 0, y: 0, moved: 0, id: null, button: 0 };
    this.touch = { pinch: 0, ids: new Set() };
    this.onClick = opts.onClick || (() => {});
    this.onDoubleClick = opts.onDoubleClick || (() => {});
    this.enabled = true;

    this._bind();
    this._applyOrbit(1);
  }

  _bind() {
    const dom = this.dom;
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.touch.ids.add(e.pointerId);
      if (this.touch.ids.size > 1) return;
      this.pointer.down = true;
      this.pointer.id = e.pointerId;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.moved = 0;
      this.pointer.button = e.button;
      dom.setPointerCapture?.(e.pointerId);
    });

    dom.addEventListener('pointermove', (e) => {
      if (!this.pointer.down || this.pointer.id !== e.pointerId) return;
      const dx = e.clientX - this.pointer.x;
      const dy = e.clientY - this.pointer.y;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.moved += Math.abs(dx) + Math.abs(dy);

      if (this.mode === 'orbit') {
        if (this.pointer.button === 2 || e.shiftKey) {
          // 平移
          const scale = this.spherical.radius * 0.0016;
          const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
          const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
          this.target.addScaledVector(right, -dx * scale);
          this.target.addScaledVector(up, dy * scale);
        } else {
          this.spherical.theta -= dx * 0.0042;
          this.spherical.phi -= dy * 0.0042;
          this.spherical.phi = Math.max(0.08, Math.min(Math.PI * 0.495, this.spherical.phi));
        }
      } else {
        this.walk.yaw -= dx * 0.0032;
        this.walk.pitch -= dy * 0.0032;
        this.walk.pitch = Math.max(-1.35, Math.min(1.35, this.walk.pitch));
      }
    });

    const up = (e) => {
      this.touch.ids.delete(e.pointerId);
      if (this.pointer.id === e.pointerId) {
        if (this.pointer.moved < 6) this.onClick(e);
        this.pointer.down = false;
        this.pointer.id = null;
      }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('dblclick', (e) => this.onDoubleClick(e));

    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const k = Math.exp(e.deltaY * 0.0012);
      if (this.mode === 'orbit') {
        this.spherical.radius = Math.max(6, Math.min(420, this.spherical.radius * k));
      } else {
        this.walk.speed = Math.max(1.2, Math.min(24, this.walk.speed * (k > 1 ? 0.92 : 1.08)));
      }
    }, { passive: false });

    // 双指缩放
    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (this.touch.pinch > 0 && this.mode === 'orbit') {
        const k = this.touch.pinch / d;
        this.spherical.radius = Math.max(6, Math.min(420, this.spherical.radius * k));
      }
      this.touch.pinch = d;
    }, { passive: true });
    dom.addEventListener('touchend', () => { this.touch.pinch = 0; });

    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** 导览：平滑飞到指定机位并注视目标 */
  flyTo(pos, target, dur = 1.8) {
    if (dur <= 0.05) {
      this.mode = 'tour';
      this.enabled = false;
      this.camera.position.copy(pos);
      this.camera.lookAt(target);
      this.target.copy(target);
      this.tour.toTgt.copy(target);
      this.tour.active = false;
      return;
    }
    const tr = this.tour;
    tr.active = true;
    tr.t = 0;
    tr.dur = dur;
    tr.fromPos.copy(this.camera.position);
    tr.toPos.copy(pos);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    tr.fromTgt.copy(this.camera.position).addScaledVector(dir, 20);
    tr.toTgt.copy(target);
    this.mode = 'tour';
    this.enabled = false;
  }

  endTour() {
    this.tour.active = false;
    this.enabled = true;
    this.mode = 'orbit';
    const off = this.camera.position.clone().sub(this.tour.toTgt);
    this.spherical.setFromVector3(off);
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI * 0.49, this.spherical.phi));
    this.target.copy(this.tour.toTgt);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === 'walk' || mode === 'fly') {
      // 从当前相机位置接管
      const p = this.camera.position.clone();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.walk.pos.copy(p);
      this.walk.yaw = Math.atan2(-dir.x, -dir.z);
      this.walk.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    }
    if (mode === 'orbit') {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.target.copy(this.camera.position).addScaledVector(dir, 60);
      const off = this.camera.position.clone().sub(this.target);
      this.spherical.setFromVector3(off);
      this.spherical.phi = Math.max(0.12, Math.min(Math.PI * 0.49, this.spherical.phi));
    }
    this.mode = mode;
  }

  focusOn(pos, radius = 26) {
    this.setMode('orbit');
    const from = this.camera.position.clone();
    const targetSph = new THREE.Spherical(
      radius,
      Math.PI * 0.36,
      Math.atan2(from.x - pos.x, from.z - pos.z),
    );
    this._anim = {
      t: 0, dur: 1.1,
      from: this.spherical.clone(),
      to: targetSph,
      fromTarget: this.target.clone(),
      toTarget: pos.clone().setY(pos.y + radius * 0.16),
    };
  }

  _applyOrbit(k) {
    const s = this.spherical;
    const off = new THREE.Vector3().setFromSpherical(s);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
  }

  update(dt) {
    if (this._anim) {
      const a = this._anim;
      a.t += dt;
      const t = Math.min(1, a.t / a.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.spherical.radius = THREE.MathUtils.lerp(a.from.radius, a.to.radius, e);
      this.spherical.phi = THREE.MathUtils.lerp(a.from.phi, a.to.phi, e);
      // 角度取最短路径
      let dTheta = a.to.theta - a.from.theta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      this.spherical.theta = a.from.theta + dTheta * e;
      this.target.lerpVectors(a.fromTarget, a.toTarget, e);
      if (t >= 1) this._anim = null;
    }

    if (this.mode === 'tour') {
      const tr = this.tour;
      if (tr.active) {
        tr.t += dt;
        const k = Math.min(1, tr.t / tr.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.camera.position.lerpVectors(tr.fromPos, tr.toPos, e);
        const tgt = new THREE.Vector3().lerpVectors(tr.fromTgt, tr.toTgt, e);
        this.camera.lookAt(tgt);
        this.target.copy(tgt);
        if (k >= 1) tr.active = false;
      }
      return;
    }

    if (this.mode === 'orbit') {
      const s = this.spherical;
      const off = new THREE.Vector3().setFromSpherical(s);
      const desired = this.target.clone().add(off);
      this.camera.position.lerp(desired, 0.28);
      this.camera.lookAt(this.target);
    } else {
      this._updateWalk(dt);
    }
  }

  _updateWalk(dt) {
    const k = this.keys;
    const w = this.walk;
    const fwd = new THREE.Vector3(-Math.sin(w.yaw), 0, -Math.cos(w.yaw));
    const right = new THREE.Vector3(Math.cos(w.yaw), 0, -Math.sin(w.yaw));

    let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) mz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;

    // 触屏摇杆
    if (this.stick) {
      mx += this.stick.x;
      mz += -this.stick.y;
    }

    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = w.speed * (run ? 2.1 : 1) * (this.mode === 'fly' ? 2.4 : 1);

    const dir = new THREE.Vector3()
      .addScaledVector(fwd, mz)
      .addScaledVector(right, mx);
    if (dir.lengthSq() > 0) dir.normalize();

    // 平滑加速
    w.vel.lerp(dir.multiplyScalar(speed), 1 - Math.pow(0.0016, dt));

    const next = w.pos.clone().addScaledVector(w.vel, dt);

    if (this.mode === 'fly') {
      if (k.has('Space')) next.y += speed * dt;
      if (k.has('KeyC') || k.has('ControlLeft')) next.y -= speed * dt;
      next.y = Math.max(heightAt(next.x, next.z) + 1.2, Math.min(220, next.y));
    } else {
      // 地面
      const gh = this.groundFn ? this.groundFn(next.x, next.z) : heightAt(next.x, next.z);
      // 建筑碰撞（圆柱近似）
      let blocked = false;
      const pad = 0.35;
      for (const c of this.colliders) {
        if (next.x > c.minX - pad && next.x < c.maxX + pad
          && next.z > c.minZ - pad && next.z < c.maxZ + pad) { blocked = true; break; }
      }
      if (!blocked) {
        const targetY = gh + w.eye;
        w.pos.x = next.x;
        w.pos.z = next.z;
        w.pos.y += (targetY - w.pos.y) * Math.min(1, dt * 12);
      } else {
        w.vel.multiplyScalar(0.2);
      }
      // 边界
      w.pos.x = Math.max(this.bounds.min, Math.min(this.bounds.max, w.pos.x));
      w.pos.z = Math.max(this.bounds.min, Math.min(this.bounds.max, w.pos.z));
    }

    if (this.mode === 'fly') w.pos.copy(next);

    this.camera.position.copy(w.pos);
    const look = new THREE.Vector3(
      -Math.sin(w.yaw) * Math.cos(w.pitch),
      Math.sin(w.pitch),
      -Math.cos(w.yaw) * Math.cos(w.pitch),
    );
    this.camera.lookAt(w.pos.clone().add(look));
  }

  setStick(x, y) {
    this.stick = { x, y };
  }

  setColliders(list) {
    this.colliders = list;
  }

  /** 自定义地面高度（考虑台基、台阶） */
  setGroundFn(fn) {
    this.groundFn = fn;
  }
}
