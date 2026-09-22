import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb } from '../server/src/db.js';
import { lookupGalmartOffer } from '../server/src/retailers/galmart.js';
import { persistRetailerOffer } from '../server/src/offers.js';
import { validEan } from '../server/src/validation.js';

type City = 'astana' | 'almaty';
const city = (process.argv.find((arg) => arg.startsWith('--city='))?.split('=')[1] || 'astana') as City;
if (!['astana', 'almaty'].includes(city)) throw new Error('Use --city=astana or --city=almaty');

const corpusPath = resolve(process.env.GTIN_CORPUS || './research/corpus/gtins.txt');
const checkpointPath = resolve(process.env.INGEST_CHECKPOINT || `./data/ingest-galmart-${city}.checkpoint.json`);
const delayMs = Math.max(350, Math.min(10000, Number(process.env.INGEST_DELAY_MS || 500) || 500));
const maxRetries = Math.max(0, Math.min(3, Number(process.env.INGEST_RETRIES || 2) || 0));
const db = createDb();

const gtins = [...new Set(
  readFileSync(corpusPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
)].filter(validEan);

const checkpoint: { done: Record<string, string> } = existsSync(checkpointPath)
  ? JSON.parse(readFileSync(checkpointPath, 'utf8'))
  : { done: {} };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let indexed = 0;
let notFound = 0;
let failed = 0;

for (const gtin of gtins) {
  if (checkpoint.done[gtin]) continue;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const offer = await lookupGalmartOffer(gtin, city);
      if (offer) {
        persistRetailerOffer(db, offer);
        indexed += 1;
        checkpoint.done[gtin] = 'indexed';
        console.log(`[indexed] ${gtin} ${offer.title} ${offer.priceKzt} KZT`);
      } else {
        notFound += 1;
        checkpoint.done[gtin] = 'not_found';
        console.log(`[not_found] ${gtin}`);
      }
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await sleep(500 * (attempt + 1));
    }
  }

  if (lastError) {
    failed += 1;
    console.error(`[failed] ${gtin}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  } else {
    writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  await sleep(delayMs);
}

console.log(JSON.stringify({ retailer: 'galmart', city, corpus: gtins.length, indexed, notFound, failed }, null, 2));
db.close();
