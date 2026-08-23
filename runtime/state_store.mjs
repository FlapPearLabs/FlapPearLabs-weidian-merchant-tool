import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

function now(){ return new Date().toISOString(); }
function jparse(s,f=null){ try{return JSON.parse(s);}catch{return f;} }
function jstr(v){ return JSON.stringify(v ?? null); }
function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }
function compactStamp(d=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function runId(){ return `${compactStamp()}_${Math.random().toString(36).slice(2,8)}`; }

export class StateStore {
  constructor(dbPath){
    this.dbPath=path.resolve(dbPath);
    ensureDir(path.dirname(this.dbPath));
    this.db=new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.initSchema();
  }
  initSchema(){
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta(
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products(
        baseline_key TEXT PRIMARY KEY,
        baseline_id TEXT,
        title TEXT,
        import_confidence TEXT,
        item_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_baseline_id ON products(baseline_id);
      CREATE INDEX IF NOT EXISTS idx_products_title ON products(title);
      CREATE TABLE IF NOT EXISTS image_hashes(
        image_url TEXT PRIMARY KEY,
        dhash TEXT,
        error TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS global_history(
        shop_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(shop_id,item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_global_shop ON global_history(shop_id);
      CREATE TABLE IF NOT EXISTS events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        entity_key TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs(
        run_id TEXT PRIMARY KEY,
        tool_version TEXT NOT NULL,
        shop_id TEXT,
        mode TEXT,
        target_new INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        history_before INTEGER NOT NULL DEFAULT 0,
        history_after INTEGER,
        light_scanned INTEGER NOT NULL DEFAULT 0,
        candidate_queue INTEGER NOT NULL DEFAULT 0,
        deep_checked INTEGER NOT NULL DEFAULT 0,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        new_count INTEGER NOT NULL DEFAULT 0,
        sku_rows INTEGER NOT NULL DEFAULT 0,
        message TEXT,
        result_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status, started_at DESC);
      CREATE TABLE IF NOT EXISTS export_batches(
        batch_id TEXT PRIMARY KEY,
        run_id TEXT,
        created_at TEXT NOT NULL,
        file_path TEXT NOT NULL,
        product_count INTEGER NOT NULL DEFAULT 0,
        sku_rows INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PREPARED',
        mall_confirmed_at TEXT,
        note TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(run_id)
      );
      CREATE INDEX IF NOT EXISTS idx_export_batches_created ON export_batches(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_export_batches_status ON export_batches(status, created_at DESC);
    `);
    this.setMeta('schema_version','2');
  }
  close(){ try{this.db.close();}catch{} }
  getMeta(key){ const r=this.db.prepare('SELECT value FROM meta WHERE key=?').get(key); return r?.value ?? null; }
  setMeta(key,value){ this.db.prepare(`INSERT INTO meta(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key,String(value),now()); }
  event(type,key='',payload=null){ this.db.prepare('INSERT INTO events(event_type,entity_key,payload_json,created_at) VALUES(?,?,?,?)').run(type,String(key||''),payload==null?null:jstr(payload),now()); }
  transaction(fn){ this.db.exec('BEGIN IMMEDIATE'); try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){try{this.db.exec('ROLLBACK')}catch{} throw e;} }

  productCount(){ return Number(this.db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n||0); }
  imageHashCount(){ return Number(this.db.prepare("SELECT COUNT(*) AS n FROM image_hashes WHERE dhash IS NOT NULL AND dhash <> ''").get()?.n||0); }
  imageFailureCount(){ return Number(this.db.prepare("SELECT COUNT(*) AS n FROM image_hashes WHERE error IS NOT NULL AND error <> ''").get()?.n||0); }
  imageEntryCount(){ return Number(this.db.prepare('SELECT COUNT(*) AS n FROM image_hashes').get()?.n||0); }
  globalCount(shopId=''){ if(shopId)return Number(this.db.prepare('SELECT COUNT(*) AS n FROM global_history WHERE shop_id=?').get(String(shopId))?.n||0); return Number(this.db.prepare('SELECT COUNT(*) AS n FROM global_history').get()?.n||0); }

  bumpHighWater(){
    const current=this.productCount(), old=Number(this.getMeta('product_high_water')||0);
    if(current>old)this.setMeta('product_high_water',String(current));
    const g=this.globalCount(), oldG=Number(this.getMeta('global_high_water')||0);
    if(g>oldG)this.setMeta('global_high_water',String(g));
    return {products:Math.max(current,old),global:Math.max(g,oldG)};
  }
  verifyInternalHighWater(){
    const current=this.productCount(), stored=Number(this.getMeta('product_high_water')||0);
    if(stored && current<stored) throw new Error(`历史商品出现倒退：数据库当前 ${current}，内部最高水位 ${stored}。为避免重复导入，已停止运行。`);
    const g=this.globalCount(), storedG=Number(this.getMeta('global_high_water')||0);
    if(storedG && g<storedG) throw new Error(`同店历史出现倒退：数据库当前 ${g}，内部最高水位 ${storedG}。已停止运行。`);
    this.bumpHighWater();
    return {products:current,productHighWater:Number(this.getMeta('product_high_water')||current),global:g,globalHighWater:Number(this.getMeta('global_high_water')||g)};
  }
  healthCheck(){
    const quick=this.db.prepare('PRAGMA quick_check').all();
    const quickMessages=quick.map(r=>String(Object.values(r)[0]??'')).filter(Boolean);
    const fk=this.db.prepare('PRAGMA foreign_key_check').all();
    const ok=quickMessages.length===1 && quickMessages[0].toLowerCase()==='ok' && fk.length===0;
    return {ok,quick:quickMessages,foreignKeyProblems:fk};
  }
  async verifyHealthAnchor(anchorPath){
    const current={products:this.productCount(),global:this.globalCount(),imageEntries:this.imageEntryCount()};
    let anchor=null;
    try{anchor=JSON.parse(await fsp.readFile(anchorPath,'utf8'));}catch(e){if(e?.code!=='ENOENT')throw e;}
    if(anchor){
      if(Number(anchor.maxProducts||0)>current.products) throw new Error(`检测到历史数据库回滚/断档：外部健康锚点最高商品数 ${anchor.maxProducts}，当前只有 ${current.products}。请从 backups 恢复最近 checkpoint，禁止继续抓取。`);
      if(Number(anchor.maxGlobalRecords||0)>current.global) throw new Error(`检测到同店历史回滚/断档：健康锚点最高记录 ${anchor.maxGlobalRecords}，当前只有 ${current.global}。请恢复备份。`);
    }
    const next={
      version:1,
      maxProducts:Math.max(current.products,Number(anchor?.maxProducts||0)),
      maxGlobalRecords:Math.max(current.global,Number(anchor?.maxGlobalRecords||0)),
      maxImageEntries:Math.max(current.imageEntries,Number(anchor?.maxImageEntries||0)),
      lastRunId:String(anchor?.lastRunId||''),
      updatedAt:now(),
    };
    ensureDir(path.dirname(anchorPath));
    await fsp.writeFile(anchorPath,JSON.stringify(next,null,2),'utf8');
    return next;
  }
  async updateHealthAnchor(anchorPath,{lastRunId=''}={}){
    let anchor={}; try{anchor=JSON.parse(await fsp.readFile(anchorPath,'utf8'));}catch{}
    const next={version:1,maxProducts:Math.max(this.productCount(),Number(anchor.maxProducts||0)),maxGlobalRecords:Math.max(this.globalCount(),Number(anchor.maxGlobalRecords||0)),maxImageEntries:Math.max(this.imageEntryCount(),Number(anchor.maxImageEntries||0)),lastRunId:String(lastRunId||anchor.lastRunId||''),updatedAt:now()};
    ensureDir(path.dirname(anchorPath)); await fsp.writeFile(anchorPath,JSON.stringify(next,null,2),'utf8'); return next;
  }

  loadBaseline(){
    const rows=this.db.prepare('SELECT item_json FROM products ORDER BY rowid').all();
    const products=rows.map(r=>jparse(r.item_json,{})).filter(x=>x&&typeof x==='object');
    const header=jparse(this.getMeta('baseline_header')||'{}',{})||{};
    return {...header,version:2,products,exactMergedProductCount:products.length,updatedAt:this.getMeta('baseline_updated_at')||header.updatedAt||''};
  }
  importBaseline(obj,{source='legacy'}={}){
    if(!obj?.products?.length) return 0;
    const header={...obj}; delete header.products;
    const ins=this.db.prepare(`INSERT INTO products(baseline_key,baseline_id,title,import_confidence,item_json,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(baseline_key) DO UPDATE SET baseline_id=excluded.baseline_id,title=excluded.title,import_confidence=excluded.import_confidence,item_json=excluded.item_json,updated_at=excluded.updated_at`);
    const t=now();
    this.transaction(()=>{
      for(const p of obj.products){
        const key=String(p.baselineKey||p.baselineId||'').trim(); if(!key)continue;
        ins.run(key,String(p.baselineId||''),String(p.title||''),String(p.importConfidence||''),jstr(p),t);
      }
      this.setMeta('baseline_header',jstr(header));
      this.setMeta('baseline_updated_at',obj.updatedAt||t);
      this.event('LEGACY_BASELINE_IMPORTED',source,{count:obj.products.length});
    });
    this.bumpHighWater();
    return obj.products.length;
  }
  upsertProducts(products,{eventType='PRODUCTS_UPSERTED'}={}){
    if(!Array.isArray(products)||!products.length)return 0;
    const ins=this.db.prepare(`INSERT INTO products(baseline_key,baseline_id,title,import_confidence,item_json,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(baseline_key) DO UPDATE SET baseline_id=excluded.baseline_id,title=excluded.title,import_confidence=excluded.import_confidence,item_json=excluded.item_json,updated_at=excluded.updated_at`);
    const t=now(); let n=0;
    this.transaction(()=>{
      for(const p of products){const key=String(p.baselineKey||p.baselineId||'').trim();if(!key)continue;ins.run(key,String(p.baselineId||''),String(p.title||''),String(p.importConfidence||''),jstr(p),t);n++;}
      this.setMeta('baseline_updated_at',t); this.event(eventType,'',{count:n,total:this.productCount()});
    });
    this.bumpHighWater();
    return n;
  }

  loadImageCache(){
    const hashes={},failures={};
    for(const r of this.db.prepare('SELECT image_url,dhash,error FROM image_hashes').all()){
      if(r.dhash)hashes[r.image_url]=r.dhash;
      if(r.error)failures[r.image_url]=r.error;
    }
    return {version:3,hashes,failures,updatedAt:this.getMeta('image_cache_updated_at')||''};
  }
  setImageHash(url,hash){ const t=now(); this.db.prepare(`INSERT INTO image_hashes(image_url,dhash,error,updated_at) VALUES(?,?,NULL,?) ON CONFLICT(image_url) DO UPDATE SET dhash=excluded.dhash,error=NULL,updated_at=excluded.updated_at`).run(String(url),String(hash),t); this.setMeta('image_cache_updated_at',t); }
  setImageFailure(url,error){ const t=now(); this.db.prepare(`INSERT INTO image_hashes(image_url,dhash,error,updated_at) VALUES(?,NULL,?,?) ON CONFLICT(image_url) DO UPDATE SET error=excluded.error,updated_at=excluded.updated_at`).run(String(url),String(error||'').slice(0,500),t); this.setMeta('image_cache_updated_at',t); }
  importImageCache(obj,{source='legacy'}={}){
    if(!obj||typeof obj!=='object')return 0; const hashes=obj.hashes||{}, failures=obj.failures||{}; let n=0;
    this.transaction(()=>{
      for(const [u,h] of Object.entries(hashes)){this.db.prepare(`INSERT INTO image_hashes(image_url,dhash,error,updated_at) VALUES(?,?,NULL,?) ON CONFLICT(image_url) DO UPDATE SET dhash=excluded.dhash,error=NULL,updated_at=excluded.updated_at`).run(u,String(h),now());n++;}
      for(const [u,e] of Object.entries(failures)){if(hashes[u])continue;this.db.prepare(`INSERT INTO image_hashes(image_url,dhash,error,updated_at) VALUES(?,NULL,?,?) ON CONFLICT(image_url) DO UPDATE SET error=excluded.error,updated_at=excluded.updated_at`).run(u,String(e||'').slice(0,500),now());}
      this.setMeta('image_cache_updated_at',obj.updatedAt||now()); this.event('LEGACY_IMAGE_CACHE_IMPORTED',source,{hashes:Object.keys(hashes).length,failures:Object.keys(failures).length});
    }); return n;
  }

  loadGlobalHistory(shopId){
    const records={}; for(const r of this.db.prepare('SELECT item_id,record_json FROM global_history WHERE shop_id=?').all(String(shopId))){records[r.item_id]=jparse(r.record_json,{})||{};}
    return {version:2,shopId:String(shopId),records,updatedAt:this.getMeta(`global_updated_at:${shopId}`)||''};
  }
  saveGlobalHistory(shopId,history){
    const records=history?.records||{}; const t=history?.updatedAt||now();
    const ins=this.db.prepare(`INSERT INTO global_history(shop_id,item_id,record_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(shop_id,item_id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`);
    this.transaction(()=>{for(const [id,r] of Object.entries(records)){ins.run(String(shopId),String(id),jstr(r),t);}this.setMeta(`global_updated_at:${shopId}`,t);});
    this.bumpHighWater();
  }
  importGlobalHistory(obj,{source='legacy'}={}){ const shopId=String(obj?.shopId||'').trim(); if(!shopId)return 0; this.saveGlobalHistory(shopId,obj); const n=Object.keys(obj.records||{}).length; this.event('LEGACY_GLOBAL_IMPORTED',shopId,{source,count:n}); return n; }

  startRun({toolVersion='2.6.0',shopId='',mode='',targetNew=0,lightScanned=0,candidateQueue=0}={}){
    const id=runId(), before=this.productCount();
    this.db.prepare(`INSERT INTO runs(run_id,tool_version,shop_id,mode,target_new,started_at,status,history_before,light_scanned,candidate_queue) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,String(toolVersion),String(shopId),String(mode),Number(targetNew||0),now(),'RUNNING',before,Number(lightScanned||0),Number(candidateQueue||0));
    this.event('RUN_STARTED',id,{toolVersion,shopId,mode,targetNew,historyBefore:before,lightScanned,candidateQueue});
    return id;
  }
  finishRun(runIdValue,{status='SUCCESS',historyAfter=null,deepChecked=0,duplicateCount=0,reviewCount=0,newCount=0,skuRows=0,message='',result=null}={}){
    const after=historyAfter==null?this.productCount():Number(historyAfter);
    this.db.prepare(`UPDATE runs SET finished_at=?,status=?,history_after=?,deep_checked=?,duplicate_count=?,review_count=?,new_count=?,sku_rows=?,message=?,result_json=? WHERE run_id=?`).run(now(),String(status),after,Number(deepChecked||0),Number(duplicateCount||0),Number(reviewCount||0),Number(newCount||0),Number(skuRows||0),String(message||''),result==null?null:jstr(result),String(runIdValue));
    this.event('RUN_FINISHED',String(runIdValue),{status,historyAfter:after,deepChecked,duplicateCount,reviewCount,newCount,skuRows,message});
    return after;
  }
  latestRun({successfulOnly=false}={}){
    const sql=successfulOnly?`SELECT * FROM runs WHERE status IN ('SUCCESS','NO_NEW') ORDER BY started_at DESC LIMIT 1`:`SELECT * FROM runs ORDER BY started_at DESC LIMIT 1`;
    return this.db.prepare(sql).get()||null;
  }
  recordExportBatch({runId:rid='',filePath,productCount=0,skuRows=0,status='PREPARED',note=''}={}){
    const batchId=`B_${runId()}`;
    this.db.prepare(`INSERT INTO export_batches(batch_id,run_id,created_at,file_path,product_count,sku_rows,status,note) VALUES(?,?,?,?,?,?,?,?)`).run(batchId,String(rid||''),now(),String(filePath||''),Number(productCount||0),Number(skuRows||0),String(status),String(note||''));
    this.event('EXPORT_BATCH_PREPARED',batchId,{runId:rid,filePath,productCount,skuRows,status});
    return batchId;
  }
  latestExportBatch(){ return this.db.prepare('SELECT * FROM export_batches ORDER BY created_at DESC LIMIT 1').get()||null; }
  confirmLatestImport(note=''){
    const row=this.db.prepare("SELECT * FROM export_batches WHERE status='PREPARED' ORDER BY created_at DESC LIMIT 1").get();
    if(!row)return null;
    const t=now(); this.db.prepare("UPDATE export_batches SET status='MALL_IMPORTED',mall_confirmed_at=?,note=? WHERE batch_id=?").run(t,String(note||row.note||''),row.batch_id);
    this.event('MALL_IMPORT_CONFIRMED',row.batch_id,{productCount:row.product_count,skuRows:row.sku_rows,filePath:row.file_path});
    return {...row,status:'MALL_IMPORTED',mall_confirmed_at:t};
  }

  async createCheckpointBackup({keep=10,label='success'}={}){
    const dataRoot=path.dirname(path.dirname(this.dbPath)), backupDir=path.join(dataRoot,'backups');
    await fsp.mkdir(backupDir,{recursive:true});
    const count=this.productCount(), safe=String(label||'success').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,24);
    const file=path.join(backupDir,`checkpoint_${String(count).padStart(6,'0')}_${compactStamp()}_${safe}.sqlite3`);
    await backup(this.db,file);
    const names=(await fsp.readdir(backupDir)).filter(n=>/^checkpoint_\d+_\d{8}_\d{6}_.+\.sqlite3$/.test(n)).sort().reverse();
    for(const old of names.slice(Math.max(1,Number(keep)||10))) await fsp.rm(path.join(backupDir,old),{force:true}).catch(()=>{});
    this.event('CHECKPOINT_BACKUP_CREATED','',{file,products:count});
    return file;
  }

  status(shopId=''){
    const recent=this.latestRun({successfulOnly:true}), exp=this.latestExportBatch();
    return {dbPath:this.dbPath,schemaVersion:Number(this.getMeta('schema_version')||2),products:this.productCount(),imageHashes:this.imageHashCount(),imageFailures:this.imageFailureCount(),globalRecords:this.globalCount(shopId),initialized:this.getMeta('initialized')==='1',legacyImported:this.getMeta('legacy_import_done')==='1',productHighWater:Number(this.getMeta('product_high_water')||0),recentRun:recent,recentExport:exp};
  }
}

export async function readJsonIfExists(file){ try{return JSON.parse((await fsp.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e?.code==='ENOENT')return null;throw e;} }
