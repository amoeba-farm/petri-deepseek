import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RELEASES, REPOSITORY, Updater, archiveName, newer, parseRelease, verify } from '../lib/update.mjs';

const archive = Buffer.from('petri plugin archive');
const sha = createHash('sha256').update(archive).digest('hex');

function release(number, overrides = {}) {
  const name = archiveName(number);
  return {
    tag_name: `v${number}`, draft: false, prerelease: false,
    html_url: `https://github.com/${REPOSITORY}/releases/tag/v${number}`,
    assets: [{ name, browser_download_url: `${RELEASES}v${number}/${name}`, digest: `sha256:${sha}`, size: archive.length }],
    ...overrides,
  };
}

function response(status, body = '', headers = {}) {
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
}

/** GitHub as the updater sees it: the latest release, and its archive behind a redirect. */
function github(latest, { asset = archive, redirect = 'https://release-assets.githubusercontent.com/a' } = {}) {
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    if (url === `https://api.github.com/repos/${REPOSITORY}/releases/latest`) return response(200, JSON.stringify(latest));
    if (url.startsWith(RELEASES)) return response(302, '', { location: redirect });
    if (url === redirect) return response(200, asset);
    return response(404);
  };
  return { fetch, calls };
}

function manager(source) {
  const installs = [];
  return {
    installs,
    listBundles: async () => [{ name: '@amoeba/dsh-petri', source }],
    installBundle: async (spec, options) => { installs.push({ spec, options }); return { changed: true, application: 'restart-required', stage: 'install', target: spec }; },
  };
}

const quiet = { info() {}, warn() {} };
const noPetri = async () => ({ channel: 'source' });

test('versions compare as numbers and prereleases never count', () => {
  assert.ok(newer('0.10.0', '0.9.9'));
  assert.ok(!newer('0.5.0', '0.5.0'));
  assert.ok(!newer('0.4.9', '0.5.0'));
  assert.ok(!newer('0.6.0-rc.1', '0.5.0'));
});

test('a release counts only from Petri’s repository, with its archive and GitHub’s SHA-256', () => {
  assert.equal(parseRelease(release('0.5.0')).url, `${RELEASES}v0.5.0/amoeba-dsh-petri-0.5.0.tgz`);
  assert.throws(() => parseRelease(release('0.5.0', { html_url: 'https://github.com/someone/fork/releases/tag/v0.5.0' })), /repository/);
  assert.throws(() => parseRelease(release('0.5.0', { prerelease: true })), /prerelease/);
  assert.throws(() => parseRelease(release('0.5.0', { tag_name: 'latest' })), /vX\.Y\.Z/);
  const elsewhere = release('0.5.0');
  elsewhere.assets[0].browser_download_url = 'https://example.com/amoeba-dsh-petri-0.5.0.tgz';
  assert.throws(() => parseRelease(elsewhere), /release page/);
  const unhashed = release('0.5.0');
  delete unhashed.assets[0].digest;
  assert.throws(() => parseRelease(unhashed), /SHA-256/);
});

test('the archive must be the file GitHub recorded, fetched from GitHub only', async () => {
  const good = parseRelease(release('0.5.0'));
  await verify(github(release('0.5.0')).fetch, good);
  await assert.rejects(verify(github(release('0.5.0'), { asset: Buffer.from('tampered archive!!!!') }).fetch, good), /SHA-256/);
  await assert.rejects(verify(github(release('0.5.0'), { redirect: 'https://evil.example/a' }).fetch, good), /evil\.example/);
});

test('a copy installed from a release installs the newer one through Harness once Petri is idle', async () => {
  const pm = manager(`${RELEASES}v0.5.0/amoeba-dsh-petri-0.5.0.tgz`);
  let idle = false;
  const updater = new Updater({ manager: () => pm, current: '0.5.0', idle: () => idle, petri: noPetri, updatesPetri: true, fetch: github(release('0.6.0')).fetch, logger: quiet });
  try {
    await updater.tick();
    assert.equal(pm.installs.length, 0, 'waits while a Petri call runs');
    idle = true;
    await updater.tick();
    assert.deepEqual(pm.installs, [{ spec: `${RELEASES}v0.6.0/amoeba-dsh-petri-0.6.0.tgz`, options: { saveExact: true } }]);
    await updater.tick();
    assert.equal(pm.installs.length, 1, 'a release waiting for a restart is not installed twice');
  } finally { updater.dispose(); }
});

test('development installs and current copies are left alone', async () => {
  for (const source of ['file:/home/me/amoeba-dsh-petri-0.4.4.tgz', 'link:/home/me/amoeba/plugins/petri', undefined]) {
    const pm = manager(source);
    const { fetch, calls } = github(release('9.0.0'));
    const updater = new Updater({ manager: () => pm, current: '0.5.0', idle: () => true, petri: noPetri, updatesPetri: true, fetch, logger: quiet });
    await updater.tick();
    updater.dispose();
    assert.equal(pm.installs.length, 0);
    assert.equal(calls.length, 0, 'not even a release check');
  }
  const pm = manager(`${RELEASES}v0.5.0/amoeba-dsh-petri-0.5.0.tgz`);
  const updater = new Updater({ manager: () => pm, current: '0.5.0', idle: () => true, petri: noPetri, updatesPetri: true, fetch: github(release('0.5.0')).fetch, logger: quiet });
  await updater.tick();
  updater.dispose();
  assert.equal(pm.installs.length, 0);
});

test('petri updates itself only when it is a release build, and never for petri-live', async () => {
  const run = (channel, available) => {
    const calls = [];
    const petri = async args => {
      calls.push(args.join(' '));
      if (args[1] === 'info') return { channel };
      if (args[1] === 'check') return { updateAvailable: available };
      return { status: 'scheduled' };
    };
    return { calls, petri };
  };
  const release = run('preview', true);
  const updater = new Updater({ manager: () => undefined, current: '0.5.0', idle: () => true, petri: release.petri, updatesPetri: true, logger: quiet });
  await updater.tick();
  updater.dispose();
  assert.deepEqual(release.calls, ['update info', 'update check', 'update --yes']);

  const source = run('source', true);
  const dev = new Updater({ manager: () => undefined, current: '0.5.0', idle: () => true, petri: source.petri, updatesPetri: true, logger: quiet });
  await dev.tick();
  dev.dispose();
  assert.deepEqual(source.calls, ['update info']);

  const live = run('preview', true);
  const petriLive = new Updater({ manager: () => undefined, current: '0.5.0', idle: () => true, petri: live.petri, updatesPetri: false, logger: quiet });
  await petriLive.tick();
  petriLive.dispose();
  assert.deepEqual(live.calls, []);
});
