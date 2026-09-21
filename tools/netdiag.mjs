import https from 'node:https';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const key = /TRIPO_API_KEY\s*=\s*(\S+)/.exec(env)?.[1] ?? '';
const host = 'openapi.tripo3d.ai';
const pathname = '/v3/account/balance';

try {
  const res = await fetch(`https://${host}${pathname}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  console.log('UNDICI OK', res.status, (await res.text()).slice(0, 120));
} catch (e) {
  console.log('UNDICI ERR', e.message);
  const c = e.cause;
  if (c) console.log('  cause:', c.message, '| code:', c.code, '| errno:', c.errno, '| syscall:', c.syscall, '| address:', c.address);
  if (c?.cause) console.log('  deeper:', c.cause.message, c.cause.code);
}

await new Promise((resolve) => {
  const req = https.get(
    { host, path: pathname, headers: { Authorization: `Bearer ${key}` }, family: 4, timeout: 20000 },
    (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        console.log('HTTPS OK', res.statusCode, body.slice(0, 120));
        resolve();
      });
    },
  );
  req.on('error', (e) => {
    console.log('HTTPS ERR', e.message, e.code);
    resolve();
  });
  req.on('timeout', () => {
    console.log('HTTPS TIMEOUT');
    req.destroy();
    resolve();
  });
});

await new Promise((resolve) => {
  https
    .get({ host: 'registry.npmjs.org', path: '/three', family: 4, timeout: 15000 }, (res) => {
      console.log('NPM HOST OK', res.statusCode);
      res.resume();
      resolve();
    })
    .on('error', (e) => {
      console.log('NPM HOST ERR', e.message, e.code);
      resolve();
    });
});
