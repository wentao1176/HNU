/**
 * 场景探针：列出爱晚亭附近的对象（定位杂色几何用）
 * 用法：node scripts/probe.mjs [u] [v] [半径]
 */
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const U = +(process.argv[2] || 267), V = +(process.argv[3] || -17), R = +(process.argv[4] || 14);
const PORT = 9500 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--window-size=800,600',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + (process.env.TEMP || '/tmp') + '/cdp-probe-profile',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let target = null;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await r.json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) { /* retry */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5180/?still=1' });
  await sleep(45000);

  const expr = `(function(){
    const at = (u,v) => window.__scene ? null : null;
    // 从学院根找：academy group
    let root = null;
    window.__scene.traverse(o => { if (o.name === 'academy' && o.parent) root = root || o; });
    if (!root) return 'no academy';
    // 世界坐标原点换算
    const ORIGIN = { x: -60.8, z: 187.5 };
    const AX = { x: -0.9835, z: -0.180 }, RV = { x: 0.180, z: -0.9835 };
    const cx = ORIGIN.x + AX.x * ${U} + RV.x * ${V};
    const cz = ORIGIN.z + AX.z * ${U} + RV.z * ${V};
    const found = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      o.updateWorldMatrix(true, false);
      const bp = new (o.position.constructor)();
      if (o.geometry.boundingBox === null) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      // 取几何中心的世界坐标
      const c = new (o.position.constructor)((bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2);
      const cw = c.applyMatrix4(o.matrixWorld);
      const d = Math.hypot(cw.x - cx, cw.z - cz);
      if (d < ${R}) {
        found.push({
          name: o.parent.name || o.name || '(anon)',
          kind: o.geometry.type,
          dist: Math.round(d*10)/10,
          y: Math.round(cw.y*10)/10,
          size: [Math.round((bb.max.x-bb.min.x)*10)/10, Math.round((bb.max.y-bb.min.y)*10)/10, Math.round((bb.max.z-bb.min.z)*10)/10],
          mat: Array.isArray(o.material) ? o.material.map(m=>m.type).join('+') : o.material.type,
        });
      }
    });
    found.sort((a,b)=>a.dist-b.dist);
    return JSON.stringify(found.slice(0, 40), null, 1);
  })()`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(r.result?.result?.value || JSON.stringify(r.result));
  ws.close();
}

main().catch((e) => console.error(e.message)).finally(() => {
  chrome.kill();
  setTimeout(() => process.exit(0), 300);
});
