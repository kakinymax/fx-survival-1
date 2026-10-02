import {money} from './engine.js';
import {historyTabs} from './record-view.js';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=value=>`${BigInt(value)>0n?'＋':''}${money(value)}`;
const tone=value=>BigInt(value)>0n?'positive':BigInt(value)<0n?'negative':'';
const amount=(value,net=false)=>value===null?'—':net?signed(value):money(value);
const rate=value=>value===null?'—':`${(value/10).toFixed(1)}%`;
const leverage=value=>value===null?'—':`${BigInt(value)/10n}.${BigInt(value)%10n}倍`;
const metric=(key,label,value,note='')=>`<div><dt>${label}</dt><dd data-mode-stat="${key}">${value}</dd>${note?`<small>${note}</small>`:''}</div>`;
function modeCard({stage,stats:s}){
  return `<section class="surface stats-surface mode-card" data-mode="${escape(stage.id)}"><div class="mode-heading"><h2>${escape(stage.name)}</h2><span data-mode-stat="plays">${s.plays.toLocaleString('ja-JP')}ゲーム</span></div><div class="mode-pnl"><span>累計損益</span><strong class="${tone(s.pnlTotal)}" data-mode-stat="pnlTotal">${s.plays?signed(s.pnlTotal):'—'}</strong></div>${!s.plays?'<p class="mode-empty">このモードの記録はまだありません。</p>':''}<dl class="stats-metrics mode-metrics">${metric('averagePnl','1ゲーム平均損益',amount(s.averagePnl,true))}${metric('winRate','優勝率',rate(s.winRateTenths),`${s.wins.toLocaleString('ja-JP')}回優勝`)}${metric('debtRate','負債退場率',rate(s.debtRateTenths),`${s.debtExits.toLocaleString('ja-JP')}回退場`)}${metric('fundsDepleted','資金枯渇・ロスカット',`${s.fundsDepleted.toLocaleString('ja-JP')}回`)}</dl><dl class="stats-metrics mode-metrics mode-risk">${metric('maxGameProfit','最大1ゲーム利益',amount(s.maxGameProfit))}${metric('maxGameLoss','最大1ゲーム損失',amount(s.maxGameLoss))}${metric('averageMaxLeverage','平均最大レバレッジ',leverage(s.averageMaxLeverageTenths))}${metric('averageMaxPosition','平均最大取引額',amount(s.averageMaxPosition))}</dl></section>`;
}
export function modesView({state,data,error,pendingCount=0,hasGame=false}){
  const heading=`<div class="stats-top"><h1>モード別戦績</h1><a class="text-button stats-link" href="#">${hasGame?'ゲームに戻る':'参加者設定へ'}</a></div>${historyTabs('modes')}`;
  if(state==='loading')return `<section class="surface stats-surface">${heading}<p class="stats-message" role="status">モード別戦績を読み込み中…</p></section>`;
  if(state==='error')return `<section class="surface stats-surface">${heading}<p class="stats-message" role="alert">${escape(error||'モード別戦績を読み込めませんでした。')}</p><button type="button" class="primary" data-action="reload-modes">再読み込み</button></section>`;
  return `<div class="stats-layout modes-layout"><section class="surface stats-surface modes-intro">${heading}<p class="stats-scope">あなたのCPU対戦をステージごとに比較。CPUと本人未指定の対面記録は含みません。</p><div class="mode-total"><span>全モード合計 · ${data.lifetime.plays.toLocaleString('ja-JP')}ゲーム</span><strong class="${tone(data.lifetime.pnlTotal)}">${data.lifetime.plays?signed(data.lifetime.pnlTotal):'—'}</strong></div>${pendingCount?`<p class="stats-pending" role="status">保存完了を確認できていない試合が${pendingCount}件あります。<button type="button" class="text-button" data-action="retry-records">保存を再試行</button></p>`:''}</section><div class="mode-grid">${data.modes.map(modeCard).join('')}</div><details class="surface stats-surface mode-definitions"><summary>集計について</summary><p class="stats-definition">最大1ゲーム利益・損失は、最終資産と初期資産の差。負債も損失に含みます。利益または損失がなかった場合は0円、未プレイは「—」です。</p><p class="stats-definition">平均最大レバレッジ・取引額は、各ゲームで使った最大値の平均。同率優勝も優勝1回として数え、優勝率・負債退場率はゲーム数を分母にします。平均金額は1,000円単位、倍率と率は小数1桁で四捨五入します。</p></details></div>`;
}
