import {it,expect} from 'vitest';
import {parseCsv} from '../src/csv';
import {createDb} from '../server/src/db';
import {createStore,importStoreItems,listStoreCatalog} from '../server/src/merchant';
it('CSV supports quoted names and duplicate EAN last-write wins',()=>{
 const db=createDb(':memory:');try{const s=createStore(db,{name:'CSV',city:'astana',address:'Street'});
 const rows=parseCsv('ean,name,price\n4870207314301,"Milk, fresh",100\n4870207314301,Milk,200');
 importStoreItems(db,s.id,rows);expect(listStoreCatalog(db,s.id)).toHaveLength(1);expect(listStoreCatalog(db,s.id)[0].price_kzt).toBe(200);
 }finally{db.close();}
});
it.each(['ean,name\n4870207314301,Milk','ean,price\n4870207314301,','ean,price\n4870207314301,-2','ean,price\n"4870207314301,100'])('rejects malformed CSV %s',s=>expect(()=>parseCsv(s)).toThrow());
it('invalid EAN rolls back complete import',()=>{const db=createDb(':memory:');try{
 const s=createStore(db,{name:'CSV',city:'astana',address:'Street'});
 expect(()=>importStoreItems(db,s.id,parseCsv('ean,price\n4870207314301,100\n123,200'))).toThrow('INVALID_EAN');expect(listStoreCatalog(db,s.id)).toHaveLength(0);
 }finally{db.close();}});
