// One candle per settled round, using a shared market index starting at 100.
export function marketSeries(history){
 let close=100;
 return history.slice(0,12).filter(h=>['up','down'].includes(h.direction)&&Number.isFinite(h.bps)&&h.bps>=0&&h.bps<10000).map(h=>{
  const open=close;close=open*(10000+(h.direction==='up'?1:-1)*h.bps)/10000;
  return {round:Number(h.round),open,close,direction:h.direction,bps:h.bps,gap:!!h.gap,first:h.first,second:h.second};
 });
}
export const indexDisplay=value=>value.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2});
export function candlesSvg(series,{width=140,height=32,detailed=false}={}){
 if(!series.length)return '';
 const left=detailed?56:3,right=3,top=detailed?15:6,bottom=detailed?27:3;
 const values=series.flatMap(c=>[c.open,c.close]),min=Math.min(...values),max=Math.max(...values),span=Math.max(max-min,.05),pad=span*.1;
 const lo=min-pad,hi=max+pad,y=value=>top+(hi-value)/(hi-lo)*(height-top-bottom);
 const slots=Math.max(4,series.length),cell=(width-left-right)/slots,bodyWidth=Math.min(detailed?18:8,cell*.55);
 const fmt=n=>n.toFixed(2),last=series.at(-1),label=`共通相場の推移。${series.length}ラウンド、開始100、現在${indexDisplay(last.close)}。最新は第${last.round}ラウンド。`;
 const grid=detailed?[max,(min+max)/2,min].map(value=>`<line class="chart-grid" x1="${left}" x2="${width-right}" y1="${fmt(y(value))}" y2="${fmt(y(value))}"/><text class="chart-axis" x="${left-7}" y="${fmt(y(value)+5)}" text-anchor="end">${indexDisplay(value)}</text>`).join(''):'';
 const candles=series.map((c,i)=>{
  const x=left+cell*(i+.5),a=y(c.open),b=y(c.close),bodyHeight=Math.max(1,Math.abs(a-b)),bodyTop=(a+b-bodyHeight)/2;
  return `<g class="chart-candle" data-round="${c.round}">${i===series.length-1?`<rect class="candle-current-column" x="${fmt(left+cell*i)}" y="0" width="${fmt(cell)}" height="${height-bottom}" rx="2"/>`:''}<rect class="candle-body ${c.direction==='up'?'candle-up':'candle-down'}${i===series.length-1?' candle-latest':''}" x="${fmt(x-bodyWidth/2)}" y="${fmt(bodyTop)}" width="${fmt(bodyWidth)}" height="${fmt(bodyHeight)}" rx=".5"/>${c.gap?`<circle class="candle-gap" cx="${fmt(x)}" cy="${detailed?6:2.5}" r="${detailed?3:1.5}"/>`:''}${detailed?`<text class="chart-axis" x="${fmt(x)}" y="${height-5}" text-anchor="middle">${c.round}</text>`:''}</g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" class="candles-svg${detailed?' chart-expanded-svg':''}"><title>${label}</title>${grid}${candles}</svg>`;
}
