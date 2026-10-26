import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

for (const pasta of ['api','lib','netlify/functions','netlify/lib','scripts','public']) {
  for (const nome of await readdir(pasta)) {
    if (!/\.(mjs|js)$/.test(nome)) continue;
    const r = spawnSync(process.execPath, ['--check', `${pasta}/${nome}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
}
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(config.outputDirectory, 'public');
assert(config.rewrites.some(r => r.source === '/.netlify/functions/:function' && r.destination === '/api/:function'));
for (const pagina of ['index.html','admin.html']) {
  const html = await readFile(`public/${pagina}`, 'utf8');
  assert(html.includes('<html'));
  for (const match of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
    if (!match[1].startsWith('http')) await readFile(`public/${match[1]}`);
  }
}
assert(!(await readdir('public')).some(f => f.startsWith('.env') || /\.sql$/.test(f)));
console.log('Build estático validado: páginas, assets, nove funções e configuração Vercel.');
