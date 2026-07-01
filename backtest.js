#!/usr/bin/env node
/* ============================================================
   PM Scanner — Backtest v2
   Uses Open-Meteo Previous Runs API to get GENUINE day-1 forecasts
   as actually issued (not ERA5/hindcast), compared against which
   Polymarket temperature bucket resolved YES.

   Uses exact ICAO station coordinates, not city centers.

   Usage: node backtest.js
   Output: summary + backtest-results.json
   ============================================================ */

const fs   = require('fs');
const path = require('path');

const MONTHS_EN = ['january','february','march','april','may','june',
                   'july','august','september','october','november','december'];

/* Exact ICAO station coordinates — what Wunderground reads from,
   what Polymarket resolves on. Not city centers. */
const CITIES = [
  /* US — NWS */
  {name:'New York',      slug:'nyc',           lat:40.7773, lon:-73.8726,  country:'US', utc:-4},
  {name:'Chicago',       slug:'chicago',        lat:41.9742, lon:-87.9073,  country:'US', utc:-5},
  {name:'Miami',         slug:'miami',          lat:25.7959, lon:-80.2870,  country:'US', utc:-4},
  {name:'Dallas',        slug:'dallas',         lat:32.8471, lon:-96.8518,  country:'US', utc:-5},
  {name:'Seattle',       slug:'seattle',        lat:47.4502, lon:-122.3088, country:'US', utc:-7},
  {name:'Atlanta',       slug:'atlanta',        lat:33.6407, lon:-84.4277,  country:'US', utc:-4},
  {name:'Los Angeles',   slug:'los-angeles',    lat:33.9425, lon:-118.4081, country:'US', utc:-7},
  {name:'Houston',       slug:'houston',        lat:29.6454, lon:-95.2789,  country:'US', utc:-5},
  {name:'Denver',        slug:'denver',         lat:39.7170, lon:-104.7517, country:'US', utc:-6},
  {name:'San Francisco', slug:'san-francisco',  lat:37.6213, lon:-122.3790, country:'US', utc:-7},
  {name:'Austin',        slug:'austin',         lat:30.1975, lon:-97.6664,  country:'US', utc:-5},
  /* Europe — exact ICAO station coords */
  {name:'London',        slug:'london',         lat:51.5033, lon:0.0553,    country:'EU', utc:+1},  /* EGLC */
  {name:'Paris',         slug:'paris',          lat:48.9694, lon:2.4414,    country:'EU', utc:+2},  /* LFPB */
  {name:'Amsterdam',     slug:'amsterdam',      lat:52.3086, lon:4.7639,    country:'EU', utc:+2},  /* EHAM */
  {name:'Madrid',        slug:'madrid',         lat:40.4936, lon:-3.5668,   country:'EU', utc:+2},  /* LEMD */
  {name:'Milan',         slug:'milan',          lat:45.6306, lon:8.7231,    country:'EU', utc:+2},  /* LIMC */
  {name:'Munich',        slug:'munich',         lat:48.3537, lon:11.7862,   country:'EU', utc:+2},  /* EDDM */
  {name:'Helsinki',      slug:'helsinki',       lat:60.3172, lon:24.9633,   country:'EU', utc:+3},  /* EFHK */
  {name:'Warsaw',        slug:'warsaw',         lat:52.1657, lon:20.9671,   country:'EU', utc:+2},  /* EPWA */
  {name:'Istanbul',      slug:'istanbul',       lat:41.2753, lon:28.7519,   country:'EU', utc:+3},  /* LTFM */
  {name:'Ankara',        slug:'ankara',         lat:40.1281, lon:32.9951,   country:'EU', utc:+3},  /* LTAC */
  {name:'Moscow',        slug:'moscow',         lat:55.5983, lon:37.2615,   country:'EU', utc:+3},  /* UUWW */
  /* Asia */
  {name:'Tokyo',         slug:'tokyo',          lat:35.5533, lon:139.7811,  country:'AS', utc:+9},  /* RJTT */
  {name:'Hong Kong',     slug:'hong-kong',      lat:22.3020, lon:114.1740,  country:'AS', utc:+8},  /* HKO */
  {name:'Seoul',         slug:'seoul',          lat:37.4602, lon:126.4407,  country:'AS', utc:+9},  /* RKSI */
  {name:'Busan',         slug:'busan',          lat:35.1796, lon:128.9382,  country:'AS', utc:+9},  /* RKPK */
  {name:'Singapore',     slug:'singapore',      lat:1.3644,  lon:103.9915,  country:'AS', utc:+8},  /* WSSS */
  {name:'Shanghai',      slug:'shanghai',       lat:31.1443, lon:121.8083,  country:'AS', utc:+8},  /* ZSPD */
  {name:'Beijing',       slug:'beijing',        lat:40.0799, lon:116.5838,  country:'AS', utc:+8},  /* ZBAA */
  {name:'Guangzhou',     slug:'guangzhou',      lat:23.3924, lon:113.2988,  country:'AS', utc:+8},  /* ZGGG */
  {name:'Shenzhen',      slug:'shenzhen',       lat:22.6395, lon:113.8145,  country:'AS', utc:+8},  /* ZGSZ */
  {name:'Chengdu',       slug:'chengdu',        lat:30.5785, lon:103.9471,  country:'AS', utc:+8},  /* ZUUU */
  {name:'Chongqing',     slug:'chongqing',      lat:29.7192, lon:106.6416,  country:'AS', utc:+8},  /* ZUCK */
  {name:'Wuhan',         slug:'wuhan',          lat:30.7839, lon:114.2081,  country:'AS', utc:+8},  /* ZHHH */
  {name:'Qingdao',       slug:'qingdao',        lat:36.2661, lon:120.3747,  country:'AS', utc:+8},  /* ZSQD */
  {name:'Kuala Lumpur',  slug:'kuala-lumpur',   lat:2.7456,  lon:101.7072,  country:'AS', utc:+8},  /* WMKK */
  {name:'Manila',        slug:'manila',         lat:14.5086, lon:121.0197,  country:'AS', utc:+8},  /* RPLL */
  {name:'Taipei',        slug:'taipei',         lat:25.0697, lon:121.5524,  country:'AS', utc:+8},  /* RCSS */
  {name:'Lucknow',       slug:'lucknow',        lat:26.7606, lon:80.8893,   country:'AS', utc:+5.5},/* VILK */
  {name:'Karachi',       slug:'karachi',        lat:24.8900, lon:66.9389,   country:'AS', utc:+5},  /* OPKC */
  {name:'Jeddah',        slug:'jeddah',         lat:21.6796, lon:39.1565,   country:'ME', utc:+3},  /* OEJN */
  {name:'Tel Aviv',      slug:'tel-aviv',       lat:32.0055, lon:34.8854,   country:'ME', utc:+3},  /* LLBG */
  {name:'Wellington',    slug:'wellington',     lat:-41.3272,lon:174.8052,  country:'OC', utc:+12}, /* NZWN */
  {name:'Cape Town',     slug:'cape-town',      lat:-33.9648,lon:18.5979,   country:'AF', utc:+2},  /* FACT */
  {name:'Toronto',       slug:'toronto',        lat:43.6772, lon:-79.6306,  country:'CA', utc:-4},  /* CYYZ */
  {name:'Mexico City',   slug:'mexico-city',    lat:19.4363, lon:-99.0721,  country:'SA', utc:-5},  /* MMMX */
  {name:'Panama City',   slug:'panama-city',    lat:8.9714,  lon:-79.5355,  country:'SA', utc:-5},  /* MPMG */
  {name:'São Paulo',     slug:'sao-paulo',      lat:-23.4356,lon:-46.4731,  country:'SA', utc:-3},  /* SBGR */
  {name:'Buenos Aires',  slug:'buenos-aires',   lat:-34.8222,lon:-58.5358,  country:'SA', utc:-3},  /* SAEZ */
];

const DAYS_BACK = 60; /* Previous Runs API goes back to Jan 2024 */
const PM_GAMMA  = 'https://gamma-api.polymarket.com';

async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Genuine day-1 forecast using Open-Meteo Previous Runs API ──
   temperature_2m_previous_day1 = value predicted exactly 24hrs before
   valid time — this is a real forecast, not ERA5 or hindcast. */
async function getDay1Forecast(city, dateStr) {
  /* Previous Runs API endpoint */
  const url = `https://previous-runs-api.open-meteo.com/v1/previous_runs` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&daily=temperature_2m_max_previous_day1` +
    `&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;
  const data = await fetchJson(url);
  const tC = data?.daily?.temperature_2m_max_previous_day1?.[0];
  if (tC == null) return null;
  return { tempC: Math.round(tC * 10) / 10, tempF: Math.round(tC * 9/5 + 32) };
}

/* ── Fetch resolved Polymarket market for a city+date ── */
async function getResolvedMarket(city, dateStr) {
  const d     = new Date(dateStr + 'T12:00:00Z');
  const month = MONTHS_EN[d.getUTCMonth()];
  const day   = d.getUTCDate();
  const yyyy  = d.getUTCFullYear();
  const slug  = `highest-temperature-in-${city.slug}-on-${month}-${day}-${yyyy}`;

  const data = await fetchJson(`${PM_GAMMA}/events?slug=${encodeURIComponent(slug)}`);
  if (!data) return null;
  const events = Array.isArray(data) ? data : [data];
  const event  = events.find(e => e.slug === slug)
               || (events.length === 1 ? events[0] : null);
  if (!event?.markets?.length) return null;

  const markets  = event.markets;
  const resolved = markets.filter(m => m.resolved);
  if (!resolved.length) return { slug, resolved: false };

  /* Find the winning market */
  let winner = null;
  for (const m of resolved) {
    try {
      const prices = JSON.parse(m.outcomePrices || '[]');
      if (parseFloat(prices[0]) >= 0.99) { winner = m; break; }
    } catch {}
  }
  if (!winner) winner = resolved[0]; /* fallback to first resolved */

  return {
    slug, resolved: true,
    winnerQuestion: winner?.question || null,
    allQuestions: markets.map(m => m.question),
  };
}

function parseTempRange(q) {
  if (!q) return null;
  const isCelsius = q.includes('°C') || (!q.includes('°F') &&
    [...q.matchAll(/(-?\d+)/g)].map(m=>+m[1]).every(n => n>=-30 && n<=55));
  if (/or below|or lower/i.test(q)) {
    const m = q.match(/(-?\d+)/); return m ? {lo:-999,hi:+m[1],celsius:isCelsius} : null;
  }
  if (/or (higher|above)/i.test(q)) {
    const m = q.match(/(-?\d+)/); return m ? {lo:+m[1],hi:999,celsius:isCelsius} : null;
  }
  const rng = q.match(/(-?\d+)\s*[-–]\s*(-?\d+)/);
  if (rng) return {lo:+rng[1],hi:+rng[2],celsius:isCelsius};
  const single = q.match(/(-?\d+)\s*°/);
  if (single) return {lo:+single[1],hi:+single[1],celsius:isCelsius};
  return null;
}

function forecastInBucket(tempF, tempC, rng) {
  const val  = rng.celsius ? tempC : tempF;
  const fVal = (rng.lo === rng.hi) ? Math.floor(val) : val;
  return fVal >= rng.lo && fVal <= rng.hi;
}

async function main() {
  console.log(`\nPM Scanner Backtest v2 — Genuine day-1 forecasts vs Polymarket resolution`);
  console.log(`Using Open-Meteo Previous Runs API + exact ICAO station coordinates`);
  console.log(`Last ${DAYS_BACK} days across ${CITIES.length} cities\n${'='.repeat(65)}`);

  const results = [];
  let totalResolved = 0, exactHits = 0, within1Hits = 0, noForecast = 0;

  for (const city of CITIES) {
    const cityRows = [];
    process.stdout.write(`${city.name.padEnd(16)} `);

    for (let daysAgo = DAYS_BACK; daysAgo >= 1; daysAgo--) {
      /* Use city-local date */
      const cityNow  = new Date(Date.now() + city.utc * 3600 * 1000);
      const targetMs = cityNow.getTime() - daysAgo * 86400000;
      const dateStr  = new Date(targetMs).toISOString().slice(0,10);

      const [forecast, market] = await Promise.all([
        getDay1Forecast(city, dateStr),
        getResolvedMarket(city, dateStr),
      ]);
      await sleep(100);

      if (!market?.resolved) continue;
      if (!market.winnerQuestion) continue;
      totalResolved++;

      if (!forecast) { noForecast++; continue; }

      const winnerRng = parseTempRange(market.winnerQuestion);
      if (!winnerRng) continue;

      const exact = forecastInBucket(forecast.tempF, forecast.tempC, winnerRng);

      /* ±1 bucket */
      const allRanges = market.allQuestions.map(parseTempRange).filter(Boolean);
      allRanges.sort((a,b) => a.lo - b.lo);
      const wi = allRanges.findIndex(r => r.lo===winnerRng.lo && r.hi===winnerRng.hi);
      const nearby = [
        wi>0 ? allRanges[wi-1] : null,
        winnerRng,
        wi<allRanges.length-1 ? allRanges[wi+1] : null,
      ].filter(Boolean);
      const w1 = nearby.some(r => forecastInBucket(forecast.tempF, forecast.tempC, r));

      /* How many buckets off was the forecast? */
      const forecastRng = allRanges.find(r => forecastInBucket(forecast.tempF, forecast.tempC, r));
      const forecastIdx = forecastRng ? allRanges.indexOf(forecastRng) : null;
      const bucketsOff  = forecastIdx != null && wi >= 0 ? Math.abs(forecastIdx - wi) : null;

      if (exact) exactHits++;
      if (w1)    within1Hits++;

      cityRows.push({ date:dateStr, forecastC:forecast.tempC, forecastF:forecast.tempF,
        winner:market.winnerQuestion, exact, w1, bucketsOff });
    }

    const n   = cityRows.length;
    const eh  = cityRows.filter(r=>r.exact).length;
    const w1h = cityRows.filter(r=>r.w1).length;
    const avgOff = cityRows.filter(r=>r.bucketsOff!=null).reduce((s,r)=>s+r.bucketsOff,0) /
                   Math.max(1, cityRows.filter(r=>r.bucketsOff!=null).length);
    console.log(`${n.toString().padStart(2)} days | exact ${eh}/${n} (${n?Math.round(eh/n*100):'-'}%) | ±1 ${w1h}/${n} (${n?Math.round(w1h/n*100):'-'}%) | avg off: ${avgOff.toFixed(1)} buckets`);

    results.push({city:city.name, days:n, exactHits:eh, within1:w1h, avgBucketsOff:Math.round(avgOff*10)/10, detail:cityRows});
  }

  const ep = totalResolved ? Math.round(exactHits/totalResolved*100) : 0;
  const w1p = totalResolved ? Math.round(within1Hits/totalResolved*100) : 0;

  console.log(`\n${'='.repeat(65)}`);
  console.log(`OVERALL — ${totalResolved} resolved markets (${noForecast} skipped: no forecast data)`);
  console.log(`Exact bucket hit:   ${exactHits}/${totalResolved} = ${ep}%`);
  console.log(`Within ±1 bucket:   ${within1Hits}/${totalResolved} = ${w1p}%`);

  const ranked = results.filter(r=>r.days>=7).sort((a,b)=>(b.within1/b.days)-(a.within1/a.days));
  console.log(`\nBest cities (±1 hit rate):`);
  ranked.slice(0,5).forEach(r=>console.log(`  ${r.city.padEnd(16)} ${Math.round(r.within1/r.days*100)}% (avg ${r.avgBucketsOff} buckets off)`));
  console.log(`Worst cities (±1 hit rate):`);
  ranked.slice(-5).reverse().forEach(r=>console.log(`  ${r.city.padEnd(16)} ${Math.round(r.within1/r.days*100)}% (avg ${r.avgBucketsOff} buckets off)`));

  const out = {
    generatedAt: new Date().toISOString(),
    daysBack: DAYS_BACK,
    apiUsed: 'Open-Meteo Previous Runs API (genuine day-1 forecasts)',
    coordinatesUsed: 'Exact ICAO station coordinates',
    summary: {totalResolved, exactHits, within1Hits, exactPct:ep, within1Pct:w1p, noForecastData:noForecast},
    cities: results,
  };
  fs.writeFileSync(path.join(__dirname,'backtest-results.json'), JSON.stringify(out,null,2));
  console.log(`\nFull results → backtest-results.json`);
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1);});
