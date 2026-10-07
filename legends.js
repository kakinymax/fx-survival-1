import {playerMetrics} from './records.js';

export const LEGEND_VERSION=1;
export const LEGENDS=Object.freeze([
  {key:'comeback',title:'大逆転',description:'初期資産の50%未満まで落ちた後に優勝。'},
  {key:'peakCollapse',title:'天国から地獄',description:'最高資産が元本の5倍以上で、最終資産は0円以下。'},
  {key:'hundredMillion',title:'億り人',description:'最高資産または最終資産が1億円以上。'},
  {key:'triple',title:'一撃3倍',description:'1ラウンドの精算で資産が3倍以上。'},
  {key:'zero',title:'全損',description:'最高資産100万円以上から、最終資産0円。'},
  {key:'debtRecord',title:'最大負債更新',description:'その対象で、過去のゲームの最大負債を更新。'},
  {key:'underInitialWin',title:'元本割れ優勝',description:'正の資産を残し、元本未満で優勝。'},
  {key:'lowLeverageWin',title:'25倍以内で優勝',description:'取引で一度も25倍を超えずに優勝。'},
  {key:'hundredWin',title:'100倍で優勝',description:'100倍を一度以上使ったゲームで優勝。'}
]);
export const LEGEND_KEYS=LEGENDS.map(event=>event.key);

// Only archived balances and trades are read. No market/CPU logic is replayed.
// The cross-game debt record is added by the server's history accumulator.
export function playerLegends(record,p){
  const initial=BigInt(p.initial),final=BigInt(p.wealth),peak=BigInt(p.peak),events=[];
  const trades=record.history.flatMap(h=>h.results.filter(r=>r.id===p.id).map(trade=>({round:h.round,...trade})));
  const metrics={...playerMetrics(p.id,record.history,p.initial),...p.metrics};
  const won=final>0n&&record.winnerIds.includes(p.id);
  const low=trades.find(t=>BigInt(t.after)*2n<initial);
  if(won&&low)events.push({key:'comeback',round:low.round,low:low.after});
  if(peak>=initial*5n&&final<=0n)events.push({key:'peakCollapse'});
  if(peak>=100000n||final>=100000n)events.push({key:'hundredMillion'});
  const triple=trades.find(t=>BigInt(t.before)>0n&&BigInt(t.after)>=BigInt(t.before)*3n);
  if(triple)events.push({key:'triple',round:triple.round,before:triple.before,after:triple.after});
  if(final===0n&&peak>=1000n)events.push({key:'zero'});
  if(won&&final<initial)events.push({key:'underInitialWin'});
  if(won&&trades.length&&metrics.maxLeverage<=25)events.push({key:'lowLeverageWin',maxLeverage:metrics.maxLeverage});
  if(won&&metrics.uses100>0)events.push({key:'hundredWin',uses:metrics.uses100});
  return events;
}
