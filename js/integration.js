// Additive Flow layer. Existing definitions, saved edits and source instructions remain intact.
const FLOW_SYNC_KEY='flow.integration.v1';
let flowSync=localGet(FLOW_SYNC_KEY,{desired:{},snapshot:null,frontier:null});
let flowSyncNotice='';
const flowOriginalLinkFor=linkFor;
linkFor=function(r){
  if(state.linkEdits[r.id])return flowOriginalLinkFor(r);
  return FLOW_MAP.routines.find(x=>x.id===r.id)?.link||flowOriginalLinkFor(r);
};
// Keep five decision prompts visible, including healthy/empty states rather than hiding them.
const flowOriginalMovesHTML=movesHTML;
movesHTML=function(latestGoal){
 const seeds=state.efforts.filter(e=>stageFor(e.id,latestGoal)==='seed');
 const unsorted=state.routines.filter(r=>isActive(r)&&linkFor(r).tier==='unsorted');
 const waiting=state.routines.filter(r=>isLive(r)&&actOf(r)?.overdueSince);
 const loose=state.routines.filter(r=>isLive(r)&&linkFor(r).tier==='drive'&&!linkFor(r).efforts.length);
 const prompts=[
 ['Keep the owed work visible',waiting.length?`${waiting.length} routines have overdue tasks. Choose what still matters; postponement is not completion.`:'No overdue tasks in the loaded activity snapshot.','#routines'],
 ['Give each practice a home',unsorted.length?`${unsorted.length} routines need a role and a meaningful link.`:'Every active routine has a role; review any new direct actions in Frontier.','#routines'],
 ['Choose a goal-led next move',seeds.length?`${seeds.length} goal parts have no active routine driving them. A finite project or deliberate pause may be the right answer.`:'Review which current goal would benefit from your next action.','#goals'],
 ['Name what the effort serves',loose.length?`${loose.length} driving routines still need an explicit goal.`:'Existing routines retain their links. New tasks can be linked after the fact.','#sync'],
 ['Check the fair share', 'Compare your real eligible work and completions in Frontier. Rebalance attention without treating output volume as fulfillment.','#sync']
 ];
 return prompts.map(([title,body,href])=>`<article class="move"><div class="move-body"><h3>${esc(title)}</h3><p>${esc(body)}</p><a class="more" href="${href}">Review →</a></div></article>`).join('');
};
const flowOriginalRender=render;
render=function(){
  for(const c of FLOW_MAP.categories)if(!BROAD_GOALS.some(x=>x.id===c.id))BROAD_GOALS.push(c);
  GOAL_AREA.upkeep='home';
  for(const e of FLOW_MAP.efforts.filter(x=>x.proposed))if(!state.efforts.some(x=>x.id===e.id))state.efforts.push(e);
  flowOriginalRender();
  if(route().view==='sync'){$('app').innerHTML=flowSyncView();wireFlowSync();}
};
function flowDesired(t){return {...t,...flowSync.desired[t.id],id:t.id,executionType:t.executionType};}
const flowComparable=['title','status','projectId','sectionId','repeatRule','reminders','content','description','items','goal','timeZone','isAllDay','columnId'];
function flowDiff(t,actual){
  const desired=flowDesired(t);
  if(!actual)return [{field:'record',expected:'Present',actual:flowSync.snapshot?.complete?'Not in active catalog':'Not returned · partial or missing snapshot'}];
  return flowComparable.filter(k=>Object.hasOwn(desired,k)&&(!Object.hasOwn(actual,k)||JSON.stringify(desired[k]??null)!==JSON.stringify(actual[k]??null))).map(k=>({field:k,expected:desired[k],actual:Object.hasOwn(actual,k)?actual[k]:'Not supplied · unverified'}));
}
function flowSave(){localSet(FLOW_SYNC_KEY,flowSync);}
function flowDownload(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function flowSyncView(){
  const actual=flowSync.snapshot?.records||[];
  const extras=actual.filter(t=>!FLOW_MAP.records.some(r=>r.id===t.id&&r.executionType===t.executionType));
  const count=FLOW_MAP.records.filter(t=>flowDiff(t,actual.find(a=>a.id===t.id&&a.executionType===t.executionType)).length).length;
  const goalName=id=>FLOW_MAP.efforts.find(g=>g.id===id)?.effort||id||'Choose from actual session content';
  return `<header class="main-head"><div class="page"><p class="kicker">One connected life · local integration</p><h1>Keep the meaning.<br><em>Align the practice.</em></h1><p>Six lasting goal and care categories, nine attention buckets, and every original routine. This review changes no live site or TickTick item.</p></div></header><div class="page">
  <section class="block panel"><h2>What the flow is asking for</h2><div class="moves">${[
  ['Review current practice','Keep tasks owed until done or deliberately retired. Habits resume at the next occurrence without debt.'],
  ['Give upkeep a meaningful home','Home, digital systems, communications, financial administration and personal logistics each have a care standard.'],
  ['Keep direction visible','Grounding reminders stay tasks with instructions. Acknowledgment carries no action credit. Choose your next move for its goal.'],
  ['Connect the saved choices','Review old marks, task rules and source defaults in Frontier; one primary bucket and one goal or care standard per action.'],
  ['Make room for real sessions','Music format sets the session’s shape. Guitar, vocals, production or Serum supplies its content and specific instructions.']
  ].map(([a,b])=>`<article class="move"><div class="move-body"><h3>${a}</h3><p>${b}</p></div></article>`).join('')}</div></section>
  <section class="block panel"><p class="kicker">TickTick sync review</p><h2>All ${FLOW_MAP.records.length} inspected records</h2><p>${FLOW_MAP.records.filter(t=>t.executionType==='Task').length} tasks · ${FLOW_MAP.records.filter(t=>t.executionType==='Habit').length} habits. Instructions stay with tasks and Flow. Gym clothes are prepared before bed.</p><p>${flowSync.snapshot?`Imported ${esc(flowSync.snapshot.asOf||'undated')} · ${flowSync.snapshot.complete?'Complete source response':'Partial response · missing items are not deletions'} · ${count} records need comparison`:'The preserved inventory is a reference snapshot. Import a fresh catalog from Frontier to check current parity.'}</p>
  <div class="pills"><a class="btn ghost" href="${['localhost','127.0.0.1'].includes(location.hostname)?'/frontier/#settings':'https://randymcfarland1227-wq.github.io/frontier/#settings'}" target="_blank" rel="noopener">Frontier · read current catalog</a><button class="btn" id="flowImportCatalog">Import current catalog</button><button class="btn ghost" id="flowExportPlan">Export reviewed sync plan</button></div><input hidden type="file" accept="application/json" id="flowCatalogFile"><p role="status">${esc(flowSyncNotice)}</p>
  <p>Review compares stable identity, task/habit type, instructions, recurrence, reminders, placement and habit quantity where the source supplies them. Recurring calendar dates remain source-managed. Missing fields are unverified. No silent deletion, type conversion, or reactivation.</p>
  ${(flowSync.snapshot?.errors||[]).map(e=>`<p>${esc(e)}</p>`).join('')}
  <div class="flow-sync-list">${FLOW_MAP.records.map(t=>{const d=flowDesired(t);const current=actual.find(a=>a.id===t.id&&a.executionType===t.executionType);const diff=flowSync.snapshot?flowDiff(t,current):[];return `<details class="flow-sync-row"><summary><b>${esc(d.title)}</b><span>${esc(t.executionType)} · ${esc(t.group)} · ${t.credit?'action':'orientation / container'}${diff.length?' · review differences':''}</span></summary><p>${esc(FLOW_MAP.buckets.find(b=>b.id===d.bucket)?.name||d.bucket)} → ${esc(goalName(d.primaryGoal))}</p><p>${esc(FLOW_MAP.routines.find(r=>r.id===t.routineId)?.what||'')}</p>${t.executionType==='Task'?`<pre class="flow-instructions">${esc(d.content||d.description||'No additional text')}</pre>`:'<p>Habit labels stay short; supporting instructions live in Flow.</p>'}<p>Recurrence: ${esc(d.repeatRule||'No repeat rule')} · ${t.executionType==='Habit'?'Missed occurrence creates no debt.':'Missed task remains owed.'}</p>${diff.map(x=>`<p><b>${esc(x.field)}</b><br>Flow: ${esc(typeof x.expected==='string'?x.expected:JSON.stringify(x.expected))}<br>TickTick: ${esc(typeof x.actual==='string'?x.actual:JSON.stringify(x.actual))}</p>`).join('')}<button class="btn ghost" data-flow-edit="${esc(t.id)}">Review intended definition</button></details>`}).join('')}</div>
  ${extras.length?`<h3>${extras.length} additional current records · retained for review</h3>${extras.map(t=>`<p>${esc(t.title||t.name)} · ${esc(t.executionType)} · needs a Flow home</p>`).join('')}`:''}</section>
  <section class="block panel"><p class="kicker">Life Hub sync</p><h2>Where attention went, and why</h2><div class="flow-bucket-grid">${FLOW_MAP.buckets.map(b=>`<article><h3>${esc(b.name)}</h3><p>${esc(b.purpose)}</p></article>`).join('')}</div><p>Frontier’s Settings now includes a saved-sorting review in the companion local branch. Inspect old marks, select the changes you want, and back up before applying. Task rules take precedence over source defaults. Settings, completion sorting and “Charge this” use the same bucket resolver.</p><p>Existing pace settings and site-repair scoring exclusions remain visible for review. The new bucket split does not invent historical workload. Source and project breakdowns still distinguish Candle, ventures, resale, roles and relocation.</p><button class="btn ghost" id="flowImportFrontier">Import Frontier sorting review</button><input hidden type="file" accept="application/json" id="flowFrontierFile">${flowSync.frontier?`<p>${Object.keys(flowSync.frontier.state?.completions?.entries||{}).length} exported completions · ${Object.keys(flowSync.frontier.state?.rules||{}).length} saved sorting rules. Imported for comparison; Frontier remains the owner of completion history.</p>`:''}</section>
  <section class="block panel"><p class="kicker">Music · preserved session library</p><h2>Format, content, reflection</h2><p>TickTick prompts Main, Support or Maintenance. Choose the actual content below, then use Music Hub to log the session and your returning question. Notes enrich the same action; they do not add a second completion. Separate real sessions need separate session identities.</p>${(window.MUSIC_SOURCE_CATALOG||[]).map(s=>`<details class="flow-sync-row"><summary>${esc(s.category)} · ${esc(s.title)} · ${esc(s.type)}</summary><p>${esc(s.what)}</p><ol>${s.guide.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p>${esc(s.guide.example)}</p></details>`).join('')}</section><section class="block panel"><h2>Nothing forced into a new routine</h2><p>Move OS is a finite relocation project. Role Hub, Candle, income experiments, resale, personal work and administration can contribute directly after the fact. A source does not decide the goal by itself.</p><h3>Kept within existing routines</h3>${FLOW_MAP.unbound.map(r=>`<p><b>${esc(r.title)}</b> · ${esc(r.frequency)}. ${/bundle/i.test(r.frequency)?'Retained within its existing task bundle.':'Reference in Flow; no new standalone task created.'}</p>`).join('')}<p>All 87 original routine records, 20 original sub-goals and five dreams remain. The five care standards and two proposed sub-goals are additive.</p><a class="more" href="lifehub-migration-agent-prompt.md">Temporary migration handoff →</a> · <a class="more" href="origin-sheets-reconciliation.md">Origin sheets coverage →</a></section></div>`;
}
function wireFlowSync(){
  $('flowImportCatalog').onclick=()=>$('flowCatalogFile').click();
  $('flowCatalogFile').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>10000000)throw Error();const v=JSON.parse(await f.text());if(!Array.isArray(v.records)||!v.records.every(t=>typeof t.id==='string'&&['Habit','Task'].includes(t.executionType)))throw Error();flowSync.snapshot=v;flowSave();flowSyncNotice='Current catalog imported. Review differences before requesting any TickTick changes.';render();}catch{flowSyncNotice='Use the catalog exported by Frontier. Nothing was changed.';render();}};
  $('flowImportFrontier').onclick=()=>$('flowFrontierFile').click();
  $('flowFrontierFile').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>10000000)throw Error();const v=JSON.parse(await f.text());if(!v.state?.rules||!v.state?.completions?.entries)throw Error();flowSync.frontier=v;flowSave();render();}catch{flowSyncNotice='Use the saved-sorting review exported from Frontier.';render();}};
  $('flowExportPlan').onclick=()=>flowDownload('flow-reviewed-sync-plan.json',{version:1,asOf:new Date().toISOString(),sourceAsOf:flowSync.snapshot?.asOf||null,sourceComplete:!!flowSync.snapshot?.complete,mode:'review-required-no-live-writes',desired:FLOW_MAP.records.map(flowDesired),differences:FLOW_MAP.records.map(t=>({id:t.id,executionType:t.executionType,changes:flowDiff(t,flowSync.snapshot?.records?.find(a=>a.id===t.id&&a.executionType===t.executionType))})).filter(x=>x.changes.length)});
  document.querySelectorAll('[data-flow-edit]').forEach(b=>b.onclick=()=>flowEditDefinition(b.dataset.flowEdit));
}
function flowEditDefinition(id){
 const t=FLOW_MAP.records.find(x=>x.id===id);if(!t)return;const d=flowDesired(t);
 openDrawer(`<p class="kicker">Intended definition · local only</p><h2>${esc(t.title)}</h2><form id="flowDefinition"><label>Label<input name="title" value="${esc(d.title)}" required></label><label>Repeat rule<input name="repeatRule" value="${esc(d.repeatRule||'')}"></label>${t.executionType==='Task'?`<label>Instructions<textarea name="content" rows="12">${esc(d.content||'')}</textarea></label>`:'<p>Habit format is retained. Put supporting text in the routine instructions, not a habit subtitle.</p>'}<label>Attention bucket<select name="bucket">${FLOW_MAP.buckets.map(b=>`<option value="${b.id}"${b.id===d.bucket?' selected':''}>${esc(b.name)}</option>`).join('')}</select></label><label>Goal or care standard<select name="primaryGoal"><option value="">Choose from session content</option>${FLOW_MAP.efforts.map(g=>`<option value="${g.id}"${g.id===d.primaryGoal?' selected':''}>${esc(g.effort)}${g.proposed?' · proposed':''}</option>`).join('')}</select></label><p>This edits the intended definition in this browser. Export the plan for reviewed application; TickTick stays unchanged.</p><button class="btn" type="submit">Save intended definition</button></form>`,()=>{
  $('flowDefinition').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));flowSync.desired[id]={...flowSync.desired[id],...v};flowSave();closeDrawer();render();};
 });
}
render();
