import test from 'node:test';
import assert from 'node:assert/strict';
import {marketSeries,candlesSvg,indexDisplay} from '../dist/chart.js';
test('market index compounds shared percentages without leverage, balance rounding or history mutation',()=>{
 const history=[{round:1,direction:'up',bps:50,gap:false},{round:2,direction:'down',bps:500,gap:true},{round:3,direction:'up',bps:10,gap:false}],before=JSON.stringify(history),s=marketSeries(history);
 assert.equal(s[0].open,100);assert.equal(s[0].close,100.5);assert.equal(s[1].open,100.5);assert.equal(s[1].close,95.475);assert(Math.abs(s[2].close-95.570475)<1e-10);assert.equal(indexDisplay(s[2].close),'95.57');assert.equal(s[1].gap,true);assert.equal(JSON.stringify(history),before);
});
test('one candle per recorded round, latest emphasis and gap marker work for a 12-round history',()=>{
 const history=Array.from({length:12},(_,i)=>({round:i+1,direction:i%2?'down':'up',bps:i===5?2000:10,gap:i===5,first:i===5?6:1,second:i===5?6:null})),s=marketSeries(history);
 assert.equal(s.length,12);assert.equal(s[5].first,6);assert.equal(s[5].second,6);assert.equal(marketSeries([...history,history[0]]).length,12);
 for(const detailed of [false,true]){const svg=candlesSvg(s,{width:detailed?240:140,height:detailed?200:32,detailed});assert.equal((svg.match(/class="chart-candle"/g)||[]).length,12);assert.equal((svg.match(/candle-latest/g)||[]).length,1);assert.equal((svg.match(/candle-gap/g)||[]).length,1);assert.equal((svg.match(/candle-up/g)||[]).length,6);assert.equal((svg.match(/candle-down/g)||[]).length,6);assert(!svg.includes('NaN'));assert(!svg.includes('Infinity'));assert(svg.includes('現在'))}
});
test('single small move has a visible body, no invented wick, and empty history stays empty',()=>{
 const s=marketSeries([{round:1,direction:'down',bps:10,gap:false}]),svg=candlesSvg(s);assert.equal(s[0].close,99.9);assert(svg.includes('candle-down candle-latest'));assert(!svg.includes('<line'));assert.equal(candlesSvg([]),'');assert.deepEqual(marketSeries([]),[]);
});
