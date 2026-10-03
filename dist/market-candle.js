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

export function marketCandleSvg(model,{animate=false,elapsed=0}={}){
 const {round,history,current,slot,baseline}=model;
 const moving=animate&&current?.first===6&&!!current.second;
 const result=c=>`R${String(c.round).padStart(2,'0')} ${c.direction==='up'?'上昇':'下落'}${c.bps/100}%。${c.gap?'ギャップ相場':'通常相場'}。`;
 const label=`共通相場の推移。確定済み${history.length}ラウンド。${moving?`R${String(round).padStart(2,'0')}の急変判定の値動きを表示中。`:current?`${result(current)}指数${indexDisplay(current.close)}。`:`R${String(round).padStart(2,'0')}の値動きは未確定。`}`;
 const delay=Math.max(0,Math.min(SHOCK_DRAW_MS,elapsed));
 const candle=(c,active=false)=>`<g class="${active?'market-current-candle':'market-history-candle'}" data-round="${c.round}" data-open="${c.open}" data-close="${c.close}"><title>${active&&moving?`R${String(round).padStart(2,'0')}の値動きを表示中。`:result(c)}</title><rect class="${active?'market-current-body shock-body':'market-history-body'} ${c.direction==='up'?'shock-up':'shock-down'}" x="${c.x-c.width/2}" y="${c.top}" width="${c.width}" height="${c.height}" rx=".4" data-open-y="${c.start}" data-close-y="${c.end}"/>${c.gap&&!(active&&moving)?`<circle class="market-candle-gap" cx="${c.x}" cy="4" r="2"/>`:''}</g>`;
 const rounds=[...history.map(c=>`<text class="market-round-label" x="${c.x}" y="97" text-anchor="middle">${String(c.round).padStart(2,'0')}</text>`),`<text class="market-round-label market-current-label" x="${slot.x}" y="97" text-anchor="middle">R${String(round).padStart(2,'0')}</text>`].join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" role="img" aria-label="${label}" class="market-history-chart${moving?' shock-candle-animated':''}" style="--shock-duration:${SHOCK_DRAW_MS}ms;--shock-delay:-${delay}ms"><title>${label}</title><rect class="market-current-column" x="${slot.x-slot.width/2}" y="1" width="${slot.width}" height="86" rx="3"/><line class="market-baseline" x1="28" x2="312" y1="${baseline}" y2="${baseline}"/><text class="market-baseline-label" x="24" y="${baseline+4}" text-anchor="end">100</text>${history.map(c=>candle(c)).join('')}<line class="market-open-line" x1="${slot.x-slot.width/2+3}" x2="${slot.x+slot.width/2-3}" y1="${slot.start}" y2="${slot.start}"/>${current?candle(current,true):`<circle class="market-open-dot" cx="${slot.x}" cy="${slot.start}" r="2"/>`}${rounds}</svg>`;
}
