import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
assert.deepEqual(lock.packages[''].peerDependencies, manifest.peerDependencies);
assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(manifest.dsh.client.platform, 'web');
for (const path of Object.values(manifest.exports)) {
  if (!path.includes('*')) await readFile(new URL(`../${path}`, import.meta.url));
}
for (const file of ['index.js','tools.js','client.js',...(await readdir(new URL('../lib/',import.meta.url))).filter(f=>f.endsWith('.mjs')).map(f=>`lib/${f}`)]) {
  const result = spawnSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit',windowsHide:true});
  assert.equal(result.status,0,`Syntax check: ${file}`);
}
const patch = await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
assert.ok(patch.includes(`name: '${manifest.name}'`));
assert.ok(patch.includes(`name: '${manifest.name}/tools'`));
console.log('Petri bundle metadata, exports, lockfile and JavaScript checks passed.');
