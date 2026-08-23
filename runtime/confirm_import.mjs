import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { StateStore } from './state_store.mjs';

function arg(name,def=''){const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]:def;}
const dbArg=String(arg('db','')).trim();
if(!dbArg) throw new Error('缺少 --db');
const store=new StateStore(path.resolve(dbArg));
try{
  const batch=store.latestExportBatch();
  if(!batch){ console.log('暂无导出批次记录。'); process.exit(0); }
  console.log(`最近导出：${batch.product_count} 商品 / ${batch.sku_rows} SKU`);
  console.log(`文件：${batch.file_path}`);
  console.log(`状态：${batch.status==='MALL_IMPORTED'?'商城已确认':'待商城确认'}`);
  if(batch.status==='MALL_IMPORTED'){
    console.log(`确认时间：${batch.mall_confirmed_at||''}`);
    process.exit(0);
  }
  const rl=readline.createInterface({input,output});
  const answer=(await rl.question('确认这批商品已经在商城实际导入成功？输入 Y 确认，其余取消: ')).trim().toUpperCase();
  rl.close();
  if(answer!=='Y'){ console.log('已取消，数据库未修改。'); process.exit(0); }
  const updated=store.confirmLatestImport('用户手动确认商城实际导入成功');
  if(updated) console.log(`已确认：${updated.product_count} 商品 / ${updated.sku_rows} SKU 已标记为 MALL_IMPORTED。`);
} finally { store.close(); }
