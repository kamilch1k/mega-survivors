#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://openapi.tripo3d.ai/v3';
const ASSET_DIR = path.join(ROOT, 'public', 'assets');
const TASK_FILE = path.join(ROOT, '.tripo-tasks.json');
const DEFAULT_MODEL = 'v3.1-20260211';

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  try {
    process.loadEnvFile(envPath);
  } catch {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function key() {
  loadEnv();
  const k = process.env.TRIPO_API_KEY;
  if (!k) throw new Error('TRIPO_API_KEY missing from .env');
  return k;
}

async function req(pathname, { method = 'GET', json, form } = {}) {
  const headers = { Authorization: `Bearer ${key()}` };
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${pathname}`, { method, headers, body });
    } catch (e) {
      lastErr = e;
      console.log(`  network retry ${attempt + 1}: ${e.message}`);
      await sleep(1500 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${res.status} non-JSON response: ${text.slice(0, 300)}`);
    }
    if (!res.ok || parsed.code !== 0) {
      throw new Error(`${res.status} code=${parsed.code} ${parsed.message ?? ''} ${parsed.suggestion ?? ''}`.trim());
    }
    return parsed.data;
  }
  throw new Error(`network failed after retries: ${lastErr?.message ?? 'unknown'}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadImage(file) {
  const buf = await readFile(file);
  const form = new FormData();
  form.append('file', new Blob([buf]), path.basename(file));
  const data = await req('/files', { method: 'POST', form });
  return data.file_token;
}

async function loadTasks() {
  if (!existsSync(TASK_FILE)) return [];
  try {
    return JSON.parse(await readFile(TASK_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function saveTasks(tasks) {
  await writeFile(TASK_FILE, JSON.stringify(tasks, null, 2));
}

async function download(url, outRel) {
  const dest = path.join(ASSET_DIR, outRel);
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return dest;
}

async function startTask(args) {
  const prompt = args.prompt;
  const image = args.image;
  const out = args.out;
  if (!out) throw new Error('--out <sub/path.glb> required');
  const model = args.model ?? DEFAULT_MODEL;

  let payload;
  let type;
  if (image) {
    const fileToken = await uploadImage(image);
    payload = { file_token: fileToken, model, texture: true, pbr: true };
    if (args['face-limit']) payload.face_limit = Number(args['face-limit']);
    type = 'image_to_model';
  } else {
    if (!prompt) throw new Error('--prompt or --image required');
    payload = { prompt, model, texture: true, pbr: true, texture_quality: args['texture-quality'] ?? 'standard' };
    if (args['face-limit']) payload.face_limit = Number(args['face-limit']);
    type = 'text_to_model';
  }

  const data = await req(`/generation/${type.replace(/_/g, '-')}`, { method: 'POST', json: payload });
  const tasks = await loadTasks();
  tasks.push({ id: data.task_id, out, type, prompt: prompt ?? image, started: new Date().toISOString() });
  await saveTasks(tasks);
  console.log(`queued ${data.task_id} -> ${out} (${type})`);

  if (args.wait) await poll({ only: data.task_id });
}

async function poll(args) {
  const all = await loadTasks();
  const pending = all.filter((t) => !t.done && t.status !== 'failed');
  const targets = args.only ? pending.filter((t) => t.id === args.only) : pending;
  if (targets.length === 0) {
    console.log('nothing pending');
    return;
  }

  const timeout = Number(args.timeout ?? 420) * 1000;
  const deadline = Date.now() + timeout;

  while (targets.some((t) => !t.done && t.status !== 'failed') && Date.now() < deadline) {
    for (const t of targets) {
      if (t.done || t.status === 'failed') continue;
      let data;
      try {
        data = await req(`/tasks/${t.id}`);
      } catch (err) {
        console.log(`${t.id} query error: ${err.message}`);
        continue;
      }
      t.status = data.status;
      t.progress = data.progress;
      if (data.status === 'success') {
        const url = data.output?.pbr_model ?? data.output?.model_url ?? data.output?.model;
        if (!url) {
          t.status = 'failed';
          t.error = `no model url in output: ${Object.keys(data.output ?? {}).join(',')}`;
          console.log(`${t.id} FAILED ${t.error}`);
          continue;
        }
        const dest = await download(url, t.out);
        t.done = true;
        t.file = path.relative(ROOT, dest);
        t.credits = data.credits_consumed;
        if (data.output?.rendered_image_url) {
          const preview = t.out.replace(/\.(glb|gltf)$/i, '.preview.png');
          try {
            await download(data.output.rendered_image_url, preview);
            t.preview = preview;
          } catch {}
        }
        console.log(`${t.id} OK -> ${t.file} (${t.credits ?? '?'} credits)`);
      } else if (['failed', 'cancelled', 'banned', 'expired'].includes(data.status)) {
        t.status = 'failed';
        t.error = data.message ?? data.status;
        console.log(`${t.id} FAILED ${t.error}`);
      } else {
        console.log(`${t.id} ${data.status} ${data.progress ?? 0}%`);
      }
    }
    await saveTasks(all);
    if (targets.every((t) => t.done || t.status === 'failed')) break;
    await sleep(3000);
  }
  await saveTasks(all);
  const timedOut = targets.filter((t) => !t.done && t.status !== 'failed');
  if (timedOut.length) console.log(`still pending: ${timedOut.map((t) => t.id).join(', ')}`);
}

async function waitTask(id, timeoutSec = 600) {
  const deadline = Date.now() + timeoutSec * 1000;
  let last = '';
  while (Date.now() < deadline) {
    let data;
    try {
      data = await req(`/tasks/${id}`);
    } catch (e) {
      await sleep(3000);
      continue;
    }
    if (data.status === 'success') {
      console.log('');
      return data;
    }
    if (['failed', 'cancelled', 'banned', 'expired'].includes(data.status)) {
      throw new Error(`${id} ${data.status}: ${data.message ?? ''}`);
    }
    const line = `  ${id} ${data.status} ${data.progress ?? 0}%`;
    if (line !== last) {
      console.log(line);
      last = line;
    }
    await sleep(3000);
  }
  throw new Error(`${id} timed out after ${timeoutSec}s`);
}

async function rigAll(args) {
  const base = args.out ?? 'characters/player';
  const spec = args.spec ?? 'mixamo';
  const animationList = (
    args.animations ??
    'preset:biped:idle,preset:biped:walk,preset:biped:run,preset:biped:jump,preset:biped:slash'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let rigTaskId = args['rig-task'] ?? null;

  if (rigTaskId) {
    console.log(`skipping rig, reusing ${rigTaskId}`);
  } else {
    const taskId = args.task;
    if (!taskId) throw new Error('--task <generation task_id> or --rig-task <rig task_id> required');

    console.log('1/3 rig-check');
    const check = await req('/animations/rig-check', { method: 'POST', json: { input: taskId } });
    const rigType = args['rig-type'] ?? check.rig_type ?? 'biped';
    console.log(`    rig_type=${rigType}`);

    console.log('2/3 auto-rig');
    const rigModel = args.model ?? 'v1.0-20240301';
    const rigData = await req('/animations/rig', {
      method: 'POST',
      json: { input: taskId, rig_type: rigType, spec, out_format: 'glb', model: rigModel },
    });
    rigTaskId = rigData.task_id;
    console.log(`    rig task ${rigTaskId}`);
    const rigResult = await waitTask(rigTaskId);
    const rigUrl = rigResult.output?.model_url ?? rigResult.output?.pbr_model ?? rigResult.output?.model;
    if (rigUrl) {
      const dest = await download(rigUrl, `${base}_rigged.glb`);
      console.log(`    rigged -> ${path.relative(ROOT, dest)} (${rigResult.credits_consumed ?? '?'} credits)`);
    } else {
      console.log(`    rig output keys: ${Object.keys(rigResult.output ?? {}).join(',')}`);
    }
  }

  const chunks = [];
  for (let i = 0; i < animationList.length; i += 5) chunks.push(animationList.slice(i, i + 5));
  console.log(`3/3 retarget: ${animationList.length} clips in ${chunks.length} batch(es), in-place`);

  for (let c = 0; c < chunks.length; c++) {
    const animData = await req('/animations/retarget', {
      method: 'POST',
      json: {
        input: rigTaskId,
        animations: chunks[c],
        out_format: 'glb',
        bake_animation: true,
        export_with_geometry: true,
        animate_in_place: true,
      },
    });
    console.log(`    batch ${c + 1}/${chunks.length} ${animData.task_id} [${chunks[c].join(' ')}]`);
    const animResult = await waitTask(animData.task_id);
    const out = animResult.output ?? {};
    const urls = Array.isArray(out.model_urls)
      ? out.model_urls
      : [out.model_url, out.pbr_model, out.model].filter(Boolean);
    if (urls.length === 0) {
      console.log(`    no urls. output keys: ${Object.keys(out).join(',')}`);
      continue;
    }
    for (let i = 0; i < urls.length; i++) {
      const name = chunks.length === 1 && urls.length === 1 ? `${base}_anim.glb` : `${base}_anim_b${c}_${i}.glb`;
      const dest = await download(urls[i], name);
      console.log(`    -> ${path.relative(ROOT, dest)}`);
    }
    console.log(`    credits: ${animResult.credits_consumed ?? '?'}`);
  }
}

async function balance() {
  const data = await req('/account/balance');
  console.log(JSON.stringify(data, null, 2));
}

function parseArgs(argv) {
  const args = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[name] = true;
      else {
        args[name] = next;
        i++;
      }
    } else rest.push(a);
  }
  args._ = rest;
  return args;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] ?? 'poll';

try {
  if (cmd === 'balance') await balance();
  else if (cmd === 'gen') await startTask(args);
  else if (cmd === 'poll') await poll({});
  else if (cmd === 'rigall') await rigAll(args);
  else if (cmd === 'tasks') {
    const all = await loadTasks();
    console.log(JSON.stringify(all, null, 2));
  } else if (cmd === 'upload') {
    console.log(await uploadImage(args._[1]));
  } else {
    console.log('commands: balance | gen --prompt/--image --out | poll | rigall --task <id> | tasks | upload <file>');
  }
} catch (err) {
  console.error(`ERROR ${err.message}`);
  process.exit(1);
}
