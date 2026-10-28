import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// petri-live (scripts/petri-live.ps1) keeps the dev TUI's petri builds in
// %LOCALAPPDATA%\petri-live\bin, newest last, and runs them with this
// environment. With `petriLive`, the plugin runs the same build the same way,
// so DeepSeek and the TUI share one dev wallet, bots folder and research
// workspace.
export function petriLiveHome(env = process.env) {
  return env.PETRI_LIVE_HOME || (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'petri-live') : null);
}

function newestLiveBuild(home) {
  const bin = join(home, 'bin');
  let newest = null;
  for (const name of existsSync(bin) ? readdirSync(bin) : []) {
    if (!/^petri-.*\.exe$/i.test(name)) continue;
    const path = join(bin, name);
    const time = statSync(path).mtimeMs;
    if (!newest || time > newest.time) newest = { path, time };
  }
  return newest?.path ?? null;
}

/** The config with petri-live's defaults filled in where the user set none. */
export function effectiveConfig(config = {}, env = process.env) {
  if (!config.petriLive) return config;
  const home = petriLiveHome(env);
  if (!home) throw new Error('petri-live needs LOCALAPPDATA or PETRI_LIVE_HOME.');
  const researchPort = config.researchPort || 4285;
  return {
    profile: 'dev', api: 'http://127.0.0.1:4500', rpc: 'http://127.0.0.1:8899',
    configPath: join(home, 'petri', 'config.json'),
    stateDirectory: join(home, 'research'), researchPort,
    // Petri's research agents ignore PETRI_RESEARCH_PORT and pair with 127.0.0.1:4185 unless
    // told otherwise, and an agent profile stays with the workspace it first logged in to:
    // petri-live's agents get its workspace and profiles of their own.
    workspaceUrl: `http://127.0.0.1:${researchPort}`, profileDirectory: join(home, 'research-agents'),
    ...config, petriLiveHome: home,
  };
}

export function executable(config = {}, env = process.env, platform = process.platform) {
  if (config.executable) return config.executable;
  if (config.petriLive) {
    const build = newestLiveBuild(config.petriLiveHome || petriLiveHome(env));
    if (!build) throw new Error('No petri-live build yet. Run petri-live once so it fetches one.');
    return build;
  }
  if (env.PETRI_BIN) return env.PETRI_BIN;
  if (platform === 'win32' && env.LOCALAPPDATA) {
    const path = join(env.LOCALAPPDATA, 'Programs', 'Petri', 'petri.exe');
    if (existsSync(path)) return path;
  }
  return 'petri';
}

export function petriEnv(config = {}, env = process.env) {
  return {
    ...env, NO_COLOR: '1', PETRI_UPDATE_CHECK: '0',
    ...(config.stateDirectory ? { PETRI_RESEARCH_HOME: config.stateDirectory } : {}),
    ...(config.configPath ? { PETRI_CONFIG_PATH: config.configPath } : {}),
    ...(config.researchPort ? { PETRI_RESEARCH_PORT: String(config.researchPort) } : {}),
  };
}

export function validateArgs(args) {
  if (!Array.isArray(args) || !args.length || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
    throw new Error('Provide Petri arguments as an array of strings.');
  }
  // Petri owns its grammar. Preserve global options and newly added commands.
  return args;
}

export function connectionArgs(config = {}) {
  return ['profile', 'api', 'rpc', 'keypair', 'deployment'].flatMap(key =>
    config[key] ? [`--${key}`, String(config[key])] : []);
}

export class PetriProcess {
  constructor(config = {}, options = {}) {
    this.config = config;
    this.spawn = options.spawn || spawn;
    this.children = new Set();
    this.closed = false;
  }

  argv(args, json) {
    return [...connectionArgs(this.config), ...(json ? ['--json'] : []), ...args];
  }

  async run(args, { signal, json = true } = {}) {
    validateArgs(args);
    if (this.closed) throw new Error('The Petri plugin was unloaded.');
    signal?.throwIfAborted();
    const argv = this.argv(args, json);
    const command = executable(this.config);
    return new Promise((resolve, reject) => {
      // No shell, no automatic write retries, and no inherited interactive stdin.
      const child = this.spawn(command, argv, {
        shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: petriEnv(this.config),
      });
      this.children.add(child);
      let stdout = '', stderr = '', settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        this.children.delete(child);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value);
      };
      const abort = () => {
        child.kill();
        finish(new Error('Petri command cancelled. If it submitted a transaction, reconcile its signature before retrying.'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => finish(new Error(error.code === 'ENOENT'
        ? 'Petri was not found. Install Petri or set the plugin executable path.'
        : `Could not start Petri: ${error.message}`)));
      child.on('close', (code, killedBy) => {
        let value;
        try { value = JSON.parse(stdout); } catch { /* Help and version are text. */ }
        // A write that already landed and failed a later step (a reveal after its commit)
        // comes back whole: what landed, and the command that finishes it.
        const landed = code === 0 && value?.ok === false && Array.isArray(value.transactions) && value.transactions.length > 0;
        if (!landed && (code !== 0 || value?.ok === false)) {
          const detail = value?.error?.message || value?.error || stderr.trim() || stdout.trim();
          finish(new Error(typeof detail === 'string' && detail ? detail : `Petri exited ${code ?? killedBy}.`));
        } else {
          finish(null, { data: value?.data ?? value ?? { text: stdout.trim() }, stderr: stderr.trim() });
        }
      });
    });
  }

  /**
   * A long-running Petri (`petri bots serve`) with a stdin to talk to. The
   * caller owns it: it is not killed with the one-shot commands, because
   * closing its stdin is how it stops cleanly. Detached, so that if Harness
   * dies outright (Windows kills an ordinary child with its parent's job), the
   * child outlives it long enough to read the closed stdin and take its bots'
   * ladders down.
   */
  open(args) {
    validateArgs(args);
    if (this.closed) throw new Error('The Petri plugin was unloaded.');
    return this.spawn(executable(this.config), this.argv(args, true), {
      shell: false, windowsHide: true, detached: true, stdio: ['pipe', 'pipe', 'pipe'], env: petriEnv(this.config),
    });
  }

  dispose() {
    this.closed = true;
    for (const child of this.children) child.kill();
    this.children.clear();
  }
}
