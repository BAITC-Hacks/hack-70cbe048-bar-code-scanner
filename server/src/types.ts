export type City = 'astana'|'almaty';
export type Result = FoundResult|NotFoundResult|SourceErrorResult;
export interface FoundResult { status:'found'; source:'galmart'; channel:'online_city_catalog'; city:City; ean:string; retailer_product_id:number; title:string; brand:string|null; pack:string|null; price_kzt:number; old_price_kzt:number|null; unit:string|null; unit_value:number|null; unit_price_kzt:number|null; available:boolean; inventory:number|null; retrieved_at:string; source_updated_at:null; store_id:null; store_name:null; confidence:'medium'; warnings:string[] }
export interface NotFoundResult { status:'not_found'; source:'galmart'; city:City; ean:string; retrieved_at:string; message:string }
export interface SourceErrorResult { status:'source_error'; source:'galmart'; city:City; ean:string; retrieved_at:string; message:string }
