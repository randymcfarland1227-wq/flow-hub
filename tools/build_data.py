"""Regenerate js/data.js from the live Routines + Goals Apps Scripts.

    python3 tools/build_data.py

Only the snapshot (routines, efforts, dreams) is refreshed — the FLOW links
at the bottom of this file are the hand-written first pass and are kept.
"""
import json, os, urllib.request

ROUTINES_URL = 'https://script.google.com/macros/s/AKfycbzNe80Y8hAb_zRq7k2eiivtdIjLOeuBlojrOzdXGtSQux4bb6zebj85GrVsSk0Rbsxrhw/exec'
GOALS_URL = 'https://script.google.com/macros/s/AKfycbyaka5mBHSn6vsQZ31gKmr_0xT1ndoBEZsWur8fJ6MF4b2mXv2gbTaQRvrD3Y_jEpSk/exec'

def get(url, action):
    with urllib.request.urlopen(f'{url}?action={action}', timeout=60) as r:
        return json.load(r)

# ---------------------------------------------------------------------
# Routine → tier + goal links. Tiers:
#   drive  — the routine IS a goal in action
#   enable — upkeep that feeds a goal (keeps the conditions for it)
#   upkeep — keeps life running; no goal required
# Anything not listed lands as "unsorted" for Randy to place.
# ---------------------------------------------------------------------
SELF = ['physical-selfcare']
MUSIC = ['spiritual-guitar', 'spiritual-vocal', 'spiritual-production']
CLEAN = ['mental-cleanspaces']
FOOD = ['physical-nourish', 'physical-protein']
MARVEL = ['connection-training']
ROUTINE_LINKS = {
    # Mind
    'mind-healthy-minds-session': ('drive', ['mental-healthyminds']),
    'mind-journaling': ('drive', ['mental-journaling']),
    'mind-reading': ('drive', ['mental-reading']),
    'mind-daytime-rest': ('drive', ['physical-sleep']),
    'mind-rest-sleep-note': ('drive', ['physical-sleep']),
    'mind-personal-check-in': ('upkeep', []),
    'mind-clothes-audit': ('upkeep', []),
    'mind-open-job-search': ('drive', ['financial-savings']),
    # Body — no present-focus goal names training yet, so gym routines drive with no goal (flagged)
    'body-cardio-training': ('drive', []),
    'body-abdominal-training': ('drive', []),
    'body-full-gym-session': ('drive', []),
    'body-active-pt': ('drive', []),
    'body-movement-break': ('drive', []),
    'body-gym-standards-note': ('drive', []),
    'body-protein-intake': ('drive', ['physical-protein']),
    'body-nutrition-flow-note': ('drive', ['physical-protein', 'physical-nourish', 'physical-hydration']),
    'body-fruit-vegetable': ('drive', ['physical-nourish']),
    'body-water-intake': ('drive', ['physical-hydration']),
    'body-vitamins-supplements': ('drive', ['physical-vitamins']),
    'body-creatine-fiber': ('drive', ['physical-vitamins']),
    'body-moisturize-body': ('drive', SELF),
    'body-feet-care': ('drive', SELF),
    'body-weekly-bath': ('drive', SELF),
    'body-washing-face-complexion': ('drive', SELF),
    'body-nail-cuticle-care': ('drive', SELF),
    'body-face-shaving': ('drive', SELF),
    'body-body-shaving': ('drive', SELF),
    'body-recovery-options': ('drive', SELF),
    'body-getting-haircut': ('enable', SELF),
    'body-put-out-gym-clothes': ('upkeep', []),
    'body-teeth-night': ('upkeep', []),
    # Soul
    'soul-main-session': ('drive', MUSIC),
    'soul-support-session': ('drive', MUSIC),
    'soul-maintenance-session': ('drive', MUSIC),
    'soul-monthly-review': ('drive', MUSIC),
    'soul-music-log-note': ('drive', MUSIC),
    'soul-vocal-training': ('drive', ['spiritual-vocal']),
    'soul-creative-tinkering': ('drive', []),
    'soul-creative-project-menu-note': ('drive', []),
    # Cleaning — the room itself feeds "Clean Spaces"; belongings are pure upkeep
    'cleaning-vacuum-room': ('enable', CLEAN),
    'cleaning-wipe-room-surfaces': ('enable', CLEAN),
    'cleaning-room-reset': ('enable', CLEAN),
    'cleaning-kitchen-usable': ('enable', CLEAN),
    'cleaning-bathroom-weekly': ('enable', CLEAN),
    'cleaning-wash-bedding': ('enable', CLEAN),
    'cleaning-clean-laundry': ('enable', CLEAN),
    'cleaning-vacuum-car': ('upkeep', []),
    'cleaning-clean-phone-laptop-glasses': ('upkeep', []),
    'cleaning-clean-tote-bag': ('upkeep', []),
    'cleaning-wash-tote-bag': ('upkeep', []),
    'cleaning-clean-headphones': ('upkeep', []),
    'cleaning-wash-towels': ('upkeep', []),
    # Organizing
    'organizing-organize-drawers': ('enable', CLEAN),
    'organizing-weekly-grocery-shop': ('enable', FOOD),
    'organizing-meal-prepping': ('enable', FOOD),
    'organizing-reset-medicine-holder': ('enable', ['physical-vitamins']),
    'organizing-personal-finance-allocation': ('drive', ['financial-credit', 'financial-savings']),
    'organizing-savings-allocations': ('drive', ['financial-savings']),
    'organizing-needed-purchases': ('drive', ['financial-material']),
    'organizing-next-step-awareness-review': ('enable', ['financial-credit', 'financial-savings']),
    'organizing-side-hustle-progress': ('drive', ['financial-savings']),
    'organizing-digital-declutter': ('upkeep', []),
    'organizing-water-plants': ('upkeep', []),
    'organizing-goal-effort-review': ('upkeep', []),
    'organizing-week-planner-prep': ('upkeep', []),
    'organizing-family-finance-review': ('upkeep', []),
    'organizing-instagram-review': ('upkeep', []),
    'organizing-life-path-note': ('upkeep', []),
    'organizing-job-search-map-note': ('upkeep', []),
    # Marvel — training/bonding is a Connection goal; grooming + supplies are upkeep
    'dog-play-sessions': ('drive', MARVEL),
    'dog-behavior-training': ('drive', MARVEL),
    'dog-walks': ('drive', MARVEL),
    'dog-command-training': ('drive', MARVEL),
    'dog-behavior-train-audit': ('drive', MARVEL),
    'dog-behavioral-audit': ('drive', MARVEL),
    'dog-marvel-care-note': ('drive', MARVEL),
    'dog-daily-brushing': ('upkeep', []),
    'dog-cuddling': ('upkeep', []),
    'dog-weekly-vacuum-marvel': ('upkeep', []),
    'dog-brush-teeth': ('upkeep', []),
    'dog-supply-inventory-count': ('upkeep', []),
    'dog-supply-organization': ('upkeep', []),
    'dog-clip-nails': ('upkeep', []),
}

# Goal (effort) → dream links. Efforts with none are "Foundation": they feed the whole vision.
EFFORT_DREAMS = {
    'financial-credit': ['travel', 'security'],
    'financial-savings': ['travel', 'business', 'security'],
    'financial-material': ['tangible', 'security'],
    'connection-experiences': ['travel'],
    'spiritual-guitar': ['creative'],
    'spiritual-vocal': ['creative'],
    'spiritual-production': ['creative', 'business'],
}

def main():
    routines = get(ROUTINES_URL, 'routines')
    efforts = get(GOALS_URL, 'efforts')
    dreams = get(GOALS_URL, 'dreams')
    unknown = [r['id'] for r in routines if r['id'] not in ROUTINE_LINKS]
    links = {rid: {'tier': t, 'efforts': e} for rid, (t, e) in ROUTINE_LINKS.items()}
    out = os.path.join(os.path.dirname(__file__), '..', 'js', 'data.js')
    with open(out, 'w') as f:
        f.write('// GENERATED by tools/build_data.py — snapshot of the live Routines + Goals Sheets,\n')
        f.write('// used when the Sheets can\'t be reached. The site re-reads both Sheets live on load.\n')
        f.write('// The FLOW links are the starting map; edits made on the site override them.\n\n')
        f.write('const SNAPSHOT_ROUTINES = ' + json.dumps(routines, ensure_ascii=False, indent=0) + ';\n\n')
        f.write('const SNAPSHOT_EFFORTS = ' + json.dumps(efforts, ensure_ascii=False, indent=0) + ';\n\n')
        f.write('const SNAPSHOT_DREAMS = ' + json.dumps(dreams, ensure_ascii=False, indent=0) + ';\n\n')
        f.write('const SEED_ROUTINE_LINKS = ' + json.dumps(links, ensure_ascii=False, indent=0) + ';\n\n')
        f.write('const SEED_EFFORT_DREAMS = ' + json.dumps(EFFORT_DREAMS, ensure_ascii=False, indent=0) + ';\n')
    print(f'{len(routines)} routines, {len(efforts)} efforts, {len(dreams)} dreams')
    print('unsorted (not in ROUTINE_LINKS):', unknown or 'none')

if __name__ == '__main__':
    main()
