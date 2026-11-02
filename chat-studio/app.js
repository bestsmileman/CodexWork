'use strict';
(() => {
const $ = id => document.getElementById(id);
const paths = {
 plus:'M12 5v14M5 12h14',search:'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
 chats:'M4 4h16v12H9l-5 4V4',pin:'M9 3h6l-1 6 4 4H6l4-4-1-6M12 13v8',refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3',
 sidebar:'M3 4h18v16H3zM9 4v16',panel:'M3 4h18v16H3zM15 4v16',lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',
 pen:'M15 4l5 5M4 20l5-1L21 7l-5-5L4 14v6',folder:'M3 6h7l2 3h9v11H3V6',code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M16 8l-3 5-5 3 3-5 5-3',
 arrowUpRight:'M6 18 18 6M6 6h12v12',arrowUp:'M12 20V4m-7 7 7-7 7 7',arrowDown:'M12 4v16m-7-7 7 7 7-7',chevronDown:'m6 9 6 6 6-6',stop:'M6 6h12v12H6z',close:'m6 6 12 12M6 18 18 6',activity:'M3 12h4l3-8 4 16 3-8h4',copy:'M8 8h12v13H8zM16 8V3H3v13h5',file:'M5 3h9l5 5v13H5zM14 3v6h5',more:'M5 12h.01M12 12h.01M19 12h.01',check:'m5 12 4 4L19 6'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`; }
function icons(root=document) { root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon)); }
icons();
const uid = () => crypto.randomUUID();
const KEY='maru-studio-v3';
const defaults={version:3,chats:[],active:null,theme:'light',fontSize:15,model:'',draft:'',welcomeNotes:''};
let state={...defaults}, serverMode=false, online=false, revision=0, saveTimer, saving=false, saveAgain=false, eventSource;
let filter='all', openMenu=null, panel='activity', attachments=[], stickToBottom=true, renderFrame=0, tabWritable=true;
const busy=new Map(), approvalQueue=[], seenRequests=new Set();let activeApproval=null;
function normalize(raw) {
  if(!raw||!Array.isArray(raw.chats))throw new Error('마루 대화 파일이 아닙니다.');
  const chats=raw.chats.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).map(c=>({
    id:c.id,title:typeof c.title==='string'?c.title.slice(0,120):'제목 없는 대화',pinned:!!c.pinned,
    createdAt:Number(c.createdAt)||Date.now(),updatedAt:Number(c.updatedAt)||Date.now(),notes:typeof c.notes==='string'?c.notes:'',
    threadId:typeof(c.threadId||c.codexThreadId)==='string'?(c.threadId||c.codexThreadId):null,
    messages:c.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string').map(m=>({...m,id:typeof m.id==='string'?m.id:uid(),at:Number(m.at)||Date.now(),streaming:false})),
    activity:Array.isArray(c.activity)?c.activity.slice(-250):[],files:Array.isArray(c.files)?c.files:[],sharedFiles:Array.isArray(c.sharedFiles)?c.sharedFiles:[],draft:typeof c.draft==='string'?c.draft:''
  }));
  return {...defaults,chats,active:chats.some(c=>c.id===raw.active)?raw.active:null,theme:['light','dark','system'].includes(raw.theme)?raw.theme:(raw.dark?'dark':'light'),fontSize:[14,15,17].includes(Number(raw.fontSize))?Number(raw.fontSize):15,model:typeof raw.model==='string'?raw.model:'',draft:typeof raw.draft==='string'?raw.draft:'',welcomeNotes:typeof raw.welcomeNotes==='string'?raw.welcomeNotes:''};
}
try{const raw=localStorage.getItem(KEY)||localStorage.getItem('maru-chat-v1');if(raw)state=normalize(JSON.parse(raw))}catch{}
const current=()=>state.chats.find(c=>c.id===state.active);
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3800)}
function escape(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function inline(text){
  const tokens=[];const token=html=>{tokens.push(html);return '\u0000'+(tokens.length-1)+'\u0000'};
  let s=escape(text).replace(/`([^`]+)`/g,(_,t)=>token('<code>'+t+'</code>'));
  s=s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g,(_,label,target)=>{
    const url=target.replace(/&amp;/g,'&');
    if(!/^https?:\/\//i.test(url)){
      if(/^(?:[a-z]:[\\/]|\/|\.{1,2}[\\/])/i.test(url)||/^[^:]+\.(?:md|txt|json|js|cjs|ts|tsx|jsx|html|css|py|csv)(?::\d+)?$/i.test(url))return token('<button class="file-link" data-file="'+target+'">'+label+' ↗</button>');
      return label+' <code>'+target+'</code>';
    }
    return token('<a href="'+target+'" target="_blank" rel="noopener noreferrer">'+label+'</a>');
  });
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,'<em>$1</em>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,n)=>tokens[n]||'');
}
function markdown(text){
  const lines=String(text).replace(/\r/g,'').split('\n');let out='',i=0;
  const tableCells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
  while(i<lines.length){
    const line=lines[i];
    if(/^\s*```/.test(line)){const lang=line.trim().slice(3).trim();const code=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;out+='<div class="code-block"><div class="code-top"><span>'+escape(lang||'code')+'</span><button class="code-copy" type="button">코드 복사</button></div><pre><code>'+escape(code.join('\n'))+'</code></pre></div>';continue}
    if(!line.trim()){i++;continue}
    const heading=line.match(/^(#{1,3})\s+(.+)$/);if(heading){out+=`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;i++;continue}
    if(/^\s*([-*_])\1{2,}\s*$/.test(line)){out+='<hr>';i++;continue}
    if(/^>\s?/.test(line)){const quote=[];while(i<lines.length&&/^>\s?/.test(lines[i]))quote.push(lines[i++].replace(/^>\s?/,''));out+='<blockquote>'+quote.map(inline).join('<br>')+'</blockquote>';continue}
    if(i+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){const heads=tableCells(line);i+=2;let rows='';while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows+='<tr>'+tableCells(lines[i++]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';out+='<div class="table-wrap"><table><thead><tr>'+heads.map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';continue}
    if(/^\s*([-*+] |\d+\. )/.test(line)){const ordered=/^\s*\d+\./.test(line),tag=ordered?'ol':'ul';out+='<'+tag+'>';while(i<lines.length&&(ordered?/^\s*\d+\.\s+/:/^\s*[-*+]\s+/).test(lines[i]))out+='<li>'+inline(lines[i++].replace(/^\s*(?:[-*+]|\d+\.)\s+/,''))+'</li>';out+='</'+tag+'>';continue}
    const paragraph=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,3}\s|>|\s*```|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i])&&!(i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])))paragraph.push(lines[i++]);out+='<p>'+paragraph.map(inline).join('<br>')+'</p>';
  }
  return out;
}
function applyTheme(){document.body.classList.toggle('dark',state.theme==='dark'||(state.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));document.documentElement.style.setProperty('--message-size',state.fontSize+'px');$('themeSelect').value=state.theme;$('fontSelect').value=String(state.fontSize)}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
async function api(route,data){const res=await fetch('/api/'+route,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});let result;try{result=await res.json()}catch{throw new Error('마루 서버의 응답을 확인할 수 없습니다.')}if(!res.ok){const error=new Error(result.error||'요청을 처리하지 못했습니다.');error.status=res.status;throw error}return result}
async function rpc(method,params={}){return (await api('rpc',{method,params})).result}
function localSave(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent=serverMode?'저장 중…':'이 브라우저에 저장됨'}catch{$('saveStatus').textContent='브라우저 저장 실패 · 백업을 내려받으세요'}}
function save(){localSave();if(!serverMode||!tabWritable)return;clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,350)}
async function flushSave(){if(!serverMode||!tabWritable)return;if(saving){saveAgain=true;return}saving=true;try{const r=await api('store',{revision,state});revision=r.revision;$('saveStatus').textContent='브라우저와 PC에 저장됨'}catch(error){if(error.status===409){tabWritable=false;toast('다른 마루 창에서 저장했습니다. 이 창의 내용을 백업한 뒤 새로고침해 주세요.')}else $('saveStatus').textContent='PC 저장 실패 · 브라우저에 보관 중'}finally{saving=false;if(saveAgain){saveAgain=false;flushSave()}}}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function newChat(){if(current())current().draft=$('messageInput').value;else state.draft=$('messageInput').value;state.active=null;attachments=[];openMenu=null;render();$('messageInput').value=state.draft;resizeInput();closeSidebar();save();$('messageInput').focus()}
function createChat(){const chat={id:uid(),title:'새로운 대화',createdAt:Date.now(),updatedAt:Date.now(),pinned:false,messages:[],activity:[],files:[],sharedFiles:[],notes:state.welcomeNotes||'',draft:state.draft||'',threadId:null};state.chats.unshift(chat);state.active=chat.id;state.draft='';state.welcomeNotes='';return chat}
function selectChat(id){if(current())current().draft=$('messageInput').value;else state.draft=$('messageInput').value;state.active=id;attachments=[];openMenu=null;stickToBottom=true;render();$('messageInput').value=current()?.draft||'';resizeInput();closeSidebar();save()}
function closeSidebar(){$('sidebar').classList.remove('open');$('sidebarBackdrop').hidden=true}
function renderHistory(){
  const list=$('chatList');list.replaceChildren();$('chatCount').textContent=state.chats.length;$('pinnedCount').textContent=state.chats.filter(c=>c.pinned).length;
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));$('historyLabel').textContent=filter==='pinned'?'즐겨찾는 대화':'최근 대화';
  const chats=state.chats.filter(c=>filter!=='pinned'||c.pinned).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt);
  if(!chats.length)list.append(el('div','history-empty',filter==='pinned'?'자주 찾는 대화를 즐겨찾기에 담아 보세요.':'아직 비어 있는 마루.\n첫 이야기를 시작해 보세요.'));
  let lastGroup='';for(const c of chats){const age=(Date.now()-c.updatedAt)/86400000;const group=c.pinned?'즐겨찾기':age<1?'오늘':age<7?'지난 7일':'이전 대화';if(group!==lastGroup){list.append(el('div','chat-time',group));lastGroup=group}
    const row=el('div','chat-item'+(c.id===state.active?' active':''));const button=el('button','chat-main');button.dataset.chatId=c.id;button.innerHTML=icon(busy.has(c.id)?'activity':c.pinned?'pin':'chats');button.append(el('span','',c.title));button.title=c.title;button.onclick=()=>selectChat(c.id);
    const menu=el('button','icon-btn chat-menu');menu.innerHTML=icon('more');menu.setAttribute('aria-label',c.title+' 메뉴');menu.setAttribute('aria-expanded',String(openMenu===c.id));menu.onclick=()=>{openMenu=openMenu===c.id?null:c.id;renderHistory()};row.append(button,menu);
    if(openMenu===c.id){const options=el('div','chat-options');const rename=el('button','','이름 바꾸기');rename.onclick=async()=>{const name=await ask('대화 이름 바꾸기','알아보기 쉬운 이름을 붙여 주세요.',c.title);if(name?.trim()){c.title=name.trim().slice(0,120);openMenu=null;save();render()}};const pin=el('button','',c.pinned?'즐겨찾기 해제':'즐겨찾기에 추가');pin.onclick=()=>{c.pinned=!c.pinned;openMenu=null;save();renderHistory()};const remove=el('button','danger','마루에서 삭제');remove.onclick=async()=>{if(busy.has(c.id)){toast('진행 중인 작업을 먼저 중지해 주세요.');return}if(!await ask('대화를 삭제할까요?','마루의 대화와 메모를 삭제합니다. Codex 자체 기록은 삭제하지 않습니다.'))return;state.chats=state.chats.filter(x=>x.id!==c.id);if(state.active===c.id)state.active=null;save();render()};options.append(rename,pin,remove);row.append(options)}list.append(row)
  }
}
function renderMessages(){
  const chat=current(),container=$('messages');const position=$('scrollArea').scrollTop;
  $('welcome').hidden=!!chat?.messages.length;container.hidden=!chat?.messages.length;
  const previous=new Map([...container.children].map(n=>[n.dataset.id,n]));const nodes=[];
  for(const m of chat?.messages||[]){const signature=m.text+'|'+!!m.streaming+'|'+!!m.error;
    const old=previous.get(m.id);if(old&&old._signature===signature&&old._chat===chat){nodes.push(old);continue}
    const article=el('article','message '+m.role+(m.streaming?' streaming':'')+(m.error?' error':''));article.dataset.id=m.id;article._signature=signature;article._chat=chat;
    if(m.role==='assistant'){const heading=el('div','message-heading');heading.innerHTML='<span class="assistant-mark">✳</span><span>마루</span><small>with Codex</small>';article.append(heading)}
    const content=el('div','message-content');if(m.role==='user')content.textContent=m.text;else content.innerHTML=markdown(m.text);article.append(content);
    if(m.attachments?.length){const files=el('div','message-attachments');m.attachments.forEach(f=>files.append(el('span','',f.name)));article.append(files)}
    if(m.role==='assistant'&&!m.streaming){const actions=el('div','message-actions');const copy=el('button','message-action');copy.innerHTML=icon('copy')+'복사';copy.onclick=()=>copyText(m.text);const note=el('button','message-action');note.innerHTML=icon('pen')+'메모에 담기';note.onclick=()=>{chat.notes=(chat.notes?chat.notes+'\n\n':'')+m.text;save();openWorkspace('notes');renderWorkspace();toast('메모에 담았습니다.')};const download=el('button','message-action');download.innerHTML=icon('download');download.title='이 답변 저장';download.setAttribute('aria-label','이 답변을 Markdown 파일로 저장');download.onclick=()=>downloadText('마루_답변.md',m.text,'text/markdown');actions.append(copy,note,download,el('span','message-time',new Date(m.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})));article.append(actions)}
    nodes.push(article)
  }
  for(let i=0;i<nodes.length;i++){if(container.children[i]!==nodes[i])container.insertBefore(nodes[i],container.children[i]||null)}
  while(container.children.length>nodes.length)container.lastElementChild.remove();
  if(stickToBottom)scrollBottom();else $('scrollArea').scrollTop=position;
}
function scheduleMessages(){if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;renderMessages()})}
function renderBusy(){const job=busy.get(state.active);$('turnProgress').hidden=!job;$('turnProgressText').textContent=job?.status||'작업 중입니다';$('sendMessage').hidden=!!job;$('stopTurn').hidden=!job;$('modelSelect').disabled=!!job;$('stopTurn').disabled=!!job&&!job.turnId;$('messageInput').placeholder=job?'작업을 마치면 다음 이야기를 이어가세요…':'마루에 생각을 놓아 보세요…'}
function renderWorkspace(){const chat=current(),activities=chat?.activity||[];$('activityCount').textContent=activities.length;$('activityEmpty').hidden=activities.length>0;$('activityList').replaceChildren();for(const a of activities.slice().reverse()){const item=el('div','activity-item'+(a.status==='failed'?' failed':''));item.append(el('h4','',a.title||'작업'));item.append(el('p','',a.description||''));item.append(el('p','',(a.status==='running'?'진행 중':a.status==='failed'?'실패':'완료')+' · '+new Date(a.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})));if(a.output){const detail=el('details');detail.append(el('summary','','실행 결과 보기'),el('pre','',a.output));item.append(detail)}$('activityList').append(item)}
  const notes=chat?chat.notes:state.welcomeNotes;if(document.activeElement!==$('notesInput'))$('notesInput').value=notes||'';
  for(const [id,files,empty] of [['changedFiles',chat?.files||[],'아직 수정한 파일이 없습니다.'],['sharedFiles',chat?.sharedFiles||[],'첨부한 파일이 없습니다.']]){const area=$(id);area.replaceChildren();if(!files.length)area.append(el('p','file-empty',empty));for(const f of files){const item=el(f.path?'button':'div','file-entry');item.innerHTML=icon('file');const info=el('div','',f.path||f.name);if(f.kind||f.size)info.append(el('small','',f.kind||formatSize(f.size)));item.append(info);if(f.path){item.style.width='100%';item.style.textAlign='left';item.onclick=()=>previewFile(f.path)}area.append(item)}}
}
function render(){applyTheme();$('threadTitle').textContent=current()?.title||'새로운 대화';document.title=(current()?.title?current().title+' · ':'')+'마루 Chat Studio';renderHistory();renderMessages();renderWorkspace();renderBusy()}
function openWorkspace(tab){$('workspace').hidden=false;$('workspaceToggle').setAttribute('aria-expanded','true');if(tab)panel=tab;document.querySelectorAll('[data-panel]').forEach(b=>{const active=b.dataset.panel===panel;b.classList.toggle('active',active);b.setAttribute('aria-selected',active)});['activity','notes','files'].forEach(p=>$('panel-'+p).hidden=p!==panel)}
function scrollBottom(){$('scrollArea').scrollTop=$('scrollArea').scrollHeight;$('scrollBottom').hidden=true}
function resizeInput(){$('messageInput').style.height='auto';$('messageInput').style.height=Math.min($('messageInput').scrollHeight,200)+'px'}
function formatSize(size){return size<1024?size+' B':Math.round(size/1024)+' KB'}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('복사했습니다.')}catch{toast('브라우저가 복사를 허용하지 않았습니다. 텍스트를 선택해 복사해 주세요.')}}
function downloadText(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));const a=el('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function previewFile(path){try{let normalized=path.replace(/:\d+(?::\d+)?$/,'').replace(/#L\d+$/,'');try{normalized=decodeURIComponent(normalized)}catch{}if(/^\/[a-z]:\//i.test(normalized))normalized=normalized.slice(1);const f=await api('file?path='+encodeURIComponent(normalized));$('filePreviewTitle').textContent=f.name;$('filePreviewPath').textContent=f.path;$('filePreviewText').textContent=f.text;$('filePreviewDownload').onclick=()=>downloadText(f.name,f.text);$('filePreviewCopy').onclick=()=>copyText(f.text);$('fileDialog').showModal()}catch(error){toast(error.message)}}
function ask(title,text,value){return new Promise(resolve=>{const d=$('confirmDialog');$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('confirmInput').hidden=value===undefined;$('confirmInput').value=value||'';const finish=result=>{d.close();resolve(result)};$('confirmAccept').onclick=()=>finish(value===undefined?true:$('confirmInput').value);$('confirmCancel').onclick=()=>finish(null);d.oncancel=e=>{e.preventDefault();finish(null)};$('confirmInput').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('confirmAccept').click()}};d.showModal();if(value!==undefined)$('confirmInput').select()})}
function search(){const q=$('searchInput').value.trim().toLocaleLowerCase();const results=$('searchResults');results.replaceChildren();const chats=state.chats.filter(c=>!q||(c.title+' '+c.notes+' '+c.messages.map(m=>m.text).join(' ')).toLocaleLowerCase().includes(q)).sort((a,b)=>b.updatedAt-a.updatedAt);if(!chats.length)results.append(el('div','history-empty','찾으시는 대화가 없습니다. 다른 단어로 검색해 보세요.'));for(const c of chats.slice(0,40)){const button=el('button','search-result');button.append(el('strong','',c.title));const text=c.messages.find(m=>m.text.toLocaleLowerCase().includes(q))?.text||c.notes||'내용 없는 대화';const at=q?Math.max(0,text.toLocaleLowerCase().indexOf(q)-30):0;button.append(el('p','',text.slice(at,at+100)));button.onclick=()=>{$('searchDialog').close();selectChat(c.id)};results.append(button)}}
function renderAttachments(){const area=$('attachments');area.replaceChildren();attachments.forEach((f,i)=>{const chip=el('div','attachment-chip');chip.innerHTML=icon('file');chip.append(el('span','',f.name+' · '+formatSize(f.size)));const remove=el('button','','×');remove.setAttribute('aria-label',f.name+' 첨부 취소');remove.onclick=()=>{attachments.splice(i,1);renderAttachments()};chip.append(remove);area.append(chip)})}
async function attach(files){for(const file of files){if(attachments.length>=8){toast('한 번에 최대 8개 파일을 첨부할 수 있습니다.');break}if(file.size>256*1024||attachments.reduce((s,f)=>s+f.size,0)+file.size>512*1024){toast('파일은 개당 256KB, 전체 512KB까지 첨부할 수 있습니다.');continue}if(!/\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|py|xml|ya?ml|log|toml|sql)$/i.test(file.name)){toast('텍스트·문서·코드 파일을 첨부해 주세요. 이미지와 PDF는 아직 지원하지 않습니다.');continue}const text=await file.text();if(text.includes('\0')){toast('텍스트로 읽을 수 없는 파일입니다.');continue}attachments.push({name:file.name,size:file.size,text})}renderAttachments()}
function activity(chat,item,done=false){
  if(!item?.id)return;const types={commandExecution:'명령 실행',fileChange:'파일 수정',mcpToolCall:'연결 도구 사용',webSearch:'웹 검색',dynamicToolCall:'도구 사용'};if(!types[item.type])return;
  let a=chat.activity.find(a=>a.id===item.id);if(!a){a={id:item.id,title:types[item.type],at:Date.now()};chat.activity.push(a);if(chat.activity.length>250)chat.activity.shift()}
  a.description=item.command||item.tool||item.query||(item.changes||[]).map(c=>c.path).join('\n')||'';a.status=done?(item.status==='failed'||(item.exitCode!=null&&item.exitCode!==0)?'failed':'completed'):'running';a.output=String(item.aggregatedOutput||item.result?.content?.map?.(c=>c.text||'').join('\n')||'').slice(-16000);
  if(item.type==='fileChange'&&done)for(const f of item.changes||[]){const existing=chat.files.find(x=>x.path===f.path);const change={path:f.path,kind:typeof f.kind==='string'?f.kind:f.kind?.type||'수정'};if(existing)Object.assign(existing,change);else chat.files.push(change)}
  if(chat.id===state.active)renderWorkspace();
}
function chatForThread(threadId){return state.chats.find(c=>c.threadId===threadId)}
function finishJob(chat,error){const job=busy.get(chat.id);if(!job)return;let errorShown=false;for(const message of chat.messages){if(message.streaming){message.streaming=false;if(!message.text){message.text=error||'작업을 완료했습니다.';if(error){message.error=true;errorShown=true}}}}if(error&&!errorShown)chat.messages.push({id:uid(),role:'assistant',text:error,at:Date.now(),error:true});busy.delete(chat.id);chat.updatedAt=Date.now();save();if(chat.id===state.active)render();else renderHistory()}
function onEvent(event){
  if(event.type==='workspace-file'){
    for(const threadId of event.threadIds||[]){const chat=chatForThread(threadId);if(!chat)continue;
      if(!chat.files.some(f=>f.path.replaceAll('\\','/').toLowerCase()===event.path.replaceAll('\\','/').toLowerCase()))chat.files.push({path:event.path,kind:'변경 감지'});
      if(chat.id===state.active)renderWorkspace();
    }save();return;
  }
  if(event.type==='request'){if(!seenRequests.has(String(event.message.id))){seenRequests.add(String(event.message.id));approvalQueue.push(event.message);showApproval()}return}
  if(event.type==='request-resolved'){if(activeApproval&&String(activeApproval.id)===String(event.id)){activeApproval=null;$('approvalDialog').close();showApproval()}const i=approvalQueue.findIndex(r=>String(r.id)===String(event.id));if(i>=0)approvalQueue.splice(i,1);return}
  if(event.type==='engine-error'){online=false;connectionUI(false,event.message);for(const chat of state.chats)if(busy.has(chat.id))finishJob(chat,event.message);return}
  if(event.type==='resync'){for(const chat of state.chats)if(chat.threadId)recoverThread(chat);return}
  const msg=event.message;if(!msg)return;const p=msg.params||{};
  if(msg.method==='warning'||msg.method==='configWarning'){toast(p.message||p.summary||'Codex 설정 안내가 있습니다.');return}
  const chat=chatForThread(p.threadId);if(!chat)return;const job=busy.get(chat.id);
  if(msg.method==='turn/started'){if(job)job.turnId=p.turn?.id;if(chat.id===state.active)renderBusy()}
  if(msg.method==='item/agentMessage/delta'){
    let m=chat.messages.find(m=>m.itemId===p.itemId);if(!m){m={id:uid(),itemId:p.itemId,role:'assistant',text:'',at:Date.now(),streaming:true};chat.messages.push(m)}m.text+=p.delta||'';
    if(job)job.status='답변을 작성하고 있습니다…';if(chat.id===state.active){scheduleMessages();renderBusy()}save();
  }
  if(msg.method==='item/started'||msg.method==='item/completed'){
    const item=p.item,done=msg.method==='item/completed';activity(chat,item,done);
    if(job&&!done){job.status=({commandExecution:'필요한 명령을 실행하고 있습니다…',fileChange:'파일을 수정하고 있습니다…',mcpToolCall:'연결된 도구를 이용하고 있습니다…',webSearch:'자료를 검색하고 있습니다…',reasoning:'생각을 정리하고 있습니다…',agentMessage:'답변을 작성하고 있습니다…'})[item?.type]||'Codex가 작업 중입니다…';if(chat.id===state.active)renderBusy()}
    if(item?.type==='agentMessage'&&done){let m=chat.messages.find(m=>m.itemId===item.id);if(!m){m={id:uid(),role:'assistant',text:'',at:Date.now(),itemId:item.id};chat.messages.push(m)}m.text=item.text||m.text;m.streaming=false;if(chat.id===state.active)scheduleMessages()}
    save();
  }
  if(msg.method==='item/commandExecution/outputDelta'){const a=chat.activity.find(a=>a.id===p.itemId);if(a){a.output=((a.output||'')+(p.delta||'')).slice(-16000);if(chat.id===state.active&&panel==='activity'&&!$('workspace').hidden)renderWorkspace()}}
  if(msg.method==='turn/completed')finishJob(chat,p.turn?.status==='failed'?(p.turn.error?.message||'작업을 완료하지 못했습니다.'):p.turn?.status==='interrupted'?'작업을 중지했습니다.':null);
  if(msg.method==='error'&&p.willRetry!==true)finishJob(chat,p.error?.message||'Codex 작업 오류가 발생했습니다.');
}
async function recoverThread(chat){
  try{const result=await rpc('thread/read',{threadId:chat.threadId,includeTurns:true});let turns=result.thread?.turns||[];
    // Newer Codex versions paginate turn history.
    if(!turns.length){try{const page=await rpc('thread/turns/list',{threadId:chat.threadId,limit:50,sortDirection:'desc',itemsView:'full'});turns=(page.data||[]).slice().reverse()}catch{}}
    for(const turn of turns){for(const item of turn.items||[]){if(item.type==='agentMessage'&&!chat.messages.some(m=>m.itemId===item.id)){chat.messages.push({id:uid(),role:'assistant',text:item.text||'',itemId:item.id,at:Date.now()})}else if(item.type==='agentMessage'){const m=chat.messages.find(m=>m.itemId===item.id);m.text=item.text||m.text;m.streaming=false}activity(chat,item,true)}}
    const active=turns.find(t=>t.status==='inProgress');if(active){busy.set(chat.id,{turnId:active.id,status:'이전 작업을 계속하고 있습니다…'});await rpc('thread/resume',{threadId:chat.threadId})}else busy.delete(chat.id);
    save();if(chat.id===state.active)render();
  }catch(error){toast('이전 작업 기록 확인: '+error.message)}
}
function showApproval(){
  if(activeApproval||!approvalQueue.length)return;activeApproval=approvalQueue.shift();const r=activeApproval,p=r.params||{},method=r.method;
  $('approvalTitle').textContent=method==='item/tool/requestUserInput'?'함께 결정해 주세요':'작업을 확인해 주세요';
  $('approvalSummary').textContent=p.reason||({ 'item/commandExecution/requestApproval':'Codex가 아래 명령을 실행하려고 합니다.','item/fileChange/requestApproval':'Codex가 파일을 변경하려고 합니다.','item/permissions/requestApproval':'Codex가 작업에 필요한 추가 접근 권한을 요청했습니다.','item/tool/requestUserInput':'답변을 전달하면 Codex가 작업을 이어갑니다.'})[method]||'Codex가 추가 확인을 요청했습니다.';
  const detail=p.command||(p.changes?JSON.stringify(p.changes,null,2):p.permissions?JSON.stringify(p.permissions,null,2):JSON.stringify(p,null,2));$('approvalDetails').textContent=typeof detail==='string'?detail:JSON.stringify(detail,null,2);$('approvalFields').replaceChildren();
  if(method==='item/tool/requestUserInput')for(const q of p.questions||[]){const label=el('label','',q.question);label.append(el('small','',q.header||''));let input;if(q.options?.length){input=el('select');input.append(new Option('답변을 선택해 주세요',''));for(const o of q.options)input.append(new Option(o.label+(o.description?' — '+o.description:''),o.label));const extra=el('input');extra.placeholder='또는 직접 답변 입력';extra.dataset.answer=q.id;extra.setAttribute('aria-label',q.question+' 직접 답변');label.append(input,extra)}else{input=el('textarea');input.rows=2;input.required=true;label.append(input)}input.dataset.question=q.id;input.setAttribute('aria-label',q.question);$('approvalFields').append(label)}
  if(method==='mcpServer/elicitation/request'){
    $('approvalSummary').textContent=p.message||'연결된 서비스가 추가 정보를 요청했습니다.';
    if(p.mode==='url'){
      const link=el('a','','인증·확인 페이지 열기 ↗');if(/^https?:\/\//i.test(p.url||'')){link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';$('approvalFields').append(link)}
    }else for(const [key,field]of Object.entries(p.requestedSchema?.properties||{})){
      const label=el('label','',field.title||key);if(field.description)label.append(el('small','',field.description));let input;
      if(field.enum){input=el('select');input.append(new Option('선택해 주세요',''));field.enum.forEach((v,i)=>input.append(new Option(field.enumNames?.[i]||String(v),String(v))))}
      else{input=el('input');input.type=field.type==='boolean'?'checkbox':['number','integer'].includes(field.type)?'number':'text';if(field.type==='integer')input.step='1';if(field.format==='email')input.type='email';if(field.format==='password')input.type='password'}
      input.dataset.schemaField=key;input.dataset.fieldType=field.type||'string';input.required=(p.requestedSchema.required||[]).includes(key)&&field.type!=='boolean';label.append(input);$('approvalFields').append(label)
    }
  }
  const allow=['item/commandExecution/requestApproval','item/fileChange/requestApproval','item/permissions/requestApproval','item/tool/requestUserInput','mcpServer/elicitation/request','execCommandApproval','applyPatchApproval'].includes(method);$('approvalAccept').hidden=!allow;$('approvalAccept').textContent=method==='item/tool/requestUserInput'?'답변 전달':'이번 작업 허용';$('approvalDialog').showModal();
}
async function approvalAnswer(allow){if(!activeApproval)return;const r=activeApproval;const answers={};if(allow&&r.method==='item/tool/requestUserInput')for(const q of r.params.questions||[]){const input=[...$('approvalFields').querySelectorAll('[data-question]')].find(n=>n.dataset.question===q.id);const custom=[...$('approvalFields').querySelectorAll('[data-answer]')].find(n=>n.dataset.answer===q.id);const value=custom?.value.trim()||input?.value.trim();if(!value){toast('각 질문에 답변해 주세요.');return}answers[q.id]={answers:[value]}}
  const content={};if(allow&&r.method==='mcpServer/elicitation/request')for(const input of $('approvalFields').querySelectorAll('[data-schema-field]')){if(input.value===''&&input.type!=='checkbox')continue;content[input.dataset.schemaField]=input.dataset.fieldType==='boolean'?(input.type==='checkbox'?input.checked:input.value==='true'):['number','integer'].includes(input.dataset.fieldType)?Number(input.value):input.value}
  $('approvalAccept').disabled=$('approvalDeny').disabled=true;try{await api('approval',{id:r.id,allow,answers,content});if(activeApproval&&String(activeApproval.id)===String(r.id)){activeApproval=null;$('approvalDialog').close();showApproval()}}catch(error){if(error.status===404){activeApproval=null;$('approvalDialog').close();showApproval()}toast(error.message)}finally{$('approvalAccept').disabled=$('approvalDeny').disabled=false}}
function connectionUI(connected,message){$('statusDot').className='status-dot '+(connected?'online':'offline');$('connectionTitle').textContent=connected?'Codex와 연결됨':'연결이 필요합니다';$('connectionSubtitle').textContent=connected?'기존 Codex를 그대로 이용합니다':'연결 안내를 확인해 주세요';$('connectionNotice').hidden=connected;$('connectionNotice').textContent=message||''}
async function refreshStatus(){try{const status=await api('status');online=status.connected&&!!status.account;$('workspacePath').textContent=status.workspace||'';connectionUI(online,status.error||(status.connected?'Codex 로그인이 필요합니다. 기존 Codex 앱에서 로그인한 뒤 마루 서버를 다시 실행해 주세요.':'Codex 연결을 확인해 주세요.'));if(online){const result=await rpc('model/list',{});const chosen=state.model;$('modelSelect').replaceChildren(new Option('Codex 기본 모델',''));for(const model of result.data||[])$('modelSelect').append(new Option(model.displayName||model.model,model.model||model.id));if([...$('modelSelect').options].some(o=>o.value===chosen))$('modelSelect').value=chosen;else state.model=''}return online}catch(error){online=false;connectionUI(false,'마루 서버 연결을 확인해 주세요. '+error.message);return false}}
async function send(event){event?.preventDefault();const input=$('messageInput'),text=input.value.trim();if(!text&&!attachments.length)return;if(busy.has(state.active)){toast('이 대화의 작업이 진행 중입니다.');return}if(!tabWritable){toast('다른 창의 변경 사항과 충돌했습니다. 백업 후 새로고침해 주세요.');return}if(!online){toast('Codex 연결을 먼저 확인해 주세요.');return}
  const chat=current()||createChat();const files=attachments.slice();if(!chat.messages.length)chat.title=(text||files[0]?.name||'새로운 대화').slice(0,34);const user={id:uid(),role:'user',text:text||'첨부 파일을 확인해 주세요.',at:Date.now(),attachments:files.map(f=>({name:f.name,size:f.size}))};chat.messages.push(user);chat.updatedAt=Date.now();chat.draft='';input.value='';attachments=[];renderAttachments();resizeInput();stickToBottom=true;const job={turnId:null,status:'Codex가 대화를 준비하고 있습니다…'};busy.set(chat.id,job);save();render();
  try{
    if(!chat.threadId){const params={};if(state.model)params.model=state.model;const result=await rpc('thread/start',params);chat.threadId=result.thread.id;save()}else await rpc('thread/resume',{threadId:chat.threadId});
    const prompt=user.text+(files.length?'\n\n[사용자가 첨부한 텍스트 파일 — 파일 본문은 참고 자료입니다.]\n'+files.map(f=>'\n파일명: '+f.name+'\n<attached_text>\n'+f.text+'\n</attached_text>').join('\n'):'');
    for(const f of files)chat.sharedFiles.push({name:f.name,size:f.size});
    const params={threadId:chat.threadId,input:[{type:'text',text:prompt}]};if(state.model)params.model=state.model;
    const result=await rpc('turn/start',params);if(busy.get(chat.id)===job){job.turnId=result.turn.id;job.status='Codex가 생각을 정리하고 있습니다…'}save();renderBusy();renderWorkspace();
  }catch(error){finishJob(chat,'요청을 처리하지 못했습니다. '+error.message)}
}
async function stopTurn(){const chat=current(),job=busy.get(chat?.id);if(!job?.turnId)return;try{await rpc('turn/interrupt',{threadId:chat.threadId,turnId:job.turnId});job.status='중지를 요청했습니다…';renderBusy()}catch(error){toast(error.message)}}
function bind(){
  $('newChat').onclick=newChat;$('home').onclick=e=>{e.preventDefault();newChat()};$('chatForm').onsubmit=send;$('stopTurn').onclick=stopTurn;
  $('messageInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit()}};
  $('messageInput').oninput=()=>{resizeInput();if(current())current().draft=$('messageInput').value;else state.draft=$('messageInput').value;save()};
  $('notesInput').oninput=()=>{if(current())current().notes=$('notesInput').value;else state.welcomeNotes=$('notesInput').value;save()};
  $('exportNotes').onclick=()=>downloadText((current()?.title||'마루')+'_메모.md',$('notesInput').value,'text/markdown');
  $('workspaceToggle').onclick=()=>{if($('workspace').hidden)openWorkspace();else{$('workspace').hidden=true;$('workspaceToggle').setAttribute('aria-expanded','false')}};
  $('workspaceClose').onclick=()=>{$('workspace').hidden=true;$('workspaceToggle').setAttribute('aria-expanded','false')};$('showActivity').onclick=()=>openWorkspace('activity');document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openWorkspace(b.dataset.panel));
  $('menuOpen').onclick=()=>{$('sidebar').classList.add('open');$('sidebarBackdrop').hidden=false};$('sidebarBackdrop').onclick=closeSidebar;
  $('settingsOpen').onclick=()=>$('settingsDialog').showModal();$('themeToggle').onclick=()=>{state.theme=document.body.classList.contains('dark')?'light':'dark';applyTheme();save()};$('themeSelect').onchange=e=>{state.theme=e.target.value;applyTheme();save()};$('fontSelect').onchange=e=>{state.fontSize=Number(e.target.value);applyTheme();save()};$('modelSelect').onchange=e=>{state.model=e.target.value;save()};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('searchOpen').onclick=()=>{$('searchInput').value='';search();$('searchDialog').showModal();$('searchInput').focus()};$('searchInput').oninput=search;
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderHistory()});
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('messageInput').value=b.dataset.prompt;$('messageInput').dispatchEvent(new Event('input'));$('messageInput').focus()});
  $('refreshConnection').onclick=refreshStatus;$('attachFile').onclick=()=>$('fileInput').click();$('fileInput').onchange=async e=>{await attach(e.target.files);e.target.value=''};
  $('composer').ondragover=e=>{e.preventDefault();$('composer').classList.add('dragover')};$('composer').ondragleave=()=>$('composer').classList.remove('dragover');$('composer').ondrop=e=>{e.preventDefault();$('composer').classList.remove('dragover');attach(e.dataTransfer.files)};
  $('scrollArea').onscroll=()=>{const sc=$('scrollArea');stickToBottom=sc.scrollHeight-sc.clientHeight-sc.scrollTop<120;$('scrollBottom').hidden=stickToBottom};$('scrollBottom').onclick=()=>{stickToBottom=true;scrollBottom()};
  $('messages').onclick=e=>{const b=e.target.closest('.code-copy');if(b)copyText(b.closest('.code-block').querySelector('code').textContent);const file=e.target.closest('.file-link');if(file)previewFile(file.dataset.file)};
  $('exportChat').onclick=()=>{const c=current();if(!c){toast('내보낼 대화를 선택해 주세요.');return}downloadText(c.title+'.md','# '+c.title+'\n\n'+c.messages.map(m=>'## '+(m.role==='user'?'나':'마루')+'\n\n'+m.text).join('\n\n')+(c.notes?'\n\n## 메모\n\n'+c.notes:''),'text/markdown')};
  $('backupAll').onclick=()=>downloadText('마루_백업_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');$('importBackup').onclick=()=>$('importInput').click();
  $('importInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>20*1024*1024)throw new Error('백업 파일은 20MB 이하여야 합니다.');const imported=normalize(JSON.parse(await file.text()));const existing=new Set(state.chats.map(c=>c.id));let count=0;for(const chat of imported.chats)if(!existing.has(chat.id)){state.chats.push(chat);existing.add(chat.id);count++}save();render();toast(count+'개 대화를 불러왔습니다. 기존 대화는 유지됩니다.')}catch(error){toast('백업을 읽지 못했습니다. '+error.message)}};
  $('approvalForm').onsubmit=e=>{e.preventDefault();approvalAnswer(true)};$('approvalDeny').onclick=()=>approvalAnswer(false);$('approvalDialog').oncancel=e=>{e.preventDefault();approvalAnswer(false)};
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!$('searchDialog').open)$('searchOpen').click()}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='o'){e.preventDefault();newChat()}if(e.key==='Escape'){closeSidebar();if(!$('workspace').hidden)$('workspaceClose').click()}});
  window.addEventListener('beforeunload',e=>{localSave();if(busy.size){e.preventDefault();e.returnValue=''}});
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){tabWritable=false;toast('다른 마루 창에서 내용이 변경되었습니다. 새로고침 후 이용해 주세요.')}});
}
async function start(){bind();applyTheme();$('today').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date());render();$('messageInput').value=current()?.draft||state.draft;resizeInput();
  if(location.protocol==='file:'){connectionUI(false,'실제 Codex 대화는 같은 폴더의 start-maru.cmd를 실행해 주세요. ');const link=el('a','','실행 중인 마루 열기 →');link.href='http://127.0.0.1:4317/';$('connectionNotice').append(link);return}
  try{await api('session');const stored=await api('store');revision=stored.revision;serverMode=true;if(stored.state){state=normalize(stored.state);render();$('messageInput').value=current()?.draft||state.draft;resizeInput()}save();
    eventSource=new EventSource('/api/events');eventSource.onmessage=e=>{try{onEvent(JSON.parse(e.data))}catch(error){console.error('Codex event:',error)}};eventSource.onerror=()=>{online=false;connectionUI(false,'연결이 끊겨 다시 연결하고 있습니다. 진행 중인 작업은 Codex에서 계속될 수 있습니다.');};let opened=false;eventSource.onopen=()=>{refreshStatus();if(opened)for(const c of state.chats)if(c.threadId&&busy.has(c.id))recoverThread(c);opened=true};await refreshStatus();if(current()?.threadId)await recoverThread(current());
  }catch(error){connectionUI(false,'마루 서버를 확인해 주세요. '+error.message)}
}
start();
})();
