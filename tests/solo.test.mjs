import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateGame,prepareAutoDraw,finishAutoDraw,winners,createGame} from '../dist/engine.js';
import {createSoloGame,CPU_PROFILES,cpuOrder,cpuDecision,prepareSoloOrders,submitSoloOrder,resolveSoloRound,commitSoloDecision,resumeSolo,fastForwardSolo,isSpectating} from '../dist/solo.js';
const high=sides=>sides;
const snapshot=g=>({round:g.round,players:g.players.map(({id,wealth,peak,status})=>({id,wealth,peak,status}))});
function draw(g,direction=1,first=1,second=1){prepareAutoDraw(g,'direction',()=>direction);finishAutoDraw(g);prepareAutoDraw(g,'first',()=>first);finishAutoDraw(g);if(first===6){prepareAutoDraw(g,'second',()=>second);finishAutoDraw(g)}}
function play(g,order={side:'buy',leverage:1},direction=1,first=1,second=1){submitSoloOrder(g,order);draw(g,direction,first,second);resolveSoloRound(g,high)}

test('CPU orders are locked before human input, survive reload, and reveal without CPU turns',()=>{
 const calls=[],g=createSoloGame('自分','usdjpy',n=>{calls.push(n);return 1});assert.equal(g.phase,'order');assert.equal(g.mode,'auto');assert.equal(g.players.length,4);assert.deepEqual(calls,[2,15,2,16,2,51]);assert.deepEqual(Object.keys(g.orders),['1','2','3']);
 const locked=structuredClone(g.orders),restored=resumeSolo(migrateGame(JSON.parse(JSON.stringify(g))),()=>{throw Error('reroll')});assert.deepEqual(restored.orders,locked);
 for(const order of [{side:'buy',leverage:0},{side:'pause',leverage:1}]){const before=JSON.stringify(g);assert.throws(()=>submitSoloOrder(g,order));assert.equal(JSON.stringify(g),before)}
 submitSoloOrder(g,{side:'sell',leverage:73});assert.equal(g.phase,'orders-revealed');for(const id of [1,2,3])assert.deepEqual(g.orders[id],locked[id]);assert.equal(g.first,null);assert.equal(g.direction,null);assert.throws(()=>submitSoloOrder(g,{side:'buy',leverage:1}));
});
test('personality reacts to public rank and rounds, while side remains independent 50:50',()=>{
 const g=createSoloGame(),state=snapshot(g);
 for(const [profile,id,lo,hi]of [['steady',1,1,15],['rival',2,15,30],['gambler',3,50,100]]){
  for(const sideFace of [1,2])for(const edge of ['low','high']){const order=cpuOrder(profile,id,state,n=>n===2?sideFace:edge==='low'?1:n);assert.equal(order.side,sideFace===1?'buy':'sell');assert.equal(order.leverage,edge==='low'?lo:hi)}
 }
 state.players[0].wealth='5000';assert.equal(cpuOrder('rival',2,state,high).leverage,50);
 state.players[1].wealth='6000';state.round=8;assert.equal(cpuOrder('steady',1,state,high).leverage,5);assert.equal(cpuDecision('steady',1,state,()=>50),'fix');assert.equal(cpuDecision('gambler',3,state,()=>50),'continue');
 state.players[2].wealth='7000';assert.equal(cpuDecision('rival',2,state,()=>50),'fix');state.players[0].wealth='8000';assert.equal(cpuDecision('rival',2,state,()=>50),'continue');
});
test('CPU progress decisions are saved before human choice and never rerolled on reload or commit',()=>{
 const g=createSoloGame('自分','classic',high);play(g);assert.equal(g.phase,'results');assert.equal(g.history.length,1);assert.deepEqual(Object.keys(g.cpuDecisions),['1','2','3']);assert.deepEqual(g.decisions,{});
 const choices=structuredClone(g.cpuDecisions),saved=resumeSolo(migrateGame(JSON.parse(JSON.stringify(g))),()=>{throw Error('reroll')});assert.deepEqual(saved.cpuDecisions,choices);
 const before=JSON.stringify(g);assert.throws(()=>commitSoloDecision(g,'pause'));assert.equal(JSON.stringify(g),before);
 commitSoloDecision(g,'fix',high);assert.deepEqual(g.history[0].decisions,{0:'fix',...choices});assert.equal(g.players[0].status,'fixed');assert.equal(g.phase,'orders-revealed');assert.equal(g.round,2);assert.equal(isSpectating(g),true);assert.equal(g.orders[0],undefined);assert.equal(g.cpuDecisions[0],undefined);
 const another=structuredClone(saved);commitSoloDecision(another,'continue',high);assert.deepEqual(Object.fromEntries(Object.entries(another.history[0].decisions).filter(([id])=>id!=='0')),choices);assert.equal(another.phase,'order');assert.equal(another.players[0].status,'active');
});
test('shared gap creates exact debt and permanent retirement, preserving peak and maximum position',()=>{
 const g=createSoloGame('自分','tryjpy',high);play(g,{side:'buy',leverage:100},2,6,6);assert.equal(g.players[0].wealth,'-19000');assert.equal(g.players[0].status,'debt');assert.equal(g.players[0].peak,'1000');assert.equal(g.players[0].maxPosition,'100000');assert.equal(g.history[0].bps,2000);assert.equal(g.history[0].results.length,4);assert(isSpectating(g));
 commitSoloDecision(g,undefined,high);assert.equal(g.orders[0],undefined);assert.throws(()=>submitSoloOrder(g,{side:'buy',leverage:1}));assert.throws(()=>commitSoloDecision(g,'continue'));
 fastForwardSolo(g,high);assert.equal(g.phase,'end');assert.equal(g.players[0].wealth,'-19000');assert.equal(g.history.filter(h=>h.results.some(r=>r.id===0)).length,1);
});
test('fast-forward preserves partial draws and an exact-once settlement, and cannot skip a human turn',()=>{
 const g=createSoloGame('自分','classic',high);assert.throws(()=>fastForwardSolo(g));play(g);commitSoloDecision(g,'fix',high);const fixed=g.players[0].wealth;
 prepareAutoDraw(g,'direction',()=>1);finishAutoDraw(g);prepareAutoDraw(g,'first',()=>6);finishAutoDraw(g);prepareAutoDraw(g,'second',()=>5);assert.equal(g.phase,'drawing');
 const r2=structuredClone(g.orders);fastForwardSolo(g,high);assert.equal(g.phase,'end');assert.equal(g.history[1].direction,'up');assert.equal(g.history[1].first,6);assert.equal(g.history[1].second,5);assert.equal(g.history.filter(h=>h.round===2).length,1);for(const r of g.history[1].results)assert.equal(r.leverage,r2[r.id].leverage);assert.equal(g.players[0].wealth,fixed);
 const final=JSON.stringify(g);assert.throws(()=>fastForwardSolo(g));assert.equal(JSON.stringify(g),final);assert.equal(g.history.length,g.round);assert(g.round<=12);
});
test('observation and fast-forward use the same CPU policies and markets through round twelve',()=>{
 const a=createSoloGame('自分','usdjpy',high);play(a);commitSoloDecision(a,'fix',high);const b=structuredClone(a);
 const roll=n=>n===2?2:n===6?1:n;
 fastForwardSolo(a,roll);
 while(b.phase!=='end'){draw(b,2,1);resolveSoloRound(b,roll);if(b.phase==='results')commitSoloDecision(b,undefined,roll)}
 assert.deepEqual(a,b);assert.equal(a.round,12);assert.equal(a.history.length,12);assert(a.players.every(p=>p.status==='fixed'));assert.equal(a.players[0].wealth,'1001');
});
test('all CPU exits can end early; positive ties win and all bankrupt has no winner',()=>{
 const g=createSoloGame('自分','classic',high);play(g);g.cpuDecisions={1:'fix',2:'fix',3:'fix'};g.players.forEach(p=>p.wealth='1001');commitSoloDecision(g,'fix',high);assert.equal(g.phase,'end');assert.equal(g.round,1);assert.equal(winners(g).length,4);assert.equal(g.history[0].cpuQuotes[1],'ここで降りる。十分増えた。');
 const bankrupt=createSoloGame('自分','tryjpy',n=>n===2?1:n);play(bankrupt,{side:'buy',leverage:100},2,6,6);assert.equal(bankrupt.phase,'end');assert.deepEqual(winners(bankrupt),[]);assert(bankrupt.players.every(p=>BigInt(p.wealth)<=0n));
});
test('continuing as the only active human still needs an order; legacy tabletop saves stay tabletop',()=>{
 const g=createSoloGame('自分','classic',high);play(g);g.cpuDecisions={1:'fix',2:'fix',3:'fix'};commitSoloDecision(g,'continue',high);assert.equal(g.phase,'order');assert.deepEqual(g.orders,{});submitSoloOrder(g,{side:'buy',leverage:1});assert.equal(g.phase,'orders-revealed');draw(g);resolveSoloRound(g,high);commitSoloDecision(g,'fix',high);assert.equal(g.phase,'end');
 const old=createGame(['A','B'],'manual');const before=JSON.stringify(old);resumeSolo(migrateGame(old),()=>{throw Error('CPU in tabletop')});assert.equal(JSON.stringify(old),before);
 for(const name of ['', ' '.repeat(3), 'a'.repeat(21)])assert.throws(()=>createSoloGame(name));assert.equal(Object.keys(CPU_PROFILES).length,3);
});
