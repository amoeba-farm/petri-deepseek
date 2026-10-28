// The oracle's stages for the agent, one tool a step a person or agent takes
// (oracle/README.md, "Current instructions"), in the order a month runs:
// collateral, sources, source challenges, opening prints, Game updates, then
// the money. Petri finds what is open, computes the exact bonds, refuses what
// the program would refuse, and signs and sends; the chat draws each result as
// a card, and the Petri tab's Oracle view keeps the user's part of every stage
// in view.

const str = description => ({ type: 'string', description });
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const opt = (flag, value) => value === undefined ? [] : [flag, String(value)];

const month = str('The month, e.g. RAMX-202701');
const market = str('Optional: a product (ramx) or a month (RAMX-202701)');
const owner = str('Optional wallet address; omit for the local Petri wallet');
const file = what => str(`Absolute path of the ${what} JSON file`);
// A print cites its evidence one way: a capture of the source's page, or a web proof of it.
const CITE = {
  archiveUrl: str('A Wayback capture of the source’s exact URL: https://web.archive.org/web/<14-digit UTC time>/<source URL>'),
  evidence: str('Instead of archiveUrl: a web proof of the source’s page (petri evidence prove), by its bundle digest or file'),
};
const cite = a => [...opt('--archive-url', a.archiveUrl), ...opt('--evidence', a.evidence)];

const CARD = ' The user sees a card; answer in a sentence.';
// A write is sent as soon as the tool runs: the call is the decision.
const sent = read => ` It is sent at once from the user’s Petri wallet; never resend a call that may have gone through without checking ${read} first.`;

/** The reasons of the contributor docs, as petri names them (cli/src/oracle/challenges.rs). */
export const REASONS = ['wrong-component', 'unavailable', 'stale', 'methodology', 'duplicate', 'other'];

// The follow-up commands petri's oracle reads list (acceptCommand, revealCommand,
// expireCommand, settleCommand, nextCommand, a reward or sponsorship claim),
// each with the flags it may carry. petri_oracle_step runs one exactly as listed.
const STEPS = {
  'prints finalize': ['--source', '--expiry'],
  'prints expire': ['--source', '--expiry'],
  'updates reveal': [],
  'updates expire': ['--claim', '--expiry'],
  'stakes settle': ['--kind', '--source', '--owner', '--claim', '--challenge', '--expiry'],
  'sponsorships settle': [],
  'sponsorships claim': [],
  'rewards claim': ['--kind', '--expiry'],
};
const WORD = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** The argv of a listed follow-up command, or an error naming what is wrong with it. */
export function stepArgs(command) {
  const words = String(command).trim().split(/\s+/);
  if (words[0] === 'petri') words.shift();
  if (words[0] !== 'oracle' || !STEPS[`${words[1]} ${words[2]}`]) {
    throw new Error(`Not a follow-up command a Petri oracle read lists: ${Object.keys(STEPS).map(s => `petri oracle ${s}`).join(', ')}.`);
  }
  const flags = STEPS[`${words[1]} ${words[2]}`];
  const out = words.slice(0, 3);
  for (let i = 3; i < words.length; i++) {
    const word = words[i];
    if (word === '--yes') continue;
    if (word.startsWith('-')) {
      const value = words[i + 1];
      if (!flags.includes(word) || value === undefined || !WORD.test(value)) throw new Error(`Unexpected ${word} in the command.`);
      out.push(word, value);
      i++;
    } else if (WORD.test(word)) out.push(word);
    else throw new Error(`Unexpected ${word} in the command.`);
  }
  return [...out, '--yes'];
}

export const ORACLE = [
  // ------------------------------------------------------------ collateral
  {
    name: 'petri_collateral',
    write: true,
    description: 'Move USDC between the user’s wallet and their oracle collateral, which every bond and stake is taken from and paid back into: deposit adds to it (opening it on first use), withdraw takes available collateral back out (an amount, or all). Only when the user asks.' + sent('petri_wallet') + CARD,
    schema: schema({
      action: { type: 'string', enum: ['deposit', 'withdraw'], description: 'deposit into collateral, or withdraw to the wallet' },
      usdc: str('USDC, e.g. 25; all to withdraw everything available'),
    }, ['action', 'usdc']),
    args: a => ['oracle', 'collateral', a.action, a.usdc, '--yes'],
  },

  // --------------------------------------------------------------- sources
  {
    name: 'petri_series_template',
    description: 'A blank comparison series of a chip bucket, every field of the commodity spec present. Chip months (RAMX and NANDX expiring after 2026-11-01) take a source as one series: a contract price, a published assessment, or with direct a direct contract price of one exact part. Fill it from the publisher’s page, save it as a JSON file, check it with petri_series_check, then propose it with petri_propose_series. Nothing is drawn; say what you will fill in.',
    schema: schema({
      bucket: str('The bucket: its label (DDR5_16GBIT) or its name (DDR5 16Gb)'),
      direct: { type: 'boolean', description: 'A direct contract price of one exact part instead of an assessment' },
    }, ['bucket']),
    args: a => ['oracle', 'series', 'template', '--bucket', a.bucket, ...(a.direct ? ['--direct'] : [])],
  },
  {
    name: 'petri_series_check',
    description: 'Check a series file against the commodity spec, on its own or with month against that month’s sources on chain: its status (Counts this month, Fits the bucket, Already counted, Missing details, Wrong product, …) and every reason as field: message. Fix what it names before proposing.' + CARD,
    schema: schema({ file: file('series'), month: str('Optional: the month to check it in, e.g. RAMX-202701') }, ['file']),
    args: a => ['oracle', 'series', 'check', a.file, ...(a.month ? [a.month] : [])],
  },
  {
    name: 'petri_propose_series',
    write: true,
    description: 'Propose a checked series as a source of a chip month while the month takes sources, with the product’s exact listing bond from the user’s oracle collateral. Petri refuses a series the spec does not admit, so no bond goes on one that could not count. A source needs support to count, and others can challenge it on Scramble days 5 and 6; its bond comes back when it settles. Only when the user asks.' + sent('petri_oracle sources') + CARD,
    schema: schema({ month, file: file('series') }, ['month', 'file']),
    args: a => ['oracle', 'series', 'propose', a.month, '--file', a.file, '--yes'],
  },
  {
    name: 'petri_support_source',
    write: true,
    description: 'Support a candidate source of a month while it takes sources, with the bucket’s exact support bond from the user’s oracle collateral: a candidate without support never counts, and a supporter shares the source’s reward when it settles active. Read the source’s page first. Only when the user asks.' + sent('petri_oracle sources') + CARD,
    schema: schema({ month, source: str('The source: its 64-hex id or address'), stake: str('USDC: the bucket’s support bond (petri_oracle sources lists it)') }, ['month', 'source', 'stake']),
    args: a => ['oracle', 'sources', 'support', a.month, '--source', a.source, '--stake', a.stake, '--yes'],
  },
  {
    name: 'petri_sponsor',
    write: true,
    description: 'Sponsor a research find (a candidate from petri_oracle candidates, by its content hash) while its month takes sources: the user’s oracle collateral posts the product’s exact listing bond and the find goes on the oracle as a source. The bond comes back when the source settles, and its reward splits with the researcher. Only when the user asks.' + sent('petri_oracle sponsorships') + CARD,
    schema: schema({ candidate: str('The candidate’s content hash') }, ['candidate']),
    args: a => ['oracle', 'sponsor', a.candidate, '--yes'],
  },

  // ------------------------------------------------------ source challenges
  {
    name: 'petri_challenges',
    description: 'Read source challenges: the sources open to challenge right now (each a supported candidate in a month on Scramble days 5 and 6, with its URL, bucket, the exact bond and when the window closes) and the user’s own challenges, and those against sources they proposed, with how each stands (waiting for the ruling on day 7, upheld, dismissed, with the council, settled) and, once decided, the command that settles its bond.' + CARD,
    schema: schema({ market, owner }),
    args: a => ['oracle', 'challenges', ...(a.market ? [a.market] : []), ...opt('--owner', a.owner)],
  },
  {
    name: 'petri_challenge_source',
    write: true,
    description: 'Challenge a candidate source of an oracle month, with a bond from the user’s oracle collateral, during the month’s challenge window (Scramble days 5 and 6; petri_challenges lists what is open). Only when the user asks you to, or set you to check sources. First check the source yourself: open its page, compare what it shows with the bucket it claims (petri_oracle recipe or sources), and be sure what is wrong. Reasons: wrong-component (not the bucket’s product), unavailable (the page is gone or not public), stale (the price is not current or never changes), methodology (not a real, repeatable price), duplicate (the same feed as another source of the bucket: give comparison), other. why is what the person ruling on day 7 reads: the exact problem and what shows it (what the page says, links), in plain words. It is published on chain, public and permanent, so never put anything private in it. Petri computes the exact bond (20% of the support behind the source, 1 to 10 USDC on current terms) and refuses anything the program would. Upheld, the bond comes back with the source’s listing bond; dismissed, or not ruled before the Opening, it goes to the proposer.' + sent('petri_challenges') + CARD,
    schema: schema({
      month,
      source: str('The challenged source: its 64-hex id or address'),
      reason: { type: 'string', enum: REASONS, description: 'What is wrong with it' },
      why: str('The problem and what shows it, for the person ruling; public and permanent'),
      comparison: str('For duplicate only: the other source of the same bucket it duplicates'),
    }, ['month', 'source', 'reason', 'why']),
    args: a => ['oracle', 'sources', 'challenge', a.month, '--source', a.source, '--reason', a.reason, '--why', a.why,
      ...opt('--comparison', a.comparison), '--yes'],
  },

  // -------------------------------------------------- opening prints, updates
  {
    name: 'petri_prints',
    description: 'Read opening prints, the value each source opens its month at, sent in the month’s Opening (the day before it lists): the user’s own prints and challenges, with how each stands (open to challenge until …, challenged, accepted, settled) and the command that accepts or settles it; others’ prints still open to challenge, with the exact bond; and the sources still waiting for an opening print, with the opening bond.' + CARD,
    schema: schema({ market, owner }),
    args: a => ['oracle', 'prints', ...(a.market ? [a.market] : []), ...opt('--owner', a.owner)],
  },
  {
    name: 'petri_updates',
    description: 'Read Game updates, the new prices sources take while their month trades: the user’s own updates and challenges, with how each stands (open to challenge, accepted from …, challenged, settled) and the command that reveals, refunds or settles it; others’ updates still open to challenge, with the exact bond; and the sources that take an update now, with their current value and the exact update stake.' + CARD,
    schema: schema({ market, owner }),
    args: a => ['oracle', 'updates', ...(a.market ? [a.market] : []), ...opt('--owner', a.owner)],
  },
  {
    name: 'petri_observe_template',
    description: 'A blank observation of a chip month source’s series: one published price, with its period, publication, vintage, release and evidence reference (a Wayback capture of the source’s exact URL, https://web.archive.org/web/<14-digit UTC time>/<url>, or a web proof). Fill it from the source’s page, save it as a JSON file, then send it with petri_observe. Nothing is drawn; say what you will fill in.',
    schema: schema({ month, source: str('The source: its 64-hex id or address') }, ['month', 'source']),
    args: a => ['oracle', 'observe', 'template', a.month, '--source', a.source],
  },
  {
    name: 'petri_observe',
    write: true,
    description: 'Send an observation of a chip month’s source (from petri_observe_template, filled in): in the month’s Opening it is the source’s opening print, which petri accepts once its challenge window (300 slots, about a minute) has passed, so the call takes that long; in Game an update, which petri commits and reveals at once (its reveal window is 150 slots, well under a minute; an update equal to the current value is refused). Petri routes it against the spec and refuses one it does not admit, takes the exact opening bond or update stake from the user’s oracle collateral, and records the observation. Others can challenge it while it is open (petri_prints, petri_updates); one that stands earns the month’s opening or update reward and its stake settles back. Only when the user asks, or set you to keep sources current.' + sent('petri_prints or petri_updates') + CARD,
    schema: schema({ month, source: str('The source: its 64-hex id or address'), file: file('observation') }, ['month', 'source', 'file']),
    args: a => ['oracle', 'observe', a.month, '--source', a.source, '--file', a.file, '--reveal', '--accept', '--yes'],
  },
  {
    name: 'petri_print',
    write: true,
    description: 'Send a print of a source of a month on part numbers (Oct 2026 and earlier; chip months take petri_observe): stage opening in the month’s Opening (accepted once its challenge window, about a minute, has passed, so the call takes that long), update in Game (committed and revealed at once). value is the source’s price in its own units, as its page shows it; cite archiveUrl, a Wayback capture of the source’s exact URL made inside the window, or evidence, a web proof, instead. Petri takes the exact opening bond or update stake from the user’s oracle collateral and refuses what the program would. Only when the user asks, or set you to keep sources current.' + sent('petri_prints or petri_updates') + CARD,
    schema: schema({
      stage: { type: 'string', enum: ['opening', 'update'], description: 'opening in the month’s Opening, update in Game' },
      month, source: str('The source: its 64-hex id or address'),
      value: str('The price, in the source’s own units; with evidence, omit it to take the proven price'),
      ...CITE,
    }, ['stage', 'month', 'source']),
    args: a => a.stage === 'opening'
      ? ['oracle', 'prints', 'opening', a.month, '--source', a.source, ...opt('--value', a.value), ...cite(a), '--accept', '--yes']
      : ['oracle', 'updates', 'commit', a.month, '--source', a.source, ...opt('--value', a.value), ...cite(a), '--reveal', '--yes'],
  },
  {
    name: 'petri_challenge_print',
    write: true,
    description: 'Challenge someone else’s opening print that is wrong, while it is open to challenge (petri_prints lists them; each only for 300 slots, about a minute, after it is sent), with the correct value and its own evidence. First open the print’s evidence and the source’s page and be sure. The oracle authority rules on it by hand before the listing; a print still challenged at the listing locks both sides’ money, so never challenge close to the listing. Petri takes the exact bond from the user’s oracle collateral and refuses what the program would. Only when the user asks, or set you to check prints.' + sent('petri_prints') + CARD,
    schema: schema({
      month, source: str('The source whose print is challenged: its 64-hex id or address'),
      value: str('The correct price, in the source’s own units; with evidence, omit it to take the proven price'),
      ...CITE,
    }, ['month', 'source']),
    args: a => ['oracle', 'prints', 'challenge', a.month, '--source', a.source, ...opt('--value', a.value), ...cite(a), '--yes'],
  },
  {
    name: 'petri_challenge_update',
    write: true,
    description: 'Challenge someone else’s revealed Game update that is wrong, while it is open to challenge (petri_updates lists them; a day from its reveal, after which the keeper accepts it on its next pass), with the correct value and its own evidence. One challenge per update. First open the update’s evidence and the source’s page and be sure. The oracle authority rules on it by hand, or leaves it to the council; until then both stakes stay locked. Petri takes the exact bond (20% of the update’s stake, at least 1 USDC) from the user’s oracle collateral and refuses what the program would. Only when the user asks, or set you to check updates.' + sent('petri_updates') + CARD,
    schema: schema({
      month, claim: str('The update claim’s address (petri_updates)'),
      value: str('The correct price, in the source’s own units; with evidence, omit it to take the proven price'),
      ...CITE,
    }, ['month', 'claim']),
    args: a => ['oracle', 'updates', 'challenge', a.month, '--claim', a.claim, ...opt('--value', a.value), ...cite(a), '--yes'],
  },

  // ------------------------------------------------------------- the money
  {
    name: 'petri_stakes',
    description: 'Read the user’s bonds and stakes in the oracle, every stage’s: listing bonds, support stakes, challenge bonds, opening prints, updates and sponsorship bonds, each with how it stands (locked while its stage runs, settleable now with what it pays the user, settled, or stuck for good), what it waits for, and the command that settles it or moves it along; with totals locked, settleable and stuck. Others’ bonds a dismissal sends to the user show as owed.' + CARD,
    schema: schema({ market, owner }),
    args: a => ['oracle', 'stakes', ...(a.market ? [a.market] : []), ...opt('--owner', a.owner)],
  },
  {
    name: 'petri_settle_all',
    write: true,
    description: 'Settle every one of the user’s bonds and stakes that pays them now (petri_stakes lists them as settleable) back into their oracle collateral, in as few transactions as fit; ones that pay someone else are left. Settling is never automatic: nothing comes back until someone runs it. When the user asks to settle, or after work of theirs finished.' + sent('petri_stakes') + CARD,
    schema: schema({ market }),
    args: a => ['oracle', 'stakes', 'settle', '--all', ...(a.market ? [a.market] : []), '--yes'],
  },
  {
    name: 'petri_oracle_step',
    write: true,
    description: 'Run one follow-up command a Petri oracle read listed (petri_prints, petri_updates, petri_challenges, petri_oracle rewards or sponsorships), passed exactly as listed: an acceptCommand (accept an unchallenged opening print), a revealCommand (reveal a committed update), an expireCommand (refund an update nobody revealed), a settleCommand (pay a finished bond or stake back into collateral), a nextCommand (petri_stakes: what moves a locked one along, such as setting aside a frozen source with no print before expiry), or a sponsorship settle or claim. To settle everything that is done, use petri_settle_all. Anyone may run these and the money goes to whoever it belongs to. When the user asks to settle, accept or tidy up, or as the next step of work they set you to do.' + sent('the read that listed it') + CARD,
    schema: schema({ command: str('The command as the read listed it, e.g. petri oracle stakes settle RAMX-202610 --kind update-claim --source … --claim …') }, ['command']),
    args: a => stepArgs(a.command),
  },
  {
    name: 'petri_claim_rewards',
    write: true,
    description: 'Claim a settled month’s frozen rewards (proposer, supporter, opening, update; petri_oracle rewards lists them) into the user’s oracle collateral; petri_collateral withdraw takes them out. kind claims one kind only. Only when the user asks, or set you to claim.' + sent('petri_oracle rewards') + CARD,
    schema: schema({ month, kind: { type: 'string', enum: ['proposer', 'supporter', 'opening', 'update'], description: 'Optional: only this kind' } }, ['month']),
    args: a => ['oracle', 'rewards', 'claim', a.month, ...opt('--kind', a.kind), '--yes'],
  },
];
