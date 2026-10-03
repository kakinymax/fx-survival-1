import {createGame,activePlayers,submitOrder,resolveRound,commitDecisions,money,market,prepareAutoDraw,finishAutoDraw,migrateGame,STAGES,getStage} from './engine.js';
import {CPU_PROFILES,isSolo,humanPlayer,isSpectating,createSoloGame,submitSoloOrder,resolveSoloRound,commitSoloDecision,resumeSolo,fastForwardSolo} from './solo.js';
import {marketSeries,indexDisplay,candlesSvg} from './chart.js';
import {SHOCK_DRAW_MS,marketCandleModel,marketCandleSvg} from './market-candle.js';
import {ensureGameIdentity} from './records.js';
import {standings,standingBadge} from './standings.js';
import {createRecordStore} from './record-store.js';
import {statisticsView} from './stats-view.js';
import {recordsView,matchView} from './record-view.js';
import {tripsView,meterLabel} from './trip-view.js';
import {modesView} from './mode-view.js';
import {legendsView} from './legend-view.js';
import {LEGEND_KEYS} from './legends.js';
import {cpuPreviousQuote,personalBestsView} from './career-view.js';
import {impactPreview,previousSoloLeverage,replayGame,fastForwardHighlights} from './play-extras.js';

const root=document.querySelector('#app'),KEY='fx-survival-v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={active:'続行',fixed:'資産確定',cut:'ロスカット',debt:'負債・退場',empty:'資金枯渇'};
let game=null,setupCount=4,setupMode='auto',setupStage='classic',setupNames=['プレイヤーA','プレイヤーB','プレイヤーC','プレイヤーD','プレイヤーE','プレイヤーF'];
let setupPlay='tabletop',soloName='あなた';
const setupNameEditors={tabletop:false,solo:false};
let draftSide=null,draftLeverage=1,storageError=false;
let shockAnimation=null;
let screen='game',statistics={state:'loading',data:null},statisticsRequest=0;
let cpuCareers={state:'idle',data:null},cpuCareerRequest=0;
let personalBests={id:null,state:'idle',data:null},personalBestRequest=0;
let recordsPage={state:'loading',data:null},matchPage={state:'loading',data:null},historyRequest=0,recordsScope='self',matchId=null,matchFrom='records';
let legendsPage={state:'loading',data:null},legendsRequest=0,legendScope='self',legendEvent='all';
let modesPage={state:'loading',data:null},modesRequest=0;
let tripsPage={state:'loading',data:null},tripsRequest=0,tripDrafts={},tripMutation={busy:false,operation:null,error:'',notice:''},tripResetTarget=null;
function readRoute(){
 const hash=location.hash;screen=hash==='#stats'?'stats':/^#legends(?:\/|$)/.test(hash)?'legends':hash==='#modes'?'modes':hash==='#trips'?'trips':/^#records(?:\/|$)/.test(hash)?'records':hash.startsWith('#match/')?'match':'game';
 if(screen==='legends'){const [,scope,event]=hash.split('/');legendScope=['self','human','cpu'].includes(scope)?scope:'self';legendEvent=LEGEND_KEYS.includes(event)?event:'all'}
 if(screen==='records'){const scope=hash.split('/')[1];if(['self','human','cpu'].includes(scope))recordsScope=scope}
 if(screen==='match'){const route=hash.match(/^#match\/([-a-zA-Z0-9_]{1,100})(?:\?from=(stats|trips|records(?:\/(?:self|human|cpu))?|legends(?:\/(?:self|human|cpu)(?:\/(?:all|comeback|peakCollapse|hundredMillion|triple|zero|debtRecord|underInitialWin|lowLeverageWin|hundredWin))?)?))?$/);matchId=route?.[1]??null;matchFrom=route?.[2]??'records'}
}
readRoute();
function syncResultScrollHint(){
 const hint=root.querySelector('[data-result-scroll-hint]');if(!hint)return;
 const dock=root.querySelector('.turn-actions'),viewport=window.visualViewport;
 const bottom=Math.min(dock.getBoundingClientRect().top,(viewport?.offsetTop??0)+(viewport?.height??innerHeight));
 const remaining=[...root.querySelectorAll('.batch-result')].filter(row=>row.getBoundingClientRect().bottom>bottom+1).length;
 const text=remaining?`下にあと${remaining}人の結果 ↓`:'';
 if(hint.textContent!==text)hint.textContent=text;
}
const dockObserver=new ResizeObserver(syncActionDock);
function syncActionDock(){const dock=root.querySelector('.turn-actions'),viewport=window.visualViewport;document.documentElement.style.setProperty('--action-height',`${dock?.offsetHeight??80}px`);document.documentElement.style.setProperty('--keyboard-inset',`${viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0}px`);syncResultScrollHint()}
function observeActionDock(){dockObserver.disconnect();const dock=root.querySelector('.turn-actions');if(dock)dockObserver.observe(dock);syncActionDock()}
window.visualViewport?.addEventListener('resize',syncActionDock);
window.visualViewport?.addEventListener('scroll',syncActionDock);
window.addEventListener('resize',syncActionDock);
window.addEventListener('scroll',syncResultScrollHint,{passive:true});
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version===1&&saved.players?.length>=2&&saved.players.length<=6){saved.players.forEach(p=>{BigInt(p.wealth);BigInt(p.peak);BigInt(p.maxPosition)});game=resumeSolo(migrateGame(saved))}}catch{storageError=true}
function save(){try{if(game)localStorage.setItem(KEY,JSON.stringify(game));else localStorage.removeItem(KEY)}catch{storageError=true}}
const recordStore=createRecordStore({storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)},onChange(id,state){if(game?.finalRecord?.id===id&&state==='saved'){game.finalRecordSaved=true;save()}refreshRecordStatus();if(state==='saved'){invalidateCpuCareers();void ensurePersonalBests(true);if(screen==='stats')void loadStatistics();if(screen==='records')void loadRecords();if(screen==='trips')void loadTrips();if(screen==='modes')void loadModes();if(screen==='legends')void loadLegends()}}});
function prepareRecord(){if(game){ensureGameIdentity(game);if(game.finalRecord)recordStore.enqueue(game.finalRecord,{saved:game.finalRecordSaved===true})}}
function update(scroll=true){prepareRecord();save();render();if(scroll)window.scrollTo({top:0,behavior:'instant'})}
function recordStatus(){const id=game?.finalRecord?.id,state=recordStore.state(id);return `<div class="record-status" role="status" data-record-status>${state==='saved'?'このゲームを戦績に保存しました。':state==='error'?`戦績を保存できませんでした。${action('再試行','retry-record','text-button')}`:'戦績を保存中…'}${state==='error'&&recordStore.draftError()?'<small>ページを閉じる前に再試行してください。</small>':''}</div>`}
function pendingStatus(){return !game&&recordStore.pendingCount()?`<div class="pending-records" role="status" data-pending-records>未保存の戦績が${recordStore.pendingCount()}件あります。${action('再試行','retry-records','text-button')}</div>`:''}
function refreshRecordStatus(){const notice=root.querySelector('[data-record-status]');if(notice)notice.outerHTML=recordStatus();const pending=root.querySelector('[data-pending-records]');if(pending)pending.outerHTML=pendingStatus();refreshPersonalBestNotice()}
window.addEventListener('online',()=>{void recordStore.retryAll()});
function cpuIntroQuote(profile){
 if(cpuCareers.state!=='ready')return '';
 const career=cpuCareers.data.find(c=>c.id===profile);return career?`<p class="cpu-prior-quote">「${escape(cpuPreviousQuote(career))}」</p>`:'';
}
function cpuIntroStatus(){
 if(cpuCareers.state==='error')return '前回の記録を読み込めませんでした。<button type="button" class="text-button" data-action="retry-cpu-careers">再試行</button>';
 if(cpuCareers.state==='ready')return cpuCareers.data.some(c=>c.latest)?'保存済みの前回結果から':'';
 return '前回の記録を読み込み中…';
}
function refreshCpuIntro(){
 root.querySelectorAll('[data-cpu-intro]').forEach(node=>{node.innerHTML=cpuIntroQuote(node.dataset.cpuIntro)});
 const note=root.querySelector('[data-cpu-intro-status]');if(note)note.innerHTML=cpuIntroStatus();
}
function invalidateCpuCareers(){
 cpuCareerRequest++;cpuCareers={state:'idle',data:null};
 if(screen==='game'&&!game&&setupPlay==='solo')void loadCpuCareers();
}
async function loadCpuCareers(){
 if(cpuCareers.state==='loading')return;
 const request=++cpuCareerRequest;cpuCareers={state:'loading',data:null};refreshCpuIntro();
 try{
  const response=await fetch('/api/cpu-careers',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('CPUの前回結果を読み込めませんでした。');
  const data=await response.json();if(!Array.isArray(data.cpuCareers))throw Error('CPUの前回結果を読み込めませんでした。');
  if(request!==cpuCareerRequest)return;cpuCareers={state:'ready',data:data.cpuCareers};refreshCpuIntro();
 }catch{if(request!==cpuCareerRequest)return;cpuCareers={state:'error',data:null};refreshCpuIntro()}
}
function personalBestNotice(){
 if(!isSolo(game?.finalRecord))return '';
 if(recordStore.state(game.finalRecord.id)!=='saved')return '<p class="best-read-note">保存後に自己記録を比較します。</p>';
 if(recordStore.pendingCount())return '<p class="best-read-note">未保存の試合を保存すると、自己記録を比較できます。</p>';
 if(personalBests.id!==game.finalRecord.id||['idle','loading'].includes(personalBests.state))return '<p class="best-read-note">自己記録を確認中…</p>';
 if(personalBests.state==='error')return '<p class="best-read-note">自己記録を確認できませんでした。<button type="button" class="text-button" data-action="retry-personal-bests">再確認</button></p>';
 return personalBestsView(personalBests.data);
}
function personalBestBadge(){
 if(!isSolo(game?.finalRecord)||personalBests.id!==game.finalRecord.id||personalBests.state!=='ready'||recordStore.state(game.finalRecord.id)!=='saved'||recordStore.pendingCount())return '';
 const events=personalBests.data.events;return events.length?`${events.every(e=>e.first)?'初記録':'自己ベスト更新'} ${events.length}件`:'';
}
function refreshPersonalBestNotice(){
 const notice=root.querySelector('[data-personal-bests]');if(notice)notice.innerHTML=personalBestNotice();
 const badge=root.querySelector('[data-personal-best-badge]');if(badge)badge.textContent=personalBestBadge();
}
async function ensurePersonalBests(force=false){
 const record=game?.phase==='end'?game.finalRecord:null;
 if(!isSolo(record)||recordStore.state(record.id)!=='saved'||recordStore.pendingCount())return;
 const id=record.id;
 if(!force&&personalBests.id===id&&personalBests.state!=='idle')return;
 const request=++personalBestRequest;personalBests={id,state:'loading',data:null};refreshPersonalBestNotice();
 try{
  const response=await fetch(`/api/matches/${id}/bests`,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('自己記録を確認できませんでした。');
  const data=await response.json();if(data.id!==id||data.scope!=='self'||!Array.isArray(data.events)||data.events.length>2)throw Error('自己記録を確認できませんでした。');
  if(request!==personalBestRequest||game?.finalRecord?.id!==id)return;personalBests={id,state:'ready',data};refreshPersonalBestNotice();
 }catch{if(request!==personalBestRequest||game?.finalRecord?.id!==id)return;personalBests={id,state:'error',data:null};refreshPersonalBestNotice()}
}
async function loadStatistics(){
 const request=++statisticsRequest;statistics={state:'loading',data:null};if(screen==='stats')render();
 try{const response=await fetch('/api/statistics',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(response.status===401?'ログインを確認して、もう一度読み込んでください。':'戦績を読み込めませんでした。');const data=await response.json();if(!data?.lifetime||!Array.isArray(data.recentGames))throw Error('戦績を読み込めませんでした。');if(request!==statisticsRequest)return;statistics={state:'ready',data}}
 catch(error){if(request!==statisticsRequest)return;statistics={state:'error',data:null,error:error.name==='TimeoutError'?'読み込みに時間がかかっています。もう一度お試しください。':error.message}}
 if(screen==='stats')render();
}
async function loadHistory(kind){
 const request=++historyRequest,id=matchId,title=kind==='records'?'歴代記録':'試合記録';
 const set=value=>{if(kind==='records')recordsPage=value;else matchPage=value};
 set({state:'loading',data:null});if(screen===kind)render();
 try{
  if(kind==='match'&&!id)throw Error('試合が見つかりません。');
  const response=await fetch(kind==='records'?'/api/records':`/api/matches/${id}`,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(response.status===401?'ログインを確認して、もう一度読み込んでください。':response.status===404?'試合が見つかりません。':`${title}を読み込めませんでした。`);
  const data=await response.json();
  if(kind==='records'?!data?.scopes?.self||!data?.scopes?.human||!data?.scopes?.cpu||!data?.lifetime:data?.record?.id!==id||!Array.isArray(data.record.history))throw Error(`${title}を読み込めませんでした。`);
  if(request!==historyRequest)return;set({state:'ready',data:kind==='records'?data:data.record});
 }catch(error){if(request!==historyRequest)return;set({state:'error',data:null,error:error.name==='TimeoutError'?'読み込みに時間がかかっています。もう一度お試しください。':error.message})}
 if(screen===kind)render();
}
function loadRecords(){return loadHistory('records')}
function loadMatch(){return loadHistory('match')}
window.addEventListener('hashchange',()=>{
 const previous=screen;readRoute();statisticsRequest++;historyRequest++;tripsRequest++;modesRequest++;legendsRequest++;
 draftSide=null;draftLeverage=1;chartDialog.close();document.querySelector('#trip-reset-dialog').close();
 if(screen==='stats')void loadStatistics();
 else if(screen==='records'){if(previous==='records'&&recordsPage.state==='ready')render();else void loadRecords()}
 else if(screen==='match')void loadMatch();else if(screen==='trips')void loadTrips();else if(screen==='modes')void loadModes();else if(screen==='legends')void loadLegends();else render();
 window.scrollTo({top:0,behavior:'instant'});
});
async function loadLegends(cursor=null){
 if(cursor&&legendsPage.loadingMore)return;
 const request=++legendsRequest,scope=legendScope,event=legendEvent,previous=legendsPage.data;
 legendsPage=cursor?{...legendsPage,loadingMore:true,moreError:''}:{state:'loading',data:null};if(screen==='legends')render();
 try{
  const params=new URLSearchParams({scope,event});if(cursor)params.set('cursor',cursor);
  const response=await fetch('/api/legends?'+params,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(response.status===401?'ログインを確認して、もう一度読み込んでください。':'殿堂入りの記録を読み込めませんでした。');
  const data=await response.json();if(data.scope!==scope||data.event!==event||!data.counts||!Array.isArray(data.entries))throw Error('殿堂入りの記録を読み込めませんでした。');
  if(request!==legendsRequest)return;
  legendsPage={state:'ready',data:cursor?{...data,entries:[...previous.entries,...data.entries]}:data};
 }catch(error){if(request!==legendsRequest)return;const message=error.name==='TimeoutError'?'読み込みに時間がかかっています。もう一度お試しください。':error.message;legendsPage=cursor?{state:'ready',data:previous,moreError:message}:{state:'error',data:null,error:message}}
 if(screen==='legends')render();
}
async function loadModes(){
 const request=++modesRequest;modesPage={state:'loading',data:null};if(screen==='modes')render();
 try{const response=await fetch('/api/modes',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(response.status===401?'ログインを確認して、もう一度読み込んでください。':'モード別戦績を読み込めませんでした。');const data=await response.json();if(!data?.lifetime||!Array.isArray(data.modes)||data.modes.some(m=>!m.stage?.id||!m.stats))throw Error('モード別戦績を読み込めませんでした。');if(request!==modesRequest)return;modesPage={state:'ready',data}}
 catch(error){if(request!==modesRequest)return;modesPage={state:'error',data:null,error:error.name==='TimeoutError'?'読み込みに時間がかかっています。もう一度お試しください。':error.message}}
 if(screen==='modes')render();
}
async function loadTrips(){
 const request=++tripsRequest;tripsPage={state:'loading',data:null};if(screen==='trips')render();
 try{const response=await fetch('/api/trips',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(response.status===401?'ログインを確認して、もう一度読み込んでください。':'TRIPを読み込めませんでした。');const data=await response.json();if(!Array.isArray(data?.trips)||data.trips.length!==2||data.trips.some(t=>!['a','b'].includes(t.id)||!t.stats)||new Set(data.trips.map(t=>t.id)).size!==2)throw Error('TRIPを読み込めませんでした。');if(request!==tripsRequest)return;tripsPage={state:'ready',data}}
 catch(error){if(request!==tripsRequest)return;tripsPage={state:'error',data:null,error:error.name==='TimeoutError'?'読み込みに時間がかかっています。もう一度お試しください。':error.message}}
 if(screen==='trips')render();
}
function newTripChange(id,action,extra={}){const trip=tripsPage.data?.trips.find(t=>t.id===id);if(!trip)throw Error('TRIPを読み込み直してください。');return {id,change:{action,expectedRevision:trip.revision,requestId:crypto.randomUUID(),...extra}}}
function openTripReset(id){
 if(tripMutation.busy)return;const trip=tripsPage.data?.trips.find(t=>t.id===id);if(!trip)return;
 const operation=newTripChange(id,'reset');if(!trip.startedAt){void submitTripChange(operation);return}
 tripResetTarget=operation;document.querySelector('#trip-reset-title').textContent=`${meterLabel(id)}をリセットしますか？`;
 document.querySelector('#trip-reset-description').textContent=`「${trip.name}」の${trip.stats.plays}ゲーム分の計測を、今から数え直します。過去のゲーム履歴と生涯戦績は残ります。`;
 document.querySelector('#trip-reset-dialog').showModal();
}
async function submitTripChange(operation){
 if(tripMutation.busy)return;tripsRequest++;tripMutation={busy:true,operation,error:'',notice:''};if(screen==='trips')render();
 try{
  const response=await fetch(`/api/trips/${operation.id}`,{method:'PUT',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(operation.change),signal:AbortSignal.timeout(15000)});
  if(!response.ok){const error=Error(response.status===409?'別の画面でTRIPが更新されました。再読み込みして確認してください。':response.status===401?'ログインを確認して、再読み込みしてください。':response.status===400?'名前は1〜20文字で入力してください。':'TRIPを保存できませんでした。同じ操作を再試行できます。');error.retryable=response.status>=500;throw error}
  const data=await response.json();if(data.trip?.id!==operation.id)throw Error('保存の確認ができませんでした。同じ操作を再試行できます。');
  if(operation.change.action==='rename')delete tripDrafts[operation.id];
  tripMutation={busy:false,operation:null,error:'',notice:`${meterLabel(operation.id)}${operation.change.action==='reset'?'の計測を開始しました。':'の名前を保存しました。'}`};
  if(screen==='trips')await loadTrips();
 }catch(error){tripMutation={busy:false,operation:error.retryable===false?null:operation,error:error.message,notice:''};if(screen==='trips')render()}
}
document.querySelector('#trip-reset-cancel').onclick=()=>document.querySelector('#trip-reset-dialog').close();
document.querySelector('#trip-reset-dialog').addEventListener('close',()=>{tripResetTarget=null});
document.querySelector('#trip-reset-confirm').onclick=()=>{const operation=tripResetTarget;document.querySelector('#trip-reset-dialog').close();tripResetTarget=null;if(operation)void submitTripChange(operation)};
function current(){return isSolo(game)?humanPlayer(game):activePlayers(game)[game.cursor]}
function playerName(p){return `${escape(p.name)}${p.cpu?` <span class="cpu-tag">CPU</span>`:isSolo(game)&&p.name!=='あなた'?' <span class="cpu-tag">あなた</span>':''}`}
function avatar(p){return `<span class="avatar">${String.fromCharCode(65+p.id)}</span>`}
function action(label,a,cls='primary full'){return `<button type="button" class="${cls}" data-action="${a}">${label}</button>`}
function activeStage(){return getStage(game?.stage??setupStage)}
function stageSheet(stage){return `<div class="table-wrap"><table class="stage-table"><thead><tr><th>出目</th><th>第1サイコロ</th><th>急変判定</th></tr></thead><tbody>${[1,2,3,4,5,6].map(n=>`<tr><td>${n}</td><td>${n===6?'もう一度':`${stage.normal[n-1]/100}%`}</td><td class="${n>=4?'gap-text':''}">${stage.shock[n-1]/100}%${n>=4?'（ギャップ）':''}</td></tr>`).join('')}</tbody></table></div><p class="stage-explanation">急変判定は、第1サイコロで6が出た場合だけ。第2サイコロの4〜6がギャップです。</p>`}
function stageSelection(){
 const selected=getStage(setupStage);
 return `<fieldset class="stage-picker"><legend>ステージ（全員共通）</legend><div class="stage-options">${Object.values(STAGES).map(stage=>`<button type="button" data-stage="${stage.id}" class="stage-option ${setupStage===stage.id?'stage-selected':''}" aria-pressed="${setupStage===stage.id}"><span class="stage-heading"><strong>${stage.name}</strong><small>${stage.code}</small></span><span class="stage-description">${stage.description}</span><span class="stage-numbers"><span>通常 <strong>${stage.normal[0]/100}〜${stage.shock[2]/100}%</strong></span><span>ギャップ <strong>${stage.shock.slice(3).map(n=>n/100+'%').join(' / ')}</strong></span></span></button>`).join('')}</div><p class="stage-explanation">全ステージ共通：上昇／下落は50:50。ギャップ発生率は1/12（約8.3%）。開始後は変更できません。</p><details class="stage-details"><summary>${selected.name}の出目と値動き</summary>${stageSheet(selected)}</details><p class="stage-explanation">通貨ステージは、通貨のイメージを使ったゲーム用の設定です。</p></fieldset>`;
}
function stageBadge(stage=activeStage()){return `<div class="stage-active" data-stage-active="${stage.id}"><strong>${stage.name}</strong><span>全員共通</span></div>`}
function diceFaces(shock){const values=shock?activeStage().shock:activeStage().normal;return `<div class="dice-grid" role="group" aria-label="実物の${shock?'第2':'第1'}サイコロの出目">${[1,2,3,4,5,6].map(n=>{const pending=!shock&&n===6,gap=shock&&n>=4;return `<button type="button" data-face="${n}" class="${gap?'gap-face':''}" aria-label="出目${n}：${pending?'急変判定':`${gap?'ギャップ相場':'通常相場'} ${values[n-1]/100}%`}"><strong>${n}</strong>${pending?'<small class="face-pending">急変判定</small>':`<small class="face-rate">${values[n-1]/100}%</small>${shock?`<span class="face-market ${gap?'gap-text':''}">${gap?'ギャップ':'通常'}</span>`:''}`}</button>`}).join('')}</div>`}
function showRules(){const stage=activeStage();document.querySelector('#rules-market').innerHTML=`<h3>値動き · ${stage.name}</h3><p>開始時に選んだステージで、全員が同じ相場を経験します。ゲーム途中で変更できません。</p>${stageSheet(stage)}<p>ギャップ発生率は全ステージ1/12（約8.3%）。通常相場では0円でロスカット、ギャップ相場では負債が発生することがあります。</p>`;document.querySelector('#rules').showModal()}
function publicBoard(){return `<aside class="public-panel"><div class="public-heading"><h2>みんなの資産・順位</h2><span class="muted">取引中 ${activePlayers(game).length}人</span></div>${standings(game.players).map(entry=>{const p=entry.player;return `<div class="public-balance" data-standing-player="${p.id}">${standingBadge(entry)}<div><strong>${playerName(p)}</strong><span class="status ${p.status}">${labels[p.status]}</span></div><strong class="${BigInt(p.wealth)<0n?'negative':''}">${money(p.wealth)}</strong></div>${p.cpu&&p.quote?`<p class="public-quote">「${escape(p.quote)}」</p>`:''}`}).join('')}<details class="player-records"><summary>最高資産・最大取引額</summary>${game.players.map(p=>`<div class="player-record"><strong>${escape(p.name)}</strong><span>最高到達 ${money(p.peak)}</span><span>最大取引額 ${money(p.maxPosition)}</span></div>`).join('')}</details><div class="reset-row">${action('ゲームを終了','reset','text-button')}</div></aside>`}
function setupNameFields(solo){
 const mode=solo?'solo':'tabletop';
 return `<details class="setup-name-details" data-setup-names="${mode}" ${setupNameEditors[mode]?'open':''}><summary>名前を変更</summary>${solo?`<label class="solo-name">あなたの名前<input id="solo-name" value="${escape(soloName)}" maxlength="20" required autocomplete="off"></label>`:`<div class="names">${setupNames.slice(0,setupCount).map((name,i)=>`<label>プレイヤー${String.fromCharCode(65+i)}<input name="name-${i}" data-name="${i}" value="${escape(name)}" maxlength="20" required autocomplete="off"></label>`).join('')}</div>`}</details>`;
}
function revealSetupName(input){
 const editor=input.closest('[data-setup-names]');if(!editor)return;
 editor.open=true;setupNameEditors[editor.dataset.setupNames]=true;
}
function setup(){
 const solo=setupPlay==='solo';
 const roster=solo?`<section class="cpu-roster" aria-labelledby="cpu-roster-title"><h2 id="cpu-roster-title">対戦するCPU</h2>${Object.values(CPU_PROFILES).map(p=>`<div class="cpu-profile"><strong>${p.name} <span class="cpu-tag">CPU</span></strong><p>${p.description}</p><div data-cpu-intro="${p.id}">${cpuIntroQuote(p.id)}</div></div>`).join('')}<p class="cpu-intro-status" data-cpu-intro-status>${cpuIntroStatus()}</p></section>`:'';
 return `<div class="setup-layout"><section class="surface setup-surface"><div class="setup-heading"><p class="eyebrow">NEW GAME</p><a href="#stats" class="text-button stats-link">戦績</a></div><div class="play-picker" role="group" aria-label="遊び方">${[['tabletop','みんなで対面'],['solo','1人でCPU対戦']].map(([value,label])=>`<button type="button" data-play="${value}" class="secondary ${setupPlay===value?'selected':''}" aria-pressed="${setupPlay===value}">${label}</button>`).join('')}</div><div class="setup-intro"><p class="muted setup-note">${solo?'あなたとCPU3人で、最大12ラウンド。':'名前とステージを選んで、対戦開始。'}</p></div><form id="setup-form">
 ${solo?'':`<label>プレイヤー人数 <span class="muted">（3〜6人推奨）</span></label><div class="counts" role="group" aria-label="プレイヤー人数">${[2,3,4,5,6].map(n=>`<button type="button" data-count="${n}" class="secondary ${setupCount===n?'selected':''}" aria-pressed="${setupCount===n}">${n}人</button>`).join('')}</div>`}
 ${setupNameFields(solo)}
 ${stageSelection()}
 ${solo?'<p class="setup-note muted mode-note">相場方向とサイコロは、アプリで抽選します。</p>':`<label>相場の決め方</label><div class="mode-choice" role="group" aria-label="相場の決め方"><button type="button" data-mode="auto" class="secondary ${setupMode==='auto'?'selected':''}" aria-pressed="${setupMode==='auto'}">アプリで振る</button><button type="button" data-mode="manual" class="secondary ${setupMode==='manual'?'selected':''}" aria-pressed="${setupMode==='manual'}">実物の出目を入力</button></div><p class="muted setup-note mode-note">${setupMode==='auto'?'鉛筆の＋／−も、サイコロもアプリで抽選。':'鉛筆の＋／−と、サイコロの1〜6を入力。'}</p>`}
 <button class="primary full" type="submit">${solo?'CPUと対戦を始める':'このメンバーで始める'}</button><p class="error" id="form-error" role="alert"></p></form>${roster}</section><aside class="surface setup-aside"><p class="eyebrow">THE RULES</p><h2>増やす。降りる。<br>最後に残した人が勝つ。</h2><div class="rule-stats"><div><strong>100<span>万円</span></strong><span>初期資産</span></div><div><strong>12<span>ラウンド</span></strong><span>ゲームの長さ</span></div><div><strong>1–100<span>倍</span></strong><span>選べるレバレッジ</span></div><div><strong>${solo?'1 + 3':'2–6'}<span>${solo?'人':'人'}</span></strong><span>${solo?'あなた + CPU':'対面でプレイ'}</span></div></div><ol class="steps"><li>売買と倍率を決め、全員で公開。</li><li>同じ相場で、全員の損益を精算。</li><li>続けるか、資産を確定して降りるか。</li></ol><p class="tip">${solo?'CPUの注文は、あなたの入力前に確定。<br>進退もあなたの選択を見ずに判断。<br>降りた後は観戦・早送りができます。':'資産はいつでも公開。<br>注文は全員の確定まで秘密。<br>進退は全員で同時に宣言。'}</p></aside></div>`;
}
function decisionSummary(data=game){const previous=data.lastDecisions;if(!previous)return '';return `<div class="decision-summary" role="status"><p>第${previous.round}ラウンドの進退</p><div>${previous.choices.map(({id,choice})=>`<span><strong>${escape(data.players.find(p=>p.id===id).name)}</strong> ${choice==='fix'?'資産確定':'続行'}</span>`).join('')}</div></div>`}
function impactSummary(){
 if(!Number.isInteger(draftLeverage)||draftLeverage<1||draftLeverage>100)return '倍率を入力すると試算を表示';
 const r=impactPreview(current().wealth,draftLeverage,game.stage).reference;
 return `通常 ${r.bps/100}%の試算：${BigInt(r.hit.pnl)>0n?'＋':''}${money(r.hit.pnl)} / ${money(r.miss.pnl)}　ⓘ`;
}
function showImpact(){
 if(game?.phase!=='order'||!Number.isInteger(draftLeverage)||draftLeverage<1||draftLeverage>100)return;
 const p=current(),preview=impactPreview(p.wealth,draftLeverage,game.stage);
 document.querySelector('#impact-content').innerHTML=`<p class="impact-context">${escape(p.name)} · 現在 ${money(p.wealth)} · ${draftLeverage}倍</p><p class="impact-note">次の相場の予想ではありません。端数処理・ロスカットを含む試算です。</p><div class="table-wrap impact-table"><table><thead><tr><th>値動き</th><th>的中後の資産</th><th>逆行後の資産</th></tr></thead><tbody>${preview.rows.map(r=>`<tr><td>${r.bps/100}%<small>${r.gap?'ギャップ':'通常'}</small></td><td class="positive">${money(r.hit.after)}</td><td>${money(r.miss.after)}${r.miss.status==='active'?'':`<small class="negative">${labels[r.miss.status]}</small>`}</td></tr>`).join('')}</tbody></table></div>`;
 document.querySelector('#impact-dialog').showModal();
}
function fastForwardDigest(data){
 const from=game.fastForwardFromRound,events=fastForwardHighlights(data,from);if(!events.length)return '';
 const names=ids=>ids.map(id=>escape(data.players.find(p=>p.id===id).name)).join('・');
 return `<section class="fast-forward-digest" aria-labelledby="digest-title"><h3 id="digest-title">早送りした展開</h3><p>R${from}〜${data.endedRound}の記録から</p><ul>${events.map(e=>`<li data-highlight="${e.type}"><span>R${e.round}</span><div>${e.type==='lead'?`${names(e.ids)}が${e.ids.length>1?'同率':''}首位へ · ${money(e.wealth)}`:`${names([e.id])} · <strong class="${e.type==='gain'?'positive':'negative'}">${BigInt(e.pnl)>0n?'＋':''}${money(e.pnl)}</strong>${['debt','cut','empty'].includes(e.status)?` · ${labels[e.status]}`:''}<small>${money(e.before)} → ${money(e.after)}</small>`}</div></li>`).join('')}</ul></section>`;
}
function order(){const p=current(),valid=Number.isInteger(draftLeverage)&&draftLeverage>=1&&draftLeverage<=100;return `<div class="order-player">${avatar(p)}<h1>${escape(p.name)}</h1><span class="turn-count">${isSolo(game)?'CPU対戦':`${game.cursor+1} / ${activePlayers(game).length}人目`}</span><p>現在資産 <strong>${money(p.wealth)}</strong> ${standingBadge(standings(game.players).find(e=>e.player.id===p.id))}</p></div><p class="privacy-hint">${isSolo(game)?'CPUは注文済み · 確定後に全員公開':'他の人に見せず入力・全員確定後に公開'}</p><form id="order-form"><div class="choice-grid" role="group" aria-label="売買方向">${[['buy','買い','上昇で利益'],['sell','売り','下落で利益']].map(([side,name,desc])=>`<button type="button" data-side="${side}" class="${draftSide===side?'selected':''}" aria-pressed="${draftSide===side}"><strong class="${side}">${name}</strong><small>${desc}</small></button>`).join('')}</div><div class="leverage-control"><label for="leverage">レバレッジ</label><div class="input-row"><button type="button" class="secondary" data-adjust="-1" aria-label="レバレッジを1下げる">−</button><input id="leverage" name="leverage" type="number" min="1" max="100" step="1" value="${draftLeverage}" inputmode="numeric" required><span>倍</span><button type="button" class="secondary" data-adjust="1" aria-label="レバレッジを1上げる">＋</button></div></div><input type="range" id="leverage-range" aria-label="レバレッジ" min="1" max="100" step="1" value="${draftLeverage}"><div class="range-labels"><span>1倍</span>${previousSoloLeverage(game)!==null?`<button type="button" class="text-button previous-leverage" data-action="previous-leverage">前回 ${previousSoloLeverage(game)}倍</button>`:''}<span>100倍</span></div><div class="position"><span>今回の取引額</span><strong id="position-value">${valid?money(BigInt(p.wealth)*BigInt(draftLeverage)):'1〜100の整数を入力'}</strong><button type="button" id="impact-open" class="impact-preview" data-action="impact-open" ${valid?'':'disabled'} aria-haspopup="dialog">${impactSummary()}</button></div><div class="turn-actions"><p class="error" id="form-error" role="alert"></p><button type="submit" class="primary" id="order-submit" ${draftSide&&valid?'':'disabled'}>${isSolo(game)||game.cursor+1===activePlayers(game).length?'確定して全員分を公開':'確定して次の人へ'}</button></div></form>`}
function orderList(){const players=activePlayers(game);return `<div class="orders-list" role="list" aria-label="公開された注文" data-order-count="${players.length}">${players.map(p=>{const o=game.orders[p.id];return `<div class="order-card" role="listitem" data-order-player="${p.id}"><div class="order-line"><strong class="order-name">${playerName(p)}</strong><span class="order-ticket"><span class="order-side ${o.side}">${o.side==='buy'?'買い':'売り'}</span><b class="order-leverage">${o.leverage}倍</b></span></div><p class="order-amount"><span>取引額</span><strong>${money(BigInt(p.wealth)*BigInt(o.leverage))}</strong></p></div>`}).join('')}</div>`}
function marketFacts(){const drawing=game.phase==='drawing'?game.drawKind:null;return `<div class="market-facts" role="group" aria-label="確定した抽選情報">${game.direction&&drawing!=='direction'?`<span class="chip ${game.direction==='up'?'positive':'negative'}" data-market-fact="direction">${game.direction==='up'?'＋ 上昇':'− 下落'}</span>`:''}${game.first&&drawing!=='first'?`<span class="chip" data-market-fact="first" aria-label="第1サイコロの出目${game.first}">第1 ${game.first}</span>`:''}${game.second&&drawing!=='second'?`<span class="chip" data-market-fact="second" aria-label="急変判定の出目${game.second}">急変 ${game.second}</span>`:''}</div>`}
function observerButtons(label,name,disabled=false){return `<div class="observer-buttons"><button type="button" class="secondary" data-action="fast-forward">最後まで早送り</button><button type="button" class="primary" data-action="${name}" ${disabled?'disabled':''}>${label}</button></div>`}
function marketAction(label,name,disabled=false){return `<div class="turn-actions"><p class="error" id="form-error" role="alert"></p>${isSpectating(game)?observerButtons(label.replace('アプリで',''),name,disabled):`<button type="button" class="primary" data-action="${name}" ${disabled?'disabled':''}>${label}</button>`}</div>`}
function marketBanner(main,detail,{tone='',pulse=false,animate=false,gap=false}={}){
 const model=marketCandleModel(game),elapsed=shockAnimation?.target===game?performance.now()-shockAnimation.startedAt:0;
 return `<div class="market-banner market-candle-banner ${gap?'gap':''}" aria-live="polite">${marketCandleSvg(model,{animate,elapsed})}<div class="candle-summary"><div class="big ${tone}${pulse?' draw-pulse':''}">${main}</div><p class="${gap?'gap-text':''}">${detail}</p></div></div>`;
}
function marketView(){
 const phase=game.phase;
 if(phase==='orders-revealed')return `<div class="orders-open"><div class="orders-heading"><h1>全員の注文</h1><span>${activePlayers(game).length}人分を公開</span></div>${orderList()}${game.mode==='auto'?marketAction('アプリで相場方向を抽選','draw-direction'):`<p class="orders-manual-note">鉛筆を転がして、相場方向を選んでください。</p><div class="turn-actions orders-direction-actions"><p class="error" id="form-error" role="alert"></p><div class="choice-grid" role="group" aria-label="実物の鉛筆で決めた相場方向"><button type="button" data-direction="up"><strong class="buy">＋ 上昇</strong></button><button type="button" data-direction="down"><strong class="sell">− 下落</strong></button></div></div>`}</div>`;
 if(phase==='drawing'){const direction=game.drawKind==='direction',shock=game.drawKind==='second';return `<div class="market-result market-draw"><h1>${direction?'相場方向を抽選中…':shock?'急変判定を抽選中…':'値動きを抽選中…'}</h1>${marketFacts()}${marketBanner(shock?'判定中…':direction?'＋ / −':'1〜6',shock?'値動きを表示中':direction?'上昇／下落は50:50':'値動きを決めるサイコロ',{tone:shock?'candle-pending':'',pulse:!shock,animate:shock})}${marketAction('抽選中…','drawing',true)}</div>`}
 if(phase==='direction-result')return `<div class="market-result market-draw"><h1>相場方向が確定</h1>${marketBanner(game.direction==='up'?'＋ 上昇':'− 下落',`${game.direction==='up'?'買い':'売り'}が的中`,{tone:game.direction==='up'?'positive':'negative'})}<p class="muted market-note">変動率は、まだ決まっていません。</p>${marketAction('アプリで値動きを抽選','draw-movement')}</div>`;
 if(phase==='movement-result'){
   const pending=game.first===6&&!game.second,m=pending?null:market(game.first,game.second,game.stage);
   return `<div class="market-result market-draw"><h1>${pending?'6が出た。急変判定':'変動率が確定'}</h1>${marketFacts()}${marketBanner(pending?'6':`${game.direction==='up'?'＋':'−'}${m.bps/100}%`,pending?'変動率は急変判定で決まります':m.gap?'ギャップ相場':'通常相場',{tone:pending?'':game.direction==='up'?'positive':'negative',gap:!!m?.gap})}<p class="muted market-note">${pending?'次の出目が1〜3なら通常相場、4〜6ならギャップ相場。':m.gap?'損失が資産を超えると、負債が発生します。':'通常相場では、0円でロスカット。'}</p>${marketAction(pending?'アプリで急変判定を抽選':'精算して結果を見る',pending?'draw-shock':'settle-market')}</div>`;
 }
 const shock=phase==='shock';return `<div class="market-result market-draw market-manual"><h1>${shock?'急変判定の出目を入力':'第1サイコロの出目を入力'}</h1>${marketFacts()}<p class="manual-dice-instruction">実物の${shock?'第2':'第1'}サイコロを振り、出目を選んでください。</p>${diceFaces(shock)}<p class="market-note">${shock?'1〜3は通常相場、4〜6はギャップ相場。':'6が出た場合だけ、急変判定へ進みます。'}</p></div>`;
}
function resultMarket(h,data=game){
 const series=marketSeries(data.history.filter(entry=>entry.round<=h.round));
 return `<div class="result-market-row"><div class="result-market-info"><span class="chip ${h.direction==='up'?'positive':'negative'}">${h.direction==='up'?'＋':'−'} <span class="market-direction-word">${h.direction==='up'?'上昇':'下落'} </span>${h.bps/100}%</span><span class="chip ${h.gap?'gap-text':''}">${h.gap?'ギャップ':'通常'}<span class="market-type-word">相場</span></span></div><button type="button" class="market-mini-chart" data-action="chart-open" aria-label="共通相場の履歴を拡大" aria-haspopup="dialog" aria-controls="market-chart" title="タップして相場の履歴を拡大">${candlesSvg(series)}</button></div>`;
}
function roundDice(h){return `<p class="settlement-dice">出目 ${h.first}${h.second?' / '+h.second:''}</p>`}
let chartSnapshot=[];
const chartDialog=document.querySelector('#market-chart'),chartCanvas=document.querySelector('#chart-canvas');
function renderChartCanvas(){if(chartDialog.open)chartCanvas.innerHTML=candlesSvg(chartSnapshot,{width:Math.max(220,Math.round(chartCanvas.clientWidth)),height:200,detailed:true})}
new ResizeObserver(renderChartCanvas).observe(chartCanvas);
function showChart(){
 const data=screen==='match'?matchPage.data:game?.finalRecord??game;if(!data?.history.length)return;
 chartSnapshot=marketSeries(data.history);
 document.querySelector('#chart-current').textContent=`開始 100.00 → 現在 ${indexDisplay(chartSnapshot.at(-1).close)}`;
 document.querySelector('#chart-rows').innerHTML=chartSnapshot.map(c=>`<tr><td>R${String(c.round).padStart(2,'0')}</td><td class="${c.direction==='up'?'positive':'negative'}">${c.direction==='up'?'＋':'−'}${c.bps/100}%${c.gap?' <span class="gap-text">ギャップ</span>':''}</td><td>${indexDisplay(c.open)}</td><td>${indexDisplay(c.close)}</td><td>${c.first}${c.second?' / '+c.second:''}</td></tr>`).join('');
 chartDialog.showModal();renderChartCanvas();
}

function batchChoices(p){const choice=game.decisions[p.id];return `<div class="batch-choices" role="group" aria-label="${escape(p.name)}の進退">${[['continue','続行'],['fix','資産確定']].map(([value,label])=>`<button type="button" class="secondary ${choice===value?'selected':''}" data-player="${p.id}" data-decision="${value}" aria-pressed="${choice===value}">${label}</button>`).join('')}</div>`}
function resultCards(h,withChoices=false,data=game){return h.results.map(r=>{const p=data.players.find(p=>p.id===r.id);return `<div class="result-card"><div class="order-line"><strong>${escape(p.name)}</strong><span class="status ${p.status}">${withChoices&&p.status==='active'?'取引中':labels[p.status]}</span></div><small>${r.side==='buy'?'買い':'売り'} ${r.leverage}倍 · 取引額 ${money(r.position)}</small><div class="results-money"><strong class="${BigInt(r.after)<0n?'negative':''}">${money(r.after)}</strong><span class="${BigInt(r.pnl)>=0n?'positive':'negative'}">${BigInt(r.pnl)>0n?'＋':''}${money(r.pnl)}</span></div><small>${money(r.before)} → ${money(r.after)}</small>${isSolo(data)&&h.cpuQuotes?.[p.id]?`<p class="cpu-result-quote">「${escape(h.cpuQuotes[p.id])}」</p>`:''}${withChoices&&p.status==='active'?batchChoices(p):''}</div>`}).join('')}
function batchResults(h){return standings(game.players).map(entry=>{const p=entry.player,r=h.results.find(r=>r.id===p.id);return `<div class="batch-result" data-result-player="${p.id}"><div class="batch-player"><strong>${standingBadge(entry)} <span class="standing-name">${escape(p.name)}</span></strong><div class="batch-money"><strong class="${BigInt(p.wealth)<0n?'negative':''}" data-result-wealth="${p.id}">${money(p.wealth)}</strong>${r?`<span class="${BigInt(r.pnl)>=0n?'positive':'negative'}" data-result-pnl="${p.id}">${BigInt(r.pnl)>0n?'＋':''}${money(r.pnl)}</span>`:''}</div></div>${p.status==='active'?batchChoices(p):`<span class="status ${p.status}">${labels[p.status]}</span>`}</div>`}).join('')}
function resultView(){const h=game.history.at(-1),active=activePlayers(game),recorded=active.filter(p=>['continue','fix'].includes(game.decisions[p.id])).length;return `<div class="settlement-view"><div class="settlement-heading"><h1>精算と進退</h1>${action('全員続行で記録','all-continue','secondary')}</div>${resultMarket(h)}<p class="batch-instruction">「せーの」で同時に宣言して、記録。</p><div class="batch-list">${batchResults(h)}</div><p class="batch-note">資産確定すると、取引には戻れません。</p><details class="settlement-details"><summary>今回の注文・計算の詳細</summary>${roundDice(h)}${resultCards(h)}</details><div class="turn-actions">${game.players.length>4?'<p class="result-scroll-hint" data-result-scroll-hint></p>':''}<p class="error" id="form-error" role="alert"></p><button type="button" class="primary" data-action="commit-decisions" aria-live="polite" ${recorded===active.length?'':'disabled'}>全員の進退を確定（${recorded} / ${active.length}人）</button></div></div>`}
function soloResultView(){
 const h=game.history.at(-1),human=humanPlayer(game),r=h.results.find(r=>r.id===human.id),observing=human.status!=='active',ranked=standings(game.players),humanRank=ranked.find(e=>e.player.id===human.id);
 return `<div class="settlement-view solo-settlement"><h1>${observing?'観戦中の精算結果':'精算結果'}</h1>${resultMarket(h)}<div class="solo-human-result"><span>${standingBadge(humanRank)} ${escape(human.name)} · ${human.status==='active'?'取引中':labels[human.status]}</span><strong class="${BigInt(human.wealth)<0n?'negative':''}" data-result-wealth="${human.id}">${money(human.wealth)}</strong>${r?`<span class="${BigInt(r.pnl)>=0n?'positive':'negative'}" data-result-pnl="${human.id}">今回 ${BigInt(r.pnl)>0n?'＋':''}${money(r.pnl)}</span>`:''}</div><div class="solo-results">${ranked.filter(entry=>entry.player.cpu).map(entry=>{const p=entry.player,trade=h.results.find(result=>result.id===p.id);return `<div class="solo-cpu-result" data-result-player="${p.id}"><div><strong>${standingBadge(entry)} ${escape(p.name)}</strong><span class="solo-cpu-money"><strong class="${BigInt(p.wealth)<0n?'negative':''}" data-result-wealth="${p.id}">${money(p.wealth)}</strong>${trade?`<small class="${BigInt(trade.pnl)>=0n?'positive':'negative'}" data-result-pnl="${p.id}">今回 ${BigInt(trade.pnl)>0n?'＋':''}${money(trade.pnl)}</small>`:''}</span></div><p>${p.status==='active'?(observing?(game.cpuDecisions[p.id]==='fix'?'資産確定を選択':'続行を選択'):'取引中'):labels[p.status]}${p.quote?` · 「${escape(p.quote)}」`:''}</p></div>`}).join('')}</div><p class="batch-note">${observing?(human.status==='fixed'?'確定した資産で、最後の順位を待ちます。':'自分は退場。CPUの最終結果まで観戦できます。'):'資産確定すると、取引には戻れません。'}</p><details class="settlement-details"><summary>今回の注文・計算の詳細</summary>${roundDice(h)}${resultCards(h)}</details><div class="turn-actions solo-actions"><p class="error" id="form-error" role="alert"></p>${observing?observerButtons(activePlayers(game).every(p=>game.cpuDecisions[p.id]==='fix')?'最終結果を見る':'次の相場へ','observe-next'):'<div class="solo-decision-buttons"><button class="secondary" data-action="solo-fix">資産確定して観戦</button><button class="primary" data-action="solo-continue">続けて次へ</button></div>'}</div></div>`;
}

function history(data=game){return `<details class="history"><summary>ラウンドの記録（${data.history.length}回）</summary>${data.history.map(h=>`<div class="history-item"><strong>R${h.round} · ${h.direction==='up'?'＋':'−'}${h.bps/100}% · ${h.gap?'ギャップ':'通常'} · 出目 ${h.first}${h.second?` / ${h.second}`:''}</strong>${h.results.map(r=>`<p>${escape(data.players.find(p=>p.id===r.id).name)}：${r.side==='buy'?'買い':'売り'} ${r.leverage}倍 · ${money(r.before)} → ${money(r.after)}${h.cpuQuotes?.[r.id]?` · 「${escape(h.cpuQuotes[r.id])}」`:''}</p>`).join('')}</div>`).join('')}</details>`}
function ending(){const data=game.finalRecord,ws=data.players.filter(p=>data.winnerIds.includes(p.id)),ranked=standings(data.players);return `<section class="surface end-surface"><p class="eyebrow">FINAL RESULTS / ${data.endedRound} ROUNDS</p>${stageBadge(data.stage)}${decisionSummary(data)}<h1>最後に、いくら残せた？</h1><div class="ending"><p>${isSolo(data)?(ws.some(p=>!p.cpu)?(ws.length>1?'あなたの同率勝利':'あなたの勝利'):ws.length?(ws.length>1?'CPUの同率勝利':'今回はCPUの勝利'):'勝者なし'):ws.length>1?'同率勝利':ws.length?'WINNER':'NO WINNER'}${isSolo(data)?`<span class="personal-best-badge" data-personal-best-badge>${personalBestBadge()}</span>`:''}</p><h2>${ws.length?ws.map(p=>escape(p.name)).join('・'):'勝者なし'}</h2><p>${ws.length?`最終資産 ${money(ws[0].wealth)}`:'正の資産を残したプレイヤーはいません。'}</p></div><section class="final-standings" aria-label="最終順位"><h3>最終順位</h3>${ranked.map(entry=>{const p=entry.player;return `<div class="final-standing" data-final-player="${p.id}">${standingBadge(entry)}<div class="final-standing-player"><strong>${playerName(p)}</strong><span class="status ${p.status}">${labels[p.status]}</span></div><strong class="${BigInt(p.wealth)<0n?'negative':''}">${money(p.wealth)}</strong></div>`}).join('')}</section><p class="muted">最高到達資産も、最大取引額も、全員の記録に残ります。</p>${recordStatus()}<div data-personal-bests role="status" aria-live="polite">${personalBestNotice()}</div>${fastForwardDigest(data)}<div class="table-wrap"><table><thead><tr><th>プレイヤー</th><th>初期資産</th><th>最高到達資産</th><th>最大取引額</th><th>最終資産</th></tr></thead><tbody>${ranked.map(({player:p})=>`<tr><td><strong>${escape(p.name)}</strong><small>${labels[p.status]}</small></td><td>${money(p.initial)}</td><td>${money(p.peak)}</td><td>${money(p.maxPosition)}</td><td class="${BigInt(p.wealth)<0n?'negative':ws.some(w=>w.id===p.id)?'positive':''}"><strong>${money(p.wealth)}</strong>${isSolo(data)?`<small>最高から ${money(BigInt(p.peak)-BigInt(p.wealth))} 減少</small>`:''}</td></tr>`).join('')}</tbody></table></div>${data.history.length?`<section class="last-settlement"><h3>第${data.history.at(-1).round}ラウンドの精算</h3>${resultMarket(data.history.at(-1),data)}${resultCards(data.history.at(-1),false,data)}</section>`:''}${history(data)}<div class="ending-actions">${action('同じ設定で再戦','replay','primary full')}${action('設定を変えて遊ぶ','reset','secondary full')}<a href="#stats" class="secondary stats-link">戦績を見る</a></div></section>`}
function render(){
 if(screen==='legends'){document.body.dataset.phase='statistics';document.body.classList.remove('playing','has-turn-actions');dockObserver.disconnect();document.querySelector('footer').firstChild.textContent='保存した試合の出来事 ';root.innerHTML=legendsView({...legendsPage,scope:legendScope,event:legendEvent,hasGame:!!game,pendingCount:recordStore.pendingCount()});return}
 if(screen==='modes'){document.body.dataset.phase='statistics';document.body.classList.remove('playing','has-turn-actions');dockObserver.disconnect();document.querySelector('footer').firstChild.textContent='ステージごとの戦績を比較 ';root.innerHTML=modesView({...modesPage,hasGame:!!game,pendingCount:recordStore.pendingCount()});return}
 if(screen==='trips'){document.body.dataset.phase='statistics';document.body.classList.remove('playing','has-turn-actions');dockObserver.disconnect();document.querySelector('footer').firstChild.textContent='期間を決めて戦績を計測 ';root.innerHTML=tripsView({...tripsPage,hasGame:!!game,pendingCount:recordStore.pendingCount(),busy:tripMutation.busy,mutationError:tripMutation.error,retryable:!!tripMutation.operation,notice:tripMutation.notice,drafts:tripDrafts});return}
 if(screen==='stats'){document.body.dataset.phase='statistics';document.body.classList.remove('playing','has-turn-actions');dockObserver.disconnect();document.querySelector('footer').firstChild.textContent='保存したゲームの戦績 ';root.innerHTML=statisticsView({...statistics,pendingCount:recordStore.pendingCount(),hasGame:!!game});return}
 if(screen==='records'||screen==='match'){document.body.dataset.phase='statistics';document.body.classList.remove('playing','has-turn-actions');dockObserver.disconnect();document.querySelector('footer').firstChild.textContent='保存したゲームの記録 ';root.innerHTML=screen==='records'?recordsView({...recordsPage,scope:recordsScope,pendingCount:recordStore.pendingCount(),hasGame:!!game}):matchView({...matchPage,hasGame:!!game,from:matchFrom});return}
 document.body.dataset.phase=game?.phase??'setup';
 document.body.classList.toggle('solo-game',isSolo(game));
 document.querySelector('footer').firstChild.textContent=isSolo(game)?'あなた + CPU3人で対戦 ':setupPlay==='solo'&&!game?'1人でCPUと対戦 ':'1台を受け渡してプレイ ';
 document.body.classList.toggle('playing',!!game&&game.phase!=='end');
 document.body.classList.toggle('has-turn-actions',['order','orders-revealed','results'].includes(game?.phase)||game?.mode==='auto'&&['direction-result','movement-result','drawing'].includes(game?.phase));
 if(!game){root.innerHTML=pendingStatus()+setup();if(storageError)root.insertAdjacentHTML('afterbegin','<p class="storage-warning">このブラウザでは途中保存が使えません。プレイ中はページを閉じないでください。</p>');if(setupPlay==='solo'&&cpuCareers.state==='idle')void loadCpuCareers();return}
 let content='';switch(game.phase){case'order':content=order();break;case'orders-revealed':case'direction-result':case'movement-result':case'dice':case'shock':case'drawing':content=marketView();break;case'results':content=isSolo(game)?soloResultView():resultView();break;case'end':root.innerHTML=`<div class="game-layout">${ending()}</div>`;void ensurePersonalBests();return;default:game=null;update();return}
 root.innerHTML=`${storageError?'<p class="storage-warning">途中保存が使えません。プレイ中はページを閉じないでください。</p>':''}<div class="game-layout"><section class="surface play-surface"><div class="round-top"><strong>R${String(game.round).padStart(2,'0')} <span class="muted">/ 12</span></strong><span class="round-stage" data-stage-active="${activeStage().id}">${activeStage().name}</span></div><div class="round-track" aria-hidden="true">${Array.from({length:12},(_,i)=>`<span class="${i+1<game.round?'done':i+1===game.round?'current':''}"></span>`).join('')}</div>${content}</section>${publicBoard()}</div>`;
 observeActionDock();
}
function setLeverage(value){draftLeverage=value;const valid=Number.isInteger(value)&&value>=1&&value<=100;document.querySelector('#position-value').textContent=valid?money(BigInt(current().wealth)*BigInt(value)):'1〜100の整数を入力';const preview=document.querySelector('#impact-open');preview.textContent=impactSummary();preview.disabled=!valid;document.querySelector('#order-submit').disabled=!draftSide||!valid;const range=document.querySelector('#leverage-range');if(valid)range.value=String(value)}
function recordDirection(direction){if(game.phase!=='orders-revealed'||game.mode!=='manual')throw Error('相場方向は確定済みです');game.direction=direction;game.phase='dice';update()}
function recordFace(n){if(game.mode!=='manual')throw Error('実物入力モードではありません');if(game.phase==='dice'){game.first=n;game.phase=n===6?'shock':'market-ready'}else if(game.phase==='shock'){game.second=n;game.phase='market-ready'}else throw Error('出目は確定済みです');if(game.phase==='market-ready')resolveRound(game);update()}
async function drawMarket(kind){
 const target=game;prepareAutoDraw(target,kind);
 if(kind==='second')shockAnimation={target,startedAt:performance.now()};
 update();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 await new Promise(r=>setTimeout(r,reduced?0:kind==='second'?SHOCK_DRAW_MS:kind==='direction'?450:550));
 if(game!==target||target.phase!=='drawing'||target.drawKind!==kind){if(shockAnimation?.target===target)shockAnimation=null;return}
 finishAutoDraw(target);if(shockAnimation?.target===target)shockAnimation=null;update();
}
function drawWithFeedback(kind){void drawMarket(kind).catch(err=>{const error=document.querySelector('#form-error');if(error)error.textContent=err.message;else console.error(err)})}

root.addEventListener('input',e=>{const el=e.target;if(el.dataset.tripName)tripDrafts[el.dataset.tripName]=el.value;if(el.dataset.name!==undefined)setupNames[Number(el.dataset.name)]=el.value;if(el.id==='solo-name')soloName=el.value;if(el.id==='leverage')setLeverage(Number(el.value));if(el.id==='leverage-range'){document.querySelector('#leverage').value=el.value;setLeverage(Number(el.value))}});
root.addEventListener('toggle',e=>{const mode=e.target.dataset.setupNames;if(mode==='tabletop'||mode==='solo')setupNameEditors[mode]=e.target.open},true);
root.addEventListener('invalid',e=>{if(e.target.matches('[data-name],#solo-name'))revealSetupName(e.target)},true);
root.addEventListener('submit',e=>{e.preventDefault();try{if(e.target.dataset.tripForm){if(tripMutation.busy||tripsPage.state!=='ready')return;const id=e.target.dataset.tripForm;void submitTripChange(newTripChange(id,'rename',{name:tripDrafts[id]??e.target.querySelector('input').value}));return}if(e.target.id==='setup-form'){game=setupPlay==='solo'?createSoloGame(soloName,setupStage):createGame(setupNames.slice(0,setupCount),setupMode,setupStage);ensureGameIdentity(game,{newGame:true});document.activeElement?.blur();update()}if(e.target.id==='order-form'){(isSolo(game)?submitSoloOrder:submitOrder)(game,{side:draftSide,leverage:Number(document.querySelector('#leverage').value)});draftSide=null;draftLeverage=1;document.activeElement?.blur();update()}}catch(err){document.querySelector('#form-error').textContent=err.message;if(e.target.id==='setup-form'){const blank=[...e.target.querySelectorAll('[data-name],#solo-name')].find(input=>!input.value.trim());if(blank){revealSetupName(blank);blank.focus()}}}});
root.addEventListener('change',e=>{if(e.target.matches('[data-legend-filter]'))location.hash=`#legends/${legendScope}/${e.target.value}`});
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;try{
 if(b.dataset.play&&!game){setupPlay=b.dataset.play;render();return}
 if(b.dataset.count){setupCount=Number(b.dataset.count);render();return}
 if(b.dataset.mode){setupMode=b.dataset.mode;render();return}
 if(b.dataset.stage&&!game){getStage(b.dataset.stage);setupStage=b.dataset.stage;render();return}
 if(b.dataset.side){draftSide=b.dataset.side;root.querySelectorAll('[data-side]').forEach(button=>{const selected=button.dataset.side===draftSide;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected))});setLeverage(draftLeverage);return}
 if(b.dataset.adjust){const input=document.querySelector('#leverage'),v=Number(input.value);input.value=String(Math.max(1,Math.min(100,(Number.isFinite(v)?Math.round(v):1)+Number(b.dataset.adjust))));setLeverage(Number(input.value));return}
 if(b.dataset.decision&&b.dataset.player!==undefined){const id=Number(b.dataset.player),player=game?.players.find(p=>p.id===id);if(isSolo(game)||game?.phase!=='results'||player?.status!=='active'||!['continue','fix'].includes(b.dataset.decision))return;game.decisions[id]=b.dataset.decision;update(false);document.querySelector(`[data-player="${id}"][data-decision="${b.dataset.decision}"]`)?.focus({preventScroll:true});return}
 if(b.dataset.direction){recordDirection(b.dataset.direction);return}
 if(b.dataset.face){recordFace(Number(b.dataset.face));return}
 switch(b.dataset.action){
 case'reset':document.querySelector('#reset-dialog p').textContent=game?.phase==='end'?'試合記録を残して、参加者設定に戻ります。':'このゲームを中断して、参加者設定に戻ります。未完了の試合は戦績に残りません。';document.querySelector('#reset-dialog').showModal();return;
 case'retry-record':void recordStore.retry(game.finalRecord.id);return;
 case'retry-records':void recordStore.retryAll();return;
 case'reload-legends':void loadLegends();return;
 case'more-legends':if(legendsPage.data?.nextCursor)void loadLegends(legendsPage.data.nextCursor);return;
 case'reload-modes':void loadModes();return;
 case'reload-trips':tripMutation.error='';tripMutation.operation=null;tripMutation.notice='';void loadTrips();return;
 case'trip-reset':openTripReset(b.dataset.meter);return;
 case'retry-trip':if(tripMutation.operation)void submitTripChange(tripMutation.operation);return;
 case'reload-statistics':void loadStatistics();return;
 case'retry-cpu-careers':void loadCpuCareers();return;
 case'retry-personal-bests':void ensurePersonalBests(true);return;
 case'reload-records':void loadRecords();return;
 case'reload-match':void loadMatch();return;
 case'chart-open':showChart();return;
 case'impact-open':showImpact();return;
 case'previous-leverage':{if(game?.phase!=='order')return;const value=previousSoloLeverage(game);if(value===null)return;document.querySelector('#leverage').value=String(value);setLeverage(value);return;}
 case'replay':{if(game?.phase!=='end'||!game.finalRecord)return;prepareRecord();const next=replayGame(game.finalRecord);ensureGameIdentity(next,{newGame:true});game=next;draftSide=null;draftLeverage=1;break;}
 case'draw-direction':drawWithFeedback('direction');return;
 case'draw-movement':drawWithFeedback('first');return;
 case'draw-shock':drawWithFeedback('second');return;
 case'settle-market':(isSolo(game)?resolveSoloRound:resolveRound)(game);break;
 case'solo-continue':commitSoloDecision(game,'continue');draftSide=null;draftLeverage=1;break;
 case'solo-fix':commitSoloDecision(game,'fix');draftSide=null;draftLeverage=1;break;
 case'observe-next':commitSoloDecision(game);break;
 case'fast-forward':{const finished=JSON.parse(JSON.stringify(game));finished.fastForwardFromRound=game.round+(game.phase==='results'?1:0);fastForwardSolo(finished);game=finished;break;}
 case'all-continue':if(isSolo(game)||game?.phase!=='results')return;game.decisions=Object.fromEntries(activePlayers(game).map(p=>[p.id,'continue']));update(false);document.querySelector('[data-action="all-continue"]')?.focus({preventScroll:true});return;
 case'commit-decisions':if(isSolo(game))return;commitDecisions(game);draftSide=null;draftLeverage=1;break;
 default:return;
 }update();
 }catch(err){const error=document.querySelector('#form-error');if(error)error.textContent=err.message;else console.error(err)}});
document.querySelector('#chart-close').onclick=()=>chartDialog.close();
document.querySelector('#impact-close').onclick=()=>document.querySelector('#impact-dialog').close();
document.querySelector('#rules-open').onclick=showRules;
document.querySelector('#rules-close').onclick=()=>document.querySelector('#rules').close();
document.querySelector('#reset-cancel').onclick=()=>document.querySelector('#reset-dialog').close();
document.querySelector('#reset-confirm').onclick=()=>{document.querySelector('#reset-dialog').close();game=null;draftSide=null;update()};
function clearDrafts(){draftSide=null;draftLeverage=1;if(game?.phase==='order')update(false)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearDrafts()});
window.addEventListener('pageshow',e=>{if(e.persisted)clearDrafts()});
function publicState(){if(!game)return {phase:'setup'};return {phase:game.phase,round:game.round,playMode:game.playMode??'tabletop',stage:game.stage??'classic',stageName:activeStage().name,players:game.players.map(p=>({...p,wealthDisplay:money(p.wealth)})),pendingOrders:Object.keys(game.orders).length,pendingDecisions:Object.keys(game.decisions).length};}
const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();const register=t=>{try{Promise.resolve(context.registerTool(t,{signal:lifecycle.signal})).catch(()=>{})}catch{}};
 register({name:'read_public_game_state',description:'Read public player balances, statuses and round. Secret choices are never returned.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('No arguments accepted');return publicState()}});
 register({name:'start_fx_survival_game',description:'Start a new 2–6 player game from the setup screen only. Does not enter or submit secret player choices.',inputSchema:{type:'object',properties:{names:{type:'array',minItems:2,maxItems:6,items:{type:'string',minLength:1,maxLength:20}},mode:{type:'string',enum:['auto','manual']},stage:{type:'string',enum:Object.keys(STAGES)}},required:['names'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(game)throw Error('A game is already in progress');if(!input||Object.keys(input).some(k=>!['names','mode','stage'].includes(k))||!Array.isArray(input.names)||input.names.some(n=>typeof n!=='string'||n.length>20)||input.mode&&!['auto','manual'].includes(input.mode))throw Error('Invalid setup');game=createGame(input.names,input.mode||'auto',input.stage??'classic');ensureGameIdentity(game,{newGame:true});update();return publicState()}});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
prepareRecord();save();render();void recordStore.retryAll();if(screen==='stats')void loadStatistics();if(screen==='records')void loadRecords();if(screen==='match')void loadMatch();if(screen==='trips')void loadTrips();if(screen==='modes')void loadModes();if(screen==='legends')void loadLegends();
