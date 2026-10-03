// Display only: sorting never changes turn order, balances or stored records.
export function standings(players){
 const ordered=players.map((player,index)=>({player,index,wealth:BigInt(player.wealth)}))
  .sort((a,b)=>a.wealth>b.wealth?-1:a.wealth<b.wealth?1:a.index-b.index);
 const counts=new Map();for(const {wealth} of ordered)counts.set(wealth,(counts.get(wealth)??0)+1);
 let rank=0,previous=null;
 return ordered.map((entry,index)=>{
  if(entry.wealth!==previous)rank=index+1;
  previous=entry.wealth;
  return {...entry,rank,tied:counts.get(entry.wealth)>1};
 });
}

export function standingBadge(entry,prefix=''){
 return `<span class="standing-badge${entry.rank===1&&entry.wealth>0n?' standing-leader':''}" data-standing-rank="${entry.rank}">${prefix}${entry.tied?'<small>同率</small>':''}<b>${entry.rank}位</b></span>`;
}
