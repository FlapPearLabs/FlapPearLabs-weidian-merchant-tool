import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { StateStore } from './state_store.mjs';

function uniq(xs){ return [...new Set((xs||[]).filter(x=>x!==null&&x!==undefined&&String(x).trim()!=='').map(x=>String(x).trim()))]; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function nfkc(s){ try{return String(s||'').normalize('NFKC');}catch{return String(s||'');} }

const MARKETING_WORDS = [
  '现货','包邮','新品','新款','清仓','秒杀','特价','折扣','最新折扣','正品','促销','限时','热卖','推荐','奥莱专柜款','costco清仓'
];

export function normalizeTitle(s){
  let x=nfkc(s).toLowerCase();
  x=x.replace(/(\d+(?:\.\d+)?)\s*(毫升|ml)/gi,(_,n)=>`${num(n)}ml`);
  x=x.replace(/(\d+(?:\.\d+)?)\s*(升|l)(?![a-z])/gi,(_,n)=>`${num(Number(n)*1000)}ml`);
  x=x.replace(/(\d+(?:\.\d+)?)\s*(公斤|千克|kg)/gi,(_,n)=>`${num(Number(n)*1000)}g`);
  x=x.replace(/(\d+(?:\.\d+)?)\s*(克|g)/gi,(_,n)=>`${num(n)}g`);
  for(const w of MARKETING_WORDS) x=x.split(w.toLowerCase()).join('');
  x=x.replace(/[【】\[\]()（）{}<>《》“”‘’'"`~!！@#$%^&*+=|\\/:：;；,，.。?？_\-\s]+/g,'');
  return x;
}
function num(v){ const n=Number(v); return Number.isFinite(n)?String(Math.round(n*1000)/1000):String(v); }

function grams(s,n){
  const a=[...String(s||'')]; const set=new Set();
  if(a.length<n){ if(a.length) set.add(a.join('')); return set; }
  for(let i=0;i<=a.length-n;i++) set.add(a.slice(i,i+n).join(''));
  return set;
}
function diceSet(a,b){ if(!a.size&&!b.size)return 1; let c=0; for(const x of a)if(b.has(x))c++; return 2*c/(a.size+b.size||1); }
function bagCosine(a,b){
  const ca=new Map(),cb=new Map();
  for(const ch of [...a])ca.set(ch,(ca.get(ch)||0)+1);
  for(const ch of [...b])cb.set(ch,(cb.get(ch)||0)+1);
  let dot=0,aa=0,bb=0; for(const v of ca.values())aa+=v*v; for(const v of cb.values())bb+=v*v;
  for(const [k,v] of ca)dot+=v*(cb.get(k)||0);
  return aa&&bb?dot/Math.sqrt(aa*bb):0;
}
function levRatio(a,b){
  a=[...a];b=[...b]; if(!a.length&&!b.length)return 1; if(!a.length||!b.length)return 0;
  let prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){
    cur[0]=i;
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    [prev,cur]=[cur,prev];
  }
  return 1-prev[b.length]/Math.max(a.length,b.length);
}
function titleSimilarityNormalized(x,y){
  if(!x||!y)return 0; if(x===y)return 1;
  const d2=diceSet(grams(x,2),grams(y,2));
  const d3=diceSet(grams(x,3),grams(y,3));
  const bag=bagCosine(x,y); const lev=levRatio(x,y);
  return Math.max(0,Math.min(1,0.45*d2+0.25*d3+0.2*bag+0.1*lev));
}
export function titleSimilarity(a,b){ return titleSimilarityNormalized(normalizeTitle(a),normalizeTitle(b)); }

function cnNum(s){
  const map={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);
  if(s==='十')return 10;
  if(s.length===2&&s[0]==='十'&&map[s[1]]!=null)return 10+map[s[1]];
  if(s.length===2&&s[1]==='十'&&map[s[0]]!=null)return map[s[0]]*10;
  return map[s]??NaN;
}
function setAdd(map,key,val){ if(val===null||val===undefined||val===''||Number.isNaN(val))return; if(!map[key])map[key]=new Set(); map[key].add(String(val)); }
function normalizeAttrName(n){
  n=nfkc(n).toLowerCase().replace(/\s+/g,'');
  if(/容量|净含量|毫升|ml/.test(n))return 'capacity_ml';
  if(/重量|克重|净重|公斤|kg/.test(n))return 'weight_g';
  if(/数量|件数|包装|组合|几瓶|几盒/.test(n))return 'count';
  if(/尺码|尺寸|size/.test(n))return 'size';
  if(/色号/.test(n))return 'color_no';
  if(/颜色|colour|color/.test(n))return 'color';
  if(/型号|model/.test(n))return 'model';
  return '';
}
function normSpecVal(dim,v){
  v=nfkc(v).trim().toLowerCase();
  if(dim==='capacity_ml'){
    const m=v.match(/(\d+(?:\.\d+)?)\s*(ml|毫升|l|升)/i); if(m)return String(Math.round((Number(m[1])*(/^(l|升)$/i.test(m[2])?1000:1))*1000)/1000);
  }
  if(dim==='weight_g'){
    const m=v.match(/(\d+(?:\.\d+)?)\s*(g|克|kg|公斤|千克)/i); if(m)return String(Math.round((Number(m[1])*(/^(kg|公斤|千克)$/i.test(m[2])?1000:1))*1000)/1000);
  }
  if(dim==='size') return v.replace(/\s+/g,'').toUpperCase();
  return v.replace(/[\s,，;；:：\[\]【】()（）]/g,'');
}
export function extractHardSpecs(product){
  const out={};
  const texts=[product?.title||'', product?.shortTitle||'', ...(product?.specs||[])];
  for(const sku of product?.skus||[]){
    texts.push(sku?.title||'');
    const ns=Array.isArray(sku?.attributeNames)?sku.attributeNames:[];
    const vs=Array.isArray(sku?.attributeValues)?sku.attributeValues:[];
    for(let i=0;i<Math.max(ns.length,vs.length);i++){
      const dim=normalizeAttrName(ns[i]||''); if(dim){ const v=normSpecVal(dim,vs[i]||''); if(v)setAdd(out,dim,v); }
    }
  }
  for(const spec of product?.specs||[]){
    for(const m of String(spec).matchAll(/\[([^:\]]+):([^\]]+)\]/g)){
      const dim=normalizeAttrName(m[1]); if(dim){ const v=normSpecVal(dim,m[2]); if(v)setAdd(out,dim,v); }
    }
  }
  const joined=texts.join(' ');
  for(const m of joined.matchAll(/(\d+(?:\.\d+)?)\s*(ml|毫升|l|升)/gi)) setAdd(out,'capacity_ml',Math.round(Number(m[1])*(/^(l|升)$/i.test(m[2])?1000:1)*1000)/1000);
  for(const m of joined.matchAll(/(\d+(?:\.\d+)?)\s*(g|克|kg|公斤|千克)/gi)) setAdd(out,'weight_g',Math.round(Number(m[1])*(/^(kg|公斤|千克)$/i.test(m[2])?1000:1)*1000)/1000);
  for(const m of joined.matchAll(/([一二两三四五六七八九十\d]+)\s*(瓶|罐|盒|袋|包|支|个|件|片|粒|枚|条|对|双|套)/g)){
    const n=cnNum(m[1]); if(Number.isFinite(n)&&n>0)setAdd(out,'count',`${n}${m[2]}`);
  }
  return Object.fromEntries(Object.entries(out).map(([k,s])=>[k,[...s]]));
}
export function hardConflict(a,b,preparedA=null,preparedB=null){
  const A=preparedA||a?._spec||extractHardSpecs(a),B=preparedB||b?._spec||extractHardSpecs(b), reasons=[];
  const dims=['capacity_ml','weight_g','count','size','color_no','model'];
  for(const d of dims){
    if(!A[d]?.length||!B[d]?.length)continue;
    const sb=new Set(B[d]); if(!A[d].some(x=>sb.has(x))) reasons.push(`${d}:${A[d].join('/')} != ${B[d].join('/')}`);
  }
  return {conflict:reasons.length>0,reasons,A,B};
}
function normalizedUrl(u){
  try{ const x=new URL(String(u||'')); x.search='';x.hash=''; return x.toString(); }catch{return String(u||'').trim();}
}
function candidateCodes(p){ return uniq([p?.itemId,...(p?.skuCodes||[]),...(p?.barcodes||[]),...(p?.skus||[]).map(s=>s?.skuId)]); }
function mainImage(p){ return p?.mainImageUrl || (p?.images||[]).find(x=>x?.type==='主图')?.url || (p?.images||[]).map(x=>typeof x==='string'?x:x?.url).find(Boolean) || ''; }

export function hexHamming(a,b){
  if(!/^[0-9a-f]{16}$/i.test(a||'')||!/^[0-9a-f]{16}$/i.test(b||''))return null;
  let x=BigInt('0x'+a)^BigInt('0x'+b),n=0; while(x){n+=Number(x&1n);x>>=1n;} return n;
}
async function readJsonSafe(p,fallback){ try{return JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e?.code==='ENOENT')return fallback;throw e;} }
async function writeJsonAtomic(p,obj){ await fs.mkdir(path.dirname(p),{recursive:true}); const tmp=p+'.tmp'; await fs.writeFile(tmp,JSON.stringify(obj,null,2),'utf8'); await fs.rename(tmp,p); }

export async function dhashDataUrl(page,dataUrl){
  return await page.evaluate(async (src)=>{
    const img=new Image(); img.src=src; await img.decode();
    const c=document.createElement('canvas'); c.width=9;c.height=8; const g=c.getContext('2d',{willReadFrequently:true});
    g.fillStyle='#fff';g.fillRect(0,0,9,8);g.drawImage(img,0,0,9,8);
    const d=g.getImageData(0,0,9,8).data; let bits='';
    const lum=i=>0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=(y*9+x)*4,j=(y*9+x+1)*4;bits+=lum(i)>lum(j)?'1':'0';}
    let hex='';for(let i=0;i<64;i+=4)hex+=parseInt(bits.slice(i,i+4),2).toString(16);return hex;
  },dataUrl);
}
async function hashImageUrl(context,page,url){
  let last;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      const res=await context.request.get(url,{timeout:15000}); if(!res.ok())throw new Error(`HTTP ${res.status()}`);
      const body=await res.body(); if(!body?.length)throw new Error('empty image');
      const mime=(res.headers()['content-type']||'image/jpeg').split(';')[0];
      const dataUrl=`data:${mime};base64,${body.toString('base64')}`;
      return await dhashDataUrl(page,dataUrl);
    }catch(e){last=e;if(attempt<2)await sleep(500);}
  }
  throw last;
}

function protectedHistoryConfidence(v){
  return ['confirmed','tool_exported'].includes(String(v||''));
}

export class MallDeduper{
  constructor({stateDbPath,context,log=console.log}){this.stateDbPath=stateDbPath;this.context=context;this.log=log;this.baseline=null;this.cache=null;this.page=null;this.sessionProducts=[];this.store=null;}
  async init(){
    this.store=new StateStore(this.stateDbPath);
    this.baseline=this.store.loadBaseline(); if(!this.baseline?.products?.length)throw new Error(`统一数据中心中的商城历史基线为空：${this.stateDbPath}`);
    this.cache=this.store.loadImageCache(); this.cache.hashes||={};this.cache.failures||={};
    this.page=await this.context.newPage();
    for(const p of this.baseline.products){p._norm=normalizeTitle(p.title);p._codes=candidateCodes(p);p._spec=extractHardSpecs(p);p._main=mainImage(p);}
    return this;
  }
  async close(){await this.page?.close().catch(()=>{});try{this.store?.close();}catch{}}
  async ensureImageBaseline(){
    const products=this.baseline.products.filter(p=>p._main),missing=products.filter(p=>!this.cache.hashes[normalizedUrl(p._main)]);
    if(!missing.length)return {total:products.length,cached:products.length,failed:Object.keys(this.cache.failures).length};
    this.log(`历史主图 dHash 缓存：已有 ${products.length-missing.length}/${products.length}，首次补建 ${missing.length} 张；只访问图片CDN，不请求微店商品列表API。`);
    let done=0,ok=0,fail=0;
    for(const p of missing){
      const key=normalizedUrl(p._main);
      try{const h=await hashImageUrl(this.context,this.page,p._main);this.cache.hashes[key]=h;delete this.cache.failures[key];this.store.setImageHash(key,h);ok++;}
      catch(e){const err=String(e?.message||e).slice(0,300);this.cache.failures[key]=err;this.store.setImageFailure(key,err);fail++;}
      done++; if(done%50===0||done===missing.length){this.cache.updatedAt=new Date().toISOString();this.log(`  图片指纹进度 ${done}/${missing.length}（成功${ok}，失败${fail}）`);}
      await sleep(40);
    }
    return {total:products.length,cached:Object.keys(this.cache.hashes).length,failed:Object.keys(this.cache.failures).length};
  }
  async candidateHash(record){
    const u=mainImage(record); if(!u)return '';
    const key=normalizedUrl(u); if(this.cache.hashes[key])return this.cache.hashes[key];
    try{const h=await hashImageUrl(this.context,this.page,u);this.cache.hashes[key]=h;this.cache.updatedAt=new Date().toISOString();this.store.setImageHash(key,h);return h;}catch(e){this.store.setImageFailure(key,String(e?.message||e));return '';}
  }
  async classify(record){
    const codes=new Set(candidateCodes(record)),norm=normalizeTitle(record.title),recordSpec=extractHardSpecs(record),cmain=mainImage(record),cmainNorm=normalizedUrl(cmain);
    let candHash=''; const matches=[];
    for(const h of [...this.baseline.products,...this.sessionProducts]){
      const exactCode=h._codes.some(x=>codes.has(x));
      const hc=hardConflict(record,h,recordSpec,h._spec); if(hc.conflict&&!exactCode)continue;
      const text=titleSimilarityNormalized(norm,h._norm);
      const exactTitle=norm&&norm===h._norm;
      const exactImage=!!cmainNorm&&!!h._main&&cmainNorm===normalizedUrl(h._main);
      let imageDistance=null;
      if(exactCode){
        const confirmed=protectedHistoryConfidence(h.importConfidence);
        matches.push({h,text,imageDistance,exactCode,exactTitle,exactImage,hc,decision:confirmed?'DUPLICATE_CONFIRMED':'REVIEW_REQUIRED',reason:confirmed?'商品编码/SKU/itemId 精确命中':'商品编码/SKU精确命中，但该历史实体尚未标记为商城导入确认，先人工确认'});continue;
      }
      if(!candHash&&cmain)candHash=await this.candidateHash(record);
      if(candHash&&h._main){const hh=this.cache.hashes[normalizedUrl(h._main)];if(hh)imageDistance=hexHamming(candHash,hh);}
      let decision='',reason='';
      if(exactTitle&&exactImage){decision='DUPLICATE_CONFIRMED';reason='标准化标题一致 + 主图URL一致';}
      else if(imageDistance!==null&&imageDistance<=2&&text>=0.70){decision='DUPLICATE_CONFIRMED';reason=`标题相似${pct(text)} + 主图dHash距离${imageDistance}`;}
      else if(imageDistance!==null&&imageDistance<=4&&text>=0.85){decision='DUPLICATE_CONFIRMED';reason=`标题高度相似${pct(text)} + 主图dHash距离${imageDistance}`;}
      else if(text>=0.96&&exactTitle){decision='DUPLICATE_CONFIRMED';reason='标准化标题完全一致且无硬规格冲突';}
      else if(text>=0.90){decision='REVIEW_REQUIRED';reason=`标题高度相似${pct(text)}，但证据不足以自动确认`;}
      else if(imageDistance!==null&&imageDistance<=1){decision='REVIEW_REQUIRED';reason=`主图几乎完全一致(dHash距离${imageDistance})，即使标题写法差异较大也建议人工核对`;}
      else if(imageDistance!==null&&imageDistance<=4&&text>=0.45){decision='REVIEW_REQUIRED';reason=`主图高度相似(dHash距离${imageDistance}) + 标题有一定重合${pct(text)}，需人工核对`;}
      else if(exactImage&&text>=0.40){decision='REVIEW_REQUIRED';reason='主图URL一致且标题有一定相似';}
      if(decision){
        if(decision==='DUPLICATE_CONFIRMED' && !protectedHistoryConfidence(h.importConfidence)){
          decision='REVIEW_REQUIRED';
          reason=`${reason}；但该历史实体尚未标记为商城导入确认，因此不自动跳过`;
        }
        matches.push({h,text,imageDistance,exactCode,exactTitle,exactImage,hc,decision,reason});
      }
    }
    matches.sort((a,b)=>rank(b)-rank(a));
    const dup=matches.find(m=>m.decision==='DUPLICATE_CONFIRMED');
    if(dup)return result('DUPLICATE_CONFIRMED',record,dup,matches);
    const rev=matches.find(m=>m.decision==='REVIEW_REQUIRED');
    if(rev)return result('REVIEW_REQUIRED',record,rev,matches);
    return {decision:'NEW_CONFIRMED',candidate:itemSummary(record),bestMatch:null,reason:'与完整历史商品基线逐一比较后，未发现确认重复或高风险疑似重复',alternatives:[]};
  }
  rememberSessionNew(record){
    const title=record?.title||''; const img=mainImage(record);
    const ent={baselineId:`S${String(this.sessionProducts.length+1).padStart(5,'0')}`,baselineKey:'session',title,shortTitle:'',images:(record?.images||[]).filter(x=>['主图','轮播图'].includes(x.type)).map(x=>x.url).filter(Boolean),mainImageUrl:img,detailImages:(record?.images||[]).filter(x=>x.type==='详情图').map(x=>x.url).filter(Boolean),skuCodes:uniq((record?.skus||[]).map(s=>s.skuId)),barcodes:uniq(record?.barcodes||[]),specs:(record?.skus||[]).map(s=>formatSku(s)).filter(Boolean),prices:uniq((record?.skus||[]).map(s=>s.price)),sourceFiles:['current-session'],sourceRows:[],origin:'session_new',importConfidence:'tool_exported'};
    ent._norm=normalizeTitle(ent.title); ent._codes=candidateCodes(ent); ent._spec=extractHardSpecs(ent); ent._main=mainImage(ent);
    this.sessionProducts.push(ent);
  }
  async appendExported(records,source='v2.5-export'){
    let changed=0, refreshed=0; const touched=[];
    for(const r of records){
      const title=r.title||''; const img=mainImage(r); const key=crypto.createHash('sha256').update(title+'\n'+img).digest('hex').slice(0,24);
      const found=this.baseline.products.find(p=>p.baselineKey===key || (normalizeTitle(p.title)===normalizeTitle(title)&&normalizedUrl(mainImage(p))===normalizedUrl(img)));
      if(found){
        if(!protectedHistoryConfidence(found.importConfidence)){
          found.importConfidence='tool_exported'; found.origin='tool_export'; found.lastExportedAt=new Date().toISOString(); refreshed++; touched.push(found);
        }
        continue;
      }
      const ent={baselineId:`N${String(this.baseline.products.length+1).padStart(5,'0')}`,baselineKey:key,title,shortTitle:'',images:(r.images||[]).filter(x=>['主图','轮播图'].includes(x.type)).map(x=>x.url).filter(Boolean),mainImageUrl:img,detailImages:(r.images||[]).filter(x=>x.type==='详情图').map(x=>x.url).filter(Boolean),skuCodes:uniq((r.skus||[]).map(s=>s.skuId)),barcodes:uniq(r.barcodes||[]),specs:(r.skus||[]).map(s=>formatSku(s)).filter(Boolean),prices:uniq((r.skus||[]).map(s=>s.price)),sourceFiles:[source],sourceRows:[],origin:'tool_export',importConfidence:'tool_exported',importConfirmed:false,firstExportedAt:new Date().toISOString(),lastExportedAt:new Date().toISOString()};
      ent._norm=normalizeTitle(ent.title); ent._codes=candidateCodes(ent); ent._spec=extractHardSpecs(ent); ent._main=mainImage(ent);
      this.baseline.products.push(ent);changed++; touched.push(ent);
    }
    if(changed||refreshed){
      this.baseline.version=2; this.baseline.exactMergedProductCount=this.baseline.products.length;
      this.baseline.confirmedEntityCount=this.baseline.products.filter(p=>protectedHistoryConfidence(p.importConfidence)).length;
      this.baseline.unreconciledEntityCount=this.baseline.products.length-this.baseline.confirmedEntityCount;
      this.baseline.updatedAt=new Date().toISOString(); this.store.upsertProducts(touched,{eventType:'EXPORT_BASELINE_ADVANCED'});
    }
    return {changed,refreshed,total:this.baseline.products.length};
  }
}
function formatSku(s){const ns=s?.attributeNames||[],vs=s?.attributeValues||[];let x='';for(let i=0;i<Math.max(ns.length,vs.length);i++){if(vs[i])x+=`[${ns[i]||'规格'}:${vs[i]}]`;}return x||s?.title||'';}
function pct(x){return `${Math.round(x*100)}%`;}
function rank(m){return (m.decision==='DUPLICATE_CONFIRMED'?1000:500)+(m.exactCode?300:0)+(m.exactImage?50:0)+(m.imageDistance===null?0:64-m.imageDistance)+m.text*100;}
function itemSummary(p){return {itemId:String(p?.itemId||''),title:String(p?.title||''),skuCount:(p?.skus||p?.skuCodes||[]).length,mainImageUrl:mainImage(p),codes:candidateCodes(p),hardSpecs:extractHardSpecs(p)};}
function result(decision,record,m,matches){return {decision,candidate:itemSummary(record),bestMatch:{baselineId:m.h.baselineId,title:m.h.title,sourceFiles:m.h.sourceFiles||[],textSimilarity:m.text,imageDistance:m.imageDistance,exactCode:m.exactCode,exactTitle:m.exactTitle,exactImage:m.exactImage,hardSpecs:m.hc.B,importConfidence:m.h.importConfidence||'unknown'},reason:m.reason,alternatives:matches.slice(0,5).map(x=>({baselineId:x.h.baselineId,title:x.h.title,decision:x.decision,textSimilarity:x.text,imageDistance:x.imageDistance,reason:x.reason}))};}

export function importCompatibilityRisks(record){
  const risks=[];
  if((record?.skus||[]).some(s=>(s.attributeNames||[]).length>3)) risks.push({severity:'warning',code:'MORE_THAN_3_SPEC_DIMS',message:'原微店存在超过3个规格维度；商城模板当前只输出前3个规格维度。'});
  return risks;
}

export async function selfTestDedupe(){
  if(normalizeTitle('【现货】海蓝之谜 精粹水 150毫升')!==normalizeTitle('海蓝之谜精粹水150ml'))throw new Error('normalize test failed');
  const a={title:'海蓝之谜修护精粹水150ml',skus:[]},b={title:'海蓝之谜精粹水修护150毫升',specs:[]};
  if(titleSimilarity(a.title,b.title)<0.70)throw new Error('reorder similarity test failed');
  const c={title:'海蓝之谜精粹水250ml',skus:[]}; if(!hardConflict(a,c).conflict)throw new Error('capacity conflict test failed');
  const p={title:'衣服',skus:[{attributeNames:['尺寸'],attributeValues:['XL']}]},q={title:'衣服',specs:['[尺寸:M]']}; if(!hardConflict(p,q).conflict)throw new Error('size conflict test failed');
  if(importCompatibilityRisks({skus:Array.from({length:70},()=>({attributeNames:['规格'],attributeValues:['A']}))}).some(x=>x.code==='HIGH_SKU_COUNT')) throw new Error('high sku false-positive test failed');
  return true;
}
