import {money} from './engine.js';

const signed=value=>`${BigInt(value)>0n?'＋':''}${money(value)}`;
const tone=value=>BigInt(value)>0n?'positive':BigInt(value)<0n?'negative':'';
const metric=(label,value,key)=>`<div><dt>${label}</dt><dd data-feedback-stat="${key}">${value}</dd></div>`;
const amount=(value,net=false)=>value===null?'—':net?signed(value):money(value);
const count=n=>n.toLocaleString('ja-JP');
const bandLabel=band=>band.min===band.max?`${band.min}倍`:`${band.min}〜${band.max}倍`;
function bandCard(band){
  return `<article class="feedback-band" data-feedback-band="${band.id}"><div class="feedback-heading"><h3>${bandLabel(band)}の取引</h3><span data-feedback-stat="trades">${count(band.trades)}回</span></div><p class="feedback-outcomes"><strong data-feedback-stat="outcomes">利益 ${count(band.profitable)}回 / 損失 ${count(band.losses)}回</strong><span data-feedback-stat="unchanged">増減なし ${count(band.unchanged)}回</span></p><dl class="stats-metrics feedback-amounts">${metric('取引損益合計',`<span class="${tone(band.pnlTotal)}">${band.trades?signed(band.pnlTotal):'—'}</span>`,'pnlTotal')}${metric('1取引平均損益',amount(band.averagePnl,true),'averagePnl')}</dl></article>`;
}
function gameCard(id,stats){
  return `<article class="feedback-game" data-feedback-game="${id}"><h3>${id==='used100'?'100倍を使ったゲーム':'100倍を使わなかったゲーム'}</h3><span class="feedback-game-count" data-feedback-stat="plays">${count(stats.plays)}ゲーム</span><div class="feedback-game-pnl"><span>ゲーム全体の累計損益</span><strong class="${tone(stats.pnlTotal)}" data-feedback-stat="pnlTotal">${stats.plays?signed(stats.pnlTotal):'—'}</strong></div><dl class="stats-metrics feedback-amounts">${metric('1ゲーム平均損益',amount(stats.averagePnl,true),'averagePnl')}${metric('優勝',`${count(stats.wins)}回`,'wins')}${metric('0円退場（ロスカット含む）',`${count(stats.fundsDepleted)}回`,'fundsDepleted')}${metric('負債退場',`${count(stats.debtExits)}回`,'debtExits')}${metric('最高最終資産',amount(stats.highestFinal),'highestFinal')}</dl></article>`;
}
export function feedbackView(data){
  if(!data)return '';
  const hundred=data.rounds.find(b=>b.id==='hundred');
  return `<section class="surface stats-surface feedback-surface"><h2>取引の振り返り</h2>${bandCard(hundred)}<p class="stats-definition">利益・損失は精算後の資産の増減で数えます。増減なしは別に集計。取引損益には、ロスカットやギャップ負債による損失も含みます。</p><details class="feedback-detail"><summary>ほかの倍率の取引成績</summary><div class="feedback-band-grid">${data.rounds.filter(b=>b.id!=='hundred').map(bandCard).join('')}</div></details><section class="feedback-games"><h3>100倍を使ったゲームの収支</h3><p class="stats-definition">1回でも100倍を使ったかで分類。100倍以外の取引も含め、そのゲーム全体の損益を集計します。</p><div class="feedback-game-grid">${Object.entries(data.games).map(([id,stats])=>gameCard(id,stats)).join('')}</div></section></section>`;
}
