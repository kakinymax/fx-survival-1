import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {LEGEND_KEYS,playerLegends} from '../dist/legends.js';
import {aggregateLegends,legendQuery,createLegendAccumulator} from '../server/legends.js';
import {readLegends} from '../server/database.js';
import {legendsRequest} from '../server/api.js';
import {legendsView} from '../dist/legend-view.js';
import {matchView} from '../dist/record-view.js';

function record(id,wealth='1250',options={}){
 const trades=options.trades??[{before:'1000',after:wealth,leverage:25}];
 const p={id:0,name:'あなた',kind:'human',cpu:null,initial:'1000',wealth,peak:options.peak??wealth,maxPosition:'25000',status:options.status??'fixed',...options.player};
 return {schemaVersion:1,id,endedAt:options.endedAt??'2026-10-02T14:00:00.000Z',stage:{id:'classic',name:'クラシック'},playMode:'solo',drawMode:'auto',ownerPlayerId:0,winnerIds:options.winnerIds??[0],maxRounds:12,endedRound:trades.length,history:trades.map((t,i)=>({round:i+1,results:[{id:0,pnl:String(BigInt(t.after)-BigInt(t.before)),...t}]})),players:[p],...options.record};
}
const events=r=>playerLegends(r,r.players[0]),keys=r=>events(r).map(e=>e.key);
test('comeback uses strictly less than half of initial capital followed by a positive win, including ties',()=>{
 const r=record('a','1500',{trades:[{before:'1000',after:'499',leverage:100},{before:'499',after:'1500',leverage:100}],winnerIds:[0,1]}),before=JSON.stringify(r);
 assert(keys(r).includes('comeback'));assert.deepEqual(events(r).find(e=>e.key==='comeback'),{key:'comeback',round:1,low:'499'});assert(keys(r).includes('hundredWin'));assert.equal(JSON.stringify(r),before);
 const exact=record('b','1500',{trades:[{before:'1000',after:'500',leverage:50},{before:'500',after:'1500',leverage:100}]});assert(!keys(exact).includes('comeback'));
 r.winnerIds=[];assert(!keys(r).includes('comeback'));r.winnerIds=[0];r.players[0].wealth='0';assert(!keys(r).includes('comeback'));
});
test('peak-collapse, hundred-million-yen threshold, and all-loss use exact archived money and distinguish debt from zero',()=>{
 assert(keys(record('a','0',{peak:'5000',status:'cut',winnerIds:[]})).includes('peakCollapse'));assert(!keys(record('b','0',{peak:'4999',status:'cut',winnerIds:[]})).includes('peakCollapse'));
 assert(keys(record('c','-1',{peak:'5000',status:'debt',winnerIds:[]})).includes('peakCollapse'));assert(!keys(record('d','1',{peak:'5000'})).includes('peakCollapse'));
 assert(keys(record('e','100000',{peak:'100000'})).includes('hundredMillion'));assert(keys(record('f','-100',{peak:'100000',status:'debt'})).includes('hundredMillion'));assert(!keys(record('g','99999',{peak:'99999'})).includes('hundredMillion'));
 assert(keys(record('h','0',{peak:'1000',status:'empty'})).includes('zero'));assert(!keys(record('i','-1',{peak:'1000',status:'debt'})).includes('zero'));assert(!keys(record('j','0',{peak:'999'})).includes('zero'));
});
test('one-hit triple includes exactly threefold and selects the first qualifying round using exact BigInt comparisons',()=>{
 const r=record('a','9000',{trades:[{before:'1000',after:'3000',leverage:100},{before:'3000',after:'9000',leverage:100}]});assert.deepEqual(events(r).find(e=>e.key==='triple'),{key:'triple',round:1,before:'1000',after:'3000'});
 assert(!keys(record('b','2999')).includes('triple'));assert(!keys(record('zero','9000',{trades:[{before:'0',after:'9000',leverage:100}]})).includes('triple'));
 const huge=record('big','300000000000000000003',{player:{initial:'100000000000000000001'},trades:[{before:'100000000000000000001',after:'300000000000000000003',leverage:100}]});assert(keys(huge).includes('triple'));
});
test('winning conditions honor principal boundaries, max-25 inclusion, 100-use counts and never award debt/zero losers',()=>{
 const under=record('a','999',{winnerIds:[0,1]});assert(keys(under).includes('underInitialWin'));assert(keys(under).includes('lowLeverageWin'));assert(!keys(record('b','1000')).includes('underInitialWin'));
 assert(!keys(record('c','1250',{trades:[{before:'1000',after:'1250',leverage:26}]})).includes('lowLeverageWin'));
 const high=record('d','1250',{trades:[{before:'1000',after:'1100',leverage:100},{before:'1100',after:'1250',leverage:100}]});assert.equal(events(high).find(e=>e.key==='hundredWin').uses,2);assert(!keys(high).includes('lowLeverageWin'));
 for(const wealth of ['0','-1']){const r=record('loss',wealth,{trades:[{before:'1000',after:wealth,leverage:100}]});assert(!keys(r).some(k=>['comeback','underInitialWin','lowLeverageWin','hundredWin'].includes(k)))}
});
test('old records and retired stages are classified using stored logs, without mutation or current market rules',()=>{
 const r=record('old','120000',{peak:'120000',record:{stage:{id:'retired',name:'旧ステージ'}}}),before=JSON.stringify(r);const result=aggregateLegends([r]);assert.equal(result.entries[0].stage.id,'retired');assert(result.entries[0].events.some(e=>e.key==='hundredMillion'));assert.equal(JSON.stringify(r),before);
 assert.deepEqual(keys(r),keys({...r,players:[{...r.players[0],metrics:{maxLeverage:25,uses100:0}}]}));
});
test('strict debt records retain historical updates, reject equal/smaller later debts and do not duplicate multi-event entries',()=>{
 const rows=[record('a','-100',{status:'debt',winnerIds:[]}),record('b','-200',{status:'debt',winnerIds:[]}),record('c','-150',{status:'debt',winnerIds:[]}),record('d','-200',{status:'debt',winnerIds:[]}),record('e','-300',{status:'debt',winnerIds:[]})];
 const s=aggregateLegends(rows);assert.deepEqual(s.entries.map(e=>e.gameId),['e','b','a']);assert.equal(s.counts.debtRecord,3);assert.equal(s.matchedResults,3);assert.deepEqual(s.entries.map(e=>e.events[0].previous),['200','100','0']);
 const collapse=record('f','-400',{peak:'5000',status:'debt',winnerIds:[]}),all=aggregateLegends([...rows,collapse]);assert.equal(all.entries[0].events.length,2);assert.equal(all.counts.peakCollapse,1);assert.equal(all.matchedResults,4);assert.equal(all.entries.length,4);
 assert.deepEqual(aggregateLegends([...rows].reverse()),s);
 const a=createLegendAccumulator();a.add(collapse);assert.deepEqual(a.result(),a.result());assert.throws(()=>a.add(collapse));
});
test('same-game maximum debt ties share a record; smaller participants, CPU and unassigned names are kept separate',()=>{
 const r=record('shared','-500',{status:'debt',winnerIds:[]});r.players.push({...r.players[0],id:1,wealth:'-500'}, {...r.players[0],id:2,wealth:'-100'}, {...r.players[0],id:3,kind:'cpu',cpu:'gambler',wealth:'-999999'});
 const table=record('table','1250',{record:{ownerPlayerId:null,playMode:'tabletop'}}),rows=[r,table],self=aggregateLegends(rows),humans=aggregateLegends(rows,{scope:'human'}),cpu=aggregateLegends(rows,{scope:'cpu'});
 assert.equal(self.participants,1);assert.equal(self.counts.debtRecord,1);assert.equal(self.entries[0].wealth,'-500');assert.equal(humans.participants,4);assert.equal(humans.counts.debtRecord,2);assert.equal(humans.counts.lowLeverageWin,1);assert.equal(cpu.participants,1);assert.equal(cpu.entries[0].wealth,'-999999');assert(cpu.entries.every(e=>e.kind==='cpu'));
});
test('all pages and filters count full history, with stable cursors for equal dates and same-game participants',()=>{
 const rows=Array.from({length:56},(_,i)=>record('g-'+String(i).padStart(3,'0'))),before=JSON.stringify(rows),first=aggregateLegends(rows);assert.equal(first.filteredResults,56);assert.equal(first.entries.length,20);assert.equal(first.entries[0].gameId,'g-055');assert(first.nextCursor);
 const query=legendQuery(new URLSearchParams({cursor:first.nextCursor})),second=aggregateLegends(rows,query),third=aggregateLegends(rows,legendQuery(new URLSearchParams({cursor:second.nextCursor})));assert.equal(second.entries.length,20);assert.equal(third.entries.length,16);assert.equal(third.nextCursor,null);assert.equal(new Set([...first.entries,...second.entries,...third.entries].map(e=>e.gameId)).size,56);assert.equal(JSON.stringify(rows),before);
 const none=aggregateLegends(rows,{event:'triple'});assert.equal(none.entries.length,0);assert.equal(none.filteredResults,0);assert.equal(none.counts.lowLeverageWin,56);
 const multis=rows.map(r=>({...r,players:Array.from({length:6},(_,id)=>({...r.players[0],id})),history:[{round:1,results:Array.from({length:6},(_,id)=>({...r.history[0].results[0],id}))}],winnerIds:[0,1,2,3,4,5]})),a=aggregateLegends(multis,{scope:'human'}),b=aggregateLegends(multis,legendQuery(new URLSearchParams({scope:'human',cursor:a.nextCursor})));assert.equal(new Set([...a.entries,...b.entries].map(e=>e.gameId+'/'+e.playerId)).size,40);assert.equal(b.entries[0].gameId,a.entries.at(-1).gameId);assert.equal(b.entries[0].playerId,a.entries.at(-1).playerId+1);
});
test('cursor validation binds filters and requires canonical dates/IDs; unsupported histories fail rather than dropping records',()=>{
 assert.deepEqual(legendQuery(new URLSearchParams()),{scope:'self',event:'all',cursor:null});for(const params of [{scope:'bad'},{event:'fake'},{cursor:'!@'},{cursor:btoa('{}')}])assert.throws(()=>legendQuery(new URLSearchParams(params)));
 const page=aggregateLegends(Array.from({length:21},(_,i)=>record('g'+i)));assert.throws(()=>legendQuery(new URLSearchParams({scope:'cpu',cursor:page.nextCursor})));assert.throws(()=>legendQuery(new URLSearchParams({event:'zero',cursor:page.nextCursor})));
 assert.throws(()=>aggregateLegends([record('new','1000',{record:{schemaVersion:99}})]));assert.throws(()=>aggregateLegends([record('cpu','1000',{player:{kind:'cpu'}})]));
});
function database(){
 const sqlite=new DatabaseSync(':memory:');for(const f of ['0000_dusty_wiccan.sql','0001_jazzy_kang.sql','0002_sparkling_invisible_woman.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const calls=[],db={sqlite,calls,prepare(sql){return {bind(...args){calls.push({sql,args});return {all:async()=>({success:true,results:sqlite.prepare(sql).all(...args)})}}}}};db.seed=(r,owner='owner')=>sqlite.prepare('INSERT INTO matches VALUES (?,?,?,?,?)').run(owner,r.id,r.schemaVersion,r.endedAt,JSON.stringify(r));return db;
}
test('real indexed database scan counts all matching games, isolates owners and makes no history/TRIP writes',async()=>{
 const db=database();for(let i=0;i<56;i++)db.seed(record('g-'+String(i).padStart(3,'0')));db.seed(record('alien'),'other');const before=db.sqlite.prepare('SELECT * FROM matches ORDER BY owner_id,game_id').all(),s=await readLegends(db,'owner',{});assert.equal(s.totalSavedGames,56);assert.equal(s.counts.lowLeverageWin,56);assert.equal(s.entries.length,20);assert.equal(db.calls.length,3);assert(db.calls.every(c=>c.args[0]==='owner'&&c.sql.startsWith('SELECT')));assert.deepEqual(db.sqlite.prepare('SELECT * FROM matches ORDER BY owner_id,game_id').all(),before);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,0);assert.equal((await readLegends(db,'other',{})).totalSavedGames,1);
});
test('API authenticates, rejects invalid filters and writes, disables cache and hides partial results on failure',async()=>{
 const db=database(),headers={'oai-authenticated-user-id':'owner'},req=(suffix='',options={})=>new Request('https://game.test/api/legends'+suffix,{headers,...options});assert.equal((await legendsRequest(req('',{headers:{}}),{DB:db})).status,401);assert.equal((await legendsRequest(req('',{method:'PUT'}),{DB:db})).status,405);assert.equal((await legendsRequest(req('?event=fake'),{DB:db})).status,400);
 const response=await legendsRequest(req(),{DB:db});assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual((await response.json()).counts,Object.fromEntries(LEGEND_KEYS.map(k=>[k,0])));
 const previous=console.error;console.error=()=>{};try{const fail=await legendsRequest(req(),{DB:{prepare(){throw Error('fail')}}});assert.equal(fail.status,503);assert.equal((await fail.json()).entries,undefined)}finally{console.error=previous}
});
test('views escape names/stages, combine events with evidence and link to readonly matches with the return filter',()=>{
 const r=record('saved','0',{peak:'100000',status:'cut',player:{name:'<script>alert(1)</script>'},winnerIds:[]});r.stage.name='<img src=x>';const data=aggregateLegends([r]),html=legendsView({state:'ready',data,pendingCount:1});assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('&lt;script&gt;'));assert(html.includes('#match/saved?from=legends/self/all'));assert(html.includes('天国から地獄'));assert(html.includes('億り人'));assert(html.includes('全損'));assert(html.includes('保存を再試行'));assert(html.includes('追加得点やボーナスはありません'));
 assert(matchView({state:'loading',from:'legends/cpu/debtRecord'}).includes('href="#legends/cpu/debtRecord"'));assert(matchView({state:'loading',from:'legends/cpu/debtRecord'}).includes('殿堂入りへ'));
 assert(!legendsView({state:'error',error:'<failed>'}).includes('data-legend-game'));assert(legendsView({state:'error',error:'<failed>'}).includes('&lt;failed&gt;'));assert(legendsView({state:'ready',data:aggregateLegends([])}).includes('この対象の試合記録はまだありません'));
});
