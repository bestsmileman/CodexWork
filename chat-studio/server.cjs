const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const root = __dirname;
const workspace = path.dirname(root);
const port = Number(process.env.MARU_PORT || 4317);
const host = `127.0.0.1:${port}`;
const secret = crypto.randomBytes(32).toString('hex');
const clients = new Set(), pending = new Map(), approvals = new Map();
const activeTurns=new Map();
let fileWatcher;
const fileTimers=new Map();
const dataDir=path.join(root,'.maru');
const storeFile=path.join(dataDir,'state.json');
let store={revision:0,state:null};
try{if(fs.existsSync(storeFile))store=JSON.parse(fs.readFileSync(storeFile,'utf8'))}catch(error){console.error('마루 저장 파일을 읽지 못했습니다. 백업 파일을 확인해 주세요.');process.exit(1)}
const replay=[];let eventSequence=0;
let sequence = 0, engine, ready, engineError = '';

function locateCodex() {
  if (process.env.MARU_CODEX_PATH) return process.env.MARU_CODEX_PATH;
  const bin = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
  try {
    const candidates = fs.readdirSync(bin).map(n => path.join(bin,n,'codex.exe')).filter(p => fs.existsSync(p));
    candidates.sort((a,b) => fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
    if(candidates[0]) return candidates[0];
  } catch {}
  return 'codex';
}
function publish(event) {
  const id=++eventSequence;
  const frame = `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`;
  replay.push({id,frame});if(replay.length>1000)replay.shift();
  for(const client of clients) client.write(frame);
}
function write(message) {
  if(!engine || engine.killed || !engine.stdin.writable) throw new Error('Codex 엔진이 연결되어 있지 않습니다.');
  engine.stdin.write(JSON.stringify(message)+'\n');
}
function rpc(method, params = {}) {
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${method}: 응답 대기 시간을 초과했습니다.`))},60000);
    pending.set(id,{resolve,reject,timer});
    try{write({id,method,params})}catch(e){clearTimeout(timer);pending.delete(id);reject(e)}
  });
}
async function connect() {
  engine = spawn(locateCodex(), ['app-server'], {cwd:workspace,windowsHide:true,stdio:['pipe','pipe','pipe']});
  engine.on('error',fail);
  engine.stdin.on('error',fail);
  engine.stderr.on('data',()=>{});
  engine.on('exit',code=>fail(new Error(`Codex 엔진이 종료되었습니다 (${code}).`)));
  const lines=readline.createInterface({input:engine.stdout});
  lines.on('line',line=>{
    let message;try{message=JSON.parse(line)}catch{return}
    if(message.method && message.id!==undefined){
      approvals.set(String(message.id),message);
      publish({type:'request',message});
    }else if(message.method){
      if(message.method==='turn/started')activeTurns.set(message.params?.turn?.id,message.params?.threadId);
      if(message.method==='turn/completed')activeTurns.delete(message.params?.turn?.id);
      if(message.method==='serverRequest/resolved'){
        const id=message.params?.requestId;approvals.delete(String(id));publish({type:'request-resolved',id});
      }
      publish({type:'event',message});
    }
    else if(pending.has(message.id)){
      const task=pending.get(message.id);pending.delete(message.id);clearTimeout(task.timer);
      message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);
    }
  });
  await rpc('initialize',{clientInfo:{name:'maru_chat_studio',title:'마루 Chat Studio',version:'0.3.0'},capabilities:{experimentalApi:true}});
  write({method:'initialized',params:{}});
  return true;
}
function fail(error) {
  engineError=error.message;
  for(const task of pending.values()){clearTimeout(task.timer);task.reject(error)}pending.clear();
  publish({type:'engine-error',message:engineError});
}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
async function body(req,max=2*1024*1024){const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>max)throw new Error('요청이 너무 큽니다.');chunks.push(part)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
const allowed = new Set(['account/read','model/list','thread/start','thread/resume','thread/read','thread/list','thread/turns/list','thread/items/list','turn/start','turn/interrupt']);
const server=http.createServer(async(req,res)=>{
  try{
    // Reject DNS rebinding and cross-origin requests before exposing the local agent.
    if(req.headers.host!==host || (req.headers.origin && req.headers.origin!==`http://${host}`))return json(res,403,{error:'다른 출처에서의 접근은 허용되지 않습니다.'});
    const url=new URL(req.url,`http://${host}`);
    if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'다른 사이트에서의 접근은 허용되지 않습니다.'});
    if(url.pathname==='/api/health' && req.method==='GET')return json(res,200,{app:'maru-chat-studio',version:'0.3.0'});
    if(url.pathname==='/api/session' && req.method==='GET'){
      res.setHeader('Set-Cookie',`maru=${secret}; HttpOnly; SameSite=Strict; Path=/`);
      return json(res,200,{workspace});
    }
    if(url.pathname.startsWith('/api/')){
      if(!(req.headers.cookie||'').split(';').some(c=>c.trim()===`maru=${secret}`))return json(res,401,{error:'마루 페이지를 새로고침해 주세요.'});
      if(url.pathname==='/api/shutdown' && req.method==='POST'){
        if(activeTurns.size)return json(res,409,{error:'진행 중인 작업이 있습니다. 마루에서 작업을 마치거나 중지한 뒤 종료해 주세요.'});
        json(res,200,{ok:true});setTimeout(stop,100);return;
      }
      if(url.pathname==='/api/events' && req.method==='GET'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Content-Type-Options':'nosniff'});
        clients.add(res);res.write(`data: ${JSON.stringify({type:'connected'})}\n\n`);
        const last=Number(req.headers['last-event-id']);
        if(last){if(last>eventSequence||last<(replay[0]?.id||1)-1)res.write(`data: ${JSON.stringify({type:'resync'})}\n\n`);else for(const e of replay)if(e.id>last)res.write(e.frame)}
        for(const message of approvals.values())res.write(`data: ${JSON.stringify({type:'request',message})}\n\n`);
        const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),20000);
        req.on('close',()=>{clients.delete(res);clearInterval(heartbeat)});return;
      }
      if(url.pathname==='/api/store' && req.method==='GET')return json(res,200,store);
      if(url.pathname==='/api/file' && req.method==='GET'){
        const filePath=fs.realpathSync(path.resolve(workspace,url.searchParams.get('path')||''));
        const relative=path.relative(fs.realpathSync(workspace),filePath);
        if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return json(res,403,{error:'작업 폴더 안의 파일만 볼 수 있습니다.'});
        if(!/\.(txt|md|csv|json|js|cjs|mjs|ts|tsx|jsx|html|css|py|xml|ya?ml|log|toml|sql|ps1|cmd)$/i.test(filePath))return json(res,400,{error:'현재는 텍스트·문서·코드 파일을 미리 볼 수 있습니다.'});
        if(!fs.statSync(filePath).isFile()||fs.statSync(filePath).size>512*1024)return json(res,400,{error:'미리보기는 512KB 이하의 텍스트 파일을 지원합니다.'});
        const text=fs.readFileSync(filePath,'utf8');if(text.includes('\0'))return json(res,400,{error:'텍스트로 읽을 수 없는 파일입니다.'});
        return json(res,200,{path:relative,name:path.basename(filePath),text});
      }
      if(url.pathname==='/api/store' && req.method==='POST'){
        const incoming=await body(req,20*1024*1024);
        if(incoming.revision!==store.revision)return json(res,409,{error:'다른 창에서 대화가 변경되었습니다. 백업 후 새로고침해 주세요.'});
        if(!incoming.state || !Array.isArray(incoming.state.chats))return json(res,400,{error:'잘못된 마루 저장 형식입니다.'});
        const next={revision:store.revision+1,state:incoming.state};
        fs.mkdirSync(dataDir,{recursive:true});
        fs.writeFileSync(storeFile+'.tmp',JSON.stringify(next),'utf8');
        if(fs.existsSync(storeFile))fs.copyFileSync(storeFile,storeFile+'.bak');
        fs.renameSync(storeFile+'.tmp',storeFile);store=next;
        return json(res,200,{revision:store.revision});
      }
      if(url.pathname==='/api/status' && req.method==='GET'){
        try{await ready;if(engineError)throw new Error(engineError);const account=await rpc('account/read',{refreshToken:false});return json(res,200,{connected:true,account:account.account?{type:account.account.type}:null,workspace})}
        catch(e){return json(res,200,{connected:false,error:e.message,workspace})}
      }
      if(url.pathname==='/api/rpc' && req.method==='POST'){
        const {method,params:input={}}=await body(req);
        if(!allowed.has(method))return json(res,403,{error:'지원하지 않는 작업입니다.'});
        await ready;
        if(!input || typeof input!=='object' || Array.isArray(input))return json(res,400,{error:'잘못된 요청 형식입니다.'});
        const fields={
          'account/read':['refreshToken'], 'model/list':['cursor','limit'],
          'thread/start':['model'], 'thread/resume':['threadId'],
          'thread/read':['threadId','includeTurns'], 'thread/list':['cursor','limit'],
          'thread/turns/list':['threadId','cursor','limit','sortDirection','itemsView'],
          'thread/items/list':['threadId','turnId','cursor','limit','sortDirection'],
          'turn/start':['threadId','input','model'], 'turn/interrupt':['threadId','turnId']
        };
        const params=Object.fromEntries(fields[method].filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]]));
        // Keep the initial workspace sandbox and approval policy fixed on the server.
        if(method==='thread/start' || method==='thread/resume'){
          params.cwd=workspace;params.approvalPolicy='on-request';params.sandbox='workspace-write';
        }
        if(method==='turn/start'){
          delete params.sandboxPolicy;delete params.cwd;delete params.approvalPolicy;
        }
        return json(res,200,{result:await rpc(method,params)});
      }
      if(url.pathname==='/api/approval' && req.method==='POST'){
        const {id,allow,answers,content}=await body(req);const request=approvals.get(String(id));
        if(!request)return json(res,404,{error:'이미 처리되었거나 만료된 요청입니다.'});
        const granted=allow===true;let result;
        if(request.method==='item/commandExecution/requestApproval'||request.method==='item/fileChange/requestApproval')result={decision:granted?'accept':'decline'};
        else if(request.method==='execCommandApproval'||request.method==='applyPatchApproval')result={decision:granted?'approved':'denied'};
        else if(request.method==='item/permissions/requestApproval')result={permissions:granted?request.params.permissions:{},scope:'turn'};
        else if(request.method==='item/tool/requestUserInput'){
          const normalized={};for(const q of request.params.questions||[]){const text=granted?answers?.[q.id]?.answers?.[0]:'사용자가 답변을 취소했습니다.';if(typeof text!=='string'||!text.trim())return json(res,400,{error:'모든 질문에 답변해 주세요.'});normalized[q.id]={answers:[text.slice(0,20000)]}}result={answers:normalized};
        }else if(request.method==='mcpServer/elicitation/request'){
          const value={};const schema=request.params.requestedSchema||{};
          if(granted&&request.params.mode!=='url')for(const [key,field]of Object.entries(schema.properties||{})){
            if(content&&Object.hasOwn(content,key)){
              const v=content[key];
              if(field.type==='boolean'&&typeof v!=='boolean')return json(res,400,{error:'선택값 형식이 올바르지 않습니다.'});
              if(['number','integer'].includes(field.type)&&(typeof v!=='number'||!Number.isFinite(v)||(field.type==='integer'&&!Number.isInteger(v))))return json(res,400,{error:'숫자 형식이 올바르지 않습니다.'});
              if((!field.type||field.type==='string')&&typeof v!=='string')return json(res,400,{error:'입력값 형식이 올바르지 않습니다.'});
              if(field.enum&&!field.enum.includes(v))return json(res,400,{error:'목록에서 값을 선택해 주세요.'});
              value[key]=v;
            }
            if((schema.required||[]).includes(key)&&(!Object.hasOwn(value,key)||value[key]===''))return json(res,400,{error:'필수 항목을 입력해 주세요.'});
          }
          result={action:granted?'accept':'decline',content:granted&&request.params.mode!=='url'?value:null};
        }else if(request.method==='item/tool/call')result={success:false,contentItems:[{type:'inputText',text:'이 호스트 도구는 마루에 아직 연결되어 있지 않습니다.'}]};
        else result={action:'decline',content:null};
        write({id:request.id,result});approvals.delete(String(id));publish({type:'request-resolved',id});
        return json(res,200,{ok:true});
      }
      return json(res,404,{error:'요청을 찾을 수 없습니다.'});
    }
    const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
    if(req.method!=='GET' || !assets[url.pathname])return json(res,404,{error:'페이지를 찾을 수 없습니다.'});
    const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html';
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});
    res.end(fs.readFileSync(path.join(root,assets[url.pathname])));
  }catch(e){if(!res.headersSent)json(res,500,{error:e.message});else res.end()}
});
server.on('error',error=>{console.error(error.message);if(engine)engine.kill();process.exitCode=1});
server.listen(port,'127.0.0.1',()=>{
  console.log(`마루: http://${host}\n작업 폴더: ${workspace}`);
  try{
    fileWatcher=fs.watch(workspace,{recursive:true},(event,file)=>{
      if(!activeTurns.size||!file)return;
      const relative=String(file).replaceAll('\\','/');
      if(/(^|\/)(\.git|node_modules|\.maru|\.codex|\.agents|\.aws)(\/|$)/i.test(relative))return;
      const filePath=path.resolve(workspace,String(file));
      const threadIds=[...new Set(activeTurns.values())].filter(Boolean);
      clearTimeout(fileTimers.get(filePath));
      fileTimers.set(filePath,setTimeout(()=>{
        fileTimers.delete(filePath);
        try{if(fs.statSync(filePath).isFile())publish({type:'workspace-file',path:filePath,threadIds,at:Date.now()})}catch{}
      },120));
    });
    fileWatcher.on('error',()=>publish({type:'event',message:{method:'warning',params:{message:'폴더 변경 감시를 사용할 수 없습니다. Codex가 알려 주는 파일 변경만 표시합니다.'}}}));
  }catch{console.error('폴더 변경 감시를 사용할 수 없습니다.')}
  ready=connect();ready.catch(error=>{engineError=error.message;console.error('Codex 연결 오류:',error.message)});
});
let stopping=false;
function stop(){if(stopping)return;stopping=true;fileWatcher?.close();for(const timer of fileTimers.values())clearTimeout(timer);for(const c of clients)c.end();if(engine?.stdin.writable)engine.stdin.end();server.close();setTimeout(()=>{if(engine&&engine.exitCode===null)engine.kill();process.exit()},3000).unref()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
