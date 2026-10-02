import {INITIAL,getStage,settle,createGame} from './engine.js';
import {createSoloGame,isSolo,humanPlayer} from './solo.js';

// Presentation only: hypothetical outcomes use the same rounding and loss floor
// as a real trade. No market or CPU randomness is requested here.
export function impactPreview(wealth,leverage,stageId){
 const stage=getStage(stageId),player={id:0,wealth,peak:wealth,maxPosition:'0',status:'active'};
 const markets=[...stage.normal.map(bps=>({bps,gap:false})),...stage.shock.map((bps,i)=>({bps,gap:i>=3}))];
 const seen=new Set(),rows=[];
 for(const m of markets){
  const key=`${m.bps}:${m.gap}`;if(seen.has(key))continue;seen.add(key);
  const order={side:'buy',leverage};
  rows.push({...m,hit:settle(player,order,'up',m).result,miss:settle(player,order,'down',m).result});
 }
 return {reference:rows.find(r=>r.bps===stage.normal[3]&&!r.gap),rows};
}

export function previousSoloLeverage(game){
 if(!isSolo(game))return null;
 const id=humanPlayer(game).id;
 for(let i=game.history.length-1;i>=0;i--){
  const r=game.history[i].results.find(r=>r.id===id);
  if(r&&Number.isInteger(r.leverage)&&r.leverage>=1&&r.leverage<=100)return r.leverage;
 }
 return null;
}

// The completed snapshot supplies settings; balances and orders start afresh.
export function replayGame(record,roll){
 const stage=record.stage.id;
 if(record.playMode==='solo'){
  const owner=record.players.find(p=>p.id===record.ownerPlayerId);
  const game=createSoloGame(owner.name,stage,roll);
  for(const p of game.players){const saved=record.players.find(old=>old.id===p.id);if(saved)p.name=saved.name}
  return game;
 }
 return createGame(record.players.map(p=>p.name),record.drawMode,stage);
}

// Read the immutable log, including fixed players in the public lead. Keep at
// most three facts from the skipped portion: latest lead change, gain and loss.
export function fastForwardHighlights(record,fromRound){
 if(!Number.isInteger(fromRound)||fromRound<1||fromRound>record.endedRound)return [];
 const balances=new Map(record.players.map(p=>[p.id,BigInt(p.initial??INITIAL)]));
 const leaders=()=>{
  const best=[...balances.values()].reduce((a,b)=>a>b?a:b,0n);
  return best>0n?[...balances].filter(([,wealth])=>wealth===best).map(([id])=>id):[];
 };
 let previous=leaders(),lead=null,gain=null,loss=null;
 for(const h of record.history){
  for(const r of h.results)balances.set(r.id,BigInt(r.after));
  const next=leaders();
  if(h.round>=fromRound){
   if(next.length&&next.some(id=>!previous.includes(id))&&h.round>1)lead={type:'lead',round:h.round,ids:next,wealth:String(balances.get(next[0]))};
   for(const r of h.results){
    const pnl=BigInt(r.pnl);
    if(pnl>0n&&(!gain||pnl>BigInt(gain.pnl)))gain={type:'gain',round:h.round,...r};
    if(pnl<0n&&(!loss||pnl<BigInt(loss.pnl)))loss={type:'loss',round:h.round,...r};
   }
  }
  previous=next;
 }
 return [lead,gain,loss].filter(Boolean).sort((a,b)=>a.round-b.round);
}
