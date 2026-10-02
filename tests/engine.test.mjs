import test from 'node:test';
import assert from 'node:assert/strict';
import {market,roundUnits,settle,createGame,submitOrder,resolveRound,startDecisions,submitDecision,winners,money,STAGES,getStage,prepareAutoMarket,migrateGame} from '../dist/engine.js';
const player=(wealth)=>({id:0,name:'A',wealth:String(BigInt(wealth)*10n),peak:String(BigInt(wealth)*10n),maxPosition:'0',status:'active'});
test('v1.0 examples: profit, loss, normal cut, gap debt, gap profit',()=>{
 const examples=[[100,'buy',50,'up',market(4),'1250','active'],[400,'sell',80,'up',market(4),'2400','active'],[5000,'buy',100,'down',market(6,1),'0','cut'],[5000,'buy',100,'down',market(6,5),'-200000','debt'],[1000,'sell',100,'down',market(6,5),'60000','active']];
 for(const [w,side,leverage,d,m,expected,status]of examples){const r=settle(player(w),{side,leverage},d,m);assert.equal(r.player.wealth,expected);assert.equal(r.player.status,status)}
 const r=settle(player(7000),{side:'buy',leverage:80},'down',market(6,5));assert.equal(r.player.wealth,'-210000');assert.equal(r.player.peak,'70000');assert.equal(r.player.maxPosition,'5600000');
});
test('all dice branches match probabilities and only the last three are gaps',()=>{
 const first=[10,20,30,50,80];for(let i=1;i<=5;i++)assert.deepEqual(market(i),{bps:first[i-1],gap:false});
 const second=[100,100,150,200,500,1000];for(let i=1;i<=6;i++)assert.deepEqual(market(6,i),{bps:second[i-1],gap:i>=4});
 assert.throws(()=>market(6));assert.throws(()=>market(0));
});
test('nearest ¥1,000 rounding is symmetric, including half amounts',()=>{assert.equal(roundUnits(10005n),1n);assert.equal(roundUnits(15000n),2n);assert.equal(roundUnits(-15000n),-2n);assert.equal(roundUnits(-14999n),-1n)});
test('normal losses always floor at zero; gap exactly zero exits without debt',()=>{
 for(let leverage=1;leverage<=100;leverage++)for(const bps of [10,20,30,50,80,100,150])assert(BigInt(settle(player(100),{side:'buy',leverage},'down',{bps,gap:false}).player.wealth)>=0n);
 const r=settle(player(100),{side:'buy',leverage:50},'down',market(6,4));assert.equal(r.player.wealth,'0');assert.equal(r.player.status,'empty');
});
function orderAll(g,leverage=1){const count=g.players.filter(p=>p.status==='active').length;for(let i=0;i<count;i++)submitOrder(g,{side:'buy',leverage});assert.equal(g.phase,'orders-revealed')}
function playMarket(g,first=1,second=null,direction='up'){g.direction=direction;g.first=first;g.second=second;g.phase='market-ready';resolveRound(g)}
test('early exit remains eligible; decisions remain secret until reveal; no reentry',()=>{
 const g=createGame(['A','B']);orderAll(g,50);playMarket(g,4);startDecisions(g);submitDecision(g,'fix');assert.equal(g.players[0].status,'active');submitDecision(g,'continue');assert.equal(g.players[0].status,'fixed');assert.equal(g.round,2);orderAll(g,100);playMarket(g,6,5,'down');assert.equal(g.phase,'end');assert.deepEqual(winners(g).map(p=>p.name),['A']);assert.equal(g.players[0].wealth,'1250');assert.equal(g.players[0].maxPosition,'50000');
});
test('round twelve auto-fixes survivors; ties win together; huge amounts stay exact',()=>{
 const g=createGame(['A','B']);for(let round=1;round<=12;round++){assert.equal(g.round,round);orderAll(g,100);playMarket(g,6,6);if(round<12){startDecisions(g);for(let i=0;i<2;i++)submitDecision(g,'continue')}}
 assert.equal(g.phase,'end');assert.equal(g.players[0].wealth,String(1000n*11n**12n));assert.equal(g.players[0].maxPosition,String(100000n*11n**11n));assert.equal(g.history.length,12);assert.equal(winners(g).length,2);assert(g.players.every(p=>p.status==='fixed'));
});
test('all bankrupt has no winner; invalid and eliminated orders are rejected',()=>{
 const g=createGame(['A','B']);orderAll(g,100);playMarket(g,6,6,'down');assert.equal(g.phase,'end');assert.deepEqual(winners(g),[]);assert.throws(()=>submitOrder(g,{side:'buy',leverage:1}));
 for(const leverage of [0,101,1.5,NaN])assert.throws(()=>settle(player(100),{side:'buy',leverage},'up',market(1)));
});
test('Japanese currency formatting preserves thousands and signed large balances',()=>{assert.equal(money('1000'),'100.0万円');assert.equal(money('100000'),'1億円');assert.equal(money('-200000'), '−2億円');assert.equal(money('1'),'0.1万円');assert.equal(money('1000000000'),'1兆円')});
test('each stage has the advertised movement table and a 3/36 gap chance',()=>{
 const tables={classic:[[10,20,30,50,80],[100,100,150,200,500,1000]],usdjpy:[[10,10,20,30,50],[80,80,100,150,300,500]],tryjpy:[[20,40,60,100,150],[200,200,300,500,1000,2000]]};
 for(const [id,[normal,shock]]of Object.entries(tables)){
  assert.deepEqual([...getStage(id).normal],normal);assert.deepEqual([...getStage(id).shock],shock);
  let gaps=0;for(let first=1;first<=6;first++)for(let second=1;second<=6;second++){const m=market(first,second,id);assert.equal(m.bps,first===6?shock[second-1]:normal[first-1]);if(m.gap)gaps++}assert.equal(gaps,3);
 }
 assert.throws(()=>getStage('unknown'));assert.throws(()=>createGame(['A','B'],'auto','unknown'));
});
test('round settlement uses chosen shared stage; stage survives subsequent rounds',()=>{
 for(const [id,expected]of [['classic','1250'],['usdjpy','1150'],['tryjpy','1500']]){
  const g=createGame(['A','B'],'manual',id);orderAll(g,50);playMarket(g,4);assert.deepEqual(g.players.map(p=>p.wealth),[expected,expected]);assert.equal(g.history[0].stage,id);
  startDecisions(g);for(let i=0;i<2;i++)submitDecision(g,'continue');assert.equal(g.stage,id);
 }
});
test('dollar gap at 1.5% can cause debt; lira ordinary 2% still cuts at zero',()=>{
 const dollar=settle(player(100),{side:'buy',leverage:100},'down',market(6,4,'usdjpy'));assert.equal(dollar.player.wealth,'-500');assert.equal(dollar.player.status,'debt');
 const lira=settle(player(100),{side:'buy',leverage:100},'down',market(6,1,'tryjpy'));assert.equal(lira.player.wealth,'0');assert.equal(lira.player.status,'cut');
});
test('pre-stage saves settle with original rules and retain original balances',()=>{
 const g=createGame(['A','B']);delete g.stage;orderAll(g,50);playMarket(g,4);assert.equal(g.players[0].wealth,'1250');assert.equal(g.history[0].stage,'classic');
});
test('direct turns publish only after the last order; decisions reveal and advance together',()=>{
 const g=createGame(['A','B','C']);assert.equal(g.phase,'order');submitOrder(g,{side:'buy',leverage:73});assert.equal(g.phase,'order');assert.equal(g.cursor,1);submitOrder(g,{side:'sell',leverage:1});assert.equal(g.phase,'order');submitOrder(g,{side:'buy',leverage:1});assert.equal(g.phase,'orders-revealed');
 playMarket(g,1);startDecisions(g);submitDecision(g,'fix');assert.equal(g.players[0].status,'active');assert.equal(g.lastDecisions,null);submitDecision(g,'continue');assert.equal(g.phase,'decision');submitDecision(g,'continue');assert.equal(g.phase,'order');assert.equal(g.round,2);assert.equal(g.cursor,0);assert.equal(g.players[0].status,'fixed');assert.deepEqual(g.orders,{});assert.deepEqual(g.decisions,{});assert.equal(g.lastDecisions.round,1);assert.deepEqual(g.history[0].decisions,{0:'fix',1:'continue',2:'continue'});
});
test('a single automatic draw includes shock and rejects a second draw; reload settles once',()=>{
 const g=createGame(['A','B'],'auto','tryjpy');orderAll(g,100);const faces=[1,6,6],calls=[];prepareAutoMarket(g,sides=>{calls.push(sides);return faces.shift()});assert.deepEqual(calls,[2,6,6]);assert.equal(g.phase,'drawing');assert.throws(()=>prepareAutoMarket(g));const saved=JSON.parse(JSON.stringify(g));migrateGame(saved);assert.equal(saved.phase,'results');assert.equal(saved.players[0].wealth,'21000');assert.equal(saved.history.length,1);migrateGame(saved);assert.equal(saved.history.length,1);
});
test('legacy flow phases resume without added confirmation or rerolling partial draws',()=>{
 for(const [old,next]of [['handoff-order','order'],['handoff-decision','decision'],['direction','orders-revealed'],['ready-orders','orders-revealed']]){const g=createGame(['A','B']);g.phase=old;delete g.flowVersion;migrateGame(g);assert.equal(g.phase,next)}
 const g=createGame(['A','B']);orderAll(g);g.phase='shock';g.direction='down';g.first=6;const rolls=[];prepareAutoMarket(g,sides=>{rolls.push(sides);return 2});assert.deepEqual(rolls,[6]);assert.equal(g.direction,'down');assert.equal(g.first,6);assert.equal(g.second,2);
 for(const old of ['ready-decisions','revealed-decisions']){const saved=createGame(['A','B']);orderAll(saved);playMarket(saved);saved.phase=old;saved.decisions={0:'fix',1:'continue'};if(old==='revealed-decisions')saved.players[0].status='fixed';migrateGame(saved);assert.equal(saved.phase,'order');assert.equal(saved.round,2);assert.equal(saved.players[0].status,'fixed');assert.equal(saved.lastDecisions.choices.length,2)}
});
test('all permanent exits go directly to ending and retain the public decisions',()=>{
 const g=createGame(['A','B']);orderAll(g);playMarket(g);startDecisions(g);submitDecision(g,'fix');assert.equal(g.phase,'decision');submitDecision(g,'fix');assert.equal(g.phase,'end');assert.equal(g.round,1);assert(g.players.every(p=>p.status==='fixed'));assert.equal(g.lastDecisions.choices.length,2);
});
