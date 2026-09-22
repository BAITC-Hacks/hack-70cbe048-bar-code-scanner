
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8080';
const db=new Database(process.env.DATABASE_PATH||'./data/baga.sqlite');db.pragma('foreign_keys=ON');
let store;
async function request(path,options){const r=await fetch(base+path,{...options,signal:AbortSignal.timeout(20000)});assert.equal(r.status,options?.method==='POST'&&path==='/api/v1/stores'?201:options?.method==='POST'&&path==='/api/v1/observations'?201:200,path);return r;}
try{
 for(const p of ['/','/api/health','/api/v1/retailers','/api/v1/store-directory']){await request(p);console.log('PASS',p);}
 for(const ean of ['4870207314301','5449000054227','4870036001205']){
 const data=await (await request('/api/v1/compare?ean='+ean+'&city=astana&refresh=1')).json();
 assert.equal(data.status,'found');assert.ok(data.official_offers.some(o=>o.retailer_id==='galmart'&&o.price_kzt>0));
 console.log('PASS live',ean,data.official_offers[0].price_kzt);
 }
 store=await (await request('/api/v1/stores',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Baga smoke '+Date.now(),city:'astana',address:'Temporary verification address'})})).json();
 await request('/api/v1/stores/'+store.id+'/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ean:'4870207314301',price_kzt:777})});
 const own=await (await request('/api/v1/stores/'+store.id+'/price?ean=4870207314301')).json();assert.equal(own.price_kzt,777);
 const form=new FormData();for(const [k,v] of Object.entries({store_id:String(store.id),ean:'4870207314301',observed_price_kzt:'555',observed_at:new Date().toISOString()}))form.set(k,v);
 const obs=await (await request('/api/v1/observations',{method:'POST',body:form})).json();assert.equal(obs.status,'pending');
 const comparison=await (await request('/api/v1/compare?ean=4870207314301&city=astana')).json();
 assert.ok(comparison.merchant_offers.some(o=>o.store_id===String(store.id)&&o.price_kzt===777));
 assert.ok(comparison.observations.some(o=>o.id===obs.id&&o.price_kzt===555));
 assert.ok(comparison.official_offers.some(o=>o.retailer_id==='galmart'));
 console.log('PASS merchant and observation separation');
 const admin=await fetch(base+'/api/v1/admin/observations');assert.ok([401,503].includes(admin.status));console.log('PASS admin protected',admin.status);
}finally{
 if(store){db.prepare('DELETE FROM user_observations WHERE store_id=?').run(store.id);db.prepare('DELETE FROM store_products WHERE store_id=?').run(store.id);db.prepare('DELETE FROM stores WHERE id=?').run(store.id);console.log('CLEANED smoke store',store.id);}
 console.log('integrity',db.pragma('integrity_check',{simple:true}));db.close();
}
