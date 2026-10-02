import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRecords,RECORD_KEYS} from '../server/rankings.js';
import {readRecords} from '../server/database.js';
import {recordsRequest,matchRequest} from '../server/api.js';
import {recordsView,matchView} from '../dist/record-view.js';

const initial='1000';
function record(id,wealth='2000',options={}){
  const trades=options.trades??[{after:wealth,pnl:String(BigInt(wealth)-1000n),leverage:50}];
  const player={id:0,name:'あなた',kind:'human',cpu:null,initial,wealth,peak:options.peak??'2000',maxPosition:'100000',status:options.status??'fixed',...options.player};
  return {schemaVersion:1,id,endedAt:options.endedAt??'2026-10-02T10:00:00.000Z',stage:{id:'classic',name:'クラシック'},playMode:'solo',drawMode:'auto',maxRounds:12,endedRound:trades.length,ownerPlayerId:0,winnerIds:options.winnerIds??[0],history:trades.map((t,i)=>({round:i+1,direction:'up',first:4,second:null,bps:50,gap:false,results:[{id:0,side:'buy',position:'100000',before:i?trades[i-1].after:initial,status:'active',...t}]})),players:[player],...options.record};
}
const best=(rows,key,scope='self')=>aggregateRecords(rows).scopes[scope].records[key].leaders[0];
test('all categories use saved player/log data and separate self, tabletop humans and CPUs',()=>{
  const solo=record('solo','2000'),table=record('table','9999',{record:{ownerPlayerId:null,playMode:'tabletop'}}),cpu=record('cpu','8888',{record:{ownerPlayerId:null},player:{kind:'cpu',cpu:'gambler'}});
  const rows=[solo,table,cpu],before=JSON.stringify(rows),s=aggregateRecords(rows).scopes;
  assert.equal(s.self.participants,1);assert.equal(s.human.participants,2);assert.equal(s.cpu.participants,1);
  assert.equal(s.self.records.highestFinal.leaders[0].gameId,'solo');assert.equal(s.human.records.highestFinal.leaders[0].gameId,'table');assert.equal(s.cpu.records.highestFinal.leaders[0].gameId,'cpu');
  assert.deepEqual(Object.keys(s.self.records),RECORD_KEYS);assert.equal(JSON.stringify(rows),before);
});
test('three leaders share competition ranks; tied best count includes omitted games and dates order only the display',()=>{
  const rows=['a','b','c','d','e'].map(id=>record(id,'2000'));
  const b=aggregateRecords([...rows,record('less','1500')]).scopes.self.records.highestFinal;
  assert.equal(b.bestCount,5);assert.deepEqual(b.leaders.map(r=>r.gameId),['e','d','c']);assert.deepEqual(b.leaders.map(r=>r.rank),[1,1,1]);
  const distinct=aggregateRecords([record('a','2000'),record('b','2000'),record('c','1500')]).scopes.self.records.highestFinal;
  assert.deepEqual(distinct.leaders.map(r=>r.rank),[1,1,3]);
});
test('money comparisons and rational profit rates remain exact beyond Number precision',()=>{
  const a=record('a','100000000000000000001',{player:{initial:'100000000000000000000'}}),z=record('z','100000000000000000000',{player:{initial:'99999999999999999999'}});
  assert.equal(best([a,z],'highestFinal').gameId,'a');
  // Both displayed rates round to 0.0%, but the second ratio is strictly larger.
  assert.equal(best([a,z],'profitRate').gameId,'z');
  assert.equal(aggregateRecords([a,z]).scopes.self.records.profitRate.bestCount,1);
  assert.equal(best([record('huge','1234567890123456789012345')],'highestFinal').value,'1234567890123456789012345');
  assert.equal(best([record('gain','1250')],'profitRate').value,'250');
});
test('chronological drawdown differs from final peak fall, retained profits require ending at the peak',()=>{
  const recovered=record('recover','5000',{peak:'5000',trades:[{after:'5000',pnl:'4000',leverage:100},{after:'1000',pnl:'-4000',leverage:80},{after:'5000',pnl:'4000',leverage:50}]}),fell=record('fell','3000',{peak:'5000',trades:[{after:'5000',pnl:'4000',leverage:100},{after:'3000',pnl:'-2000',leverage:80}]});
  assert.equal(best([recovered,fell],'maxDrawdown').gameId,'recover');assert.equal(best([recovered,fell],'maxDrawdown').value,'4000');
  assert.equal(best([recovered,fell],'peakFall').gameId,'fell');assert.equal(best([recovered,fell],'peakFall').value,'2000');
  assert.equal(best([recovered,fell],'retainedProfit').gameId,'recover');assert.equal(best([recovered,fell],'retainedProfit').value,'4000');
  assert.equal(best([fell],'retainedProfit'),undefined);
});
test('single-round profit/loss, use counts and consecutive growth derive from stored logs even for retired stages',()=>{
  const r=record('logs','1600',{trades:[{after:'1100',pnl:'100',leverage:100},{after:'1500',pnl:'400',leverage:50},{after:'1500',pnl:'0',leverage:1},{after:'1800',pnl:'300',leverage:49},{after:'1600',pnl:'-200',leverage:100}],record:{stage:{id:'retired',name:'旧ステージ'}}});
  const b=aggregateRecords([r]).scopes.self.records;
  for(const [key,value]of Object.entries({maxRoundProfit:'400',maxRoundLoss:'200',maxDrawdown:'200',maxLeverage:'100',uses100:'2',uses50Plus:'3',increasingRounds:'2'}))assert.equal(b[key].leaders[0].value,value,key);
  assert.equal(b.highestFinal.leaders[0].stage.id,'retired');
});
test('lowest-winning and under-principal records are ascending, tied winners qualify and bankruptcy never does',()=>{
  const rows=[record('high','2000'),record('under','500',{winnerIds:[0,1]}),record('low','300'),record('debt','-9000',{status:'debt',winnerIds:[]}),record('zero','0',{status:'cut',winnerIds:[]})];
  assert.equal(best(rows,'lowestWinningFinal').value,'300');assert.equal(best(rows,'underInitialWin').value,'300');assert.equal(best(rows,'maxDebt').value,'9000');
  assert.equal(best(rows.slice(3),'lowestWinningFinal'),undefined);
  assert.equal(best(rows.slice(3),'highestFinal').value,'0');
  assert.equal(best([record('debt','-1',{status:'debt',winnerIds:[]})],'highestFinal').value,'-1');
});
test('debt-free game runs survive zero exits and name changes, skip unassigned games, stop at debt and span pagination',()=>{
  const rows=[record('a','1000'),record('b','0',{status:'empty',player:{name:'変更後'}}),record('c','-4000',{status:'debt',winnerIds:[]}),record('d','1000'),record('e','1000'),record('f','1000'),record('g','-1000',{status:'debt',winnerIds:[]}),record('h','1000',{record:{ownerPlayerId:null,playMode:'tabletop'}})];
  const streak=best(rows,'debtFreeGames');assert.equal(streak.value,'3');assert.equal(streak.gameId,'f');assert.equal(streak.startedGameId,'d');
  const cpuRecords=rows.map(r=>({...r,ownerPlayerId:null,players:r.players.map(p=>({...p,kind:'cpu',cpu:r.id==='e'?'steady':'gambler'}))}));
  const cpuStreak=best(cpuRecords,'debtFreeGames','cpu');assert.equal(cpuStreak.value,'2');assert.equal(cpuStreak.gameId,'f');assert.equal(cpuStreak.cpu,'gambler');
  assert.equal(aggregateRecords(rows).scopes.human.records.debtFreeGames.leaders.length,0);
});
test('empty categories invent no records and invalid ownership/schema fail visibly',()=>{
  const empty=aggregateRecords([]).scopes.self;assert.equal(empty.participants,0);for(const b of Object.values(empty.records))assert.deepEqual(b,{bestCount:0,leaders:[]});
  const bad=record('bad');bad.schemaVersion=2;assert.throws(()=>aggregateRecords([bad]));bad.schemaVersion=1;bad.players[0].kind='cpu';assert.throws(()=>aggregateRecords([bad]));
});
function pagedDb(records){
  const calls=[];
  return {calls,prepare(sql){return {bind(...args){calls.push({sql,args});return {async all(){const [,date,id]=args;return {success:true,results:records.filter(r=>!date||r.endedAt<date||r.endedAt===date&&r.id<id).sort((a,b)=>b.id.localeCompare(a.id)).slice(0,25).map(r=>({ended_at:r.endedAt,game_id:r.id,record_json:JSON.stringify(r)}))}}}}}}};
}
test('all D1 pages contribute to leaderboards and streaks, with bounded output and owner-bound queries',async()=>{
  const rows=Array.from({length:56},(_,i)=>record('game-'+String(i).padStart(3,'0'),i===0?'9000':'1000'));
  const db=pagedDb(rows),result=await readRecords(db,'owner');assert.equal(result.totalSavedGames,56);assert.equal(result.lifetime.plays,56);assert.equal(result.scopes.self.records.highestFinal.leaders[0].gameId,'game-000');assert.equal(result.scopes.self.records.debtFreeGames.leaders[0].value,'56');assert.equal(db.calls.length,3);assert(db.calls.every(call=>call.args[0]==='owner'));assert.equal(result.scopes.self.records.maxPosition.leaders.length,3);
});
test('records API requires authentication, forbids writes, and returns no partial totals on failure',async()=>{
  const req=(method='GET',auth=true)=>new Request('https://game.test/api/records',{method,headers:auth?{'oai-authenticated-user-id':'owner'}:{}}),db=pagedDb([]);
  assert.equal((await recordsRequest(req('GET',false),{DB:db})).status,401);assert.equal((await recordsRequest(req('POST'),{DB:db})).status,405);
  const response=await recordsRequest(req(),{DB:db});assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).scopes.self.participants,0);
  const previous=console.error;console.error=()=>{};try{const bad=await recordsRequest(req(),{DB:{prepare(){throw Error('fail')}}});assert.equal(bad.status,503);assert.equal((await bad.json()).scopes,undefined)}finally{console.error=previous}
});
test('historical match GET binds owner and ID, hides other-owner/nonexistent records, and does not replay current rules',async()=>{
  const r=record('saved');r.stage={id:'retired',name:'旧ルール'};
  const calls=[],db={prepare(sql){
    return {bind(owner,id){
      calls.push({sql,owner,id});
      return {async first(){return owner==='owner'&&id==='saved'?{record_json:JSON.stringify(r)}:null}};
    }};
  }};
  const request=(id,owner)=>new Request('https://game.test/api/matches/'+id,{headers:owner?{'oai-authenticated-user-id':owner}:{}});
  assert.equal((await matchRequest(request('saved'),{DB:db})).status,401);
  const response=await matchRequest(request('saved','owner'),{DB:db});assert.equal(response.status,200);assert.deepEqual((await response.json()).record,r);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await matchRequest(request('saved','other'),{DB:db})).status,404);assert.equal((await matchRequest(request('missing','owner'),{DB:db})).status,404);assert.equal((await matchRequest(request('invalid%20id','owner'),{DB:db})).status,404);assert(calls.every(c=>c.sql.includes('owner_id=? AND game_id=?')));
});
test('views escape names/stages and link to immutable records; errors contain no stale leaderboards or match results',()=>{
  const r=record('saved','2000',{player:{name:'<script>bad</script>'}});r.stage.name='<img src=x>';
  const ranked=aggregateRecords([r]),data={...ranked,totalSavedGames:1,lifetime:{pnlTotal:'-1000'}};
  const html=recordsView({state:'ready',data});assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('&lt;script&gt;'));assert(html.includes('#match/saved?from=records/self'));assert(html.includes('−100.0万円'));assert(html.includes('最高からの転落額'));
  const detail=matchView({state:'ready',data:r});assert(detail.includes('ラウンドログ'));assert(detail.includes('data-saved-player="0"'));assert(!detail.includes('<script>'));assert(!detail.includes('data-action="draw-direction"'));
  assert(!recordsView({state:'error',error:'<bad>'}).includes('data-record-key='));assert(!matchView({state:'error',error:'<bad>'}).includes('data-saved-player='));
});
