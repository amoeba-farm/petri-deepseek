import { createHash } from 'node:crypto';

// Petri for DeepSeek keeps itself current the way petri does
// (cli/src/release_update): it reads the latest release of its public
// repository on start and every six hours, checks the archive against the
// SHA-256 GitHub recorded for it, and once no Petri call is running hands the
// release's address to Harness's own plugin manager, which installs it over
// this copy with its usual compatibility checks. A copy installed from a file
// or a link (a development install) is never replaced. The same pass keeps the
// installed petri current through `petri update`, since someone using Petri
// only from DeepSeek may never open the TUI that updates it.

export const REPOSITORY = 'amoeba-farm/petri-deepseek';
export const PACKAGE = '@amoeba/dsh-petri';
export const RELEASES = `https://github.com/${REPOSITORY}/releases/download/`;
export const EVERY = 6 * 60 * 60 * 1000;
const MAX_ARCHIVE = 16 * 1024 * 1024;
const MAX_METADATA = 1024 * 1024;
// Where a release download may lead (petri's updater allows the same).
const HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

/** `X.Y.Z` as numbers, or null for anything else (prereleases included). */
export function version(text) {
  const match = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(String(text ?? ''));
  return match ? match.slice(1).map(Number) : null;
}

export function newer(candidate, current) {
  const a = version(candidate), b = version(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

export function archiveName(number) { return `amoeba-dsh-petri-${number}.tgz`; }

/** The release GitHub calls latest, or an error naming what is wrong with it. */
export function parseRelease(data) {
  const number = /^v(.+)$/.exec(data?.tag_name ?? '')?.[1];
  if (!version(number)) throw new Error('The latest release has no vX.Y.Z tag.');
  if (data.draft || data.prerelease) throw new Error('The latest release is a draft or prerelease.');
  if (data.html_url !== `https://github.com/${REPOSITORY}/releases/tag/v${number}`) throw new Error('The release is not from Petri’s repository.');
  const name = archiveName(number);
  const asset = (data.assets ?? []).find(a => a?.name === name);
  if (!asset) throw new Error(`The release has no ${name}.`);
  const url = `${RELEASES}v${number}/${name}`;
  if (asset.browser_download_url !== url) throw new Error('The archive is not on Petri’s release page.');
  const sha256 = /^sha256:([0-9a-f]{64})$/.exec(asset.digest ?? '')?.[1];
  if (!sha256) throw new Error('The archive has no SHA-256 from GitHub.');
  if (!Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_ARCHIVE) throw new Error('The archive size is wrong.');
  return { version: number, url, size: asset.size, sha256 };
}

async function bounded(response, limit) {
  const length = Number(response.headers.get('content-length'));
  if (length > limit) throw new Error('The download is too large.');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { await reader.cancel(); throw new Error('The download is too large.'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** GET with redirects followed only to GitHub's own hosts. */
async function get(fetch, url, { accept, limit, signal }) {
  for (let hops = 0; hops < 5; hops++) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !(HOSTS.has(target.hostname) || target.hostname === 'api.github.com')) {
      throw new Error(`Refused a download from ${target.hostname}.`);
    }
    const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: accept, 'User-Agent': 'petri-deepseek-updater' } });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
    return bounded(response, limit);
  }
  throw new Error('Too many redirects.');
}

export async function latestRelease(fetch, signal) {
  const bytes = await get(fetch, `https://api.github.com/repos/${REPOSITORY}/releases/latest`, { accept: 'application/vnd.github+json', limit: MAX_METADATA, signal });
  return parseRelease(JSON.parse(bytes.toString('utf8')));
}

/** Downloads the archive and checks it is the file GitHub recorded. */
export async function verify(fetch, release, signal) {
  const bytes = await get(fetch, release.url, { accept: 'application/octet-stream', limit: MAX_ARCHIVE, signal });
  if (bytes.length !== release.size || createHash('sha256').update(bytes).digest('hex') !== release.sha256) {
    throw new Error('The archive does not match its SHA-256 on GitHub.');
  }
}

/** How this copy was installed: a release address updates, anything else does not. */
export async function installedFromRelease(manager) {
  const bundles = await manager.listBundles();
  const source = bundles.find(bundle => bundle.name === PACKAGE)?.source;
  return typeof source === 'string' && source.startsWith(RELEASES);
}

export class Updater {
  /**
   * @param {object} options
   * @param {() => object | undefined} options.manager Harness's plugin manager, while it is there.
   * @param {string} options.current This package's version.
   * @param {() => boolean} options.idle Whether no Petri call is running.
   * @param {(args: string[]) => Promise<any>} options.petri Runs a one-shot petri command (JSON).
   * @param {boolean} options.updatesPetri Whether petri is the installed one, not a configured build.
   */
  constructor({ manager, current, idle, petri, updatesPetri, fetch = globalThis.fetch, logger = console, every = EVERY, retry = 60 * 1000 }) {
    Object.assign(this, { manager, current, idle, petri, updatesPetri, fetch, logger, every, retry });
    this.installed = null; // the version handed to the plugin manager, applied at the latest on restart
    this.pending = null;
    this.timer = null;
    this.controller = new AbortController();
  }

  start(delay = 0) { this.schedule(delay); }

  schedule(delay) {
    clearTimeout(this.timer);
    if (this.controller.signal.aborted) return;
    this.timer = setTimeout(() => this.tick().catch(error => this.logger.warn?.(`Petri update: ${error.message}`)), delay);
    this.timer.unref?.();
  }

  async tick() {
    if (this.checking) return;
    this.checking = true;
    const signal = this.controller.signal;
    try {
      if (!this.pending) this.pending = await this.find(signal);
      if (this.pending && !this.idle()) return this.schedule(this.retry); // after the running call
      if (this.pending) await this.apply(this.pending.plugin, this.pending.petri, signal);
      this.pending = null;
      this.schedule(this.every);
    } catch (error) {
      this.pending = null;
      this.schedule(this.every);
      throw error;
    } finally {
      this.checking = false;
    }
  }

  /** What is newer: this plugin's release and petri, each or neither. */
  async find(signal) {
    let plugin = null, petri = false;
    const manager = this.manager();
    if (manager && await installedFromRelease(manager)) {
      const release = await latestRelease(this.fetch, signal);
      if (newer(release.version, this.installed ?? this.current)) plugin = release;
    }
    if (this.updatesPetri) {
      const info = await this.petri(['update', 'info']);
      if (info?.channel === 'preview') petri = !!(await this.petri(['update', 'check']))?.updateAvailable;
    }
    return plugin || petri ? { plugin, petri } : null;
  }

  async apply(plugin, petri, signal) {
    if (petri) {
      // petri verifies its own download and installs once the command exits.
      await this.petri(['update', '--yes']);
      this.logger.info?.('Petri update: petri is updating itself.');
    }
    if (plugin) {
      await verify(this.fetch, plugin, signal);
      const manager = this.manager();
      if (!manager) return;
      const result = await manager.installBundle(plugin.url, { saveExact: true });
      if (result?.error || ['failed', 'cancelled'].includes(result?.application)) {
        throw new Error(result?.error?.message || `Harness could not install Petri ${plugin.version}.`);
      }
      // With hot reload the new copy replaces this one now; otherwise at Harness's next start.
      this.installed = plugin.version;
      this.logger.info?.(`Petri update: ${plugin.version} installed (${result?.application ?? 'applied'}).`);
    }
  }

  dispose() {
    this.controller.abort();
    clearTimeout(this.timer);
  }
}
