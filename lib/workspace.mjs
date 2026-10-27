import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export function stateDirectory(config = {}, env = process.env) {
  return resolve(config.stateDirectory || env.PETRI_RESEARCH_HOME ||
    join(env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'PetriResearch'));
}

const operations = {
  snapshot: ['GET', '/v1/owner/snapshot', []],
  address: ['POST', '/v1/owner/settings', ['payoutAuthority']],
  approve: ['POST', '/v1/owner/pairings/approve', ['pairingId']],
  reject: ['POST', '/v1/owner/pairings/reject', ['pairingId']],
  revoke: ['POST', '/v1/owner/agents/revoke', ['agentId']],
  focus: ['POST', '/v1/owner/work/focus', ['workId', 'focused']],
  refine: ['POST', '/v1/owner/work/refine', ['workId', 'instruction']],
  archive: ['POST', '/v1/owner/work/archive', ['workId']],
  discover: ['POST', '/v1/owner/discovery/refresh', []],
};

/** Adapt the existing owner API. Credentials never cross the host boundary. */
export class Workspace {
  constructor(process, config = {}, fetchImpl = fetch) {
    this.process = process; this.config = config; this.fetch = fetchImpl;
    this.ready = null;
  }

  async ensure(signal) {
    // Let Petri own creation, permissions, migrations and service startup.
    if (!this.ready) {
      this.ready = this.process.run(['research', 'owner', 'snapshot', '--state-dir', stateDirectory(this.config)], { signal })
        .catch(error => { this.ready = null; throw error; });
    }
    await this.ready;
  }

  async invoke(operation, input = {}, signal) {
    const spec = operations[operation];
    if (!spec) throw new Error('Unknown workspace operation.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid workspace input.');
    const [method, path, fields] = spec;
    const allowed = operation === 'snapshot' ? ['agentId'] : fields;
    if (Object.keys(input).some(key => !allowed.includes(key)) || fields.some(key => !(key in input))) throw new Error('Unexpected workspace fields.');
    for (const [key, value] of Object.entries(input)) {
      if (key === 'focused' ? typeof value !== 'boolean' : typeof value !== 'string' || value.includes('\0')) throw new Error(`Invalid ${key}.`);
    }
    await this.ensure(signal);
    const file = join(stateDirectory(this.config), 'owner.json');
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Petri workspace configuration is not a regular private file.');
    const config = JSON.parse(await readFile(file, 'utf8'));
    if (config.version !== 1 || !/^[0-9a-f]{64}$/.test(config.ownerToken) || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
      throw new Error('Petri workspace configuration is invalid.');
    }
    const url = new URL(path, `http://127.0.0.1:${config.port}`);
    if (operation === 'snapshot' && input.agentId) url.searchParams.set('agentId', input.agentId);
    const response = await this.fetch(url, {
      method, signal, redirect: 'error',
      headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
    }).catch(error => {
      // A later explicit request can restart a stopped workspace. Never replay
      // this request: a lost response does not establish whether a write ran.
      this.ready = null;
      throw error;
    });
    const value = await response.json();
    if (!response.ok || value.ok === false) throw new Error(value.error?.message || 'The Petri workspace could not complete this action.');
    return value.data ?? value;
  }
}
