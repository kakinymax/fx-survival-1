import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL,STAGES,settle,prepareAutoDraw,finishAutoDraw} from '../dist/engine.js';
import {createSoloGame,submitSoloOrder,resolveSoloRound,commitSoloDecision} from '../dist/solo.js';
import {impactPreview,previousSoloLeverage,replayGame,fastForwardHighlights} from '../dist/play-extras.js';
const high=n=>n;

test('all stage previews match real settlement for normal floors, gap debt, rounding and huge assets without mutation',()=>{
 for(const stage of Object.keys(STAGES))for(const wealth of ['1','1000','3140000000000000'])for(const leverage of [1,25,50,100]){
  const player={id:0,wealth,peak:wealth,maxPosition:'0',status:'active'},before=JSON.stringify(player),preview=impactPreview(wealth,leverage,stage);
  assert.equal(preview.reference.bps,STAGES[stage].normal[3]);
  assert.equal(new Set(preview.rows.map(r=>`${r.bps}:${r.gap}`)).size,preview.rows.length);
  for(const row of preview.rows){assert.deepEqual(row.hit,settle(player,{side:'buy',leverage},'up',row).result);assert.deepEqual(row.miss,settle(player,{side:'buy',leverage},'down',row).result);assert.deepEqual(row.miss,{...settle(player,{side:'sell',leverage},'up',row).result,side:'buy'})}
  assert.equal(JSON.stringify(player),before);
 }
 const p=impactPreview('1000',100,'classic');
 assert.equal(p.rows.find(r=>r.bps===150).miss.after,'0');assert.equal(p.rows.find(r=>r.bps===150).miss.status,'cut');
 assert.equal(p.rows.find(r=>r.bps===500).miss.after,'-4000');assert.equal(p.rows.find(r=>r.bps===500).miss.status,'debt');
 assert.throws(()=>impactPreview('1000',101,'classic'));
});

test('previous multiplier uses only this solo human’s completed trades, never private pending orders or tabletop players',()=>{
 const g=createSoloGame('自分','classic',high);assert.equal(previousSoloLeverage(g),null);
 g.orders[0]={side:'buy',leverage:99};assert.equal(previousSoloLeverage(g),null);
 g.history=[{results:[{id:0,leverage:73},{id:1,leverage:100}]},{results:[{id:1,leverage:50}]}];
 const before=JSON.stringify(g);assert.equal(previousSoloLeverage(g),73);assert.equal(JSON.stringify(g),before);
 g.playMode='tabletop';assert.equal(previousSoloLeverage(g),null);
});

test('same-settings replay creates initial assets and fresh locked CPU orders without modifying the canonical result',()=>{
 const record={id:'completed',playMode:'solo',ownerPlayerId:0,stage:{id:'tryjpy'},drawMode:'auto',players:[{id:0,name:'自分',wealth:'-19000'},{id:1,name:'堅実派'},{id:2,name:'対抗派'},{id:3,name:'勝負師'}],history:[{round:1}]};
 const before=JSON.stringify(record),g=replayGame(record,high);assert.equal(JSON.stringify(record),before);
 assert.equal(g.gameId,undefined);assert.equal(g.phase,'order');assert.equal(g.round,1);assert.equal(g.stage,'tryjpy');assert.equal(g.playMode,'solo');assert.deepEqual(g.players.map(p=>p.name),record.players.map(p=>p.name));assert(g.players.every(p=>p.wealth===INITIAL&&p.peak===INITIAL&&p.maxPosition==='0'));assert.deepEqual(g.history,[]);assert.deepEqual(Object.keys(g.orders),['1','2','3']);
 const table={...record,playMode:'tabletop',ownerPlayerId:null,drawMode:'manual',players:record.players.slice(0,2)};
 const t=replayGame(table);assert.equal(t.mode,'manual');assert.equal(t.stage,'tryjpy');assert.deepEqual(t.orders,{});assert.deepEqual(t.players.map(p=>p.name),['自分','堅実派']);
});

test('fast-forward facts use only the skipped rounds and public lead including permanently fixed assets; logs are immutable',()=>{
 const r={endedRound:4,players:[{id:0,initial:'1000'},{id:1,initial:'1000'},{id:2,initial:'1000'}],history:[
  {round:1,results:[{id:0,before:'1000',after:'2000',pnl:'1000',status:'fixed'},{id:1,before:'1000',after:'1100',pnl:'100',status:'active'},{id:2,before:'1000',after:'900',pnl:'-100',status:'active'}]},
  {round:2,results:[{id:1,before:'1100',after:'2200',pnl:'1100',status:'active'},{id:2,before:'900',after:'810',pnl:'-90',status:'active'}]},
  {round:3,results:[{id:1,before:'2200',after:'-8800',pnl:'-11000',status:'debt'},{id:2,before:'810',after:'729',pnl:'-81',status:'active'}]},
  {round:4,results:[{id:2,before:'729',after:'700',pnl:'-29',status:'fixed'}]}
 ]};
 const before=JSON.stringify(r),facts=fastForwardHighlights(r,2);assert.equal(JSON.stringify(r),before);assert.equal(facts.length,3);
 assert.deepEqual(facts.find(e=>e.type==='lead'),{type:'lead',round:3,ids:[0],wealth:'2000'});
 assert.equal(facts.find(e=>e.type==='gain').pnl,'1100');assert.equal(facts.find(e=>e.type==='loss').status,'debt');
 assert(fastForwardHighlights(r,4).every(e=>e.round===4));assert.deepEqual(fastForwardHighlights(r,undefined),[]);
});

test('CPU exit quotes match principal and public rank without consuming new randomness or changing saved decisions',()=>{
 for(const [wealth,leading] of [['999',false],['1000',false],['1500',false],['2000',true]]){
  const g=createSoloGame('自分','classic',high);submitSoloOrder(g,{side:'buy',leverage:1});prepareAutoDraw(g,'direction',()=>1);finishAutoDraw(g);prepareAutoDraw(g,'first',()=>1);finishAutoDraw(g);resolveSoloRound(g,high);
  for(const p of g.players)p.wealth=p.cpu?wealth:leading?'1000':'1900';
  g.cpuDecisions={1:'fix',2:'fix',3:'fix'};commitSoloDecision(g,'fix',()=>{throw Error('quotes must not roll')});
  assert.equal(g.phase,'end');assert.deepEqual(g.history[0].decisions,{0:'fix',1:'fix',2:'fix',3:'fix'});
  const quotes=Object.values(g.history[0].cpuQuotes).join(' ');
  if(wealth==='999'){assert(!quotes.includes('増えた'));assert(!quotes.includes('勝ち'));assert(quotes.includes('元本'))}
  if(wealth==='1000')assert(quotes.includes('元本'));
  if(wealth==='1500')assert(!g.history[0].cpuQuotes[2].includes('逃げ切り'));
  if(wealth==='2000')assert(g.history[0].cpuQuotes[2].includes('逃げ切り'));
 }
});
test('CPU result quotes describe rounded unchanged balances and large actual gains without extra policy rolls',()=>{
 for(const direction of [1,2]){
  const g=createSoloGame('自分','usdjpy',high);for(const p of g.players)p.wealth='1';
  submitSoloOrder(g,{side:'buy',leverage:1});prepareAutoDraw(g,'direction',()=>direction);finishAutoDraw(g);prepareAutoDraw(g,'first',()=>1);finishAutoDraw(g);
  const calls=[];resolveSoloRound(g,n=>{calls.push(n);return n});assert.deepEqual(calls,[100,100,100]);
  for(const p of g.players.filter(p=>p.cpu)){assert.equal(g.history[0].results.find(r=>r.id===p.id).pnl,'0');assert(p.quote.includes('資産は変わらず'));assert(p.quote.includes(direction===1?'逆':'当たった'))}
 }
 const g=createSoloGame('自分','tryjpy',high);submitSoloOrder(g,{side:'sell',leverage:1});prepareAutoDraw(g,'direction',()=>2);finishAutoDraw(g);prepareAutoDraw(g,'first',()=>6);finishAutoDraw(g);prepareAutoDraw(g,'second',()=>6);finishAutoDraw(g);resolveSoloRound(g,high);assert(g.players[1].quote.includes('大きく増えた'));assert.equal(g.players[1].wealth,'4000');
});
