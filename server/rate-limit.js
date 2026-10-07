// Fixed-minute counters live in D1 so separate Worker instances share limits.
// Reuse two rows per owner; requests do not create an unbounded event log.
export const API_LIMITS={read:120,write:60};
export async function rateLimitRequest(request,db,{now=Date.now()}={}){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner||!['GET','PUT'].includes(request.method))return null;
  const scope=request.method==='GET'?'read':'write',limit=API_LIMITS[scope];
  const windowStart=Math.floor(now/60000),retryAfter=60-Math.floor(now/1000)%60;
  try{
    const row=await db.prepare(`INSERT INTO api_rate_limits (owner_id, scope, window_start, requests)
      VALUES (?, ?, ?, 1)
      ON CONFLICT (owner_id, scope) DO UPDATE SET
        requests=CASE WHEN api_rate_limits.window_start>=excluded.window_start
          THEN MIN(api_rate_limits.requests+1, ?) ELSE 1 END,
        window_start=MAX(api_rate_limits.window_start, excluded.window_start)
      RETURNING requests`).bind(owner,scope,windowStart,limit+1).first();
    if(!row||!Number.isInteger(row.requests))throw Error('Invalid rate counter');
    if(row.requests>limit)return Response.json({error:'アクセスが集中しています。少し待って再試行してください'},
      {status:429,headers:{'Cache-Control':'no-store','Retry-After':String(retryAfter)}});
    return null;
  }catch{
    // Fail closed when the migration or shared limiter is unavailable.
    return Response.json({error:'現在アクセスを確認できません。少し待って再試行してください'},
      {status:503,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
  }
}
