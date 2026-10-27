import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

// Trading bots, as petri runs them (cli/src/research/bots.rs, contract in
// cli/docs/bots.md): one file a bot in petri's bots/ folder, built in the chat
// by the agent, each trading from a wallet of its own, published to and
// installed from the futures API's registry, which ranks them on real P&L.
// The plugin owns one `petri bots serve` while Harness runs, started on first
// use like the TUI's worker. Its lifetime is a Cordis effect: disposing closes
// its stdin, and petri takes every ladder and order down and moves the bots'
// cash back to the main wallet before it says "down". A bot runs in one petri
// at a time (petri locks it), so the TUI and DeepSeek never run one bot twice.

export const KNOBS = ['budget', 'fraction', 'spread_bps', 'vol', 'half_width', 'tiers', 'tier_bps', 'tier_ratio', 'skew'];
const ID = /^[A-Za-z0-9_-]+$/;
// A bot on GitHub: OWNER/REPO, then an optional path to its file and @ref.
const GITHUB = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.\/-]+)?(@[A-Za-z0-9_.\/-]+)?$/;
const SORTS = ['pnl', 'new', 'runs'];
const WINDOWS = ['7', '30', '90'];

// Each operation's fields; a `?` marks an optional one.
const FIELDS = {
  list: [], read: ['bot'], write: ['text'], new: ['market'], set: ['bot', 'weight', 'value'],
  start: ['bot', '?budget'], stop: ['bot'], publish: ['bot', '?github'], remove: ['bot'],
  discover: ['?market', '?sort', '?days'], show: ['id'], install: ['?id', '?github', '?market'], leaderboard: ['?days'],
};

export function validateBotInput(op, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object.');
  const fields = FIELDS[op];
  if (!fields) throw new Error('Unknown bots operation.');
  const names = fields.map(f => f.replace('?', ''));
  for (const key of Object.keys(input)) if (!names.includes(key)) throw new Error(`Unknown field: ${key}`);
  const out = {};
  for (const field of fields) {
    const key = field.replace('?', ''), raw = input[key];
    if (field.startsWith('?') && (raw === undefined || raw === null || raw === '')) continue;
    const value = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw;
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`Missing field: ${key}`);
    // A bot's file keeps its own whitespace; every other field is a word or a number.
    out[key] = key === 'text' ? value : value.trim();
  }
  if (out.bot !== undefined && !ID.test(out.bot)) throw new Error('A bot id is letters, digits, - and _.');
  if (out.id !== undefined && !ID.test(out.id)) throw new Error('A published bot’s id is letters, digits, - and _.');
  if (out.github !== undefined && (!GITHUB.test(out.github) || out.github.split(/[/@]/).some(part => part === '..' || part === '.'))) throw new Error('A GitHub bot is OWNER/REPO, then optionally /path/to/file.toml and @ref.');
  if (op === 'install' && (out.id === undefined) === (out.github === undefined)) throw new Error('Install a published bot by id, or a bot on GitHub by github.');
  if (out.days !== undefined && op === 'discover' && out.sort !== undefined && out.sort !== 'pnl') throw new Error('Days goes with sort pnl.');
  if (out.market !== undefined && out.market.startsWith('-')) throw new Error('Invalid market.');
  if (out.weight !== undefined && !KNOBS.includes(out.weight)) throw new Error(`Bots have no weight called ${out.weight} (one of: ${KNOBS.join(', ')}).`);
  if (out.value !== undefined && !Number.isFinite(Number(out.value))) throw new Error(`${out.value} is not a number.`);
  if (out.budget !== undefined && !(Number(out.budget) > 0)) throw new Error(`${out.budget} is not an amount of USDC.`);
  if (out.sort !== undefined && !SORTS.includes(out.sort)) throw new Error(`Sort by one of: ${SORTS.join(', ')}.`);
  if (out.days !== undefined && !WINDOWS.includes(out.days)) throw new Error(`Days is one of: ${WINDOWS.join(', ')}.`);
  return out;
}

const botId = { type: 'string', description: 'The bot’s id, from petri_bots' };
const registryId = { type: 'string', description: 'The published bot’s id, from petri_bots_discover or petri_bots_leaderboard' };
const market = { type: 'string', description: 'Symbol (ramx), name (ramx-nov26) or address' };
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const CARD = ' The user sees the result as a card in the chat (and in the Bots tab beside it) with its state, P&L and buttons; reply in a sentence or two, without repeating its numbers. Write money as 4.73 USDC, not with a dollar sign.';

// What the agent needs to write a bot from what the user says in chat; the
// contract is cli/docs/bots.md.
const BUNDLE = `A bot is one TOML file. [bot]: id (letters, digits, - and _), market (a product like nandx: it trades the front month and moves to the next as each one ends, so a hold rolls; or one month like ramx-nov26), name, about (its thesis in one line), budget (USDC its own wallet gets when it starts; default 100). Then [[row]]s, each a part with an id and a kind:
- kind = "strategy/script" with source = '''...''': a Rhai script defining fn tick(m), called every 2 seconds. m: market, symbol, index (the reference index now), step, low, high (the grid's ends), expiry_in (seconds), now, tradable, cash (USDC it can still use), budget, holdings (array of #{side: "long"|"short", low, high, lots, cost, value}, this month), held (the same, every month, with market), orders (resting orders), ladder (bool), history (array of #{t, v}: the index once a minute over 24 h), change(secs) (fractional change of the index over that time), prob_above(x) (chance the index settles above x), vol, memory (a map it may write, kept between ticks). Actions: long(#{usd: 10, leverage: 5}) and short(#{...}) take the keys of petri long/short: usd or lots, leverage, to, range ("90-120"), limit, post, slippage; close(#{}) closes everything (#{range: "90-120"} or #{side: "long"} narrows it); cancel() cancels its resting orders; say("...") sets its one-line status. tick runs every 2 s, so guard actions with m.holdings, m.orders or m.memory or it trades on every tick.
- the house maker's market-making ladder: rows of kind "weights" (vol, half_width, spread_bps, tiers, tier_bps, tier_ratio, skew, fraction), "signal/normal-fair", "signal/inventory-skew" and "strategy/ladder" (petri_bot_new writes one).
A script sees no files, network or keys; petri checks every order and signs it with the bot's own wallet, which holds only its budget.`;

// The agent builds bots from the chat; the Bots tab shows them and has no
// fields to type into. A started bot trades its own wallet, funded from the
// user's with its budget, so start one only when the user asks for it.
export const BOT_TOOLS = [
  { name: 'petri_bots', op: 'list', description: 'List the user’s petri trading bots: market, running or not, why one can’t run, its P&L, what it holds and its own wallet.' + CARD, schema: schema() },
  { name: 'petri_bot_read', op: 'read', description: 'Read one of the user’s bots as its TOML file, to change it and write it back with petri_bot_write.' + CARD, schema: schema({ bot: botId }, ['bot']) },
  { name: 'petri_bot_write', op: 'write', description: `Write a new bot, or replace the bot with the same id, from what the user asks for in the chat. Petri checks the file (every part builds, the script compiles) before saving it; a running bot picks the change up. It trades only once started. ${BUNDLE}` + CARD, schema: schema({ text: { type: 'string', description: 'The whole bot file (TOML)' } }, ['text']) },
  { name: 'petri_bot_new', op: 'new', description: 'Write a market-making bot for a market: the house maker’s ladder with its weights, budget 100 USDC. It trades only once started.' + CARD, schema: schema({ market }, ['market']) },
  { name: 'petri_bot_set', op: 'set', description: `Set one weight of a ladder bot; a running bot picks it up at once, and a value it can't run with is refused. Weights: budget (USDC its wallet gets), fraction (share of the budget it quotes), spread_bps (half spread, bps of a step), vol (yearly volatility it assumes), half_width (steps each side at full depth), tiers, tier_bps (extra spread per tier), tier_ratio (lots per tier, % of the last), skew (lean per lot held, atoms).` + CARD, schema: schema({ bot: botId, weight: { type: 'string', enum: KNOBS, description: 'Which weight' }, value: { type: 'number', description: 'Its new value' } }, ['bot', 'weight', 'value']) },
  { name: 'petri_bot_start', op: 'start', description: 'Start a bot: petri moves its budget from the user’s wallet into the bot’s own wallet and it trades from there until stopped. Only when the user asks you to run it.' + CARD, schema: schema({ bot: botId, budget: { type: 'number', description: 'Optional: USDC to give it (saved as its budget)' } }, ['bot']) },
  { name: 'petri_bot_stop', op: 'stop', description: 'Stop a bot: its ladder and orders come down and its cash goes back to the user’s wallet. What it holds stays in its wallet.' + CARD, schema: schema({ bot: botId }, ['bot']) },
  { name: 'petri_bot_publish', op: 'publish', description: 'Publish one of the user’s bots to the marketplace so other people can install it and it ranks by its runners’ P&L; publishing it again adds a version. With github (the repository holding the same file, its [bot] author the user’s wallet) the listing is verified. Only when the user asks.' + CARD, schema: schema({ bot: botId, github: { type: 'string', description: 'Optional: OWNER/REPO[/path/to/file.toml][@ref] holding this bot (default file petri-bot.toml)' } }, ['bot']) },
  { name: 'petri_bot_remove', op: 'remove', description: 'Remove one of the user’s bots: it stops and its file is deleted (its wallet stays). Only when the user asks.' + CARD, schema: schema({ bot: botId }, ['bot']) },
  { name: 'petri_bots_discover', op: 'discover', description: 'Browse the bots marketplace: bots other people published, each a thesis it trades, with its author, whether it is verified, runs and P&L.' + CARD, schema: schema({ market: { ...market, description: 'Optional: only bots for this product or month' }, sort: { type: 'string', enum: SORTS, description: 'Optional: pnl (default), new or runs' }, days: { type: 'string', enum: WINDOWS, description: 'Optional with sort pnl: rank by the last 7, 30 or 90 days' } }) },
  { name: 'petri_bot_show', op: 'show', description: 'Read one published bot: what it does, its file, its versions, runs and P&L.' + CARD, schema: schema({ id: registryId }, ['id']) },
  { name: 'petri_bot_install', op: 'install', description: 'Install a bot as one of the user’s bots: a published one by id, or one on GitHub by github; optionally on another product or month. It trades only once started.' + CARD, schema: schema({ id: registryId, github: { type: 'string', description: 'OWNER/REPO[/path/to/file.toml][@ref] of a bot on GitHub (default file petri-bot.toml)' }, market: { ...market, description: 'Optional: run it on this market instead' } }) },
  { name: 'petri_bots_leaderboard', op: 'leaderboard', description: 'The bots leaderboard: published bots ranked by the P&L of the wallets running them.' + CARD, schema: schema({ days: { type: 'string', enum: WINDOWS, description: 'Optional: 7, 30 or 90 days (default all time)' } }) },
];

const NO_BOTS = /unrecognized subcommand|unexpected argument 'bots'|no such command/i;

export class Bots {
  constructor(process) {
    this.process = process;
    this.child = null;
    this.bots = null;
    this.notes = [];
    this.error = null;
    this.waiters = new Set();
    this.closing = null;
  }

  get serving() { return !!this.child; }

  /** Starts `petri bots serve` once; resolves with its first list. */
  ensure() {
    if (this.child) return this.ready;
    if (this.closing) return Promise.reject(new Error('The Petri plugin was unloaded.'));
    const child = this.process.open(['bots', 'serve']);
    this.child = child;
    this.bots = null;
    this.error = null;
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    createInterface({ input: child.stdout }).on('line', line => {
      let value;
      try { value = JSON.parse(line); } catch { return; }
      if (Array.isArray(value.bots)) this.bots = value.bots;
      if (typeof value.note === 'string') this.notes = [...this.notes.slice(-19), { at: Date.now(), text: value.note }];
      if (value.ok === false) this.error = value.error?.message || 'Petri could not run bots.';
      for (const waiter of [...this.waiters]) waiter.check(value);
    });
    this.ready = new Promise((resolve, reject) => {
      const first = { check: value => {
        if (Array.isArray(value.bots)) { this.waiters.delete(first); resolve(value.bots); }
        else if (value.ok === false) { this.waiters.delete(first); reject(new Error(this.explain(this.error))); }
      }, fail: error => reject(error) };
      this.waiters.add(first);
    });
    this.ready.catch(() => {});
    const gone = (error) => {
      if (this.child !== child) return;
      this.child = null;
      const reason = error || new Error(this.explain(this.error || stderr.trim() || 'petri bots serve stopped.'));
      for (const waiter of [...this.waiters]) { this.waiters.delete(waiter); waiter.fail(reason); }
    };
    child.on('error', error => gone(new Error(error.code === 'ENOENT' ? 'Petri was not found.' : `Could not start Petri: ${error.message}`)));
    child.on('exit', () => gone());
    return this.ready;
  }

  explain(message) {
    return NO_BOTS.test(message || '')
      ? 'This petri has no bots yet. Update petri (petri update) to get them.'
      : message;
  }

  /** Resolves on the first line `test` accepts; a note fails it when `notes` is set. */
  until(test, { notes = false } = {}) {
    return new Promise((resolve, reject) => {
      const waiter = {
        check: value => {
          if (notes && typeof value.note === 'string') { this.waiters.delete(waiter); reject(new Error(value.note)); return; }
          const result = test(value);
          if (result !== undefined && result !== false) { this.waiters.delete(waiter); resolve(result); }
        },
        fail: reject,
      };
      this.waiters.add(waiter);
    });
  }

  send(command) {
    if (!this.child) throw new Error('Bots are not running.');
    this.child.stdin.write(`${JSON.stringify(command)}\n`);
  }

  find(id) { return this.bots?.find(bot => bot.id === id) ?? null; }

  async list(signal) {
    if (this.child || this.bots) {
      await this.ensure();
      return { serving: true, bots: this.bots ?? [], notes: this.notes };
    }
    const data = await this.process.run(['bots'], { signal }).then(result => result.data).catch(error => { throw new Error(this.explain(error.message)); });
    return { serving: false, folder: data.folder, bots: data.bots ?? [], notes: [] };
  }

  /** Opens the worker (the Bots view's first use) and returns its list. */
  async open() {
    await this.ensure();
    return { serving: true, bots: this.bots ?? [], notes: this.notes };
  }

  create(market) { return this.command({ new: market }, 'created'); }

  async set(id, weight, value) {
    await this.ensure();
    if (!this.find(id)) throw new Error(`No bot called ${id}.`);
    const changed = this.until(line => {
      if (!Array.isArray(line.bots)) return undefined;
      const bot = line.bots.find(b => b.id === id);
      const now = bot?.weights?.find(w => w.name === weight)?.value;
      return bot && now !== undefined && Number(now) === Number(value) ? bot : undefined;
    }, { notes: true });
    this.send({ set: { bot: id, knob: weight, value } });
    return { bot: await changed };
  }

  /** Funds the bot's wallet with its budget (`budget` replaces it) and starts it. */
  async start(id, budget) {
    await this.ensure();
    if (!this.find(id)) throw new Error(`No bot called ${id}.`);
    const settled = this.until(line => {
      if (typeof line.note === 'string') return { note: line.note };
      if (!Array.isArray(line.bots)) return undefined;
      const bot = line.bots.find(b => b.id === id);
      return bot && (bot.running || bot.problem) ? bot : undefined;
    });
    this.send(budget === undefined ? { start: id } : { start: id, budget: Number(budget) });
    const bot = await settled;
    if (bot.note) throw new Error(bot.note);
    if (!bot.running) throw new Error(bot.problem);
    return { bot };
  }

  /**
   * Sends `command`, waits for its reply under `key`, then for the list to
   * show the bot it names (`bot`, or the reply when it is the bot's id).
   */
  async command(command, key, bot) {
    await this.ensure();
    // One waiter for both lines: petri may send the reply and the list after it in one chunk.
    let answer;
    const done = this.until(value => {
      if (answer === undefined) { answer = value[key]; return undefined; }
      if (!Array.isArray(value.bots)) return undefined;
      const shown = value.bots.find(b => b.id === (bot ?? answer));
      if (key === 'removed') return shown ? undefined : { removed: answer };
      return shown ? { [key]: answer, bot: shown } : undefined;
    }, { notes: true });
    this.send(command);
    return done;
  }

  write(text) { return this.command({ write: text }, 'written'); }
  publish(id, github) { return this.command({ publish: github === undefined ? id : { id, github } }, 'published', id); }
  remove(id) { return this.command({ remove: id }, 'removed', id); }
  /** Installs a published bot (`id`) or one on GitHub (`github`, sent as `github:OWNER/REPO…`). */
  install(id, market, github) {
    const source = github === undefined ? id : `github:${github}`;
    return this.command({ install: market === undefined ? { id: source } : { id: source, market } }, 'installed');
  }

  /** Reads that need no worker: a bot's file, and the registry. */
  async read(args, signal) {
    return this.process.run(['bots', ...args], { signal }).then(result => result.data).catch(error => { throw new Error(this.explain(error.message)); });
  }

  async stop(id) {
    if (!this.child) return { bot: this.find(id) };
    const stopped = this.until(line => {
      if (!Array.isArray(line.bots)) return undefined;
      const bot = line.bots.find(b => b.id === id);
      return !bot || !bot.running ? bot ?? null : undefined;
    });
    this.send({ stop: id });
    return { bot: await stopped };
  }

  /** Stops every bot: their ladders come down before petri exits. */
  /**
   * Starts the worker when bots were left running (`bots/.running`), so a bot
   * someone started runs again whenever Harness does, as it does in the TUI,
   * and after this plugin updates itself.
   */
  async resume() {
    if (this.child || this.closing) return;
    const data = await this.process.run(['bots']).then(result => result.data).catch(() => null);
    if (!data?.folder) return;
    const ids = await readFile(join(data.folder, '.running'), 'utf8').catch(() => '');
    if (ids.trim()) await this.ensure();
  }

  dispose() {
    if (this.closing) return this.closing;
    const child = this.child;
    this.closing = child ? new Promise(resolve => {
      child.once('exit', resolve);
      child.stdin.end();
    }) : Promise.resolve();
    return this.closing;
  }
}
