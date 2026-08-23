import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function now(){ return new Date().toISOString(); }
function jparse(s,f=null){ try{return JSON.parse(s);}catch{return f;} }
function jstr(v){ return JSON.stringify(v ?? null); }
function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

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
    `);
    if(!this.getMeta('schema_version')) this.setMeta('schema_version','1');
  }
  close(){ try{this.db.close();}catch{} }
  getMeta(key){ const r=this.db.prepare('SELECT value FROM meta WHERE key=?').get(key); return r?.value ?? null; }
  setMeta(key,value){ this.db.prepare(`INSERT INTO meta(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key,String(value),now()); }
  event(type,key='',payload=null){ this.db.prepare('INSERT INTO events(event_type,entity_key,payload_json,created_at) VALUES(?,?,?,?)').run(type,String(key||''),payload==null?null:jstr(payload),now()); }
  transaction(fn){ this.db.exec('BEGIN IMMEDIATE'); try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){try{this.db.exec('ROLLBACK')}catch{} throw e;} }

  productCount(){ return Number(this.db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n||0); }
  imageHashCount(){ return Number(this.db.prepare("SELECT COUNT(*) AS n FROM image_hashes WHERE dhash IS NOT NULL AND dhash <> ''").get()?.n||0); }
  imageFailureCount(){ return Number(this.db.prepare("SELECT COUNT(*) AS n FROM image_hashes WHERE error IS NOT NULL AND error <> ''").get()?.n||0); }
  globalCount(shopId=''){ if(shopId)return Number(this.db.prepare('SELECT COUNT(*) AS n FROM global_history WHERE shop_id=?').get(String(shopId))?.n||0); return Number(this.db.prepare('SELECT COUNT(*) AS n FROM global_history').get()?.n||0); }

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
  }
  importGlobalHistory(obj,{source='legacy'}={}){ const shopId=String(obj?.shopId||'').trim(); if(!shopId)return 0; this.saveGlobalHistory(shopId,obj); const n=Object.keys(obj.records||{}).length; this.event('LEGACY_GLOBAL_IMPORTED',shopId,{source,count:n}); return n; }

  status(shopId=''){ return {dbPath:this.dbPath,schemaVersion:Number(this.getMeta('schema_version')||1),products:this.productCount(),imageHashes:this.imageHashCount(),imageFailures:this.imageFailureCount(),globalRecords:this.globalCount(shopId),initialized:this.getMeta('initialized')==='1',legacyImported:this.getMeta('legacy_import_done')==='1'}; }
}

export async function readJsonIfExists(file){ try{return JSON.parse((await fsp.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e?.code==='ENOENT')return null;throw e;} }
