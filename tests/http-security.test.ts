
import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb} from '../server/src/db.js';
import {createApp} from '../server/src/app.js';
import {createStore} from '../server/src/merchant.js';
async function fixture(run:(base:string,id:number,dir:string)=>Promise<void>){
 const dir=mkdtempSync(join(tmpdir(),'baga-upload-'));process.env.UPLOAD_DIR=dir;
 const db=createDb(':memory:');const store=createStore(db,{name:'HTTP Test',city:'astana',address:'Street'});
 const server=createApp(db).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{await run('http://127.0.0.1:'+(server.address() as any).port,store.id,dir);}
 finally{await new Promise<void>(r=>server.close(()=>r()));db.close();rmSync(dir,{recursive:true});delete process.env.UPLOAD_DIR;delete process.env.ADMIN_TOKEN;}
}
function form(id:number){const b=new FormData();b.set('store_id',String(id));b.set('ean','4870207314301');b.set('observed_price_kzt','590');b.set('observed_at',new Date().toISOString());return b;}
const samples=[
 ['image/jpeg',Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==','base64')],
 ['image/png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=','base64')],
 ['image/webp',Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64')]
] as const;
it.each(samples)('accepts signature %s with server-controlled path',async(mime,bytes)=>fixture(async(base,id,dir)=>{
 const b=form(id);b.set('photo',new Blob([bytes],{type:mime}),'../../evil.exe');
 const r=await fetch(base+'/api/v1/observations',{method:'POST',body:b});expect(r.status).toBe(201);
 const o=await r.json();expect(o.photo_url).toMatch(/^\/uploads\/[0-9a-f-]+\.(jpg|png|webp)$/);
 const image=await fetch(base+o.photo_url);expect(image.status).toBe(200);expect(image.headers.get('x-content-type-options')).toBe('nosniff');expect(readdirSync(dir)).toHaveLength(1);
}));
it('rejects forged MIME and removes rejected file',async()=>fixture(async(base,id,dir)=>{
 const b=form(id);b.set('photo',new Blob(['executable'],{type:'image/jpeg'}),'x.jpg');
 expect((await fetch(base+'/api/v1/observations',{method:'POST',body:b})).status).toBe(400);
 expect(readdirSync(dir)).toHaveLength(0);
}));
it('rejects upload above 5MB',async()=>fixture(async(base,id)=>{
 const b=form(id);b.set('photo',new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/png'}),'x.png');
 expect((await fetch(base+'/api/v1/observations',{method:'POST',body:b})).status).toBe(400);
}));
it('malformed multipart is a client error',async()=>fixture(async(base)=>{
 expect((await fetch(base+'/api/v1/observations',{method:'POST',headers:{'content-type':'multipart/form-data'},body:'bad'})).status).toBe(400);
}));
it('moderation requires token, verifies/rejects pending only',async()=>fixture(async(base,id)=>{
 const o=await (await fetch(base+'/api/v1/observations',{method:'POST',body:form(id)})).json();
 const url=base+'/api/v1/admin/observations/'+o.id;
 const patch=(token='',status='verified')=>fetch(url,{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({status})});
 expect((await patch()).status).toBe(503);process.env.ADMIN_TOKEN='test-only-secret';
 expect((await patch('wrong')).status).toBe(401);
 expect((await patch('test-only-secret','bad')).status).toBe(400);
 expect((await patch('test-only-secret')).status).toBe(200);
 expect((await patch('test-only-secret','rejected')).status).toBe(409);
 const o2=await (await fetch(base+'/api/v1/observations',{method:'POST',body:form(id)})).json();
 expect((await fetch(base+'/api/v1/admin/observations/'+o2.id,{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer test-only-secret'},body:JSON.stringify({status:'rejected'})})).status).toBe(200);
 const visible=await (await fetch(base+'/api/v1/observations')).json();expect(visible).toHaveLength(1);expect(visible[0].status).toBe('verified');
}));
it('rejects missing/null/blank price and retailer impersonation',async()=>fixture(async(base,id)=>{
 for(const price of [null,'',true]){
 const r=await fetch(base+'/api/v1/stores/'+id+'/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ean:'4870207314301',price_kzt:price})});
 expect(r.status).toBe(400);
 }
 const r=await fetch(base+'/api/v1/stores',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Galmart',city:'astana',address:'Fake'})});expect(r.status).toBe(400);
}));
