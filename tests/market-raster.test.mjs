import test from 'node:test';
import assert from 'node:assert/strict';
import {market} from '../dist/engine.js';
import {marketCandleModel} from '../dist/market-candle.js';
import {drawTrend} from '../dist/market-raster.js';

const rates={classic:{normal:[10,20,30,50,80],shock:[100,100,150,200,500,1000]},usdjpy:{normal:[10,10,20,30,50],shock:[80,80,100,150,300,500]},tryjpy:{normal:[20,40,60,100,150],shock:[200,200,300,500,1000,2000]}};
const game=(stage,direction,first,second,round=4)=>({stage,direction,first,second,round,phase:'movement-result',history:Array.from({length:round-1},(_,i)=>({round:i+1,direction:i%2?'down':'up',first:4,second:null,...market(4,null,stage)}))});
const bit=(r,x,y)=>r.bits[y*r.stride+(x>>3)]&(128>>(x&7));

test('every stage and dice result uses the actual compounded close and an integer, equally spaced scale',()=>{
 for(const [stage,table] of Object.entries(rates))for(const direction of ['up','down'])for(let first=1;first<=6;first++)for(const second of first===6?[1,2,3,4,5,6]:[null])for(const width of [264,320,640]){
  const model=marketCandleModel(game(stage,direction,first,second)),drawing=drawTrend(model,width);
  const bps=first===6?table.shock[second-1]:table.normal[first-1];
  const close=model.open*(10000+(direction==='up'?1:-1)*bps)/10000;
  assert.equal(model.current.close,close);assert.equal(drawing.stats.last,close);
  assert(drawing.low<=model.scale.min&&drawing.high>=model.scale.max);
  assert(drawing.ticks.every(t=>Number.isInteger(t.value)&&t.label===String(t.value)));
  assert(drawing.ticks.slice(1).every((t,i)=>drawing.ticks[i].value-t.value===drawing.step));
  assert(Number.isInteger(drawing.step)&&drawing.step>=2&&drawing.step%2===0);
  assert(drawing.ticks.some(t=>t.value===100));
  assert(drawing.ticks.slice(1).every((t,i)=>t.y-drawing.ticks[i].y>=14));
 }
});

test('the USD/JPY 5% fall uses the reference 102, 100, 98, 96, 94 ticks',()=>{
 const drawing=drawTrend(marketCandleModel(game('usdjpy','down',6,6)),264);
 assert.equal(drawing.step,2);
 assert.deepEqual(drawing.ticks.map(t=>t.value),[102,100,98,96,94]);
});

test('animation keeps historical plot pixels and scale fixed and only moves toward the saved close',()=>{
 for(const direction of ['up','down'])for(const second of [1,6])for(const round of [1,2,12]){
  const model=marketCandleModel(game('tryjpy',direction,6,second,round));
  const start=drawTrend(model,320,{progress:0,moving:true}),limit=start.bodies.at(-1).x-Math.ceil(start.barWidth/2)-2;
  for(const progress of [.25,.5,.75,1]){
   const frame=drawTrend(model,320,{progress,moving:true});
   assert.equal(frame.low,start.low);assert.equal(frame.high,start.high);
   assert.equal(frame.stats.last,model.open);
   assert.equal(frame.bodies.at(-1).displayClose,model.open+(model.current.close-model.open)*progress);
   assert.deepEqual(frame.bodies.slice(0,-1),start.bodies.slice(0,-1));
   for(let y=start.plot.top;y<=start.plot.bottom+15;y++)for(let x=0;x<limit;x++)assert.equal(bit(frame.raster,x,y),bit(start.raster,x,y));
  }
  assert.equal(drawTrend(model,320).stats.last,model.current.close);
 }
});

test('gap glyph waits for completion and occupies a separate row beneath the statistics',()=>{
 const model=marketCandleModel({...game('usdjpy','down',6,6,1),history:[]});
 const moving=drawTrend(model,320,{progress:1,moving:true}),final=drawTrend(model,320);
 let marked=0;
 for(let y=50;y<=56;y++)for(let x=final.plot.left;x<320;x++){
  assert(bit(moving.raster,x,y));if(!bit(final.raster,x,y))marked++;
 }
 assert(marked>0);assert(final.plot.top>56);
 const normal=drawTrend(marketCandleModel({...game('usdjpy','down',6,2,1),history:[]}),320);
 for(let y=50;y<=56;y++)for(let x=normal.plot.left;x<320;x++)assert(bit(normal.raster,x,y));
});
