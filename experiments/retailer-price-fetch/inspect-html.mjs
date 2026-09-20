import fs from 'node:fs/promises';
for (const file of process.argv.slice(2)) {
 const html = await fs.readFile(file, 'utf8');
 const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map(x=>x[1]);
 const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map(x=>x[1]))];
 console.log(JSON.stringify({file,scripts,links:links.filter(x=>!x.includes('.css')).slice(0,100),snippets:[...html.matchAll(/.{0,100}(?:baseURL|apiUrl|api_url|barcode|__NUXT__|__NEXT_DATA__).{0,200}/g)].map(x=>x[0]).slice(0,20)},null,2));
}
