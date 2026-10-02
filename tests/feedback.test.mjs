import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {aggregateFeedback} from '../server/feedback.js';
import {aggregateLifetime} from '../server/statistics.js';
import {readStatistics} from '../server/database.js';
import {statisticsRequest} from '../server/api.js';
import {feedbackView} from '../dist/feedback-view.js';
import {statisticsView} from '../dist/stats-view.js';

function record(id,trades,options={}){
 const initial=options.initial??'1000',wealth=trades.at(-1)?.after??initial;
 const peak=String(trades.reduce((n,t)=>BigInt(t.after)>n?BigInt(t.after):n,BigInt(initial)));
 return {schemaVersion:1,id,endedAt:'2026-10-02T15:00:00.000Z',stage:{id:'classic',name:'クラシック'},playMode:'solo',ownerPlayerId:0,winnerIds:options.winnerIds??[0],maxRounds:12,endedRound:trades.length,players:[{id:0,name:options.name??'あなた',kind:'human',cpu:null,initial,wealth,peak,maxPosition:'100000',status:options.status??'fixed'},{id:1,name:'CPU',kind:'cpu',cpu:'gambler',initial,wealth:'999999999999999999',peak:'999999999999999999',maxPosition:'999999999999999999',status:'fixed'}],history:trades.map((t,i)=>({round:i+1,results:[{id:0,before:i?trades[i-1].after:initial,pnl:String(BigInt(t.after)-BigInt(i?trades[i-1].after:initial)),...t},{id:1,before:initial,after:'999999999999999999',pnl:'999999999999998999',leverage:100}]})),...options.record};
}
const band=(data,id)=>data.rounds.find(b=>b.id===id);
function fixtures(){return [
 record('mixed',[{leverage:100,after:'2000'},{leverage:50,after:'500'}],{winnerIds:[1]}),
 record('debt',[{leverage:100,after:'-4000'}],{status:'debt',winnerIds:[1]}),
 record('low',[{leverage:25,after:'1125'},{leverage:26,after:'1255'},{leverage:49,after:'1500'}]),
 record('zero',[{leverage:99,after:'10'},{leverage:95,after:'1'},{leverage:100,after:'1'}],{name:'変更後',winnerIds:[1]}),
 record('table',[{leverage:100,after:'999999999999999999'}],{record:{ownerPlayerId:null,playMode:'tabletop'}})
]}
test('owner-only feedback distinguishes trade PnL from whole-game PnL and sums to lifetime including gap debt',()=>{
 const rows=fixtures(),before=JSON.stringify(rows),s=aggregateFeedback(rows),l=aggregateLifetime(rows).lifetime;
 assert.deepEqual(band(s,'hundred'),{id:'hundred',min:100,max:100,trades:3,profitable:1,losses:1,unchanged:1,pnlTotal:'-4000',averagePnl:'-1333'});
 assert.equal(s.games.used100.plays,3);assert.equal(s.games.used100.pnlTotal,'-6499');assert.equal(s.games.used100.debtExits,1);assert.equal(s.games.used100.wins,0);assert.equal(s.games.no100.plays,1);assert.equal(s.games.no100.pnlTotal,'500');
 assert.equal(s.rounds.reduce((n,b)=>n+BigInt(b.pnlTotal),0n),BigInt(l.pnlTotal));assert.equal(BigInt(s.games.used100.pnlTotal)+BigInt(s.games.no100.pnlTotal),BigInt(l.pnlTotal));assert.equal(s.games.used100.plays+s.games.no100.plays,l.plays);assert.equal(band(s,'hundred').trades,l.uses100);assert.equal(JSON.stringify(rows),before);
});
test('leverage bands include the 25/26,49/50,99/100 boundaries once each and count gains, losses and unchanged balances separately',()=>{
 const r=record('edges',[{leverage:1,after:'1000'},{leverage:25,after:'1100'},{leverage:26,after:'1000'},{leverage:49,after:'1000'},{leverage:50,after:'1200'},{leverage:99,after:'900'},{leverage:100,after:'1000'}]),s=aggregateFeedback([r]);
 assert.deepEqual(s.rounds.map(b=>[b.trades,b.profitable,b.losses,b.unchanged,b.pnlTotal]),[[2,1,0,1,'100'],[2,0,1,1,'-100'],[2,1,1,0,'-100'],[1,1,0,0,'100']]);assert(s.rounds.every(b=>b.profitable+b.losses+b.unchanged===b.trades));
});
test('empty histories and unused groups have no invented averages/bests; all-debt games keep negative highest results',()=>{
 const empty=aggregateFeedback([]);for(const b of empty.rounds){assert.equal(b.trades,0);assert.equal(b.pnlTotal,'0');assert.equal(b.averagePnl,null)}for(const g of Object.values(empty.games)){assert.equal(g.plays,0);assert.equal(g.averagePnl,null);assert.equal(g.highestFinal,null)}
 const debt=aggregateFeedback([record('d',[{leverage:100,after:'-1'}],{status:'debt',winnerIds:[]})]);assert.equal(debt.games.used100.highestFinal,'-1');assert.equal(debt.games.no100.highestFinal,null);assert.equal(band(debt,'hundred').losses,1);
});
test('archived round gains, not directional hits or overall wins, determine outcomes, including zero from rounding and normal cuts',()=>{
 const r=record('rounding',[{leverage:100,after:'1000',win:true},{leverage:100,after:'0',win:false}],{status:'cut',winnerIds:[]}),s=aggregateFeedback([r]);assert.equal(band(s,'hundred').profitable,0);assert.equal(band(s,'hundred').losses,1);assert.equal(band(s,'hundred').unchanged,1);assert.equal(s.games.used100.fundsDepleted,1);
});
test('game comparison shows both zero exits and debt using the existing owner-only lifetime counts',()=>{
 const rows=[record('cut',[{leverage:100,after:'0'}],{status:'cut',winnerIds:[1]}),record('empty',[{leverage:100,after:'0'}],{status:'empty',winnerIds:[1]}),record('debt',[{leverage:100,after:'-1000'}],{status:'debt',winnerIds:[1]}),record('low',[{leverage:25,after:'1125'}])];
 const data=aggregateFeedback(rows),html=feedbackView(data);
 assert.equal(data.games.used100.fundsDepleted,2);assert.equal(data.games.used100.debtExits,1);assert.equal(data.games.no100.fundsDepleted,0);
 assert(html.includes('0円退場（ロスカット含む）'));assert(html.includes('data-feedback-stat="fundsDepleted">2回'));assert(html.includes('data-feedback-stat="fundsDepleted">0回'));assert(html.includes('data-feedback-stat="debtExits">1回'));
});
test('whole-game groups count tied wins once and reuse lifetime rounding, preserving exact huge monetary values',()=>{
 const big='1234567890123456789012345',a=record('a',[{leverage:100,after:big}],{winnerIds:[0,1]}),b=record('b',[{leverage:100,after:String(BigInt(big)+1n)}]),s=aggregateFeedback([a,b]);assert.equal(s.games.used100.wins,2);assert.equal(band(s,'hundred').pnlTotal,String(BigInt(big)*2n+1n-2000n));assert.equal(band(s,'hundred').averagePnl,String(BigInt(big)-999n));assert.equal(s.games.used100.averagePnl,band(s,'hundred').averagePnl);
 const negative=aggregateFeedback([record('c',[{leverage:25,after:'999'}]),record('d',[{leverage:25,after:'998'}])]);assert.equal(band(negative,'oneTo25').averagePnl,'-2');assert.equal(negative.games.no100.averagePnl,'-2');
});
test('old missing metrics and retired stages use stored logs; CPU ownership, invalid leverage and unsupported versions fail visibly',()=>{
 const r=record('older',[{leverage:100,after:'1100'}],{record:{stage:{id:'retired',name:'旧設定'}}}),before=JSON.stringify(r),s=aggregateFeedback([r]);assert.equal(s.games.used100.uses100,1);assert.equal(band(s,'hundred').profitable,1);assert.equal(JSON.stringify(r),before);
 assert.throws(()=>aggregateFeedback([{...r,ownerPlayerId:1}]));assert.throws(()=>aggregateFeedback([{...r,schemaVersion:99}]));for(const leverage of [0,101,1.5])assert.throws(()=>aggregateFeedback([record('invalid',[{leverage,after:'1000'}])]));
});
function database(){
 const sqlite=new DatabaseSync(':memory:');for(const f of ['0000_dusty_wiccan.sql','0001_jazzy_kang.sql','0002_sparkling_invisible_woman.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const calls=[],db={sqlite,calls,prepare(sql){return {bind(...args){calls.push({sql,args});return {all:async()=>({success:true,results:sqlite.prepare(sql).all(...args)})}}}}};db.seed=(r,owner='owner')=>sqlite.prepare('INSERT INTO matches VALUES (?,?,?,?,?)').run(owner,r.id,r.schemaVersion,r.endedAt,JSON.stringify(r));return db;
}
test('one indexed scan covers all saved pages and isolates accounts without mutating game records or TRIP settings',async()=>{
 const db=database();for(let i=0;i<56;i++)db.seed(record('game-'+String(i).padStart(3,'0'),[{leverage:i%2?25:100,after:'1250'}]));db.seed(record('alien',[{leverage:100,after:'99999999999'}]),'other');const before=db.sqlite.prepare('SELECT * FROM matches ORDER BY owner_id,game_id').all(),s=await readStatistics(db,'owner');assert.equal(s.lifetime.plays,56);assert.equal(s.feedback.games.used100.plays,28);assert.equal(s.feedback.games.no100.plays,28);assert.equal(band(s.feedback,'hundred').pnlTotal,'7000');assert.equal(s.recentGames.length,10);assert.equal(db.calls.length,3);assert(db.calls.every(c=>c.args[0]==='owner'&&c.sql.startsWith('SELECT')));assert.deepEqual(db.sqlite.prepare('SELECT * FROM matches ORDER BY owner_id,game_id').all(),before);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,0);assert.equal((await readStatistics(db,'other')).feedback.games.used100.plays,1);
});
test('statistics API requires authentication, rejects writes and returns no partial feedback on corrupt archived logs',async()=>{
 const db=database(),headers={'oai-authenticated-user-id':'owner'},request=()=>new Request('https://game.test/api/statistics',{headers});assert.equal((await statisticsRequest(new Request('https://game.test/api/statistics'),{DB:db})).status,401);assert.equal((await statisticsRequest(new Request('https://game.test/api/statistics',{headers,method:'PUT'}),{DB:db})).status,405);const response=await statisticsRequest(request(),{DB:db});assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).feedback.version,1);
 db.seed(record('bad',[{leverage:999,after:'1000'}]));const previous=console.error;console.error=()=>{};try{const fail=await statisticsRequest(request(),{DB:db});assert.equal(fail.status,503);const body=await fail.json();assert.equal(body.feedback,undefined);assert.equal(body.lifetime,undefined)}finally{console.error=previous}
});
test('view puts a positive single-game best beside negative lifetime PnL, separates trades/games and offers no recommendations',()=>{
 const rows=fixtures(),data={...aggregateLifetime(rows),recentGames:[],feedback:aggregateFeedback(rows)},html=statisticsView({state:'ready',data});assert(html.includes('1ゲームの最高最終資産'));assert(html.includes('150.0万円'));assert(html.includes('−599.9万円'));assert.equal((html.match(/data-stat="highestFinal"/g)??[]).length,1);assert(html.includes('利益 1回 / 損失 1回'));assert(html.includes('増減なし 1回'));assert(html.includes('100倍以外の取引も含め'));assert(html.includes('100倍を使わなかったゲーム'));for(const b of data.feedback.rounds)assert(html.includes(`data-feedback-band="${b.id}"`));assert(!html.includes('危険です'));assert(!html.includes('おすすめ'));assert.equal(feedbackView(null),'');assert(!statisticsView({state:'error',error:'unavailable'}).includes('data-feedback'));
 const empty=feedbackView(aggregateFeedback([]));assert(empty.includes('0ゲーム'));assert(empty.includes('>—<'));
});
