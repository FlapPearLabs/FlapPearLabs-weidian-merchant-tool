import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { StateStore, readJsonIfExists } from './state_store.mjs';
import { backup } from 'node:sqlite';

function arg(name,def=''){const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]:def;}
const dbPath=path.resolve(arg('db'));
const legacy=path.resolve(arg('legacy-history',path.join(path.dirname(path.dirname(dbPath)),'历史中心'));
const shopId=String(arg('shop-id','')).trim();
if(!dbPath)throw new Error('缺少 --db');
const store=new StateStore(dbPath);
try{
  let first=!store.getMeta('initialized');
  if(first){
    console.log('统一 SQLite 数据中心：首次初始化。');
    let baseline=await readJsonIfExists(path.join(legacy,'商城历史商品基线_v2.json'));
    let baselineSource='固定旧历史中心';
    if(!baseline?.products?.length) throw new Error(`首次建立统一数据中心时没有找到旧固定历史中心：${legacy}。为避免历史倒退，本次不会创建空数据库。请保留旧的 %LOCALAPPDATA%\\WeidianMerchantTool\\历史中心 后重试。`);
    const bn=store.importBaseline(baseline,{source:baselineSource});
    const hash=await readJsonIfExists(path.join(legacy,'商城历史主图_dhash缓存_v2.json'));
    const hn=hash?store.importImageCache(hash,{source:'固定旧历史中心'}):0;
    let gn=0;
    try{
      for(const name of await fsp.readdir(legacy)){
        if(!/^shop_\d+_global_export_history\.json$/i.test(name))continue;
        const g=await readJsonIfExists(path.join(legacy,name)); if(g)gn+=store.importGlobalHistory(g,{source:'固定旧历史中心'});
      }
    }catch{}
    store.setMeta('legacy_import_done','1');store.setMeta('initialized','1');store.setMeta('created_by','v2.5');
    store.event('DATA_CENTER_INITIALIZED','',{baseline:bn,imageHashes:hn,globalRecords:gn,source:baselineSource});
    console.log(`一次性迁移完成：历史商品 ${bn}；主图dHash ${hn}；同店历史 ${gn}。`);
    console.log('从 v2.5 开始不再搜索任何旧版本目录；以后所有版本直接打开这一份数据库。');
  } else {
    console.log('统一 SQLite 数据中心：已连接（不扫描旧版本）。');
  }
  const s=store.status(shopId);
  const dataRoot=path.dirname(path.dirname(dbPath)), backupDir=path.join(dataRoot,'backups');
  await fsp.mkdir(backupDir,{recursive:true});
  const ld=new Date(), pad=n=>String(n).padStart(2,'0'), day=`${ld.getFullYear()}-${pad(ld.getMonth()+1)}-${pad(ld.getDate())}`, backupPath=path.join(backupDir,`state_${day}.sqlite3`);
  if(!fs.existsSync(backupPath)){
    await backup(store.db,backupPath);
    const olds=(await fsp.readdir(backupDir)).filter(n=>/^state_\d{4}-\d{2}-\d{2}\.sqlite3$/.test(n)).sort().reverse();
    for(const old of olds.slice(7)) await fsp.rm(path.join(backupDir,old),{force:true}).catch(()=>{});
    console.log(`今日自动备份：${backupPath}`);
  }
  console.log(`数据中心：${s.dbPath}`);
  console.log(`历史商品：${s.products}｜主图dHash：${s.imageHashes}｜图片失败缓存：${s.imageFailures}${shopId?`｜当前店同源历史：${s.globalRecords}`:''}｜Schema：${s.schemaVersion}`);
} finally { store.close(); }
