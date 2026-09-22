import {it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb} from '../server/src/db.js';
import {createStore,upsertStoreItem} from '../server/src/merchant.js';
import {createObservation} from '../server/src/observations.js';
import {syncRetailerStores} from '../server/src/store-directory.js';
import {galmartAdapter} from '../server/src/retailers/galmart.js';
import {comparePrices} from '../server/src/compare.js';
import {validEan} from '../server/src/validation.js';
it.each(['96385074','036000291452'])('accepts GTIN %s', ean=>expect(validEan(ean)).toBe(true));
it('migrates old nullable schema without losing stores; enforces new writes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'baga-migration-')); const path=join(dir,'old.sqlite');
 const old=new Database(path);
 old.exec("CREATE TABLE stores(id INTEGER PRIMARY KEY,name TEXT NOT NULL,city TEXT NOT NULL,address TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); INSERT INTO stores VALUES(1,'Legacy','astana',NULL,'now','now')");
 old.close(); const db=createDb(path);
 try {
 expect(db.prepare('SELECT * FROM legacy_store_address_issues').all()).toHaveLength(1);
 expect(()=>db.exec("INSERT INTO stores(name,city,address,created_at,updated_at) VALUES('x','astana',NULL,'now','now')")).toThrow();
 db.prepare("UPDATE stores SET address='Known address' WHERE id=1").run();
 expect(db.prepare('SELECT * FROM legacy_store_address_issues').all()).toHaveLength(0);
 expect(db.prepare('SELECT * FROM schema_migrations').all()).toHaveLength(1);
 } finally {db.close();}
 const again=createDb(path); expect(again.prepare('SELECT * FROM stores').all()).toHaveLength(1);again.close();rmSync(dir,{recursive:true});
});
it('branch sync is idempotent and preserves observations',async()=>{
 const db=createDb(':memory:');
 const spy=vi.spyOn(galmartAdapter as Required<typeof galmartAdapter>,'listStores').mockResolvedValue([{id:'branch-1',name:'Galmart',city:'astana',address:'Street 1'}]);
 try {
 await syncRetailerStores(db);const store:any=db.prepare('SELECT * FROM stores').get();
 createObservation(db,{storeId:store.id,ean:'4870207314301',priceKzt:99,observedAt:new Date().toISOString()});
 await syncRetailerStores(db);
 expect(db.prepare('SELECT * FROM stores').all()).toHaveLength(1);
 expect(db.prepare('SELECT * FROM user_observations').all()).toHaveLength(1);
 expect(()=>upsertStoreItem(db,store.id,{ean:'4870207314301',price_kzt:10})).toThrow('STORE_NOT_MERCHANT');
 }finally{spy.mockRestore();db.close();}
});
it('official, merchant, and user prices remain separate',async()=>{
 const db=createDb(':memory:');
 const store=createStore(db,{name:'Local',city:'astana',address:'Street'});
 const ean='4870207314301';
 upsertStoreItem(db,store.id,{ean,price_kzt:100});
 createObservation(db,{storeId:store.id,ean,priceKzt:50,observedAt:new Date().toISOString()});
 const spy=vi.spyOn(galmartAdapter,'lookupByBarcode').mockResolvedValue({gtin:ean,retailer:'galmart',retailerName:'Galmart',retailerProductId:'123',storeId:null,storeName:null,city:'astana',title:'Milk',brand:null,pack:null,imageUrl:null,priceKzt:200,oldPriceKzt:null,available:null,retrievedAt:new Date().toISOString(),sourceUpdatedAt:null,sourceUrl:'https://galmart.kz',confidence:'medium',channel:'online_city_catalog',warnings:[]});
 try{
 const r=await comparePrices(db,ean,'astana');
 expect(r.official_offers[0].price_kzt).toBe(200);
 expect(r.merchant_offers[0].price_kzt).toBe(100);
 expect((r.observations[0] as any).price_kzt).toBe(50);
 }finally{spy.mockRestore();db.close();}
});
