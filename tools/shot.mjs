#!/usr/bin/env node
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}
const flag = (name) => argv.includes(`--${name}`);

const out = arg('out', 'shots/shot.png');
const warmup = Number(arg('warmup', 1400));
const ticks = Number(arg('ticks', 0));
const keys = arg('keys', '');
const camYaw = arg('camyaw', null);
const camPitch = arg('campitch', null);
const teleport = arg('teleport', null);
const enemies = arg('enemies', null);
const width = Number(arg('width', 1600));
const height = Number(arg('height', 900));
const port = Number(arg('port', 5199));
const timeoutMs = Number(arg('timeout', 90000));

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const GL_ARGS = [
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-sandbox',
  '--disable-dev-shm-usage',
];

async function launch() {
  const errors = [];
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true, args: GL_ARGS });
    } catch (e) {
      errors.push(`${channel}: ${e.message.split('\n')[0]}`);
    }
  }
  for (const exe of CANDIDATES) {
    if (!existsSync(exe)) continue;
    try {
      return await chromium.launch({ executablePath: exe, headless: true, args: GL_ARGS });
    } catch (e) {
      errors.push(`${exe}: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error(`no browser launched:\n${errors.join('\n')}`);
}

const server = await createServer({
  root: ROOT,
  logLevel: 'warn',
  server: { port, strictPort: false, host: '127.0.0.1' },
});
await server.listen();
const url = server.resolvedUrls.local[0];

let browser;
const consoleErrors = [];
try {
  browser = await launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const pagePath = arg('path', null);
  const target = pagePath ? url + pagePath.replace(/^\//, '') : url;
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  if (!pagePath) {
    await page.waitForFunction(() => window.__ms && window.__ms.ready, null, { timeout: timeoutMs });
    await page.waitForFunction(
      () => {
        const s = window.__ms.snapshot();
        return s.playerModel !== 'pending' && s.enemyModel !== 'pending';
      },
      null,
      { timeout: timeoutMs },
    );
  }

  if (teleport) {
    const [x, z] = teleport.split(',').map(Number);
    await page.evaluate(([tx, tz]) => window.__ms.teleport(tx, tz), [x, z]);
  }
  if (camYaw !== null || camPitch !== null) {
    await page.evaluate(
      ([y, p]) => window.__ms.setCamera(y === null ? undefined : Number(y), p === null ? undefined : Number(p)),
      [camYaw, camPitch],
    );
  }
  const camDist = arg('camdist', null);
  if (camDist !== null) {
    await page.evaluate((d) => window.__ms.setCameraDistance(Number(d)), camDist);
  }
  if (enemies) {
    await page.evaluate((n) => window.__ms.spawnEnemies(n), Number(enemies));
  }

  if (flag('nograss')) {
    await page.evaluate(() => window.__ms.setVegetation(false));
  }

  if (ticks > 0) {
    await page.evaluate(() => window.__ms.setPaused(true));
    if (flag('orbit')) {
      const dirs = [{ moveZ: -1 }, { moveX: 1 }, { moveZ: 1 }, { moveX: -1 }];
      const chunk = Number(arg('chunk', 90));
      let done = 0;
      let di = 0;
      while (done < ticks) {
        const n = Math.min(chunk, ticks - done);
        await page.evaluate((f) => window.__ms.setInput(f), dirs[di % dirs.length]);
        await page.evaluate((k) => window.__ms.stepTicks(k), n);
        done += n;
        di++;
      }
      await page.evaluate(() => window.__ms.setInput(null));
    } else {
      await page.evaluate((n) => window.__ms.stepTicks(n), ticks);
    }
    await page.evaluate(() => window.__ms.setPaused(false));
  }

  if (keys) {
    const list = keys.split(',').filter(Boolean);
    for (const k of list) await page.keyboard.down(k);
    await page.waitForTimeout(warmup);
    for (const k of list) await page.keyboard.up(k);
  } else {
    await page.waitForTimeout(warmup);
  }

  const clip = arg('clip', null);
  if (clip) {
    await page.evaluate((c) => window.__ms.forceClip(c), clip);
    await page.waitForTimeout(240);
  }
  const weap = arg('weap', null);
  if (weap) {
    const vals = weap.split(',').map(Number);
    await page.evaluate((a) => window.__ms.setWeaponLocal(a[0], a[1], a[2], a[3], a[4], a[5], a[6]), vals);
    await page.waitForTimeout(160);
  }
  const hold = arg('hold', null);  if (hold) {
    const moveFrame = { moveX: 0, moveZ: 0, jump: false, dash: false };
    for (const k of hold.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (k === 'KeyW') moveFrame.moveZ -= 1;
      if (k === 'KeyS') moveFrame.moveZ += 1;
      if (k === 'KeyA') moveFrame.moveX -= 1;
      if (k === 'KeyD') moveFrame.moveX += 1;
      if (k === 'Space') moveFrame.jump = true;
      if (k === 'ShiftLeft') moveFrame.dash = true;
    }
    await page.evaluate((f) => window.__ms.setInput(f), moveFrame);
    await page.waitForTimeout(Number(arg('holds', 1100)));
  }

  await mkdir(path.dirname(path.join(ROOT, out)), { recursive: true });
  const burst = Number(arg('burst', 1));
  const burstMs = Number(arg('burstms', 170));
  if (burst > 1) {
    const stem = out.replace(/\.png$/, '');
    for (let i = 0; i < burst; i++) {
      await page.screenshot({ path: path.join(ROOT, `${stem}-${i}.png`) });
      if (i < burst - 1) await page.waitForTimeout(burstMs);
    }
  }
  await page.screenshot({ path: path.join(ROOT, out) });
  const snapshot = await page.evaluate(() => window.__ms.snapshot());
  const runtimeErrors = await page.evaluate(() => window.__ms.errors);

  console.log('SNAPSHOT ' + JSON.stringify(snapshot));
  const allErrors = [...consoleErrors, ...runtimeErrors];
  if (allErrors.length) console.log('ERRORS ' + JSON.stringify(allErrors.slice(0, 12), null, 2));
  else console.log('ERRORS none');
  console.log(`SHOT ${out}`);

  if (flag('mp4')) {
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(ROOT, out), '-vf', 'scale=1280:-2', path.join(ROOT, out.replace(/\.png$/, '.jpg'))]);
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
