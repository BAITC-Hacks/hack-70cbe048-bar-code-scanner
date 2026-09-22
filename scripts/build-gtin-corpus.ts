import { writeFileSync } from 'node:fs';
import { validEan } from '../server/src/validation.js';

const source = process.env.GTIN_SOURCE;
if (!source) {
  console.log('Use GTIN_SOURCE to point at a newline-delimited research corpus. This script validates and deduplicates it.');
  process.exit(0);
}
const text = await (await fetch(source, { signal: AbortSignal.timeout(10000) })).text();
const gtins = [...new Set(text.split(/\s+/).map((x) => x.trim()).filter(validEan))];
writeFileSync('./data/gtin-corpus.txt', gtins.join('\n') + '\n');
console.log(`Saved ${gtins.length} valid unique GTINs`);
