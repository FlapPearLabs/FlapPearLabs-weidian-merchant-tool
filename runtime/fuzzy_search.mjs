function nfkc(s){ try{return String(s||'').normalize('NFKC');}catch{return String(s||'');} }

export function normalizeFuzzyText(s){
  let x=nfkc(s).toLowerCase();
  // 只做稳定、领域无关的归一化，不依赖品牌词典/分词器。
  x=x.replace(/degrees?/gi,'degree');
  x=x.replace(/(\d+(?:\.\d+)?)\s*度/g,'$1degree');
  x=x.replace(/(\d+(?:\.\d+)?)\s*(毫升|ml)/gi,'$1ml');
  x=x.replace(/(\d+(?:\.\d+)?)\s*(克|g)/gi,'$1g');
  x=x.replace(/[【】\[\]()（）{}<>《》“”‘’'"`~!！@#$%^&*+=|\\/:：;；,，.。?？_\-·•\s]+/g,'');
  return x;
}

function grams(s,n){
  const a=[...String(s||'')], set=new Set();
  if(a.length<n){ if(a.length)set.add(a.join('')); return set; }
  for(let i=0;i<=a.length-n;i++)set.add(a.slice(i,i+n).join(''));
  return set;
}
function dice(a,b){ if(!a.size&&!b.size)return 1; let c=0; for(const x of a)if(b.has(x))c++; return 2*c/(a.size+b.size||1); }
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
function chunksFromTarget(raw){
  const parts=String(raw||'').trim().split(/[\s,，;；|、/]+/).map(x=>normalizeFuzzyText(x)).filter(Boolean);
  return [...new Set(parts)];
}
function weightedChunkCoverage(titleNorm,chunks){
  if(!chunks.length)return 0;
  let total=0,hit=0;
  for(const c of chunks){ const w=Math.max(1,[...c].length); total+=w; if(titleNorm.includes(c))hit+=w; }
  return total?hit/total:0;
}
function keyFragments(raw){
  const n=normalizeFuzzyText(raw);
  const ascii=[...n.matchAll(/[a-z]+|\d+(?:\.\d+)?/g)].map(m=>m[0]).filter(x=>x.length>=2 || /^\d/.test(x));
  return [...new Set(ascii)];
}
function keyCoverage(titleNorm,keys){ if(!keys.length)return 0; let n=0; for(const k of keys)if(titleNorm.includes(k))n++; return n/keys.length; }

export function fuzzyScore(target,title){
  const q=normalizeFuzzyText(target), t=normalizeFuzzyText(title);
  if(!q||!t)return {score:0,whole:false,chunkCoverage:0,keyCoverage:0,d2:0,d3:0,bag:0,lev:0};
  if(t.includes(q))return {score:1,whole:true,chunkCoverage:1,keyCoverage:1,d2:1,d3:1,bag:1,lev:q===t?1:q.length/t.length};
  const chunks=chunksFromTarget(target), keys=keyFragments(target);
  const chunkCoverage=weightedChunkCoverage(t,chunks), kc=keyCoverage(t,keys);
  const d2=dice(grams(q,2),grams(t,2)), d3=dice(grams(q,3),grams(t,3));
  const bag=bagCosine(q,t), lev=levRatio(q,t);
  // 关键词顺序变化主要由 chunkCoverage + 字符袋 + n-gram 承担；编辑距离权重很低。
  let score=0.34*chunkCoverage+0.24*d2+0.14*d3+0.16*bag+0.04*lev+0.08*kc;
  if(chunkCoverage>=0.80)score+=0.06;
  if(kc===1&&keys.length)score+=0.03;
  return {score:Math.max(0,Math.min(0.999,score)),whole:false,chunkCoverage,keyCoverage:kc,d2,d3,bag,lev};
}

const CATEGORY_CONCEPTS=[
  {query:['女士','女款','女装','男士','男款','男装','外套','卫衣','裤','短裤','牛仔','裙','连帽','毛衣','针织','夹克','羽绒','t恤','衬衫','内衣','内裤','睡衣','泳衣','帽子','帽'],category:['衣服','服装','服饰','女装','男装','鞋帽'],boost:0.94},
  {query:['鞋','鞋子','拖鞋','人字拖','凉鞋','运动鞋','球鞋','靴','靴子'],category:['鞋','鞋帽','服饰'],boost:0.97},
  {query:['包','钱包','皮带','腰带','背包','手提包','双肩包','斜挎包'],category:['箱包','钱包','皮带','包'],boost:0.96},
  {query:['护肤','面霜','精华','精粹','精萃','爽肤水','乳液','防晒','粉底','口红','彩妆','眼霜','面膜','卸妆','洁面'],category:['化妆品','彩妆','护肤'],boost:0.95},
  {query:['洗发','护发','沐浴','洗护','身体乳','牙膏','漱口','成人洗护'],category:['成人洗护','护发'],boost:0.93},
  {query:['奶粉','米粉','辅食','婴儿','幼儿','宝宝','儿童'],category:['幼儿','儿童','婴幼儿','奶粉','辅食'],boost:0.90},
  {query:['鱼油','虾油','亚麻籽油','维生素','褪黑素','胶原蛋白','蛋白粉','葡萄籽','钙','维骨力','关节','孕妇','备孕','蜂蜜','蜂胶','营养品','保健'],category:['鱼油','虾油','亚麻籽油','维生素','褪黑素','胶原蛋白','蛋白粉','葡萄籽','钙','维骨力','关节','孕妇','备孕','蜂蜜','蜂胶','营养品','保养','养护'],boost:0.93},
  {query:['狗','猫','宠物','犬','猫咪'],category:['宠物'],boost:0.99},
  {query:['锅','锅具','调料','酱油','厨房','烹饪','美食'],category:['厨房','锅具','调料','烹饪','美食'],boost:0.95},
  {query:['家用','居家','电器','百货','日用','收纳'],category:['居家','电器','百货','日用'],boost:0.93},
  {query:['玩具','文具','球','篮球','足球','网球'],category:['文具','玩具','球类'],boost:0.96},
  {query:['首饰','饰品','项链','耳环','耳钉','手链','戒指'],category:['首饰','饰品','装饰'],boost:0.97},
  {query:['零食','咖啡','巧克力','饼干','糖果'],category:['零食','咖啡','巧克力'],boost:0.96},
  {query:['消毒','杀菌','酒精','消毒液'],category:['杀菌','消毒'],boost:0.97},
];
function containsAny(text,arr){const n=normalizeFuzzyText(text);return arr.some(x=>n.includes(normalizeFuzzyText(x)));}
export function routeFuzzyTargetsToCategories(targets,categories){
  const routes=[];
  for(let ti=0;ti<targets.length;ti++){
    const target=String(targets[ti]||'');
    const ranked=(categories||[]).map(c=>{
      const name=String(c?.cateName||'');
      const direct=fuzzyScore(target,name).score;
      let concept=0, reasons=[];
      for(const g of CATEGORY_CONCEPTS){
        if(containsAny(target,g.query) && containsAny(name,g.category)){
          concept=Math.max(concept,g.boost); reasons.push('商品类型→分类');
        }
      }
      const promo=/推荐|折扣|团购|清仓|优惠/.test(name) && !/推荐|折扣|团购|清仓|优惠/.test(target);
      let score=Math.max(direct*0.82,concept);
      if(promo)score*=0.55;
      return {cateId:String(c?.cateId||''),cateName:name,itemCount:Number(c?.itemCount||0),score,direct,concept,reasons};
    }).sort((a,b)=>b.score-a.score || a.itemCount-b.itemCount || a.cateName.localeCompare(b.cateName,'zh-CN'));
    const top=ranked[0]||null, second=ranked[1]||null;
    const margin=top?top.score-Number(second?.score||0):0;
    let confidence='low', use=[];
    if(top && top.score>=0.82){confidence='high';use=[top];}
    else if(top && top.score>=0.62){confidence=margin>=0.12?'high':'medium';use=margin>=0.12?[top]:ranked.slice(0,2);}
    routes.push({targetIndex:ti+1,target,confidence,margin,selectedCategories:use,topCategories:ranked.slice(0,3)});
  }
  return routes;
}

export function rankFuzzyTargets(items,targets,{topPerTarget=20,minScore=0.24,minKeep=5}={}){
  const byId=new Map();
  const stats=[];
  targets.forEach((target,targetIdx)=>{
    const ranked=items.map(item=>{
      const title=[item?.itemName,item?.itemTitle,item?.title,item?.subTitle].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
      const detail=fuzzyScore(target,title);
      return {item,detail,title};
    }).sort((a,b)=>b.detail.score-a.detail.score || String(a.item?.itemId||'').localeCompare(String(b.item?.itemId||'')));
    const picked=[];
    for(let i=0;i<ranked.length && picked.length<topPerTarget;i++){
      if(ranked[i].detail.score>=minScore || picked.length<minKeep)picked.push({...ranked[i],rank:picked.length+1});
    }
    stats.push({targetIndex:targetIdx+1,target,totalScanned:items.length,returned:picked.length,bestScore:picked[0]?.detail.score||0});
    for(const r of picked){
      const id=String(r.item?.itemId||''); if(!id)continue;
      const match={targetIndex:targetIdx+1,target,rank:r.rank,score:r.detail.score,chunkCoverage:r.detail.chunkCoverage,keyCoverage:r.detail.keyCoverage};
      if(!byId.has(id))byId.set(id,{...r.item,fuzzyMatches:[match],fuzzyBestScore:r.detail.score,fuzzyBestTargetIndex:targetIdx+1,fuzzyBestTarget:target});
      else{
        const cur=byId.get(id);cur.fuzzyMatches.push(match);
        if(r.detail.score>Number(cur.fuzzyBestScore||0)){cur.fuzzyBestScore=r.detail.score;cur.fuzzyBestTargetIndex=targetIdx+1;cur.fuzzyBestTarget=target;}
      }
    }
  });
  const out=[...byId.values()].sort((a,b)=>Number(a.fuzzyBestTargetIndex||999)-Number(b.fuzzyBestTargetIndex||999) || Number(b.fuzzyBestScore||0)-Number(a.fuzzyBestScore||0));
  return {items:out,stats};
}

if(process.argv.includes('--self-test')){
  const items=[
    {itemId:'1',itemName:'32 Degrees 女士轻量保暖拉链外套 黑色'},
    {itemId:'2',itemName:'【Costco清仓】女士高腰牛仔短裤 夏季'},
    {itemId:'3',itemName:'CK Calvin Klein 女款人字拖 夹脚拖鞋'},
    {itemId:'4',itemName:'Hollister 女士浅灰色圆领套头卫衣'},
    {itemId:'5',itemName:'Hollister 女士可爱文字印花白色连帽卫衣'},
    {itemId:'6',itemName:'男士黑色商务西装外套'},
  ];
  const targets=['degree 32度 女士 外套','Costco 清仓 女士牛仔短裤','CK 女款 人字拖','Hollister 女士 浅灰色 卫衣','Hollister 女士 可爱文字印花 白色连帽卫衣'];
  const r=rankFuzzyTargets(items,targets,{topPerTarget:3,minKeep:1});
  for(let i=1;i<=5;i++){
    const best=r.items.filter(x=>x.fuzzyMatches.some(m=>m.targetIndex===i)).sort((a,b)=>{
      const sa=a.fuzzyMatches.find(m=>m.targetIndex===i)?.score||0,sb=b.fuzzyMatches.find(m=>m.targetIndex===i)?.score||0;return sb-sa;
    })[0];
    if(!best || best.itemId!==String(i))throw new Error(`fuzzy self-test target ${i} failed: got ${best?.itemId||'none'}`);
  }
  const swapped=fuzzyScore('Hollister 女士 浅灰色 卫衣','女士 Hollister 卫衣 浅灰色');
  if(swapped.score<0.65)throw new Error(`fuzzy self-test reorder score too low ${swapped.score}`);
  const cats=[{cateId:'1',cateName:'衣服鞋帽',itemCount:660},{cateId:'2',cateName:'化妆品/彩妆/护肤',itemCount:206},{cateId:'3',cateName:'箱包/钱包/皮带',itemCount:97}];
  const routes=routeFuzzyTargetsToCategories(['Tommy 女士牛仔短裤','CK女款人字拖','HOLLISTER女士浅灰色宽松卫衣'],cats);
  if(routes.some(r=>r.selectedCategories[0]?.cateId!=='1'))throw new Error(`category router self-test failed: ${JSON.stringify(routes)}`);
  console.log('fuzzy_search v2.5 self-test passed: fuzzy ranking + broad category routing');
}
