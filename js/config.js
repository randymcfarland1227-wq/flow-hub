// Flow reads live from the two existing hubs' Apps Scripts (read-only by default).
// Its own layer — tiers, goal links, and combined reviews — is kept in this browser.
const ROUTINES_API = 'https://script.google.com/macros/s/AKfycbzNe80Y8hAb_zRq7k2eiivtdIjLOeuBlojrOzdXGtSQux4bb6zebj85GrVsSk0Rbsxrhw/exec';
const GOALS_API = 'https://script.google.com/macros/s/AKfycbyaka5mBHSn6vsQZ31gKmr_0xT1ndoBEZsWur8fJ6MF4b2mXv2gbTaQRvrD3Y_jEpSk/exec';
const GOALS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Lh0bKm7BIantGkWX4eK-zFkfZt5sESbKua9PnVY8010/edit';

// Same bi-weekly cadence as the Routines and Goals hubs.
const REVIEW_ANCHOR_DATE = '2026-08-15';
const REVIEW_INTERVAL_DAYS = 14;
