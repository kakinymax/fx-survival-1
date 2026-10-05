// Browser storage is only an outbox for unsynced completed-game drafts. The
// authoritative history is in D1; acknowledged records leave this outbox.
export function createRecordStore({storage,fetcher=fetch,onChange=()=>{},key='fx-survival-pending-records-v1',autoRetry=true}={}){
  const pending=new Map(),states=new Map(),inflight=new Map();
  let draftError=false;
  try{const draft=JSON.parse(storage.getItem(key));if(draft?.version===1&&Array.isArray(draft.records))for(const r of draft.records)if(r?.id&&r.schemaVersion===1){pending.set(r.id,r);states.set(r.id,autoRetry?'error':'pending')}}catch{draftError=true}
  function persist(){try{if(pending.size)storage.setItem(key,JSON.stringify({version:1,records:[...pending.values()]}));else storage.removeItem(key)}catch{draftError=true}}
  function state(id){return states.get(id)??'idle'}
  function enqueue(record,{saved=false}={}){
    if(saved){states.set(record.id,'saved');return}
    if(states.get(record.id)==='saved')return;
    if(!pending.has(record.id)){pending.set(record.id,record);persist()}
    if(autoRetry)void retry(record.id);else states.set(record.id,'pending');
  }
  function retry(id){
    if(!autoRetry)return Promise.resolve();
    if(inflight.has(id))return inflight.get(id);
    const record=pending.get(id);if(!record)return Promise.resolve();
    states.set(id,'saving');onChange(id,'saving');
    const task=Promise.resolve().then(async()=>{
      try{
        const response=await fetcher(`/api/matches/${record.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record),signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error('Save failed');
        const result=await response.json();
        if(JSON.stringify(result.record)!==JSON.stringify(record))throw Error('Saved record mismatch');
        pending.delete(id);persist();states.set(id,'saved');onChange(id,'saved');
      }catch{states.set(id,'error');onChange(id,'error')}
      finally{inflight.delete(id)}
    });inflight.set(id,task);return task;
  }
  return {enqueue,retry,state,retryAll:()=>Promise.all([...pending.keys()].map(retry)),pendingCount:()=>pending.size,draftError:()=>draftError};
}
