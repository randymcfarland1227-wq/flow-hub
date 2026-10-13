// =====================================================================
// TickTick → per-routine activity. One parser, used two ways:
//   · live in the browser (Flow reads Life Hub's Worker feed on every open)
//   · by tools/build_activity.mjs to write the js/activity.js fallback
//
// Feed shapes are the Worker's: /api/ticktick/done → { tasks, habits,
// schedule, skipped }, /api/ticktick/open → { tasks }.
//
// Counting follows Life Hub's rules: a task counts on its due day (late
// logging is normal); ticking through overdue copies within ~2 minutes is
// postponing and counts once, on the latest copy's day; a habit marked
// "won't do" is a skip, never a completion.
// =====================================================================
(function (root) {
  const WINDOW_DAYS = 30;   // rates and the 30-day strip
  const LOOKBACK_DAYS = 90; // how far back "last done" looks

  // TickTick title → routine id, where the names don't line up on their own.
  const ALIASES = {
    'schedule marvel monthly trip to groomer': 'dog-clip-nails',
    'recovery options choose or skip': 'body-recovery-options',
    'cardio': 'body-cardio-training',
    'abdominal training': 'body-abdominal-training',
  };
  const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = s => new Date(s + 'T00:00:00');
  const stampDay = st => `${String(st).slice(0, 4)}-${String(st).slice(4, 6)}-${String(st).slice(6, 8)}`;
  const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return isoDay(d); };
  // A timestamp → the local calendar day it falls on.
  const localDay = ts => { const d = new Date(ts); return isNaN(d) ? null : isoDay(d); };

  function matcher(routines) {
    const byName = new Map(routines.map(r => [norm(r.focus), r.id]));
    return title => {
      const n = norm(title);
      if (!n) return null;
      if (ALIASES[n]) return ALIASES[n];
      if (/^healthy minds? sessions?\b/.test(n)) return 'mind-healthy-minds-session';
      if (byName.has(n)) return byName.get(n);
      // "Wipe Down Phone, Laptop, and Glasses & Sunglasses" → "Wipe Down Phone, Laptop, and Glasses"
      let best = null;
      for (const [name, id] of byName) if (n.startsWith(name + ' ') && (!best || name.length > best[0].length)) best = [name, id];
      return best ? best[1] : null;
    };
  }

  // Days a habit was due in [lo, hi] from its RRULE, start date and excluded dates.
  function scheduledDays(rule, start, exDates, lo, hi) {
    const parts = {};
    String(rule || '').replace(/^RRULE:/, '').split(';').forEach(p => { const [k, v] = p.split('='); if (k) parts[k] = v; });
    const startIso = start ? stampDay(start) : lo;
    const ex = new Set((exDates || []).map(stampDay));
    const interval = Number(parts.INTERVAL || 1);
    const byDay = (parts.BYDAY || '').split(',').filter(Boolean);
    const out = [];
    for (let d = startIso > lo ? startIso : lo; d <= hi; d = addDays(d, 1)) {
      if (ex.has(d)) continue;
      const wd = WEEKDAYS[parseDay(d).getDay()];
      if (parts.FREQ === 'DAILY') {
        const since = Math.round((parseDay(d) - parseDay(startIso)) / 86400000);
        if (since % interval === 0) out.push(d);
      } else if (parts.FREQ === 'WEEKLY' && byDay.includes(wd)) {
        out.push(d);
      }
    }
    return out;
  }

  /**
   * @param done   Worker /api/ticktick/done payload (any range; merged chunks are fine)
   * @param open   Worker /api/ticktick/open payload (may be null)
   * @param routines Flow routines ({ id, focus, freq })
   * @param asOf   'YYYY-MM-DD' — normally today
   */
  function buildActivity(done, open, routines, asOf) {
    const match = matcher(routines);
    const lo = addDays(asOf, -(WINDOW_DAYS - 1));
    const back = addDays(asOf, -(LOOKBACK_DAYS - 1));
    const acc = {};
    const entry = (id, kind) => acc[id] || (acc[id] = { kind, done: new Set(), skipped: new Set(), expected: 0 });
    const unmatched = new Set();

    // ---- habits: schedule → expected days; check-ins → done / skipped ----
    const habitRoutine = {};
    (done && done.schedule || []).forEach(h => {
      const rid = match(h.title);
      if (!rid) { unmatched.add(h.title); return; }
      habitRoutine[h.id] = rid;
      entry(rid, 'habit').expected += scheduledDays(h.repeatRule, h.targetStartDate, h.exDates, lo, asOf).length;
    });
    (done && done.habits || []).forEach(c => {
      const rid = habitRoutine[c.id] || match(c.title);
      if (rid) entry(rid, 'habit').done.add(stampDay(c.stamp));
    });
    (done && done.skipped || []).forEach(c => {
      const rid = habitRoutine[c.id];
      if (rid) entry(rid, 'habit').skipped.add(stampDay(c.stamp));
    });

    // ---- completed tasks: count on the due day, collapse quick tick-throughs ----
    const ticks = {};
    const seen = new Set();
    (done && done.tasks || []).forEach(t => {
      if (seen.has(t.id)) return;
      seen.add(t.id);
      const rid = match(t.title);
      if (!rid) { unmatched.add(t.title); return; }
      const day = localDay(t.dueAt || t.completedAt);
      if (!day || !t.completedAt) return;
      (ticks[rid] = ticks[rid] || []).push({ at: Date.parse(t.completedAt), day });
    });
    Object.entries(ticks).forEach(([rid, list]) => {
      list.sort((a, b) => a.at - b.at);
      const kept = [];
      list.forEach(t => {
        const last = kept[kept.length - 1];
        if (last && t.at - last.at <= 120000) { last.at = t.at; if (t.day > last.day) last.day = t.day; }
        else kept.push({ ...t });
      });
      const e = entry(rid, acc[rid] ? acc[rid].kind : 'task');
      kept.forEach(t => e.done.add(t.day));
    });

    // ---- open tasks: overdue since / next due ----
    const opens = {};
    (open && open.tasks || []).forEach(t => {
      const rid = match(t.title);
      const day = localDay(t.dueAt);
      if (rid && day) (opens[rid] = opens[rid] || []).push(day);
    });
    Object.entries(opens).forEach(([rid, days]) => {
      const e = entry(rid, acc[rid] ? acc[rid].kind : 'task');
      const past = days.filter(d => d < asOf).sort(), next = days.filter(d => d >= asOf).sort();
      if (past.length) e.overdueSince = past[0];
      if (next.length) e.nextDue = next[0];
    });

    const freq = Object.fromEntries(routines.map(r => [r.id, Number(r.freq) || 0]));
    const out = {};
    Object.entries(acc).forEach(([rid, e]) => {
      const all = [...e.done].filter(d => d <= asOf && d >= back).sort();
      const recent = all.filter(d => d >= lo);
      const rec = {
        kind: e.kind,
        last: all.length ? all[all.length - 1] : null,
        done: recent.length,
        expected: e.kind === 'habit' ? e.expected : Math.round((freq[rid] || 0) * WINDOW_DAYS / 7),
        days: recent,
      };
      const skipped = [...e.skipped].filter(d => d >= lo && d <= asOf).sort();
      if (skipped.length) rec.skipped = skipped;
      if (e.overdueSince) rec.overdueSince = e.overdueSince;
      if (e.nextDue) rec.nextDue = e.nextDue;
      out[rid] = rec;
    });
    return { asOf, windowDays: WINDOW_DAYS, lookbackDays: LOOKBACK_DAYS, routines: out, unmatched: [...unmatched].sort() };
  }

  const api = { buildActivity, matcher, scheduledDays, WINDOW_DAYS, LOOKBACK_DAYS, isoDay, addDays };
  root.FlowTickTick = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
