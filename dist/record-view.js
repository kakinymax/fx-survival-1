import {money} from './engine.js';
import {marketSeries,candlesSvg} from './chart.js';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const signed=value=>`${BigInt(value)>0n?'＋':''}${money(value)}`;
const tone=value=>BigInt(value)>0n?'positive':BigInt(value)<0n?'negative':'';
const labels={fixed:'資産確定',cut:'ロスカット',empty:'資金枯渇',debt:'負債退場',active:'続行'};
const scopes={self:'あなた',human:'人間全体',cpu:'CPU'};
const groups=[
  ['利益',[
    ['highestFinal','最高最終資産','money','最後に残した資産。'],
    ['highestPeak','最高到達資産','money','初期資産を含む、ゲーム中の最高資産。'],
    ['maxRoundProfit','最大1ラウンド利益','money','1回の取引で増えた金額。'],
    ['profitRate','最大利益率','rate','（最終資産 − 初期資産）÷ 初期資産。'],
    ['increasingRounds','最大連続増加','rounds','資産が増え続けたラウンド数。増減なしで途切れます。']
  ]],
  ['リスク',[
    ['maxPosition','最大取引額','money','1回の取引で持った最大ポジション。'],
    ['maxLeverage','最大レバレッジ','leverage','1ゲーム内で使用した最大倍率。'],
    ['uses100','100倍使用回数','count','1ゲーム内で100倍を使った回数。'],
    ['uses50Plus','50倍以上使用回数','count','1ゲーム内で50〜100倍を使った回数。']
  ]],
  ['損失',[
    ['maxRoundLoss','最大1ラウンド損失','money','1回の取引で減った金額。'],
    ['maxDrawdown','最大ドローダウン','money','それまでの最高資産からの最大減少額。負債を含みます。'],
    ['maxDebt','最大負債','money','最終資産のマイナス額。'],
    ['peakFall','最高からの転落額','money','最高到達資産 − 最終資産。']
  ]],
  ['生存',[
    ['retainedProfit','最高資産を維持した利益','money','最終資産が最高到達資産と同額のゲームで、残した利益。'],
    ['lowestWinningFinal','最も低い資産で優勝','money','正の最終資産で優勝した記録の最小額。同率優勝も含みます。'],
    ['underInitialWin','元本割れ優勝','money','元本未満の資産で優勝した記録の最小額。'],
    ['debtFreeGames','負債退場なし連続ゲーム','games','あなたは本人の試合、CPUは同じタイプが参加した試合で数えます。0円での退場は連続記録を途切れさせません。']
  ]]
];
function valueLabel(value,unit){
  if(unit==='money')return money(value);
  if(unit==='rate'){const n=BigInt(value);return `${n/10n}.${n%10n}%`}
  return `${value}${{rounds:'ラウンド',leverage:'倍',count:'回',games:'ゲーム'}[unit]}`;
}
export function historyTabs(current){return `<nav class="history-tabs" aria-label="戦績のページ"><a href="#stats" ${current==='stats'?'aria-current="page"':''}>生涯戦績</a><a href="#records" ${current==='records'?'aria-current="page"':''}>歴代記録</a></nav>`}
const head=(title,hasGame)=>`<div class="stats-top"><h1>${title}</h1><a href="#" class="text-button stats-link">${hasGame?'ゲームに戻る':'スタート画面へ'}</a></div>`;
function readState(state,error,action){
  return state==='loading'?'<p class="stats-message" role="status">保存済みの記録を読み込み中…</p>':`<p class="stats-message" role="alert">${escape(error||'記録を読み込めませんでした。')}</p><button class="secondary" data-action="${action}">再読み込み</button>`;
}
function holder(entry,unit,scope){return `<a class="record-holder" href="#match/${escape(entry.gameId)}?from=records/${scope}"><span><b>${entry.rank}位 · ${escape(entry.playerName)}</b>${entry.kind==='cpu'?'<span class="cpu-tag">CPU</span>':''}<strong>${valueLabel(entry.value,unit)}</strong></span><small>${escape(entry.stage.name)} · ${entry.playMode==='solo'?'CPU対戦':'対面'}<br><time datetime="${escape(entry.endedAt)}">${date(entry.endedAt)}</time>${entry.startedAt?`<br>${date(entry.startedAt)}からの連続記録`:''}</small><span class="record-open">試合を見る →</span></a>`}
function card(definition,record,scope){
  const [key,title,unit,description]=definition,leaders=record.leaders;
  return `<article class="record-card" data-record-key="${key}"><h3>${title}</h3><p class="record-value ${leaders.length&&key==='highestFinal'&&BigInt(leaders[0].value)<0n?'negative':''}" data-record-value>${leaders.length?valueLabel(leaders[0].value,unit):'—'}</p>${leaders.length?holder(leaders[0],unit,scope):'<p class="stats-empty">該当する記録はまだありません。</p>'}<p class="stats-definition">${description}</p>${record.bestCount>1?`<p class="record-ties">同記録 ${record.bestCount}件${record.bestCount>3?' · 一覧は最新3件':''}</p>`:''}${leaders.length>1?`<details class="record-leaders"><summary>上位${leaders.length}件を見る</summary>${leaders.slice(1).map(entry=>holder(entry,unit,scope)).join('')}<p class="stats-definition">同値は同順位。表示順は新しい試合から。</p></details>`:''}</article>`;
}
export function recordsView({state,data,error='',scope='self',hasGame=false,pendingCount=0}){
  const heading=head('歴代記録',hasGame)+historyTabs('records');
  if(state!=='ready')return `<section class="surface stats-surface">${heading}${readState(state,error,'reload-records')}</section>`;
  const s=data.scopes[scope],l=data.lifetime;
  return `<div class="stats-layout"><section class="surface stats-surface">${heading}<nav class="record-scopes" aria-label="記録の対象">${Object.entries(scopes).map(([key,label])=>`<a href="#records/${key}" ${scope===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav><p class="stats-scope">${scope==='self'?'CPU対戦の自己ベスト。対面は「人間全体」で確認できます。':scope==='human'?'対面を含む、人間プレイヤーの試合ごとの記録。':'CPUの記録を、人間の記録と分けて表示します。'}<br>保存済み ${data.totalSavedGames}ゲーム · 対象 ${s.participants}人分の結果</p>${pendingCount?`<p class="stats-pending" role="status">保存完了を確認できていない試合が${pendingCount}件あります。<button class="text-button" data-action="retry-records">保存を再試行</button></p>`:''}${scope==='self'?`<div class="record-context"><span>あなたの生涯損益</span><strong class="${tone(l.pnlTotal)}" data-record-lifetime>${signed(l.pnlTotal)}</strong><a href="#stats" class="stats-link">累計の戦績を見る →</a></div>`:''}${!s.participants?'<p class="stats-empty">この対象の記録はまだありません。ゲームを最後まで遊ぶと記録が残ります。</p>':''}<details class="record-about"><summary>集計について</summary><p class="stats-definition">${scope==='self'?'本人を特定できるCPU対戦の自己ベスト。名前を変えても同じ本人として集計します。':scope==='human'?'対面を含む人間プレイヤーの試合ごとの記録。同じ名前でも、別の試合の人物を同一人物とはみなしません。':'CPUだけの試合記録。あなたや対面の参加者とは分けて集計します。'}<br>各項目の上位3件を掲載。損益・回数などが0の候補は掲載しません。最高最終資産には0円や負債も含みます。通貨ステージをまたいだ記録です。利益率は表示だけ小数1桁に四捨五入します。</p></details></section>${groups.map(([title,definitions],i)=>`<section class="surface stats-surface record-group"><details ${i===0?'open':''}><summary><h2>${title}の記録</h2></summary><div class="record-grid">${definitions.filter(([key])=>key!=='debtFreeGames'||scope!=='human').map(def=>card(def,s.records[def[0]],scope)).join('')}</div>${title==='生存'&&scope==='human'?'<p class="stats-definition">人物を特定できない対面の試合では、複数ゲームにまたがる連続記録は数えません。「あなた」のタブで確認できます。</p>':''}</details></section>`).join('')}</div>`;
}

export function matchView({state,data,error='',hasGame=false,from='records'}){
  const heading=head('試合の記録',hasGame)+`<a class="stats-link record-back" href="${from==='stats'?'#stats':`#${from}`}">← ${from==='stats'?'生涯戦績':'歴代記録'}へ</a>`;
  if(state!=='ready')return `<section class="surface stats-surface">${heading}${readState(state,error,'reload-match')}</section>`;
  const r=data,winners=r.players.filter(p=>r.winnerIds.includes(p.id)),ranked=[...r.players].sort((a,b)=>BigInt(a.wealth)>BigInt(b.wealth)?-1:BigInt(a.wealth)<BigInt(b.wealth)?1:0);
  const metric=(title,value)=>`<div><dt>${title}</dt><dd>${money(value)}</dd></div>`;
  return `<div class="stats-layout"><section class="surface stats-surface">${heading}<p class="stats-game-mode"><time datetime="${escape(r.endedAt)}">${date(r.endedAt)}</time><br>${escape(r.stage.name)} · ${r.playMode==='solo'?'CPU対戦':'対面'} · ${r.drawMode==='auto'?'アプリ抽選':'実物の出目を入力'}<br>${r.endedRound} / ${r.maxRounds}ラウンド · ${r.players.length}人</p><div class="saved-winner"><span>${winners.length>1?'同率優勝':winners.length?'優勝':'勝者なし'}</span><h2>${winners.length?winners.map(p=>`${escape(p.name)}${p.kind==='cpu'?'（CPU）':''}`).join('・'):'正の資産を残した人はいません。'}</h2>${winners.length?`<strong>${money(winners[0].wealth)}</strong>`:''}</div><p class="stats-definition">保存済みの試合です。進行中のゲームには影響しません。</p></section><section class="surface stats-surface"><h2>参加者の最終結果</h2><div class="saved-roster">${ranked.map(p=>`<article class="saved-player" data-saved-player="${p.id}"><div class="stats-game-heading"><h3>${escape(p.name)} ${p.kind==='cpu'?'<span class="cpu-tag">CPU</span>':p.id===r.ownerPlayerId?'<span class="cpu-tag">あなた</span>':''}</h3><span>${labels[p.status]}${r.winnerIds.includes(p.id)?' · 優勝':''}</span></div><strong class="saved-final ${tone(p.wealth)}">${money(p.wealth)}</strong><dl class="stats-metrics">${metric('初期資産',p.initial)}${metric('最高到達資産',p.peak)}${metric('最大取引額',p.maxPosition)}${metric('損益',String(BigInt(p.wealth)-BigInt(p.initial)))}</dl></article>`).join('')}</div></section><section class="surface stats-surface"><div class="saved-log-heading"><h2>ラウンドログ</h2><button type="button" class="market-mini-chart" data-action="chart-open" aria-label="共通相場の履歴を拡大" aria-haspopup="dialog" aria-controls="market-chart">${candlesSvg(marketSeries(r.history))}</button></div><div class="saved-rounds">${r.history.map(h=>`<details data-saved-round="${h.round}"><summary>R${String(h.round).padStart(2,'0')} <span class="${h.direction==='up'?'positive':'negative'}">${h.direction==='up'?'＋':'−'}${h.bps/100}%</span> · ${h.gap?'ギャップ':'通常'}</summary><p class="stats-definition">出目 ${h.first}${h.second?` / ${h.second}`:''}</p>${h.results.map(t=>{const p=r.players.find(p=>p.id===t.id);return `<article class="saved-trade"><div><strong>${escape(p.name)} ${p.kind==='cpu'?'<span class="cpu-tag">CPU</span>':''}</strong><strong class="${tone(t.pnl)}">${signed(t.pnl)}</strong></div><p>${t.side==='buy'?'買い':'売り'} ${t.leverage}倍 · 取引額 ${money(t.position)}<br>${money(t.before)} → ${money(t.after)}${['cut','empty','debt'].includes(t.status)?` · ${labels[t.status]}`:''}</p>${h.cpuQuotes?.[p.id]?`<p class="stats-definition">「${escape(h.cpuQuotes[p.id])}」</p>`:''}</article>`}).join('')}${h.decisions?`<p class="stats-definition">進退：${Object.entries(h.decisions).map(([id,c])=>`${escape(r.players.find(p=>p.id===Number(id)).name)} ${c==='fix'?'資産確定':'続行'}`).join(' · ')}</p>`:h.round===r.maxRounds?'<p class="stats-definition">最終ラウンドで、生存者の資産を自動確定。</p>':''}</details>`).join('')}</div></section></div>`;
}
