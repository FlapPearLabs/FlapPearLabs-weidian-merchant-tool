import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { DatabaseSync, backup } from 'node:sqlite';
import { StateStore } from './state_store.mjs';

function arg(name,def=''){const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]:def;}
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;}
function inspect(file){
  let db; try{db=new DatabaseSync(file,{readOnly:true}); const q=db.prepare('PRAGMA quick_check').all().map(r=>String(Object.values(r)[0]||'')); const n=Number(db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n||0); const schema=Number(db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value||0); return {ok:q.length===1&&q[0].toLowerCase()==='ok',products:n,schema};}catch(e){return {ok:false,products:0,schema:0,error:String(e.message||e)}}finally{try{db?.close()}catch{}}
}
const dbArg=String(arg('db','')).trim(); if(!dbArg)throw new Error('缺少 --db');
const dbPath=path.resolve(dbArg), dataRoot=path.dirname(path.dirname(dbPath)), backupDir=path.join(dataRoot,'backups'), anchorPath=path.join(path.dirname(dbPath),'health_anchor.json');
await fsp.mkdir(backupDir,{recursive:true});
const names=(await fsp.readdir(backupDir)).filter(n=>/^(?:checkpoint_.*|state_\d{4}-\d{2}-\d{2})\.sqlite3$/.test(n)).sort().reverse();
const choices=[];
for(const name of names.slice(0,20)){const file=path.join(backupDir,name),info=inspect(file);if(info.ok)choices.push({file,name,...info});}
if(!choices.length){console.log('没有找到可用的 SQLite 备份。');process.exit(2);}
console.log('============================================');console.log(' 数据中心恢复');console.log('============================================');
console.log('仅在健康检查提示“历史倒退/断档”时使用。恢复会覆盖当前 state.sqlite3。\n');
choices.forEach((x,i)=>console.log(`[${i+1}] ${x.name}｜历史商品 ${x.products}｜Schema ${x.schema}`));
const rl=readline.createInterface({input,output});
const raw=(await rl.question('\n输入“序号 RESTORE”确认恢复，例如 1 RESTORE；其它输入取消: ')).trim();
rl.close();
const m=raw.match(/^(\d+)\s+RESTORE$/i);
if(!m){console.log('已取消。');process.exit(0);}
const idx=Number(m[1])-1;
if(!Number.isInteger(idx)||idx<0||idx>=choices.length){console.log('序号无效，已取消。');process.exit(0);}
const chosen=choices[idx];
if(fs.existsSync(dbPath)){
  let current=null;
  try{current=new DatabaseSync(dbPath);const emergency=path.join(backupDir,`emergency_before_restore_${stamp()}.sqlite3`);await backup(current,emergency);console.log(`当前数据库已先备份：${emergency}`);}finally{try{current?.close()}catch{}}
}
await fsp.rm(`${dbPath}-wal`,{force:true}).catch(()=>{});await fsp.rm(`${dbPath}-shm`,{force:true}).catch(()=>{});
const tmp=`${dbPath}.restore_tmp`;await fsp.copyFile(chosen.file,tmp);await fsp.rename(tmp,dbPath);
const store=new StateStore(dbPath);
try{
  const h=store.healthCheck();if(!h.ok)throw new Error('恢复后的数据库健康检查失败');
  store.bumpHighWater();store.event('DATABASE_RECOVERED','',{source:chosen.file,products:store.productCount()});
  const anchor={version:1,maxProducts:store.productCount(),maxGlobalRecords:store.globalCount(),maxImageEntries:store.imageEntryCount(),lastRunId:'',recoveredFrom:chosen.file,updatedAt:new Date().toISOString()};
  await fsp.writeFile(anchorPath,JSON.stringify(anchor,null,2),'utf8');
  console.log(`恢复完成：历史商品 ${store.productCount()}｜数据库健康 PASS。`);
  console.log('下一次启动会以这个明确恢复点作为新的健康锚点。');
} finally{store.close();}
