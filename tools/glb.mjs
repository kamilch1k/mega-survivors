import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

async function fetchAsset(url, out) {
  const dest = path.resolve(ROOT, out);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(dest, buf);
      console.log(`FETCHED ${path.relative(ROOT, dest)} ${(buf.length / 1024).toFixed(1)} KB`);
      return;
    } catch (err) {
      lastErr = err;
      console.log(`  retry ${attempt}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw new Error(`failed ${url}: ${lastErr && lastErr.message}`);
}

function readGlbJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  let offset = 12;
  while (offset < buf.length) {
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 0x4e4f534a) return JSON.parse(data.toString('utf8'));
    offset += 8 + len + ((4 - (len % 4)) % 4);
  }
  throw new Error('no JSON chunk');
}

function info(file) {
  const gltf = readGlbJson(file);
  const anims = (gltf.animations ?? []).map((a) => {
    let maxT = 0;
    for (const s of a.samplers ?? []) {
      const acc = gltf.accessors?.[s.input];
      if (acc && typeof acc.max?.[0] === 'number') maxT = Math.max(maxT, acc.max[0]);
    }
    return `${a.name}(${maxT.toFixed(2)}s)`;
  });
  const skins = (gltf.skins ?? []).map((s) => `${s.name ?? 'skin'}:${s.joints.length}j`);
  const meshCount = (gltf.meshes ?? []).length;
  let tri = 0;
  for (const m of gltf.meshes ?? []) {
    for (const p of m.primitives ?? []) {
      const acc = gltf.accessors?.[p.indices];
      if (acc) tri += acc.count / 3;
    }
  }
  console.log(`FILE ${path.relative(ROOT, file)}`);
  console.log(`  meshes=${meshCount} triangles=${tri} skins=[${skins.join(', ')}]`);
  console.log(`  animations(${anims.length}): ${anims.join(' ')}`);
}

function joints(file) {
  const gltf = readGlbJson(file);
  const names = (gltf.nodes ?? []).map((n) => n.name ?? '?');
  for (const skin of gltf.skins ?? []) {
    const list = skin.joints.map((i) => names[i]);
    console.log(`SKIN ${skin.name ?? 'skin'} (${list.length} joints)`);
    console.log('  ' + list.join(' '));
  }
}

const [, , cmd, ...rest] = process.argv;
if (cmd === 'fetch') {
  const pairs = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);
  for (const [url, out] of pairs) await fetchAsset(url, out);
} else if (cmd === 'info') {
  for (const f of rest) info(path.resolve(ROOT, f));
} else if (cmd === 'joints') {
  for (const f of rest) joints(path.resolve(ROOT, f));
} else {
  console.log('usage: node tools/glb.mjs fetch <url> <out> [url out ...] | info <file...> | joints <file...>');
}
