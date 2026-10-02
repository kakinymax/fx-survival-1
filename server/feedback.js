import {roundUnits} from '../dist/engine.js';
import {createLifetimeAccumulator} from './statistics.js';

const BANDS=[['oneTo25',1,25],['26To49',26,49],['50To99',50,99],['hundred',100,100]];
// Two distinct units: individual trades by leverage, and whole games with/without
// any 100x trade. All data is derived from archived owner trades on this request.
export function createFeedbackAccumulator(){
  const rounds=BANDS.map(([id,min,max])=>({id,min,max,trades:0,profitable:0,losses:0,unchanged:0,pnl:0n}));
  const games={used100:createLifetimeAccumulator(),no100:createLifetimeAccumulator()};
  function add(record){
    if(record.schemaVersion!==1)throw Error('Unsupported match record version');
    if(record.ownerPlayerId===null)return;
    const p=record.players.find(p=>p.id===record.ownerPlayerId);
    if(!p||p.kind!=='human')throw Error('Invalid owner participant');
    let used100=false;
    for(const h of record.history){
      const trade=h.results.find(r=>r.id===p.id);if(!trade)continue;
      const band=rounds.find(b=>Number.isInteger(trade.leverage)&&trade.leverage>=b.min&&trade.leverage<=b.max);
      if(!band)throw Error('Invalid archived leverage');
      const pnl=BigInt(trade.pnl);band.trades++;band.pnl+=pnl;
      if(pnl>0n)band.profitable++;else if(pnl<0n)band.losses++;else band.unchanged++;
      if(trade.leverage===100)used100=true;
    }
    games[used100?'used100':'no100'].add(record);
  }
  function result(){
    return {version:1,
      rounds:rounds.map(({pnl,...band})=>({...band,pnlTotal:String(pnl),averagePnl:band.trades?String(roundUnits(pnl,BigInt(band.trades))):null})),
      games:Object.fromEntries(Object.entries(games).map(([id,stats])=>[id,stats.result().lifetime]))
    };
  }
  return {add,result};
}
export function aggregateFeedback(records){const feedback=createFeedbackAccumulator();for(const record of records)feedback.add(record);return feedback.result()}
