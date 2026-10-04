import {getStage,market} from './engine.js';
import {marketSeries,indexDisplay} from './chart.js';

export const SHOCK_DRAW_MS=1000;

// Read only settled history; the current draw remains a display-only candle.
// Reserve the stage's possible move before the draw so the scale does not
// depend on its outcome, and old candles stay still throughout the animation.
export function marketCandleModel(game){
 const round=game.round,history=(game.history??[]).filter(h=>h.round<round),series=marketSeries(history);
 const open=series.at(-1)?.close??100,maxBps=Math.max(...getStage(game.stage).shock);
 const direction=game.phase==='drawing'&&game.drawKind==='direction'?null:game.direction;
 const low=direction==='up'?open:open*(10000-maxBps)/10000;
 const high=direction==='down'?open:open*(10000+maxBps)/10000;
 const values=[100,low,high,...series.flatMap(c=>[c.open,c.close])];
 const min=Math.min(...values),max=Math.max(...values),pad=(max-min)*.05;
 const scale={min:min-pad,max:max+pad},y=value=>10+(scale.max-value)/(scale.max-scale.min)*72;
 const cell=284/Math.max(4,round),bodyWidth=Math.min(20,cell*.48);
 const shape=(c,i)=>{const start=y(c.open),end=y(c.close);return {...c,x:28+cell*(i+.5),width:bodyWidth,start,end,height:Math.abs(end-start),top:Math.min(start,end)}};
 const reveal=game.phase==='movement-result'||game.phase==='drawing'&&game.drawKind==='second';
 let current=null;
 if(reveal&&['up','down'].includes(direction)&&game.first&&(game.first!==6||game.second)){
  const m=market(game.first,game.second,game.stage);
  const actual=marketSeries([...history,{round,direction,first:game.first,second:game.second,...m}]).at(-1);
  current=shape(actual,round-1);
 }
 return {round,open,scale,baseline:y(100),history:series.map(shape),current,slot:{x:28+cell*(round-.5),width:cell,start:y(open)}};
}

export function marketCandleMarkup(model,{animate=false,elapsed=0}={}){
 const {round,history,current}=model;
 const moving=animate&&current?.first===6&&!!current.second;
 const result=c=>`R${String(c.round).padStart(2,'0')} ${c.direction==='up'?'上昇':'下落'}${c.bps/100}%。${c.gap?'ギャップ相場':'通常相場'}。`;
 const label=`共通相場の推移。確定済み${history.length}ラウンド。${moving?`R${String(round).padStart(2,'0')}の急変判定の値動きを表示中。`:current?`${result(current)}指数${indexDisplay(current.close)}。`:`R${String(round).padStart(2,'0')}の値動きは未確定。`}`;
 const delay=Math.max(0,Math.min(SHOCK_DRAW_MS,elapsed));
 return `<div class="pixel-trend"><canvas class="market-history-chart" data-trend-model="${encodeURIComponent(JSON.stringify(model))}" data-trend-moving="${moving}" data-trend-elapsed="${delay}" role="img" aria-label="${label}">${label}</canvas></div>`;
}
