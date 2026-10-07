import {drawTrend} from './market-raster.js';
import {SHOCK_DRAW_MS} from './market-candle.js';

// The controller owns draws and their timing. This renderer only paints the
// saved outcome, resuming from elapsed time when the view is rendered again.
export function createMarketChartRenderer(root){
 let cleanups=[];
 const clear=()=>{for(const cleanup of cleanups)cleanup();cleanups=[]};
 const render=()=>{
  clear();
  for(const canvas of root.querySelectorAll('canvas[data-trend-model]')){
   const model=JSON.parse(decodeURIComponent(canvas.dataset.trendModel));
   const moving=canvas.dataset.trendMoving==='true';
   const started=performance.now()-Number(canvas.dataset.trendElapsed);
   let frame;
   const paint=()=>{
    if(!canvas.isConnected)return;
    const width=Math.round(canvas.parentElement.clientWidth);if(!width)return;
    const progress=moving?Math.min(1,Math.max(0,(performance.now()-started)/SHOCK_DRAW_MS)):1;
    const drawing=drawTrend(model,width,{progress,moving});
    drawing.raster.present(canvas);canvas.trendResult=drawing;
    if(moving&&progress<1)frame=requestAnimationFrame(paint);
   };
   const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);paint()});
   observer.observe(canvas.parentElement);
   cleanups.push(()=>{observer.disconnect();cancelAnimationFrame(frame)});
   paint();
  }
 };
 return {clear,render};
}
