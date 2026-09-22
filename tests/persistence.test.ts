import {describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb,save,history} from '../server/src/db.js';

describe('persistent history',()=>{
  it('retains searches after reopening the database',()=>{
    const dir=mkdtempSync(join(tmpdir(),'barcode-history-'));
    try {
      const path=join(dir,'history.sqlite');
      const first=createDb(path);
      try { save(first,{status:'not_found',ean:'4870207314301',city:'astana',source:'galmart',retrieved_at:new Date().toISOString(),message:'Not found'}); }
      finally { first.close(); }
      const second=createDb(path);
      try { expect(history(second)).toHaveLength(1); }
      finally { second.close(); }
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });
});
