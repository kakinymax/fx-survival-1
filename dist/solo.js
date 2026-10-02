import {createGame,activePlayers,submitOrder,resolveRound,commitDecisions,prepareAutoDraw,finishAutoDraw,randomFace} from './engine.js';

export const CPU_PROFILES=Object.freeze({
 steady:Object.freeze({id:'steady',name:'堅実派',label:'堅実派',description:'1〜15倍が中心。増えた資産を早めに守る。'}),
 rival:Object.freeze({id:'rival',name:'対抗派',label:'対抗派',description:'15〜50倍が中心。順位を見て攻め方を変える。'}),
 gambler:Object.freeze({id:'gambler',name:'勝負師',label:'勝負師',description:'50〜100倍が中心。大きく増えても勝負を続ける。'})
});
export const isSolo=g=>g?.playMode==='solo';
export const humanPlayer=g=>g.players.find(p=>!p.cpu);
export const isSpectating=g=>isSolo(g)&&humanPlayer(g).status!=='active'&&g.phase!=='end';
const cpuPlayers=g=>activePlayers(g).filter(p=>p.cpu);
// CPU policies receive public balances only, never orders, decisions or market outcomes.
const publicSnapshot=g=>({round:g.round,players:g.players.map(({id,wealth,peak,status})=>({id,wealth,peak,status}))});
function face(roll,sides){const n=roll(sides);if(!Number.isInteger(n)||n<1||n>sides)throw Error('CPUの抽選結果が不正です');return n}
function context(id,state){const player=state.players.find(p=>p.id===id),wealth=BigInt(player.wealth);return {wealth,leading:state.players.every(p=>BigInt(p.wealth)<=wealth),round:state.round}}
export function cpuOrder(profile,id,state,roll=randomFace){
 const {leading,round}=context(id,state);let low,high;
 if(profile==='steady'){low=1;high=leading&&round>=7?5:15}
 else if(profile==='rival'){low=leading?15:30;high=leading?30:50}
 else if(profile==='gambler'){low=50;high=100}
 else throw Error('CPUの性格が不正です');
 return {side:face(roll,2)===1?'buy':'sell',leverage:low+face(roll,high-low+1)-1};
}
export function cpuDecision(profile,id,state,roll=randomFace){
 const {wealth,leading,round}=context(id,state);let exitChance;
 if(profile==='steady')exitChance=wealth>=1800n?65:wealth>=1300n&&round>=4?35:round>=11?50:round>=9&&wealth>1000n?30:0;
 else if(profile==='rival')exitChance=leading&&wealth>=1400n?(round>=7?55:15):round>=11&&leading?30:0;
 else if(profile==='gambler')exitChance=round>=10&&leading?35:wealth>=4000n?15:4;
 else throw Error('CPUの性格が不正です');
 return face(roll,100)<=exitChance?'fix':'continue';
}
export function createSoloGame(name='あなた',stage='classic',roll=randomFace){
 if(typeof name!=='string'||!name.trim()||name.length>20)throw Error('名前を1〜20文字で入力してください');
 const profiles=Object.values(CPU_PROFILES),g=createGame([name,...profiles.map(p=>p.name)],'auto',stage);
 g.playMode='solo';g.players.forEach((p,i)=>{if(i)p.cpu=profiles[i-1].id});g.cpuDecisions={};
 prepareSoloOrders(g,roll);return g;
}
export function prepareSoloOrders(g,roll=randomFace){
 if(!isSolo(g)||g.phase!=='order')return;
 const state=publicSnapshot(g),pending={};
 for(const p of cpuPlayers(g))if(!Object.hasOwn(g.orders,p.id))pending[p.id]=cpuOrder(p.cpu,p.id,state,roll);
 Object.assign(g.orders,pending); // Commit all CPU orders before the human can submit.
 if(humanPlayer(g).status!=='active'){g.cursor=activePlayers(g).length;g.phase='orders-revealed'}else g.cursor=0;
}
export function submitSoloOrder(g,order){
 if(!isSolo(g)||g.phase!=='order'||humanPlayer(g).status!=='active'||cpuPlayers(g).some(p=>!g.orders[p.id]))throw Error('注文を入力できません');
 submitOrder(g,order);g.cursor=activePlayers(g).length;g.phase='orders-revealed';
}
function resultQuote(profile,result,round){
 if(result.status==='debt')return profile==='gambler'?'ギャップ、突き抜けたか…。':'資金を超える損失か…。';
 if(result.status==='cut'||result.status==='empty')return 'ここまでか。残ったみんなを見届けよう。';
 if(round===12)return profile==='steady'?'この資産で、結果を待とう。':profile==='rival'?'最後の順位は、どうだ。':'12ラウンド、やり切った。';
 if(BigInt(result.pnl)===0n)return result.win?'方向は当たったが、資産は変わらずか。':'方向は逆だったが、資産は変わらずか。';
 if(profile==='steady'&&BigInt(result.pnl)>=BigInt(result.before))return '大きく増えた。次も落ち着いて考えよう。';
 if(profile==='steady')return result.win?'少しずつでいい。':'倍率は抑えて、次を考えよう。';
 if(profile==='rival')return result.win?'この順位、まだ動かせる。':'この損失を踏まえて、次の勝負だ。';
 return result.win?'まだいける。':'これも勝負。まだ残ってる。';
}
function decisionQuote(profile,choice,id,state){
 if(choice==='fix'){
  const {wealth,leading}=context(id,state);
  if(wealth<1000n)return profile==='steady'?'元本には届かなかった。ここで降りる。':profile==='rival'?'元本割れか。この資産で結果を待つ。':'今日はここまで。残った分を持ち帰る。';
  if(wealth===1000n)return profile==='steady'?'元本を残して、ここで降りる。':profile==='rival'?'元本で確定。最後の順位を待とう。':'今日はここまで。元本を持ち帰る。';
  return profile==='steady'?'ここで降りる。十分増えた。':profile==='rival'?(leading?'この資産で、逃げ切りを狙う。':'増えた分を確定。最後の順位を待つ。'):'今日はここまで。利益を持ち帰る。';
 }
 return profile==='steady'?'次も、無理はしない。':profile==='rival'?'まだ順位は決まってない。':'もう一回、勝負だ。';
}
export function prepareCpuDecisions(g,roll=randomFace){
 if(!isSolo(g)||g.phase!=='results')return;
 g.cpuDecisions??={};const pending={},state=publicSnapshot(g);
 for(const p of cpuPlayers(g))if(!Object.hasOwn(g.cpuDecisions,p.id))pending[p.id]=cpuDecision(p.cpu,p.id,state,roll);
 Object.assign(g.cpuDecisions,pending);
}
export function resolveSoloRound(g,roll=randomFace){
 if(!isSolo(g))throw Error('CPU対戦ではありません');
 resolveRound(g);g.cpuDecisions={};const h=g.history.at(-1);h.cpuQuotes={};
 for(const p of g.players.filter(p=>p.cpu)){const r=h.results.find(r=>r.id===p.id);if(r){p.quote=resultQuote(p.cpu,r,g.round);h.cpuQuotes[p.id]=p.quote}}
 prepareCpuDecisions(g,roll);
}
export function commitSoloDecision(g,choice,roll=randomFace){
 if(!isSolo(g)||g.phase!=='results')throw Error('精算後に進退を選んでください');
 const human=humanPlayer(g);
 if((human.status==='active'&&!['continue','fix'].includes(choice))||(human.status!=='active'&&choice!==undefined))throw Error('続行か資産確定を選んでください');
 if(cpuPlayers(g).some(p=>!['continue','fix'].includes(g.cpuDecisions?.[p.id])))throw Error('CPUの進退が未確定です');
 const choices=Object.fromEntries(cpuPlayers(g).map(p=>[p.id,g.cpuDecisions[p.id]]));
 if(human.status==='active')choices[human.id]=choice;
 const h=g.history.at(-1),state=publicSnapshot(g);
 for(const p of cpuPlayers(g)){p.quote=decisionQuote(p.cpu,choices[p.id],p.id,state);h.cpuQuotes[p.id]=p.quote}
 commitDecisions(g,choices);g.cpuDecisions={};prepareSoloOrders(g,roll);
}
export function resumeSolo(g,roll=randomFace){
 if(!isSolo(g))return g;
 for(const p of g.players)if(p.cpu&&CPU_PROFILES[p.cpu])p.name=CPU_PROFILES[p.cpu].name;
 if(g.phase==='results')g.history.at(-1).cpuQuotes??={};
 prepareSoloOrders(g,roll);prepareCpuDecisions(g,roll);return g;
}
export function fastForwardSolo(g,roll=randomFace){
 if(!isSpectating(g))throw Error('自分の取引終了後に早送りできます');
 // Reuse already drawn values, including an interrupted animation. Never settle twice.
 for(let steps=0;g.phase!=='end'&&steps<100;steps++){
  switch(g.phase){
   case'order':prepareSoloOrders(g,roll);break;
   case'orders-revealed':prepareAutoDraw(g,'direction',roll);finishAutoDraw(g);break;
   case'drawing':finishAutoDraw(g);break;
   case'direction-result':prepareAutoDraw(g,'first',roll);finishAutoDraw(g);break;
   case'movement-result':if(g.first===6&&!g.second){prepareAutoDraw(g,'second',roll);finishAutoDraw(g)}else resolveSoloRound(g,roll);break;
   case'results':commitSoloDecision(g,undefined,roll);break;
   default:throw Error('早送りできない状態です');
  }
 }
 if(g.phase!=='end')throw Error('早送りを完了できませんでした');
 return g;
}
