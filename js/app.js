// =====================================================================
// Flow — one hub for goals and the routines that carry them.
//
// The scheme:
//   Routine ─(role)→ Goal ─→ Dream
//   Role:  ◆ Drives (the routine is the goal in action)
//          ◇ Enables (upkeep that keeps a goal possible)
//          ○ Upkeep (keeps life running — no goal needed)
//   Goal stage: ○ Seed · ◐ Supported · ● Rooted · ★ Embedded
//
// Routines, goals and dreams are read live from the Routines and Goals
// hubs' Apps Scripts (falling back to the snapshot in data.js). The flow
// layer — roles, goal links, dream links, combined reviews — lives here.
// =====================================================================

const DOMAINS = [
  { id: 'mind',       label: 'Mind',       icon: '🧠' },
  { id: 'body',       label: 'Body',       icon: '💪' },
  { id: 'soul',       label: 'Soul',       icon: '✨' },
  { id: 'cleaning',   label: 'Cleaning',   icon: '🧹' },
  { id: 'organizing', label: 'Organizing', icon: '🗂️' },
  { id: 'dog',        label: 'Marvel',     icon: '🐾' },
];

const AREAS = [
  { id: 'physical',   label: 'Physical Body', icon: '💪' },
  { id: 'mental',     label: 'Mental',        icon: '🧠' },
  { id: 'connection', label: 'Connection',    icon: '🤝' },
  { id: 'financial',  label: 'Financial',     icon: '💰' },
  { id: 'spiritual',  label: 'Spiritual',     icon: '✨' },
];

const TIERS = {
  drive:    { label: 'Drives',   glyph: '◆', desc: 'The routine is a goal in action' },
  enable:   { label: 'Enables',  glyph: '◇', desc: 'Upkeep that keeps a goal possible' },
  upkeep:   { label: 'Upkeep',   glyph: '○', desc: 'Keeps life running — no goal needed' },
  unsorted: { label: 'Unsorted', glyph: '?', desc: 'New or unplaced — decide its role' },
};
const TIER_ORDER = ['drive', 'enable', 'upkeep', 'unsorted'];

const STAGES = {
  seed:      { label: 'Seed',      glyph: '○', desc: 'No routine behind it yet' },
  supported: { label: 'Supported', glyph: '◐', desc: 'Only upkeep feeds it — nothing drives it' },
  rooted:    { label: 'Rooted',    glyph: '●', desc: 'At least one routine drives it' },
  embedded:  { label: 'Embedded',  glyph: '★', desc: 'Rooted, and the last review said On Track' },
};
const STAGE_ORDER = ['seed', 'supported', 'rooted', 'embedded'];

const MOMENTUM = ['On Track', 'Slipping', 'Stalled'];
const SERVING = ['Yes', 'Mixed', 'No'];

const LS = {
  links: 'flowHub.routineLinks',
  dreams: 'flowHub.effortDreams',
  reviews: 'flowHub.reviews',
  group: 'flowHub.group',
  tab: 'flowHub.tab',
  theme: 'flowHub.theme',
  goalMode: 'flowHub.goalMode',
};

const state = {
  routines: SNAPSHOT_ROUTINES.slice(),
  efforts: SNAPSHOT_EFFORTS.slice(),
  dreams: SNAPSHOT_DREAMS.slice(),
  sheetGoalReviews: [],
  sheetRoutineReviews: [],
  localReviews: localGet(LS.reviews, []),
  linkEdits: localGet(LS.links, {}),
  dreamEdits: localGet(LS.dreams, {}),
  group: localGet(LS.group, 'tier'),
  goalMode: localGet(LS.goalMode, 'list'),
  tierFilter: new Set(TIER_ORDER),
  search: '',
  showPaused: false,
  answers: {},
  openAcc: new Set(),
  sankeyPin: null,
  mapTrace: null,
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function localGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; }
}
function localSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const slug = v => String(v || '').toLowerCase().replace(/\s+/g, '-');
const today = () => new Date().toISOString().slice(0, 10);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const $ = id => document.getElementById(id);

const domainOf = id => DOMAINS.find(d => d.id === id) || { id, label: id, icon: '•' };
const areaOf = id => AREAS.find(a => a.id === id) || { id, label: id, icon: '•' };
const effortById = id => state.efforts.find(e => e.id === id);
const routineById = id => state.routines.find(r => String(r.id) === String(id));
const dreamById = id => state.dreams.find(d => d.id === id);

const isActive = r => String(r.active) !== 'false';
// Reference notes/reminders from TickTick — linked like routines, but never reviewed or counted.
const isNote = r => /^(reminder|reference|project reminder|reference reminder)\b/i.test(r.frequency || '');
const isLive = r => isActive(r) && !isNote(r);
const shortFreq = f => String(f || '').replace(/^(Habit|Task bundle|Task|Reminder|Reference|Project reminder|Reference reminder)\s*·\s*/i, '');
const kindOf = f => (String(f || '').match(/^(Habit|Task bundle|Task|Reminder|Reference|Project reminder|Reference reminder)/i) || [''])[0];

function linkFor(r) {
  const l = state.linkEdits[r.id] || SEED_ROUTINE_LINKS[r.id] || { tier: 'unsorted', efforts: [] };
  const efforts = (l.efforts || []).filter(id => effortById(id));
  return { tier: TIERS[l.tier] ? l.tier : 'unsorted', efforts };
}

function dreamsFor(effortId) {
  const list = state.dreamEdits[effortId] || SEED_EFFORT_DREAMS[effortId] || [];
  return list.filter(id => dreamById(id));
}

function routinesForEffort(effortId, { includePaused = false, includeNotes = false } = {}) {
  return state.routines.filter(r => {
    if (!includePaused && !isActive(r)) return false;
    if (!includeNotes && isNote(r)) return false;
    const l = linkFor(r);
    return (l.tier === 'drive' || l.tier === 'enable') && l.efforts.includes(effortId);
  });
}

// ---------------------------------------------------------------------
// Reviews — merged from both Sheets plus reviews saved on this site.
// ---------------------------------------------------------------------
function allReviewRows() {
  const rows = [];
  state.sheetGoalReviews.forEach(r => rows.push({ date: r.date, kind: 'goal', id: r.effortId, name: r.effort, value: r.momentum, notes: r.notes, source: 'Goals Sheet' }));
  state.sheetRoutineReviews.forEach(r => {
    const match = state.routines.find(x => x.focus === r.routine);
    rows.push({ date: r.date, kind: 'routine', id: match ? match.id : null, name: r.routine, value: r.serving, notes: r.notes, source: 'Routines Sheet' });
  });
  state.localReviews.forEach(r => rows.push({ ...r, source: 'Flow' }));
  return rows;
}

function latestBy(kind) {
  const map = {};
  allReviewRows().forEach(r => {
    if (r.kind !== kind || !r.id || !r.value) return;
    const cur = map[r.id];
    if (!cur || (r.date || '') >= (cur.date || '')) map[r.id] = r;
  });
  return map;
}

function stageFor(effortId, latestGoal) {
  const rs = routinesForEffort(effortId);
  if (rs.some(r => linkFor(r).tier === 'drive')) {
    const last = latestGoal[effortId];
    return last && last.value === 'On Track' ? 'embedded' : 'rooted';
  }
  return rs.length ? 'supported' : 'seed';
}

function reviewSchedule() {
  const anchor = new Date(REVIEW_ANCHOR_DATE + 'T00:00:00');
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const due = new Date(anchor);
  while (due < t) due.setDate(due.getDate() + REVIEW_INTERVAL_DAYS);
  return { due, daysUntil: Math.round((due - t) / 86400000) };
}

// ---------------------------------------------------------------------
// Live data
// ---------------------------------------------------------------------
async function apiGet(base, action) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${base}?action=${action}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error('Request failed');
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function apiPost(base, action, payload) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

async function loadLive() {
  const jobs = [
    apiGet(ROUTINES_API, 'routines').then(v => { if (Array.isArray(v) && v.length) state.routines = v; }),
    apiGet(GOALS_API, 'efforts').then(v => { if (Array.isArray(v) && v.length) state.efforts = v; }),
    apiGet(GOALS_API, 'dreams').then(v => { if (Array.isArray(v) && v.length) state.dreams = v; }),
    apiGet(GOALS_API, 'reviews').then(v => { if (Array.isArray(v)) state.sheetGoalReviews = v; }),
    apiGet(ROUTINES_API, 'reviews').then(v => { if (Array.isArray(v)) state.sheetRoutineReviews = v; }),
  ];
  const failed = (await Promise.allSettled(jobs)).filter(r => r.status === 'rejected').length;
  const el = $('syncState');
  el.className = 'sync ' + (failed === 0 ? 'ok' : failed === jobs.length ? 'off' : 'partial');
  el.querySelector('span').textContent = failed === 0 ? 'Live' : failed === jobs.length ? 'Offline snapshot' : 'Partly live';
  el.title = failed === 0 ? 'Reading live from both Sheets' : failed === jobs.length ? 'Sheets unreachable — showing the saved snapshot' : 'Some Sheet reads failed';
  renderAll();
}

// ---------------------------------------------------------------------
// Shell: nav, theme
// ---------------------------------------------------------------------
function activateTab(view) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === view));
  localSet(LS.tab, view);
  history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0 });
  if (view === 'overview') renderSankey();
  if (view === 'goals' && state.goalMode === 'map') requestAnimationFrame(drawMapLines);
}
document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => activateTab(b.dataset.view)));

function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
applyTheme(localGet(LS.theme, null));
$('themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next); localSet(LS.theme, next);
  renderSankey();
});

$('goalsSheetLink').href = GOALS_SHEET_URL;
$('heroDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

// ---------------------------------------------------------------------
// Shared markup
// ---------------------------------------------------------------------
const tierTag = t => `<span class="tag tier t-${t}" title="${esc(TIERS[t].desc)}"><i>${TIERS[t].glyph}</i>${TIERS[t].label}</span>`;
const stageTag = s => `<span class="tag stage s-${s}" title="${esc(STAGES[s].desc)}"><i>${STAGES[s].glyph}</i>${STAGES[s].label}</span>`;
const momentumTag = last => last ? `<span class="tag mo m-${slug(last.value)}" title="Last review ${esc(last.date)}">${esc(last.value)}</span>` : '';
function dreamTags(effortId) {
  const ds = dreamsFor(effortId);
  if (!ds.length) return `<span class="tag dream foundation">✦ Foundation</span>`;
  return ds.map(id => `<span class="tag dream">✦ ${esc(dreamById(id).dream)}</span>`).join('');
}
// Four-step track showing how far along a goal is.
function stageTrack(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return `<span class="track s-${stage}" title="${esc(STAGES[stage].label)} — ${esc(STAGES[stage].desc)}">${STAGE_ORDER.map((s, i) => `<b class="${i <= idx ? 'on' : ''}"></b>`).join('')}</span>`;
}

// ---------------------------------------------------------------------
// OVERVIEW — hero + balance
// ---------------------------------------------------------------------
function counts() {
  const latestGoal = latestBy('goal');
  const tiers = { drive: 0, enable: 0, upkeep: 0, unsorted: 0 };
  state.routines.filter(isLive).forEach(r => tiers[linkFor(r).tier]++);
  const stages = { seed: 0, supported: 0, rooted: 0, embedded: 0 };
  state.efforts.forEach(e => stages[stageFor(e.id, latestGoal)]++);
  return { tiers, stages, latestGoal };
}

function renderHero() {
  const { tiers } = counts();
  const live = Object.values(tiers).reduce((a, b) => a + b, 0);
  const { daysUntil } = reviewSchedule();
  $('heroSub').innerHTML = `${plural(state.dreams.length, 'dream')} · ${plural(state.efforts.length, 'goal')} · ${plural(live, 'active routine')} · review ${daysUntil === 0 ? '<b>today</b>' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`;
}

function stackBar(parts, total) {
  return `<div class="stack">${parts.filter(p => p.n).map(p => `<span class="${p.cls}" style="flex:${p.n}" title="${esc(p.label)}: ${p.n}"></span>`).join('')}</div>
    <div class="stack-key">${parts.map(p => `<span><i class="${p.cls}"></i>${esc(p.label)} <b>${p.n}</b></span>`).join('')}</div>`;
}

function renderBalance() {
  const { tiers, stages } = counts();
  const routinesTotal = Object.values(tiers).reduce((a, b) => a + b, 0);
  const flowing = tiers.drive + tiers.enable;
  const grounded = stages.rooted + stages.embedded;
  $('balance').innerHTML = `
    <div class="bal">
      <div class="bal-top"><span class="bal-big">${grounded}<small>/${state.efforts.length}</small></span><span class="bal-label">goals have a routine driving them</span></div>
      ${stackBar(STAGE_ORDER.map(s => ({ cls: 'bg-s-' + s, label: STAGES[s].label, n: stages[s] })))}
    </div>
    <div class="bal">
      <div class="bal-top"><span class="bal-big">${flowing}<small>/${routinesTotal}</small></span><span class="bal-label">routines flow into a goal — the rest is upkeep</span></div>
      ${stackBar(TIER_ORDER.map(t => ({ cls: 'bg-t-' + t, label: TIERS[t].label, n: tiers[t] })))}
    </div>`;
}

// ---------------------------------------------------------------------
// OVERVIEW — the Current (Sankey: area → role → goal area → dream)
// ---------------------------------------------------------------------
function sankeyModel() {
  const nodes = new Map();
  const node = (id, col, label, color, order, meta = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, col, label, color, order, in: 0, out: 0, rset: new Set(), ...meta });
    return nodes.get(id);
  };
  DOMAINS.forEach((d, i) => node('d:' + d.id, 0, d.label, `var(--c-${d.id})`, i));
  TIER_ORDER.forEach((t, i) => node('t:' + t, 1, TIERS[t].label, `var(--t-${t})`, i));
  AREAS.forEach((a, i) => node('a:' + a.id, 2, a.label, `var(--a-${a.id})`, i));
  node('x:nogoal', 2, 'No goal named', 'var(--ink-3)', 10, { sink: true });
  node('x:upkeep', 2, 'Keeps life running', 'var(--t-upkeep)', 11, { sink: true });
  node('x:unsorted', 2, 'Not placed yet', 'var(--t-unsorted)', 12, { sink: true });
  state.dreams.forEach((d, i) => node('m:' + d.id, 3, d.dream, 'var(--gold)', i));
  node('m:foundation', 3, 'Foundation', 'var(--ink-3)', 99);

  const links = new Map();
  const add = (a, b, w, rid) => {
    const key = a + '>' + b;
    if (!links.has(key)) links.set(key, { source: nodes.get(a), target: nodes.get(b), value: 0, rset: new Set() });
    const l = links.get(key); l.value += w; l.rset.add(rid);
    nodes.get(a).out += w; nodes.get(b).in += w;
    nodes.get(a).rset.add(rid); nodes.get(b).rset.add(rid);
  };

  state.routines.filter(isLive).forEach(r => {
    const { tier, efforts } = linkFor(r);
    const d = 'd:' + r.category, t = 't:' + tier;
    if (!nodes.has(d)) return;
    add(d, t, 1, r.id);
    if (tier === 'upkeep') return add(t, 'x:upkeep', 1, r.id);
    if (tier === 'unsorted') return add(t, 'x:unsorted', 1, r.id);
    if (!efforts.length) return add(t, 'x:nogoal', 1, r.id);
    const w = 1 / efforts.length;
    efforts.forEach(eid => {
      const e = effortById(eid);
      const a = 'a:' + e.category;
      add(t, a, w, r.id);
      const ds = dreamsFor(eid);
      if (!ds.length) add(a, 'm:foundation', w, r.id);
      else ds.forEach(did => add(a, 'm:' + did, w / ds.length, r.id));
    });
  });

  const list = [...nodes.values()].filter(n => n.in + n.out > 0);
  return { nodes: list, links: [...links.values()].filter(l => l.value > 0) };
}

function renderSankey() {
  const host = $('sankey');
  if (!host || !host.offsetParent) return;
  const { nodes, links } = sankeyModel();
  const W = Math.max(host.clientWidth, 760);
  const H = 460;
  const padL = 96, padR = 160, nodeW = 10, gap = 12, top = 30;
  const cols = [0, 1, 2, 3];
  const colX = c => padL + (W - padL - padR - nodeW) * (c / 3);
  nodes.forEach(n => n.value = Math.max(n.in, n.out));

  const byCol = cols.map(c => nodes.filter(n => n.col === c).sort((a, b) => a.order - b.order));
  const scale = Math.min(...byCol.map(col => (H - top - 8 - gap * (col.length - 1)) / col.reduce((s, n) => s + n.value, 0)));
  byCol.forEach(col => {
    const total = col.reduce((s, n) => s + n.value * scale, 0) + gap * (col.length - 1);
    let y = top + (H - top - 8 - total) / 2;
    col.forEach(n => { n.x = colX(n.col); n.y = y; n.h = Math.max(2, n.value * scale); y += n.h + gap; n.sy = n.y; n.ty = n.y; });
  });
  // Stack ribbons within each node in the order of the node they connect to, so they don't cross needlessly.
  links.sort((a, b) => a.target.y - b.target.y).forEach(l => { l.sy = l.source.sy; l.source.sy += l.value * scale; });
  links.sort((a, b) => a.source.y - b.source.y).forEach(l => { l.ty = l.target.ty; l.target.ty += l.value * scale; });

  const ribbon = l => {
    const h = l.value * scale;
    const x0 = l.source.x + nodeW, x1 = l.target.x, xm = (x0 + x1) / 2;
    return `M${x0},${l.sy} C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty} L${x1},${l.ty + h} C${xm},${l.ty + h} ${xm},${l.sy + h} ${x0},${l.sy + h} Z`;
  };
  const label = n => {
    const right = n.col < 3;
    const x = n.col === 0 ? n.x - 8 : right ? n.x + nodeW + 7 : n.x + nodeW + 8;
    const anchor = n.col === 0 ? 'end' : 'start';
    const cnt = Math.round(n.rset.size);
    return `<text class="sk-label${n.col === 1 || n.col === 2 ? ' halo' : ''}" x="${x}" y="${n.y + n.h / 2}" text-anchor="${anchor}" dominant-baseline="middle">${esc(n.label)}<tspan class="sk-count" dx="5">${cnt}</tspan></text>`;
  };

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Routines flowing from life area through role into goal areas and dreams">
    <g class="sk-heads">${['Life area', 'Role', 'Feeds', 'Moves'].map((t, c) => `<text x="${c === 0 ? colX(0) + nodeW : c === 3 ? colX(3) : colX(c) + nodeW / 2}" y="12" text-anchor="${c === 0 ? 'end' : c === 3 ? 'start' : 'middle'}">${t}</text>`).join('')}</g>
    <g class="sk-links">${links.map((l, i) => `<path class="sk-link" data-i="${i}" d="${ribbon(l)}" style="--lc:${l.source.color}"/>`).join('')}</g>
    <g class="sk-nodes">${nodes.map((n, i) => `<rect class="sk-node${n.sink ? ' sink' : ''}" data-n="${i}" x="${n.x}" y="${n.y}" width="${nodeW}" height="${n.h}" rx="3" style="--nc:${n.color}"/>`).join('')}</g>
    <g class="sk-labels">${nodes.map(label).join('')}</g>
  </svg>`;

  const svg = host.querySelector('svg');
  const paths = [...svg.querySelectorAll('.sk-link')];
  const rects = [...svg.querySelectorAll('.sk-node')];
  const highlight = rset => {
    svg.classList.toggle('focus', !!rset);
    paths.forEach((p, i) => p.classList.toggle('on', !!rset && [...links[i].rset].some(id => rset.has(id))));
    rects.forEach((r, i) => r.classList.toggle('on', !!rset && [...nodes[i].rset].some(id => rset.has(id))));
  };
  const tip = $('tooltip');
  const showTip = (ev, html) => { tip.innerHTML = html; tip.hidden = false; moveTip(ev); };
  const moveTip = ev => { tip.style.left = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (ev.clientY + 14) + 'px'; };
  const hideTip = () => { tip.hidden = true; };

  const pinned = () => state.sankeyPin ? nodes.find(n => n.id === state.sankeyPin) : null;
  const restore = () => { const p = pinned(); highlight(p ? p.rset : null); };

  rects.forEach((r, i) => {
    const n = nodes[i];
    r.addEventListener('mouseenter', ev => { highlight(n.rset); showTip(ev, `<b>${esc(n.label)}</b><span>${plural(n.rset.size, 'routine')}</span>`); });
    r.addEventListener('mousemove', moveTip);
    r.addEventListener('mouseleave', () => { hideTip(); restore(); });
    r.addEventListener('click', () => { state.sankeyPin = state.sankeyPin === n.id ? null : n.id; restore(); renderSankeyDetail(nodes); });
  });
  paths.forEach((p, i) => {
    const l = links[i];
    p.addEventListener('mouseenter', ev => { highlight(l.rset); showTip(ev, `<b>${esc(l.source.label)} → ${esc(l.target.label)}</b><span>${plural(l.rset.size, 'routine')}</span>`); });
    p.addEventListener('mousemove', moveTip);
    p.addEventListener('mouseleave', () => { hideTip(); restore(); });
  });
  // Labels are also click targets (bigger than the thin node bars).
  svg.querySelectorAll('.sk-label').forEach((t, i) => {
    t.addEventListener('mouseenter', () => highlight(nodes[i].rset));
    t.addEventListener('mouseleave', restore);
    t.addEventListener('click', () => rects[i].dispatchEvent(new Event('click')));
  });
  restore();
  renderSankeyDetail(nodes);
}

function renderSankeyDetail(nodes) {
  const el = $('sankeyDetail');
  const n = state.sankeyPin && nodes.find(x => x.id === state.sankeyPin);
  if (!n) { el.innerHTML = `<p class="hint">Tap any bar or label to list the routines running through it.</p>`; return; }
  const rs = [...n.rset].map(routineById).filter(Boolean).sort((a, b) => a.focus.localeCompare(b.focus));
  el.innerHTML = `<div class="detail-head"><span class="swatch" style="background:${n.color}"></span><b>${esc(n.label)}</b><span class="muted">${plural(rs.length, 'routine')}</span><button class="x" id="unpin" aria-label="Clear">✕</button></div>
    <div class="pills">${rs.map(r => `<button class="pill t-${linkFor(r).tier}" data-edit="${esc(r.id)}"><i>${TIERS[linkFor(r).tier].glyph}</i>${esc(r.focus)}</button>`).join('')}</div>`;
  $('unpin').onclick = () => { state.sankeyPin = null; renderSankey(); };
  wireEdits(el);
}

// ---------------------------------------------------------------------
// OVERVIEW — stage pipeline + next moves
// ---------------------------------------------------------------------
function renderPipeline() {
  const { latestGoal } = counts();
  const byStage = Object.fromEntries(STAGE_ORDER.map(s => [s, state.efforts.filter(e => stageFor(e.id, latestGoal) === s)]));
  // Busy stages get wider columns (and a two-up chip grid) instead of towering over the rest.
  const span = s => Math.max(1, Math.ceil(byStage[s].length / 6));
  $('pipeline').style.setProperty('--cols', STAGE_ORDER.map(s => `minmax(0, ${span(s) === 1 ? 1.35 : span(s)}fr)`).join(' '));
  $('pipeline').innerHTML = STAGE_ORDER.map((s, i) => {
    const goals = byStage[s];
    return `<div class="stage-col s-${s}">
      <div class="stage-head"><span class="stage-glyph">${STAGES[s].glyph}</span><div><b>${STAGES[s].label}</b><small>${STAGES[s].desc}</small></div><span class="stage-n">${goals.length}</span></div>
      <div class="stage-body" style="--span:${span(s)}">${goals.length ? goals.map(e => `<button class="goal-chip" data-goal="${esc(e.id)}" style="--area: var(--a-${e.category})"><span class="gc-name">${esc(e.effort)}</span><span class="gc-meta">${areaOf(e.category).label} · ${plural(routinesForEffort(e.id).length, 'routine')}</span></button>`).join('') : `<p class="empty">None here${s === 'embedded' ? ' yet — reviews move goals here' : ''}.</p>`}</div>
      ${i < 3 ? '<span class="stage-arrow" aria-hidden="true"></span>' : ''}
    </div>`;
  }).join('');
  $('pipeline').querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => openGoalDrawer(b.dataset.goal)));
}

function renderMoves() {
  const { latestGoal } = counts();
  const seeds = state.efforts.filter(e => stageFor(e.id, latestGoal) === 'seed');
  const supported = state.efforts.filter(e => stageFor(e.id, latestGoal) === 'supported');
  const orphans = state.routines.filter(r => isLive(r) && linkFor(r).tier === 'drive' && !linkFor(r).efforts.length);
  const unsorted = state.routines.filter(r => isActive(r) && linkFor(r).tier === 'unsorted');

  const move = (n, tone, title, body, items) => items.length ? `
    <div class="move tone-${tone}">
      <div class="move-n">${items.length}</div>
      <div class="move-body">
        <h3>${title}</h3>
        <p>${body}</p>
        <div class="pills">${items.join('')}</div>
      </div>
    </div>` : '';
  const goalPill = e => `<button class="pill" data-goal="${esc(e.id)}" style="--area: var(--a-${e.category})"><i class="dot"></i>${esc(e.effort)}</button>`;
  const routinePill = r => `<button class="pill" data-edit="${esc(r.id)}"><i class="dot" style="background: var(--c-${r.category})"></i>${esc(r.focus)}</button>`;

  const html =
    move(1, 'unsorted', 'Place these routines', 'New or unplaced. Does each one drive a goal, enable one, or is it upkeep?', unsorted.map(routinePill)) +
    move(2, 'seed', 'Give these goals a habit', 'A goal only moves when something in the week carries it — or let it wait on purpose.', seeds.map(goalPill)) +
    move(3, 'drive', 'Name the goal behind these habits', 'They clearly drive something; the Goals Sheet just doesn’t say what yet.', orphans.map(routinePill)) +
    move(4, 'supported', 'Only upkeep feeds these goals', 'The conditions are there, but nothing drives the goal directly.', supported.map(goalPill));

  $('moves').innerHTML = html || `<p class="empty">Nothing is asking for attention — every goal has a routine and every routine has a place.</p>`;
  wireEdits($('moves'));
  $('moves').querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => openGoalDrawer(b.dataset.goal)));
}

// ---------------------------------------------------------------------
// GOALS
// ---------------------------------------------------------------------
function renderDreams() {
  $('dreams').innerHTML = state.dreams.map(d => {
    const goals = state.efforts.filter(e => dreamsFor(e.id).includes(d.id));
    const rcount = new Set(goals.flatMap(g => routinesForEffort(g.id).map(r => r.id))).size;
    return `<article class="dream">
      <span class="dream-icon">${esc(d.icon)}</span>
      <h3>${esc(d.dream)}</h3>
      <p class="dream-details">${esc(d.details)}</p>
      <p class="dream-how"><span>How</span>${esc(d.how)}</p>
      <div class="dream-feed">${goals.length ? `<b>${goals.length}</b> ${goals.length === 1 ? 'goal' : 'goals'} · <b>${rcount}</b> ${rcount === 1 ? 'routine' : 'routines'} flowing in` : 'No goal points here yet'}</div>
    </article>`;
  }).join('');
}

function renderGoalList() {
  const { latestGoal } = counts();
  $('goalList').innerHTML = AREAS.map(area => {
    const efforts = state.efforts.filter(e => e.category === area.id);
    if (!efforts.length) return '';
    const rooted = efforts.filter(e => ['rooted', 'embedded'].includes(stageFor(e.id, latestGoal))).length;
    return `<section class="group" style="--area: var(--a-${area.id})">
      <header class="group-head"><span class="group-dot"></span><h2>${esc(area.label)}</h2><span class="group-meta">${rooted} of ${efforts.length} rooted</span></header>
      <div class="rows">${efforts.map(e => {
        const stage = stageFor(e.id, latestGoal);
        const rs = routinesForEffort(e.id);
        return `<button class="row goal-row" data-goal="${esc(e.id)}">
          ${stageTrack(stage)}
          <span class="row-main"><span class="row-title">${esc(e.effort)}</span><span class="row-sub">${esc(e.reason)}</span></span>
          <span class="row-side">${momentumTag(latestGoal[e.id])}${stageTag(stage)}<span class="row-count">${rs.length ? plural(rs.length, 'routine') : 'no routine'}</span></span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join('');
  $('goalList').querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => openGoalDrawer(b.dataset.goal)));
}

// Map view — goals on the left, the routines carrying them on the right, joined by lines.
function renderGoalMap() {
  const { latestGoal } = counts();
  $('goalMap').innerHTML = AREAS.map(area => {
    const efforts = state.efforts.filter(e => e.category === area.id);
    if (!efforts.length) return '';
    const seen = new Set(), routines = [];
    efforts.forEach(e => routinesForEffort(e.id).forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); routines.push(r); } }));
    routines.sort((a, b) => (linkFor(a).tier === 'drive' ? 0 : 1) - (linkFor(b).tier === 'drive' ? 0 : 1));
    return `<section class="map-block" style="--area: var(--a-${area.id})">
      <header class="group-head"><span class="group-dot"></span><h2>${esc(area.label)}</h2></header>
      <div class="map-grid">
        <svg class="map-lines"></svg>
        <div class="map-col">${efforts.map(e => {
          const stage = stageFor(e.id, latestGoal);
          const rs = routinesForEffort(e.id);
          return `<div class="map-goal s-${stage}" data-node="e:${esc(e.id)}" tabindex="0">
            <div class="mg-top">${stageTrack(stage)}<span class="mg-title">${esc(e.effort)}</span></div>
            <div class="mg-dreams">${dreamTags(e.id)}</div>
            <div class="mg-nested">${rs.length ? rs.map(r => `<span class="pill small t-${linkFor(r).tier}" data-node="r:${esc(r.id)}"><i>${TIERS[linkFor(r).tier].glyph}</i>${esc(r.focus)}</span>`).join('') : '<span class="muted">No routine yet</span>'}</div>
          </div>`;
        }).join('')}</div>
        <div class="map-col map-routines">${routines.length ? routines.map(r => `<div class="map-routine t-${linkFor(r).tier}" data-node="r:${esc(r.id)}" style="--dom: var(--c-${r.category})" tabindex="0"><i>${TIERS[linkFor(r).tier].glyph}</i><span>${esc(r.focus)}</span><small>${esc(shortFreq(r.frequency))}</small></div>`).join('') : '<p class="empty">Nothing carries these goals yet.</p>'}</div>
      </div>
    </section>`;
  }).join('');
  $('goalMap').querySelectorAll('[data-node]').forEach(n => n.addEventListener('click', ev => {
    ev.stopPropagation();
    state.mapTrace = state.mapTrace === n.dataset.node ? null : n.dataset.node;
    applyMapTrace();
  }));
  requestAnimationFrame(drawMapLines);
}

function drawMapLines() {
  document.querySelectorAll('.map-block').forEach(block => {
    const svg = block.querySelector('.map-lines');
    const grid = block.querySelector('.map-grid');
    const rc = grid.getBoundingClientRect();
    const right = block.querySelector('.map-routines');
    if (!rc.width || getComputedStyle(right).display === 'none') { svg.innerHTML = ''; return; }
    svg.setAttribute('viewBox', `0 0 ${rc.width} ${rc.height}`);
    let d = '';
    block.querySelectorAll('.map-goal').forEach(g => {
      const eid = g.dataset.node.slice(2), gr = g.getBoundingClientRect();
      routinesForEffort(eid).forEach(r => {
        const node = block.querySelector(`.map-routine[data-node="r:${CSS.escape(String(r.id))}"]`);
        if (!node) return;
        const nr = node.getBoundingClientRect();
        const x1 = gr.right - rc.left, y1 = gr.top + gr.height / 2 - rc.top, x2 = nr.left - rc.left, y2 = nr.top + nr.height / 2 - rc.top, xm = (x1 + x2) / 2;
        d += `<path class="ml t-${linkFor(r).tier}" data-a="e:${esc(eid)}" data-b="r:${esc(r.id)}" d="M${x1},${y1} C${xm},${y1} ${xm},${y2} ${x2},${y2}"/>`;
      });
    });
    svg.innerHTML = d;
  });
  applyMapTrace();
}

function applyMapTrace() {
  const map = $('goalMap');
  const key = state.mapTrace;
  const keys = new Set(key ? [key] : []);
  if (key && key.startsWith('e:')) routinesForEffort(key.slice(2)).forEach(r => keys.add('r:' + r.id));
  if (key && key.startsWith('r:')) { const r = routineById(key.slice(2)); if (r) linkFor(r).efforts.forEach(id => keys.add('e:' + id)); }
  map.classList.toggle('tracing', !!key);
  map.querySelectorAll('[data-node]').forEach(n => n.classList.toggle('lit', keys.has(n.dataset.node)));
  map.querySelectorAll('.ml').forEach(p => p.classList.toggle('lit', !!key && (p.dataset.a === key || p.dataset.b === key)));
}
document.addEventListener('click', ev => {
  if (state.mapTrace && ev.target.closest('#goalMap') && !ev.target.closest('[data-node]')) { state.mapTrace = null; applyMapTrace(); }
});

function setGoalMode(mode) {
  state.goalMode = mode; localSet(LS.goalMode, mode);
  document.querySelectorAll('#goalMode button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('goalList').hidden = mode !== 'list';
  $('goalMap').hidden = mode !== 'map';
  if (mode === 'map') requestAnimationFrame(drawMapLines);
}
document.querySelectorAll('#goalMode button').forEach(b => b.addEventListener('click', () => setGoalMode(b.dataset.mode)));

// ---------------------------------------------------------------------
// ROUTINES
// ---------------------------------------------------------------------
function renderTierChips() {
  const pool = state.routines.filter(r => state.showPaused || isActive(r));
  const c = {};
  pool.forEach(r => { const t = linkFor(r).tier; c[t] = (c[t] || 0) + 1; });
  $('tierChips').innerHTML = TIER_ORDER.map(t => `<button class="filter t-${t}${state.tierFilter.has(t) ? ' on' : ''}" data-tier="${t}"><i>${TIERS[t].glyph}</i>${TIERS[t].label}<b>${c[t] || 0}</b></button>`).join('');
  $('tierChips').querySelectorAll('.filter').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tier;
    if (state.tierFilter.has(t)) state.tierFilter.delete(t); else state.tierFilter.add(t);
    renderRoutines();
  }));
}

function flowsInto(r) {
  const l = linkFor(r);
  if (l.tier === 'upkeep') return `<span class="flows muted">Stands on its own</span>`;
  if (l.tier === 'unsorted') return `<span class="flows warn">Needs a role</span>`;
  if (!l.efforts.length) return `<span class="flows warn">No goal named yet</span>`;
  return `<span class="flows">${l.efforts.map(id => { const e = effortById(id); return `<span class="to" style="--area: var(--a-${e.category})">${esc(e.effort)}</span>`; }).join('')}</span>`;
}

function routineRow(r) {
  const l = linkFor(r);
  return `<button class="row routine-row${isActive(r) ? '' : ' paused'}" data-edit="${esc(r.id)}" style="--dom: var(--c-${r.category})">
    <span class="dom-dot" title="${esc(domainOf(r.category).label)}"></span>
    <span class="row-main">
      <span class="row-title">${esc(r.focus)}${isNote(r) ? '<span class="mini">note</span>' : ''}${isActive(r) ? '' : '<span class="mini">paused</span>'}</span>
      <span class="row-sub">${esc(shortFreq(r.frequency))}${kindOf(r.frequency) ? ` · ${esc(kindOf(r.frequency))}` : ''}</span>
    </span>
    <span class="row-flow">${tierTag(l.tier)}${flowsInto(r)}</span>
  </button>`;
}

function renderRoutines() {
  renderTierChips();
  const q = state.search.trim().toLowerCase();
  const items = state.routines.filter(r =>
    (state.showPaused || isActive(r)) &&
    state.tierFilter.has(linkFor(r).tier) &&
    (!q || `${r.focus} ${r.why} ${r.what}`.toLowerCase().includes(q)));

  const groups = state.group === 'tier'
    ? TIER_ORDER.map(t => ({ title: TIERS[t].label, sub: TIERS[t].desc, glyph: TIERS[t].glyph, color: `var(--t-${t})`, items: items.filter(r => linkFor(r).tier === t) }))
    : DOMAINS.map(d => ({ title: d.label, sub: '', glyph: d.icon, color: `var(--c-${d.id})`, items: items.filter(r => r.category === d.id) }));

  $('routineList').innerHTML = groups.filter(g => g.items.length).map(g => `
    <section class="group" style="--area: ${g.color}">
      <header class="group-head"><span class="group-glyph">${g.glyph}</span><h2>${g.title}</h2><span class="group-meta">${g.items.length}${g.sub ? ` · ${esc(g.sub)}` : ''}</span></header>
      <div class="rows">${g.items.map(routineRow).join('')}</div>
    </section>`).join('') || '<p class="empty">Nothing matches.</p>';
  wireEdits($('routineList'));
}

document.querySelectorAll('#groupSeg button').forEach(b => b.addEventListener('click', () => {
  state.group = b.dataset.group; localSet(LS.group, state.group);
  document.querySelectorAll('#groupSeg button').forEach(x => x.classList.toggle('active', x === b));
  renderRoutines();
}));
document.querySelectorAll('#groupSeg button').forEach(x => x.classList.toggle('active', x.dataset.group === state.group));
$('routineSearch').addEventListener('input', e => { state.search = e.target.value; renderRoutines(); });
$('showPaused').addEventListener('change', e => { state.showPaused = e.target.checked; renderRoutines(); });

$('exportLinks').addEventListener('click', async () => {
  const payload = JSON.stringify({ routineLinks: state.linkEdits, effortDreams: state.dreamEdits }, null, 1);
  const status = $('exportStatus');
  try { await navigator.clipboard.writeText(payload); status.textContent = 'Copied — paste it to Claude to bake into the starting map.'; }
  catch { status.textContent = 'Clipboard blocked — your edits are still saved in this browser.'; }
  setTimeout(() => status.textContent = '', 4000);
});
$('resetLinks').addEventListener('click', () => {
  if (!confirm('Clear your role and dream-link edits and go back to the starting map?')) return;
  state.linkEdits = {}; state.dreamEdits = {};
  localSet(LS.links, {}); localSet(LS.dreams, {});
  renderAll();
});

function wireEdits(root) {
  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); openRoutineDrawer(b.dataset.edit); }));
}

// ---------------------------------------------------------------------
// Drawer — routine role editor, goal detail
// ---------------------------------------------------------------------
function openDrawer(html, mount) {
  const d = $('drawer');
  d.innerHTML = `<button class="drawer-close" aria-label="Close">✕</button>${html}`;
  d.querySelector('.drawer-close').onclick = closeDrawer;
  mount && mount(d);
  $('scrim').hidden = false;
  requestAnimationFrame(() => { d.classList.add('open'); $('scrim').classList.add('open'); });
  d.setAttribute('aria-hidden', 'false');
  d.scrollTop = 0;
}
function closeDrawer() {
  const d = $('drawer');
  d.classList.remove('open'); $('scrim').classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
  setTimeout(() => { $('scrim').hidden = true; }, 220);
}
$('scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

function openRoutineDrawer(id) {
  const r = routineById(id);
  if (!r) return;
  const l = linkFor(r);
  const sel = { tier: l.tier, efforts: new Set(l.efforts) };
  const last = latestBy('routine')[r.id];
  openDrawer(`
    <div class="dr-head" style="--dom: var(--c-${r.category})">
      <p class="kicker"><span class="dom-dot"></span>${esc(domainOf(r.category).label)} · ${esc(r.frequency)}</p>
      <h2>${esc(r.focus)}</h2>
      <p class="dr-why">${esc(r.why)}</p>
      <dl class="dr-facts">
        ${r.what ? `<div><dt>What</dt><dd>${esc(r.what)}</dd></div>` : ''}
        ${r.object ? `<div><dt>Needs</dt><dd>${esc(r.object)}</dd></div>` : ''}
        ${last ? `<div><dt>Last review</dt><dd>${esc(last.value)} · ${esc(last.date)}</dd></div>` : ''}
      </dl>
    </div>
    <div class="dr-section">
      <h3>Role</h3>
      <div class="role-pick">${TIER_ORDER.map(t => `<button type="button" class="role t-${t}" data-tier="${t}"><i>${TIERS[t].glyph}</i><b>${TIERS[t].label}</b><span>${TIERS[t].desc}</span></button>`).join('')}</div>
    </div>
    <div class="dr-section" id="drGoals">
      <h3>Flows into</h3>
      ${AREAS.map(a => {
        const es = state.efforts.filter(e => e.category === a.id);
        return es.length ? `<div class="pick-group" style="--area: var(--a-${a.id})"><span class="pick-k">${esc(a.label)}</span><div class="pick-opts">${es.map(e => `<label class="pick"><input type="checkbox" value="${esc(e.id)}"${sel.efforts.has(e.id) ? ' checked' : ''}><span>${esc(e.effort)}</span></label>`).join('')}</div></div>` : '';
      }).join('')}
    </div>
    <p class="dr-note" id="drUpkeep">Upkeep stands on its own — it doesn't need a goal to earn its place.</p>
    <div class="dr-actions"><button class="btn ghost" id="drCancel">Cancel</button><button class="btn" id="drSave">Save</button></div>
  `, d => {
    const sync = () => {
      d.querySelectorAll('.role').forEach(b => b.classList.toggle('sel', b.dataset.tier === sel.tier));
      d.querySelector('#drGoals').hidden = !(sel.tier === 'drive' || sel.tier === 'enable');
      d.querySelector('#drUpkeep').hidden = sel.tier !== 'upkeep';
    };
    d.querySelectorAll('.role').forEach(b => b.addEventListener('click', () => { sel.tier = b.dataset.tier; sync(); }));
    d.querySelectorAll('.pick input').forEach(c => c.addEventListener('change', () => { if (c.checked) sel.efforts.add(c.value); else sel.efforts.delete(c.value); }));
    d.querySelector('#drCancel').onclick = closeDrawer;
    d.querySelector('#drSave').onclick = () => {
      state.linkEdits[r.id] = { tier: sel.tier, efforts: (sel.tier === 'drive' || sel.tier === 'enable') ? [...sel.efforts] : [] };
      localSet(LS.links, state.linkEdits);
      closeDrawer();
      renderAll();
    };
    sync();
  });
}

function openGoalDrawer(effortId) {
  const e = effortById(effortId);
  if (!e) return;
  const latestGoal = latestBy('goal');
  const stage = stageFor(e.id, latestGoal);
  const last = latestGoal[e.id];
  const rs = routinesForEffort(e.id, { includeNotes: true });
  const sel = new Set(dreamsFor(e.id));
  openDrawer(`
    <div class="dr-head" style="--dom: var(--a-${e.category})">
      <p class="kicker"><span class="dom-dot"></span>${esc(areaOf(e.category).label)}</p>
      <h2>${esc(e.effort)}</h2>
      <div class="dr-tags">${stageTrack(stage)}${stageTag(stage)}${momentumTag(last)}</div>
      <p class="dr-why">${esc(e.reason)}</p>
      <dl class="dr-facts"><div><dt>How</dt><dd>${esc(e.how)}</dd></div>
      ${last && last.notes ? `<div><dt>Last note</dt><dd>${esc(last.notes)} <span class="muted">· ${esc(last.date)}</span></dd></div>` : ''}</dl>
    </div>
    <div class="dr-section">
      <h3>Carried by</h3>
      ${rs.length ? `<div class="pills">${rs.map(r => `<button class="pill t-${linkFor(r).tier}" data-edit="${esc(r.id)}"><i>${TIERS[linkFor(r).tier].glyph}</i>${esc(r.focus)}${isNote(r) ? ' · note' : ''}</button>`).join('')}</div>`
        : `<p class="dr-note">Nothing yet — this goal is a seed. Open a routine on the Routines page and point it here, or add one in TickTick first.</p>`}
    </div>
    <div class="dr-section">
      <h3>Moves these dreams</h3>
      <div class="pick-opts">${state.dreams.map(d => `<label class="pick"><input type="checkbox" value="${esc(d.id)}"${sel.has(d.id) ? ' checked' : ''}><span>${esc(d.icon)} ${esc(d.dream)}</span></label>`).join('')}</div>
      <p class="dr-hint">Leave all unchecked for Foundation — a goal that feeds everything.</p>
    </div>
    <div class="dr-actions"><button class="btn ghost" id="drCancel">Close</button><button class="btn" id="drSave">Save dreams</button></div>
  `, d => {
    wireEdits(d);
    d.querySelectorAll('.pick input').forEach(c => c.addEventListener('change', () => { if (c.checked) sel.add(c.value); else sel.delete(c.value); }));
    d.querySelector('#drCancel').onclick = closeDrawer;
    d.querySelector('#drSave').onclick = () => {
      state.dreamEdits[e.id] = [...sel];
      localSet(LS.dreams, state.dreamEdits);
      closeDrawer();
      renderAll();
    };
  });
}

// ---------------------------------------------------------------------
// REVIEW — goals, the routines under them, then upkeep
// ---------------------------------------------------------------------
function answer(key) { return state.answers[key] = state.answers[key] || { value: '', notes: '' }; }

function reviewSections() {
  const sections = AREAS.map(a => ({ area: a, efforts: state.efforts.filter(e => e.category === a.id) })).filter(s => s.efforts.length);
  const placed = new Set();
  sections.forEach(s => s.efforts.forEach(e => routinesForEffort(e.id).forEach(r => { if (linkFor(r).tier === 'drive') placed.add(r.id); })));
  const orphans = state.routines.filter(r => isLive(r) && linkFor(r).tier === 'drive' && !placed.has(r.id));
  const maintenance = state.routines.filter(r => isLive(r) && ['enable', 'upkeep', 'unsorted'].includes(linkFor(r).tier));
  return { sections, orphans, maintenance };
}

function reviewKeys() {
  const { sections, orphans, maintenance } = reviewSections();
  const keys = [];
  sections.forEach(s => s.efforts.forEach(e => {
    keys.push('e:' + e.id);
    routinesForEffort(e.id).filter(r => linkFor(r).tier === 'drive').forEach(r => keys.push('r:' + r.id));
  }));
  orphans.forEach(r => keys.push('r:' + r.id));
  maintenance.forEach(r => keys.push('r:' + r.id));
  return [...new Set(keys)];
}

function rating(key, values) {
  const a = answer(key);
  return `<div class="rating" data-key="${esc(key)}">${values.map(v => `<button type="button" data-val="${v}" class="${a.value === v ? 'sel r-' + slug(v) : ''}">${v}</button>`).join('')}</div>`;
}

function routineReviewRow(r, latestR) {
  const key = 'r:' + r.id;
  const last = latestR[r.id];
  return `<div class="rv-r" style="--dom: var(--c-${r.category})">
    <div class="rv-line"><span class="rv-name"><span class="dom-dot"></span>${esc(r.focus)}${last ? `<small>last · ${esc(last.value)}</small>` : ''}</span>${rating(key, SERVING)}</div>
    <input class="rv-note" data-key="${esc(key)}" placeholder="Note (optional)" value="${esc(answer(key).notes)}">
  </div>`;
}

function renderReviewForm() {
  const latestG = latestBy('goal'), latestR = latestBy('routine');
  const { sections, orphans, maintenance } = reviewSections();

  const acc = (id, glyph, color, label, body) => `
    <section class="acc${state.openAcc.has(id) ? ' open' : ''}" data-acc="${id}" style="--area: ${color}">
      <button type="button" class="acc-head"><span class="acc-glyph">${glyph}</span><h2>${esc(label)}</h2><span class="acc-count"></span><span class="chev" aria-hidden="true"></span></button>
      <div class="acc-body">${body}</div>
    </section>`;

  let html = sections.map(({ area, efforts }) => acc('area-' + area.id, area.icon, `var(--a-${area.id})`, area.label, efforts.map(e => {
    const drivers = routinesForEffort(e.id).filter(r => linkFor(r).tier === 'drive');
    const stage = stageFor(e.id, latestG);
    return `<div class="rv-goal">
      <div class="rv-line"><span class="rv-gname">${stageTrack(stage)}${esc(e.effort)}</span>${rating('e:' + e.id, MOMENTUM)}</div>
      <p class="rv-why">${esc(e.reason)}</p>
      <input class="rv-note" data-key="e:${esc(e.id)}" placeholder="What's in the way, or working well?" value="${esc(answer('e:' + e.id).notes)}">
      ${drivers.length ? `<div class="rv-kids"><span class="rv-k">Routines driving it — serving it?</span>${drivers.map(r => routineReviewRow(r, latestR)).join('')}</div>` : `<p class="rv-seed">No routine drives this yet — does it need one?</p>`}
    </div>`;
  }).join(''))).join('');

  if (orphans.length) html += acc('orphans', '◆', 'var(--t-drive)', 'Habits With No Goal Named',
    `<p class="rv-why">Serving you? And is there a goal worth writing down for them?</p>${orphans.map(r => routineReviewRow(r, latestR)).join('')}`);
  if (maintenance.length) html += acc('upkeep', '○', 'var(--t-upkeep)', 'Upkeep — Is It Holding?',
    DOMAINS.map(d => { const rs = maintenance.filter(r => r.category === d.id); return rs.length ? `<div class="rv-dom"><span class="rv-k">${d.label}</span>${rs.map(r => routineReviewRow(r, latestR)).join('')}</div>` : ''; }).join(''));

  const form = $('reviewForm');
  form.innerHTML = html;
  form.querySelectorAll('.acc-head').forEach(h => h.addEventListener('click', () => {
    const sec = h.parentElement, id = sec.dataset.acc;
    if (state.openAcc.has(id)) state.openAcc.delete(id); else state.openAcc.add(id);
    sec.classList.toggle('open');
  }));
  form.querySelectorAll('.rating').forEach(row => row.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const a = answer(row.dataset.key);
    a.value = a.value === b.dataset.val ? '' : b.dataset.val;
    row.querySelectorAll('button').forEach(x => x.className = x.dataset.val === a.value ? 'sel r-' + slug(a.value) : '');
    updateReviewProgress();
  })));
  form.querySelectorAll('.rv-note').forEach(i => i.addEventListener('input', () => { answer(i.dataset.key).notes = i.value; }));
  updateReviewProgress();
}

function ring(pct, big, small) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="${r}"/><circle class="ring-fg" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg><div class="ring-txt"><b>${big}</b><small>${small}</small></div>`;
}

function updateReviewProgress() {
  const keys = reviewKeys();
  const n = keys.filter(k => answer(k).value).length;
  $('reviewRing').innerHTML = ring(keys.length ? n / keys.length : 0, n, `of ${keys.length}`);
  document.querySelectorAll('.acc').forEach(acc => {
    const ks = [...acc.querySelectorAll('.rating')].map(r => r.dataset.key);
    const done = ks.filter(k => answer(k).value).length;
    const el = acc.querySelector('.acc-count');
    el.textContent = `${done}/${ks.length}`;
    el.classList.toggle('done', done === ks.length && ks.length > 0);
  });
}

function renderReviewTiming() {
  const { due, daysUntil } = reviewSchedule();
  const label = due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  $('reviewKicker').textContent = daysUntil === 0 ? 'Due today' : `Next review · ${label}`;
  $('navReviewPill').textContent = daysUntil === 0 ? 'Today' : `${daysUntil}d`;
  $('navReviewPill').classList.toggle('due', daysUntil <= 1);
  const pct = 1 - daysUntil / REVIEW_INTERVAL_DAYS;
  $('sideReview').innerHTML = `<div class="rr-ring">${ring(pct, daysUntil === 0 ? '0' : daysUntil, daysUntil === 1 ? 'day' : 'days')}</div><div class="rr-label"><b>${daysUntil === 0 ? 'Review today' : 'Until review'}</b><small>${label}</small></div>`;
  $('sideReview').onclick = () => activateTab('review');
}

async function saveReview() {
  const status = $('reviewStatus');
  const date = today();
  const rows = [];
  Object.entries(state.answers).forEach(([key, a]) => {
    if (!a.value && !a.notes) return;
    if (key.startsWith('e:')) {
      const e = effortById(key.slice(2)); if (!e) return;
      rows.push({ date, kind: 'goal', id: e.id, name: e.effort, area: e.category, value: a.value, notes: a.notes });
    } else {
      const r = routineById(key.slice(2)); if (!r) return;
      rows.push({ date, kind: 'routine', id: r.id, name: r.focus, domain: r.category, tier: linkFor(r).tier, value: a.value, notes: a.notes, why: r.why });
    }
  });
  if (!rows.length) { status.textContent = 'Nothing to save yet — rate at least one item.'; return; }
  status.textContent = 'Saving…';

  let sent = false, failed = false;
  if ($('sendToSheets').checked) {
    try {
      const goalRows = rows.filter(r => r.kind === 'goal').map(r => ({ date, category: areaOf(r.area).label, categoryId: r.area, effortId: r.id, effort: r.name, momentum: r.value, notes: r.notes }));
      const routineRows = rows.filter(r => r.kind === 'routine').map(r => ({ date, category: domainOf(r.domain).label, routine: r.name, serving: r.value, notes: r.notes, why: r.why }));
      if (goalRows.length) await apiPost(GOALS_API, 'addReviewBatch', { rows: goalRows });
      if (routineRows.length) await apiPost(ROUTINES_API, 'addReviewBatch', { rows: routineRows });
      sent = true;
    } catch { failed = true; }
  }

  if (sent) {
    // The Sheets are now the record; re-read them rather than keeping a duplicate here.
    await Promise.allSettled([
      apiGet(GOALS_API, 'reviews').then(v => { if (Array.isArray(v)) state.sheetGoalReviews = v; }),
      apiGet(ROUTINES_API, 'reviews').then(v => { if (Array.isArray(v)) state.sheetRoutineReviews = v; }),
    ]);
  } else {
    state.localReviews = state.localReviews.concat(rows);
    localSet(LS.reviews, state.localReviews);
  }

  state.answers = {};
  state.openAcc = new Set();
  renderAll();
  status.textContent = failed ? 'Could not reach the Sheets — saved in this browser instead.' : `Saved ${plural(rows.length, 'review')}${sent ? ' to both Sheets' : ''}.`;
  setTimeout(() => status.textContent = '', 5000);
}
$('saveReviewBtn').addEventListener('click', saveReview);

function renderReviewHistory() {
  const rows = allReviewRows().filter(r => r.date);
  const el = $('reviewHistory');
  if (!rows.length) { el.innerHTML = '<p class="empty">No reviews saved yet.</p>'; return; }
  const byDate = {};
  rows.forEach(r => (byDate[r.date] = byDate[r.date] || []).push(r));
  el.innerHTML = Object.keys(byDate).sort().reverse().map(date => {
    const entries = byDate[date];
    const g = entries.filter(r => r.kind === 'goal').length, rt = entries.length - g;
    const good = entries.filter(r => ['On Track', 'Yes'].includes(r.value)).length;
    return `<details class="hist">
      <summary><span class="hist-date">${esc(new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</span><span class="hist-sum">${plural(g, 'goal')} · ${plural(rt, 'routine')} · ${good} holding</span><span class="hist-src">${esc([...new Set(entries.map(r => r.source))].join(' + '))}</span></summary>
      <div class="hist-body">${entries.map(r => `<div class="hist-row"><span>${r.kind === 'goal' ? '●' : '◆'} ${esc(r.name)}</span><span class="tag mo m-${slug(r.value)}">${esc(r.value || '—')}</span>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}</div>`).join('')}</div>
    </details>`;
  }).join('');
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
function renderAll() {
  renderHero();
  renderBalance();
  renderSankey();
  renderPipeline();
  renderMoves();
  renderDreams();
  renderGoalList();
  renderGoalMap();
  renderRoutines();
  renderReviewTiming();
  renderReviewForm();
  renderReviewHistory();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { renderSankey(); drawMapLines(); }, 140);
});

renderAll();
setGoalMode(state.goalMode);
const savedTab = location.hash.slice(1) || localGet(LS.tab, 'overview');
activateTab(document.getElementById(savedTab) ? savedTab : 'overview');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { renderSankey(); drawMapLines(); });
loadLive();
