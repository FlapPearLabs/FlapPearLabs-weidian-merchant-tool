import path from 'node:path';
import { StateStore } from './state_store.mjs';
function arg(name,def=''){const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]:def;}
function fmt(s){if(!s)return '-';try{return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));}catch{return String(s);}}
const dbArg=String(arg('db','')).trim(); if(!dbArg)throw new Error('缺少 --db');
const store=new StateStore(path.resolve(dbArg));
try{
  const health=store.healthCheck(), s=store.status();
  console.log('============================================');
  console.log(' v2.6 统一数据中心状态');
  console.log('============================================');
  console.log(`数据库健康：${health.ok?'PASS':'FAIL'}｜历史商品：${s.products}｜主图dHash：${s.imageHashes}｜Schema：${s.schemaVersion}`);
  console.log(`历史高水位：${s.productHighWater}`);
  console.log('\n最近运行：');
  const runs=store.db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT 10').all();
  if(!runs.length) console.log('  暂无 v2.6 运行记录。');
  for(const r of runs) console.log(`  ${fmt(r.finished_at||r.started_at)}｜${r.status}｜${r.mode||'-'}｜目标${r.target_new}｜深核${r.deep_checked}｜新品${r.new_count}｜历史${r.history_before}→${r.history_after??'-'}`);
  console.log('\n最近导出/商城确认：');
  const batches=store.db.prepare('SELECT * FROM export_batches ORDER BY created_at DESC LIMIT 10').all();
  if(!batches.length) console.log('  暂无 v2.6 导出批次。');
  for(const b of batches) console.log(`  ${fmt(b.created_at)}｜${b.product_count}商品/${b.sku_rows}SKU｜${b.status==='MALL_IMPORTED'?'商城已确认':'待商城确认'}｜${b.file_path}`);
} finally {store.close();}
