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
  assert.equal(drawing.ticks.length,5);
  assert.equal(drawing.ticks[2].value,100);
  assert.equal(drawing.ticks[2].y,Math.round((drawing.plot.top+drawing.plot.bottom)/2));
  assert.equal(drawing.low+drawing.high,200);
  assert(drawing.ticks.slice(1).every((t,i)=>t.y-drawing.ticks[i].y>=14));
  assert(drawing.bodies.every(b=>Math.min(b.openY,b.closeY)-1>=drawing.plot.top&&Math.max(b.openY,b.closeY)+1<=drawing.plot.bottom));
 }
});

test('a narrow range around 100 uses the centered reference 104, 102, 100, 98, 96 ticks',()=>{
 const model=marketCandleModel(game('usdjpy','down',6,4));
 const drawing=drawTrend({...model,scale:{min:96.87,max:102.48}},264);
 assert.equal(drawing.step,2);
 assert.deepEqual(drawing.ticks.map(t=>t.value),[104,102,100,98,96]);
});

test('four grid sections contain balanced round slots with unchanged positions within each block',()=>{
 for(const width of [232,264,320,640])for(const endRound of [4,8,12]){
  const full=drawTrend(marketCandleModel(game('classic','up',3,null,endRound)),width);
  const sectionWidth=(full.plot.right-full.plot.left)/4;
  for(let section=0;section<4;section++){
   const left=full.plot.left+section*sectionWidth,right=left+sectionWidth;
   const bodies=full.bodies.filter(b=>b.x>left&&b.x<right);
   assert.equal(bodies.length,endRound/4);
   assert(Math.abs((bodies[0].x-left)-(right-bodies.at(-1).x))<=1);
   for(const b of bodies){
    assert(b.x-Math.floor(full.barWidth/2)-1>left);
    assert(b.x+Math.ceil(full.barWidth/2)<right);
   }
  }
  for(let round=endRound-3;round<=endRound;round++){
   const frame=drawTrend(marketCandleModel(game('classic','up',3,null,round)),width);
   assert.equal(frame.bodies.length,round);
   assert.deepEqual(frame.bodies.map(b=>b.x),full.bodies.slice(0,round).map(b=>b.x));
  }
 }
});

test('animation keeps historical plot pixels and scale fixed and only moves toward the saved close',()=>{
 for(const direction of ['up','down'])for(const second of [1,6])for(const round of [1,2,4,5,7,8,9,11,12]){
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
