import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import z from '@deepseek-ai/schemastery';
import { PetriProcess, effectiveConfig, executable } from './lib/process.mjs';
import { Bots, validateBotInput } from './lib/bots.mjs';
import { agentName, researchArgs, RESEARCH, validateInput } from './lib/research.mjs';
import { MARKET, validateMarketInput } from './lib/market.mjs';
import { Workspace } from './lib/workspace.mjs';
import { Updater } from './lib/update.mjs';
import manifest from './package.json' with { type: 'json' };

const initializers = [];

/** Petri operations travel through DeepSeek's existing authenticated Gateway. */
export default class Petri extends TypertRemoteService {
  static Config = z.object({
    executable: z.string().description('Petri executable path. Defaults to PETRI_BIN or the installed Petri.'),
    profile: z.string().description('Petri connection profile.'),
    api: z.string().description('Petri API origin override.'),
    rpc: z.string().description('Solana RPC override.'),
    keypair: z.string().description('Existing local keypair file path. Never enter key material.'),
    deployment: z.string().description('Petri deployment manifest path.'),
    stateDirectory: z.string().description('Existing local Petri research workspace directory.'),
    workspaceUrl: z.string().description('Research agent workspace URL; owner controls use the local workspace.'),
    profileDirectory: z.string().description('Private storage directory for research agent identities.'),
    petriLive: z.boolean().description('Use the dev TUI’s petri (petri-live): its newest build, dev chain, wallet, bots and research workspace.'),
    configPath: z.string().description('Petri config file (PETRI_CONFIG_PATH); its folder holds the wallet settings and bots/.'),
    researchPort: z.natural().description('Research workspace port (PETRI_RESEARCH_PORT).'),
    botsExecutable: z.string().description('A petri with `petri bots serve` for trading bots only, while the build that runs everything else has none yet.'),
  });

  constructor(ctx, config = {}) {
    super(ctx, 'petri');
    for (const initialize of initializers) initialize.call(this);
    this.config = effectiveConfig(config);
    this.process = new PetriProcess(this.config);
    this.workspace = new Workspace(this.process, this.config);
    // Bots may run on their own build (botsExecutable) until the main one has them.
    this.botsProcess = this.config.botsExecutable ? new PetriProcess({ ...this.config, executable: this.config.botsExecutable }) : this.process;
    this.bots = new Bots(this.botsProcess);
    if (this.botsProcess !== this.process) ctx.effect(() => () => this.botsProcess.dispose(), 'petri.bots.processes');
    ctx.effect(() => () => this.process.dispose(), 'petri.processes');
    // Disposed first (effects unwind last first): running bots take their
    // ladders down and return their cash before the plugin goes away.
    ctx.effect(() => () => this.bots.dispose(), 'petri.bots');
    ctx.effect(() => { this.bots.resume().catch(() => {}); }, 'petri.bots.resume');
    // Updates this plugin from its releases through Harness's plugin manager,
    // and the installed petri through petri's own updater (lib/update.mjs).
    let manager;
    this.updater = new Updater({
      manager: () => manager, current: manifest.version, idle: () => this.idle(),
      petri: async args => (await this.process.run(args)).data,
      updatesPetri: !this.config.petriLive,
    });
    ctx.effect(() => { this.updater.start(); return () => this.updater.dispose(); }, 'petri.updates');
    ctx.inject(['pluginManager'], inner => {
      manager = inner.pluginManager;
      this.updater.start();
      inner.effect(() => () => { manager = undefined; });
    });
  }

  /** No Petri call is running: an update can replace this copy now. */
  idle() {
    return !this.process.children.size && !this.botsProcess.children.size && !this.bots.waiters.size;
  }

  async invoke(request, signal) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Invalid Petri request.');
    if (request.action === 'info') {
      const result = await this.process.run(['--version'], { signal, json: false });
      return { ...result.data, executable: executable(this.config), petriLive: !!this.config.petriLive, workspaceUrl: this.config.workspaceUrl || null };
    }
    if (request.action === 'command') return (await this.process.run(request.args, { signal })).data;
    // Market reads and the agent's trades (petri_order, petri_cancel, petri_close confirm in their argv).
    if (request.action === 'market') {
      const definition = MARKET.find(tool => tool.name === request.tool);
      if (!definition) throw new Error('Unknown Petri market tool.');
      return (await this.process.run(definition.args(validateMarketInput(definition, request.input || {})), { signal })).data;
    }
    if (request.action === 'workspace') return this.workspace.invoke(request.operation, request.input, signal);
    if (request.action === 'bots') {
      const input = validateBotInput(request.op, request.input || {});
      const opt = (flag, value) => value === undefined ? [] : [flag, value];
      switch (request.op) {
        case 'list': return request.open ? this.bots.open() : this.bots.list(signal);
        case 'read': return this.bots.read(['read', input.bot], signal);
        case 'write': return this.bots.write(input.text);
        case 'new': return this.bots.create(input.market);
        case 'set': return this.bots.set(input.bot, input.weight, input.value);
        case 'start': return this.bots.start(input.bot, input.budget);
        case 'stop': return this.bots.stop(input.bot);
        case 'publish': return this.bots.publish(input.bot, input.github);
        case 'remove': return this.bots.remove(input.bot);
        case 'install': return this.bots.install(input.id, input.market, input.github);
        // The registry's reads, straight from petri.
        case 'discover': return this.bots.read(['discover', ...opt('--market', input.market), ...opt('--sort', input.sort), ...opt('--days', input.days)], signal);
        case 'show': return this.bots.read(['show', input.id], signal);
        case 'leaderboard': return this.bots.read(['leaderboard', ...opt('--days', input.days)], signal);
      }
    }
    if (request.action === 'research') {
      const definition = RESEARCH.find(tool => tool.name === request.tool);
      if (!definition) throw new Error('Unknown Petri research operation.');
      const input = validateInput(definition, request.input || {});
      const agent = agentName(request.sessionId);
      const data = (await this.process.run(['research', ...definition.args(input), ...researchArgs(this.config, agent)], { signal })).data;
      return definition.compact ? definition.compact(data) : data;
    }
    throw new Error('Unknown Petri operation.');
  }
}

// Standard Remote decorator semantics, expressed in JavaScript so installation
// needs no compiler. The Gateway supports source reflection for external plugins
// and validates the named request/signal signature before invoking the method.
Remote('invoke')(Petri.prototype.invoke, {
  kind: 'method', name: 'invoke', static: false, private: false,
  addInitializer(initialize) { initializers.push(initialize); },
});
