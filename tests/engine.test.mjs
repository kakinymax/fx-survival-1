import test from 'node:test';
import assert from 'node:assert/strict';
import {market,roundUnits,settle,createGame,submitOrder,resolveRound,startDecisions,submitDecision,revealDecisions,nextRound,winners,money} from '../dist/engine.js';
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
function orderAll(g,leverage=1){const count=g.players.filter(p=>p.status==='active').length;for(let i=0;i<count;i++){g.phase='order';submitOrder(g,{side:'buy',leverage})}assert.equal(g.phase,'ready-orders')}
function playMarket(g,first=1,second=null,direction='up'){g.direction=direction;g.first=first;g.second=second;g.phase='market-ready';resolveRound(g)}
test('early exit remains eligible; decisions remain secret until reveal; no reentry',()=>{
 const g=createGame(['A','B']);orderAll(g,50);playMarket(g,4);startDecisions(g);g.phase='decision';submitDecision(g,'fix');assert.equal(g.players[0].status,'active');g.phase='decision';submitDecision(g,'continue');revealDecisions(g);assert.equal(g.players[0].status,'fixed');nextRound(g);orderAll(g,100);playMarket(g,6,5,'down');startDecisions(g);assert.equal(g.phase,'end');assert.deepEqual(winners(g).map(p=>p.name),['A']);assert.equal(g.players[0].wealth,'1250');assert.equal(g.players[0].maxPosition,'50000');
});
test('round twelve auto-fixes survivors; ties win together; huge amounts stay exact',()=>{
 const g=createGame(['A','B']);for(let round=1;round<=12;round++){assert.equal(g.round,round);orderAll(g,100);playMarket(g,6,6);startDecisions(g);if(round<12){for(let i=0;i<2;i++){g.phase='decision';submitDecision(g,'continue')}revealDecisions(g);nextRound(g)}}
 assert.equal(g.phase,'end');assert.equal(g.players[0].wealth,String(1000n*11n**12n));assert.equal(g.players[0].maxPosition,String(100000n*11n**11n));assert.equal(g.history.length,12);assert.equal(winners(g).length,2);assert(g.players.every(p=>p.status==='fixed'));
});
test('all bankrupt has no winner; invalid and eliminated orders are rejected',()=>{
 const g=createGame(['A','B']);orderAll(g,100);playMarket(g,6,6,'down');startDecisions(g);assert.equal(g.phase,'end');assert.deepEqual(winners(g),[]);assert.throws(()=>submitOrder(g,{side:'buy',leverage:1}));
 for(const leverage of [0,101,1.5,NaN])assert.throws(()=>settle(player(100),{side:'buy',leverage},'up',market(1)));
});
test('Japanese currency formatting preserves thousands and signed large balances',()=>{assert.equal(money('1000'),'100.0万円');assert.equal(money('100000'),'1億円');assert.equal(money('-200000'), '−2億円');assert.equal(money('1'),'0.1万円');assert.equal(money('1000000000'),'1兆円')});
