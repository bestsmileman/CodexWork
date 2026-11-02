const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const http=require('node:http');
const root='http://127.0.0.1:4317';
(async()=>{
  let r=await fetch(root+'/api/health');assert.equal((await r.json()).app,'maru-chat-studio');
  r=await fetch(root+'/api/store');assert.equal(r.status,401);
  r=await fetch(root+'/api/session',{headers:{origin:'https://example.com'}});assert.equal(r.status,403);
  const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(root+'/api/session',{headers:{host:'example.com:4317'}},res=>{resolve(res.statusCode);res.resume()});req.on('error',reject)});assert.equal(hostStatus,403);
  const crossSiteStatus=await new Promise((resolve,reject)=>{const req=http.get(root+'/api/session',{headers:{'sec-fetch-site':'cross-site'}},res=>{resolve(res.statusCode);res.resume()});req.on('error',reject)});assert.equal(crossSiteStatus,403);
  r=await fetch(root+'/api/session');const cookie=r.headers.get('set-cookie').split(';')[0];
  for(const [file,mime] of [['/','text/html'],['/app.js','text/javascript'],['/styles.css','text/css']]){r=await fetch(root+file);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(mime))}
  r=await fetch(root+'/.maru/state.json');assert.equal(r.status,404);
  r=await fetch(root+'/api/rpc',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({method:'command/exec',params:{}})});assert.equal(r.status,403);
  r=await fetch(root+'/api/approval',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({id:'nonexistent',allow:true})});assert.equal(r.status,404);
  r=await fetch(root+'/api/store',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({revision:-1,state:{chats:[]}})});assert.equal(r.status,409);
  const outside=path.join(process.env.USERPROFILE||'C:/Users/Administrator','.codex','config.toml');
  r=await fetch(root+'/api/file?path='+encodeURIComponent(outside),{headers:{cookie}});assert.equal(r.status,403);
  r=await fetch(root+'/api/file?path='+encodeURIComponent('chat-studio/README.md'),{headers:{cookie}});assert.equal(r.status,200);assert.match((await r.json()).text,/마루 Chat Studio/);
  const expected=fs.readFileSync(path.join(__dirname,'.maru','qa','config-before.sha256'),'utf8');
  const actual=crypto.createHash('sha256').update(fs.readFileSync(outside)).digest('hex');assert.equal(actual,expected);
  console.log('PASS local origin, session isolation, asset serving, RPC restrictions, save conflict protection and workspace file boundaries');
  console.log('PASS existing Codex config file is unchanged');
})().catch(error=>{console.error(error.stack);process.exitCode=1});
