#!/usr/bin/env node
/* ============================================================
   PM Scanner — GitHub Actions scan script (v2 — per-city date fix)
   Runs hourly via cron. For each city currently ~2hrs before its
   typical daily high, fetches the NWS/Open-Meteo forecast, checks
   the matching Polymarket bucket markets for arbs / +EV signals,
   and sends a Telegram alert for anything new.
   ============================================================ */

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT  = process.env.TG_CHAT_ID;
const BET_SIZE = parseFloat(process.env.BET_SIZE || '25');

if (!TG_TOKEN || !TG_CHAT) {
  console.error('Missing TG_BOT_TOKEN or TG_CHAT_ID environment variables.');
  process.exit(1);
}

const PM_GAMMA = 'https://gamma-api.polymarket.com';

const MONTHS_EN = ['january','february','march','april','may','june',
                    'july','august','september','october','november','december'];

/* ============================================================
   CITIES — name, slug, coords, station, country, and the local
   hour of the typical daily high (used to compute the trigger window)
   ============================================================ */
const CITIES = [
  /* United States — NWS gridpoints */
  {name:'New York',      slug:'nyc',          lat:40.7772,  lon:-73.8726,  country:'US', station:'KLGA', nwsGrid:'OKX/37,39',  utc:-4, highH:15},
  {name:'Chicago',       slug:'chicago',      lat:41.9742,  lon:-87.9073,  country:'US', station:'KORD', nwsGrid:'LOT/66,77',  utc:-5, highH:15},
  {name:'Miami',         slug:'miami',        lat:25.7587,  lon:-80.2870,  country:'US', station:'KMIA', nwsGrid:'MFL/106,51', utc:-4, highH:15},
  {name:'Dallas',        slug:'dallas',       lat:32.8471,  lon:-96.8518,  country:'US', station:'KDAL', nwsGrid:'FWD/97,115', utc:-5, highH:15},
  {name:'Seattle',       slug:'seattle',      lat:47.4502,  lon:-122.3088, country:'US', station:'KSEA', nwsGrid:'SEW/124,61', utc:-7, highH:16},
  {name:'Atlanta',       slug:'atlanta',      lat:33.6407,  lon:-84.4277,  country:'US', station:'KATL', nwsGrid:'FFC/50,82',  utc:-4, highH:15},
  {name:'Los Angeles',   slug:'los-angeles',  lat:33.9425,  lon:-118.4081, country:'US', station:'KLAX', nwsGrid:'LOX/150,41', utc:-7, highH:16},
  {name:'Houston',       slug:'houston',      lat:29.6454,  lon:-95.2789,  country:'US', station:'KHOU', nwsGrid:'HGX/66,93',  utc:-5, highH:15},
  {name:'Denver',        slug:'denver',       lat:39.7170,  lon:-104.7517, country:'US', station:'KBKF', nwsGrid:'BOU/62,55',  utc:-6, highH:15},
  {name:'San Francisco', slug:'san-francisco',lat:37.6213,  lon:-122.3790, country:'US', station:'KSFO', nwsGrid:'MTR/84,105', utc:-7, highH:16},
  {name:'Austin',        slug:'austin',       lat:30.1975,  lon:-97.6664,  country:'US', station:'KAUS', nwsGrid:'EWX/157,91', utc:-5, highH:15},
  /* Europe */
  {name:'London',        slug:'london',       lat:51.5033,  lon:0.0564,    country:'UK', station:'EGLC', utc:+1, highH:15},
  {name:'Paris',         slug:'paris',        lat:49.0244,  lon:2.3567,    country:'FR', station:'LFPB', utc:+2, highH:15},
  {name:'Amsterdam',     slug:'amsterdam',    lat:52.3086,  lon:4.7639,    country:'NL', station:'EHAM', utc:+2, highH:15},
  {name:'Madrid',        slug:'madrid',       lat:40.4936,  lon:-3.5668,   country:'ES', station:'LEMD', utc:+2, highH:16},
  {name:'Milan',         slug:'milan',        lat:45.6306,  lon:8.7231,    country:'IT', station:'LIMC', utc:+2, highH:15},
  {name:'Munich',        slug:'munich',       lat:48.3537,  lon:11.7750,   country:'DE', station:'EDDM', utc:+2, highH:15},
  {name:'Helsinki',      slug:'helsinki',     lat:60.3172,  lon:24.9633,   country:'FI', station:'EFHK', utc:+3, highH:15},
  {name:'Warsaw',        slug:'warsaw',       lat:52.1657,  lon:20.9671,   country:'PL', station:'EPWA', utc:+2, highH:15},
  {name:'Istanbul',      slug:'istanbul',     lat:41.2753,  lon:28.7519,   country:'TR', station:'LTFM', utc:+3, highH:15},
  {name:'Ankara',        slug:'ankara',       lat:40.1281,  lon:32.9951,   country:'TR', station:'LTAC', utc:+3, highH:15},
  {name:'Moscow',        slug:'moscow',       lat:55.5983,  lon:37.2615,   country:'RU', station:'UUWW', utc:+3, highH:15},
  /* Asia-Pacific */
  {name:'Tokyo',         slug:'tokyo',        lat:35.5533,  lon:139.7811,  country:'JP', station:'RJTT', utc:+9, highH:14},
  {name:'Hong Kong',     slug:'hong-kong',    lat:22.3020,  lon:114.1740,  country:'HK', station:'HKO',  utc:+8, highH:14},
  {name:'Seoul',         slug:'seoul',        lat:37.4602,  lon:126.4407,  country:'KR', station:'RKSI', utc:+9, highH:14},
  {name:'Busan',         slug:'busan',        lat:35.1796,  lon:128.9382,  country:'KR', station:'RKPK', utc:+9, highH:14},
  {name:'Singapore',     slug:'singapore',    lat:1.3644,   lon:103.9915,  country:'SG', station:'WSSS', utc:+8, highH:14},
  {name:'Shanghai',      slug:'shanghai',     lat:31.1443,  lon:121.8083,  country:'CN', station:'ZSPD', utc:+8, highH:14},
  {name:'Beijing',       slug:'beijing',      lat:40.0799,  lon:116.5838,  country:'CN', station:'ZBAA', utc:+8, highH:14},
  {name:'Guangzhou',     slug:'guangzhou',    lat:23.3924,  lon:113.2988,  country:'CN', station:'ZGGG', utc:+8, highH:14},
  {name:'Shenzhen',      slug:'shenzhen',     lat:22.6395,  lon:113.8145,  country:'CN', station:'ZGSZ', utc:+8, highH:14},
  {name:'Chengdu',       slug:'chengdu',      lat:30.5785,  lon:103.9471,  country:'CN', station:'ZUUU', utc:+8, highH:14},
  {name:'Chongqing',     slug:'chongqing',    lat:29.7192,  lon:106.6416,  country:'CN', station:'ZUCK', utc:+8, highH:14},
  {name:'Wuhan',         slug:'wuhan',        lat:30.7839,  lon:114.2081,  country:'CN', station:'ZHHH', utc:+8, highH:14},
  {name:'Qingdao',       slug:'qingdao',      lat:36.2661,  lon:120.3747,  country:'CN', station:'ZSQD', utc:+8, highH:14},
  {name:'Kuala Lumpur',  slug:'kuala-lumpur', lat:2.7456,   lon:101.7072,  country:'MY', station:'WMKK', utc:+8, highH:14},
  {name:'Manila',        slug:'manila',       lat:14.5086,  lon:121.0197,  country:'PH', station:'RPLL', utc:+8, highH:14},
  {name:'Taipei',        slug:'taipei',       lat:25.0697,  lon:121.5524,  country:'TW', station:'RCSS', utc:+8, highH:14},
  {name:'Lucknow',       slug:'lucknow',      lat:26.7606,  lon:80.8893,   country:'IN', station:'VILK', utc:+5.5, highH:14},
  {name:'Karachi',       slug:'karachi',      lat:24.8900,  lon:66.9389,   country:'PK', station:'OPKC', utc:+5, highH:14},
  {name:'Jeddah',        slug:'jeddah',       lat:21.6796,  lon:39.1565,   country:'SA', station:'OEJN', utc:+3, highH:14},
  {name:'Tel Aviv',      slug:'tel-aviv',     lat:32.0055,  lon:34.8854,   country:'IL', station:'LLBG', utc:+3, highH:14},
  /* Oceania */
  {name:'Wellington',    slug:'wellington',   lat:-41.3272, lon:174.8052,  country:'NZ', station:'NZWN', utc:+12, highH:14},
  /* Africa */
  {name:'Cape Town',     slug:'cape-town',    lat:-33.9648, lon:18.5979,   country:'ZA', station:'FACT', utc:+2, highH:15},
  /* Americas */
  {name:'Toronto',       slug:'toronto',      lat:43.6772,  lon:-79.6306,  country:'CA', station:'CYYZ', utc:-4, highH:15},
  {name:'Mexico City',   slug:'mexico-city',  lat:19.4363,  lon:-99.0721,  country:'MX', station:'MMMX', utc:-5, highH:15},
  {name:'Panama City',   slug:'panama-city',  lat:8.9714,   lon:-79.5355,  country:'PA', station:'MPMG', utc:-5, highH:14},
  {name:'São Paulo',     slug:'sao-paulo',    lat:-23.4356, lon:-46.4731,  country:'BR', station:'SBGR', utc:-3, highH:14},
  {name:'Buenos Aires',  slug:'buenos-aires', lat:-34.8222, lon:-58.5358,  country:'AR', station:'SAEZ', utc:-3, highH:14},
];

const fs = require('fs');

/* ── Load backtest data for bracket recommendations ── */
function loadBacktestData() {
  try {
    const p = require('path').join(__dirname, 'backtest-results.json');
    if (!fs.existsSync(p)) return {};
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const map = {};
    for (const c of (raw.cities || [])) {
      if (c.days >= 10) {
        map[c.city] = {
          exactPct:   c.exactPct   ?? (c.days ? Math.round(c.exactHits/c.days*100) : 0),
          within1Pct: c.within1Pct ?? (c.days ? Math.round(c.within1/c.days*100)   : 0),
          biasShift:  c.biasShift  || 0,
          biasLabel:  c.biasLabel  || 'neutral',
          days:       c.days,
        };
      }
    }
    console.log(`Loaded backtest data for ${Object.keys(map).length} cities.`);
    return map;
  } catch(e) {
    console.warn('Could not load backtest-results.json:', e.message);
    return {};
  }
}

/* ============================================================
   PEAK-HOUR CALIBRATION OVERRIDE
   If calibrate-peak-hours.js has been run, peak-hours.json contains
   REAL measured peak-temperature hours per city (averaged from live
   Open-Meteo hourly data) instead of the rough estimates baked into
   the CITIES array above. Run `node calibrate-peak-hours.js`
   periodically (e.g. monthly) to keep this fresh as seasons change.
   ============================================================ */
function applyCalibratedHighHours(cities) {
  try {
    const calPath = require('path').join(__dirname, 'peak-hours.json');
    if (!fs.existsSync(calPath)) {
      console.log('No peak-hours.json found — using built-in highH estimates. Run calibrate-peak-hours.js to refine.');
      return cities;
    }
    const cal = JSON.parse(fs.readFileSync(calPath, 'utf8'));
    let applied = 0;
    const updated = cities.map(c => {
      const calData = cal.cities?.[c.name];
      if (calData?.highH != null) {
        applied++;
        return { ...c, highH: calData.highH };
      }
      return c;
    });
    console.log(`Applied calibrated peak hours for ${applied}/${cities.length} cities (generated ${cal.generatedAt}).`);
    return updated;
  } catch (e) {
    console.warn('Failed to load peak-hours.json, using built-in estimates:', e.message);
    return cities;
  }
}

const CALIBRATED_CITIES = applyCalibratedHighHours(CITIES);
const STATE_FILE = require('path').join(__dirname, 'alerted.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { keys: [] }; }
}
function saveState(state) {
  /* cap to last 1000 keys so the file doesn't grow forever */
  state.keys = state.keys.slice(-1000);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/* ============================================================
   TRIGGER WINDOW — is this city currently ~2 hours before its
   typical local daily high? Runs hourly, so the check has a
   built-in ±30min tolerance window around the target UTC hour.
   ============================================================ */
function isInTriggerWindow(city, nowUtcHour) {
  /* Target: 2 hours before the local high, converted to UTC.
     We fire for a 2-hour window (target-1 to target+1) rather than a
     single UTC hour — this makes the scan resilient to GitHub Actions
     scheduling delays, which can push runs 30-60+ minutes late. */
  const targetUtcHour = ((city.highH - city.utc - 2) % 24 + 24) % 24;
  const diff = Math.abs(((nowUtcHour - targetUtcHour + 24) % 24));
  return diff <= 1; /* fire within ±1hr of target */
}

/* ============================================================
   FETCH HELPERS
   ============================================================ */
async function fetchJson(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`Fetch failed: ${url} — ${e.message}`);
    return null;
  }
}

/* US cities: NWS hourly forecast → today's high in °F */
async function getNwsForecast(city) {
  const data = await fetchJson(
    `https://api.weather.gov/gridpoints/${city.nwsGrid}/forecast/hourly`,
    { headers: { 'User-Agent': 'pm-scanner-action/1.0' } }
  );
  if (!data) return null;
  /* Use the CITY's local date, not UTC date — at UTC offsets like -4 to -8,
     "today" in UTC can be the wrong calendar day for the city, which silently
     pulls highs from the wrong 24hr period and produces a forecast that's
     several brackets off from what the city is actually experiencing. */
  const cityLocalDate = getCityLocalDate(city);
  let maxF = null;
  for (const p of (data.properties?.periods || [])) {
    const periodLocalDate = getCityLocalDateFromIso(p.startTime, city.utc);
    let t = p.temperature;
    if (p.temperatureUnit === 'C') t = Math.round(t * 9 / 5 + 32);
    if (periodLocalDate === cityLocalDate && t != null) {
      if (maxF == null || t > maxF) maxF = t;
    }
  }
  return maxF;
}

/* Returns YYYY-MM-DD for "right now" in the city's local timezone (approx,
   using the fixed UTC offset we already track per city — good enough since
   we only need the calendar date, not exact DST behavior). */
function getCityLocalDate(city) {
  const now = new Date();
  const localMs = now.getTime() + city.utc * 3600 * 1000;
  return new Date(localMs).toISOString().slice(0, 10);
}

/* Same, but for an arbitrary ISO timestamp string (e.g. NWS period startTime,
   which already includes its own UTC offset in the string) */
function getCityLocalDateFromIso(isoString, cityUtcOffset) {
  /* NWS startTime strings already include a timezone offset (e.g. -04:00),
     so Date correctly parses the absolute instant; we then re-express it
     in the city's nominal UTC offset for a consistent calendar-day check. */
  const d = new Date(isoString);
  const localMs = d.getTime() + cityUtcOffset * 3600 * 1000;
  return new Date(localMs).toISOString().slice(0, 10);
}

/* International cities: Open-Meteo ECMWF forecast → today's high in °C, converted to °F */
async function getEcmwfForecast(city) {
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&daily=temperature_2m_max&forecast_days=1&timezone=auto`
  );
  if (!data) return null;
  const tC = data.daily?.temperature_2m_max?.[0];
  if (tC == null) return null;
  return Math.round(tC * 9 / 5 + 32);
}

/* ── Live wind and cloud conditions from Open-Meteo current weather ──
   Used to apply wind/cloud bias corrections from backtest data. */
async function getLiveWindCloud(city) {
  const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=windspeed_10m,winddirection_10m,cloudcover&timezone=auto`;
  const data = await fetchJson(url);
  if (!data?.current) return null;
  const windSpeed = data.current.windspeed_10m;
  const windDir   = data.current.winddirection_10m;
  const cloud     = data.current.cloudcover;
  if (windSpeed == null || windDir == null) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const compass = dirs[Math.round(windDir / 22.5) % 16];
  return {
    windSpeed: Math.round(windSpeed * 10) / 10,
    windSpeedMph: Math.round(windSpeed * 0.621371 * 10) / 10,
    windDir, windCompass: compass,
    cloudCover: Math.round(cloud || 0),
  };
}

/* ── Apply wind/cloud bias adjustment from backtest data ──
   Returns { extraShift, note } where extraShift is additional
   buckets to shift on top of the standard bias correction. */
function getWindCloudAdjustment(cityName, wind, bt) {
  if (!wind || !bt?.windCloudCorrelation) return { extraShift: 0, note: null };
  const wc = bt.windCloudCorrelation;

  /* Check wind direction bias */
  const dirData = wc.windDirection?.[wind.windCompass];
  const dirBias = dirData?.avgBias ?? 0;

  /* Check cloud cover bias */
  const cloudBucket = wind.cloudCover < 25 ? 'clear'
    : wind.cloudCover < 75 ? 'partly' : 'overcast';
  const cloudBias = wc.cloudCover?.[cloudBucket]?.avgBias ?? 0;

  /* Combine: weight wind direction more heavily (60/40) */
  const combined = (dirBias * 0.6) + (cloudBias * 0.4);
  const extraShift = Math.round(combined);

  if (Math.abs(combined) < 0.4) return { extraShift: 0, note: null };

  const dirNote  = Math.abs(dirBias) >= 0.4
    ? `${wind.windCompass} wind → ${dirBias > 0 ? 'warmer' : 'cooler'} (${dirBias > 0 ? '+' : ''}${dirBias.toFixed(1)} buckets historically)`
    : null;
  const cloudNote = Math.abs(cloudBias) >= 0.4
    ? `${cloudBucket} skies → ${cloudBias > 0 ? 'warmer' : 'cooler'} (${cloudBias > 0 ? '+' : ''}${cloudBias.toFixed(1)} buckets historically)`
    : null;

  const note = [dirNote, cloudNote].filter(Boolean).join(' · ');
  return { extraShift, note };
}
async function fetchMarketBySlug(slug) {
  const data = await fetchJson(`${PM_GAMMA}/events?slug=${encodeURIComponent(slug)}`);
  if (!data) return null;
  const events = Array.isArray(data) ? data : [data];
  return events.find(e => e.slug === slug)
      || events.find(e => e.slug && e.slug.startsWith(slug))
      || (events.length === 1 ? events[0] : null);
}

function parseTempRange(q) {
  if (!q) return null;
  const ql = q.toLowerCase();
  const isCelsius = q.includes('°C') || q.includes('℃') || ql.includes(' celsius') ||
    (!q.includes('°F') && !q.includes('℉') && (() => {
      const nums = [...q.matchAll(/(-?\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
      return nums.length > 0 && nums.every(n => n >= -30 && n <= 55);
    })());

  if (ql.includes('or below') || ql.includes('or lower') || ql.includes('below') || q.startsWith('<')) {
    const m = q.match(/(-?\d+(?:\.\d+)?)/);
    if (m) return { lo: -999, hi: parseFloat(m[1]), celsius: isCelsius };
  }
  if (ql.includes('or higher') || ql.includes('or above') || ql.includes('above')) {
    const m = q.match(/(-?\d+(?:\.\d+)?)/);
    if (m) return { lo: parseFloat(m[1]), hi: 999, celsius: isCelsius };
  }
  const rng = q.match(/(-?\d+(?:\.\d+)?)\s*[°℃℉]?\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (rng) return { lo: parseFloat(rng[1]), hi: parseFloat(rng[2]), celsius: isCelsius };
  const single = q.match(/(-?\d+(?:\.\d+)?)\s*[°℃℉]/);
  if (single) return { lo: parseFloat(single[1]), hi: parseFloat(single[1]), celsius: isCelsius };
  return null;
}

function getAllBuckets(event) {
  const buckets = [];
  for (const mkt of (event.markets || [])) {
    const rng = parseTempRange(mkt.question || mkt.groupItemTitle || '');
    if (!rng) continue;
    let yesP = null;
    try {
      const prices = JSON.parse(mkt.outcomePrices || '[]');
      yesP = parseFloat(prices[0]);
    } catch { continue; }
    if (yesP == null || isNaN(yesP)) continue;
    buckets.push({ rng, yesP, question: mkt.question, slug: mkt.slug || event.slug });
  }
  buckets.sort((a, b) => a.rng.lo - b.rng.lo);
  return buckets;
}

/* ============================================================
   SIGNAL DETECTION — find Core-3 (exact ±1 bucket) arbs / +EV
   ============================================================ */
function findCore3Signal(buckets, forecastVal) {
  if (buckets.length < 3) return null;
  const exactIdx = buckets.findIndex(b => {
    const { lo, hi } = b.rng;
    if (lo === hi) return forecastVal === lo;
    return forecastVal >= lo && forecastVal <= hi;
  });
  if (exactIdx < 1 || exactIdx >= buckets.length - 1) return null; /* needs a bucket on each side */

  const core3 = [buckets[exactIdx - 1], buckets[exactIdx], buckets[exactIdx + 1]];
  const cost = core3.reduce((s, b) => s + b.yesP, 0);
  const ev = Math.round(((1 / cost) - 1) * 100);
  const isArb = cost < 0.999;

  return { core3, cost, ev, isArb, exactBucket: buckets[exactIdx] };
}

/* ============================================================
   TELEGRAM
   ============================================================ */
async function sendTelegram(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    });
    const data = await res.json();
    if (!data.ok) console.error('Telegram error:', data.description);
    else console.log('Telegram message sent.');
  } catch (e) {
    console.error('Telegram send failed:', e.message);
  }
}

/* ============================================================
   MAIN
   ============================================================ */
async function main() {
  const now = new Date();
  const nowUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const backtestData = loadBacktestData();

  const dueCities = CALIBRATED_CITIES.filter(c => isInTriggerWindow(c, nowUtcHour));
  console.log(`UTC hour: ${nowUtcHour.toFixed(2)} — ${dueCities.length} cities due: ${dueCities.map(c => c.name).join(', ') || '(none)'}`);

  if (!dueCities.length) {
    console.log('No cities in trigger window this run. Exiting.');
    return;
  }

  const state = loadState();
  const alertedSet = new Set(state.keys);
  const newAlerts = [];

  for (const city of dueCities) {
    console.log(`\n--- ${city.name} ---`);
    try {
      /* Compute the market date using THIS city's local calendar day, not
         the GitHub Actions runner's UTC date. Using a shared UTC "today"
         across all 49 cities was the root cause of forecasts landing on
         the wrong day's market — several timezones are already on a
         different calendar date than UTC at any given moment. */
      const cityNow = new Date(Date.now() + city.utc * 3600 * 1000);
      const yyyy = cityNow.getUTCFullYear();
      const month = MONTHS_EN[cityNow.getUTCMonth()];
      const day = cityNow.getUTCDate();
      const ds = cityNow.toISOString().slice(0, 10);

      const tempF = city.country === 'US'
        ? await getNwsForecast(city)
        : await getEcmwfForecast(city);

      if (tempF == null) {
        console.log(`  No forecast data for ${city.name}, skipping.`);
        continue;
      }
      console.log(`  Forecast: ${tempF}°F (local date: ${ds})`);

      const slug = `highest-temperature-in-${city.slug}-on-${month}-${day}-${yyyy}`;
      const event = await fetchMarketBySlug(slug);
      if (!event) {
        console.log(`  No market found for slug: ${slug}`);
        continue;
      }

      const buckets = getAllBuckets(event);
      if (buckets.length < 3) {
        console.log(`  Not enough buckets (${buckets.length}) to form a Core-3 window.`);
        continue;
      }

      /* Convert forecast to the bucket's unit for matching */
      const bucketsAreCelsius = buckets[0]?.rng.celsius;
      const forecastVal = bucketsAreCelsius
        ? Math.floor((tempF - 32) * 5 / 9)
        : tempF;

      const sig = findCore3Signal(buckets, forecastVal);
      if (!sig) {
        console.log(`  No Core-3 signal (forecast bucket at edge or not found).`);
        continue;
      }

      const key = `${city.name}|${ds}|core3`;
      if (alertedSet.has(key)) {
        console.log(`  Already alerted today, skipping.`);
        continue;
      }

      if (!sig.isArb && sig.ev < 20) {
        console.log(`  EV too low (${sig.ev}%) and not an arb, skipping.`);
        continue;
      }

      /* Skip arbs with less than 5¢ profit per share — not worth the effort */
      if (sig.isArb && (100 - Math.round(sig.cost * 100)) < 5) {
        console.log(`  Arb profit too thin (<5¢/share), skipping.`);
        continue;
      }

      const totalCents    = Math.round(sig.cost * 100);
      const unit          = bucketsAreCelsius ? '°C' : '°F';
      const wuLink        = buildWundergroundLink(city, cityNow);
      const bt            = backtestData[city.name];

      /* ── Live wind/cloud conditions ── */
      const wind = await getLiveWindCloud(city);
      const windAdj = getWindCloudAdjustment(city.name, wind, bt);

      /* ── Bracket recommendation using backtest bias + live wind/cloud ──
         Start with the exact forecast bucket, then shift by:
         1. City's historical bias (biasShift from backtest)
         2. Live wind/cloud adjustment (extraShift from current conditions) */
      const allRanges = buckets.map(b => b.rng).filter(Boolean);
      allRanges.sort((a,b) => a.lo - b.lo);
      const exactRng   = allRanges.find(r => {
        const val  = r.celsius ? Math.floor((tempF-32)*5/9) : tempF;
        const fVal = (r.lo===r.hi) ? Math.floor(val) : val;
        return fVal >= r.lo && fVal <= r.hi;
      });
      const exactIdx   = exactRng ? allRanges.indexOf(exactRng) : null;

      let recBucket    = exactRng;
      let shiftNote    = '';
      let totalShift   = 0;

      if (exactIdx != null) {
        const biasShift = bt?.biasShift || 0;
        totalShift = biasShift + (windAdj.extraShift || 0);
        const shiftedIdx = Math.max(0, Math.min(allRanges.length-1, exactIdx - totalShift));
        recBucket = allRanges[shiftedIdx];

        const parts = [];
        if (biasShift !== 0) {
          parts.push(`historical bias ${biasShift > 0 ? 'down' : 'up'} ${Math.abs(biasShift)}`);
        }
        if (windAdj.note) parts.push(windAdj.note);
        if (parts.length) shiftNote = parts.join('\n');
      }

      const windLine = wind
        ? `🌬 ${wind.windCompass} ${wind.windSpeedMph}mph · ☁️ ${wind.cloudCover}% cloud`
        : null;

      const recLabel = recBucket
        ? (recBucket.lo === -999 ? `≤${recBucket.hi}${unit}`
          : recBucket.hi === 999 ? `≥${recBucket.lo}${unit}`
          : recBucket.lo === recBucket.hi ? `${recBucket.lo}${unit}`
          : `${recBucket.lo}–${recBucket.hi}${unit}`)
        : `${forecastVal}${unit}`;

      const accuracyNote = bt
        ? `Historical accuracy: exact ${bt.exactPct}% | ±1 ${bt.within1Pct}% (${bt.days} days)`
        : 'No backtest data yet';

      const msg = [
        `${sig.isArb ? '⚡ GUARANTEED ARB' : '🟢 +EV SIGNAL'} — ${city.name}`,
        `${ds} · Forecast: ${tempF}°F (${forecastVal}${unit})`,
        windLine,
        `→ Recommended bucket: ${recLabel}`,
        shiftNote,
        sig.isArb
          ? `Core-3 cost: ${totalCents}¢ → guaranteed +${100-totalCents}¢/share`
          : `Core-3 EV: +${sig.ev}%`,
        accuracyNote,
        wuLink || '',
        `https://polymarket.com/event/${event.slug}`,
      ].filter(Boolean).join('\n');

      newAlerts.push(msg);
      alertedSet.add(key);
      console.log(`  ✅ Signal: ${sig.isArb?'ARB':'EV'} ${sig.ev}% | rec bucket: ${recLabel} | accuracy: ${bt?.exactPct??'?'}%`);

    } catch (e) {
      console.error(`  Error processing ${city.name}:`, e.message);
    }
  }

  if (newAlerts.length) {
    const header = `📡 PM Scanner — ${newAlerts.length} signal${newAlerts.length > 1 ? 's' : ''} (2hr-before-high check)\n`;
    await sendTelegram(header + '\n' + newAlerts.join('\n\n'));
    state.keys = [...alertedSet];
    saveState(state);
  } else {
    console.log('\nNo new qualifying signals this run.');
  }
}

/* Wunderground history link for the resolution station */
function buildWundergroundLink(city, date) {
  const paths = {
    'New York': 'us/ny/new-york-city/KLGA', 'Chicago': 'us/il/chicago/KORD',
    'Miami': 'us/fl/miami/KMIA', 'Dallas': 'us/tx/dallas/KDAL',
    'Seattle': 'us/wa/seattle/KSEA', 'Atlanta': 'us/ga/atlanta/KATL',
    'Los Angeles': 'us/ca/los-angeles/KLAX', 'Houston': 'us/tx/houston/KHOU',
    'Denver': 'us/co/aurora/KBKF', 'San Francisco': 'us/ca/san-francisco/KSFO',
    'Austin': 'us/tx/austin/KAUS', 'London': 'gb/london/EGLC',
    'Paris': 'fr/bonneuil-en-france/LFPB', 'Amsterdam': 'nl/schiphol/EHAM',
    'Madrid': 'es/madrid/LEMD', 'Milan': 'it/milan/LIMC', 'Munich': 'de/munich/EDDM',
    'Helsinki': 'fi/vantaa/EFHK', 'Warsaw': 'pl/warsaw/EPWA', 'Ankara': 'tr/%C3%87ubuk/LTAC',
    'Tokyo': 'jp/tokyo/RJTT', 'Seoul': 'kr/incheon/RKSI', 'Busan': 'kr/busan/RKPK',
    'Singapore': 'sg/singapore/WSSS', 'Shanghai': 'cn/shanghai/ZSPD', 'Beijing': 'cn/beijing/ZBAA',
    'Guangzhou': 'cn/guangzhou/ZGGG', 'Shenzhen': 'cn/shenzhen/ZGSZ', 'Chengdu': 'cn/chengdu/ZUUU',
    'Chongqing': 'cn/chongqing/ZUCK', 'Wuhan': 'cn/wuhan/ZHHH', 'Qingdao': 'cn/qingdao/ZSQD',
    'Kuala Lumpur': 'my/sepang-district/WMKK', 'Manila': 'ph/manila/RPLL', 'Taipei': 'tw/taipei/RCSS',
    'Lucknow': 'in/lucknow/VILK', 'Karachi': 'pk/karachi/OPKC', 'Jeddah': 'sa/jeddah/OEJN',
    'Wellington': 'nz/wellington/NZWN', 'Cape Town': 'za/matroosfonteIn/FACT',
    'Toronto': 'ca/mississauga/CYYZ', 'Mexico City': 'mx/mexico-city/MMMX',
    'Panama City': 'pa/panama-city/MPMG', 'São Paulo': 'br/guarulhos/SBGR',
    'Buenos Aires': 'ar/ezeiza/SAEZ',
  };
  if (city.name === 'Hong Kong') return 'https://www.weather.gov.hk/en/cis/climat.htm';
  if (['Istanbul', 'Moscow', 'Tel Aviv'].includes(city.name)) {
    const icaoMap = { 'Istanbul': 'LTFM', 'Moscow': 'UUWW', 'Tel Aviv': 'LLBG' };
    return `https://www.weather.gov/wrh/timeseries?site=${icaoMap[city.name]}`;
  }
  const path = paths[city.name];
  if (!path) return null;
  const params = `?day=${date.getUTCDate()}&month=${date.getUTCMonth() + 1}&year=${date.getUTCFullYear()}`;
  return `https://www.wunderground.com/history/daily/${path}${params}`;
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
