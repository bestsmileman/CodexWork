const fs=require('fs'),vm=require('vm'),assert=require('assert');
class E{constructor(){this.children=[];this.style={};this.dataset={};this.value='';this.hidden=false;this.classList={toggle(){}}}append(...c){this.children.push(...c)}replaceChildren(){this.children=[]}setAttribute(k,v){this[k]=v}focus(){}select(){}click(){this.onclick?.()}closest(){return null}}
const els={},document={querySelector:s=>els[s]??=new E(),querySelectorAll:()=>[],createElement:()=>new E(),createTextNode:text=>({text}),addEventListener(){}};
const c=vm.createContext({document,console,location:{href:'file:///Codex-files.html'},innerWidth:1200,innerHeight:800});const script=fs.readFileSync('outputs/Codex-files.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script,c);
const run=s=>vm.runInContext(s,c);
assert.equal(els['#list'].children.length,3);
run('navigate(roots[0].path)');const first=run('current');assert(els['#list'].children.length>0);assert.equal(els['#back'].disabled,false);
els['#back'].click();assert.equal(run('current'),'');els['#forward'].click();assert.equal(run('current'),first);
els['#up'].click();assert.equal(run('current'),'');
run('mode(false);navigate(roots.find(r=>r.path.endsWith("CodexWork")).path)');els['#search'].value='app.js';els['#search'].oninput();assert.equal(els['#list'].children.length,1);
els['#simple'].click();assert.equal(els['#list'].children.length,0);
els['#search'].value='';els['#search'].oninput();els['#collapse'].click();assert.equal(run('expanded.size'),0);els['#expand'].click();assert(run('expanded.size')>0);
run('selectItem(visibleRows().find(r=>!r.folder))');assert.equal(els['#open'].disabled,false);assert(els['#details'].children.length>3);
console.log('PASS: folder navigation, back/forward/up, independent tree state, simple/full search, selection/details.');
