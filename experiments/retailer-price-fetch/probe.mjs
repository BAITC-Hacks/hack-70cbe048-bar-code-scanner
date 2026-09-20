import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// One public GET per input URL. No login, cookies, bypass or automatic retries.
const args = process.argv.slice(2);
const out = args.shift();
if (!out || !args.length) throw new Error('Usage: node probe.mjs OUTPUT_DIR URL [URL...]');
await fs.mkdir(out, { recursive: true });
const results = await Promise.all(args.map(async (url, index) => {
  const observedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BarcodePriceScannerResearch/0.1 (public feasibility study)', Accept: 'text/html,application/json,text/plain,*/*' },
      signal: AbortSignal.timeout(25000),
    });
    const body = await response.text();
    const filename = `${index}-${new URL(url).hostname.replaceAll('.', '_')}.txt`;
    await fs.writeFile(path.join(out, filename), body);
    return { url, final_url: response.url, observed_at: observedAt, status: response.status,
      content_type: response.headers.get('content-type'), server_date: response.headers.get('date'),
      last_modified: response.headers.get('last-modified'), bytes: Buffer.byteLength(body),
      sha256: crypto.createHash('sha256').update(body).digest('hex'), local_body: filename };
  } catch (error) { return { url, observed_at: observedAt, error: error.message, cause: error.cause?.code }; }
}));
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
