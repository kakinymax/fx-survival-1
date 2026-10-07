// Sites must overwrite the authenticated-user header at its trusted ingress.
// The Worker does not accept a user ID from the body, query, or browser storage.
export const contentSecurityPolicy="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self'";

export function secureResponse(response){
  const headers=new Headers(response.headers);
  headers.set('Content-Security-Policy',contentSecurityPolicy);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function sameOriginWrite(request){
  const origin=request.headers.get('origin');
  return (!origin||origin===new URL(request.url).origin)&&request.headers.get('sec-fetch-site')!=='cross-site';
}

// Bound bytes and elapsed time even when Content-Length is absent. Neither a
// stream error nor a JSON parser error should leak its input into the response.
export async function readJsonBody(request,limit,{timeoutMs=15000}={}){
  if(request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')return {status:415,error:'JSON required'};
  const reader=request.body?.getReader();if(!reader)return {status:400,error:'Empty body'};
  let timer,size=0;const chunks=[];
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject({status:408}),timeoutMs)});
  try{
    while(true){
      const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;
      size+=value.byteLength;if(size>limit)throw {status:413};chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    return {value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
  }catch(error){
    void reader.cancel().catch(()=>{});
    const status=error?.status===413?413:error?.status===408?408:400;
    return {status,error:status===413?'Body too large':status===408?'Request timed out':'Invalid JSON body'};
  }finally{clearTimeout(timer);reader.releaseLock()}
}
