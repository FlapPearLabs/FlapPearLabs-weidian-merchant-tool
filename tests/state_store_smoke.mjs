import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StateStore } from '../runtime/state_store.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'weidian-state-'));
const db=path.join(root,'state.sqlite3');
let s=new StateStore(db);
s.importBaseline({version:2,products:[
  {baselineKey:'A',baselineId:'A',title:'商品A'},
  {baselineKey:'B',baselineId:'B',title:'商品B'}
]},{source:'test'});
s.importImageCache({hashes:{'https://img/a.jpg':'0123456789abcdef'},failures:{}},{source:'test'});
s.importGlobalHistory({version:2,shopId:'1',records:{'100':{itemId:'100'}}},{source:'test'});
s.setMeta('initialized','1');
s.close();

s=new StateStore(db);
const st=s.status('1');
if(st.products!==2 || st.imageHashes!==1 || st.globalRecords!==1) throw new Error(JSON.stringify(st));
s.close();
await fs.rm(root,{recursive:true,force:true});
console.log('state_store smoke test passed');
