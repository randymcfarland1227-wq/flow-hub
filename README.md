# Flow — Goals & Routines

One hub for goals and the routines that carry them. Every routine gets a role — **Drives** a goal, **Enables** one, or is **Upkeep** that keeps life running — and every goal gets a stage (Seed → Supported → Rooted → Embedded).

Static site, no build step. Reads routines, goals, dreams and reviews live from the Routines and Goals Sheets' Apps Scripts (falls back to `js/data.js`). Refresh the snapshot with `python3 tools/build_data.py`.

Installable: open the site in Chrome and use the install button in the address bar (manifest + service worker included).

TickTick completion (`js/activity.js`) is a snapshot: refresh with `python3 tools/build_activity.py` after re-pulling `tools/ticktick_raw/`.
