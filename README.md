# Petri for DeepSeek Harness

An installable Cordis plugin that puts Petri's oracle research and trading
bots inside DeepSeek Harness conversations, and gives the agent Petri's
market and trade actions as tools. It uses the installed Petri executable
and research workspace; the separate Petri TUI is unchanged.

The split (2026-10-26): people trade on the site; agents trade through
tools; both go through the same API. Markets and trading have no UI in the
harness. Research and bots do.

## What you see

Petri appears where the conversation is, through Harness's own extension
seats (no separate page):

| Where | What | Harness seat |
|---|---|---|
| In the transcript, as the agent works | A card for research and bot calls: "DeepSeek wants to research for you" with Approve and Reject, assignments, a bot with its P&L and Start/Stop, published bots and the leaderboard with Install. Market reads and trades show one row (what ran) and no card. | `tool.call.toolview` |
| Under the agent's final answer | The turn's research and bot results kept visible after Harness folds the work steps | `conversation.chat.turnTail` |
| Above the composer | A Petri strip in chats that used research or bots: an Approve chip when an agent is waiting to connect, how many bots run, open and hide | `conversation.input.dock` |
| Beside the chat | **Petri**, a visual aid: Research (an agent waiting to connect, the agent and what it works on — Researching while Petri sees it checking in, otherwise when it was last seen — its activity and the sources it sent) and Oracle (collateral, rewards to claim, research finds, rewards by month, your proofs). Each says what matters in a line per item, with the site's status words; anything the agent can do is a chip that puts the request in the composer. **Bots**: Mine, Discover and Leaderboard. | `sidebarRightTabs`, `sidebar.right.pane.tab` |
| Conversation header | A Petri button that shows the strip and opens the Petri tab in any chat. A new chat shows no header actions until its first message, so until then the same button sits under its composer, beside the workspace. | `conversation.session.header.actions`, `conversation.hero.options` |
| The composer's `/` menu | `/petri` opens the Petri tab on Research and `/petri-bots` the Bots tab; both show the strip. They work in any chat, a new one too before anything is sent. | `ctx.commandUi` (client commands) |

## Trading bots

A bot stands for a thesis ("long NAND through 2027, rolling each month"):
someone writes it, and anyone can install it and have it trade that thesis
for them. Bots are made in the chat: you say what the bot should do and the
agent writes it (`petri_bot_write`), as a strategy script, the house maker's
ladder, or both. A bot on a product (`nandx`) trades its front month and
moves to the next as each one ends, so a hold rolls. The contract is
[bots.md](https://github.com/amoeba-farm/petri/blob/main/cli/docs/bots.md) in Petri's repository. The Bots tab has nothing to type into:

- **Marketplace**: one list you scroll, every published bot with its thesis,
  product and P&L, top this month first (also this week, all time, newest,
  most used), by product. A check marks a verified bot: whoever controls its
  GitHub repository published it. One opens to its thesis, author, source,
  runs and file, with **Install** and **Ask in chat**.
- **Mine**: your bots, each a row with its state, market, P&L and
  Start/Stop. A bot opens to its P&L chart, what it holds, **Change in chat**
  (which puts the bot in the composer for you), **Publish** and Remove.
  Start asks one thing, the budget, on a bar. A bot you started runs again
  whenever petri does, until you stop it.

**Putting a bot on GitHub:** a public repository with the bot file at
`petri-bot.toml` (or any path), its `[bot] author` your wallet. Anyone can
install it with "install the bot at github.com/OWNER/REPO" in the chat
(`petri_bot_install` with `github`), listed or not; publishing it with its
repository (`petri_bot_publish` with `github`) puts it in the marketplace
with the check.

Each running bot trades from a wallet of its own: Start moves its budget
from your wallet into it, Stop takes its ladder and orders down and moves
its cash back (what it holds stays in its wallet). Its P&L is that wallet's
on-chain result, so the leaderboard ranks real trades. The host owns one
`petri bots serve` (JSON lines), started on first use like the TUI's worker,
and its lifetime is a Cordis effect. Disabling the plugin or quitting Harness
closes petri's stdin, and petri takes every ladder down before it exits. It
runs detached, so even a Harness killed outright leaves it time to do that. A
bot runs in one petri at a time: the TUI and DeepSeek lock it, and a second
start says where it runs.

Approving an agent's pairing works from the chat card, the strip or the
sidebar. Petri requires a rewards wallet before it approves agents; the chat
card asks for that public address in place and approves in one step.

## Install

You need [Petri](https://amoeba.farm/download) installed and DeepSeek
Harness 0.2 (0.2.1-rc.3 or later). In Harness, open **Plugins**, click
**Add plugin** and paste this address, or ask the agent in a chat to
install it:

```text
https://github.com/amoeba-farm/petri-deepseek/releases/download/v0.5.1/amoeba-dsh-petri-0.5.1.tgz
```

From a terminal instead (`web` for the browser Harness):

```sh
dsh plugin --profile desktop add https://github.com/amoeba-farm/petri-deepseek/releases/download/v0.5.1/amoeba-dsh-petri-0.5.1.tgz
```

Reopen Harness if it asks you to. Its package manager may report missing
peer dependencies: Harness supplies them itself (Cordis, Typert), so the
warning is harmless.

## Updates

Installed from a release, the plugin keeps itself current, the way Petri
does. On start and every six hours it reads the latest release on
[amoeba-farm/petri-deepseek](https://github.com/amoeba-farm/petri-deepseek/releases),
checks the archive against the SHA-256 GitHub recorded for it, and once no
Petri call is running asks Harness's plugin manager to install it over this
copy. Harness applies it at once, or at its next start. Started bots come
down for a moment and run again, as they do when Harness restarts. The same
pass runs `petri update` for an installed Petri, so Petri stays current even
if you never open its TUI. A copy installed from a file or a link (a
development install) is never replaced.

## Agent tools

Thirty-seven tools are registered in Harness's native registry, which also
generates their programmatic interface:

- **Markets and trading (no UI):** reads `petri_markets`, `petri_book`,
  `petri_trades`, `petri_chart`, `petri_quote` (prices an order without
  sending), `petri_positions`, `petri_wallet` and `petri_history`; actions
  `petri_order`, `petri_cancel` and `petri_close`, which send at once from
  the Petri wallet after Petri's own checks (`--yes` is in their argv; the
  call is the decision). Each maps onto one Petri command, and values can
  never become Petri flags. Their descriptions tell the model nothing is
  drawn, so it says what matters in its reply.
- **Oracle:** `petri_oracle` reads months, sources, candidates, rewards and
  collateral, drawn as a card.
- **Anything else:** `petri_command` runs any public Petri command as an
  argument array, without a shell. A market or trade command run through it
  draws nothing, like the trade tools.
- **Research:** `petri_login`, `petri_work_list`, `petri_work_next`,
  `petri_work_start`, `petri_report_progress`, `petri_submit_candidate`,
  `petri_run_finish`, `petri_activity`, `petri_rewards`,
  `petri_session_open` and `petri_session_close`. Each Harness agent has a
  stable, separate Petri profile name, so simultaneous agents do not share a
  current run. `petri_work_list` keeps each assignment's brief, scope and
  objective summary: a workspace's full list runs past 100 KB, more than
  Harness keeps of one result; `petri_work_start` and `petri_work_next`
  return an assignment in full.
- **Bots:** `petri_bots`, `petri_bot_read`, `petri_bot_write` (its
  description carries the bot format and the script's whole interface),
  `petri_bot_new` (the house maker's ladder), `petri_bot_set`,
  `petri_bot_start` (optionally with a budget), `petri_bot_stop`,
  `petri_bot_publish`, `petri_bot_remove`, and the registry's
  `petri_bots_discover`, `petri_bot_show`, `petri_bot_install` and
  `petri_bots_leaderboard`. Their inputs travel to petri as JSON on the
  worker's stdin, or as checked arguments for the reads.

For research, ask the agent to connect to Petri; approve its code from the
card, then ask it to log in again. Petri remains responsible for validation,
wallet handling, simulation, signing and transaction reconciliation. The
sidebar keeps only what a person must do themselves (approving an agent,
the rewards wallet, disconnecting it); choosing and steering research,
sponsoring, claiming, proving and collateral are the agent's, through its
tools.

## Configuration

Without overrides, the host resolves Petri from `PETRI_BIN`, the normal
Windows install path, or `PATH`. Petri uses its existing settings. Configure
the **petri** entry in Harness's plugin settings, or add an override to the
profile's `cordis.patch.yml`:

```yaml
- id: petri
  config:
    executable: 'C:/Users/you/AppData/Local/Programs/Petri/petri.exe'
    # Optional connection and workspace overrides:
    # profile: dev
    # api: http://127.0.0.1:4500
    # rpc: http://127.0.0.1:8899
    # keypair: /private/path/to/existing-keypair.json
    # deployment: /path/to/deployment.json
    # stateDirectory: /path/to/PetriResearch
    # profileDirectory: /path/to/private-agent-profiles
    # workspaceUrl: http://127.0.0.1:4185
    # configPath: /path/to/petri/config.json   (PETRI_CONFIG_PATH; bots/ sits beside it)
    # researchPort: 4285                       (PETRI_RESEARCH_PORT)
    # botsExecutable: /path/to/petri-with-bots.exe
```

For Petri's own developers, `petriLive: true` shares the dev TUI's petri: the plugin runs the
newest `%LOCALAPPDATA%/petri-live/bin/petri-*.exe` (the build
`scripts/petri-live.ps1` keeps current) with petri-live's environment: the
`dev` profile, the loopback API and validator, petri-live's config (its
wallet and `bots/` folder) and research workspace (port 4285). Research
agents pair with that workspace too (`workspaceUrl` defaults to
`http://127.0.0.1:4285`, or the `researchPort` you set) and keep their
profiles in `%LOCALAPPDATA%/petri-live/research-agents`
(`profileDirectory`): petri's agent client would otherwise pair with the
installed petri's workspace on 4185, and an agent profile stays with the
workspace it first logged in to. Anything set
beside it wins. `botsExecutable` runs only the bots on another build, for a
petri-live build that has no `petri bots serve` yet.

On Windows, keep petri executables out of a folder Harness uses as a
workspace: its sandbox labels workspace roots Low integrity, an exe copied
there inherits the label, and a Low integrity petri can't write its own
config or bot files ("Access is denied").

`workspaceUrl` selects the research agents' workspace. Owner controls use
the local workspace selected by `stateDirectory` / `PETRI_RESEARCH_HOME`.
The default directory is `%LOCALAPPDATA%/PetriResearch` on Windows and
`~/.local/share/PetriResearch` elsewhere. Keep keys and tokens out of this
configuration; `keypair` is a file path only.

## Architecture and checks

`index.js` provides `ctx.petri` and a Typert `invoke` method. The client uses
Harness's authenticated Gateway at `/api`; the plugin adds no unauthenticated
HTTP routes. `tools.js` registers the agent tools. `lib/market.mjs` maps the
market reads and trade actions onto Petri commands. `lib/bots.mjs` owns the
`petri bots serve` child, turns its JSON lines into answers, and reads the
registry through petri. `lib/process.mjs` owns subprocesses (and petri-live's build and environment),
cancellation, and argv construction. `lib/update.mjs` keeps the plugin and
Petri current (Updates, above). `lib/workspace.mjs` adapts the existing
owner API using its local credential, never returning that credential to the
browser or model. Writes are never automatically retried. The trade tools
and UI write buttons send `--yes` only for their own action; the general
command tool never inserts it.

`client.js` is the browser half: the keyed tool cards, a Conversation
Definition (`kind: 'petri'`, the turn's Petri results by call) feeding the
turn tail, the composer strip, the header button, the `/petri` and
`/petri-bots` commands and the two sidebar tabs (Petri and Bots). It
uses only the host's `--dsw-*` theme tokens, so light, dark and font-size
settings follow Harness. The sidebar pane stays mounted when the sidebar
closes; its reads pause until it shows again.

```sh
npm ci --ignore-scripts
npm run check
npm test
```

Tests use the real Cordis service lifecycle and Harness tool registry,
native/programmatic tool schemas, fixture subprocesses, cancellation,
credential isolation, client registration, authenticated RPC shape and the
updater against a stand-in for GitHub. They perform no financial operations
or model inference. The update path was also run in Harness 0.2.1-rc.3
itself: a copy installed from a release address found a newer release,
checked it and had Harness install it over itself while running. On
0.2.1-rc.4 it installs, starts and shows under Installed plugins. Runtime
dependencies are the host's peers; `npm ci` additionally installs the host
tool registry for development tests.

The matching Harness development graph pins Zod 4.4.3, which npm flags for
[an oversized-collection memory exhaustion advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
The archive does not bundle those development dependencies. Updating the
installed Harness runtime is separate from installing this plugin.
