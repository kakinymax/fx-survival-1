import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,market} from '../dist/engine.js';
import {marketSeries} from '../dist/chart.js';
import {SHOCK_DRAW_MS,marketCandleModel,marketCandleMarkup} from '../dist/market-candle.js';

const history=stage=>[4,6,1].map((first,i)=>({round:i+1,direction:i===1?'down':'up',first,second:first===6?4:null,...market(first,first===6?4:null,stage)}));
const game=(stage='classic',direction='up',first=6,second=null)=>({stage,direction,first,second,round:4,phase:'movement-result',history:history(stage)});

test('every shock face compounds the actual rate from the previous close, without touching settled history',()=>{
 for(const stage of Object.keys(STAGES))for(const direction of ['up','down'])for(let second=1;second<=6;second++){
  const g=game(stage,direction,6,second),before=JSON.stringify(g),m=market(6,second,stage),model=marketCandleModel(g),c=model.current;
  const expected=marketSeries([...g.history,{round:4,direction,first:6,second,...m}]);
  assert.equal(c.open,expected[2].close);assert.equal(c.close,expected[3].close);
  assert.equal(c.bps,m.bps);assert.equal(c.gap,m.gap);assert.equal(c.direction,direction);
  assert.equal(c.start,model.slot.start);assert.equal(c.height,Math.abs(c.end-c.start));
  assert(direction==='up'?c.end<c.start:c.end>c.start);assert(c.top>=10&&c.top+c.height<=82);
  assert.equal(JSON.stringify(g),before);
 }
});
test('pending, animated and finished shock have identical scales and historical geometry for every outcome',()=>{
 for(const stage of Object.keys(STAGES))for(const direction of ['up','down']){
  const pending=game(stage,direction),base=marketCandleModel(pending);assert.equal(base.current,null);
  for(let second=1;second<=6;second++){
   const g={...pending,second,phase:'drawing',drawKind:'second'},drawing=marketCandleModel(g),final=marketCandleModel({...g,phase:'movement-result'});
   assert.deepEqual(drawing.scale,base.scale);assert.deepEqual(final.scale,base.scale);
   assert.deepEqual(drawing.history,base.history);assert.deepEqual(final.history,base.history);
   assert.deepEqual(drawing.slot,base.slot);assert.deepEqual(final.current,drawing.current);
  }
  const small=marketCandleModel({...pending,second:1}).current,large=marketCandleModel({...pending,second:6}).current;
  assert(Math.abs(small.height/large.height-small.bps/large.bps)<1e-12);
 }
});
test('normal dice add a static candle only after revelation, and an undrawn shock has no current body',()=>{
 for(const stage of Object.keys(STAGES))for(let first=1;first<=5;first++){
  const g=game(stage,'up',first),drawing=marketCandleModel({...g,phase:'drawing',drawKind:'first'}),final=marketCandleModel(g);
  assert.equal(drawing.current,null);assert.equal(final.current.bps,market(first,null,stage).bps);
  assert(marketCandleMarkup(final,{animate:true}).includes('data-trend-moving="false"'));
 }
 assert.equal(marketCandleModel(game()).current,null);
 const unknown=marketCandleModel({...game(),phase:'drawing',drawKind:'direction'});
 assert.deepEqual(unknown.scale,marketCandleModel({...game('classic','down'),phase:'drawing',drawKind:'direction'}).scale);
});
test('shock markup preserves elapsed time and hides the accessible result until final revelation',()=>{
 const model=marketCandleModel(game('tryjpy','down',6,6)),animated=marketCandleMarkup(model,{animate:true,elapsed:400}),final=marketCandleMarkup(model);
 assert(animated.includes('data-trend-moving="true"'));assert(animated.includes('data-trend-elapsed="400"'));
 assert(!animated.match(/aria-label="[^"]*(20%|ギャップ相場)/));
 assert(final.match(/aria-label="[^"]*R04 下落20%。ギャップ相場。/));
 assert(final.includes('data-trend-moving="false"'));
 assert(marketCandleMarkup(model,{animate:true,elapsed:5000}).includes(`data-trend-elapsed="${SHOCK_DRAW_MS}"`));
});
test('rounds 1, 2 and 12 keep every settled candle plus one current slot, with no duplicate logged round',()=>{
 for(const round of [1,2,12]){
  const entries=Array.from({length:round},(_,i)=>({round:i+1,direction:i%2?'down':'up',first:1,second:null,...market(1)}));
  const g={...game(),round,direction:entries.at(-1).direction,first:1,history:entries},model=marketCandleModel(g),svg=marketCandleMarkup(model);
  assert.equal(model.history.length,round-1);assert.equal(model.current.round,round);
  assert(svg.includes('role="img"'));
  assert(svg.includes(`確定済み${round-1}ラウンド。`));
  assert(model.slot.x<312);assert(model.history.every(c=>c.x<model.slot.x));
  assert.equal(model.current.close,marketSeries(entries).at(-1).close);
 }
});
