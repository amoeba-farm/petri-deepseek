import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { Context, Service } from '@deepseek-ai/cordis';
import ToolRuntime, { assertObjectJsonSchema, renderToolsSdk } from '@deepseek-ai/dsh-tools';
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol';
import Petri from '../index.js';
import { apply as toolsPlugin } from '../tools.js';
import { PetriProcess, validateArgs } from '../lib/process.mjs';
import { agentName, RESEARCH, researchArgs, validateInput } from '../lib/research.mjs';
import { Workspace } from '../lib/workspace.mjs';
import { MARKET, QUOTE, TRADE_TOOLS, orderArgs, validateMarketInput } from '../lib/market.mjs';

import { BOT_TOOLS, Bots, validateBotInput } from '../lib/bots.mjs';

const TOOL_COUNT = MARKET.length + 1 + RESEARCH.length + BOT_TOOLS.length;
const fixture = fileURLToPath(new URL('./fixture-cli.mjs', import.meta.url));
const realSpawn = (_command,args,options)=>spawn(process.execPath,[fixture,...args],options);

test('runs structured Petri arguments without shell interpretation or confirmation injection',async()=>{
  const process = new PetriProcess({}, {spawn:realSpawn});
  try {
    const result = await process.run(['markets','a; echo injected','--api','http://127.0.0.1:4500']);
    assert.equal(result.data.args[2],'a; echo injected');
    assert.ok(!result.data.args.includes('--yes'));
    assert.equal(result.data.markets[0].label,'RAMX');
  } finally { process.dispose(); }
});

test('surfaces domain refusals and never retries writes',async()=>{
  let count=0;
  const process = new PetriProcess({}, {spawn:(...args)=>{count++;return realSpawn(...args);}});
  await assert.rejects(process.run(['long','ramx','1','--yes']),/fixture transaction refused/);
  assert.equal(count,1);process.dispose();
});

test('cancellation stops the owned child and does not imply rollback',async()=>{
  const process = new PetriProcess({}, {spawn:realSpawn});
  const controller = new AbortController();
  const run = process.run(['status'],{signal:controller.signal});
  controller.abort();
  await assert.rejects(run,/reconcile its signature/);
  process.dispose();
  await assert.rejects(process.run(['markets']),/unloaded/);
});

test('malformed arguments are rejected without restricting Petri grammar',()=>{
  assert.throws(()=>validateArgs(['markets','bad\0arg']),/array of strings/);
  assert.throws(()=>validateArgs([]),/array of strings/);
  assert.doesNotThrow(()=>validateArgs(['--profile','dev','markets']));
  assert.doesNotThrow(()=>validateArgs(['future-command','__filename']));
  for(const command of ['long','short','close','cancel','deposit','withdraw','oracle','evidence','research','wallet','config','update'])assert.doesNotThrow(()=>validateArgs([command]));
});

test('real Cordis service mounts, declares a Gateway method, and disposes its processes',async()=>{
  const ctx = new Context();
  const fiber = await ctx.plugin(Petri,{});
  assert.ok(ctx.petri);
  const service=ctx.petri;
  assert.ok(remoteMethods(service).some(method=>method.method==='invoke'));
  service.process.dispose();service.process=new PetriProcess({}, {spawn:realSpawn});
  const result=await service.invoke({action:'info'},new AbortController().signal);
  assert.equal(result.text,'petri fixture');
  await fiber.dispose();
  assert.equal(service.process.closed,true);
});

test('trade tools map onto Petri commands and never turn a value into a flag',()=>{
  const tool=name=>MARKET.find(t=>t.name===name);
  const book=tool('petri_book');
  assert.deepEqual(book.args(validateMarketInput(book,{market:'ramx',range:'90-120'})),['book','ramx','--range','90-120']);
  assert.deepEqual(QUOTE.args(validateMarketInput(QUOTE,{side:'short',market:'nandx',usd:50,leverage:5})),['quote','short','nandx','--usd','50','-x','5']);
  assert.deepEqual(orderArgs(validateMarketInput(QUOTE,{side:'long',market:'ramx',lots:100,to:130})),['long','ramx','100','--to','130']);
  assert.throws(()=>validateMarketInput(book,{market:'--keypair'}),/Invalid market/);
  assert.throws(()=>validateMarketInput(QUOTE,{side:'long',market:'ramx',lots:-5}),/Invalid lots/);
  assert.throws(()=>validateMarketInput(QUOTE,{side:'sideways',market:'ramx'}),/Invalid side/);
  assert.throws(()=>validateMarketInput(book,{}),/Missing field: market/);
  assert.throws(()=>validateMarketInput(book,{market:'ramx',yes:true}),/Unknown field/);
  // The agent's trades are sent by their own call; reads never confirm anything.
  const order=tool('petri_order'),cancel=tool('petri_cancel'),close=tool('petri_close');
  assert.deepEqual(order.args(validateMarketInput(order,{side:'long',market:'ramx',usd:25,leverage:5,limit:101})),['long','ramx','--usd','25','-x','5','--limit','101','--yes']);
  assert.deepEqual(cancel.args(validateMarketInput(cancel,{market:'ramx',order:'all'})),['cancel','ramx','all','--yes']);
  assert.deepEqual(close.args(validateMarketInput(close,{market:'ramx',position:3,lots:2})),['close','ramx','3','--lots','2','--yes']);
  assert.throws(()=>validateMarketInput(close,{market:'ramx',position:'-1'}),/Invalid position/);
  const writes=MARKET.filter(t=>t.write).map(t=>t.name);
  assert.deepEqual(writes,['petri_order','petri_cancel','petri_close']);
  for(const t of MARKET.filter(t=>!t.write))assert.ok(!t.args(Object.fromEntries(t.schema.required.map(k=>[k,k==='side'?'long':k==='view'?'months':'ramx']))).includes('--yes'),t.name);
  assert.deepEqual(TRADE_TOOLS,MARKET.map(t=>t.name).filter(n=>n!=='petri_oracle'));
});

test('an order the agent places is exactly the argv its tool built, sent once',async()=>{
  const ctx = new Context();
  const fiber = await ctx.plugin(Petri,{});
  const runs=[];
  ctx.petri.process.dispose();ctx.petri.process={run:async(args)=>{runs.push(args);return {data:{ok:true}};},dispose(){}};
  await ctx.petri.invoke({action:'market',tool:'petri_quote',input:{side:'long',market:'ramx',lots:10,leverage:5}});
  await ctx.petri.invoke({action:'market',tool:'petri_order',input:{side:'long',market:'ramx',lots:10,leverage:5}});
  assert.deepEqual(runs,[['quote','long','ramx','10','-x','5'],['long','ramx','10','-x','5','--yes']]);
  await assert.rejects(ctx.petri.invoke({action:'market',tool:'petri_place_everything',input:{}}),/Unknown Petri market tool/);
  await assert.rejects(ctx.petri.invoke({action:'market',tool:'petri_order',input:{side:'long',market:'ramx',keypair:'x'}}),/Unknown field/);
  // The old chat ticket's click is gone with the ticket.
  await assert.rejects(ctx.petri.invoke({action:'place',input:{side:'long',market:'ramx',lots:10}}),/Unknown Petri operation/);
  assert.equal(runs.length,2);
  await fiber.dispose();
});

test('the research work list stays under the Harness result size with what choosing work needs',()=>{
  const list=RESEARCH.find(t=>t.name==='petri_work_list');
  const objective={kind:'update',phase:'Game',status:'gap',url:'https://example.com/p',protocol:{programId:'x'.repeat(5000)},sources:[{body:'y'.repeat(5000)}]};
  const work=Array.from({length:20},(_,i)=>({id:`w${i}`,title:`T${i}`,brief:'b'.repeat(500),candidateScope:{marketId:'ramx'},objective}));
  const compact=list.compact({work});
  assert.ok(JSON.stringify({work}).length>200000);
  assert.ok(JSON.stringify(compact).length<20000);
  assert.deepEqual(compact.work[3],{id:'w3',title:'T3',brief:'b'.repeat(500),candidateScope:{marketId:'ramx'},objective:{kind:'update',phase:'Game',status:'gap',url:'https://example.com/p'}});
  assert.deepEqual(list.compact({status:'idle'}),{status:'idle'});
});

test('all research tools preserve per-session identity and stable request keys',async()=>{
  const definitions=[];const calls=[];
  toolsPlugin({tools:{register:tool=>definitions.push(tool)},petri:{invoke:async(...args)=>{calls.push(args);return {status:'idle'};}}});
  assert.equal(definitions.length,TOOL_COUNT);
  const tool=definitions.find(t=>t.name==='petri_work_start');
  await tool.execute({workId:'work-1',clientKey:'retry-key'},{agent:{id:'session-a'},signal:new AbortController().signal});
  assert.equal(calls[0][0].sessionId,'session-a');
  assert.equal(calls[0][0].input.clientKey,'retry-key');
  assert.equal(agentName('session-a'),agentName('session-a'));
  assert.notEqual(agentName('session-a'),agentName('session-b'));
  assert.throws(()=>validateInput(RESEARCH[0],{credential:'secret'}),/Unknown field/);
});

test('Harness registry accepts every tool in native and programmatic presentations',async()=>{
  class Prompt extends Service {
    constructor(ctx) { super(ctx,'systemPrompt'); }
    tools() {}
  }
  const ctx=new Context();
  const prompt=await ctx.plugin(Prompt);
  const registry=await ctx.plugin(ToolRuntime,{mode:'native'});
  const petri=await ctx.plugin(Petri);
  ctx.petri.process.dispose();ctx.petri.process=new PetriProcess({}, {spawn:realSpawn});
  const registration=await ctx.plugin({inject:['petri','tools'],apply:toolsPlugin});
  const schemas=ctx.tools.schemas();
  assert.equal(schemas.length,TOOL_COUNT);
  for(const schema of schemas) assertObjectJsonSchema(schema.parameters);
  assert.match(renderToolsSdk(ctx.tools.sdkSchemas()),/petri_work_next/);
  const result=await ctx.tools.execute({callId:'petri-test',name:'petri_command',arguments:{args:['--version']},signal:new AbortController().signal});
  assert.equal(result.isError,false);
  assert.equal(result.value.text,'petri fixture');
  await registration.dispose();
  assert.equal(ctx.tools.schemas().length,0);
  await petri.dispose();await registry.dispose();await prompt.dispose();
});

test('owner bridge selects agents, uses the private loopback credential, and never returns it',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'petri-plugin-test-'));
  try {
    const secret='a'.repeat(64);
    await writeFile(join(directory,'owner.json'),JSON.stringify({version:1,ownerToken:secret,port:4185}));
    let startups=0;const calls=[];
    const workspace=new Workspace({run:async()=>{startups++;return {data:{}};}},{stateDirectory:directory},async(url,options)=>{
      calls.push({url:String(url),...options});
      return {ok:true,json:async()=>({ok:true,data:{agents:[],selected:{agent:{id:'agent-b'}}}})};
    });
    const result=await workspace.invoke('snapshot',{agentId:'agent-b'});
    await workspace.invoke('focus',{workId:'work-1',focused:true});
    assert.equal(startups,1);
    assert.match(calls[0].url,/127\.0\.0\.1:4185\/v1\/owner\/snapshot\?agentId=agent-b/);
    assert.equal(calls[0].headers.authorization,`Bearer ${secret}`);
    assert.equal(calls[0].redirect,'error');
    assert.equal(JSON.stringify(result).includes(secret),false);
    assert.deepEqual(JSON.parse(calls[1].body),{workId:'work-1',focused:true});
    await assert.rejects(workspace.invoke('snapshot',{url:'https://attacker.example'}),/Unexpected workspace fields/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

async function loadClient() {
  let module;
  const React={createElement:()=>null,Fragment:'fragment'};
  vm.runInNewContext(await readFile(new URL('../client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load:value=>{module=value.factory(name=>{
      if(name==='react')return React;
      assert.equal(name,'@deepseek-ai/dsh-client-ui-primitives');return {};
    });}}},
    AbortController,console,
  });
  return module;
}

test('client puts research and bots inside the conversation; trading has tools but nothing drawn',async()=>{
  const module=await loadClient();
  const registrations=[];const calls=[];const tabTypes=[];const definitions=[];const opened=[];const commands=[];const injected=[];
  const ctx={
    effect:fn=>fn(),
    inject:(deps,fn)=>{injected.push(deps);fn({effect:f=>f(),commandUi:{register:c=>{commands.push(c);return ()=>{};}}});},
    slots:{inject:(_slot,fn)=>{const result=fn();if(result&&typeof result.next==='function')for(const _ of result);},register:(options,component)=>registrations.push({options,component})},
    connection:{rpc:{call:async(...args)=>{calls.push(args);return {ok:true,value:{markets:[]}};}}},
    sidebarRight:{mounted:{getSnapshot:()=>'session-a'},openTab:(kind,options)=>opened.push({kind,options})},
    sidebarRightTabs:{register:definition=>{tabTypes.push(definition);return ()=>{};}},
    uiConversation:{events:{register:definition=>definitions.push(definition)}},
  };
  module.apply(ctx);
  const names=registrations.map(r=>r.options.name);
  assert.ok(!names.includes('main'),'no separate Petri page');
  const toolviews=registrations.filter(r=>r.options.name==='tool.call.toolview').map(r=>r.options.key);
  for(const tool of [...MARKET.map(t=>t.name),'petri_command',...RESEARCH.map(t=>t.name),...BOT_TOOLS.map(t=>t.name)])assert.ok(toolviews.includes(tool),tool);
  for(const slot of ['conversation.chat.turnTail','conversation.input.dock','conversation.session.header.actions'])assert.ok(names.includes(slot),slot);
  // Two tabs beside the chat: Petri (research and the oracle) and Bots.
  assert.deepEqual(tabTypes.map(t=>t.kind),['petri','petri-bots']);
  assert.deepEqual(registrations.filter(r=>r.options.name==='sidebar.right.pane.tab').map(r=>r.options.key),['@amoeba/dsh-petri/pane','@amoeba/dsh-petri/bots']);
  // The host requires a Definition's Location data key to be its own kind.
  assert.equal(definitions[0].kind,'petri');
  const petri=registrations.find(r=>r.options.name==='conversation.input.dock').options.inject('session-a').petri;
  assert.equal(petri.sessionId,'session-a');
  await petri.call({action:'command',args:['markets']});
  assert.equal(calls[0][0],'/api');assert.equal(calls[0][1],'petri/invoke');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])),{args:{request:{action:'command',args:['markets']}}});
  // A bot the agent makes opens the Bots tab once; later ones only move its focus.
  petri.reveal({view:'Bots',bot:'dip-buyer'});petri.reveal({view:'Bots',bot:'dip-buyer-2'});
  assert.equal(opened.length,1);assert.equal(opened[0].kind,'petri-bots');assert.deepEqual(JSON.parse(JSON.stringify(opened[0].options.params)),{bot:'dip-buyer'});
  // A click asks for it every time; the Petri pane opens on its own kind.
  petri.open({view:'Bots',bot:'dip-buyer',start:true});petri.open({view:'Research'});
  assert.deepEqual(opened.slice(1).map(o=>o.kind),['petri-bots','petri']);
  // A Session that is not on screen never moves the sidebar.
  const other=registrations.find(r=>r.options.name==='conversation.input.dock').options.inject('session-b').petri;
  other.open({view:'Bots',bot:'x'});assert.equal(opened.length,3);
  // A new chat hides the header's actions until its first message: the button also sits under its composer.
  const buttons=registrations.filter(r=>['conversation.session.header.actions','conversation.hero.options'].includes(r.options.name));
  assert.deepEqual(buttons.map(r=>r.options.name),['conversation.session.header.actions','conversation.hero.options']);
  assert.equal(buttons[0].component,buttons[1].component);
  // /petri and /petri-bots are client commands, so they run in a new chat before anything is sent.
  assert.deepEqual(JSON.parse(JSON.stringify(injected)),[['commandUi']]);
  assert.deepEqual(commands.map(c=>c.name),['petri','petri-bots']);
  for(const c of commands){
    assert.equal(typeof c.label(),'string');assert.match(c.description(),/beside the chat/);
    assert.equal(typeof c.icon,'function');assert.equal(c.available({sessionId:'session-a'}),true);assert.equal(c.ui.kind,'action');
  }
  commands[0].ui.run({sessionId:'session-a'});commands[1].ui.run({sessionId:'session-a'});
  assert.deepEqual(opened.slice(3).map(o=>[o.kind,JSON.parse(JSON.stringify(o.options.params))]),[['petri',{view:'Research'}],['petri-bots',{}]]);
  commands[0].ui.run({sessionId:'session-b'});assert.equal(opened.length,5);
  // Market reads and trades draw nothing: their row says what ran.
  for(const name of TRADE_TOOLS)assert.equal(module.viewName({name}),name);
  assert.equal(module.viewName({name:'petri_command',data:{command:'positions'}}),'petri_trade');
  assert.equal(module.viewName({name:'petri_command',data:{command:'oracle'}}),'petri_command');
  assert.equal(module.viewName({name:'petri_bots_discover'}),'petri_bot_hub');
  assert.equal(module.viewName({name:'petri_bot_write'}),'petri_bot');
  assert.deepEqual(Array.from(module.splitCommand('petri evidence show "C:\\My files\\price.json"')),['evidence','show','C:\\My files\\price.json']);
  assert.throws(()=>module.splitCommand('markets "unclosed'),/quoted/);
});

test('turn tail keeps the latest card of each bot and research step, and no trades',async()=>{
  const {petriDefinition:def,tailEntries}=await loadClient();
  let state=def.start({},{event:{type:'turn/start',data:{turn:3}}});
  const call=(callId,name,args)=>{state=def.update({state},{event:{type:'tool/call',data:{turn:3,callId,name,arguments:JSON.stringify(args)}}});};
  const result=(seq,callId,value)=>{state=def.update({state},{event:{type:'tool/result',seq,surfaceOp:'append',data:{turn:3,message:{source:{callId},isError:false,content:[{type:'text',text:JSON.stringify(value)}]}}}});};
  assert.equal(def.match({type:'tool/call',data:{turn:3,name:'bash'}}),null);
  call('c1','petri_book',{market:'ramx'});result(10,'c1',{command:'book',market:'M1',depth:{asks:[],bids:[]}});
  call('c2','petri_order',{side:'long',market:'ramx',lots:10});result(11,'c2',{command:'long',order:{market:'M1'}});
  call('c3','petri_bot_write',{text:'[bot]'});result(12,'c3',{written:'dip',bot:{id:'dip',running:false}});
  call('c4','petri_bot_start',{bot:'dip'});result(13,'c4',{bot:{id:'dip',running:true}});
  call('c5','petri_bots_leaderboard',{});result(14,'c5',{bots:[]});
  call('c6','petri_command',{args:['positions']});result(15,'c6',{command:'positions',account:{markets:[]}});
  call('c7','petri_work_next',{});result(16,'c7',{status:'idle'});
  call('c8','petri_bot_new',{market:'ramx'});result(99,'c8',{created:'ladder-ramx'});
  const data=def.buildLocationData({state},'turn');
  assert.equal(data.key,def.kind);
  const entries=Array.from(tailEntries(data.value.results,20),e=>`${e.view}:${e.callId}`);
  assert.deepEqual(entries,['petri_bot:c4','petri_bot_hub:c5','petri_work_next:c7']);
});

test('research ids that Petri takes positionally can never become flags',()=>{
  const start=RESEARCH.find(t=>t.name==='petri_work_start');
  const report=RESEARCH.find(t=>t.name==='petri_report_progress');
  assert.throws(()=>validateInput(start,{workId:'--url=https://example.com',clientKey:'k'}),/Invalid workId/);
  assert.throws(()=>validateInput(report,{runId:'-x',kind:'note',message:'m',clientKey:'k'}),/Invalid runId/);
  assert.doesNotThrow(()=>validateInput(report,{runId:'run-1',kind:'note',message:'- searched the vendor page',clientKey:'k'}));
});

// A stand-in for `petri bots serve`: the same JSON lines, bots that start
// with a budget, take weights, are written, published, installed and removed,
// and "down" once stdin closes.
function fakeServe({ missing = false } = {}) {
  const { PassThrough } = require_('node:stream');
  const { EventEmitter } = require_('node:events');
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  const bots = [{ id: 'ladder-ramx', market: 'ramx-oct26', running: false, problem: null, budgetAtoms: '100000000', weights: [{ name: 'budget', value: '100' }] }];
  const say = value => child.stdout.write(`${JSON.stringify(value)}\n`);
  const list = () => say({ bots: bots.map(b => ({ ...b, weights: b.weights.map(w => ({ ...w })) })) });
  const find = id => bots.find(b => b.id === id);
  child.sent = [];
  setImmediate(() => {
    if (missing) { say({ ok: false, error: { message: "error: unrecognized subcommand 'bots'" } }); child.emit('exit', 2); return; }
    list();
  });
  let buffer = '';
  child.stdin.on('data', chunk => {
    buffer += chunk;
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const command = JSON.parse(buffer.slice(0, at)); buffer = buffer.slice(at + 1);
      child.sent.push(command);
      if (command.start) { const b = find(command.start); b.running = true; if (command.budget) b.budgetAtoms = String(command.budget * 1e6); }
      if (command.stop) find(command.stop).running = false;
      if (command.set) { if (command.set.knob === 'tiers' && command.set.value === '0') { say({ note: 'tiers must be 1 or more' }); continue; } const b = find(command.set.bot), w = b.weights.find(x => x.name === command.set.knob); if (w) w.value = String(command.set.value); else b.weights.push({ name: command.set.knob, value: String(command.set.value) }); }
      if (command.write !== undefined) {
        const id = /id = "([^"]+)"/.exec(command.write)?.[1];
        if (!id) { say({ note: 'the file needs a [bot] section' }); continue; }
        if (!find(id)) bots.push({ id, market: 'ramx-nov26', running: false, problem: null, kinds: ['strategy/script'], weights: [] });
        say({ written: id });
      }
      if (command.publish) { const id = command.publish.id || command.publish; find(id).from = id; find(id).counted = true; say({ published: { id, version: 1, hash: 'h' } }); }
      if (command.install) { const id = `${command.install.id}-2`; bots.push({ id, market: command.install.market || 'ramx-nov26', running: false, problem: null, from: command.install.id, counted: true, weights: [] }); say({ installed: id }); }
      if (command.remove) { bots.splice(bots.indexOf(find(command.remove)), 1); say({ removed: command.remove }); }
      list();
    }
  });
  child.stdin.on('finish', () => { for (const b of bots) b.running = false; say({ down: true }); setImmediate(() => child.emit('exit', 0)); });
  return child;
}
const require_ = (await import('node:module')).createRequire(import.meta.url);

test('bots run in one petri bots serve: start with a budget, tune, stop, and closing it takes them down',async()=>{
  let child;
  const bots=new Bots({open:args=>{assert.deepEqual(args,['bots','serve']);child=fakeServe();return child;},run:async()=>{throw new Error('one-shot not expected');}});
  const opened=await bots.open();
  assert.equal(opened.serving,true);assert.equal(opened.bots[0].id,'ladder-ramx');
  const started=await bots.start('ladder-ramx',250);assert.equal(started.bot.running,true);assert.equal(started.bot.budgetAtoms,'250000000');
  const tuned=await bots.set('ladder-ramx','spread_bps','80');assert.equal(tuned.bot.weights.find(w=>w.name==='spread_bps').value,'80');
  await assert.rejects(bots.set('ladder-ramx','tiers','0'),/tiers must be 1/);
  await assert.rejects(bots.start('nobody'),/No bot called nobody/);
  const stopped=await bots.stop('ladder-ramx');assert.equal(stopped.bot.running,false);
  await bots.dispose();
  assert.deepEqual(child.sent,[{start:'ladder-ramx',budget:250},{set:{bot:'ladder-ramx',knob:'spread_bps',value:'80'}},{set:{bot:'ladder-ramx',knob:'tiers',value:'0'}},{stop:'ladder-ramx'}]);
  await assert.rejects(bots.open(),/unloaded/);
});

test('the agent writes, publishes, installs and removes bots; the registry is read straight from petri',async()=>{
  let child;const runs=[];
  const bots=new Bots({open:()=>(child=fakeServe()),run:async args=>{runs.push(args);return {data:{bots:[{id:'dip-buyer',pnlAtoms:'1200000'}]}};}});
  const text='[bot]\nid = "dip-buyer"\nmarket = "ramx"\n\n[[row]]\nid = "s"\nkind = "strategy/script"\nsource = """\nfn tick(m) {}\n"""\n';
  const written=await bots.write(text);assert.equal(written.written,'dip-buyer');assert.equal(written.bot.id,'dip-buyer');
  assert.equal(child.sent[0].write,text,'the file goes to petri as written');
  await assert.rejects(bots.write('nothing here'),/\[bot\] section/);
  const published=await bots.publish('dip-buyer');assert.deepEqual(published.published,{id:'dip-buyer',version:1,hash:'h'});assert.equal(published.bot.counted,true);
  const installed=await bots.install('momentum','nandx-dec26');assert.equal(installed.installed,'momentum-2');assert.equal(installed.bot.market,'nandx-dec26');
  assert.deepEqual(child.sent.at(-1),{install:{id:'momentum',market:'nandx-dec26'}});
  const fromGithub=await bots.install(undefined,undefined,'zephyr/nand-thesis');assert.equal(fromGithub.installed,'github:zephyr/nand-thesis-2');
  assert.deepEqual(child.sent.at(-1),{install:{id:'github:zephyr/nand-thesis'}});
  await bots.publish('dip-buyer','me/dip-bot');assert.deepEqual(child.sent.at(-1),{publish:{id:'dip-buyer',github:'me/dip-bot'}});
  const removed=await bots.remove('momentum-2');assert.deepEqual(removed,{removed:'momentum-2'});
  assert.equal((await bots.list()).bots.some(b=>b.id==='momentum-2'),false);
  const board=await bots.read(['leaderboard','--days','7']);assert.equal(board.bots[0].id,'dip-buyer');
  assert.deepEqual(runs,[['bots','leaderboard','--days','7']]);
  await bots.dispose();
});

test('a petri without bots says how to get them, and bot inputs are checked before they reach petri',async()=>{
  const bots=new Bots({open:()=>fakeServe({missing:true}),run:async()=>{throw new Error("error: unrecognized subcommand 'bots'");}});
  await assert.rejects(bots.open(),/no bots yet.*petri update/i);
  await assert.rejects(bots.list(),/no bots yet/i);
  assert.deepEqual(validateBotInput('set',{bot:'ladder-ramx',weight:'budget',value:250}),{bot:'ladder-ramx',weight:'budget',value:'250'});
  assert.throws(()=>validateBotInput('start',{bot:'a b'}),/bot id/);
  assert.throws(()=>validateBotInput('start',{bot:'../wallet'}),/bot id/);
  assert.deepEqual(validateBotInput('start',{bot:'a'}),{bot:'a'});
  assert.deepEqual(validateBotInput('start',{bot:'a',budget:50}),{bot:'a',budget:'50'});
  assert.throws(()=>validateBotInput('start',{bot:'a',budget:-5}),/amount of USDC/);
  assert.throws(()=>validateBotInput('new',{market:'--keypair'}),/Invalid market/);
  assert.throws(()=>validateBotInput('install',{id:'../x'}),/published bot/);
  assert.throws(()=>validateBotInput('discover',{sort:'random'}),/Sort by/);
  assert.throws(()=>validateBotInput('leaderboard',{days:'365'}),/Days is one of/);
  assert.deepEqual(validateBotInput('discover',{}),{});
  assert.deepEqual(validateBotInput('discover',{sort:'pnl',days:'30'}),{sort:'pnl',days:'30'});
  assert.throws(()=>validateBotInput('discover',{sort:'new',days:'30'}),/Days goes with sort pnl/);
  // A bot on GitHub is OWNER/REPO with an optional file path and ref; nothing else reaches the URL.
  assert.deepEqual(validateBotInput('install',{github:'zephyr/nand-thesis/bots/hold.toml@v2'}),{github:'zephyr/nand-thesis/bots/hold.toml@v2'});
  assert.deepEqual(validateBotInput('install',{github:'zephyr/nand-thesis'}),{github:'zephyr/nand-thesis'});
  for(const bad of ['zephyr','zephyr/../etc','https://evil.example/x/y','zephyr/repo/../../x','zephyr/repo?x=1'])assert.throws(()=>validateBotInput('install',{github:bad}),/OWNER\/REPO/,bad);
  assert.throws(()=>validateBotInput('install',{}),/by id, or a bot on GitHub/);
  assert.throws(()=>validateBotInput('install',{id:'a',github:'o/r'}),/by id, or a bot on GitHub/);
  assert.deepEqual(validateBotInput('publish',{bot:'dip',github:'me/dip-bot'}),{bot:'dip',github:'me/dip-bot'});
  // A bot file keeps its own whitespace; it must not be blank.
  assert.deepEqual(validateBotInput('write',{text:'  [bot]\n'}),{text:'  [bot]\n'});
  assert.throws(()=>validateBotInput('write',{text:'   '}),/Missing field: text/);
  assert.throws(()=>validateBotInput('set',{bot:'a',weight:'leverage',value:2}),/no weight called leverage/);
  assert.throws(()=>validateBotInput('set',{bot:'a',weight:'budget',value:'lots'}),/not a number/);
  assert.throws(()=>validateBotInput('stop',{bot:'a',force:true}),/Unknown field/);
  assert.deepEqual(BOT_TOOLS.map(t=>t.op),['list','read','write','new','set','start','stop','publish','remove','discover','show','install','leaderboard']);
});

test('petri-live mode runs the dev TUI’s newest build with its dev settings',async()=>{
  const { effectiveConfig, executable, petriEnv } = await import('../lib/process.mjs');
  const home=await mkdtemp(join(tmpdir(),'petri-live-'));
  try {
    const { mkdir, utimes } = await import('node:fs/promises');
    await mkdir(join(home,'bin'));
    await writeFile(join(home,'bin','petri-old.exe'),'');await utimes(join(home,'bin','petri-old.exe'),new Date(1000),new Date(1000));
    await writeFile(join(home,'bin','petri-new.exe'),'');
    const config=effectiveConfig({petriLive:true},{PETRI_LIVE_HOME:home});
    assert.equal(config.profile,'dev');assert.equal(config.api,'http://127.0.0.1:4500');assert.equal(config.researchPort,4285);
    assert.equal(executable(config),join(home,'bin','petri-new.exe'));
    const env=petriEnv(config,{});
    assert.equal(env.PETRI_CONFIG_PATH,join(home,'petri','config.json'));
    assert.equal(env.PETRI_RESEARCH_HOME,join(home,'research'));
    assert.equal(env.PETRI_RESEARCH_PORT,'4285');
    // Research agents pair with petri-live's workspace, from profiles of their own.
    assert.equal(config.workspaceUrl,'http://127.0.0.1:4285');
    assert.equal(config.profileDirectory,join(home,'research-agents'));
    const args=researchArgs(config,'dsh-agent');
    assert.deepEqual(args.slice(args.indexOf('--url'),args.indexOf('--url')+2),['--url','http://127.0.0.1:4285']);
    assert.deepEqual(args.slice(args.indexOf('--profile-dir'),args.indexOf('--profile-dir')+2),['--profile-dir',join(home,'research-agents')]);
    assert.equal(effectiveConfig({petriLive:true,researchPort:4300},{PETRI_LIVE_HOME:home}).workspaceUrl,'http://127.0.0.1:4300');
    // The user's own settings win over petri-live's.
    assert.equal(effectiveConfig({petriLive:true,api:'http://127.0.0.1:4600'},{PETRI_LIVE_HOME:home}).api,'http://127.0.0.1:4600');
    assert.deepEqual(effectiveConfig({profile:'production'},{}),{profile:'production'});
  } finally { await rm(home,{recursive:true,force:true}); }
});

test('bots can run on their own petri build while the rest uses the configured one',async()=>{
  const ctx=new Context();
  const fiber=await ctx.plugin(Petri,{executable:'C:/petri-live/petri-main.exe',botsExecutable:'C:/petri-bots/petri-bots.exe',profile:'dev'});
  assert.equal(ctx.petri.process.config.executable,'C:/petri-live/petri-main.exe');
  assert.equal(ctx.petri.bots.process.config.executable,'C:/petri-bots/petri-bots.exe');
  assert.equal(ctx.petri.bots.process.config.profile,'dev');
  await fiber.dispose();
  assert.equal(ctx.petri?.bots?.process?.closed ?? true,true);
});

test('markets group into products, front month first, for the bots filter and the oracle months',async()=>{
  const {products,expiryIdLabel}=await loadClient();
  const m=(symbol,month,expiryTs,status='open')=>({market:`${symbol}-${month}`,symbol,label:`${symbol} ${month}`,expiryTs,status});
  const list=products([m('NANDX','Nov 26',2),m('RAMX','Dec 26',3),m('RAMX','Oct 26',1,'settled'),m('RAMX','Nov 26',2),m('NANDX','Oct 26',1)]);
  assert.deepEqual(Array.from(list,p=>p.symbol),['NANDX','RAMX']);
  assert.deepEqual(Array.from(list[1].markets,x=>x.label),['RAMX Oct 26','RAMX Nov 26','RAMX Dec 26']);
  assert.equal(list[1].front.label,'RAMX Nov 26');
  assert.equal(list[0].front.label,'NANDX Oct 26');
  assert.equal(expiryIdLabel('RAMX-202612'),'RAMX Dec 26');
  assert.equal(expiryIdLabel('NANDX-202701'),'NANDX Jan 27');
  assert.equal(expiryIdLabel('odd'),'odd');
});

test('an agent is researching only while petri lists its run as active; otherwise the pane says when it was last seen',async()=>{
  const {agentStatus}=await loadClient();
  const now=Date.now(),day=86400000,agent={id:'a1',name:'researcher'};
  const left={id:'r2',createdAt:now-8*day,finishedAt:null};
  const quiet={agents:[agent],activity:[],selected:{agent,sessions:[{heartbeatAt:now-8*day,closedAt:null}],events:[{actor:'agent',createdAt:now-8*day-60000}]}};
  const stale=agentStatus(quiet,agent,left);
  assert.equal(stale.running,false);
  assert.equal(stale.word,'Last seen 8d ago');
  assert.equal(stale.runNote,'stopped 8d ago');
  const busy=agentStatus({...quiet,activity:[{agentId:'a1',runId:'r2',lastSeenAt:now-30000}]},agent,{...left,createdAt:now-2*3600000});
  assert.equal(busy.running,true);
  assert.equal(busy.word,'Researching');
  assert.equal(busy.runNote,'since 2h ago');
  assert.equal(agentStatus(quiet,agent,{...left,finishedAt:now-3*3600000}).runNote,'finished 3h ago');
  assert.equal(agentStatus({agents:[agent],activity:[{agentId:'a1'}]},{...agent,revokedAt:now},null).word,'Disconnected');
  assert.equal(agentStatus({agents:[agent]},agent,null).word,'Idle');
  assert.match(agentStatus({agents:[agent],selected:{agent,sessions:[{heartbeatAt:now-5000}]}},agent,null).word,/^Last seen \ds ago$/);
});
