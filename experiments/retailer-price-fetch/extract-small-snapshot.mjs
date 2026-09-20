import fs from 'node:fs/promises';
// Offline-only inspection of the single HTML response acquired during feasibility research.
// Wolt Terms 13.6 restrict automated use/reuse: this script deliberately does not fetch.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node extract-small-snapshot.mjs LOCAL_HTML OUTPUT_JSON');
const html = await fs.readFile(input, 'utf8');
const match = html.match(/<script[^>]*class="query-state"[^>]*>([\s\S]*?)<\/script>/);
if (!match) throw new Error('query-state not found');
const data = JSON.parse(match[1]);
const items = new Map();
const venue = [];
function walk(v) {
 if (!v || typeof v !== 'object') return;
 if (v.barcode_gtin && v.price != null && v.id) items.set(v.id, {
   retailer_product_id:v.id, barcode_gtin:v.barcode_gtin,
   ean13: /^0\d{13}$/.test(v.barcode_gtin) ? v.barcode_gtin.slice(1) : null,
   name:v.name, price_raw:v.price, price_kzt_inferred:v.price / 100,
   unit_info:v.unit_info ?? null, original_price:v.original_price ?? null,
 });
 if (v.slug === 'small-ast06') venue.push({id:v.id,name:v.name,slug:v.slug,address:v.address,currency:v.currency});
 for (const value of Object.values(v)) walk(value);
}
walk(data);
const result={source_url:'https://wolt.com/ru/kaz/nur-sultan/venue/small-ast06',observed_at:'2026-09-20T18:24:28.867Z',source_price_updated_at:null,channel:'delivery',legal_status:'restricted_without_consent',venue,items_with_gtin_in_response:items.size,selected_items:[...items.values()].slice(0,10),notes:['Price /100 inference must be checked against visible KZT values.', 'Page rendering timestamp does not establish price update time.', 'Selected sample only; not a catalog export.']};
await fs.writeFile(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
