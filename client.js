window.__ModuleLoader__.load({
  id: '@amoeba/dsh-petri',
  factory(require) {
    const React = require('react');
    const UI = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;
    const { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore, Fragment } = React;

    const PLUGIN = '@amoeba/dsh-petri';
    const PANE_ID = '@amoeba/dsh-petri/pane';
    const PANE_KIND = 'petri';
    const BOTS_PANE_ID = '@amoeba/dsh-petri/bots';
    const BOTS_KIND = 'petri-bots';
    // Petri in DeepSeek draws oracle research and bots. Markets and trading are the agent's
    // tools only (people trade on the site): their rows say what ran and draw nothing under it.
    const TRADE_TOOLS = ['petri_markets', 'petri_book', 'petri_trades', 'petri_chart', 'petri_quote', 'petri_order', 'petri_cancel', 'petri_close', 'petri_positions', 'petri_wallet', 'petri_history'];
    const MARKET_TOOLS = [...TRADE_TOOLS, 'petri_oracle'];
    const RESEARCH_TOOLS = ['petri_login', 'petri_work_list', 'petri_work_next', 'petri_work_start', 'petri_report_progress', 'petri_submit_candidate', 'petri_run_finish', 'petri_activity', 'petri_rewards', 'petri_session_open', 'petri_session_close'];
    // The registry's reads draw as lists of published bots; the rest as the user's own bot.
    const HUB_TOOLS = ['petri_bots_discover', 'petri_bot_show', 'petri_bots_leaderboard'];
    const BOT_TOOLS = ['petri_bots', 'petri_bot_read', 'petri_bot_write', 'petri_bot_new', 'petri_bot_set', 'petri_bot_start', 'petri_bot_stop', 'petri_bot_publish', 'petri_bot_remove', 'petri_bot_install', ...HUB_TOOLS];
    const TOOL_NAMES = [...MARKET_TOOLS, 'petri_command', ...RESEARCH_TOOLS, ...BOT_TOOLS];

    // ---------------------------------------------------------------- styles
    // Host tokens only (--dsw-*), so light, dark and font-size settings follow DeepSeek.
    const CSS = `
.ptr{--ptr-up:var(--dsw-alias-state-success-primary,#3a9d6a);--ptr-down:var(--dsw-alias-state-error-primary,#d0564b);--ptr-line:var(--dsw-alias-border-l1);--ptr-line2:var(--dsw-alias-border-l2);--ptr-fg:var(--dsw-alias-label-primary);--ptr-fg2:var(--dsw-alias-label-secondary);--ptr-fg3:var(--dsw-alias-label-tertiary);--ptr-cap:var(--dsw-alias-label-caption);--ptr-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;min-width:0}
:where(.ptr) *{box-sizing:border-box}
:where(.ptr) button{font:inherit;color:inherit}
.ptr-card{display:flex;flex-direction:column;min-width:0}
.ptr-row{height:calc(24px + var(--dsh-content-font-delta,0px));display:flex;align-items:center;min-width:0;overflow:hidden;color:var(--ptr-fg3);font-size:var(--dsh-content-font-size-secondary,13px);transition:color .1s}
.ptr-row[data-expandable]{cursor:pointer}.ptr-row:hover{color:var(--ptr-fg2)}
.ptr-lead{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:center;margin-right:6px}
.ptr-title{flex:none;line-height:24px}
.ptr-sep{flex:none;width:2px;height:2px;border-radius:1px;background:var(--ptr-cap);margin:0 8px}
.ptr-summary{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:24px}
.ptr-err{color:var(--dsw-alias-state-error-primary)}
.ptr-panel{margin:4px 0 6px;border:.5px solid var(--ptr-line);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-base);color:var(--ptr-fg);font-size:13px;line-height:1.45;max-width:640px;min-width:0;overflow:hidden}
.ptr-panel-head{display:flex;align-items:center;gap:8px;padding:9px 12px 0;color:var(--ptr-fg3);font-size:11.5px;min-width:0}
.ptr-panel-head b{color:var(--ptr-fg2);font-weight:500}
.ptr-panel-head .ptr-grow{flex:1}
.ptr-panel-body{padding:10px 12px 12px;min-width:0}
.ptr-grow{flex:1 1 auto;min-width:0}
.ptr-muted{color:var(--ptr-fg3)}
.ptr-cap{color:var(--ptr-fg3);font-size:11.5px}
.ptr-mono{font-family:var(--ptr-mono);font-size:12px}
.ptr-up{color:var(--ptr-up)}.ptr-down{color:var(--ptr-down)}
.ptr-line{display:flex;align-items:center;gap:8px;min-width:0}
.ptr-between{justify-content:space-between}
.ptr-wrap{flex-wrap:wrap}
.ptr-stack{display:flex;flex-direction:column;gap:10px;min-width:0}
.ptr-ellipsis{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}
.ptr-alert{color:var(--dsw-alias-state-error-primary);font-size:12px;overflow-wrap:anywhere}
.ptr-note{color:var(--ptr-fg3);font-size:12px;overflow-wrap:anywhere}
.ptr-empty{color:var(--ptr-fg3);font-size:12px;padding:6px 0}
.ptr-link{background:none;border:0;padding:0;cursor:pointer;color:var(--dsw-alias-link,var(--ptr-fg2));font-size:12px}
.ptr-link:hover{text-decoration:underline}
.ptr-btn{height:28px;padding:0 10px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--ptr-line2);background:var(--dsw-alias-bg-base);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;flex:none}
.ptr-btn:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}
.ptr-btn:disabled{opacity:.45;cursor:default}
.ptr-btn-solid{background:var(--ptr-fg);color:var(--dsw-alias-bg-base);border-color:transparent}
.ptr-btn-solid:not(:disabled):hover{background:var(--ptr-fg);opacity:.88}
.ptr-btn-long{background:color-mix(in srgb,var(--ptr-up) 16%,transparent);border-color:color-mix(in srgb,var(--ptr-up) 40%,transparent);color:var(--ptr-up)}
.ptr-btn-long:not(:disabled):hover{background:color-mix(in srgb,var(--ptr-up) 24%,transparent)}
.ptr-btn-wide{width:100%;height:34px;font-size:13px;font-weight:500}
.ptr-icon{width:26px;height:26px;padding:0;border:0;border-radius:999px;background:none;color:var(--ptr-fg3);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ptr-icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--ptr-fg2)}
.ptr-spin{display:inline-block;width:12px;height:12px;border:1.5px solid currentColor;border-right-color:transparent;border-radius:50%;animation:ptr-spin .8s linear infinite;flex:none}
@keyframes ptr-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ptr-spin{animation-duration:2.4s}}
.ptr-input{height:30px;width:100%;min-width:0;border:.5px solid var(--ptr-line2);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--ptr-fg);padding:0 9px;font:inherit;font-size:12.5px}
.ptr-input:focus{outline:none;border-color:var(--dsw-alias-border-l4)}
textarea.ptr-input{height:auto;min-height:64px;padding:7px 9px;resize:vertical}
/* dropdowns and bars */
.ptr-select{position:relative;display:inline-flex;align-items:center;min-width:0;max-width:100%;flex:none}
.ptr-select select{appearance:none;-webkit-appearance:none;height:28px;max-width:100%;min-width:0;border:.5px solid var(--ptr-line2);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--ptr-fg);font:inherit;font-size:12.5px;padding:0 26px 0 9px;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.ptr-select select:not(:disabled):hover{background:var(--dsw-alias-bg-layer-2)}
.ptr-select select:focus-visible{outline:none;border-color:var(--dsw-alias-border-l4)}
.ptr-select select:disabled{opacity:.45;cursor:default}
.ptr-select option,.ptr-select optgroup{background:var(--dsw-alias-bg-base);color:var(--ptr-fg)}
.ptr-select-chev{position:absolute;right:9px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--ptr-fg3);display:inline-flex}
.ptr-select-wide{display:flex;flex:1 1 auto}.ptr-select-wide select{width:100%}
.ptr-select-small select{height:22px;font-size:11.5px;padding:0 21px 0 7px;background:none;border-color:var(--ptr-line);color:var(--ptr-fg2)}
.ptr-select-small .ptr-select-chev{right:6px}
.ptr-lev{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--ptr-fg3)}
.ptr-lev b{color:var(--ptr-fg);font-weight:500;font-size:12.5px}
.ptr-lev input{-webkit-appearance:none;appearance:none;width:100%;height:18px;margin:0;background:none;cursor:pointer}
.ptr-lev input::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(to right,var(--ptr-fg2) calc(7px + (100% - 14px) * var(--ptr-f)),var(--dsw-alias-bg-layer-3,var(--ptr-line2)) calc(7px + (100% - 14px) * var(--ptr-f)))}
.ptr-lev input::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:var(--ptr-fg);border:2px solid var(--dsw-alias-bg-base);box-shadow:0 0 0 .5px var(--ptr-line2)}
.ptr-lev input:focus-visible{outline:none}
.ptr-lev input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px color-mix(in srgb,var(--ptr-fg) 22%,transparent)}
.ptr-lev-ends{display:flex;justify-content:space-between;font-size:10.5px}
.ptr-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;cursor:pointer}
.ptr-clamp[data-open]{display:block;cursor:auto}
/* figures */
.ptr-price{font-size:20px;font-weight:500;letter-spacing:-.3px;line-height:1.25}
.ptr-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--ptr-fg3)}
/* chart */
.ptr-chart{position:relative;width:100%;height:120px}
.ptr-chart svg{display:block;width:100%;height:100%;overflow:visible}
.ptr-chart-line{fill:none;stroke:var(--ptr-fg2);stroke-width:1.4;vector-effect:non-scaling-stroke}
.ptr-chart-area{fill:color-mix(in srgb,var(--ptr-fg3) 12%,transparent);stroke:none}
.ptr-chart-up .ptr-chart-line{stroke:var(--ptr-up)}.ptr-chart-up .ptr-chart-area{fill:color-mix(in srgb,var(--ptr-up) 10%,transparent)}
.ptr-chart-down .ptr-chart-line{stroke:var(--ptr-down)}.ptr-chart-down .ptr-chart-area{fill:color-mix(in srgb,var(--ptr-down) 9%,transparent)}
.ptr-chart-y{position:absolute;right:0;font-size:10.5px;color:var(--ptr-fg3);background:var(--dsw-alias-bg-base);padding:0 2px}
.ptr-chart-x{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ptr-fg3);margin-top:4px}
/* tables and lists */
.ptr-table{display:flex;flex-direction:column;font-size:12px;min-width:0}
.ptr-tr{display:grid;gap:8px;align-items:center;padding:5px 0;border-bottom:.5px solid var(--ptr-line);min-width:0}
.ptr-tr:last-child{border-bottom:0}
.ptr-num{text-align:right}
.ptr-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.ptr-list>li{padding:8px 0;border-bottom:.5px solid var(--ptr-line);min-width:0}
.ptr-list>li:last-child{border-bottom:0}
.ptr-dl{display:grid;grid-template-columns:minmax(80px,auto) minmax(0,1fr);gap:4px 12px;margin:0;font-size:12px}
.ptr-dl dt{color:var(--ptr-fg3)}.ptr-dl dd{margin:0;overflow-wrap:anywhere;min-width:0}
.ptr-pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ptr-mono);font-size:11.5px;line-height:1.55;margin:0;max-height:320px;overflow:auto;color:var(--ptr-fg2)}
.ptr-details summary{cursor:pointer;color:var(--ptr-fg3);font-size:12px;list-style:none}
.ptr-details summary::-webkit-details-marker{display:none}
.ptr-details[open] summary{margin-bottom:6px}
.ptr-pill{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;border:.5px solid var(--ptr-line2);color:var(--ptr-fg2);flex:none;white-space:nowrap}
.ptr-pill-up{color:var(--ptr-up);border-color:color-mix(in srgb,var(--ptr-up) 40%,transparent)}
/* turn tail */
.ptr-tail{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.ptr-tail .ptr-panel{margin:4px 0}
/* composer dock */
.ptr-dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px) - 4 * var(--dsh-composer-dock-inset,0px));margin:0 auto}
.ptr-dockbar{isolation:isolate;position:relative;box-sizing:border-box;width:100%;max-width:calc(var(--dsh-composer-card-max-width,760px) - 4 * var(--dsh-composer-dock-inset,0px));margin:0 auto;height:36px;--dsw-elevation-stroke-color:var(--ptr-line);box-shadow:var(--dsw-elevation-panel);border-radius:var(--dsw-radius-md,10px);display:flex;align-items:center;gap:4px;padding:4px 5px 4px 12px;font-size:12.5px}
.ptr-dockbar:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));backdrop-filter:var(--dsw-menu-backdrop-filter);pointer-events:none}
.ptr-dock-name{color:var(--ptr-fg);font-weight:500;margin:0 6px 0 2px;flex:none}
.ptr-dock-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 8px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--ptr-line2);background:var(--dsw-alias-bg-base);font-size:12px;cursor:pointer;flex:none;white-space:nowrap}
.ptr-dock-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
/* header action */
.ptr-hdr{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:3px 6px;border:0;border-radius:var(--dsw-radius-sm,8px);background:none;color:var(--dsw-alias-label-tertiary);font-size:12px;cursor:pointer}
.ptr-hdr:hover,.ptr-hdr:focus-visible{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}
/* sidebar pane */
.ptr-pane{height:100%;overflow:auto;padding:12px 14px 28px;font-size:13px;color:var(--ptr-fg);background:var(--dsw-alias-bg-base)}
.ptr-tabs{display:flex;flex-wrap:wrap;gap:0;border-bottom:.5px solid var(--ptr-line);margin:0 -14px 12px;padding:0 8px}
.ptr-tab{border:0;background:none;padding:7px 7px 8px;font-size:12.5px;color:var(--ptr-fg3);cursor:pointer;border-bottom:1.5px solid transparent;margin-bottom:-.5px;white-space:nowrap}
.ptr-tab:hover{color:var(--ptr-fg2)}
.ptr-tab[aria-selected=true]{color:var(--ptr-fg);border-bottom-color:var(--ptr-fg)}
.ptr-section{display:flex;flex-direction:column;gap:8px;padding:12px 0;border-bottom:.5px solid var(--ptr-line);min-width:0}
.ptr-section:last-child{border-bottom:0}
.ptr-section-title{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--ptr-fg)}
.ptr-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
/* bots */
.ptr-botrow{display:flex;align-items:center;gap:8px;padding:8px 4px;margin:0 -4px;border-radius:var(--dsw-radius-sm,8px);cursor:pointer;min-width:0}
.ptr-list>li.ptr-botrow{padding:8px 4px}
.ptr-botrow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ptr-botrow:focus-visible{outline:none;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l4)}
.ptr-rank{flex:none;min-width:18px;text-align:right;color:var(--ptr-fg3);font-size:12px}
.ptr-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--ptr-fg3);opacity:.6}
.ptr-dot-running{background:var(--ptr-up);opacity:1}
.ptr-dot-warning{background:var(--dsw-alias-state-warning-primary,#c9922e);opacity:1}
.ptr-dot-problem{background:var(--ptr-down);opacity:1}
.ptr-verified{display:inline-flex;flex:none;color:var(--dsw-alias-link,#3b82f6)}
/* the Petri tab: blocks, figures and rows, as the site draws its pages */
.ptr-block{padding:14px 0;border-bottom:.5px solid var(--ptr-line);min-width:0}
.ptr-block:last-child{border-bottom:0}
.ptr-h{display:flex;align-items:baseline;gap:8px;margin:0 0 4px;font-size:12.5px;font-weight:600;color:var(--ptr-fg)}
.ptr-who{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px}
.ptr-who b{font-weight:600}
.ptr-state{margin-left:auto;font-size:12px;color:var(--ptr-fg2);white-space:nowrap}
.ptr-now{margin-top:10px;padding:8px 10px;border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1);min-width:0}
.ptr-now small{display:block;margin-top:2px;color:var(--ptr-fg3);font-size:11.5px}
.ptr-figs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ptr-fig{padding:8px 10px;border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1);min-width:0}
.ptr-fig span{display:block;font-size:11px;color:var(--ptr-fg3)}
.ptr-fig b{display:block;margin-top:2px;font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ptr-rows{list-style:none;margin:0;padding:0}
.ptr-r{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:0 10px;align-items:baseline;padding:7px 0;border-bottom:.5px solid var(--ptr-line);font-size:12.5px;min-width:0}
.ptr-r-nt{grid-template-columns:minmax(0,1fr) auto}
.ptr-r:last-child{border-bottom:0}
.ptr-r time{color:var(--ptr-fg3);font-size:11.5px}
.ptr-t{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ptr-t a{color:inherit;text-decoration:none}.ptr-t a:hover{text-decoration:underline}
.ptr-t small{display:block;color:var(--ptr-fg3);font-size:11.5px;overflow:hidden;text-overflow:ellipsis}
.ptr-s{color:var(--ptr-fg3);font-size:11.5px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis}
.ptr-chips{display:flex;flex-wrap:wrap;gap:6px}
.ptr-chip{height:26px;padding:0 11px;border-radius:999px;border:.5px solid var(--ptr-line2);background:none;font-size:12px;color:var(--ptr-fg2);cursor:pointer}
.ptr-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--ptr-fg)}
.ptr-request{margin:4px 0 2px;padding:12px;border:.5px solid var(--ptr-line2);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1)}
`;
    function installStyles() {
      if (typeof document === 'undefined') return;
      const tagId = `${PLUGIN}/petri.css`;
      let tag = document.querySelector(`style[data-plugin-css="${tagId}"]`);
      if (!tag) {
        tag = document.createElement('style');
        tag.dataset.plugin = PLUGIN;
        tag.dataset.pluginCss = tagId;
        document.head.appendChild(tag);
      }
      if (tag.textContent !== CSS) tag.textContent = CSS;
    }

    // ---------------------------------------------------------------- formatting
    const toNum = value => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const fixed = (value, digits = 2) => {
      const n = toNum(value);
      return n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };
    const atomsToUsd = value => { const n = toNum(value); return n === null ? null : n / 1e6; };
    const usdc = value => value === null || value === undefined ? '—' : `${fixed(value)} USDC`;
    const signed = (value, digits = 2) => {
      const n = toNum(value);
      if (n === null) return '—';
      return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
    };
    const tone = value => { const n = toNum(value); return n === null || n === 0 ? '' : n > 0 ? 'ptr-up' : 'ptr-down'; };
    const group = value => { const n = toNum(value); return n === null ? '—' : n.toLocaleString('en-US'); };
    const short = value => typeof value === 'string' && value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value || '—';
    const seconds = ts => { const n = toNum(ts); return n === null ? null : n > 1e12 ? n / 1000 : n; };
    function ago(ts) {
      const s = seconds(ts);
      if (s === null) return '—';
      const d = Math.max(0, Date.now() / 1000 - s);
      if (d < 60) return `${Math.floor(d)}s ago`;
      if (d < 3600) return `${Math.floor(d / 60)}m ago`;
      if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
      return `${Math.floor(d / 86400)}d ago`;
    }
    function clock(ts) {
      const s = seconds(ts);
      if (s === null) return '—';
      return new Date(s * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);
    const firstLine = text => String(text || '').split('\n')[0];
    const humanKey = key => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

    const marketLabel = m => m?.label || m?.symbol || short(m?.market);

    // ---------------------------------------------------------------- stores
    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        get: () => state,
        set(next) { state = typeof next === 'function' ? next(state) : next; for (const l of [...listeners]) l(); },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      };
    }
    const useStore = (store, select = s => s) => useSyncExternalStore(store.subscribe, () => select(store.get()));

    function storageGet(key) { try { const v = window.localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
    function storageSet(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is a convenience */ } }

    // Per-Session Petri presence: whether this chat used markets or research, and the dock's own choices.
    const sessionsStore = createStore({});
    const NO_SESSION = Object.freeze({});
    function sessionState(sessionId) {
      const all = sessionsStore.get();
      if (!sessionId) return NO_SESSION;
      if (!all[sessionId]) {
        const saved = storageGet(`petri.session.${sessionId}`) || {};
        sessionsStore.get()[sessionId] = saved;
        return saved;
      }
      return all[sessionId];
    }
    function patchSession(sessionId, patch) {
      if (!sessionId) return;
      const current = sessionState(sessionId);
      if (Object.entries(patch).every(([k, v]) => current[k] === v)) return;
      const next = { ...current, ...patch };
      storageSet(`petri.session.${sessionId}`, next);
      sessionsStore.set(all => ({ ...all, [sessionId]: next }));
    }
    function useSession(sessionId) { return useStore(sessionsStore, () => sessionState(sessionId)); }

    // The bot the agent last made or changed, per Session; the Bots tab follows it.
    const focusStore = createStore({});
    // Bumped by any owner action so every view of the workspace reads it again at once.
    const workspaceTick = createStore(0);
    const bumpWorkspace = () => workspaceTick.set(n => n + 1);

    // ---------------------------------------------------------------- data
    const sameDeps = (a, b) => !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    // Data belongs to the deps it was read for: another market shows nothing until its own read
    // arrives. A poll tick waits for the read in flight instead of cutting it off.
    function useLoad(load, deps, { interval = 0, enabled = true } = {}) {
      const [state, setState] = useState({ data: null, error: null, busy: enabled, deps: null });
      const [nonce, setNonce] = useState(0);
      useEffect(() => {
        if (!enabled) { setState(s => ({ ...s, busy: false })); return; }
        let controller = null, timer = null, alive = true;
        const run = () => {
          if (controller) return;
          const current = controller = new AbortController();
          setState(s => ({ ...s, busy: true }));
          load(current.signal)
            .then(data => { if (alive) setState({ data, error: null, busy: false, deps }); },
              error => { if (alive) setState(s => ({ data: sameDeps(s.deps, deps) ? s.data : null, error: error.message || String(error), busy: false, deps })); })
            .finally(() => { if (controller === current) controller = null; });
        };
        run();
        if (interval > 0) timer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') run(); }, interval);
        return () => { alive = false; controller?.abort(); if (timer) clearInterval(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [...deps, enabled, interval, nonce]);
      const reload = useCallback(() => setNonce(n => n + 1), []);
      const fresh = sameDeps(state.deps, deps);
      return { data: fresh ? state.data : null, error: fresh ? state.error : null, busy: fresh ? state.busy : enabled, reload };
    }

    function useAction(run, onDone) {
      const [state, setState] = useState({ busy: false, error: null, data: null });
      const inflight = useRef(false);
      const mounted = useRef(true);
      useEffect(() => () => { mounted.current = false; }, []);
      const act = useCallback(async (...args) => {
        if (inflight.current) return undefined;
        inflight.current = true;
        setState({ busy: true, error: null, data: null });
        try {
          const data = await run(...args);
          if (mounted.current) setState({ busy: false, error: null, data });
          onDone?.(data);
          return data;
        } catch (error) {
          if (mounted.current) setState({ busy: false, error: error.message || String(error), data: null });
          return undefined;
        } finally { inflight.current = false; }
      }, [run, onDone]);
      return [state, act];
    }

    // One shared markets poll for the dock and the pane.
    function createMarketsFeed(call) {
      const store = createStore({ markets: null, error: null, at: 0 });
      let users = 0, timer = null, controller = null;
      const refresh = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && store.get().markets) return;
        controller?.abort(); controller = new AbortController();
        const signal = controller.signal;
        call({ action: 'command', args: ['markets'] }, signal)
          .then(data => { if (!signal.aborted) store.set({ markets: Array.isArray(data?.markets) ? data.markets : [], error: null, at: Date.now() }); },
            error => { if (!signal.aborted) store.set(s => ({ ...s, error: error.message || String(error) })); });
      };
      return {
        store, refresh,
        use() {
          useEffect(() => {
            users += 1;
            if (users === 1) { if (Date.now() - store.get().at > 5000) refresh(); timer = setInterval(refresh, 15000); }
            return () => { users -= 1; if (users === 0) { clearInterval(timer); timer = null; controller?.abort(); } };
          }, []);
          return useStore(store);
        },
        dispose() { clearInterval(timer); controller?.abort(); },
      };
    }

    // ---------------------------------------------------------------- tool blocks
    function blockArgs(props) {
      const raw = props.phase === 'result' ? props.block?.call?.argsRaw : props.phase === 'start' ? props.block?.argsRaw : null;
      if (!raw) return {};
      try { const v = JSON.parse(raw); return isRecord(v) ? v : {}; } catch { return {}; }
    }
    function contentText(content) {
      return (Array.isArray(content) ? content : []).filter(item => item && item.type === 'text').map(item => item.text).join('\n');
    }
    function parseResult(text) {
      try { return JSON.parse(text); } catch { return null; }
    }
    // One Petri call, from a live tool block or a recorded turn: name, arguments, state and data.
    function entryFromBlock(props) {
      const args = blockArgs(props);
      const base = { name: props.toolName, callId: props.callId, args };
      if (props.phase !== 'result') return { ...base, state: props.phase === 'preparing' ? 'preparing' : 'running' };
      const block = props.block;
      const text = contentText(block.content);
      if (block.error?.code === 'interrupted') return { ...base, state: 'stopped', text };
      if (block.isError) return { ...base, state: 'error', text: text || (block.error ? `${block.error.name}: ${block.error.code}` : 'Petri failed.') };
      return { ...base, state: 'ok', text, data: parseResult(text) };
    }

    // ---------------------------------------------------------------- primitives
    function Glyph({ size = 14 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true },
        h('circle', { cx: 8, cy: 8, r: 6.4 }),
        h('circle', { cx: 6.1, cy: 7, r: 1.35 }),
        h('circle', { cx: 10.1, cy: 9.7, r: 1.75 }),
        h('circle', { cx: 9.8, cy: 5.3, r: .65, fill: 'currentColor', stroke: 'none' }));
    }
    function GuideArt() {
      return h('svg', { width: '100%', height: '100%', viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true },
        h('circle', { cx: 24, cy: 24, r: 17 }), h('circle', { cx: 24, cy: 24, r: 14, strokeOpacity: .4 }),
        h('circle', { cx: 19, cy: 21, r: 3.4 }), h('circle', { cx: 29, cy: 28.5, r: 4.4 }), h('circle', { cx: 28.5, cy: 16.5, r: 1.6, fill: 'currentColor', stroke: 'none' }));
    }
    const IconOpen = () => h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': true },
      h('rect', { x: 2, y: 2.5, width: 12, height: 11, rx: 2 }), h('path', { d: 'M10 2.5v11' }));
    const IconRefresh = () => h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', 'aria-hidden': true },
      h('path', { d: 'M13 8a5 5 0 1 1-1.5-3.6' }), h('path', { d: 'M13 2.5v3h-3' }));
    const IconClose = () => h('svg', { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
      h('path', { d: 'M4 4l8 8M12 4l-8 8' }));
    const DoneIcon = () => h('span', { className: 'ptr-up', style: { display: 'inline-flex', flex: 'none' } }, UI.IconCheckCircleFillRegular ? h(UI.IconCheckCircleFillRegular, { size: 14 }) : '✓');
    const Spin = () => h('span', { className: 'ptr-spin', role: 'progressbar', 'aria-label': 'Petri request' });
    function Shimmer({ active, className, children }) {
      return UI.TextShimmer ? h(UI.TextShimmer, { active, className }, children) : h('span', { className }, children);
    }
    function Tip({ label, children }) {
      return UI.Tooltip ? h(UI.Tooltip, { portal: true, label, side: 'bottom', delayMs: 500 }, children) : children;
    }
    function IconButton({ label, onClick, children, disabled }) {
      return h(Tip, { label }, h('button', { type: 'button', className: 'ptr-icon', 'aria-label': label, onClick, disabled }, children));
    }
    // Petri UI writes into the composer at its caret; the user decides whether to send.
    function askInChat(inputActions, text) {
      if (!inputActions?.captureInsertion || !inputActions?.insertText) return false;
      return inputActions.insertText(text, inputActions.captureInsertion()) !== false;
    }
    function Alert({ error }) { return error ? h('div', { className: 'ptr-alert', role: 'alert' }, error) : null; }

    function Panel({ head, children, className }) {
      return h('div', { className: `ptr ptr-panel${className ? ` ${className}` : ''}` },
        head ? h('div', { className: 'ptr-panel-head' }, head) : null,
        h('div', { className: 'ptr-panel-body' }, children));
    }
    function PanelHead({ title, subtitle, actions }) {
      return h(Fragment, null, h(Glyph, { size: 12 }), h('b', null, title), subtitle ? h('span', { className: 'ptr-ellipsis' }, subtitle) : null,
        h('span', { className: 'ptr-grow' }), actions || null);
    }

    // A choice is a dropdown, never a row of every option: months, markets, bots, assignments.
    const Chevron = () => h('svg', { width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M2.5 3.75 5 6.25 7.5 3.75' }));
    function Select({ value, onChange, options, groups, label, wide, small, disabled }) {
      const option = o => h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label);
      // A dropdown inside a clickable card picks; it never opens the card.
      return h('span', { className: `ptr-select${wide ? ' ptr-select-wide' : ''}${small ? ' ptr-select-small' : ''}`, onClick: e => e.stopPropagation(), onKeyDown: e => e.stopPropagation() },
        h('select', { value, disabled, 'aria-label': label, title: label, onChange: e => onChange(e.target.value) },
          (options || []).map(option), (groups || []).map(g => g.options.length ? h('optgroup', { key: g.label, label: g.label }, g.options.map(option)) : null)),
        h('span', { className: 'ptr-select-chev' }, h(Chevron)));
    }

    // A value along a scale is a bar over its stops, not a field to type in.
    function StopSlider({ label, stops, at, show, onChange }) {
      return h('div', { className: 'ptr-lev' },
        h('div', { className: 'ptr-line ptr-between' }, h('span', null, label), h('b', null, show(stops[at]))),
        h('input', { type: 'range', min: 0, max: stops.length - 1, step: 1, value: at, 'aria-label': label, 'aria-valuetext': show(stops[at]),
          style: { '--ptr-f': at / (stops.length - 1) }, onChange: e => onChange(stops[Number(e.target.value)]) }),
        h('div', { className: 'ptr-lev-ends' }, h('span', null, show(stops[0])), h('span', null, show(stops[stops.length - 1]))));
    }
    // Long text shows three lines; a click opens the rest.
    function Clamp({ className, children }) {
      const [open, setOpen] = useState(false);
      return h('div', { className: `ptr-clamp${className ? ` ${className}` : ''}`, 'data-open': open ? '' : undefined, title: open ? undefined : 'Show all', onClick: () => setOpen(true) }, children);
    }
    // A long list shows its first rows and a link to the rest.
    function useMore(list, rows) {
      const [all, setAll] = useState(false);
      const shown = all ? list : list.slice(0, rows);
      const more = list.length > rows ? h('button', { type: 'button', className: 'ptr-link', style: { alignSelf: 'flex-start', marginTop: 6 }, onClick: () => setAll(v => !v) }, all ? 'Fewer' : `All ${list.length}`) : null;
      return [shown, more];
    }

    // Markets as products (RAMX, NANDX, BATX), each with its expiries, front month first.
    function products(markets) {
      const by = new Map();
      for (const m of markets || []) {
        const key = m.symbol || marketLabel(m);
        if (!by.has(key)) by.set(key, []);
        by.get(key).push(m);
      }
      return [...by].map(([symbol, list]) => {
        list.sort((a, b) => (a.expiryTs || 0) - (b.expiryTs || 0));
        const open = list.filter(m => m.status === 'open');
        return { symbol, markets: list, open, front: open[0] || list[0] };
      });
    }
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // RAMX-202612 → RAMX Dec 26, as the markets name it.
    function expiryIdLabel(id) {
      const match = /^([A-Z]+)-(\d{4})(\d{2})$/i.exec(String(id || ''));
      return match && MONTHS[Number(match[3]) - 1] ? `${match[1].toUpperCase()} ${MONTHS[Number(match[3]) - 1]} ${match[2].slice(2)}` : id;
    }
    // Anything else Petri returns: its own fields, nested ones folded.
    function Value({ value, depth = 0 }) {
      if (value === null || value === undefined) return h('span', { className: 'ptr-muted' }, '—');
      if (typeof value !== 'object') return h('span', null, String(value));
      if (typeof value.text === 'string' && Object.keys(value).length === 1) return h('pre', { className: 'ptr-pre' }, value.text);
      if (Array.isArray(value)) {
        if (!value.length) return h('span', { className: 'ptr-muted' }, 'None');
        return h('ul', { className: 'ptr-list' }, value.slice(0, 50).map((v, i) => h('li', { key: i }, h(Value, { value: v, depth: depth + 1 }))));
      }
      const entries = Object.entries(value).filter(([k]) => !['ok', 'command'].includes(k));
      return h('dl', { className: 'ptr-dl' }, entries.flatMap(([k, v]) => [
        h('dt', { key: `${k}:k` }, humanKey(k)),
        h('dd', { key: `${k}:v` }, isRecord(v) || Array.isArray(v)
          ? depth > 1 ? h('span', { className: 'ptr-mono ptr-muted' }, JSON.stringify(v).slice(0, 160))
            : h('details', { className: 'ptr-details' }, h('summary', null, Array.isArray(v) ? `${v.length} items` : 'Details'), h(Value, { value: v, depth: depth + 1 }))
          : h(Value, { value: v, depth: depth + 1 }))]));
    }

    // One month at a time; the rest are in the dropdown.
    function OracleMonths({ data }) {
      const months = Array.isArray(data?.months) ? data.months : [];
      const keyOf = (m, i) => String(m.expiryId || m.period || m.market || i);
      const [picked, setPicked] = useState(null);
      if (!months.length) return h(Value, { value: data });
      const at = months.findIndex((m, i) => keyOf(m, i) === picked);
      const i = at >= 0 ? at : Math.max(0, months.findIndex(m => !m.settlementValue));
      const m = months[i];
      const name = (x, j) => x.label || (x.expiryId ? expiryIdLabel(x.expiryId) : null) || x.market || `Month ${j + 1}`;
      return h('div', { className: 'ptr-stack', style: { gap: 6 } },
        h('div', { className: 'ptr-line ptr-between' },
          months.length > 1 ? h(Select, { value: keyOf(m, i), label: 'Month', onChange: setPicked, options: months.map((x, j) => ({ value: keyOf(x, j), label: name(x, j) })) })
            : h('b', { style: { fontWeight: 500 } }, name(m, i)),
          h('span', { className: 'ptr-pill' }, m.phase || m.status || '—')),
        h('div', { className: 'ptr-cap' }, [m.sources?.length != null ? `${m.sources.length} sources` : null, m.buckets?.length ? `${m.buckets.length} buckets` : null,
          m.settlementValue ? `settled ${fixed(m.settlementValue)}` : null].filter(Boolean).join(' · ')));
    }

    // ---------------------------------------------------------------- research views
    // The workspace lists a code as E17787AA; the agent shows it as E177-87AA.
    const plainCode = code => String(code || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
    const sameCode = (a, b) => !!a && plainCode(a) === plainCode(b);
    const showCode = code => { const c = plainCode(code); return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : code; };
    function LoginBody({ data, petri }) {
      const [payout, setPayout] = useState('');
      const [approve, runApprove] = useAction(useCallback(async decision => {
        const snapshot = await petri.call({ action: 'workspace', operation: 'snapshot', input: {} });
        const pairing = (snapshot?.pairings || []).find(p => sameCode(p.code, data.userCode) || sameCode(p.userCode, data.userCode));
        if (!pairing) throw new Error('This code is no longer waiting for approval.');
        // Petri approves agents only once research rewards have a wallet to go to.
        if (decision === 'approve' && payout.trim()) await petri.call({ action: 'workspace', operation: 'address', input: { payoutAuthority: payout.trim() } });
        return petri.call({ action: 'workspace', operation: decision, input: { pairingId: pairing.id } });
      }, [petri, data?.userCode, payout]), bumpWorkspace);
      const needsWallet = /connect a wallet/i.test(approve.error || '');
      if (!data) return h('div', { className: 'ptr-empty' }, 'No reply.');
      if (data.status === 'connected') {
        return h('div', { className: 'ptr-line' }, h(DoneIcon),
          h('span', null, `Connected${data.agent?.name ? ` as ${data.agent.name}` : ''}`), data.session?.id ? h('span', { className: 'ptr-cap ptr-mono' }, short(String(data.session.id))) : null);
      }
      return h('div', { className: 'ptr-stack' },
        h('div', { className: 'ptr-line ptr-between ptr-wrap' },
          h('div', null, h('div', { className: 'ptr-cap' }, data.status === 'rejected' ? 'Rejected' : 'Pairing code'),
            h('div', { className: 'ptr-mono', style: { fontSize: 20, letterSpacing: '.12em' } }, data.userCode || '—')),
          petri && data.userCode && data.status !== 'rejected' && !approve.data ? h('div', { className: 'ptr-line' },
            h('button', { type: 'button', className: 'ptr-btn ptr-btn-solid', disabled: approve.busy, onClick: () => runApprove('approve') }, approve.busy ? h(Spin) : 'Approve'),
            h('button', { type: 'button', className: 'ptr-btn', disabled: approve.busy, onClick: () => runApprove('reject') }, 'Reject')) : null),
        needsWallet && !approve.data ? h('form', { className: 'ptr-stack', style: { gap: 6 }, onSubmit: e => { e.preventDefault(); if (payout.trim()) runApprove('approve'); } },
          h('div', { className: 'ptr-note' }, 'Research rewards need a wallet first. Paste the public address they should go to.'),
          h('div', { className: 'ptr-line' },
            h('input', { className: 'ptr-input ptr-mono', placeholder: 'Wallet address', value: payout, onChange: e => setPayout(e.target.value), spellCheck: false }),
            h('button', { type: 'submit', className: 'ptr-btn ptr-btn-solid', disabled: approve.busy || !payout.trim() }, 'Save and approve'))) : null,
        approve.data ? h('div', { className: 'ptr-line' }, h(DoneIcon), h('span', { className: 'ptr-note' }, 'Approved. Tell the agent to log in again to finish connecting.'))
          : data.nextStep && !needsWallet ? h('div', { className: 'ptr-note' }, data.nextStep) : null,
        needsWallet ? null : h(Alert, { error: approve.error || (typeof data.error === 'string' ? data.error : data.error?.message) }));
    }
    // Hundreds of assignments: pick a month and a kind, then one of what is left.
    const workKind = w => w.objective?.kind || 'other';
    const WORK_KINDS = { source: 'Find sources', update: 'Update prices' };
    function workLabel(w, withMonth = true) {
      const title = String(w.title || w.id || 'Assignment');
      const expiry = w.objective?.expiryId;
      if (!expiry) return title;
      const rest = title.replace(/^[A-Z]+\s·\s/, '');
      return withMonth ? `${expiryIdLabel(expiry)} · ${rest}` : rest;
    }
    function useAssignments(work) {
      const [month, setMonth] = useState('all');
      const [kind, setKind] = useState('all');
      const [picked, setPicked] = useState(null);
      const months = [...new Set(work.map(w => w.objective?.expiryId).filter(Boolean))].sort();
      const kinds = [...new Set(work.map(workKind))];
      const list = work.filter(w => (month === 'all' || w.objective?.expiryId === month) && (kind === 'all' || workKind(w) === kind));
      const current = list.find(w => w.id === picked) || list.find(w => w.focused) || list[0] || null;
      const count = id => work.filter(w => w.objective?.expiryId === id && (kind === 'all' || workKind(w) === kind)).length;
      const symbols = [...new Set(months.map(id => id.split('-')[0]))];
      const option = w => ({ value: w.id, label: workLabel(w, month === 'all') });
      const focused = list.filter(w => w.focused), rest = list.filter(w => !w.focused);
      const filters = months.length > 1 || kinds.length > 1 ? h('div', { className: 'ptr-line ptr-wrap' },
        months.length > 1 ? h(Select, { label: 'Month', value: month, onChange: v => { setMonth(v); setPicked(null); }, options: [{ value: 'all', label: 'All months' }],
          groups: symbols.map(sym => ({ label: sym, options: months.filter(id => id.startsWith(`${sym}-`)).map(id => ({ value: id, label: `${expiryIdLabel(id)} (${count(id)})` })) })) }) : null,
        kinds.length > 1 ? h(Select, { label: 'Kind', value: kind, onChange: v => { setKind(v); setPicked(null); },
          options: [{ value: 'all', label: 'All kinds' }, ...kinds.map(k => ({ value: k, label: WORK_KINDS[k] || humanKey(k) }))] }) : null) : null;
      const chooser = current ? h(Select, { wide: true, label: 'Assignment', value: current.id, onChange: setPicked,
        groups: focused.length ? [{ label: 'Researching', options: focused.map(option) }, { label: 'Others', options: rest.map(option) }] : [{ label: `${list.length} assignments`, options: rest.map(option) }] }) : null;
      return { filters, chooser, current, count: list.length };
    }
    function AssignmentFacts({ w }) {
      const o = w.objective || {};
      return h(Fragment, null,
        w.brief ? h(Clamp, { key: w.id, className: 'ptr-note' }, w.brief) : null,
        h('div', { className: 'ptr-cap' }, [WORK_KINDS[o.kind] || o.kind, o.bucketLabel, o.status, w.focused ? 'researching' : null].filter(Boolean).join(' · ')),
        o.url ? h('a', { className: 'ptr-link ptr-ellipsis', style: { display: 'block' }, href: o.url, target: '_blank', rel: 'noreferrer' }, o.url) : null);
    }
    function WorkList({ list }) {
      const pick = useAssignments(list);
      if (!list.length) return h('div', { className: 'ptr-empty' }, 'No assignments.');
      return h('div', { className: 'ptr-stack', style: { gap: 6 } }, pick.filters, pick.chooser,
        pick.current ? h(AssignmentFacts, { w: pick.current }) : h('div', { className: 'ptr-empty' }, 'None of this kind.'),
        pick.current?.guidance?.instruction ? h('div', { className: 'ptr-cap' }, `Guidance: ${pick.current.guidance.instruction}`) : null);
    }
    function WorkBody({ data }) {
      if (!data) return h('div', { className: 'ptr-empty' }, 'No reply.');
      if (data.status === 'idle') return h('div', { className: 'ptr-note' }, 'Nothing needs research right now.');
      const a = data.assignment || (Array.isArray(data.work) ? null : data);
      if (Array.isArray(data.work || data.items || data.assignments)) return h(WorkList, { list: data.work || data.items || data.assignments });
      const o = a?.objective || {};
      return h('div', { className: 'ptr-stack' },
        h('div', null, h('div', { style: { fontWeight: 500 } }, a?.title || 'Assignment'),
          h('div', { className: 'ptr-cap' }, [o.kind, o.bucketLabel, o.expiryId, data.resumed ? 'resumed' : null].filter(Boolean).join(' · '))),
        o.url ? h('a', { className: 'ptr-link', href: o.url, target: '_blank', rel: 'noreferrer' }, o.url) : null,
        data.directive ? h('div', { className: 'ptr-note' }, typeof data.directive === 'string' ? data.directive : data.directive.instruction || JSON.stringify(data.directive)) : null,
        data.run?.id ? h('div', { className: 'ptr-cap ptr-mono' }, `Run ${short(String(data.run.id))}`) : null);
    }
    const KINDS = { search: 'Search', read: 'Read', value: 'Value', submit: 'Submit', note: 'Note', source_found: 'Source', blocked: 'Blocked' };
    function ProgressLine({ args }) {
      return h('div', { className: 'ptr-line' }, h('span', { className: 'ptr-pill' }, KINDS[args.kind] || args.kind || 'Report'),
        h('span', { className: 'ptr-ellipsis' }, args.message || ''),
        args.referenceUrl ? h('a', { className: 'ptr-link', href: args.referenceUrl, target: '_blank', rel: 'noreferrer' }, 'source') : null);
    }

    // ---------------------------------------------------------------- bots
    // Trading bots (cli/docs/bots.md): made in the chat by the agent, run by
    // petri's own worker (`petri bots serve`, held by the host for as long as
    // Harness runs), each trading from a wallet of its own, shared through the
    // registry and ranked by real P&L. Their tab beside the chat has nothing to
    // type into: what a bot does changes in the chat.
    function createBotsFeed(call) {
      const store = createStore({ bots: null, serving: false, notes: [], error: null, at: 0 });
      let users = 0, timer = null, inflight = false;
      const refresh = (open = false) => {
        if (inflight) return;
        inflight = true;
        call({ action: 'bots', op: 'list', input: {}, ...(open ? { open: true } : {}) })
          .then(data => store.set({ bots: data?.bots || [], serving: !!data?.serving, notes: data?.notes || [], error: null, at: Date.now() }),
            error => store.set(s => ({ ...s, error: error.message || String(error), at: Date.now() })))
          .finally(() => { inflight = false; });
      };
      const tick = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        // A serving worker answers from memory every look; on disk, now and then.
        const s = store.get();
        if (s.serving || Date.now() - s.at > 15000) refresh();
      };
      return {
        store, refresh,
        use({ open = false } = {}) {
          useEffect(() => {
            users += 1;
            if (open || !store.get().at) refresh(open);
            if (users === 1) timer = setInterval(tick, 2000);
            return () => { users -= 1; if (users === 0) { clearInterval(timer); timer = null; } };
          }, [open]);
          return useStore(store);
        },
        apply(bot) {
          if (bot?.id) store.set(s => ({ ...s, bots: s.bots ? s.bots.map(b => b.id === bot.id ? bot : b).concat(s.bots.some(b => b.id === bot.id) ? [] : [bot]) : [bot] }));
        },
        drop(id) { store.set(s => ({ ...s, bots: s.bots ? s.bots.filter(b => b.id !== id) : s.bots })); },
        dispose() { clearInterval(timer); },
      };
    }

    const botState = bot => bot.running ? (bot.problem ? 'warning' : 'running') : bot.problem ? 'problem' : 'stopped';
    const STATE_NAMES = { running: 'Running', warning: 'Running', problem: 'Can’t run', stopped: 'Stopped' };
    const botName = b => b?.name || b?.id || '';
    const botMarket = b => b?.label || b?.symbol || b?.market || '';
    // What a bot does, by its strategy rows; the rows that feed them aren't worth naming.
    const KIND_NAMES = { 'strategy/script': 'Script', 'strategy/ladder': 'Ladder' };
    const botKinds = b => [...new Set((b?.kinds || []).map(k => KIND_NAMES[k]).filter(Boolean))];
    const botOption = b => ({ value: b.id, label: [botName(b), botMarket(b), b.running ? 'running' : null].filter(Boolean).join(' · ') });

    function StateDot({ bot }) {
      const s = botState(bot);
      // Why a bot waits or can't run is its dot's tooltip, not a line under it.
      const label = bot.problem || bot.waiting || STATE_NAMES[s];
      return h(Tip, { label }, h('span', { className: `ptr-dot ptr-dot-${s}`, role: 'img', 'aria-label': label, tabIndex: 0 }));
    }
    function Pnl({ atoms, big }) {
      const value = atomsToUsd(atoms);
      if (value === null) return null;
      return h('span', { className: `${tone(value)} ${big ? 'ptr-price' : 'ptr-num'}`, style: { flex: 'none' } }, `${signed(value)} USDC`);
    }
    function Pills({ bot }) {
      return h(Fragment, null, botKinds(bot).map(k => h('span', { key: k, className: 'ptr-pill' }, k)),
        botMarket(bot) ? h('span', { className: 'ptr-pill' }, botMarket(bot)) : null);
    }
    const IconBack = () => h('svg', { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M10 3 5 8l5 5' }));
    function BotsArt() {
      return h('svg', { width: '100%', height: '100%', viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
        h('rect', { x: 11, y: 15, width: 26, height: 21, rx: 6 }), h('path', { d: 'M24 15V9' }), h('circle', { cx: 24, cy: 7.5, r: 1.6, fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: 19, cy: 25, r: 2.2 }), h('circle', { cx: 29, cy: 25, r: 2.2 }), h('path', { d: 'M19.5 31h9', strokeOpacity: .6 }));
    }
    function Back({ label, onClick }) { return h(IconButton, { label, onClick }, h(IconBack)); }
    const Waiting = () => h('div', { className: 'ptr-line', style: { padding: 12 } }, h(Spin));

    // Start asks one thing, the bot's budget, on a bar; Stop asks nothing.
    const BUDGETS = [10, 25, 50, 100, 250, 500, 1000, 2500];
    function BudgetSlider({ value, onChange }) {
      const at = BUDGETS.reduce((best, v, i) => Math.abs(v - value) < Math.abs(BUDGETS[best] - value) ? i : best, 0);
      return h(StopSlider, { label: 'Budget', stops: BUDGETS, at, show: v => `${group(v)} USDC`, onChange });
    }
    function useBotAction(petri, bot) {
      return useAction(useCallback((op, input = {}) => petri.call({ action: 'bots', op, input: { bot: bot.id, ...input } }), [petri, bot.id]),
        useCallback(data => { if (data?.bot) petri?.bots?.apply(data.bot); if (data?.removed) petri?.bots?.drop(data.removed); }, [petri]));
    }
    function StartStop({ bot, petri, armed, onArm }) {
      const [state, act] = useBotAction(petri, bot);
      const [budget, setBudget] = useState(() => atomsToUsd(bot.budgetAtoms) || 100);
      if (bot.running || !armed) {
        return h(Fragment, null,
          bot.running ? h('button', { type: 'button', className: 'ptr-btn ptr-btn-wide', disabled: state.busy, onClick: () => act('stop') }, state.busy ? h(Spin) : 'Stop')
            : h('button', { type: 'button', className: 'ptr-btn ptr-btn-wide ptr-btn-solid', disabled: !!bot.problem, onClick: () => onArm(true) }, 'Start'),
          h(Alert, { error: state.error }));
      }
      return h('div', { className: 'ptr-stack', style: { gap: 8 } },
        h(BudgetSlider, { value: budget, onChange: setBudget }),
        h('div', { className: 'ptr-line' },
          h('button', { type: 'button', className: 'ptr-btn ptr-btn-wide ptr-btn-long', disabled: state.busy, onClick: () => act('start', { budget }).then(done => { if (done) onArm(false); }) },
            state.busy ? h(Spin) : `Start with ${group(budget)} USDC`),
          h(IconButton, { label: 'Cancel', onClick: () => onArm(false) }, h(IconClose))),
        h(Alert, { error: state.error }));
    }

    // A value over time: P&L, a price.
    function LineChart({ points, height = 120, show = fixed, label }) {
      const vs = points.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo || 1) * .12;
      const t0 = points[0].t, t1 = points[points.length - 1].t;
      const x = t => ((t - t0) / ((t1 - t0) || 1)) * 100;
      const y = v => 100 - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * 100;
      const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)} ${y(p.v).toFixed(2)}`).join(' ');
      const up = vs[vs.length - 1] >= vs[0];
      return h('div', null,
        h('div', { className: `ptr-chart ${up ? 'ptr-chart-up' : 'ptr-chart-down'}`, style: { height } },
          h('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${label} from ${show(vs[0])} to ${show(vs[vs.length - 1])}` },
            h('path', { className: 'ptr-chart-area', d: `${line} L100 100 L0 100 Z` }),
            h('path', { className: 'ptr-chart-line', d: line })),
          h('span', { className: 'ptr-chart-y', style: { top: `${y(hi)}%`, transform: 'translateY(-50%)' } }, show(hi)),
          h('span', { className: 'ptr-chart-y', style: { top: `${y(lo)}%`, transform: 'translateY(-50%)' } }, show(lo))),
        h('div', { className: 'ptr-chart-x' }, h('span', null, clock(t0)), h('span', null, clock(t1))));
    }
    // What a bot holds; a bot that rolled from month to month names the month of each.
    function Holdings({ list }) {
      const months = new Set(list.map(x => x.market).filter(Boolean)).size > 1;
      const cols = { gridTemplateColumns: 'minmax(0,.7fr) minmax(0,1.3fr) minmax(0,.6fr) minmax(0,1fr)' };
      return h('div', { className: 'ptr-table' }, list.map((x, i) => h('div', { key: i, className: 'ptr-tr', style: cols },
        h('span', { className: x.side === 'short' ? 'ptr-down' : 'ptr-up' }, x.side === 'short' ? 'Short' : 'Long'),
        h('span', { className: 'ptr-ellipsis' }, `${months && x.market ? `${x.market} ` : ''}${fixed(x.low)}–${fixed(x.high)}`),
        h('span', { className: 'ptr-num' }, group(x.lots)),
        h('span', { className: 'ptr-num' }, usdc(atomsToUsd(x.valueAtoms))))));
    }

    // One of the user's bots: P&L, what it holds, Start/Stop, and the rest is said in the chat.
    function BotDetail({ bot, petri, ask, armed, onArm, onBack }) {
      const [state, act] = useBotAction(petri, bot);
      const [removing, setRemoving] = useState(false);
      const points = (bot.points || []).map(p => ({ t: seconds(p.t), v: atomsToUsd(p.pnlAtoms) })).filter(p => p.t !== null && p.v !== null);
      const holdings = (bot.held || []).length ? bot.held : bot.holdings || [];
      const refused = bot.outcome?.kind === 'refused' ? bot.outcome.text : null;
      return h(Fragment, null,
        h(Section, null,
          h('div', { className: 'ptr-line' }, h(Back, { label: 'All bots', onClick: onBack }), h(StateDot, { bot }),
            h('b', { className: 'ptr-ellipsis ptr-grow', style: { fontWeight: 600, fontSize: 14 }, title: bot.about || undefined }, botName(bot)), h(Pills, { bot })),
          bot.about ? h(Clamp, { className: 'ptr-muted' }, bot.about) : null,
          h('div', { className: 'ptr-hero', title: bot.wallet ? `Trades from its own wallet ${bot.wallet}` : undefined },
            h(Pnl, { atoms: bot.pnlAtoms ?? '0', big: true }),
            bot.from && bot.counted ? h('span', { className: 'ptr-pill ptr-pill-up' }, 'Published') : null),
          points.length > 1 ? h(LineChart, { points, height: 96, show: v => signed(v), label: 'P&L' }) : null,
          h(StartStop, { bot, petri, armed, onArm }),
          bot.problem ? h(Alert, { error: bot.problem }) : refused ? h(Alert, { error: refused }) : null),
        holdings.length ? h(Section, { title: 'Holds' }, h(Holdings, { list: holdings })) : null,
        h(Section, null,
          h('div', { className: 'ptr-line ptr-wrap' },
            h('button', { type: 'button', className: 'ptr-btn', onClick: () => ask(`Change my Petri bot ${botName(bot)} (${bot.id}): `) }, 'Change in chat'),
            bot.from && bot.counted ? null : h('button', { type: 'button', className: 'ptr-btn', disabled: state.busy, onClick: () => act('publish') }, state.busy ? h(Spin) : bot.from ? 'Publish update' : 'Publish'),
            bot.running ? null : h('button', { type: 'button', className: 'ptr-link', style: { marginLeft: 'auto' }, disabled: state.busy,
              onClick: () => { if (!removing) { setRemoving(true); return; } setRemoving(false); act('remove').then(done => { if (done) onBack(); }); } }, removing ? 'Remove it?' : 'Remove')),
          h(Alert, { error: state.error })));
    }
    function BotRow({ bot, petri, onOpen }) {
      const [state, act] = useBotAction(petri, bot);
      const open = start => onOpen(bot.id, start);
      return h('li', { className: 'ptr-botrow', role: 'button', tabIndex: 0, onClick: () => open(false), onKeyDown: e => { if (e.key === 'Enter') open(false); } },
        h(StateDot, { bot }),
        h('span', { className: 'ptr-ellipsis ptr-grow', title: bot.about || undefined }, h('b', { style: { fontWeight: 500 } }, botName(bot)), ' ', h('span', { className: 'ptr-muted' }, botMarket(bot))),
        h(Pnl, { atoms: bot.pnlAtoms }),
        bot.running ? h('button', { type: 'button', className: 'ptr-btn', disabled: state.busy, title: state.error || undefined, onClick: e => { e.stopPropagation(); act('stop'); } }, state.busy ? h(Spin) : 'Stop')
          : h('button', { type: 'button', className: 'ptr-btn', disabled: !!bot.problem, onClick: e => { e.stopPropagation(); open(true); } }, 'Start'));
    }
    const BUILD = 'Build me a Petri trading bot that ';
    function MineView({ petri, ask, live, want, onDiscover }) {
      const feed = petri.bots.use({ open: live });
      const bots = feed.bots || [];
      const [open, setOpen] = useState(null);
      useEffect(() => { setOpen(want?.bot ? { id: want.bot, armed: !!want.start } : null); }, [want?.n]);
      if (!feed.bots) return feed.error ? h(Alert, { error: feed.error }) : h(Waiting);
      const bot = open && bots.find(b => b.id === open.id);
      if (bot) return h(BotDetail, { key: bot.id, bot, petri, ask, armed: open.armed, onArm: armed => setOpen(o => ({ ...o, armed })), onBack: () => setOpen(null) });
      if (!bots.length) {
        return h('div', { className: 'ptr-stack', style: { alignItems: 'center', padding: '32px 0', gap: 12 } },
          h('div', { className: 'ptr-muted', style: { width: 44, height: 44 } }, h(BotsArt)),
          h('button', { type: 'button', className: 'ptr-btn ptr-btn-solid', onClick: () => ask(BUILD) }, 'Build a bot in chat'),
          h('button', { type: 'button', className: 'ptr-link', onClick: onDiscover }, 'Browse the marketplace'),
          h(Alert, { error: feed.error }));
      }
      return h(Fragment, null,
        h('ul', { className: 'ptr-list' }, bots.map(b => h(BotRow, { key: b.id, bot: b, petri, onOpen: (id, start) => setOpen({ id, armed: start }) }))),
        h('div', { className: 'ptr-line', style: { marginTop: 12 } }, h('button', { type: 'button', className: 'ptr-btn', onClick: () => ask(BUILD) }, 'Build a bot in chat')),
        h(Alert, { error: feed.error }));
    }

    // The marketplace: other people's bots, each a thesis it trades, from the registry (GET /v1/bots).
    // A check: whoever controls the bot's GitHub repository published it.
    function Verified({ bot }) {
      if (!bot?.verified) return null;
      const where = bot.github ? `${bot.github.owner}/${bot.github.repo}` : 'GitHub';
      return h(Tip, { label: `Verified: published from ${where}` }, h('span', { className: 'ptr-verified', role: 'img', 'aria-label': 'Verified', tabIndex: 0 },
        h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': true },
          h('circle', { cx: 8, cy: 8, r: 7, fill: 'currentColor' }),
          h('path', { d: 'M4.8 8.2 7 10.3l4.2-4.6', fill: 'none', stroke: 'var(--dsw-alias-bg-base)', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }))));
    }
    function PublishedRow({ bot, onOpen }) {
      const ret = toNum(bot.returnBps);
      return h('li', { className: 'ptr-botrow', role: 'button', tabIndex: 0, onClick: onOpen, onKeyDown: e => { if (e.key === 'Enter') onOpen(); } },
        bot.rank ? h('span', { className: 'ptr-rank' }, bot.rank) : null,
        h('span', { className: 'ptr-grow', style: { minWidth: 0 } },
          h('span', { className: 'ptr-line', style: { gap: 5 } }, h('b', { className: 'ptr-ellipsis', style: { fontWeight: 500 } }, botName(bot)), h(Verified, { bot }),
            h('span', { className: 'ptr-muted', style: { flex: 'none', fontSize: 11.5 } }, bot.symbol || botMarket(bot))),
          // The thesis is what a bot is; it gets one line.
          bot.about ? h('span', { className: 'ptr-ellipsis ptr-muted', style: { display: 'block', fontSize: 12 } }, bot.about) : null),
        h('span', { style: { textAlign: 'right', flex: 'none' } },
          h('span', { style: { display: 'block' } }, h(Pnl, { atoms: bot.pnlAtoms })),
          bot.rank && ret !== null ? h('span', { className: `ptr-num ${tone(ret)}`, style: { display: 'block', fontSize: 11.5 } }, `${signed(ret / 100, 1)}%`) : null));
    }
    function useInstall(petri, id, onInstalled) {
      return useAction(useCallback(() => petri.call({ action: 'bots', op: 'install', input: { id } }), [petri, id]),
        useCallback(data => { if (data?.bot) petri.bots.apply(data.bot); if (data?.installed) onInstalled?.(data.installed); }, [petri, onInstalled]));
    }
    function PublishedDetail({ id, petri, ask, onBack, onInstalled }) {
      const read = useLoad(signal => petri.call({ action: 'bots', op: 'show', input: { id } }, signal), [petri, id]);
      const [state, install] = useInstall(petri, id, onInstalled);
      const b = read.data;
      const back = h(Back, { label: 'Back', onClick: onBack });
      if (!b) return h(Section, null, h('div', { className: 'ptr-line' }, back, read.error ? h(Alert, { error: read.error }) : h(Spin)));
      return h(Fragment, null,
        h(Section, null,
          h('div', { className: 'ptr-line' }, back, h('b', { className: 'ptr-ellipsis', style: { fontWeight: 600, fontSize: 14 } }, botName(b)), h(Verified, { bot: b }),
            h('span', { className: 'ptr-grow' }), h(Pills, { bot: b })),
          b.about ? h(Clamp, null, b.about) : null,
          h('div', { className: 'ptr-hero' }, h(Pnl, { atoms: b.pnlAtoms ?? '0', big: true })),
          h('dl', { className: 'ptr-dl' },
            h('dt', null, 'By'), h('dd', { className: 'ptr-mono', title: b.author }, short(b.author)),
            b.github ? h(Fragment, null, h('dt', null, 'Source'),
              h('dd', null, h('a', { className: 'ptr-link', href: b.github.url, target: '_blank', rel: 'noreferrer' }, `${b.github.owner}/${b.github.repo}`))) : null,
            h('dt', null, 'Runs'), h('dd', null, `${group(b.runs)} · ${group(b.runners)} ${toNum(b.runners) === 1 ? 'person' : 'people'}`),
            h('dt', null, 'Version'), h('dd', null, `${b.version} · ${ago(b.publishedAt)}`)),
          h('div', { className: 'ptr-line' },
            h('button', { type: 'button', className: 'ptr-btn ptr-btn-solid', disabled: state.busy, onClick: () => install() }, state.busy ? h(Spin) : 'Install'),
            h('button', { type: 'button', className: 'ptr-btn', onClick: () => ask(`How does the Petri bot ${botName(b)} (${b.id}) trade? `) }, 'Ask in chat')),
          h(Alert, { error: state.error })),
        b.text ? h(Section, null, h('details', { className: 'ptr-details' }, h('summary', null, 'Its file'), h('pre', { className: 'ptr-pre' }, b.text))) : null);
    }
    // Top is the leaderboard: ranked by the P&L of the wallets running each bot.
    const ORDERS = [
      { value: 'top30', label: 'Top this month', input: { sort: 'pnl', days: '30' } },
      { value: 'top7', label: 'Top this week', input: { sort: 'pnl', days: '7' } },
      { value: 'top', label: 'Top all time', input: { sort: 'pnl' } },
      { value: 'new', label: 'Newest', input: { sort: 'new' } },
      { value: 'runs', label: 'Most used', input: { sort: 'runs' } },
    ];
    function MarketplaceView({ petri, markets, live, ask, want, onInstalled }) {
      const [order, setOrder] = useState('top30');
      const [product, setProduct] = useState('');
      const [open, setOpen] = useState(null);
      useEffect(() => { setOpen(want?.id || null); }, [want?.n]);
      const input = { ...(ORDERS.find(o => o.value === order) || ORDERS[0]).input, ...(product ? { market: product } : {}) };
      const list = useLoad(signal => petri.call({ action: 'bots', op: 'discover', input }, signal),
        [petri, product, order], { interval: 60000, enabled: live && !open });
      if (open) return h(PublishedDetail, { key: open, id: open, petri, ask, onBack: () => setOpen(null), onInstalled });
      const bots = list.data?.bots || [];
      return h(Fragment, null,
        h('div', { className: 'ptr-line', style: { marginBottom: 6 } },
          h(Select, { label: 'Product', value: product, onChange: setProduct, options: [{ value: '', label: 'All markets' }, ...products(markets).map(p => ({ value: p.symbol, label: p.symbol }))] }),
          h(Select, { label: 'Order', value: order, onChange: setOrder, options: ORDERS })),
        list.data ? bots.length ? h('ul', { className: 'ptr-list' }, bots.map(b => h(PublishedRow, { key: b.id, bot: b, onOpen: () => setOpen(b.id) })))
          : h('div', { className: 'ptr-empty' }, 'No bots published yet.')
          : list.error ? h(Alert, { error: list.error }) : h(Waiting));
    }

    // The Bots tab beside the chat: the marketplace, and the user's own bots.
    const HUB_VIEWS = [{ value: 'marketplace', label: 'Marketplace' }, { value: 'mine', label: 'Mine' }];
    function BotsHub(props) {
      const petri = props.petri;
      const { tab } = props.useTabInfo();
      const live = tab?.visible !== false;
      const feed = petri.feed.use();
      const ask = useCallback(text => askInChat(props.inputActions, text), [props.inputActions]);
      const [view, setView] = useState('marketplace');
      // What to open in a view: { bot, start } in Mine, { id } in the marketplace; n moves it.
      const [want, setWant] = useState({ n: 0 });
      const go = (next, target = {}) => { setView(next); setWant(w => ({ ...target, n: w.n + 1 })); };
      const nav = tab?.navigation?.params || {};
      useEffect(() => {
        if (nav.bot) go('mine', { bot: nav.bot, start: !!nav.start });
        else if (nav.published) go('marketplace', { id: nav.published });
        else if (HUB_VIEWS.some(v => v.value === nav.hub)) go(nav.hub);
      }, [nav.bot, nav.published, nav.hub, tab?.navigation?.revision]);
      const focus = useStore(focusStore, all => all[petri.sessionId]);
      const seen = useRef(focus?.nonce);
      useEffect(() => {
        if (!focus || focus.nonce === seen.current) return;
        seen.current = focus.nonce;
        if (focus.bot) go('mine', { bot: focus.bot });
      }, [focus?.nonce]);
      useEffect(() => petri.botsMounted(), [petri]);
      return h('div', { className: 'ptr ptr-pane', 'data-petri-bots': '' },
        h('div', { className: 'ptr-tabs', role: 'tablist', 'aria-label': 'Bots' },
          HUB_VIEWS.map(v => h('button', { key: v.value, type: 'button', role: 'tab', className: 'ptr-tab', 'aria-selected': view === v.value, onClick: () => go(v.value) }, v.label))),
        view === 'mine' ? h(MineView, { petri, ask, live, want, onDiscover: () => go('marketplace') })
          : h(MarketplaceView, { petri, markets: feed.markets || [], live, ask, want, onInstalled: id => go('mine', { bot: id }) }));
    }

    // In the chat: a bot as a card, and the registry's lists.
    function BotCard({ bot: given, petri, onOpen }) {
      const live = useStore(petri?.bots?.store || EMPTY_STORE, s => s?.bots?.find?.(b => b.id === given.id));
      const bot = live || given;
      const [state, act] = useBotAction(petri, bot);
      return h('div', { className: 'ptr-stack', style: { gap: 6 }, 'data-petri-bot': bot.id },
        h('div', { className: 'ptr-line' },
          h(StateDot, { bot }),
          h('b', { className: 'ptr-ellipsis ptr-grow', style: { fontWeight: 600 }, title: bot.about || undefined }, botName(bot)),
          h(Pills, { bot }),
          bot.from && bot.counted ? h('span', { className: 'ptr-pill ptr-pill-up' }, 'Published') : null,
          h(Pnl, { atoms: bot.pnlAtoms }),
          petri ? bot.running ? h('button', { type: 'button', className: 'ptr-btn', disabled: state.busy, onClick: () => act('stop') }, state.busy ? h(Spin) : 'Stop')
            : h('button', { type: 'button', className: 'ptr-btn ptr-btn-solid', disabled: !!bot.problem, onClick: () => onOpen?.(bot, true) }, 'Start') : null,
          onOpen ? h(IconButton, { label: 'Open in Bots', onClick: () => onOpen(bot) }, h(IconOpen)) : null),
        bot.problem ? h(Alert, { error: bot.problem }) : null,
        h(Alert, { error: state.error }));
    }
    const EMPTY_STORE = createStore(null);
    function BotsBody({ entry, petri }) {
      const d = entry.data || {};
      const list = Array.isArray(d.bots) ? d.bots : d.bot ? [d.bot] : [];
      const [picked, setPicked] = useState(null);
      if (d.removed) return h('div', { className: 'ptr-empty' }, `Removed ${d.removed}.`);
      if (!list.length) return h('div', { className: 'ptr-empty' }, 'No bots yet.');
      const open = petri ? (b, start) => petri.open({ view: 'Bots', bot: b.id, ...(start ? { start: true } : {}) }) : undefined;
      // Several bots: one card, the others in the dropdown, a running one first.
      const bot = list.find(b => b.id === picked) || list.find(b => b.running) || list[0];
      return h('div', { className: 'ptr-stack' },
        list.length > 1 ? h(Select, { label: 'Bot', value: bot.id, onChange: setPicked, options: list.map(botOption) }) : null,
        h(BotCard, { key: bot.id, bot, petri, onOpen: open }));
    }
    function PublishedCard({ bot, petri }) {
      const [state, install] = useInstall(petri, bot.id);
      const installed = state.data?.installed;
      return h('div', { className: 'ptr-stack', style: { gap: 6 } },
        h('div', { className: 'ptr-line' },
          h('b', { className: 'ptr-ellipsis', style: { fontWeight: 600 }, title: bot.about || undefined }, botName(bot)), h(Verified, { bot }), h('span', { className: 'ptr-grow' }),
          h(Pills, { bot }), h(Pnl, { atoms: bot.pnlAtoms }),
          petri ? installed ? h('button', { type: 'button', className: 'ptr-btn', onClick: () => petri.open({ view: 'Bots', bot: installed }) }, 'Open')
            : h('button', { type: 'button', className: 'ptr-btn ptr-btn-solid', disabled: state.busy, onClick: () => install() }, state.busy ? h(Spin) : 'Install') : null),
        bot.about ? h(Clamp, { className: 'ptr-muted' }, bot.about) : null,
        h(Alert, { error: state.error }));
    }
    function PublishedList({ entry, petri }) {
      const list = Array.isArray(entry.data?.bots) ? entry.data.bots : [];
      const [shown, more] = useMore(list, 5);
      if (!list.length) return h('div', { className: 'ptr-empty' }, entry.name === 'petri_bots_leaderboard' ? 'No bots ranked yet.' : 'No published bots yet.');
      const open = b => petri?.open({ view: 'Bots', published: b.id });
      return h(Fragment, null, h('ul', { className: 'ptr-list' }, shown.map(b => h(PublishedRow, { key: b.id, bot: b, onOpen: () => open(b) }))), more);
    }
    function HubBody({ entry, petri }) {
      return entry.name === 'petri_bot_show' ? h(PublishedCard, { bot: entry.data || {}, petri }) : h(PublishedList, { entry, petri });
    }

    // ---------------------------------------------------------------- dispatch
    const TITLES = {
      petri_markets: 'Markets', petri_book: 'Order book', petri_trades: 'Trades', petri_chart: 'Chart', petri_quote: 'Quote',
      petri_order: 'Order', petri_cancel: 'Cancel', petri_close: 'Close', petri_positions: 'Positions', petri_history: 'History',
      petri_wallet: 'Wallet', petri_oracle: 'Oracle', petri_command: 'Petri',
      petri_login: 'Connect', petri_work_list: 'Assignments', petri_work_next: 'Research', petri_work_start: 'Research',
      petri_report_progress: 'Report', petri_submit_candidate: 'Candidate', petri_run_finish: 'Run finished', petri_activity: 'Activity',
      petri_rewards: 'Rewards', petri_session_open: 'Session', petri_session_close: 'Session',
      petri_bots: 'Bots', petri_bot_read: 'Bot', petri_bot_write: 'Bot', petri_bot_new: 'New bot', petri_bot_set: 'Bot', petri_bot_start: 'Bot started',
      petri_bot_stop: 'Bot stopped', petri_bot_publish: 'Bot published', petri_bot_remove: 'Bot removed', petri_bot_install: 'Bot installed',
      petri_bots_discover: 'Bots to install', petri_bot_show: 'Bot', petri_bots_leaderboard: 'Bots leaderboard', petri_bot: 'Bot', petri_bot_hub: 'Bots',
    };
    // A petri_command result is shown like the structured read it ran.
    // ...and a market or trade command run through it draws nothing, like the trade tools.
    const TRADE_COMMANDS = ['markets', 'market', 'book', 'trades', 'chart', 'quote', 'long', 'short', 'close', 'cancel', 'positions', 'wallet', 'history', 'deposit', 'withdraw'];
    function viewName(entry) {
      if (HUB_TOOLS.includes(entry.name)) return 'petri_bot_hub';
      if (BOT_TOOLS.includes(entry.name)) return 'petri_bot';
      if (entry.name !== 'petri_command') return entry.name;
      return TRADE_COMMANDS.includes(entry.data?.command) ? 'petri_trade' : 'petri_command';
    }
    function summary(entry) {
      const a = entry.args || {}, d = entry.data || {};
      switch (entry.name) {
        case 'petri_command': return Array.isArray(a.args) ? `petri ${a.args.join(' ')}` : '';
        case 'petri_markets': return a.market || (Array.isArray(d.markets) ? products(d.markets).map(p => p.symbol).join(' · ') : '');
        case 'petri_quote': case 'petri_order': return [a.side, a.market, a.lots ? `${a.lots} lots` : a.usd ? `${a.usd} USDC` : null, a.limit ? `limit ${a.limit}` : null].filter(Boolean).join(' · ');
        case 'petri_cancel': return [a.market, a.order === 'all' ? 'all orders' : a.order && `order ${a.order}`].filter(Boolean).join(' · ');
        case 'petri_close': return [a.market, a.position === 'all' ? 'all positions' : a.position && `position ${a.position}`, a.lots && `${a.lots} lots`].filter(Boolean).join(' · ');
        case 'petri_report_progress': return a.message || '';
        case 'petri_oracle': return [a.view, a.market].filter(Boolean).join(' · ');
        case 'petri_bots': return Array.isArray(d.bots) ? `${d.bots.length} bot${d.bots.length === 1 ? '' : 's'}${d.bots.some(b => b.running) ? ` · ${d.bots.filter(b => b.running).length} running` : ''}` : '';
        case 'petri_bot_new': return d.created || a.market || '';
        case 'petri_bot_write': return botName(d.bot) || d.written || '';
        case 'petri_bot_install': return botName(d.bot) || d.installed || a.id || '';
        case 'petri_bot_set': case 'petri_bot_read': case 'petri_bot_start': case 'petri_bot_stop': case 'petri_bot_publish': case 'petri_bot_remove':
          return botName(d.bot) || a.bot || '';
        case 'petri_bot_show': return botName(d) || a.id || '';
        case 'petri_bots_discover': case 'petri_bots_leaderboard':
          return Array.isArray(d.bots) ? `${d.bots.length} bot${d.bots.length === 1 ? '' : 's'}${a.days ? ` · ${a.days} days` : ''}` : '';
        default: return d.label || a.market || a.owner || '';
      }
    }
    // A result too large for the Harness arrives cut short; show its text instead of a card.
    function RawResult({ text }) {
      const cut = /\(Omitted [\d,]+ bytes/.test(text);
      return h('details', { className: 'ptr-details' }, h('summary', null, cut ? 'Petri returned more than the chat keeps. Show what arrived' : 'Show the result'),
        h('pre', { className: 'ptr-pre' }, text));
    }
    function EntryBody({ entry, petri }) {
      const d = entry.data;
      if (!d && entry.text) return h(RawResult, { text: entry.text });
      if (TRADE_TOOLS.includes(entry.name)) return null;
      switch (viewName(entry)) {
        case 'petri_trade': return null;
        case 'petri_oracle': return entry.args?.view === 'months' || entry.args?.view === 'history' ? h(OracleMonths, { data: d }) : h(Value, { value: d });
        case 'petri_login': return h(LoginBody, { data: d, petri });
        case 'petri_work_list': case 'petri_work_next': case 'petri_work_start': return h(WorkBody, { data: d });
        case 'petri_report_progress': return null;
        case 'petri_bot': return h(BotsBody, { entry, petri });
        case 'petri_bot_hub': return h(HubBody, { entry, petri });
        default: return d ? h(Value, { value: d }) : entry.text ? h('pre', { className: 'ptr-pre' }, entry.text) : null;
      }
    }

    // The tool row in the chat: the host's row grammar, the Petri body under it.
    function PetriToolView(props) {
      const petri = props.petri;
      const entry = useMemo(() => entryFromBlock(props), [props.phase, props.block, props.toolName, props.callId]);
      const firstPhase = useRef(props.phase);
      const [open, setOpen] = useState(true);
      const running = entry.state === 'preparing' || entry.state === 'running';
      // A chat that used research or bots keeps Petri's strip; market reads alone don't bring it.
      const kind = RESEARCH_TOOLS.includes(entry.name) ? 'research' : BOT_TOOLS.includes(entry.name) ? 'bots' : null;
      useEffect(() => { if (kind) petri?.note(kind); }, [petri, kind]);
      // Only a call that ran while this chat was open moves the sidebar; history replays never do.
      // A bot the agent just made, changed, started or installed opens in the Bots tab; a read of one doesn't.
      const botId = entry.state === 'ok' && viewName(entry) === 'petri_bot' && entry.name !== 'petri_bot_read'
        ? entry.data?.bot?.id || entry.data?.written || entry.data?.installed || entry.data?.created || null : null;
      useEffect(() => {
        if (!petri || !botId || firstPhase.current === 'result') return;
        if (entry.data?.bot) petri.bots.apply(entry.data.bot);
        petri.reveal({ view: 'Bots', bot: botId });
      }, [petri, botId]);
      const failed = entry.state === 'error' || entry.state === 'stopped';
      // Trades and market reads have no card: the row says what ran.
      const drawn = entry.state === 'ok' && entry.name !== 'petri_report_progress' && !TRADE_TOOLS.includes(entry.name) && viewName(entry) !== 'petri_trade';
      const body = drawn ? h(EntryBody, { entry, petri }) : null;
      return h('div', { className: 'ptr ptr-card', 'data-petri-tool': entry.name, 'data-state': entry.state },
        h('div', { className: 'ptr-row', 'data-expandable': body ? '' : undefined, onClick: body ? () => setOpen(o => !o) : undefined },
          h('span', { className: 'ptr-lead' }, h(Glyph)),
          h(Shimmer, { active: running, className: 'ptr-title' }, TITLES[entry.name] || 'Petri'),
          entry.name === 'petri_report_progress' && entry.args?.kind ? h(Fragment, null, h('span', { className: 'ptr-sep' }), h('span', { className: 'ptr-title' }, KINDS[entry.args.kind] || entry.args.kind)) : null,
          summary(entry) || failed ? h(Fragment, null, h('span', { className: 'ptr-sep' }),
            h('span', { className: `ptr-summary${failed ? ' ptr-err' : ''}`, title: failed ? entry.text : undefined },
              failed ? firstLine(entry.text).replace(/^Error:\s*/, '') || (entry.state === 'stopped' ? 'Stopped' : 'Failed') : summary(entry))) : null),
        body && open ? h('div', { className: 'ptr-panel' }, h('div', { className: 'ptr-panel-body' }, body)) : null);
    }

    // ---------------------------------------------------------------- turn tail
    // Petri results of a finished turn, kept under the answer where folding cannot hide them.
    const TAIL_ORDER = ['petri_login', 'petri_bot', 'petri_bot_hub', 'petri_work_next', 'petri_work_start'];
    const petriDefinition = {
      kind: 'petri',
      match(event) {
        if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' };
        if (event.type === 'tool/call' && typeof event.data?.name === 'string' && event.data.name.startsWith('petri_')) return { id: String(event.data.turn), role: 'update' };
        if (event.type === 'tool/result' && (event.surfaceOp === undefined || event.surfaceOp === 'append') && event.data?.message?.source?.callId !== undefined) return { id: String(event.data.turn), role: 'update' };
        return null;
      },
      start(_context, match) { return { turn: match.event.data.turn, calls: new Map(), results: [] }; },
      update(context, match) {
        const event = match.event, state = context.state;
        if (event.type === 'tool/call') {
          const calls = new Map(state.calls);
          calls.set(String(event.data.callId), { name: event.data.name, argsRaw: event.data.arguments });
          return { ...state, calls };
        }
        if (event.type !== 'tool/result') return state;
        const callId = String(event.data.message.source.callId);
        const call = state.calls.get(callId);
        if (!call || event.data.message.isError === true) return state;
        let args = {};
        try { const parsed = JSON.parse(call.argsRaw || '{}'); if (isRecord(parsed)) args = parsed; } catch { /* malformed arguments show no artifact */ }
        const text = contentText(event.data.message.content);
        return { ...state, results: [...state.results, { seq: event.seq, callId, name: call.name, args, text }] };
      },
      buildLocationData(context, scope, previous) {
        if (scope !== 'turn' || context.state === undefined) return null;
        if (previous?.kind === 'turn' && previous.key === 'petri' && previous.turn === context.state.turn && previous.value.results === context.state.results) return previous;
        return { kind: 'turn', turn: context.state.turn, key: 'petri', value: { results: context.state.results } };
      },
    };
    function tailEntries(results, seq) {
      const latest = new Map();
      for (const r of results || []) {
        if (r.seq > seq) continue;
        const entry = { name: r.name, callId: r.callId, args: r.args, state: 'ok', text: r.text, data: parseResult(r.text) };
        if (!entry.data) continue;
        const view = viewName(entry);
        if (!TAIL_ORDER.includes(view)) continue;
        // Each bot keeps its latest card, each registry read its latest list.
        const key = view === 'petri_bot' ? `${view}:${entry.data?.bot?.id || entry.data?.written || entry.data?.installed || entry.data?.created || entry.data?.removed || (Array.isArray(entry.data?.bots) ? 'all' : '')}`
          : view === 'petri_bot_hub' ? `${view}:${entry.name === 'petri_bot_show' ? entry.data?.id : entry.name}`
            : view;
        latest.set(key, { ...entry, view });
      }
      const login = [...latest.values()].filter(e => e.view === 'petri_login');
      if (login.length && login[login.length - 1].data?.status === 'connected') for (const [k, e] of latest) if (e.view === 'petri_login') latest.delete(k);
      return [...latest.values()].sort((a, b) => TAIL_ORDER.indexOf(a.view) - TAIL_ORDER.indexOf(b.view));
    }
    function PetriTail(props) {
      const data = props.turn?.data?.get?.('petri');
      const entries = useMemo(() => tailEntries(data?.results, props.seq ?? Infinity), [data, props.seq]);
      const petri = props.petriRuntime && props.sessionId ? props.petriRuntime.forSession(props.sessionId) : null;
      if (!entries.length) return null;
      return h('div', { className: 'ptr ptr-tail', 'data-petri-tail': '' }, entries.map(entry => h(Panel, {
        key: entry.callId,
        head: h(PanelHead, { title: TITLES[entry.view] || 'Petri', subtitle: summary({ ...entry, name: entry.name }) }),
      }, h(EntryBody, { entry, petri }))));
    }

    // ---------------------------------------------------------------- composer dock
    function PendingPairings({ petri }) {
      const tick = useStore(workspaceTick);
      const snapshot = useLoad(signal => petri.call({ action: 'workspace', operation: 'snapshot', input: {} }, signal), [petri, tick], { interval: 10000 });
      const pairings = snapshot.data?.pairings || [];
      const [state, act] = useAction(useCallback(id => petri.call({ action: 'workspace', operation: 'approve', input: { pairingId: id } }), [petri]), bumpWorkspace);
      // Without a rewards wallet Petri refuses; the sidebar's Connect section asks for one.
      useEffect(() => { if (/connect a wallet/i.test(state.error || '')) petri.open({ view: 'Research' }); }, [state.error, petri]);
      if (!pairings.length) return null;
      const p = pairings[0];
      return h(Tip, { label: state.error || `${p.name || 'An agent'} wants to connect` }, h('button', { type: 'button', className: 'ptr-dock-chip', disabled: state.busy, onClick: () => act(p.id) },
        state.busy ? h(Spin) : UI.StateDot ? h(UI.StateDot, { state: 'warning' }) : null, h('span', { className: 'ptr-mono' }, showCode(p.code)), 'Approve'));
    }
    function PetriDock({ petri }) {
      const session = useSession(petri?.sessionId);
      const visible = !!petri && !session.hidden && (session.pinned || session.research || session.bots);
      if (!visible) return null;
      return h(DockBar, { petri, session });
    }
    // The strip on the composer: an agent waiting to connect, the bots running, and the way to the sidebar.
    function DockBar({ petri, session }) {
      return h('div', { className: 'ptr ptr-dock', 'data-petri-dock': '' },
        h('div', { className: 'ptr-dockbar' },
          h('span', { className: 'ptr-muted', style: { display: 'inline-flex' } }, h(Glyph)),
          h('span', { className: 'ptr-dock-name ptr-grow' }, 'Petri'),
          session.research ? h(PendingPairings, { petri }) : null,
          h(RunningBots, { petri }),
          h(IconButton, { label: 'Open Petri beside the chat', onClick: () => petri.open({}) }, h(IconOpen)),
          h(IconButton, { label: 'Hide Petri in this chat', onClick: () => patchSession(petri.sessionId, { hidden: true, pinned: false }) }, h(IconClose))));
    }

    // While petri runs bots for DeepSeek, the strip says how many and opens them.
    function RunningBots({ petri }) {
      const serving = useStore(petri.bots.store, s => s.serving);
      return serving ? h(RunningBotsChip, { petri }) : null;
    }
    function RunningBotsChip({ petri }) {
      const feed = petri.bots.use();
      const running = (feed.bots || []).filter(b => b.running);
      if (!running.length) return null;
      const trouble = running.some(b => b.problem || b.outcome?.kind === 'refused');
      return h(Tip, { label: running.map(botName).join(', ') }, h('button', { type: 'button', className: 'ptr-dock-chip', onClick: () => petri.open({ view: 'Bots', bot: running[0].id }) },
        UI.StateDot ? h(UI.StateDot, { state: trouble ? 'warning' : 'ongoing' }) : null, `${running.length} bot${running.length === 1 ? '' : 's'} running`));
    }
    // Petri on demand: the strip shows in this chat and a tab opens beside it. The header
    // button, the same button under a new chat's composer, and /petri all do this.
    function showPetri(petriRuntime, sessionId, params = {}) {
      const petri = petriRuntime.forSession(sessionId);
      patchSession(petri.sessionId, { hidden: false, pinned: true });
      petri.open(params);
    }
    function PetriHeaderAction({ sessionId, petriRuntime }) {
      return h(Tip, { label: 'Petri research and bots' }, h('button', {
        type: 'button', className: 'ptr-hdr', 'aria-label': 'Petri',
        onClick: () => showPetri(petriRuntime, sessionId),
      }, h(Glyph), 'Petri'));
    }
    // Client commands in the composer's / menu. They run in the window, so they work in a new
    // chat before its first message, when Harness hides the header's actions.
    const COMMANDS = [
      { name: 'petri', label: () => 'Petri', description: () => 'Open Petri beside the chat', params: { view: 'Research' } },
      { name: 'petri-bots', label: () => 'Petri bots', description: () => 'Open Petri’s bots beside the chat', params: { view: 'Bots' } },
    ];

    // ---------------------------------------------------------------- sidebar pane
    // Research and the oracle; bots have a tab of their own beside this one (BotsHub), and
    // markets and trading are the agent's tools only.
    //
    // The pane is a visual aid beside the chat, drawn as the site draws its pages: what is
    // connected and what it is doing, a few figures, then one row per thing with a status
    // word. Anything the agent can do (choose and steer work, sponsor, claim, prove, move
    // collateral) is asked in the chat: the chips put the request in the composer. The pane
    // keeps only what a person must do themselves, like approving an agent.
    const PANE_TABS = ['Research', 'Oracle'];
    function PetriPane(props) {
      const petri = props.petri;
      const { tab } = props.useTabInfo();
      const [view, setView] = useState('Research');
      const navView = tab?.navigation?.params?.view;
      useEffect(() => { if (PANE_TABS.includes(navView)) setView(navView); }, [navView, tab?.navigation?.revision]);
      useEffect(() => petri.paneMounted(), [petri]);
      useEffect(() => tab?.actions?.bindCommands?.({ refresh: bumpWorkspace }), [tab?.actions]);
      const ask = useCallback(text => askInChat(props.inputActions, text), [props.inputActions]);
      // The pane stays mounted while the sidebar is closed; its reads wait until it shows again.
      const live = tab?.visible !== false;
      return h('div', { className: 'ptr ptr-pane', 'data-petri-pane': '' },
        h('div', { className: 'ptr-tabs', role: 'tablist', 'aria-label': 'Petri' },
          PANE_TABS.map(name => h('button', { key: name, type: 'button', role: 'tab', className: 'ptr-tab', 'aria-selected': view === name, onClick: () => setView(name) }, name))),
        view === 'Research' ? h(ResearchPane, { petri, live, ask }) : h(OraclePane, { petri, live, ask }));
    }

    function Section({ title, actions, children }) {
      return h('section', { className: 'ptr-section' },
        title ? h('div', { className: 'ptr-section-title' }, h('span', { className: 'ptr-grow' }, title), actions || null) : null, children);
    }

    const NO_WALLET = /no wallet yet/i;
    function NoWallet({ error }) {
      const path = (String(error).match(/at (.+?\.json)/) || [])[1];
      return h('div', { className: 'ptr-stack', style: { gap: 6 } },
        h('div', null, 'No Petri wallet on this computer yet.'),
        h('div', { className: 'ptr-note' }, 'Create one in a terminal with ', h('span', { className: 'ptr-mono' }, 'petri wallet new'),
          ', or set the plugin’s keypair path to a wallet you already have.'),
        path ? h('div', { className: 'ptr-cap ptr-mono ptr-ellipsis', title: path }, path) : null);
    }

    // Rows: when, what (and a second line under it), and a status word, as the site's tables.
    const since = ts => { const s = seconds(ts); if (s === null) return ''; const d = Math.max(0, Date.now() / 1000 - s);
      return d < 60 ? 'now' : d < 3600 ? `${Math.floor(d / 60)}m` : d < 86400 ? `${Math.floor(d / 3600)}h` : `${Math.floor(d / 86400)}d`; };    const domain = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };
    // A message's first sentence; the row shows what fits and the whole message on hover.
    const firstSentence = text => { const t = String(text || '').replace(/\s+/g, ' ').trim(); const m = /^(.{24,}?[.;!?])\s/.exec(t); return m ? m[1] : t; };
    function Row({ at, title, sub, status, statusTitle, href, hint }) {
      return h('li', { className: at === undefined ? 'ptr-r ptr-r-nt' : 'ptr-r', title: hint || undefined },
        at === undefined ? null : h('time', { dateTime: seconds(at) ? new Date(seconds(at) * 1000).toISOString() : undefined, title: at ? clock(at) : undefined }, since(at)),
        h('div', { className: 'ptr-t' }, href ? h('a', { href, target: '_blank', rel: 'noreferrer' }, title) : title, sub ? h('small', null, sub) : null),
        status ? h('span', { className: 'ptr-s', title: statusTitle || undefined }, status) : h('span'));
    }
    function Rows({ list, max = 6, render, empty }) {
      const [all, setAll] = useState(false);
      if (!list.length) return empty ? h('div', { className: 'ptr-empty' }, empty) : null;
      return h(Fragment, null, h('ul', { className: 'ptr-rows' }, (all ? list : list.slice(0, max)).map(render)),
        list.length > max ? h('button', { type: 'button', className: 'ptr-link', style: { marginTop: 6 }, onClick: () => setAll(v => !v) }, all ? 'Fewer' : `All ${list.length}`) : null);
    }
    function Block({ title, children, more }) {
      return h('section', { className: 'ptr-block' }, title ? h('h3', { className: 'ptr-h' }, title, more || null) : null, children);
    }
    function Figures({ items }) {
      return h('div', { className: 'ptr-figs' }, items.map(([label, value, cls]) => h('div', { key: label, className: 'ptr-fig' }, h('span', null, label), h('b', { className: cls || undefined }, value))));
    }
    // Requests for the agent, put in the composer for the person to send.
    function Asks({ ask, items }) {
      const shown = items.filter(Boolean);
      return shown.length ? h('div', { className: 'ptr-chips' }, shown.map(([label, text]) => h('button', { key: label, type: 'button', className: 'ptr-chip', onClick: () => ask(text) }, label))) : null;
    }

    // A source's routing status in the site's words (web/src/lib/oracle/routing.ts).
    const ROUTING = {
      ELIGIBLE_FOR_CONTRACT: 'Counts this month', CLASSIFIED_CANDIDATE: 'Fits the bucket', DUPLICATE_NO_EXTRA_WEIGHT: 'Already counted',
      NEEDS_METADATA: 'Missing details', WRONG_PRODUCT: 'Wrong product', WRONG_PRICE_BASIS: 'Not a contract price', RESEARCH_ONLY: 'Research only',
      OUTSIDE_COMMITTED_SERIES: 'Not in this month', SCOPE_CHANGE: 'Definition changed', STALE_OR_WRONG_PERIOD: 'Wrong period',
    };
    const routingWord = r => r?.status ? ROUTING[r.status] || humanKey(String(r.status).toLowerCase()) : null;
    const routingReasons = r => (r?.reasons || []).map(x => x.message).filter(Boolean).join('\n');
    // What a source is about: its product, then its month and the site it is on.
    const sourceName = d => d?.productDefinition || d?.bucketLabel || domain(d?.canonicalUrl) || 'Source';
    const sourceSub = d => [d?.expiryId ? expiryIdLabel(d.expiryId) : null, domain(d?.canonicalUrl)].filter(Boolean).join(' · ');

    const EVENT_WORDS = { run_started: 'Started', run_finished: 'Finished', source_found: 'Found', candidate_received: 'Sent', blocked: 'Blocked', note: 'Note', search: 'Searching', read: 'Reading', value: 'Priced', submit: 'Sending' };
    // Whether the agent is at work, as petri decides it: its open run is in the snapshot's
    // `activity` while the agent keeps checking in (ACTIVE_MS in cli/src/research/service/
    // work.rs). An open run alone may be one the agent left behind, so otherwise the pane
    // says when the agent was last seen.
    function agentStatus(s, agent, run) {
      if (!agent) return null;
      const sel = s.selected?.agent?.id === agent.id ? s.selected : {};
      const lastSeen = Math.max(0, ...[
        ...(sel.sessions || []).flatMap(x => [x.heartbeatAt, x.closedAt]),
        ...(sel.events || []).filter(e => e.actor === 'agent').map(e => e.createdAt),
        ...(s.activity || []).filter(a => a.agentId === agent.id).map(a => a.lastSeenAt),
      ].map(t => seconds(t) || 0)) || null;
      const running = !agent.revokedAt && (s.activity || []).some(a => a.agentId === agent.id);
      const word = agent.revokedAt ? 'Disconnected' : running ? 'Researching' : lastSeen ? `Last seen ${ago(lastSeen)}` : 'Idle';
      const runNote = !run ? null : running ? `since ${ago(run.createdAt)}`
        : run.finishedAt ? `finished ${ago(run.finishedAt)}` : `stopped ${ago(lastSeen || run.createdAt)}`;
      return { running, lastSeen, word, runNote };
    }
    function ResearchPane({ petri, live, ask }) {
      const [agentId, setAgentId] = useState('');
      const tick = useStore(workspaceTick);
      const snapshot = useLoad(signal => petri.call({ action: 'workspace', operation: 'snapshot', input: agentId ? { agentId } : {} }, signal), [petri, agentId, tick], { interval: 10000, enabled: live });
      const [state, act] = useAction(useCallback((operation, input = {}) => petri.call({ action: 'workspace', operation, input }), [petri]), bumpWorkspace);
      const [address, setAddress] = useState('');
      const [changing, setChanging] = useState(false);
      const s = snapshot.data || {};
      if (!snapshot.data) return snapshot.error ? h(Alert, { error: snapshot.error }) : null;
      const agents = s.agents || [], pairings = s.pairings || [], work = s.work || [];
      const sel = s.selected || {};
      const events = (sel.events || []).slice(-60).reverse(), sent = sel.submissions || [], runs = sel.runs || [];
      const agent = agents.find(a => a.id === (agentId || sel.agent?.id)) || agents[0] || null;
      const payout = s.settings?.payoutAuthority;
      const run = runs[0] || null;
      const status = agentStatus(s, agent, run);
      const running = !!status?.running;
      const runWork = run ? work.find(w => w.id === run.workId) : null;
      const goal = runWork?.objective?.targets?.activeSources;
      const have = runWork?.objective?.activeSources;
      const saveWallet = e => { e.preventDefault(); if (address.trim()) act('address', { payoutAuthority: address.trim() }).then(done => { if (done) { setChanging(false); setAddress(''); } }); };
      const walletForm = (label, onSubmit) => h('form', { className: 'ptr-line', onSubmit },
        h('input', { className: 'ptr-input ptr-mono', placeholder: 'Rewards wallet address', 'aria-label': 'Rewards wallet address', value: address, spellCheck: false, onChange: e => setAddress(e.target.value) }),
        h('button', { type: 'submit', className: 'ptr-btn ptr-btn-solid', disabled: state.busy || !address.trim() }, label));
      return h(Fragment, null,
        // Only a person approves an agent: a request shows first, while it waits.
        pairings.map(p => h('div', { key: p.id, className: 'ptr-request' },
          h('div', { className: 'ptr-cap' }, `${p.name || 'An agent'}${p.harness ? ` (${p.harness})` : ''} wants to research for you`),
          h('div', { className: 'ptr-line ptr-between', style: { marginTop: 6 } },
            h('span', { className: 'ptr-mono', style: { fontSize: 18, letterSpacing: '.12em' } }, showCode(p.code)),
            h('div', { className: 'ptr-line' },
              payout ? h('button', { type: 'button', className: 'ptr-btn ptr-btn-solid', disabled: state.busy, onClick: () => act('approve', { pairingId: p.id }) }, 'Approve') : null,
              h('button', { type: 'button', className: 'ptr-btn', disabled: state.busy, onClick: () => act('reject', { pairingId: p.id }) }, 'Reject'))),
          payout ? null : h('div', { className: 'ptr-stack', style: { gap: 6, marginTop: 8 } },
            h('div', { className: 'ptr-note' }, 'Its rewards need a wallet to go to.'),
            walletForm('Save and approve', e => { e.preventDefault(); if (address.trim()) act('address', { payoutAuthority: address.trim() }).then(done => { if (done) { setAddress(''); act('approve', { pairingId: p.id }); } }); })))),
        h(Block, null,
          agent ? h(Fragment, null,
            h('div', { className: 'ptr-who' },
              h('span', { className: `ptr-dot${running ? ' ptr-dot-running' : ''}` }),
              agents.length > 1 ? h(Select, { small: true, label: 'Agent', value: agent.id, onChange: setAgentId, options: agents.map(a => ({ value: a.id, label: a.name })) }) : h('b', null, agent.name),
              agent.harness ? h('span', { className: 'ptr-muted' }, agent.harness) : null,
              h('span', { className: 'ptr-state', title: status.lastSeen ? `Last seen ${clock(status.lastSeen)}` : undefined }, status.word)),
            run ? h('div', { className: 'ptr-now', title: run.summary || undefined },
              h('div', { className: 'ptr-ellipsis' }, runWork ? workLabel(runWork) : run.title || 'Assignment'),
              h('small', null, [status.runNote, goal ? `${have || 0} of ${goal} sources` : null].filter(Boolean).join(' · '))) : null,
            h('div', { className: 'ptr-cap', style: { marginTop: 8 } }, [`${sent.length} sources sent`, `${work.length} assignments open`].join(' · ')))
            : h('div', { className: 'ptr-note' }, 'No agent connected yet.'),
          changing ? h('div', { style: { marginTop: 8 } }, walletForm('Save', saveWallet))
            : h('div', { className: 'ptr-line ptr-cap', style: { marginTop: 4 } },
              h('span', { className: 'ptr-grow', title: payout || undefined }, payout ? `Rewards go to ${short(payout)}` : 'No rewards wallet yet'),
              h('button', { type: 'button', className: 'ptr-link', onClick: () => setChanging(true) }, payout ? 'Change' : 'Set'),
              agent && !agent.revokedAt ? h('button', { type: 'button', className: 'ptr-link', disabled: state.busy, onClick: () => act('revoke', { agentId: agent.id }) }, 'Disconnect') : null),
          h(Alert, { error: state.error })),
        h(Block, { title: 'Activity' },
          h(Rows, { list: events, empty: agent ? 'Nothing yet.' : null, render: (e, i) => {
            const word = EVENT_WORDS[e.kind] || humanKey(e.kind || 'note');
            // "Started: RAMX …" under "Started" says it once.
            const said = firstSentence(e.message).replace(new RegExp(`^${word}\\s*:\\s*`, 'i'), '');
            return h(Row, { key: e.sequence || i, at: e.createdAt, title: said, href: e.referenceUrl, status: word, hint: e.message });
          } })),
        sent.length ? h(Block, { title: 'Sources sent' },
          h(Rows, { list: sent, max: 5, render: (x, i) => {
            const c = x.candidate || x, d = c.details || {};
            return h(Row, { key: c.contentHash || i, at: c.createdAt, title: sourceName(d), sub: sourceSub(d), href: d.canonicalUrl,
              status: x.duplicate ? 'Sent before' : routingWord(c.routing) || 'Sent', statusTitle: routingReasons(c.routing) });
          } })) : null,
        h(Block, null, h(Asks, { ask, items: agent ? [
          ['Research what’s needed most', 'On Petri, pick the most useful open research assignment and work on it.'],
          ['What have you found?', 'Summarize what you have researched and sent to Petri so far.'],
        ] : [['Connect an agent', 'Connect to Petri for oracle research.']] })));
    }

    // This is tokenization only. All arguments go directly to Petri, never a shell.
    function splitCommand(line) {
      const result = []; let word = '', quote = null, started = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '\\' && quote && line[i + 1] === quote) { word += line[++i]; started = true; continue; }
        if (quote) { if (c === quote) quote = null; else word += c; started = true; continue; }
        if (c === '"' || c === "'") { quote = c; started = true; continue; }
        if (/\s/.test(c)) { if (started) { result.push(word); word = ''; started = false; } } else { word += c; started = true; }
      }
      if (quote) throw new Error('Close the quoted argument.');
      if (started) result.push(word);
      if (result[0] === 'petri') result.shift();
      if (!result.length) throw new Error('Enter a Petri command.');
      return result;
    }

    // The oracle beside the chat: what you hold there, the finds, rewards and your proofs.
    const usd = atoms => { const n = atomsToUsd(atoms); return n === null ? '—' : `$${fixed(n)}`; };
    function OraclePane({ petri, live, ask }) {
      const tick = useStore(workspaceTick);
      const read = args => signal => petri.call({ action: 'command', args }, signal);
      const opts = { interval: 30000, enabled: live };
      const collateral = useLoad(read(['oracle', 'collateral']), [petri, tick], opts);
      const rewards = useLoad(read(['oracle', 'rewards']), [petri, tick], opts);
      const candidates = useLoad(read(['oracle', 'candidates']), [petri, tick], opts);
      const evidence = useLoad(read(['evidence', 'list']), [petri, tick], opts);
      const noWallet = [collateral, rewards].map(r => r.error).find(e => e && NO_WALLET.test(e));
      if (noWallet) return h(Block, null, h(NoWallet, { error: noWallet }));
      const c = collateral.data, months = Array.isArray(rewards.data?.months) ? rewards.data.months : [];
      const claimable = months.reduce((sum, m) => sum + (toNum(m.claimableAtoms) || 0), 0);
      const finds = Array.isArray(candidates.data?.candidates) ? candidates.data.candidates : [];
      const proofs = Array.isArray(evidence.data?.proofs) ? evidence.data.proofs : [];
      return h(Fragment, null,
        h(Block, null,
          c || rewards.data ? h(Figures, { items: [
            ['Collateral', c ? usd(c.exists ? c.availableAtoms : 0) : '—'],
            ['Locked', c ? usd(c.exists ? c.lockedAtoms : 0) : '—'],
            ['To claim', rewards.data ? usd(claimable) : '—', claimable > 0 ? 'ptr-up' : ''],
          ] }) : null,
          h(Alert, { error: [collateral, rewards].map(r => r.error).find(Boolean) })),
        h(Block, { title: 'Research finds' },
          h(Rows, { list: finds, max: 5, empty: candidates.data ? 'No finds yet.' : null, render: (x, i) => {
            const d = x.details || {};
            return h(Row, { key: x.contentHash || i, at: x.createdAt, title: sourceName(d), sub: sourceSub(d), href: d.canonicalUrl,
              status: routingWord(x.routing), statusTitle: routingReasons(x.routing) });
          } }), h(Alert, { error: candidates.error })),
        months.length ? h(Block, { title: 'Rewards' },
          h(Rows, { list: months, max: 4, render: (m, i) => h(Row, { key: m.expiryId || i, title: expiryIdLabel(m.expiryId), sub: m.rewards ? humanKey(String(m.rewards).toLowerCase()) : null,
            status: toNum(m.claimableAtoms) ? usd(m.claimableAtoms) : 'Nothing to claim' }) })) : null,
        proofs.length ? h(Block, { title: 'Your proofs' },
          h(Rows, { list: proofs, max: 4, render: (p, i) => h(Row, { key: p.digest || i, at: p.addedAt, title: domain(p.locator) || p.locator, sub: [p.product, p.price].filter(Boolean).join(' · '),
            href: p.locator, status: p.events?.length ? 'Sent' : 'Not sent', hint: p.events?.[p.events.length - 1]?.summary }) })) : null,
        h(Block, null, h(Asks, { ask, items: [
          finds.length ? ['Which finds should I sponsor?', 'Look at Petri’s research finds and tell me which are worth sponsoring, and what each would cost.'] : null,
          claimable > 0 ? ['Claim my rewards', 'Claim my Petri oracle rewards.'] : null,
          ['Add collateral', 'Help me add bond collateral on Petri.'],
          ['Prove a price page', 'Help me prove a price page for Petri’s oracle.'],
        ] })));
    }

    // ---------------------------------------------------------------- wiring
    function createRuntime(ctx) {
      const call = async (request, signal = new AbortController().signal) => {
        const result = await ctx.connection.rpc.call('/api', 'petri/invoke', { args: { request } }, signal);
        if (!result.ok) throw new Error(result.error?.message || 'Petri request failed.');
        return result.value;
      };
      const feed = createMarketsFeed(call);
      const bots = createBotsFeed(call);
      // Mounted panes per Session: the Petri pane and the Bots tab, each opened on its own once.
      const panes = new Map(), botPanes = new Map(), autoOpened = new Set(), handles = new Map();
      let focusNonce = 0;
      const onScreen = () => { try { return ctx.sidebarRight.mounted.getSnapshot(); } catch { return undefined; } };
      // A bot (view: 'Bots') opens in the Bots tab, everything else in the Petri pane.
      const openTab = (sessionId, params) => {
        if (sessionId && onScreen() !== sessionId) return false;
        const { view, ...rest } = params || {};
        const [kind, tabParams] = view === 'Bots' ? [BOTS_KIND, rest] : [PANE_KIND, params];
        try { ctx.sidebarRight.openTab(kind, { params: tabParams }); return true; } catch (error) { console.warn('[petri] could not open the sidebar:', error); return false; }
      };
      const mounted = map => id => { map.set(id, (map.get(id) || 0) + 1); return () => map.set(id, (map.get(id) || 1) - 1); };
      const runtime = {
        call, feed,
        forSession(sessionId) {
          const id = sessionId || onScreen();
          if (handles.has(id)) return handles.get(id);
          const handle = {
            sessionId: id, call, feed, bots,
            note(kind) { patchSession(id, { [kind]: true }); },
            open(params) { autoOpened.add(params?.view === 'Bots' ? `${id}:bots` : id); openTab(id, params); },
            // The first bot the agent makes in a chat opens the Bots tab there, once; later ones move its focus.
            reveal(params) {
              focusStore.set(all => ({ ...all, [id]: { bot: params.bot, nonce: ++focusNonce } }));
              if ((botPanes.get(id) || 0) > 0 || autoOpened.has(`${id}:bots`)) return;
              autoOpened.add(`${id}:bots`);
              openTab(id, params);
            },
            paneMounted: () => mounted(panes)(id),
            botsMounted: () => mounted(botPanes)(id),
          };
          handles.set(id, handle);
          return handle;
        },
        dispose() { feed.dispose(); bots.dispose(); },
      };
      return runtime;
    }

    function apply(ctx) {
      installStyles();
      const runtime = createRuntime(ctx);
      ctx.effect(() => () => runtime.dispose(), 'petri: feeds');
      const forSession = sessionId => ({ petri: runtime.forSession(sessionId) });
      ctx.slots.inject('tool.call.toolview', function* () {
        for (const key of TOOL_NAMES) yield ctx.slots.register({ name: 'tool.call.toolview', key, inject: forSession }, PetriToolView);
      });
      ctx.uiConversation.events.register(petriDefinition);
      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({ name: 'conversation.chat.turnTail', id: PLUGIN, inject: () => ({ petriRuntime: runtime }) }, PetriTail));
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'petri', order: 15, inject: forSession }, PetriDock));
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'petri', order: 15, inject: () => ({ petriRuntime: runtime }) }, PetriHeaderAction));
      // A new chat shows no header actions until its first message; until then the button sits
      // in the row under its composer, beside the workspace.
      ctx.slots.inject('conversation.hero.options', () => ctx.slots.register({ name: 'conversation.hero.options', id: 'petri', order: 15, inject: () => ({ petriRuntime: runtime }) }, PetriHeaderAction));
      // Optional, as Harness's own /feedback is: without the command service the rest still loads.
      ctx.inject(['commandUi'], scope => {
        for (const { params, ...command } of COMMANDS) scope.effect(() => scope.commandUi.register({
          ...command, icon: Glyph, available: () => true,
          ui: { kind: 'action', run: session => showPetri(runtime, session.sessionId, params) },
        }), `petri: /${command.name}`);
      });
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: PANE_ID, kind: PANE_KIND, priority: 'extension', keepMounted: true, title: () => 'Petri',
        guide: [{ id: 'open', order: 40, title: () => 'Petri', description: () => 'Research and the oracle', icon: GuideArt }],
      }), 'petri: sidebar type');
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: BOTS_PANE_ID, kind: BOTS_KIND, priority: 'extension', keepMounted: true, title: () => 'Bots',
        guide: [{ id: 'open', order: 41, title: () => 'Bots', description: () => 'Build, share and rank trading bots', icon: BotsArt }],
      }), 'petri: bots sidebar type');
      ctx.slots.inject('sidebar.right.pane.tab', function* () {
        yield ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PANE_ID, inject: forSession }, PetriPane);
        yield ctx.slots.register({ name: 'sidebar.right.pane.tab', key: BOTS_PANE_ID, inject: forSession }, BotsHub);
      });
    }

    return {
      inject: ['slots', 'connection', 'sidebarRight', 'sidebarRightTabs', 'uiConversation'],
      apply, splitCommand, tailEntries, entryFromBlock, petriDefinition, products, expiryIdLabel, viewName, agentStatus,
    };
  },
});
