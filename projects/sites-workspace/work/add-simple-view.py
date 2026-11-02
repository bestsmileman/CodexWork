from pathlib import Path
p=Path(__file__).with_name('build-file-explorer.py')
s=p.read_text(encoding='utf-8')
start=s.index("html='''")
s=s[:start]+'''# Daily-use files are explicit: source HTML/MD is not automatically a user document.
for row in rows:
    row['daily'] = not row['folder']
def extra(path, tag, daily=False, folder=False):
    if Path(path).exists() and not any(r['path']==path for r in rows):
        rows.append(dict(path=path,tag=tag,folder=folder,daily=daily))
for name in ['jeonghee-pilot.pdf','jeonghee-pilot(1).pdf','jeonghee-pilot(2).pdf']:
    extra(shared+'\\\\'+name,'정희 시제작 검토 문서',True)
for name,tag in [('AGENTS.md','AI 작업 지침'),('chat-studio/app.js','마루 화면 동작 원본'),('chat-studio/styles.css','마루 디자인 원본'),('chat-studio/index.html','마루 화면 원본'),('chat-studio/server.cjs','마루 서버 원본'),('chat-studio/start-maru.ps1','마루 시작·종료 내부 처리'),('chat-studio/ui-smoke.cjs','개발용 화면 검사 · AI 요청 포함 가능'),('chat-studio/server-smoke.cjs','개발용 서버 검사')]:
    extra(shared+'\\\\'+name.replace('/','\\\\'),tag)
for name,tag in [('Start-Codex.ps1','매뉴얼 시작·종료 내부 처리'),('codex-manual-server.py','매뉴얼 서버 원본'),('taste-pieces.tar.gz','아카이브 게시 묶음'),('studio-note.tar.gz','포트폴리오 게시 묶음'),('day-focus.tar.gz','플래너 게시 묶음')]:
    extra(out+'\\\\'+name,tag)
work=project+'\\\\work'
extra(work,'',folder=True)
for slug in ['taste-pieces','studio-note','day-focus']:
    root=work+'\\\\'+slug
    extra(root,'사이트 제작 원본',folder=True)
    for directory in ['dist','.openai']:
        extra(root+'\\\\'+directory,'',folder=True)
    extra(root+'\\\\dist\\\\index.html','사이트 화면·동작 원본')
    extra(root+'\\\\.openai\\\\hosting.json','게시 설정')
extra(work+'\\\\build-sites.py','초기 사이트 재작성 · 원본 덮어쓰기 주의')
extra(work+'\\\\check.cjs','개발용 기능 검사')
# Keep every folder immediately before its children.
rows.sort(key=lambda r: r['path'].lower())
''' + s[start:]
s=s.replace('<button id="expand">','<button id="simple" aria-pressed="true">간단히 보기</button><button id="all" aria-pressed="false">전체 보기</button><button id="expand">')
s=s.replace('button:hover{', 'button[aria-pressed="true"]{background:#263c58;color:#fff}button:hover{')
s=s.replace('let toast;', 'let toast;let simple=true;')
s=s.replace("list.replaceChildren();for(const r of rows){", "list.replaceChildren();const files=rows.filter(r=>!r.folder&&(!simple||r.daily));const visible=rows.filter(r=>r.folder?files.some(f=>f.path.startsWith(r.path+'\\\\\\\\')):files.includes(r));for(const r of visible){")
s=s.replace('r.folder&&rows.some(x=>', 'r.folder&&visible.some(x=>')
s=s.replace("document.querySelector('#search').oninput=render;", "document.querySelector('#simple').onclick=()=>{simple=true;document.querySelector('#simple').setAttribute('aria-pressed','true');document.querySelector('#all').setAttribute('aria-pressed','false');render()};document.querySelector('#all').onclick=()=>{simple=false;document.querySelector('#simple').setAttribute('aria-pressed','false');document.querySelector('#all').setAttribute('aria-pressed','true');render()};document.querySelector('#search').oninput=render;")
p.write_text(s,encoding='utf-8')
