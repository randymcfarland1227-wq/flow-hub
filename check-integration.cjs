// Offline data/render/state checks; no browser-security workaround or network.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const root=__dirname,els=new Map(),events={},storage=new Map();
function el(id){if(!els.has(id))els.set(id,{id,innerHTML:'',textContent:'',value:'',hidden:false,open:false,clientWidth:1050,offsetWidth:100,dataset:{},style:{},classList:{add(){},remove(){},contains(){return false},toggle(){}},children:[],querySelector(s){return el(id+' '+s)},querySelectorAll(){return []},addEventListener(k,f){(this.handlers??={})[k]=f},setAttribute(){},appendChild(x){this.children.push(x)},insertAdjacentHTML(where,x){this.innerHTML+=x},focus(){},showModal(){this.open=true},close(){this.open=false},click(){},scrollIntoView(){}});return els.get(id)}
const c={requestAnimationFrame(fn){fn()},console,crypto:webcrypto,location:{hash:'#overview'},innerWidth:1280,setTimeout(){return 1},clearTimeout(){},matchMedia(){return {matches:false}},confirm(){return true},Blob,URL,FormData:class{constructor(f){this.values=f.values}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]()}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},navigator:{clipboard:{writeText:async()=>{}}},document:{documentElement:{dataset:{}},getElementById:el,querySelector:el,querySelectorAll:()=>[],createElement(tag){return el('new-'+tag+'-'+Math.random())},addEventListener(k,fn){(events[k]??=[]).push(fn)}}};c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};vm.createContext(c);
const run=s=>vm.runInContext(s,c);
for(const f of ['js/config.js','js/data.js','js/flow-map.js','js/app.js','js/integration.js'])run(fs.readFileSync(root+'/'+f,'utf8'));
assert.equal(run('state.routines.length'),87);
assert.equal(run('state.efforts.length'),27);
assert.equal(run('state.dreams.length'),5);
assert.equal(run('BROAD_GOALS.length'),6);
assert.equal(run('FLOW_MAP.records.length'),74);
for(const view of ['overview','goals','routines','area/body','area/home','review','sync']){run(`location.hash='#${view}';render()`);assert.ok(el('app').innerHTML.length>1000,view);assert.ok(!el('app').innerHTML.includes('NaN'),view);}
assert.equal(run('FLOW_MAP.buckets.length'),9);
run("location.hash='#overview';render()");assert.equal((run('movesHTML(latestBy(\'goal\'))').match(/<article class="move">/g)||[]).length,5);
assert.ok(run("sankeyModel().nodes.some(n=>n.id==='g:upkeep')"));
assert.ok(run("routinesForEffort('upkeep-home').length")>0);
const before=run('JSON.stringify(state.routines)');
run("flowEditDefinition(FLOW_MAP.records.find(t=>t.executionType==='Task').id)");assert.ok(el('drawer').innerHTML.includes('flowDefinition'));assert.equal(typeof el('flowDefinition').onsubmit,'function');assert.equal(run('JSON.stringify(state.routines)'),before);
run('flowSync.snapshot={complete:false,records:[]}');assert.match(run('flowDiff(FLOW_MAP.records[0],null)[0].actual'),/partial/);
assert.equal(run('flowDiff(FLOW_MAP.records[0],FLOW_MAP.records[0]).length'),0);
run("state.linkEdits['body-put-out-gym-clothes']={tier:'enable',efforts:['physical-sleep']}");assert.equal(run("linkFor(routineById('body-put-out-gym-clothes')).efforts[0]"),'physical-sleep');
console.log('Flow integration: inventory, six categories, five prompts, care links, existing edits, views and sync comparison pass.');
