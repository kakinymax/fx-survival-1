import test from 'node:test';
import assert from 'node:assert/strict';
import {standings,standingBadge} from '../dist/standings.js';

test('current balances include fixed and eliminated players; ties share rank without changing turn order',()=>{
 const players=Object.freeze([
  Object.freeze({id:0,wealth:'1500',status:'active'}),
  Object.freeze({id:1,wealth:'2000',status:'fixed'}),
  Object.freeze({id:2,wealth:'1500',status:'active'}),
  Object.freeze({id:3,wealth:'0',status:'cut'}),
  Object.freeze({id:4,wealth:'-1000',status:'debt'})
 ]);
 const result=standings(players);
 assert.deepEqual(result.map(e=>[e.player.id,e.rank,e.tied]),[[1,1,false],[0,2,true],[2,2,true],[3,4,false],[4,5,false]]);
 assert.deepEqual(players.map(p=>p.id),[0,1,2,3,4]);
 assert(result.every(e=>players.includes(e.player)));
});
test('very large balances differing by one unit retain their exact order',()=>{
 const result=standings([{id:0,wealth:'900719925474099200001'},{id:1,wealth:'900719925474099200002'}]);
 assert.deepEqual(result.map(e=>[e.player.id,e.rank]),[[1,1],[0,2]]);
});
test('equal first place is marked as tied; all-zero or negative results never receive leader styling',()=>{
 const tied=standings([{wealth:'1000'},{wealth:'1000'}]);
 assert(tied.every(e=>e.rank===1&&e.tied&&standingBadge(e).includes('同率')));
 for(const wealth of ['0','-1']){
  const [entry]=standings([{wealth}]);assert(!standingBadge(entry).includes('standing-leader'));
 }
});
