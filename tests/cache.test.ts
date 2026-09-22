
import {it,expect,vi} from 'vitest';
import {createDb} from '../server/src/db';
import {comparePrices} from '../server/src/compare';
import {galmartAdapter} from '../server/src/retailers/galmart';
import {rateLimit} from '../server/src/security';
it('TTL avoids requests; force refresh evicts confirmed not-found; errors retain stale price',async()=>{
 const db=createDb(':memory:');const ean='4870207314301';
 const offer:any={gtin:ean,retailer:'galmart',retailerName:'Galmart',retailerProductId:'123',storeId:null,storeName:null,city:'astana',title:'Milk',brand:null,pack:null,imageUrl:null,priceKzt:200,oldPriceKzt:null,available:null,retrievedAt:new Date().toISOString(),sourceUpdatedAt:null,sourceUrl:'https://galmart.kz',confidence:'medium',channel:'online_city_catalog',warnings:[]};
 const spy=vi.spyOn(galmartAdapter,'lookupByBarcode').mockResolvedValue(offer);
 try{
 await comparePrices(db,ean,'astana');await comparePrices(db,ean,'astana');expect(spy).toHaveBeenCalledTimes(1);
 db.prepare("UPDATE offers SET retrieved_at='2020-01-01T00:00:00Z'").run();spy.mockRejectedValueOnce(new Error('offline'));
 const stale=await comparePrices(db,ean,'astana');expect(stale.official_offers[0].freshness).toBe('stale');expect(stale.source_errors).toHaveLength(1);
 spy.mockResolvedValueOnce(null);const gone=await comparePrices(db,ean,'astana',true);expect(gone.official_offers).toHaveLength(0);
 }finally{spy.mockRestore();db.close();}
});
it('rate limiter returns 429 after limit and expires',()=>{
 const middleware=rateLimit(2,1000);const next=vi.fn();const res:any={setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn()};
 vi.useFakeTimers();try{for(let i=0;i<3;i++)middleware({ip:'test'} as any,res,next);expect(next).toHaveBeenCalledTimes(2);expect(res.status).toHaveBeenCalledWith(429);vi.advanceTimersByTime(1001);middleware({ip:'test'} as any,res,next);expect(next).toHaveBeenCalledTimes(3);}finally{vi.useRealTimers();}
});
