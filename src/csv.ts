// Delimited text parser: quoted delimiters/newlines and doubled quotes supported.
export function parseCsv(text:string) {
 const source=text.replace(/^\uFEFF/,'');
 const delimiter=source.split(/\r?\n/,1)[0].includes(';')?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===delimiter){row.push(cell.trim());cell='';}
  else if(!quoted&&c==='\n'){row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}
  else if(c!=='\r')cell+=c;
 }
 if(quoted)throw new Error('CSV: незакрытая кавычка.');
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw new Error('CSV пустой или нет товаров.');
 const headers=rows.shift()!.map(s=>s.toLowerCase());
 const col=(...names:string[])=>headers.findIndex(h=>names.includes(h));
 const e=col('ean','gtin','barcode','штрихкод','шк'),p=col('price','price_kzt','цена'),n=col('name','title','название','товар'),o=col('old_price','old_price_kzt','старая цена');
 if(e<0||p<0)throw new Error('В CSV обязательны колонки ean и price.');
 return rows.map((r,i)=>{
 if(r.length!==headers.length)throw new Error('CSV: неправильное число колонок в строке '+(i+2));
 const price=r[p].replace(/\s/g,'').replace(',','.');
 if(!price||!Number.isFinite(Number(price))||Number(price)<0)throw new Error('CSV: некорректная цена в строке '+(i+2));
 return {ean:r[e],name:n>=0?r[n]:undefined,price_kzt:Number(price),old_price_kzt:o>=0&&r[o]?Number(r[o].replace(',','.')):null};
 });
}
