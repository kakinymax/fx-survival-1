export const INITIAL = '1000'; // units: ¥1,000; amounts serialized as decimal strings
export const NORMAL = [10,20,30,50,80];
export const SHOCK = [100,100,150,200,500,1000];
export const STAGES = Object.freeze({
  classic:Object.freeze({id:'classic',name:'クラシック',code:'BASIC RULES',description:'基本ルール v1.0の値動き',normal:Object.freeze([...NORMAL]),shock:Object.freeze([...SHOCK])}),
  usdjpy:Object.freeze({id:'usdjpy',name:'ドル円',code:'USD / JPY',description:'値動き控えめ。小さな増減を重ねる',normal:Object.freeze([10,10,20,30,50]),shock:Object.freeze([80,80,100,150,300,500])}),
  tryjpy:Object.freeze({id:'tryjpy',name:'トルコリラ円',code:'TRY / JPY',description:'値動き大きめ。利益も損失も大きく動く',normal:Object.freeze([20,40,60,100,150]),shock:Object.freeze([200,200,300,500,1000,2000])})
});
export function getStage(id='classic') {
  if(!Object.hasOwn(STAGES,id))throw Error('有効なステージを選んでください');
  return STAGES[id];
}
export function market(first, second=null, stageId='classic') {
  const stage=getStage(stageId);
  if(!Number.isInteger(first)||first<1||first>6) throw Error('出目は1〜6です');
  if(first===6 && (!Number.isInteger(second)||second<1||second>6)) throw Error('急変判定の出目が必要です');
  return {bps:first===6?stage.shock[second-1]:stage.normal[first-1],gap:first===6&&second>=4};
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
export function createGame(names, mode='auto', stageId='classic') {
  if(names.length<2||names.length>6||names.some(n=>!n.trim())) throw Error('2〜6人の名前が必要です');
  const stage=getStage(stageId);
  return {version:1,flowVersion:3,stage:stage.id,round:1,phase:'order',cursor:0,mode,players:names.map((name,id)=>({id,name:name.trim(),wealth:INITIAL,peak:INITIAL,maxPosition:'0',status:'active'})),orders:{},decisions:{},lastDecisions:null,direction:null,first:null,second:null,history:[]};
}
export function activePlayers(g){return g.players.filter(p=>p.status==='active')}
export function submitOrder(g, order){
  const p=activePlayers(g)[g.cursor];
  if(g.phase!=='order'||!p) throw Error('入力できる手番ではありません');
  if(!['buy','sell'].includes(order.side)||!Number.isInteger(order.leverage)||order.leverage<1||order.leverage>100) throw Error('買いか売りと、1〜100の整数を選んでください');
  g.orders[p.id]={...order};g.cursor++;
  g.phase=g.cursor===activePlayers(g).length?'orders-revealed':'order';
}
export function resolveRound(g){
  if(!['market-ready','drawing'].includes(g.phase))throw Error('まだ相場が確定していません');
  const m=market(g.first,g.second,g.stage??'classic'),results=[];
  g.players=g.players.map(p=>{if(p.status!=='active')return p;const r=settle(p,g.orders[p.id],g.direction,m);results.push(r.result);return r.player});
  g.history.push({round:g.round,stage:g.stage??'classic',direction:g.direction,first:g.first,second:g.second,...m,results});
  if(g.round===12){g.players=g.players.map(p=>p.status==='active'?{...p,status:'fixed'}:p)}
  g.phase=activePlayers(g).length?'results':'end';g.cursor=0;
}
export function commitDecisions(g, decisions=g.decisions){
  if(g.phase!=='results')throw Error('精算結果の画面で進退を確定できます');
  const active=activePlayers(g),ids=active.map(p=>String(p.id));
  if(!decisions||typeof decisions!=='object'||Array.isArray(decisions)||!active.length||Object.keys(decisions).length!==active.length||Object.keys(decisions).some(id=>!ids.includes(id))||active.some(p=>!Object.hasOwn(decisions,p.id)||!['continue','fix'].includes(decisions[p.id])))throw Error('取引中の全員の続行／資産確定を記録してください');
  g.decisions=Object.fromEntries(active.map(p=>[p.id,decisions[p.id]]));
  g.phase='ready-decisions';revealDecisions(g);nextRound(g);
}
export function revealDecisions(g){
  if(g.phase!=='ready-decisions')throw Error('全員の選択が必要です');
  g.lastDecisions={round:g.round,choices:Object.entries(g.decisions).map(([id,choice])=>({id:Number(id),choice}))};
  const entry=g.history.find(h=>h.round===g.round);if(entry)entry.decisions={...g.decisions};
  g.players=g.players.map(p=>g.decisions[p.id]==='fix'?{...p,status:'fixed'}:p);g.phase='revealed-decisions';
}
export function nextRound(g){
  if(g.phase!=='revealed-decisions')throw Error('進退を公開してください');
  if(!g.lastDecisions||g.lastDecisions.round!==g.round)g.lastDecisions={round:g.round,choices:Object.entries(g.decisions).map(([id,choice])=>({id:Number(id),choice}))};
  if(!activePlayers(g).length){g.phase='end';return}
  g.round++;g.cursor=0;g.orders={};g.decisions={};g.direction=null;g.first=null;g.second=null;g.phase='order';
}
export function prepareAutoMarket(g, roll=randomFace){
  if(g.mode!=='auto'||!['orders-revealed','dice','shock'].includes(g.phase))throw Error('相場を抽選できる画面ではありません');
  const direction=g.direction??(roll(2)===1?'up':'down');
  const first=g.first??roll(6),second=first===6?(g.second??roll(6)):null;
  market(first,second,g.stage??'classic');
  g.direction=direction;g.first=first;g.second=second;g.phase='drawing';
}
export function migrateGame(g){
  g.stage=g.stage??'classic';getStage(g.stage);g.lastDecisions=g.lastDecisions??null;g.decisions=g.decisions??{};
  const phases={'handoff-order':'order','ready-orders':'orders-revealed',direction:'orders-revealed','handoff-decision':'results',decision:'results'};
  g.phase=phases[g.phase]??g.phase;
  if(['market-ready','drawing'].includes(g.phase))resolveRound(g);
  if(g.phase==='ready-decisions'){revealDecisions(g);nextRound(g)}
  else if(g.phase==='revealed-decisions')nextRound(g);
  if(g.phase==='results'&&!activePlayers(g).length)g.phase='end';
  g.flowVersion=3;return g;
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
