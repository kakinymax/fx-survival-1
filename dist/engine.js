export const INITIAL = '1000'; // units: ¥1,000; amounts serialized as decimal strings
export const NORMAL = [10,20,30,50,80];
export const SHOCK = [100,100,150,200,500,1000];
export function market(first, second=null) {
  if(!Number.isInteger(first)||first<1||first>6) throw Error('出目は1〜6です');
  if(first===6 && (!Number.isInteger(second)||second<1||second>6)) throw Error('急変判定の出目が必要です');
  return {bps:first===6?SHOCK[second-1]:NORMAL[first-1],gap:first===6&&second>=4};
}
export function roundUnits(numerator, denominator=10000n) {
  const sign=numerator<0n?-1n:1n;
  return sign*((sign*numerator+denominator/2n)/denominator);
}
export function settle(player, order, direction, m) {
  if(player.status!=='active') throw Error('取引終了済みです');
  if(!['buy','sell'].includes(order.side)||!Number.isInteger(order.leverage)||order.leverage<1||order.leverage>100) throw Error('売買と1〜100の整数倍率が必要です');
  if(!['up','down'].includes(direction)) throw Error('相場方向が必要です');
  const before=BigInt(player.wealth), pos=before*BigInt(order.leverage);
  const win=(order.side==='buy')===(direction==='up');
  const ratio=BigInt(order.leverage*m.bps);
  const raw=before*(10000n+(win?ratio:-ratio));
  const cut=!win&&!m.gap&&ratio>=10000n;
  const after=cut?0n:roundUnits(raw);
  const status=after<0n?'debt':after===0n?(cut?'cut':'empty'):'active';
  return {player:{...player,wealth:String(after),peak:String(after>BigInt(player.peak)?after:BigInt(player.peak)),maxPosition:String(pos>BigInt(player.maxPosition)?pos:BigInt(player.maxPosition)),status},result:{id:player.id,side:order.side,leverage:order.leverage,position:String(pos),before:String(before),after:String(after),pnl:String(after-before),win,status}};
}
export function createGame(names, mode='auto') {
  if(names.length<2||names.length>6||names.some(n=>!n.trim())) throw Error('2〜6人の名前が必要です');
  return {version:1,round:1,phase:'handoff-order',cursor:0,mode,players:names.map((name,id)=>({id,name:name.trim(),wealth:INITIAL,peak:INITIAL,maxPosition:'0',status:'active'})),orders:{},decisions:{},direction:null,first:null,second:null,history:[]};
}
export function activePlayers(g){return g.players.filter(p=>p.status==='active')}
export function submitOrder(g, order){
  const p=activePlayers(g)[g.cursor];
  if(g.phase!=='order'||!p) throw Error('入力できる手番ではありません');
  if(!['buy','sell'].includes(order.side)||!Number.isInteger(order.leverage)||order.leverage<1||order.leverage>100) throw Error('買いか売りと、1〜100の整数を選んでください');
  g.orders[p.id]={...order};g.cursor++;
  g.phase=g.cursor===activePlayers(g).length?'ready-orders':'handoff-order';
}
export function resolveRound(g){
  if(g.phase!=='market-ready')throw Error('まだ相場が確定していません');
  const m=market(g.first,g.second),results=[];
  g.players=g.players.map(p=>{if(p.status!=='active')return p;const r=settle(p,g.orders[p.id],g.direction,m);results.push(r.result);return r.player});
  g.history.push({round:g.round,direction:g.direction,first:g.first,second:g.second,...m,results});
  if(g.round===12){g.players=g.players.map(p=>p.status==='active'?{...p,status:'fixed'}:p)}
  g.phase='results';g.cursor=0;
}
export function startDecisions(g){
  if(g.phase!=='results')throw Error('精算後に選択できます');
  g.phase=activePlayers(g).length?'handoff-decision':'end';g.cursor=0;
}
export function submitDecision(g, decision){
  const p=activePlayers(g)[g.cursor];
  if(g.phase!=='decision'||!p||!['continue','fix'].includes(decision))throw Error('続行か資産確定を選んでください');
  g.decisions[p.id]=decision;g.cursor++;
  g.phase=g.cursor===activePlayers(g).length?'ready-decisions':'handoff-decision';
}
export function revealDecisions(g){
  if(g.phase!=='ready-decisions')throw Error('全員の選択が必要です');
  g.players=g.players.map(p=>g.decisions[p.id]==='fix'?{...p,status:'fixed'}:p);g.phase='revealed-decisions';
}
export function nextRound(g){
  if(g.phase!=='revealed-decisions')throw Error('進退を公開してください');
  if(!activePlayers(g).length){g.phase='end';return}
  g.round++;g.cursor=0;g.orders={};g.decisions={};g.direction=null;g.first=null;g.second=null;g.phase='handoff-order';
}
export function winners(g){
  const max=g.players.reduce((a,p)=>BigInt(p.wealth)>a?BigInt(p.wealth):a,0n);
  return max>0n?g.players.filter(p=>BigInt(p.wealth)===max):[];
}
export function randomFace(sides){
  const buffer=new Uint32Array(1),limit=Math.floor(4294967296/sides)*sides;
  do{crypto.getRandomValues(buffer)}while(buffer[0]>=limit);
  return buffer[0]%sides+1;
}
export function money(units){
  let n=BigInt(units),sign=n<0n?'−':'';if(n<0n)n=-n;
  const wan=n/10n,decimal=n%10n;
  const low=wan%10000n,oku=(wan/10000n)%10000n,cho=wan/100000000n;
  let out=cho?`${cho.toLocaleString('ja-JP')}兆`:'';
  if(oku)out+=`${oku.toLocaleString('ja-JP')}億`;
  if(low||decimal||!out)out+=`${low.toLocaleString('ja-JP')}.${decimal}万`;
  return `${sign}${out}円`;
}
