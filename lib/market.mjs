// Market reads and trade actions for the agent: tools only, with nothing drawn
// for them in the harness (people trade on the site; agents trade here, and
// both go through the same API). Each tool maps onto one public Petri
// command; Petri owns pricing, its checks, signing and sending.

const str = description => ({ type: 'string', description });
const amount = description => ({ type: 'number', description });
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const market = str('Symbol (ramx: the open market expiring first), name (ramx-nov26) or address');
const owner = str('Optional wallet address; omit for the local Petri wallet');
const opt = (flag, value) => value === undefined ? [] : [flag, String(value)];

const ORDER = {
  side: { type: 'string', enum: ['long', 'short'], description: 'long buys the range, short sells it' },
  market,
  lots: amount('Lots to trade; omit when usd is given'),
  usd: amount('Spend about this much USDC instead of naming lots'),
  leverage: amount('Sets where the range ends on the losing side (Petri default 10)'),
  to: amount('Where the range ends on the winning side (default: the suggested range)'),
  range: str('The whole range instead, e.g. 90-120'),
  limit: amount('Limit entry; what does not fill rests on the book'),
};

/** The argv shared by a quote and the order it prices. */
export function orderArgs(input) {
  return [input.side, input.market, ...(input.lots === undefined ? [] : [String(input.lots)]),
    ...opt('--usd', input.usd), ...opt('-x', input.leverage), ...opt('--to', input.to),
    ...opt('--range', input.range), ...opt('--limit', input.limit)];
}

// Nothing is drawn for these in the chat, so the reply carries what matters.
const PLAIN = ' Nothing is drawn for this in the chat: tell the user what matters in a sentence or two. Write money as 4.73 USDC, not with a dollar sign (the chat renders text between dollar signs as math).';
// A trade is sent as soon as the tool runs: the call is the decision.
const SENT = ' It is sent at once from the user’s Petri wallet, after Petri’s own checks; use it when the user asked you to trade or set you to trade on your own, and never resend a call that may have gone through without checking petri_positions first.';
const pick = what => str(`${what} number from petri_positions, or all`);

export const MARKET = [
  { name: 'petri_markets', description: 'Read Petri futures markets (RAMX, NANDX, BATX): price, index, 24h change, expiry and suggested range. Pass market to read one.', schema: schema({ market: { ...market, description: 'Optional: one market by symbol, name or address' } }), args: a => ['markets', ...(a.market ? [a.market] : [])] },
  { name: 'petri_book', description: 'Read the order book of one market: offers and bids level by level for a range (default: the suggested range).', schema: schema({ market, range: str('Optional range, e.g. 90-120') }, ['market']), args: a => ['book', a.market, ...opt('--range', a.range)] },
  { name: 'petri_trades', description: 'Read recent trades of one market.', schema: schema({ market }, ['market']), args: a => ['trades', a.market] },
  { name: 'petri_chart', description: 'Read the price chart of one market as candles.', schema: schema({ market, window: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'all'], description: 'Window (default 24h)' } }, ['market']), args: a => ['chart', a.market, ...(a.window ? [a.window] : [])] },
  { name: 'petri_quote', description: 'Price a long or short order exactly as petri_order would send it, without sending: what fills, at what entry, what it costs and pays. A position never loses more than it cost.', schema: schema(ORDER, ['side', 'market']), args: a => ['quote', ...orderArgs(a)] },
  { name: 'petri_order', write: true, description: 'Place a long or short order: lots or usd, its range by leverage and to (or range), and an optional limit (what does not fill rests on the book).' + SENT, schema: schema(ORDER, ['side', 'market']), args: a => [...orderArgs(a), '--yes'] },
  { name: 'petri_cancel', write: true, description: 'Cancel a resting order, or all of them in a market; its cash goes back to the wallet.' + SENT, schema: schema({ market, order: pick('Order') }, ['market', 'order']), args: a => ['cancel', a.market, a.order, '--yes'] },
  { name: 'petri_close', write: true, description: 'Close a position (sell a long, buy back a short), or all of them in a market; lots closes part of one.' + SENT, schema: schema({ market, position: pick('Position'), lots: amount('Optional: close only this many lots') }, ['market', 'position']), args: a => ['close', a.market, a.position, ...opt('--lots', a.lots), '--yes'] },
  { name: 'petri_positions', description: 'Read positions (numbered), resting orders (numbered) and cash per market with P&L.', schema: schema({ owner }), args: a => ['positions', ...(a.owner ? [a.owner] : [])] },
  { name: 'petri_wallet', description: 'Read a wallet: SOL, USDC, cash in each market and oracle bond collateral.', schema: schema({ owner }), args: a => ['wallet', ...(a.owner ? [a.owner] : [])] },
  { name: 'petri_history', description: 'Read trades, orders, deposits and settlements of a wallet.', schema: schema({ owner }), args: a => ['history', ...(a.owner ? [a.owner] : [])] },
  { name: 'petri_oracle', description: 'Read the index oracle: months (phase, sources, settlement), the latest month, history, the catalog of periods, a month\'s sources or recipe, research candidates, rewards, sponsorships or bond collateral.', schema: schema({ view: { type: 'string', enum: ['months', 'latest', 'history', 'catalog', 'sources', 'recipe', 'candidates', 'rewards', 'sponsorships', 'collateral'], description: 'What to read' }, market: { ...market, description: 'Optional market or month' } }, ['view']), args: a => ['oracle', a.view, ...(a.market ? [a.market] : [])] },
];

// Raw JSON-Schema tools own validation; repeat it here so a value can never
// become a Petri flag (a leading '-') or carry a NUL into the argv.
export function validateMarketInput(definition, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object.');
  const spec = definition.schema;
  for (const key of Object.keys(input)) if (!Object.hasOwn(spec.properties, key)) throw new Error(`Unknown field: ${key}`);
  for (const key of spec.required) if (input[key] === undefined) throw new Error(`Missing field: ${key}`);
  const clean = {};
  for (const [key, raw] of Object.entries(input)) {
    if (raw === undefined || raw === null || raw === '') continue;
    // A switch stays a boolean; the argv builder turns it into its flag.
    if (spec.properties[key].type === 'boolean') {
      if (typeof raw !== 'boolean') throw new Error(`Invalid ${key}.`);
      clean[key] = raw;
      continue;
    }
    const value = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw;
    if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.trim().startsWith('-')) throw new Error(`Invalid ${key}.`);
    if (spec.properties[key].enum && !spec.properties[key].enum.includes(value)) throw new Error(`Invalid ${key}.`);
    clean[key] = value.trim();
  }
  return clean;
}

// The oracle's reads are drawn as cards (research has a UI); trading has none.
for (const tool of MARKET) if (tool.name !== 'petri_oracle') tool.description += PLAIN;

export const QUOTE = MARKET.find(tool => tool.name === 'petri_quote');
/** The tools the harness draws nothing for: market reads and trade actions. */
export const TRADE_TOOLS = MARKET.filter(tool => tool.name !== 'petri_oracle').map(tool => tool.name);
