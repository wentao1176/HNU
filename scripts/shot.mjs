/**
 * 无头截图：通过 CDP 抓取 WebGL 画面
 * 用法：node scripts/shot.mjs <url> <out.png> [宽] [高] [等待毫秒]
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] || 'http://127.0.0.1:5180/?q=hd&still=1';
const out = process.argv[3] || 'shot.png';
const W = +(process.argv[4] || 1600);
const H = +(process.argv[5] || 1000);
const WAIT = +(process.argv[6] || 30000);
const PORT = 9500 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${W},${H}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + (process.env.TEMP || '/tmp') + '/cdp-shot-profile',
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
  if (!target) throw new Error('no CDP target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const a = (msg.params.args || []).map((x) => x.value ?? x.description ?? '').join(' ');
      logs.push(`[${msg.params.type}] ${a}`.slice(0, 240));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`.slice(0, 400));
    }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: false,
  });
  await send('Page.navigate', { url });

  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < WAIT) {
    await sleep(700);
    const r = await send('Runtime.evaluate', { expression: 'window.__READY__ === true', returnByValue: true });
    if (r.result?.result?.value === true) { ready = true; break; }
  }
  await sleep(1200);

  // 多机位：CAMS 环境变量为 JSON 数组 [[cu,cv,cy,lu,lv,ly], ...]
  const camsRaw = process.env.CAMS;
  if (camsRaw) {
    const cams = JSON.parse(camsRaw);
    const base = out.replace(/\.png$/i, '');
    for (let i = 0; i < cams.length; i++) {
      const [cu, cv, cy, lu, lv, ly] = cams[i];
      await send('Runtime.evaluate', {
        expression: `window.__setCamUV(${cu},${cv},${cy},${lu},${lv},${ly})`,
        returnByValue: true,
      });
      await sleep(900);
      const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      if (shot.result?.data) {
        const f = `${base}_${i}.png`;
        writeFileSync(f, Buffer.from(shot.result.data, 'base64'));
        console.log('saved', f);
      }
    }
    ws.close();
    return;
  }

  // 直接从 canvas 取图（headless 合成器常常抓不到 WebGL 画面）
  const dataUrl = await send('Runtime.evaluate', {
    expression: "window.__grab ? window.__grab(" + (process.env.NOCOMP ? "false" : "true") + ") : null",
    returnByValue: true,
  });
  const d = dataUrl.result?.result?.value;
  if (d && d.startsWith('data:image/png;base64,')) {
    writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
    console.log('saved(canvas)', out, 'ready=' + ready, 'port=' + PORT);
  } else {
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    if (shot.result?.data) {
      writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
      console.log('saved(page)', out, 'ready=' + ready);
    } else {
      console.log('FAILED', JSON.stringify(shot).slice(0, 300));
    }
  }
  const tm = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__timings||[])', returnByValue: true });
  if (tm.result?.result?.value) {
    const arr = JSON.parse(tm.result.result.value);
    const total = arr.reduce((a, b) => a + b.ms, 0);
    console.log('build ms total=' + total);
    for (const t of arr.slice().sort((a, b) => b.ms - a.ms).slice(0, 8)) console.log('  ', t.ms, t.label);
  }
  if (process.env.VERBOSE) {
    console.log('--- page logs ---');
    for (const l of logs.slice(-40)) console.log(l);
  }
  ws.close();
}

main().catch((e) => { console.error(e.message); }).finally(() => {
  chrome.kill();
  setTimeout(() => process.exit(0), 300);
});
