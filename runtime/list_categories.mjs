import fs from 'node:fs/promises';
import https from 'node:https';
import { chromium } from 'playwright';

function arg(name, fallback='') {
  const i=process.argv.indexOf(`--${name}`);
  return i>=0 && i+1<process.argv.length ? process.argv[i+1] : fallback;
}
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
function jitter(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
function shortError(e){ return String(e?.message||e||'未知错误').replace(/\s+/g,' ').slice(0,260); }
function shopIdFromUrl(raw){
  const u=new URL(String(raw).trim());
  for(const k of ['userid','shopId','shop_id']){
    const v=u.searchParams.get(k); if(v&&/^\d+$/.test(v)) return v;
  }
  const m=u.hostname.match(/^shop(\d+)\.v\.weidian\.com$/i); if(m) return m[1];
  throw new Error('Cannot resolve shop id from URL');
}
function assertOk(json,label){ if(!json||json.status?.code!==0) throw new Error(`${label}: ${json?.status?.message||'invalid response'}`); }
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
async function launchBrowser(){
  let last; for(const channel of ['chrome','msedge']){
    try{return await chromium.launch({channel,headless:true,args:['--disable-http2']});}catch(e){last=e;}
  }
  const explicit=process.env.PLAYWRIGHT_EXECUTABLE_PATH || '';
  const fallbacks=explicit ? [explicit] : (process.platform==='win32' ? [] : ['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/google-chrome-stable']);
  for(const executablePath of fallbacks){
    try{return await chromium.launch({executablePath,headless:true,args:['--disable-http2','--no-sandbox']});}catch(e){last=e;}
  }
  throw new Error(`Chrome/Edge/Chromium not found: ${last?.message||''}`);
}
async function requestHttp1(context,endpoint,param,referer){
  const url=new URL(`${endpoint}?param=${encodeURIComponent(JSON.stringify(param))}`);
  const cookies=await context.cookies([referer||endpoint,endpoint]).catch(()=>[]);
  const cookie=cookies.map(c=>`${c.name}=${c.value}`).join('; ');
  return await new Promise((resolve,reject)=>{
    let done=false; const finish=(fn,v)=>{if(done)return;done=true;fn(v);};
    const req=https.request({protocol:'https:',hostname:url.hostname,port:443,path:`${url.pathname}${url.search}`,method:'GET',agent:false,headers:{
      'user-agent':UA,'accept':'application/json,text/plain,*/*','accept-language':'zh-CN,zh;q=0.9,en;q=0.6','connection':'close',
      ...(referer?{referer}:{}),...(cookie?{cookie}:{}),
    }},res=>{
      const chunks=[]; res.on('data',d=>chunks.push(d));
      res.on('end',()=>{try{if((res.statusCode||0)<200||(res.statusCode||0)>=300)throw new Error(`HTTP ${res.statusCode}`);finish(resolve,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){finish(reject,e);}});
    });
    req.setTimeout(45000,()=>req.destroy(new Error('HTTP/1.1 timeout')));
    req.on('error',e=>finish(reject,e)); req.end();
  });
}
async function requestJson(page,context,endpoint,param,referer,label){
  const url=`${endpoint}?param=${encodeURIComponent(JSON.stringify(param))}`;
  const plan=['http1','page','navigation','request'];
  const cooldown=[15000,30000,60000];
  let last,diags=[];
  for(let round=1;round<=plan.length;round++){
    const channel=plan[round-1];
    try{
      let json;
      if(channel==='http1') json=await requestHttp1(context,endpoint,param,referer);
      else if(channel==='page'){
        json=await page.evaluate(async ({endpoint,param})=>{
          const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),35000);
          try{const r=await fetch(`${endpoint}?param=${encodeURIComponent(JSON.stringify(param))}`,{credentials:'include',cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}finally{clearTimeout(timer);}
        },{endpoint,param});
      }else if(channel==='navigation'){
        const apiPage=await context.newPage();
        try{const r=await apiPage.goto(url,{waitUntil:'commit',timeout:45000,...(referer?{referer}:{})});if(!r||!r.ok())throw new Error(`HTTP ${r?.status()||'none'}`);json=await r.json();}finally{await apiPage.close().catch(()=>{});}
      }else{
        const r=await context.request.get(url,{timeout:45000,headers:referer?{referer}:undefined});if(!r.ok())throw new Error(`HTTP ${r.status()}`);json=await r.json();
      }
      assertOk(json,label); if(round>1)console.log(`${label} 已恢复（通道=${channel}）。`); return json;
    }catch(e){last=e;diags.push(`${channel}: ${shortError(e)}`);}
    if(round<plan.length){const wait=cooldown[round-1]+jitter(0,3000);console.log(`${label} 网络中断；为避免触发限流，冷却 ${Math.round(wait/1000)} 秒后换通道重试 ${round}/${plan.length-1}：${diags.slice(-2).join(' | ')}`);await delay(wait);}
  }
  throw new Error(`${label} 多通道低频重试仍失败，疑似临时限流/风控或网络链路异常；建议 30-60 分钟后再试：${shortError(last)}`);
}

const shop=arg('url','').trim();
if(!shop) throw new Error('缺少 --url 微店地址');
const out=arg('out','categories.json');
const shopId=shopIdFromUrl(shop);
const nav=`https://h5.weidian.com/decoration/shop-category/?userid=${encodeURIComponent(shopId)}`;
const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'zh-CN',userAgent:UA,extraHTTPHeaders:{'Accept-Language':'zh-CN,zh;q=0.9,en;q=0.6'}});
  const page=await context.newPage();
  try{await page.goto(nav,{waitUntil:'domcontentloaded',timeout:35000});}catch{}
  const json=await requestJson(page,context,
    'https://thor.weidian.com/decorate/itemCate.getCateTree/1.0',
    {shopId:String(shopId),attrQuery:[],from:'h5'},nav,'分类树');
  const cats=(json.result?.cateList||[]).map(c=>({
    cateId:String(c.cateId||''),cateName:String(c.cateName||'').trim(),itemCount:Number(c.speCateItemNum||0)
  })).filter(c=>c.cateId&&c.cateName);
  await fs.writeFile(out,JSON.stringify({shopId,categories:cats},null,2),'utf8');
  console.log(`OK categories=${cats.length}`);
}finally{await browser.close().catch(()=>{});}
