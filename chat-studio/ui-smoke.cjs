// Browser acceptance checks against the real local Maru server. No browser library required.
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=__dirname;
const qa=path.join(root,'.maru','qa');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const log=[];
let browser,ws;
async function main(){
  fs.mkdirSync(qa,{recursive:true});
  const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p=>fs.existsSync(p));
  if(!chrome)throw new Error('검증용 Chrome 또는 Edge를 찾을 수 없습니다.');
  const profile=path.join(qa,'browser-'+Date.now());
  browser=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--disable-extensions','--no-proxy-server','about:blank'],{windowsHide:true,stdio:'ignore'});
  browser.on('error',e=>console.error(e.message));
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let n=0;n<100&&!fs.existsSync(portFile);n++)await delay(100);
  if(!fs.existsSync(portFile))throw new Error('검증용 브라우저를 시작하지 못했습니다.');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown'){errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}};
  function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
  async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
  async function until(expression,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(200)}throw new Error('Timed out: '+expression)}
  async function shot(name){const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(qa,name+'.png'),Buffer.from(result.data,'base64'))}
  function pass(name){log.push(name);console.log('PASS '+name)}
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.EventSource=class extends EventSource {constructor(...args){super(...args);window.__qaEventSource=this}}'});
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://127.0.0.1:4317/'});
  await until("document.querySelector('#connectionTitle')?.textContent==='Codex와 연결됨'");
  await evaluate("document.querySelector('#newChat').click()");
  assert.equal(await evaluate("document.querySelectorAll('.prompt-card').length"),4);
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  await shot('01-welcome');pass('desktop layout and live Codex authentication');
  await evaluate("document.querySelector('.prompt-card').click()");
  assert.match(await evaluate("document.querySelector('#messageInput').value"),/문서/);
  await evaluate("document.querySelector('#messageInput').value='';document.querySelector('#messageInput').dispatchEvent(new Event('input'))");pass('suggestion populates the composer without sending');
  await evaluate("document.querySelector('#themeToggle').click()");
  assert.equal(await evaluate("document.body.classList.contains('dark')"),true);await shot('02-night');
  await evaluate("document.querySelector('#themeToggle').click()");pass('light and dark theme');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  await evaluate("document.querySelector('#menuOpen').click()");assert.equal(await evaluate("document.querySelector('#sidebar').classList.contains('open')"),true);
  await evaluate("document.querySelector('#sidebarBackdrop').click()");await delay(300);await shot('03-mobile');pass('mobile layout and navigation');
  if(process.env.MARU_VISUAL_ONLY==='1'||process.argv.includes('--visual-only')){await cdp('Browser.close');return}
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  // One real Codex request verifies text streaming and a workspace file operation.
  await evaluate("(()=>{const dt=new DataTransfer();dt.items.add(new File(['마루 첨부 검증 자료'], 'maru-test.txt',{type:'text/plain'}));const input=document.querySelector('#fileInput');input.files=dt.files;input.dispatchEvent(new Event('change'))})()");
  await until("document.querySelectorAll('.attachment-chip').length===1");pass('text file attachment');
  const prompt='마루 연결 검증입니다. chat-studio/README.md 파일을 실제 도구로 읽고 첫 제목을 알려 주세요. 그리고 chat-studio/examples/연결_확인.md 파일 하나만 생성하거나 갱신하여 첫 줄에 # 마루에서 만든 문서, 다음 줄에 첨부 자료의 내용을 그대로 적어 주세요. 그 외 파일은 수정하지 마세요. 답변 마지막에 MARU_CONNECTION_OK를 한 번 적어 주세요.';
  await evaluate(`document.querySelector('#messageInput').value=${JSON.stringify(prompt)};document.querySelector('#chatForm').requestSubmit()`);
  await until("document.querySelectorAll('.message.user').length===1");
  await until("document.querySelector('#turnProgress').hidden && document.querySelector('#messages').textContent.includes('MARU_CONNECTION_OK')",120000);
  assert.equal(await evaluate("document.querySelector('#messages').textContent.includes('요청을 처리하지 못했습니다.')"),false);
  assert.equal(await evaluate("Number(document.querySelector('#activityCount').textContent)>0"),true);
  assert.match(fs.readFileSync(path.join(root,'examples','연결_확인.md'),'utf8'),/마루 첨부 검증 자료/);
  await shot('04-conversation');pass('real Codex streaming, file-reading and file-writing tools');
  await evaluate("document.querySelector('#workspaceToggle').click();document.querySelector('[data-panel=files]').click()");
  await until("document.querySelectorAll('#changedFiles button').length>=1");
  await evaluate("document.querySelector('#changedFiles button').click()");
  await until("document.querySelector('#fileDialog').open");
  assert.match(await evaluate("document.querySelector('#filePreviewText').textContent"),/마루에서 만든 문서/);
  await evaluate("document.querySelector('#fileDialog').close()");pass('generated file preview');
  await evaluate("document.querySelector('[data-panel=notes]').click();document.querySelector('#notesInput').value='마루 검증 메모';document.querySelector('#notesInput').dispatchEvent(new Event('input'))");
  await until("document.querySelector('#saveStatus').textContent==='브라우저와 PC에 저장됨'");
  const mainChatId=await evaluate("document.querySelector('.chat-item.active .chat-main').dataset.chatId");
  const renderId='maru-qa-'+Date.now();
  const backup={chats:[{id:renderId,title:'마루 표시 검증',messages:[{role:'assistant',text:'# 문서 표시\n\n**강조**와 `코드`\n\n| 항목 | 결과 |\n| --- | --- |\n| 화면 | 정상 |\n\n```js\nconsole.log("maru");\n```\n\n<img src=x onerror="window.__unsafe=true">\n\n[위험 링크](javascript:alert(1))'}]}]};
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(backup))}], 'render-check.json',{type:'application/json'}));const input=document.querySelector('#importInput');input.files=dt.files;input.dispatchEvent(new Event('change'))})()`);
  await until("[...document.querySelectorAll('.chat-main')].some(b=>b.textContent.includes('마루 표시 검증'))");
  await evaluate("[...document.querySelectorAll('.chat-main')].find(b=>b.textContent.includes('마루 표시 검증')).click()");
  assert.equal(await evaluate("document.querySelectorAll('.message-content table').length"),1);
  assert.equal(await evaluate("document.querySelectorAll('.message-content pre code').length"),1);
  assert.equal(await evaluate("document.querySelectorAll('.message-content img').length"),0);
  assert.equal(await evaluate("!!window.__unsafe || !!document.querySelector('.message-content a[href^=javascript]')"),false);pass('Markdown, tables, code and safe HTML rendering');
  await evaluate("document.querySelector('.chat-item.active .chat-menu').click();[...document.querySelector('.chat-item.active').querySelectorAll('.chat-options button')].find(b=>b.textContent==='마루에서 삭제').click()");
  await until("document.querySelector('#confirmDialog').open");await evaluate("document.querySelector('#confirmAccept').click()");
  // Exercise the request form with an isolated synthetic event, never an actual approval.
  const request={type:'request',message:{id:'qa-only-form',method:'item/tool/requestUserInput',params:{questions:[{id:'choice',header:'선택',question:'화면 검증용 질문',options:[{label:'진행',description:'검증을 계속합니다.'},{label:'취소',description:'검증을 취소합니다.'}]}]}}};
  await evaluate(`window.__qaEventSource.onmessage({data:${JSON.stringify(JSON.stringify(request))}})`);
  assert.equal(await evaluate("document.querySelector('#approvalDialog').open"),true);
  assert.equal(await evaluate("document.querySelectorAll('#approvalFields select option').length"),3);
  await evaluate("document.querySelector('#approvalDeny').click()");await until("!document.querySelector('#approvalDialog').open");pass('approval question form and expired-request handling');
  await evaluate(`[...document.querySelectorAll('.chat-main')].find(b=>b.dataset.chatId===${JSON.stringify(mainChatId)}).click()`);
  await until("document.querySelector('#saveStatus').textContent==='브라우저와 PC에 저장됨'");
  await shot('05-workspace');pass('per-conversation notes and server persistence');
  await cdp('Page.reload');await until("document.querySelector('#connectionTitle')?.textContent==='Codex와 연결됨'");
  await until("document.querySelector('#messages').textContent.includes('MARU_CONNECTION_OK')");
  assert.equal(await evaluate("document.querySelector('#notesInput').value"),'마루 검증 메모');pass('conversation and notes survive reload');
  await evaluate("document.querySelector('#searchOpen').click();document.querySelector('#searchInput').value='MARU_CONNECTION_OK';document.querySelector('#searchInput').dispatchEvent(new Event('input'))");
  assert.equal(await evaluate("document.querySelectorAll('.search-result').length>=1"),true);
  await evaluate("document.querySelector('#searchDialog').close()");pass('full-text conversation search');
  await evaluate("document.querySelector('.chat-item.active .chat-menu').click();[...document.querySelector('.chat-item.active').querySelectorAll('.chat-options button')].find(b=>b.textContent==='즐겨찾기에 추가').click();document.querySelector('[data-filter=pinned]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.chat-item').length>=1"),true);pass('favorites filter');
  // Restore an empty start screen; only remove the conversation this test created.
  await evaluate("document.querySelector('.chat-item.active .chat-menu').click();[...document.querySelector('.chat-item.active').querySelectorAll('.chat-options button')].find(b=>b.textContent==='마루에서 삭제').click()");
  await until("document.querySelector('#confirmDialog').open");
  await evaluate("document.querySelector('#confirmAccept').click();document.querySelector('[data-filter=all]').click();document.querySelector('#newChat').click()");
  await until("document.querySelector('#saveStatus').textContent==='브라우저와 PC에 저장됨'");
  assert.deepEqual(errors,[]);pass('no browser JavaScript errors');
  fs.writeFileSync(path.join(qa,'results.json'),JSON.stringify({at:new Date().toISOString(),passed:log,errors},null,2));
  fs.rmSync(path.join(qa,'failure.txt'),{force:true});
  await cdp('Browser.close');
}
main().catch(error=>{console.error(error.stack);fs.mkdirSync(qa,{recursive:true});fs.writeFileSync(path.join(qa,'failure.txt'),error.stack);process.exitCode=1}).finally(()=>{if(ws)ws.close();if(browser&&!browser.killed)browser.kill()});
