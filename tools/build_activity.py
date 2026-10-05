"""Build js/activity.js — per-routine completion from TickTick.

    python3 tools/build_activity.py [--as-of 2026-09-30]

Inputs (tools/ticktick_raw/, refreshed by Claude through the TickTick connector):
  habits.json           habit repeat rules + done / skipped check-in stamps
  completed_tasks.json  completed task copies (title, dueDate, completedTime)
  open_tasks.json       open task copies and their due dates

Counting follows Life Hub's rules: a task counts on its due day (late logging
is normal), ticking through overdue copies within ~2 minutes counts once on
the latest copy's day, and a habit marked "not completed" is a skip — never done.
"""
import datetime as dt
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(HERE, 'ticktick_raw')
WINDOW = 30

# TickTick title → routine id, where the names don't line up on their own.
ALIASES = {
    'schedule marvel monthly trip to groomer': 'dog-clip-nails',
    'recovery options choose or skip': 'body-recovery-options',
    'cardio': 'body-cardio-training',
    'abdominal training': 'body-abdominal-training',
}

norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()
day = lambda stamp: dt.date(stamp // 10000, stamp // 100 % 100, stamp % 100)
iso = lambda d: d.isoformat()
WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']


def load_routines():
    src = open(os.path.join(ROOT, 'js', 'data.js')).read()
    return json.loads(re.search(r'const SNAPSHOT_ROUTINES = (\[.*?\]);\n', src, re.S).group(1))


def matcher(routines):
    by_name = {norm(r['focus']): r['id'] for r in routines}
    def match(title):
        n = norm(title)
        if n in ALIASES: return ALIASES[n]
        if n in by_name: return by_name[n]
        # "Wipe Down Phone, Laptop, and Glasses & Sunglasses" → "Wipe Down Phone, Laptop, and Glasses"
        hits = [rid for name, rid in by_name.items() if n.startswith(name + ' ')]
        return max(hits, key=len) if hits else None
    return match


def scheduled_days(rrule, start, lo, hi):
    """Days a habit was due between lo and hi (inclusive), from its TickTick RRULE."""
    parts = dict(p.split('=') for p in rrule.split(';')[1:])
    freq = rrule.split(';')[0]
    first = max(lo, day(start))
    out, d = [], first
    while d <= hi:
        if freq == 'DAILY':
            if (d - day(start)).days % int(parts.get('INTERVAL', 1)) == 0: out.append(d)
        elif WEEKDAYS[d.weekday()] in parts.get('BYDAY', '').split(','):
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def main():
    as_of = dt.date.fromisoformat(sys.argv[sys.argv.index('--as-of') + 1]) if '--as-of' in sys.argv else dt.date(2026, 9, 30)
    lo = as_of - dt.timedelta(days=WINDOW - 1)
    routines = load_routines()
    match = matcher(routines)
    out = {}

    def entry(rid, kind):
        return out.setdefault(rid, {'kind': kind, 'done': set(), 'skipped': set(), 'expected': 0})

    # ---- habits ----
    habits = json.load(open(os.path.join(RAW, 'habits.json')))
    unmatched = []
    for name, h in habits.items():
        if name.startswith('_'): continue
        rid = h.get('routine') or match(name)
        if not rid: unmatched.append(name); continue
        e = entry(rid, 'habit')
        e['done'] |= {day(s) for s in h['done']}
        e['skipped'] |= {day(s) for s in h['skip']}
        e['expected'] += len(scheduled_days(h['rrule'], h['start'], lo, as_of))

    # ---- completed tasks ----
    tasks = json.load(open(os.path.join(RAW, 'completed_tasks.json')))['tasks']
    by_routine = {}
    for t in tasks:
        rid = match(t['title'])
        if not rid: unmatched.append(t['title']); continue
        done_at = dt.datetime.strptime(t['completedTime'][:19], '%Y-%m-%dT%H:%M:%S')
        due = dt.date.fromisoformat((t.get('dueDate') or t['completedTime'])[:10])
        by_routine.setdefault(rid, []).append((done_at, due))
    for rid, ticks in by_routine.items():
        ticks.sort()
        kept = []
        for done_at, due in ticks:
            # Ticking through overdue copies within ~2 min is postponing: count once, on the latest copy's day.
            if kept and (done_at - kept[-1][0]).total_seconds() <= 120:
                kept[-1] = (done_at, max(due, kept[-1][1]))
            else:
                kept.append((done_at, due))
        e = entry(rid, 'task')
        e['done'] |= {due for _, due in kept}

    # ---- open tasks: next due / overdue ----
    for t in json.load(open(os.path.join(RAW, 'open_tasks.json')))['tasks']:
        rid = match(t['title'])
        if not rid: unmatched.append(t['title']); continue
        e = entry(rid, 'task')
        due = dt.date.fromisoformat(t['due'])
        if due < as_of: e['overdueSince'] = iso(due)
        else: e['nextDue'] = iso(due)

    # ---- expected count for tasks: from the routine's weekly frequency ----
    freq = {r['id']: float(r.get('freq') or 0) for r in routines}
    result = {}
    for rid, e in out.items():
        done = sorted(d for d in e['done'] if d <= as_of)
        recent = [d for d in done if d >= lo]
        expected = e['expected'] if e['kind'] == 'habit' else round(freq.get(rid, 0) * WINDOW / 7)
        rec = {
            'kind': e['kind'],
            'last': iso(done[-1]) if done else None,
            'done': len(recent),
            'expected': expected,
            'days': [iso(d) for d in recent],
        }
        skipped = sorted(d for d in e['skipped'] if lo <= d <= as_of)
        if skipped: rec['skipped'] = [iso(d) for d in skipped]
        for k in ('overdueSince', 'nextDue'):
            if k in e: rec[k] = e[k]
        result[rid] = rec

    path = os.path.join(ROOT, 'js', 'activity.js')
    with open(path, 'w') as f:
        f.write('// GENERATED by tools/build_activity.py from TickTick (habits, completed + open tasks).\n')
        f.write('// Refresh by asking Claude to re-pull TickTick and re-run the script.\n')
        f.write('const ACTIVITY = ' + json.dumps({'asOf': iso(as_of), 'windowDays': WINDOW, 'routines': result}, ensure_ascii=False, indent=0) + ';\n')
    print(f'{len(result)} routines with activity · window {iso(lo)}..{iso(as_of)}')
    if unmatched: print('unmatched:', sorted(set(unmatched)))


if __name__ == '__main__':
    main()
