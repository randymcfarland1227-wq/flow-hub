// =====================================================================
// Flow — one hub for goals and the routines that carry them.
//
// Structure (nothing from the Sheets is renamed or merged away):
//   Broad goals   — the five present-focus goals from the Goals Sheet,
//                   each holding its sub-goals (the Sheet's "efforts").
//   Routines      — every habit and task from the Routines Sheet, each with
//                   a role: ◆ Drives a sub-goal · ◇ Enables one · ○ Upkeep.
//   Life areas    — a shared lens (Body, Mind, Spirit, Connection, Marvel,
//                   Money, Home) used to browse both side by side. Every item
//                   still shows its own Sheet category.
//   Activity      — TickTick history (js/activity.js): last done, 30-day
//                   rate, overdue tasks.
// =====================================================================

// ---- Life areas: the shared lens ------------------------------------
const LIFE_AREAS = [
  { id: 'body',       label: 'Body',       icon: '💪', blurb: 'Training, nourishment, grooming and recovery' },
  { id: 'mind',       label: 'Mind',       icon: '🧠', blurb: 'Presence, reflection, learning and rest' },
  { id: 'spirit',     label: 'Spirit',     icon: '✨', blurb: 'Music, creativity and embodiment' },
  { id: 'connection', label: 'Connection', icon: '🤝', blurb: 'People, relationships and experiences' },
  { id: 'marvel',     label: 'Marvel',     icon: '🐾', blurb: 'Training, care, bonding and supplies' },
  { id: 'money',      label: 'Money',      icon: '💰', blurb: 'Finances, savings, income and purchases' },
  { id: 'home',       label: 'Home',       icon: '🏠', blurb: 'Cleaning, organizing, upkeep and planning' },
];

// Routines Sheet categories → life area (per-routine overrides below).
const DOMAIN_AREA = { mind: 'mind', body: 'body', soul: 'spirit', cleaning: 'home', organizing: 'home', dog: 'marvel' };
const ROUTINE_AREA = {
  'organizing-personal-finance-allocation': 'money',
  'organizing-savings-allocations': 'money',
  'organizing-needed-purchases': 'money',
  'organizing-next-step-awareness-review': 'money',
  'organizing-family-finance-review': 'money',
  'organizing-side-hustle-progress': 'money',
  'organizing-job-search-map-note': 'money',
  'mind-open-job-search': 'money',
  'organizing-family-altruism-review': 'connection',
};
// Goals Sheet categories → life area (per-sub-goal overrides below).
const GOAL_AREA = { physical: 'body', mental: 'mind', connection: 'connection', financial: 'money', spiritual: 'spirit' };
const EFFORT_AREA = { 'mental-cleanspaces': 'home', 'connection-training': 'marvel' };

// ---- Sheet categories, kept exactly as the Sheets have them -----------
const DOMAINS = [
  { id: 'mind', label: 'Mind' }, { id: 'body', label: 'Body' }, { id: 'soul', label: 'Soul' },
  { id: 'cleaning', label: 'Cleaning' }, { id: 'organizing', label: 'Organizing' }, { id: 'dog', label: 'Marvel' },
];
const BROAD_GOALS = [
  { id: 'physical',   label: 'Physical Body', icon: '💪', headline: 'Our body is our best friend and we take care of her like a delicate rose, so we have the best physical experience.' },
  { id: 'mental',     label: 'Mental',        icon: '🧠', headline: 'Equally as important as physical well-being is mental — we take care of our body daily, so we must do the same for our brain.' },
  { id: 'connection', label: 'Connection',    icon: '🤝', headline: 'Building a life that focuses on the souls in the world around us rewards us with an experience of love, memories, joy, and connection.' },
  { id: 'financial',  label: 'Financial',     icon: '💰', headline: 'A healthy relationship with our finances lets us think in non-restrictive ways, and security eases tension in our brains and bodies.' },
  { id: 'spiritual',  label: 'Spiritual / Embodiment', icon: '✨', headline: 'Having the deepest connection within our soul provides us purpose — how we act is how we embody it.' },
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
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LS = {
  links: 'flowHub.routineLinks', dreams: 'flowHub.effortDreams', reviews: 'flowHub.reviews',
  theme: 'flowHub.theme', rmode: 'flowHub.routineMode', kind: 'flowHub.kindFilter',
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
  routineMode: localGet(LS.rmode, 'week'),
  kindFilter: localGet(LS.kind, 'all'),
  areaFilter: 'all',
  search: '',
  answers: {},
  openAcc: new Set(),
  sankeyPin: null,
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
const $ = id => document.getElementById(id);
const slug = v => String(v || '').toLowerCase().replace(/\s+/g, '-');
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => isoDay(new Date());
const parseDay = s => new Date(s + 'T00:00:00');
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const fmtDay = (s, opts = { month: 'short', day: 'numeric' }) => parseDay(s).toLocaleDateString(undefined, opts);
function ago(s) {
  if (!s) return 'never';
  const n = daysBetween(s, today());
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 14) return `${n} days ago`;
  return fmtDay(s);
}

const lifeArea = id => LIFE_AREAS.find(a => a.id === id);
const domainOf = id => DOMAINS.find(d => d.id === id) || { id, label: id };
const broadOf = id => BROAD_GOALS.find(g => g.id === id) || { id, label: id, icon: '•', headline: '' };
const effortById = id => state.efforts.find(e => e.id === id);
const routineById = id => state.routines.find(r => String(r.id) === String(id));
const dreamById = id => state.dreams.find(d => d.id === id);
const areaOfRoutine = r => ROUTINE_AREA[r.id] || DOMAIN_AREA[r.category] || 'home';
const areaOfEffort = e => EFFORT_AREA[e.id] || GOAL_AREA[e.category] || 'mind';

const isActive = r => String(r.active) !== 'false';
// Reference notes/reminders from TickTick — linked like routines, but never reviewed or counted.
const isNote = r => /^(reminder|reference|project reminder|reference reminder)\b/i.test(r.frequency || '');
const isLive = r => isActive(r) && !isNote(r);
const kindOf = r => /^habit/i.test(r.frequency || '') ? 'habit' : isNote(r) ? 'note' : 'task';
const shortFreq = f => String(f || '').replace(/^(Habit|Task bundle|Task|Reminder|Reference|Project reminder|Reference reminder)\s*·\s*/i, '');

function linkFor(r) {
  const l = state.linkEdits[r.id] || SEED_ROUTINE_LINKS[r.id] || { tier: 'unsorted', efforts: [] };
  return { tier: TIERS[l.tier] ? l.tier : 'unsorted', efforts: (l.efforts || []).filter(id => effortById(id)) };
}
function dreamsFor(effortId) {
  return (state.dreamEdits[effortId] || SEED_EFFORT_DREAMS[effortId] || []).filter(id => dreamById(id));
}
function routinesForEffort(effortId, { includePaused = false, includeNotes = false } = {}) {
  return state.routines.filter(r => {
    if (!includePaused && !isActive(r)) return false;
    if (!includeNotes && isNote(r)) return false;
    const l = linkFor(r);
    return (l.tier === 'drive' || l.tier === 'enable' || l.tier === 'upkeep') && l.efforts.includes(effortId);
  });
}

// ---------------------------------------------------------------------
// Activity (TickTick)
// ---------------------------------------------------------------------
const ACT = (typeof ACTIVITY !== 'undefined' && ACTIVITY) || { asOf: null, windowDays: 30, routines: {} };
const actOf = r => ACT.routines[r.id] || null;
function rateOf(a) {
  if (!a || !a.expected) return null;
  return Math.min(1, a.done / a.expected);
}
// A pulse word for a group of routines — descriptive, never a grade.
function pulse(routines) {
  const rates = routines.filter(isLive).map(r => rateOf(actOf(r))).filter(v => v != null);
  if (!rates.length) return { rate: null, word: 'No data', cls: 'p-none' };
  const rate = rates.reduce((a, b) => a + b, 0) / rates.length;
  return rate >= 0.6 ? { rate, word: 'Moving', cls: 'p-good' } : rate >= 0.3 ? { rate, word: 'Uneven', cls: 'p-mid' } : { rate, word: 'Quiet', cls: 'p-low' };
}
function lastDoneOf(routines) {
  return routines.map(r => actOf(r) && actOf(r).last).filter(Boolean).sort().pop() || null;
}
function actLine(r) {
  const a = actOf(r);
  if (!a) return `<span class="act muted">No TickTick history</span>`;
  const parts = [];
  if (a.overdueSince) parts.push(`<span class="act overdue">Overdue since ${fmtDay(a.overdueSince)}</span>`);
  parts.push(`<span class="act">Last ${esc(ago(a.last))}</span>`);
  if (a.expected) parts.push(`<span class="act">${a.done}/${a.expected} ${a.kind === 'habit' ? 'days' : 'times'}</span>`);
  return parts.join('');
}
// 30-day strip: one cell per day, filled when done, crossed when skipped.
function strip(r, days = ACT.windowDays || 30) {
  const a = actOf(r);
  if (!ACT.asOf) return '';
  const end = parseDay(ACT.asOf);
  const done = new Set(a ? a.days : []), skipped = new Set(a && a.skipped ? a.skipped : []);
  let cells = '';
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    const k = isoDay(d);
    cells += `<i class="${done.has(k) ? 'd' : skipped.has(k) ? 's' : ''}" title="${fmtDay(k, { weekday: 'short', month: 'short', day: 'numeric' })}${done.has(k) ? ' · done' : skipped.has(k) ? ' · skipped' : ''}"></i>`;
  }
  return `<span class="strip" aria-label="Last ${days} days">${cells}</span>`;
}
function meter(rate) {
  if (rate == null) return `<span class="meter none"><b style="width:0"></b></span>`;
  const cls = rate >= 0.6 ? 'good' : rate >= 0.3 ? 'mid' : 'low';
  return `<span class="meter ${cls}" title="${Math.round(rate * 100)}% of scheduled"><b style="width:${Math.round(rate * 100)}%"></b></span>`;
}

// ---------------------------------------------------------------------
// Schedule parsing — "Habit · Mon–Fri", "Task · Tue & Fri", "Every other Fri"…
// ---------------------------------------------------------------------
const DAY_TOKENS = { sun: 6, mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5 };
function scheduleOf(r) {
  const raw = shortFreq(r.frequency).split('·')[0].replace(/\(.*?\)/g, '').trim();
  const s = raw.toLowerCase();
  if (!s || /not in ticktick|covered by/.test(s)) return { cadence: 'none', days: [], label: raw };
  if (/^daily/.test(s)) return { cadence: 'daily', days: [0, 1, 2, 3, 4, 5, 6], label: 'Every day' };
  if (/every \d+ days/.test(s)) return { cadence: 'interval', days: [], label: raw };
  if (/year/.test(s)) return { cadence: 'yearly', days: [], label: raw };
  if (/month|1st|last|on the \d/.test(s)) return { cadence: 'monthly', days: [], label: raw };
  const biweekly = /every other|bi-?weekly/.test(s);
  const days = new Set();
  const range = s.match(/(sun|mon|tue|wed|thu|fri|sat)\w*\s*[–-]\s*(sun|mon|tue|wed|thu|fri|sat)/);
  if (range) {
    let i = DAY_TOKENS[range[1]]; const end = DAY_TOKENS[range[2]];
    for (let n = 0; n < 7; n++) { days.add(i); if (i === end) break; i = (i + 1) % 7; }
  } else {
    (s.match(/sun|mon|tue|wed|thu|fri|sat/g) || []).forEach(t => days.add(DAY_TOKENS[t]));
  }
  if (!days.size) return { cadence: 'other', days: [], label: raw };
  return { cadence: biweekly ? 'biweekly' : 'weekly', days: [...days].sort(), label: raw };
}

// ---------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------
function allReviewRows() {
  const rows = [];
  state.sheetGoalReviews.forEach(r => rows.push({ date: r.date, kind: 'goal', id: r.effortId, name: r.effort, value: r.momentum, notes: r.notes, source: 'Goals Sheet' }));
  state.sheetRoutineReviews.forEach(r => {
    const m = state.routines.find(x => x.focus === r.routine);
    rows.push({ date: r.date, kind: 'routine', id: m ? m.id : null, name: r.routine, value: r.serving, notes: r.notes, source: 'Routines Sheet' });
  });
  state.localReviews.forEach(r => rows.push({ ...r, source: 'Flow' }));
  return rows;
}
function latestBy(kind) {
  const map = {};
  allReviewRows().forEach(r => {
    if (r.kind !== kind || !r.id || !r.value) return;
    if (!map[r.id] || (r.date || '') >= (map[r.id].date || '')) map[r.id] = r;
  });
  return map;
}
function stageFor(effortId, latestGoal = latestBy('goal')) {
  const rs = routinesForEffort(effortId);
  if (rs.some(r => linkFor(r).tier === 'drive')) {
    const last = latestGoal[effortId];
    return last && last.value === 'On Track' ? 'embedded' : 'rooted';
  }
  return rs.length ? 'supported' : 'seed';
}
function reviewSchedule() {
  const anchor = parseDay(REVIEW_ANCHOR_DATE);
  const t = parseDay(today());
  const due = new Date(anchor);
  while (due < t) due.setDate(due.getDate() + REVIEW_INTERVAL_DAYS);
  const dates = [...new Set(allReviewRows().map(r => r.date).filter(Boolean))].sort();
  const last = dates.pop() || null;
  return { due: isoDay(due), daysUntil: Math.round((due - t) / 86400000), last };
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
  const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }) });
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
  el.title = (failed === 0 ? 'Live from both Sheets' : failed === jobs.length ? 'Sheets unreachable — showing the saved snapshot' : 'Some Sheet reads failed')
    + (ACT.asOf ? ` · TickTick activity as of ${fmtDay(ACT.asOf)}` : '');
  render();
}

// ---------------------------------------------------------------------
// Shared markup
// ---------------------------------------------------------------------
const tierTag = t => `<span class="tag tier t-${t}" title="${esc(TIERS[t].desc)}"><i>${TIERS[t].glyph}</i>${TIERS[t].label}</span>`;
const stageTag = s => `<span class="tag stage s-${s}" title="${esc(STAGES[s].desc)}"><i>${STAGES[s].glyph}</i>${STAGES[s].label}</span>`;
const momentumTag = last => last ? `<span class="tag mo m-${slug(last.value)}" title="Last review ${esc(last.date)}">${esc(last.value)}</span>` : '';
const kindTag = r => { const k = kindOf(r); return `<span class="kind k-${k}">${k === 'habit' ? 'Habit' : k === 'note' ? 'Note' : 'Task'}</span>`; };
const pulseTag = p => `<span class="pulse ${p.cls}"><i></i>${p.word}${p.rate != null ? ` · ${Math.round(p.rate * 100)}%` : ''}</span>`;
function stageTrack(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return `<span class="track s-${stage}" title="${esc(STAGES[stage].label)} — ${esc(STAGES[stage].desc)}">${STAGE_ORDER.map((s, i) => `<b class="${i <= idx ? 'on' : ''}"></b>`).join('')}</span>`;
}
function dreamTags(effortId) {
  const ds = dreamsFor(effortId);
  if (!ds.length) return `<span class="tag dream foundation">✦ Foundation</span>`;
  return ds.map(id => `<span class="tag dream">✦ ${esc(dreamById(id).dream)}</span>`).join('');
}
function areaBadge(areaId) {
  const a = lifeArea(areaId);
  return `<a class="area-badge" href="#area/${a.id}" style="--ac: var(--l-${a.id})">${a.icon} ${a.label}</a>`;
}
function masthead({ tone, kicker, title, sub, aside = '', style = '' }) {
  return `<header class="masthead tone-${tone}" style="${style}">
    <div class="mh-inner">
      <div class="mh-text"><p class="kicker">${kicker}</p><h1>${title}</h1>${sub ? `<p class="mh-sub">${sub}</p>` : ''}</div>
      ${aside ? `<div class="mh-aside">${aside}</div>` : ''}
    </div>
  </header>`;
}
function stat(value, label, extra = '') {
  return `<div class="mh-stat"><b>${value}</b><span>${label}</span>${extra}</div>`;
}

// ---------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------
function route() {
  const h = location.hash.replace(/^#/, '') || 'overview';
  const [view, arg] = h.split('/');
  return { view: ['overview', 'goals', 'routines', 'area', 'review', 'sync'].includes(view) ? view : 'overview', arg };
}

function render() {
  const { view, arg } = route();
  const app = $('app');
  closeMega();
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  if (view === 'overview') app.innerHTML = viewOverview();
  if (view === 'goals') app.innerHTML = viewGoals();
  if (view === 'routines') app.innerHTML = viewRoutines();
  if (view === 'area') app.innerHTML = viewArea(lifeArea(arg) ? arg : LIFE_AREAS[0].id);
  if (view === 'review') app.innerHTML = viewReview();
  renderChrome();
  wire(view);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); });

function renderChrome() {
  const { due, daysUntil, last } = reviewSchedule();
  $('reviewChip').innerHTML = `<span>Last ${last ? fmtDay(last) : '—'}</span><b>Next ${daysUntil === 0 ? 'today' : fmtDay(due)}</b>`;
  $('reviewChip').classList.toggle('due', daysUntil <= 1);
  const tile = a => {
    const rs = state.routines.filter(r => isLive(r) && areaOfRoutine(r) === a.id);
    const gs = state.efforts.filter(e => areaOfEffort(e) === a.id);
    return `<a class="mega-item" href="#area/${a.id}" style="--ac: var(--l-${a.id})" role="menuitem">
      <span class="mega-icon">${a.icon}</span>
      <span class="mega-text"><b>${a.label}</b><small>${plural(gs.length, 'goal')} · ${plural(rs.length, 'routine')}</small></span>
    </a>`;
  };
  $('mega').innerHTML = `<p class="mega-head">Life areas — goals and routines side by side</p><div class="mega-grid">${LIFE_AREAS.map(tile).join('')}</div>`;
  $('areaSheet').innerHTML = `<div class="sheet-card"><p class="mega-head">Life areas</p><div class="mega-grid">${LIFE_AREAS.map(tile).join('')}</div></div>`;
}

// Areas menu: opens on hover (pointer) and on click/tap.
const areasMenu = $('areasMenu');
const megaBtn = areasMenu.querySelector('.nav-menu-btn');
function openMega() { areasMenu.classList.add('open'); megaBtn.setAttribute('aria-expanded', 'true'); }
function closeMega() { areasMenu.classList.remove('open'); megaBtn.setAttribute('aria-expanded', 'false'); $('areaSheet').hidden = true; }
let megaTimer;
areasMenu.addEventListener('mouseenter', () => { clearTimeout(megaTimer); openMega(); });
areasMenu.addEventListener('mouseleave', () => { megaTimer = setTimeout(closeMega, 160); });
megaBtn.addEventListener('click', () => areasMenu.classList.contains('open') ? closeMega() : openMega());
document.addEventListener('click', e => { if (!e.target.closest('#areasMenu, #tabAreas, #areaSheet')) closeMega(); });
$('tabAreas').addEventListener('click', () => { $('areaSheet').hidden = !$('areaSheet').hidden; });
$('areaSheet').addEventListener('click', e => { if (e.target === $('areaSheet')) closeMega(); });

// Theme
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
applyTheme(localGet(LS.theme, null));
$('themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next); localSet(LS.theme, next);
  if (route().view === 'overview') renderSankey();
});

// ---------------------------------------------------------------------
// OVERVIEW
// ---------------------------------------------------------------------
function viewOverview() {
  const live = state.routines.filter(isLive);
  const latestGoal = latestBy('goal');
  const rooted = state.efforts.filter(e => ['rooted', 'embedded'].includes(stageFor(e.id, latestGoal))).length;
  const overdue = live.filter(r => actOf(r) && actOf(r).overdueSince);
  const { due, daysUntil, last } = reviewSchedule();
  const all = pulse(live);

  return `
  ${masthead({
    tone: 'ink', kicker: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    title: 'I will build a world<br><em>I am proud of.</em>',
    aside: `<div class="mh-stats">
      ${stat(`${rooted}<small>/${state.efforts.length}</small>`, 'sub-goals have a routine driving them')}
      ${stat(`${all.rate != null ? Math.round(all.rate * 100) + '%' : '—'}`, `of scheduled routines done · last ${ACT.windowDays} days`)}
      ${stat(overdue.length, overdue.length === 1 ? 'task overdue' : 'tasks overdue')}
      ${stat(daysUntil === 0 ? 'Today' : `${daysUntil}d`, `to review · last ${last ? fmtDay(last) : 'none yet'}`)}
    </div>`,
  })}
  <div class="page">
    <section class="block">
      <div class="block-head"><div><p class="kicker">Broad goals</p><h2>Where your effort is going</h2></div>
        <a class="more" href="#goals">All goals →</a></div>
      <div class="bg-grid">${BROAD_GOALS.map(g => broadGoalCard(g, latestGoal)).join('')}</div>
    </section>

    <section class="block panel">
      <div class="block-head"><div><p class="kicker">The current</p><h2>Where every routine flows</h2></div>
        <p class="block-note">Life area → the role a routine plays → the broad goal it feeds → the dream it moves. Hover to trace; tap to pin.</p></div>
      <div class="sankey-scroll"><div class="sankey" id="sankey"></div></div>
      <div class="sankey-detail" id="sankeyDetail"></div>
    </section>

    <section class="block">
      <div class="block-head"><div><p class="kicker">Life areas</p><h2>Open an area</h2></div></div>
      <div class="area-grid">${LIFE_AREAS.map(areaTile).join('')}</div>
    </section>

    <section class="block panel">
      <div class="block-head"><div><p class="kicker">Next moves</p><h2>What the flow is asking for</h2></div></div>
      <div class="moves">${movesHTML(latestGoal)}</div>
    </section>
  </div>`;
}

function broadGoalCard(g, latestGoal) {
  const subs = state.efforts.filter(e => e.category === g.id);
  const carried = [...new Set(subs.flatMap(e => routinesForEffort(e.id)))];
  const p = pulse(carried);
  return `<a class="bg-card" href="#goals" data-goal-jump="${g.id}" style="--bc: var(--a-${g.id})">
    <div class="bg-top"><span class="bg-icon">${g.icon}</span><h3>${esc(g.label)}</h3></div>
    <div class="bg-subs">${subs.map(e => `<span class="bg-sub s-${stageFor(e.id, latestGoal)}" title="${esc(e.effort)} — ${STAGES[stageFor(e.id, latestGoal)].label}"></span>`).join('')}</div>
    <p class="bg-meta">${plural(subs.length, 'part')} · ${plural(carried.length, 'routine')}</p>
    <div class="bg-foot">${pulseTag(p)}${meter(p.rate)}</div>
  </a>`;
}

function areaTile(a) {
  const rs = state.routines.filter(r => isLive(r) && areaOfRoutine(r) === a.id);
  const gs = state.efforts.filter(e => areaOfEffort(e) === a.id);
  const p = pulse(rs);
  const overdue = rs.filter(r => actOf(r) && actOf(r).overdueSince).length;
  return `<a class="area-tile" href="#area/${a.id}" style="--ac: var(--l-${a.id})">
    <span class="at-icon">${a.icon}</span>
    <div class="at-body"><h3>${a.label}</h3><p>${esc(a.blurb)}</p>
      <div class="at-meta"><span>${plural(gs.length, 'goal')}</span><span>${plural(rs.length, 'routine')}</span>${overdue ? `<span class="warn">${overdue} overdue</span>` : ''}</div>
    </div>
    <div class="at-pulse">${pulseTag(p)}${meter(p.rate)}</div>
  </a>`;
}

function movesHTML(latestGoal) {
  const seeds = state.efforts.filter(e => stageFor(e.id, latestGoal) === 'seed');
  const orphans = state.routines.filter(r => isLive(r) && linkFor(r).tier === 'drive' && !linkFor(r).efforts.length);
  const unsorted = state.routines.filter(r => isActive(r) && linkFor(r).tier === 'unsorted');
  const overdue = state.routines.filter(r => isLive(r) && actOf(r) && actOf(r).overdueSince).sort((a, b) => actOf(a).overdueSince.localeCompare(actOf(b).overdueSince));
  const move = (tone, title, body, items) => items.length ? `
    <div class="move tone-${tone}"><div class="move-n">${items.length}</div>
      <div class="move-body"><h3>${title}</h3><p>${body}</p><div class="pills">${items.join('')}</div></div></div>` : '';
  const goalPill = e => `<button class="pill" data-goal="${esc(e.id)}"><i class="dot" style="background: var(--a-${e.category})"></i>${esc(e.effort)}</button>`;
  const routinePill = r => `<button class="pill" data-edit="${esc(r.id)}"><i class="dot" style="background: var(--l-${areaOfRoutine(r)})"></i>${esc(r.focus)}</button>`;
  const overduePill = r => `<button class="pill" data-edit="${esc(r.id)}"><i class="dot" style="background: var(--m-bad)"></i>${esc(r.focus)}<em>since ${fmtDay(actOf(r).overdueSince)}</em></button>`;
  return move('bad', 'Overdue in TickTick', 'Tasks can’t quietly slide the way habits can — these are waiting on you.', overdue.map(overduePill))
    + move('unsorted', 'Place these routines', 'New or unplaced. Does each one drive a goal, enable one, or is it upkeep?', unsorted.map(routinePill))
    + move('seed', 'Give these a habit', 'Parts of a goal that nothing in the week carries yet — or let them wait on purpose.', seeds.map(goalPill))
    + move('drive', 'Name the goal behind these habits', 'They clearly drive something; the Goals Sheet just doesn’t say what yet.', orphans.map(routinePill))
    || `<p class="empty">Nothing is asking for attention.</p>`;
}

// ---- The current (Sankey) ----
function sankeyModel() {
  const nodes = new Map();
  const node = (id, col, label, color, order, meta = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, col, label, color, order, in: 0, out: 0, rset: new Set(), ...meta });
    return nodes.get(id);
  };
  LIFE_AREAS.forEach((a, i) => node('l:' + a.id, 0, a.label, `var(--l-${a.id})`, i));
  TIER_ORDER.forEach((t, i) => node('t:' + t, 1, TIERS[t].label, `var(--t-${t})`, i));
  BROAD_GOALS.forEach((g, i) => node('g:' + g.id, 2, g.label.replace(' / Embodiment', ''), `var(--a-${g.id})`, i));
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
    nodes.get(a).out += w; nodes.get(b).in += w; nodes.get(a).rset.add(rid); nodes.get(b).rset.add(rid);
  };
  state.routines.filter(isLive).forEach(r => {
    const { tier, efforts } = linkFor(r);
    const l = 'l:' + areaOfRoutine(r), t = 't:' + tier;
    add(l, t, 1, r.id);
    if (tier === 'upkeep' && !efforts.length) return add(t, 'x:upkeep', 1, r.id);
    if (tier === 'unsorted') return add(t, 'x:unsorted', 1, r.id);
    if (!efforts.length) return add(t, 'x:nogoal', 1, r.id);
    const w = 1 / efforts.length;
    efforts.forEach(eid => {
      const g = 'g:' + effortById(eid).category;
      add(t, g, w, r.id);
      const ds = dreamsFor(eid);
      if (!ds.length) add(g, 'm:foundation', w, r.id); else ds.forEach(did => add(g, 'm:' + did, w / ds.length, r.id));
    });
  });
  return { nodes: [...nodes.values()].filter(n => n.in + n.out > 0), links: [...links.values()].filter(l => l.value > 0) };
}

function renderSankey() {
  const host = $('sankey');
  if (!host) return;
  const { nodes, links } = sankeyModel();
  const W = Math.max(host.clientWidth, 820), H = 500;
  const padL = 104, padR = 168, nodeW = 12, gap = 12, top = 34, bottom = 6;
  const colX = c => padL + (W - padL - padR - nodeW) * (c / 3);
  nodes.forEach(n => n.value = Math.max(n.in, n.out));
  const byCol = [0, 1, 2, 3].map(c => nodes.filter(n => n.col === c).sort((a, b) => a.order - b.order));
  const scale = Math.min(...byCol.map(col => (H - top - bottom - gap * (col.length - 1)) / col.reduce((s, n) => s + n.value, 0)));
  byCol.forEach(col => {
    const total = col.reduce((s, n) => s + n.value * scale, 0) + gap * (col.length - 1);
    let y = top + (H - top - bottom - total) / 2;
    col.forEach(n => { n.x = colX(n.col); n.y = y; n.h = Math.max(3, n.value * scale); y += n.h + gap; n.sy = n.y; n.ty = n.y; });
  });
  links.sort((a, b) => a.target.y - b.target.y).forEach(l => { l.sy = l.source.sy; l.source.sy += l.value * scale; });
  links.sort((a, b) => a.source.y - b.source.y).forEach(l => { l.ty = l.target.ty; l.target.ty += l.value * scale; });
  const ribbon = l => {
    const h = l.value * scale, x0 = l.source.x + nodeW, x1 = l.target.x, xm = (x0 + x1) / 2;
    return `M${x0},${l.sy} C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty} L${x1},${l.ty + h} C${xm},${l.ty + h} ${xm},${l.sy + h} ${x0},${l.sy + h} Z`;
  };
  const label = n => {
    const x = n.col === 0 ? n.x - 9 : n.x + nodeW + 8;
    return `<text class="sk-label${n.col === 1 || n.col === 2 ? ' halo' : ''}" x="${x}" y="${n.y + n.h / 2}" text-anchor="${n.col === 0 ? 'end' : 'start'}" dominant-baseline="middle">${esc(n.label)}<tspan class="sk-count" dx="6">${n.rset.size}</tspan></text>`;
  };
  const heads = ['Life area', 'Role', 'Broad goal', 'Dream'];
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Routines flowing from life area through role into broad goals and dreams">
    <g class="sk-heads">${heads.map((t, c) => `<text x="${c === 0 ? colX(0) + nodeW : c === 3 ? colX(3) : colX(c) + nodeW / 2}" y="14" text-anchor="${c === 0 ? 'end' : c === 3 ? 'start' : 'middle'}">${t}</text>`).join('')}</g>
    <g>${links.map((l, i) => `<path class="sk-link" data-i="${i}" d="${ribbon(l)}" style="--lc:${l.source.color}"/>`).join('')}</g>
    <g>${nodes.map((n, i) => `<rect class="sk-node${n.sink ? ' sink' : ''}" data-n="${i}" x="${n.x}" y="${n.y}" width="${nodeW}" height="${n.h}" rx="3" style="--nc:${n.color}"/>`).join('')}</g>
    <g>${nodes.map(label).join('')}</g>
  </svg>`;

  const svg = host.querySelector('svg');
  const paths = [...svg.querySelectorAll('.sk-link')], rects = [...svg.querySelectorAll('.sk-node')];
  const highlight = rset => {
    svg.classList.toggle('focus', !!rset);
    paths.forEach((p, i) => p.classList.toggle('on', !!rset && [...links[i].rset].some(id => rset.has(id))));
    rects.forEach((r, i) => r.classList.toggle('on', !!rset && [...nodes[i].rset].some(id => rset.has(id))));
  };
  const tip = $('tooltip');
  const moveTip = ev => { tip.style.left = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (ev.clientY + 14) + 'px'; };
  const showTip = (ev, html) => { tip.innerHTML = html; tip.hidden = false; moveTip(ev); };
  const hideTip = () => { tip.hidden = true; };
  const restore = () => { const p = state.sankeyPin && nodes.find(n => n.id === state.sankeyPin); highlight(p ? p.rset : null); };
  const pin = n => { state.sankeyPin = state.sankeyPin === n.id ? null : n.id; restore(); renderSankeyDetail(nodes); };
  rects.forEach((r, i) => {
    const n = nodes[i];
    r.addEventListener('mouseenter', ev => { highlight(n.rset); showTip(ev, `<b>${esc(n.label)}</b><span>${plural(n.rset.size, 'routine')}</span>`); });
    r.addEventListener('mousemove', moveTip);
    r.addEventListener('mouseleave', () => { hideTip(); restore(); });
    r.addEventListener('click', () => pin(n));
  });
  paths.forEach((p, i) => {
    const l = links[i];
    p.addEventListener('mouseenter', ev => { highlight(l.rset); showTip(ev, `<b>${esc(l.source.label)} → ${esc(l.target.label)}</b><span>${plural(l.rset.size, 'routine')}</span>`); });
    p.addEventListener('mousemove', moveTip);
    p.addEventListener('mouseleave', () => { hideTip(); restore(); });
  });
  svg.querySelectorAll('.sk-label').forEach((t, i) => {
    t.addEventListener('mouseenter', () => highlight(nodes[i].rset));
    t.addEventListener('mouseleave', restore);
    t.addEventListener('click', () => pin(nodes[i]));
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
// GOALS — broad goals first, their parts inside
// ---------------------------------------------------------------------
function viewGoals() {
  const latestGoal = latestBy('goal');
  const rooted = state.efforts.filter(e => ['rooted', 'embedded'].includes(stageFor(e.id, latestGoal))).length;
  return `
  ${masthead({
    tone: 'goals', kicker: 'Why',
    title: 'Goals',
    sub: 'Five broad goals, each holding the smaller parts that make it up. The broad goal is where your attention goes; the parts are how it gets done.',
    aside: `<div class="mh-stats">${stat(BROAD_GOALS.length, 'broad goals')}${stat(state.efforts.length, 'parts inside them')}${stat(`${rooted}<small>/${state.efforts.length}</small>`, 'parts with a routine driving them')}</div>`,
  })}
  <div class="page">
    <section class="block">
      <div class="block-head"><div><p class="kicker">Long-term</p><h2>The dreams</h2></div>
        <a class="more" href="${esc(GOALS_SHEET_URL)}" target="_blank" rel="noopener">Edit in the Sheet ↗</a></div>
      <div class="dreams">${state.dreams.map(dreamCard).join('')}</div>
    </section>
    ${BROAD_GOALS.map(g => broadGoalSection(g, latestGoal)).join('')}
  </div>`;
}

function dreamCard(d) {
  const goals = state.efforts.filter(e => dreamsFor(e.id).includes(d.id));
  const broad = [...new Set(goals.map(e => e.category))];
  return `<article class="dream">
    <span class="dream-icon">${esc(d.icon)}</span>
    <h3>${esc(d.dream)}</h3>
    <p class="dream-details">${esc(d.details)}</p>
    <p class="dream-how"><span>How</span>${esc(d.how)}</p>
    <div class="dream-feed">${goals.length ? `Fed by ${broad.map(id => esc(broadOf(id).label.replace(' / Embodiment', ''))).join(', ')}` : 'No goal points here yet'}</div>
  </article>`;
}

function broadGoalSection(g, latestGoal) {
  const subs = state.efforts.filter(e => e.category === g.id);
  if (!subs.length) return '';
  const carried = [...new Set(subs.flatMap(e => routinesForEffort(e.id)))];
  const p = pulse(carried);
  const last = lastDoneOf(carried);
  const areas = [...new Set(subs.map(areaOfEffort))];
  return `<section class="broad" id="goal-${g.id}" style="--bc: var(--a-${g.id})">
    <div class="broad-head">
      <div class="broad-title"><span class="broad-icon">${g.icon}</span><div><p class="kicker">Broad goal</p><h2>${esc(g.label)}</h2></div></div>
      <blockquote>${esc(g.headline)}</blockquote>
      <div class="broad-stats">
        <div>${pulseTag(p)}${meter(p.rate)}</div>
        <span>${plural(carried.length, 'routine')} carrying it</span>
        <span>Last activity ${esc(ago(last))}</span>
        <span class="broad-areas">${areas.map(areaBadge).join('')}</span>
      </div>
    </div>
    <div class="parts">${subs.map(e => partRow(e, latestGoal)).join('')}</div>
  </section>`;
}

function partRow(e, latestGoal) {
  const stage = stageFor(e.id, latestGoal);
  const rs = routinesForEffort(e.id);
  const p = pulse(rs);
  return `<button class="part" data-goal="${esc(e.id)}">
    <span class="part-main">
      <span class="part-title">${stageTrack(stage)}${esc(e.effort)}</span>
      <span class="part-sub">${esc(e.reason)}</span>
    </span>
    <span class="part-carried">${rs.length ? rs.slice(0, 4).map(r => `<span class="mini t-${linkFor(r).tier}">${TIERS[linkFor(r).tier].glyph} ${esc(r.focus)}</span>`).join('') + (rs.length > 4 ? `<span class="mini more">+${rs.length - 4}</span>` : '') : '<span class="mini none">No routine yet</span>'}</span>
    <span class="part-side">${momentumTag(latestGoal[e.id])}${stageTag(stage)}<span class="part-pulse">${meter(p.rate)}</span></span>
  </button>`;
}

// ---------------------------------------------------------------------
// ROUTINES — the week board, plus a browse mode
// ---------------------------------------------------------------------
function filteredRoutines() {
  const q = state.search.trim().toLowerCase();
  return state.routines.filter(r => isActive(r) && !isNote(r)
    && (state.kindFilter === 'all' || kindOf(r) === state.kindFilter)
    && (state.areaFilter === 'all' || areaOfRoutine(r) === state.areaFilter)
    && (!q || `${r.focus} ${r.why} ${r.what}`.toLowerCase().includes(q)));
}

function viewRoutines() {
  const live = state.routines.filter(isLive);
  const habits = live.filter(r => kindOf(r) === 'habit'), tasks = live.filter(r => kindOf(r) === 'task');
  const overdue = live.filter(r => actOf(r) && actOf(r).overdueSince);
  const ph = pulse(habits), pt = pulse(tasks);
  const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? 'active' : ''}">${l}</button>`).join('')}</div>`;
  return `
  ${masthead({
    tone: 'routines', kicker: 'How',
    title: 'Routines',
    sub: 'What your week actually holds. <b>Habits</b> can skip a day and be fine; <b>tasks</b> can’t quietly slide — overdue ones are flagged.',
    aside: `<div class="mh-stats">${stat(habits.length, `habits · ${ph.rate != null ? Math.round(ph.rate * 100) + '% kept' : 'no data'}`)}${stat(tasks.length, `tasks · ${pt.rate != null ? Math.round(pt.rate * 100) + '% done' : 'no data'}`)}${stat(overdue.length, 'overdue')}</div>`,
  })}
  <div class="page">
    <div class="toolbar">
      ${seg('rmode', state.routineMode, [['week', 'Week board'], ['browse', 'Browse by area']])}
      ${seg('kindSeg', state.kindFilter, [['all', 'All'], ['habit', 'Habits'], ['task', 'Tasks']])}
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><input type="search" id="routineSearch" placeholder="Search routines" value="${esc(state.search)}"></label>
    </div>
    <div class="filters" id="areaFilters">
      <button class="filter${state.areaFilter === 'all' ? ' on' : ''}" data-area="all">All areas</button>
      ${LIFE_AREAS.map(a => `<button class="filter${state.areaFilter === a.id ? ' on' : ''}" data-area="${a.id}" style="--ac: var(--l-${a.id})"><i class="dot"></i>${a.label}</button>`).join('')}
    </div>
    <div id="routineBody">${state.routineMode === 'week' ? weekBoard() : browseBoard()}</div>
    <div class="foot-actions">
      <button class="btn ghost" id="exportLinks">Copy my role edits</button>
      <button class="btn ghost" id="resetLinks">Reset to starting map</button>
      <span class="status" id="exportStatus"></span>
    </div>
  </div>`;
}

// This week's Monday..Sunday as ISO dates.
function thisWeek() {
  const t = parseDay(today());
  const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return WEEK.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return isoDay(d); });
}
function dayState(r, iso) {
  const a = actOf(r);
  if (iso > today()) return 'future';
  if (a && a.days.includes(iso)) return 'done';
  if (a && a.skipped && a.skipped.includes(iso)) return 'skip';
  if (ACT.asOf && iso > ACT.asOf) return 'unknown';
  return kindOf(r) === 'task' ? 'missed-task' : 'missed';
}

function chip(r, iso) {
  const l = linkFor(r);
  const a = actOf(r);
  const st = iso ? dayState(r, iso) : '';
  const overdue = a && a.overdueSince;
  return `<button class="chip k-${kindOf(r)} st-${st}${overdue ? ' is-overdue' : ''}" data-edit="${esc(r.id)}" style="--ac: var(--l-${areaOfRoutine(r)})" title="${esc(r.focus)} — ${esc(r.frequency)}">
    <span class="chip-state" aria-hidden="true"></span>
    <span class="chip-name">${esc(r.focus)}</span>
    <span class="chip-glyph t-${l.tier}" title="${TIERS[l.tier].label}">${TIERS[l.tier].glyph}</span>
  </button>`;
}

function weekBoard() {
  const items = filteredRoutines();
  const week = thisWeek(), t = today();
  const sched = new Map(items.map(r => [r.id, scheduleOf(r)]));
  // Anything on 5+ days a week reads better as a row of days than repeated in every column.
  const frequent = r => sched.get(r.id).cadence === 'daily' || (sched.get(r.id).cadence === 'weekly' && sched.get(r.id).days.length >= 5);
  const daily = items.filter(frequent).sort((a, b) => sched.get(b.id).days.length - sched.get(a.id).days.length);
  const weekly = items.filter(r => !frequent(r) && ['weekly', 'biweekly'].includes(sched.get(r.id).cadence));
  const other = items.filter(r => !['daily', 'weekly', 'biweekly'].includes(sched.get(r.id).cadence));

  const dailyRows = daily.map(r => {
    const a = actOf(r);
    return `<div class="daily-row" style="--ac: var(--l-${areaOfRoutine(r)})">
      <button class="daily-name" data-edit="${esc(r.id)}"><i class="dot"></i>${esc(r.focus)} ${kindTag(r)}</button>
      <span class="daily-week">${week.map((d, i) => sched.get(r.id).days.includes(i)
        ? `<i class="ds st-${dayState(r, d)}${d === t ? ' today' : ''}" title="${WEEK[i]} ${fmtDay(d)}">${WEEK[i][0]}</i>`
        : `<i class="ds off" title="${WEEK[i]} — not scheduled">${WEEK[i][0]}</i>`).join('')}</span>
      <span class="daily-rate">${a && a.expected ? `${a.done}/${a.expected}` : '—'}</span>
    </div>`;
  }).join('');

  const cols = week.map((d, i) => {
    const rs = weekly.filter(r => sched.get(r.id).days.includes(i));
    return `<div class="day-col${d === t ? ' today' : ''}${d < t ? ' past' : ''}">
      <div class="day-head"><b>${WEEK[i]}</b><span>${fmtDay(d, { day: 'numeric' })}</span>${d === t ? '<em>Today</em>' : ''}</div>
      <div class="day-body">${rs.map(r => chip(r, d)).join('') || '<span class="day-empty">—</span>'}</div>
    </div>`;
  }).join('');

  const groups = [['biweeklyNote', ''], ['interval', 'Every few days'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['other', 'Other']];
  const lessOften = groups.map(([k, label]) => {
    const rs = other.filter(r => sched.get(r.id).cadence === k);
    return rs.length ? `<div class="lo-group"><span class="lo-k">${label}</span>${rs.map(r => {
      const a = actOf(r);
      return `<button class="lo-item" data-edit="${esc(r.id)}" style="--ac: var(--l-${areaOfRoutine(r)})"><i class="dot"></i><span>${esc(r.focus)}</span><small>${esc(sched.get(r.id).label)}</small>${a && a.overdueSince ? `<em class="overdue">overdue</em>` : a && a.nextDue ? `<em>next ${fmtDay(a.nextDue)}</em>` : a && a.last ? `<em>last ${esc(ago(a.last))}</em>` : ''}</button>`;
    }).join('')}</div>` : '';
  }).join('');

  return `
    <div class="legend-row">
      <span><i class="lg st-done"></i>Done</span><span><i class="lg st-skip"></i>Skipped</span>
      <span><i class="lg st-missed"></i>Habit not logged</span><span><i class="lg st-missed-task"></i>Task not done</span>
      <span><i class="lg st-future"></i>Coming up</span>
      ${ACT.asOf ? `<span class="muted">TickTick as of ${fmtDay(ACT.asOf)}</span>` : ''}
    </div>
    ${daily.length ? `<section class="board-block"><div class="board-head"><h3>Every day &amp; most days</h3><span>${plural(daily.length, 'routine')} · this week, Mon–Sun</span></div><div class="daily">${dailyRows}</div></section>` : ''}
    <section class="board-block"><div class="board-head"><h3>This week</h3><span>${plural(weekly.length, 'routine')} on set days</span></div>
      <div class="week-scroll"><div class="week">${cols}</div></div></section>
    ${lessOften ? `<section class="board-block"><div class="board-head"><h3>Less often</h3></div><div class="less-often">${lessOften}</div></section>` : ''}`;
}

function browseBoard() {
  const items = filteredRoutines();
  const areas = LIFE_AREAS.filter(a => items.some(r => areaOfRoutine(r) === a.id));
  if (!areas.length) return '<p class="empty">Nothing matches.</p>';
  return `<div class="browse">${areas.map(a => {
    const rs = items.filter(r => areaOfRoutine(r) === a.id);
    const sheetCats = [...new Set(rs.map(r => domainOf(r.category).label))];
    return `<section class="browse-col" style="--ac: var(--l-${a.id})">
      <header><span class="bc-icon">${a.icon}</span><div><h3>${a.label}</h3><small>From ${sheetCats.join(' · ')}</small></div><span class="bc-n">${rs.length}</span></header>
      ${TIER_ORDER.map(t => {
        const g = rs.filter(r => linkFor(r).tier === t);
        return g.length ? `<div class="bc-group"><span class="bc-k t-${t}">${TIERS[t].glyph} ${TIERS[t].label}</span>${g.map(r => `
          <button class="bc-item" data-edit="${esc(r.id)}">
            <span class="bc-name">${esc(r.focus)}</span>
            <span class="bc-meta">${kindTag(r)}<span>${esc(shortFreq(r.frequency))}</span>${actOf(r) && actOf(r).overdueSince ? '<em class="overdue">overdue</em>' : ''}</span>
            ${meter(rateOf(actOf(r)))}
          </button>`).join('')}</div>` : '';
      }).join('')}
    </section>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------
// AREA — split page: goals on the left, their routines on the right
// ---------------------------------------------------------------------
function viewArea(areaId) {
  const a = lifeArea(areaId);
  const latestGoal = latestBy('goal');
  const goals = state.efforts.filter(e => areaOfEffort(e) === a.id);
  const areaRoutines = state.routines.filter(r => isLive(r) && areaOfRoutine(r) === a.id);
  const linkedHere = new Set(goals.flatMap(e => routinesForEffort(e.id).map(r => r.id)));
  // Routines that live in this area but aren't carrying one of this area's goals.
  const rest = areaRoutines.filter(r => !linkedHere.has(r.id));
  const p = pulse(areaRoutines);
  const overdue = areaRoutines.filter(r => actOf(r) && actOf(r).overdueSince);
  const idx = LIFE_AREAS.indexOf(a);
  const prev = LIFE_AREAS[(idx + LIFE_AREAS.length - 1) % LIFE_AREAS.length], next = LIFE_AREAS[(idx + 1) % LIFE_AREAS.length];

  const rows = goals.map(e => {
    const stage = stageFor(e.id, latestGoal);
    const rs = routinesForEffort(e.id).sort((x, y) => (linkFor(x).tier === 'drive' ? 0 : 1) - (linkFor(y).tier === 'drive' ? 0 : 1));
    const gp = pulse(rs);
    const broad = broadOf(e.category);
    return `<div class="split-row">
      <button class="split-goal s-${stage}" data-goal="${esc(e.id)}" style="--bc: var(--a-${e.category})">
        <span class="sg-broad">${broad.icon} Part of ${esc(broad.label)}</span>
        <span class="sg-title">${stageTrack(stage)}${esc(e.effort)}</span>
        <span class="sg-why">${esc(e.reason)}</span>
        <span class="sg-foot">${stageTag(stage)}${momentumTag(latestGoal[e.id])}${pulseTag(gp)}</span>
      </button>
      <div class="split-routines">${rs.length ? rs.map(routineLine).join('') : `<div class="split-empty">Nothing carries this yet. Open a routine and point it here — or let it wait on purpose.</div>`}</div>
    </div>`;
  }).join('');

  return `
  ${masthead({
    tone: 'area', style: `--ac: var(--l-${a.id})`,
    kicker: `<a href="#area/${prev.id}" class="mh-nav">← ${prev.label}</a><span>Life area</span><a href="#area/${next.id}" class="mh-nav">${next.label} →</a>`,
    title: `<span class="mh-icon">${a.icon}</span>${a.label}`,
    sub: esc(a.blurb),
    aside: `<div class="mh-stats">${stat(goals.length, goals.length === 1 ? 'goal part' : 'goal parts')}${stat(areaRoutines.length, 'routines live here')}${stat(p.rate != null ? Math.round(p.rate * 100) + '%' : '—', `done · last ${ACT.windowDays} days`)}${stat(overdue.length, 'overdue')}</div>`,
  })}
  <div class="page">
    <div class="split-labels"><span>Goals</span><span>Routines carrying them</span></div>
    <div class="split">${rows || `<div class="split-row"><div class="split-goal none"><span class="sg-title">No goal parts live in ${a.label}</span><span class="sg-why">Everything here is maintenance — it keeps life running without needing a goal.</span></div><div></div></div>`}</div>

    ${rest.length ? `<section class="block">
      <div class="block-head"><div><p class="kicker">Also in ${a.label}</p><h2>Everything else that lives here</h2></div>
        <p class="block-note">These live in ${a.label} but aren’t carrying one of its goals above — pure upkeep, or routines that feed a goal elsewhere.</p></div>
      <div class="rest">${TIER_ORDER.map(t => {
        const g = rest.filter(r => linkFor(r).tier === t);
        return g.length ? `<div class="rest-group"><span class="bc-k t-${t}">${TIERS[t].glyph} ${TIERS[t].label}</span>${g.map(routineLine).join('')}</div>` : '';
      }).join('')}</div>
    </section>` : ''}
  </div>`;
}

function routineLine(r) {
  const l = linkFor(r);
  const home = areaOfRoutine(r);
  const feedsElsewhere = l.efforts.map(effortById).filter(e => e && areaOfEffort(e) !== home);
  return `<button class="rline t-${l.tier}" data-edit="${esc(r.id)}" style="--ac: var(--l-${home})">
    <span class="rl-top"><span class="rl-glyph">${TIERS[l.tier].glyph}</span><span class="rl-name">${esc(r.focus)}</span>${kindTag(r)}</span>
    <span class="rl-meta"><span class="src">${esc(domainOf(r.category).label)} · ${esc(shortFreq(r.frequency))}</span>${feedsElsewhere.length ? `<span class="feeds">feeds ${feedsElsewhere.map(e => esc(e.effort)).join(', ')}</span>` : ''}</span>
    <span class="rl-act">${strip(r)}<span class="rl-acts">${actLine(r)}</span></span>
  </button>`;
}

// ---------------------------------------------------------------------
// REVIEW
// ---------------------------------------------------------------------
function answer(key) { return state.answers[key] = state.answers[key] || { value: '', notes: '' }; }

function reviewSections() {
  const sections = BROAD_GOALS.map(g => ({ g, efforts: state.efforts.filter(e => e.category === g.id) })).filter(s => s.efforts.length);
  const placed = new Set();
  sections.forEach(s => s.efforts.forEach(e => routinesForEffort(e.id).forEach(r => { if (linkFor(r).tier === 'drive') placed.add(r.id); })));
  const orphans = state.routines.filter(r => isLive(r) && linkFor(r).tier === 'drive' && !placed.has(r.id));
  const maintenance = state.routines.filter(r => isLive(r) && ['enable', 'upkeep', 'unsorted'].includes(linkFor(r).tier));
  return { sections, orphans, maintenance };
}
function reviewKeys() {
  const { sections, orphans, maintenance } = reviewSections();
  const keys = [];
  sections.forEach(s => s.efforts.forEach(e => { keys.push('e:' + e.id); routinesForEffort(e.id).filter(r => linkFor(r).tier === 'drive').forEach(r => keys.push('r:' + r.id)); }));
  orphans.forEach(r => keys.push('r:' + r.id));
  maintenance.forEach(r => keys.push('r:' + r.id));
  return [...new Set(keys)];
}
function rating(key, values) {
  const a = answer(key);
  return `<div class="rating" data-key="${esc(key)}">${values.map(v => `<button type="button" data-val="${v}" class="${a.value === v ? 'sel r-' + slug(v) : ''}">${v}</button>`).join('')}</div>`;
}
function routineReviewRow(r, latestR) {
  const key = 'r:' + r.id, last = latestR[r.id];
  return `<div class="rv-r" style="--ac: var(--l-${areaOfRoutine(r)})">
    <div class="rv-line"><span class="rv-name"><i class="dot"></i>${esc(r.focus)}${kindTag(r)}</span>${rating(key, SERVING)}</div>
    <div class="rv-evidence">${strip(r)}<span>${actLine(r)}</span>${last ? `<span class="act">Last review: ${esc(last.value)}</span>` : ''}</div>
    <input class="rv-note" data-key="${esc(key)}" placeholder="Note (optional)" value="${esc(answer(key).notes)}">
  </div>`;
}

function viewReview() {
  const { due, daysUntil, last } = reviewSchedule();
  const latestG = latestBy('goal'), latestR = latestBy('routine');
  const { sections, orphans, maintenance } = reviewSections();
  const acc = (id, glyph, color, label, sub, body) => `
    <section class="acc${state.openAcc.has(id) ? ' open' : ''}" data-acc="${id}" style="--bc: ${color}">
      <button type="button" class="acc-head"><span class="acc-glyph">${glyph}</span><span class="acc-title"><h2>${esc(label)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="acc-count"></span><span class="chev" aria-hidden="true"></span></button>
      <div class="acc-body">${body}</div>
    </section>`;

  let body = sections.map(({ g, efforts }) => acc('bg-' + g.id, g.icon, `var(--a-${g.id})`, g.label, g.headline, efforts.map(e => {
    const drivers = routinesForEffort(e.id).filter(r => linkFor(r).tier === 'drive');
    return `<div class="rv-goal">
      <div class="rv-line"><span class="rv-gname">${stageTrack(stageFor(e.id, latestG))}${esc(e.effort)}</span>${rating('e:' + e.id, MOMENTUM)}</div>
      <p class="rv-why">${esc(e.reason)}${latestG[e.id] ? ` · <b>Last review: ${esc(latestG[e.id].value)}</b>` : ''}</p>
      <input class="rv-note" data-key="e:${esc(e.id)}" placeholder="What's in the way, or working well?" value="${esc(answer('e:' + e.id).notes)}">
      ${drivers.length ? `<div class="rv-kids"><span class="rv-k">Routines driving it — with their TickTick record</span>${drivers.map(r => routineReviewRow(r, latestR)).join('')}</div>` : `<p class="rv-seed">No routine drives this yet — does it need one?</p>`}
    </div>`;
  }).join(''))).join('');
  if (orphans.length) body += acc('orphans', '◆', 'var(--t-drive)', 'Habits With No Goal Named', 'Serving you? Is there a goal worth writing down for them?', orphans.map(r => routineReviewRow(r, latestR)).join(''));
  if (maintenance.length) body += acc('upkeep', '○', 'var(--t-upkeep)', 'Upkeep — Is It Holding?', 'Maintenance and enablers, by life area', LIFE_AREAS.map(a => {
    const rs = maintenance.filter(r => areaOfRoutine(r) === a.id);
    return rs.length ? `<div class="rv-dom"><span class="rv-k">${a.icon} ${a.label}</span>${rs.map(r => routineReviewRow(r, latestR)).join('')}</div>` : '';
  }).join(''));

  const sinceLast = last ? daysBetween(last, today()) : null;
  return `
  ${masthead({
    tone: 'review', kicker: 'Every two weeks',
    title: 'Bi-Weekly Review',
    sub: 'One pass, top to bottom: is each goal moving, are the routines under it serving it, and is the upkeep holding? TickTick’s record sits next to each routine so you’re not guessing.',
    aside: `<div class="mh-stats">
      ${stat(last ? fmtDay(last) : '—', last ? `last review · ${sinceLast === 0 ? 'today' : plural(sinceLast, 'day') + ' ago'}` : 'no review saved yet')}
      ${stat(daysUntil === 0 ? 'Today' : fmtDay(due), daysUntil === 0 ? 'review is due' : `next review · in ${plural(daysUntil, 'day')}`)}
      <div class="mh-stat ring-stat"><div class="progress-ring" id="reviewRing"></div><span>reviewed this pass</span></div>
    </div>`,
  })}
  <div class="pills review-sync-link"><a class="btn" href="#sync">TickTick sync ⇄</a><span class="muted">Compare Flow with TickTick, edit the intended version, export the plan for Life Hub to write back.</span></div>
  <div class="page">
    <div id="reviewForm">${body}</div>
    <div class="save-bar">
      <label class="check"><input type="checkbox" id="sendToSheets"><span>Also send to the Routines &amp; Goals Sheets</span></label>
      <button class="btn" id="saveReviewBtn">Save review</button>
      <span class="status" id="reviewStatus"></span>
    </div>
    <section class="block"><div class="block-head"><div><p class="kicker">History</p><h2>Past reviews</h2></div></div>
      <div id="reviewHistory">${reviewHistoryHTML()}</div></section>
  </div>`;
}

function ring(pct, big, small) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="${r}"/><circle class="ring-fg" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg><div class="ring-txt"><b>${big}</b><small>${small}</small></div>`;
}
function updateReviewProgress() {
  const keys = reviewKeys();
  const n = keys.filter(k => answer(k).value).length;
  if ($('reviewRing')) $('reviewRing').innerHTML = ring(keys.length ? n / keys.length : 0, n, `of ${keys.length}`);
  document.querySelectorAll('.acc').forEach(acc => {
    const ks = [...acc.querySelectorAll('.rating')].map(r => r.dataset.key);
    const done = ks.filter(k => answer(k).value).length;
    const el = acc.querySelector('.acc-count');
    el.textContent = `${done}/${ks.length}`;
    el.classList.toggle('done', done === ks.length && ks.length > 0);
  });
}
function reviewHistoryHTML() {
  const rows = allReviewRows().filter(r => r.date);
  if (!rows.length) return '<p class="empty">No reviews saved yet.</p>';
  const byDate = {};
  rows.forEach(r => (byDate[r.date] = byDate[r.date] || []).push(r));
  return Object.keys(byDate).sort().reverse().map(date => {
    const entries = byDate[date];
    const g = entries.filter(r => r.kind === 'goal').length, rt = entries.length - g;
    const good = entries.filter(r => ['On Track', 'Yes'].includes(r.value)).length;
    return `<details class="hist">
      <summary><span class="hist-date">${esc(fmtDay(date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span><span class="hist-sum">${plural(g, 'goal')} · ${plural(rt, 'routine')} · ${good} holding</span><span class="hist-src">${esc([...new Set(entries.map(r => r.source))].join(' + '))}</span></summary>
      <div class="hist-body">${entries.map(r => `<div class="hist-row"><span>${r.kind === 'goal' ? '●' : '◆'} ${esc(r.name)}</span><span class="tag mo m-${slug(r.value)}">${esc(r.value || '—')}</span>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}</div>`).join('')}</div>
    </details>`;
  }).join('');
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
      const goalRows = rows.filter(r => r.kind === 'goal').map(r => ({ date, category: broadOf(r.area).label, categoryId: r.area, effortId: r.id, effort: r.name, momentum: r.value, notes: r.notes }));
      const routineRows = rows.filter(r => r.kind === 'routine').map(r => ({ date, category: domainOf(r.domain).label, routine: r.name, serving: r.value, notes: r.notes, why: r.why }));
      if (goalRows.length) await apiPost(GOALS_API, 'addReviewBatch', { rows: goalRows });
      if (routineRows.length) await apiPost(ROUTINES_API, 'addReviewBatch', { rows: routineRows });
      sent = true;
    } catch { failed = true; }
  }
  if (sent) {
    await Promise.allSettled([
      apiGet(GOALS_API, 'reviews').then(v => { if (Array.isArray(v)) state.sheetGoalReviews = v; }),
      apiGet(ROUTINES_API, 'reviews').then(v => { if (Array.isArray(v)) state.sheetRoutineReviews = v; }),
    ]);
  } else {
    state.localReviews = state.localReviews.concat(rows);
    localSet(LS.reviews, state.localReviews);
  }
  state.answers = {}; state.openAcc = new Set();
  render();
  $('reviewStatus').textContent = failed ? 'Could not reach the Sheets — saved in this browser instead.' : `Saved ${plural(rows.length, 'review')}${sent ? ' to both Sheets' : ''}.`;
  setTimeout(() => { if ($('reviewStatus')) $('reviewStatus').textContent = ''; }, 5000);
}

// ---------------------------------------------------------------------
// Drawer — routine detail + role editor, goal detail + dream editor
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeMega(); } });

function openRoutineDrawer(id) {
  const r = routineById(id);
  if (!r) return;
  const l = linkFor(r), a = actOf(r);
  const sel = { tier: l.tier, efforts: new Set(l.efforts) };
  const last = latestBy('routine')[r.id];
  openDrawer(`
    <div class="dr-head" style="--ac: var(--l-${areaOfRoutine(r)})">
      <p class="kicker">${areaBadge(areaOfRoutine(r))}<span>${esc(domainOf(r.category).label)} in the Sheet</span>${kindTag(r)}</p>
      <h2>${esc(r.focus)}</h2>
      <p class="dr-why">${esc(r.why)}</p>
      <dl class="dr-facts">
        <div><dt>When</dt><dd>${esc(r.frequency)}</dd></div>
        ${r.what ? `<div><dt>What</dt><dd>${esc(r.what)}</dd></div>` : ''}
        ${r.object ? `<div><dt>Needs</dt><dd>${esc(r.object)}</dd></div>` : ''}
        ${last ? `<div><dt>Last review</dt><dd>${esc(last.value)} · ${esc(last.date)}</dd></div>` : ''}
      </dl>
    </div>
    <div class="dr-section">
      <h3>TickTick · last ${ACT.windowDays} days</h3>
      ${a ? `<div class="dr-activity">${strip(r)}<div class="dr-act-stats">
          <div><b>${a.expected ? Math.round(rateOf(a) * 100) + '%' : '—'}</b><span>${a.expected ? `${a.done} of ${a.expected} ${a.kind === 'habit' ? 'scheduled days' : 'expected'}` : 'no schedule to compare'}</span></div>
          <div><b>${esc(ago(a.last))}</b><span>last done${a.last ? ` · ${fmtDay(a.last)}` : ''}</span></div>
          ${a.overdueSince ? `<div class="overdue"><b>Overdue</b><span>since ${fmtDay(a.overdueSince)}</span></div>` : a.nextDue ? `<div><b>${fmtDay(a.nextDue)}</b><span>next due</span></div>` : a.skipped ? `<div><b>${a.skipped.length}</b><span>marked skipped</span></div>` : ''}
        </div></div>` : `<p class="dr-note">No TickTick history matched this routine by name.</p>`}
    </div>
    <div class="dr-section">
      <h3>Role</h3>
      <div class="role-pick">${TIER_ORDER.map(t => `<button type="button" class="role t-${t}" data-tier="${t}"><i>${TIERS[t].glyph}</i><b>${TIERS[t].label}</b><span>${TIERS[t].desc}</span></button>`).join('')}</div>
    </div>
    <div class="dr-section" id="drGoals">
      <h3>Flows into</h3>
      ${BROAD_GOALS.map(g => {
        const es = state.efforts.filter(e => e.category === g.id);
        return es.length ? `<div class="pick-group" style="--bc: var(--a-${g.id})"><span class="pick-k">${esc(g.label)}</span><div class="pick-opts">${es.map(e => `<label class="pick"><input type="checkbox" value="${esc(e.id)}"${sel.efforts.has(e.id) ? ' checked' : ''}><span>${esc(e.effort)}</span></label>`).join('')}</div></div>` : '';
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
      closeDrawer(); render();
    };
    sync();
  });
}

function openGoalDrawer(effortId) {
  const e = effortById(effortId);
  if (!e) return;
  const latestGoal = latestBy('goal');
  const stage = stageFor(e.id, latestGoal), last = latestGoal[e.id];
  const rs = routinesForEffort(e.id, { includeNotes: true });
  const sel = new Set(dreamsFor(e.id));
  const broad = broadOf(e.category);
  openDrawer(`
    <div class="dr-head" style="--ac: var(--a-${e.category})">
      <p class="kicker"><span>${broad.icon} Part of ${esc(broad.label)}</span>${areaBadge(areaOfEffort(e))}</p>
      <h2>${esc(e.effort)}</h2>
      <div class="dr-tags">${stageTrack(stage)}${stageTag(stage)}${momentumTag(last)}${pulseTag(pulse(rs))}</div>
      <p class="dr-why">${esc(e.reason)}</p>
      <dl class="dr-facts"><div><dt>How</dt><dd>${esc(e.how)}</dd></div>
      ${last && last.notes ? `<div><dt>Last note</dt><dd>${esc(last.notes)} <span class="muted">· ${esc(last.date)}</span></dd></div>` : ''}</dl>
    </div>
    <div class="dr-section">
      <h3>Carried by</h3>
      ${rs.length ? `<div class="dr-lines">${rs.map(routineLine).join('')}</div>`
        : `<p class="dr-note">Nothing yet — this part is a seed. Open a routine and point it here, or add one in TickTick first.</p>`}
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
      closeDrawer(); render();
    };
  });
}

// ---------------------------------------------------------------------
// Wiring per view
// ---------------------------------------------------------------------
function wireEdits(root) {
  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); openRoutineDrawer(b.dataset.edit); }));
  root.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); openGoalDrawer(b.dataset.goal); }));
}

function wire(view) {
  const app = $('app');
  wireEdits(app);
  if (view === 'overview') {
    renderSankey();
    app.querySelectorAll('[data-goal-jump]').forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      location.hash = 'goals';
      setTimeout(() => { const el = $('goal-' + a.dataset.goalJump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }));
  }
  if (view === 'routines') {
    const rerender = () => { $('routineBody').innerHTML = state.routineMode === 'week' ? weekBoard() : browseBoard(); wireEdits($('routineBody')); };
    app.querySelectorAll('#rmode button').forEach(b => b.addEventListener('click', () => {
      state.routineMode = b.dataset.v; localSet(LS.rmode, state.routineMode);
      app.querySelectorAll('#rmode button').forEach(x => x.classList.toggle('active', x === b)); rerender();
    }));
    app.querySelectorAll('#kindSeg button').forEach(b => b.addEventListener('click', () => {
      state.kindFilter = b.dataset.v; localSet(LS.kind, state.kindFilter);
      app.querySelectorAll('#kindSeg button').forEach(x => x.classList.toggle('active', x === b)); rerender();
    }));
    app.querySelectorAll('#areaFilters .filter').forEach(b => b.addEventListener('click', () => {
      state.areaFilter = b.dataset.area;
      app.querySelectorAll('#areaFilters .filter').forEach(x => x.classList.toggle('on', x === b)); rerender();
    }));
    $('routineSearch').addEventListener('input', e => { state.search = e.target.value; rerender(); });
    $('exportLinks').addEventListener('click', async () => {
      const payload = JSON.stringify({ routineLinks: state.linkEdits, effortDreams: state.dreamEdits }, null, 1);
      try { await navigator.clipboard.writeText(payload); $('exportStatus').textContent = 'Copied — paste it to Claude to bake into the starting map.'; }
      catch { $('exportStatus').textContent = 'Clipboard blocked — your edits are still saved in this browser.'; }
    });
    $('resetLinks').addEventListener('click', () => {
      if (!confirm('Clear your role and dream-link edits and go back to the starting map?')) return;
      state.linkEdits = {}; state.dreamEdits = {}; localSet(LS.links, {}); localSet(LS.dreams, {}); render();
    });
  }
  if (view === 'review') {
    const form = $('reviewForm');
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
    $('saveReviewBtn').addEventListener('click', saveReview);
    updateReviewProgress();
  }
}

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (route().view === 'overview') renderSankey(); }, 140); });

render();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (route().view === 'overview') renderSankey(); });
loadLive();
