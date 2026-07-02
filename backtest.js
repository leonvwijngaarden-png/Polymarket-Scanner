#!/usr/bin/env node
/* ============================================================
   PM Scanner — Backtest v5
   Adds wind speed, wind direction, and cloud cover correlation
   with forecast error per city. Helps identify when conditions
   suggest the forecast will be wrong in a specific direction.
   ============================================================ */

const fs   = require('fs');
const path = require('path');

const MONTHS_EN = ['january','february','march','april','may','june',
                   'july','august','september','october','november','december'];

const CITIES = [
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
  {name:'London',        slug:'london',         lat:51.5033, lon:0.0553,    country:'EU', utc:+1},
  {name:'Paris',         slug:'paris',          lat:48.9694, lon:2.4414,    country:'EU', utc:+2},
  {name:'Amsterdam',     slug:'amsterdam',      lat:52.3086, lon:4.7639,    country:'EU', utc:+2},
  {name:'Madrid',        slug:'madrid',         lat:40.4936, lon:-3.5668,   country:'EU', utc:+2},
  {name:'Milan',         slug:'milan',          lat:45.6306, lon:8.7231,    country:'EU', utc:+2},
  {name:'Munich',        slug:'munich',         lat:48.3537, lon:11.7862,   country:'EU', utc:+2},
  {name:'Helsinki',      slug:'helsinki',       lat:60.3172, lon:24.9633,   country:'EU', utc:+3},
  {name:'Warsaw',        slug:'warsaw',         lat:52.1657, lon:20.9671,   country:'EU', utc:+2},
  {name:'Istanbul',      slug:'istanbul',       lat:41.2753, lon:28.7519,   country:'EU', utc:+3},
  {name:'Ankara',        slug:'ankara',         lat:40.1281, lon:32.9951,   country:'EU', utc:+3},
  {name:'Moscow',        slug:'moscow',         lat:55.5983, lon:37.2615,   country:'EU', utc:+3},
  {name:'Tokyo',         slug:'tokyo',          lat:35.5533, lon:139.7811,  country:'AS', utc:+9},
  {name:'Hong Kong',     slug:'hong-kong',      lat:22.3020, lon:114.1740,  country:'AS', utc:+8},
  {name:'Seoul',         slug:'seoul',          lat:37.4602, lon:126.4407,  country:'AS', utc:+9},
  {name:'Busan',         slug:'busan',          lat:35.1796, lon:128.9382,  country:'AS', utc:+9},
  {name:'Singapore',     slug:'singapore',      lat:1.3644,  lon:103.9915,  country:'AS', utc:+8},
  {name:'Shanghai',      slug:'shanghai',       lat:31.1443, lon:121.8083,  country:'AS', utc:+8},
  {name:'Beijing',       slug:'beijing',        lat:40.0799, lon:116.5838,  country:'AS', utc:+8},
  {name:'Guangzhou',     slug:'guangzhou',      lat:23.3924, lon:113.2988,  country:'AS', utc:+8},
  {name:'Shenzhen',      slug:'shenzhen',       lat:22.6395, lon:113.8145,  country:'AS', utc:+8},
  {name:'Chengdu',       slug:'chengdu',        lat:30.5785, lon:103.9471,  country:'AS', utc:+8},
  {name:'Chongqing',     slug:'chongqing',      lat:29.7192, lon:106.6416,  country:'AS', utc:+8},
  {name:'Wuhan',         slug:'wuhan',          lat:30.7839, lon:114.2081,  country:'AS', utc:+8},
  {name:'Qingdao',       slug:'qingdao',        lat:36.2661, lon:120.3747,  country:'AS', utc:+8},
  {name:'Kuala Lumpur',  slug:'kuala-lumpur',   lat:2.7456,  lon:101.7072,  country:'AS', utc:+8},
  {name:'Manila',        slug:'manila',         lat:14.5086, lon:121.0197,  country:'AS', utc:+8},
  {name:'Taipei',        slug:'taipei',         lat:25.0697, lon:121.5524,  country:'AS', utc:+8},
  {name:'Lucknow',       slug:'lucknow',        lat:26.7606, lon:80.8893,   country:'AS', utc:+5.5},
  {name:'Karachi',       slug:'karachi',        lat:24.8900, lon:66.9389,   country:'AS', utc:+5},
  {name:'Jeddah',        slug:'jeddah',         lat:21.6796, lon:39.1565,   country:'ME', utc:+3},
  {name:'Tel Aviv',      slug:'tel-aviv',       lat:32.0055, lon:34.8854,   country:'ME', utc:+3},
  {name:'Wellington',    slug:'wellington',     lat:-41.3272,lon:174.8052,  country:'OC', utc:+12},
  {name:'Cape Town',     slug:'cape-town',      lat:-33.9648,lon:18.5979,   country:'AF', utc:+2},
  {name:'Toronto',       slug:'toronto',        lat:43.6772, lon:-79.6306,  country:'CA', utc:-4},
  {name:'Mexico City',   slug:'mexico-city',    lat:19.4363, lon:-99.0721,  country:'SA', utc:-5},
  {name:'Panama City',   slug:'panama-city',    lat:8.9714,  lon:-79.5355,  country:'SA', utc:-5},
  {name:'São Paulo',     slug:'sao-paulo',      lat:-23.4356,lon:-46.4731,  country:'SA', utc:-3},
  {name:'Buenos Aires',  slug:'buenos-aires',   lat:-34.8222,lon:-58.5358,  country:'SA', utc:-3},
];

const DAYS_BACK = 60;
const PM_GAMMA  = 'https://gamma-api.polymarket.com';

async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Day-1 forecast (temperature) ── */
async function getDay1Forecast(city, dateStr) {
  const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&daily=temperature_2m_max&past_days=90&forecast_days=1&timezone=auto`;
  const data = await fetchJson(url);
  if (!data?.daily) return null;
  const idx = (data.daily.time || []).indexOf(dateStr);
  if (idx === -1) return null;
  const tC = data.daily.temperature_2m_max?.[idx];
  if (tC == null) return null;
  return { tempC: Math.round(tC * 10) / 10, tempF: Math.round(tC * 9/5 + 32) };
}

/* ── Wind, cloud AND precipitation conditions at local noon ── */
async function getWindCloud(city, dateStr) {
  const url = `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&hourly=windspeed_10m,winddirection_10m,cloudcover,precipitation,precipitation_probability` +
    `&daily=precipitation_sum` +
    `&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;
  const data = await fetchJson(url);
  if (!data?.hourly) return null;

  const times  = data.hourly.time || [];
  const speeds = data.hourly.windspeed_10m || [];
  const dirs   = data.hourly.winddirection_10m || [];
  const clouds = data.hourly.cloudcover || [];
  const precip = data.hourly.precipitation || [];
  const precipProb = data.hourly.precipitation_probability || [];

  /* Values at local noon */
  const noonIdx = times.findIndex(t => t.endsWith('T12:00'));
  if (noonIdx === -1) return null;

  const windSpeed  = speeds[noonIdx];
  const windDir    = dirs[noonIdx];
  const cloudCover = clouds[noonIdx];
  const precipNoon = precip[noonIdx];        /* mm at noon hour */
  const precipProbNoon = precipProb[noonIdx]; /* % probability at noon */

  /* Total daily precipitation */
  const precipDaily = data.daily?.precipitation_sum?.[0] ?? null;

  if (windSpeed == null || windDir == null) return null;

  const compass = degToCompass(windDir);

  return {
    windSpeed:    Math.round(windSpeed * 10) / 10,
    windSpeedMph: Math.round(windSpeed * 0.621371 * 10) / 10,
    windDir, windCompass: compass,
    cloudCover:   Math.round(cloudCover || 0),
    precipNoon:   Math.round((precipNoon || 0) * 10) / 10,
    precipProb:   Math.round(precipProbNoon || 0),
    precipDaily:  precipDaily != null ? Math.round(precipDaily * 10) / 10 : null,
  };
}

function degToCompass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/* ── Resolved Polymarket market ── */
async function getResolvedMarket(city, dateStr) {
  const d     = new Date(dateStr + 'T12:00:00Z');
  const month = MONTHS_EN[d.getUTCMonth()];
  const day   = d.getUTCDate();
  const yyyy  = d.getUTCFullYear();
  const slug  = `highest-temperature-in-${city.slug}-on-${month}-${day}-${yyyy}`;
  const data  = await fetchJson(`${PM_GAMMA}/events?slug=${encodeURIComponent(slug)}`);
  if (!data) return null;
  const events = Array.isArray(data) ? data : [data];
  const event  = events.find(e => e.slug === slug) || (events.length === 1 ? events[0] : null);
  if (!event?.markets?.length) return null;
  const markets = event.markets;
  let winner = null;
  for (const m of markets) {
    try {
      const prices = JSON.parse(m.outcomePrices || '[]');
      if (parseFloat(prices[0]) >= 0.95) { winner = m; break; }
    } catch {}
  }
  if (!winner) return { slug, resolved: false, winnerQuestion: null,
    allQuestions: markets.map(m => m.question || '') };
  return { slug, resolved: true,
    winnerQuestion: winner.question || winner.groupItemTitle || null,
    allQuestions: markets.map(m => m.question || m.groupItemTitle || '') };
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

/* ── Compute wind/cloud correlations with forecast error ──
   Splits days into buckets by wind speed and cloud cover,
   then checks average bias direction in each bucket. */
function computeWindCloudCorrelations(rows) {
  const withWind = rows.filter(r => r.windSpeed != null && r.biasDir != null);
  if (withWind.length < 5) return null;

  /* Wind speed buckets: calm (<15 km/h), moderate (15-30), strong (>30) */
  const calm     = withWind.filter(r => r.windSpeed < 15);
  const moderate = withWind.filter(r => r.windSpeed >= 15 && r.windSpeed < 30);
  const strong   = withWind.filter(r => r.windSpeed >= 30);

  /* Precipitation buckets:
     dry = no rain (daily total 0mm)
     light = 0-5mm
     heavy = >5mm */
  const dry    = withWind.filter(r => (r.precipDaily ?? 0) === 0);
  const light  = withWind.filter(r => (r.precipDaily ?? 0) > 0 && (r.precipDaily ?? 0) <= 5);
  const heavy  = withWind.filter(r => (r.precipDaily ?? 0) > 5);

  /* Precip probability at noon buckets: low <20%, medium 20-50%, high >50% */
  const lowProb  = withWind.filter(r => (r.precipProb ?? 0) < 20);
  const medProb  = withWind.filter(r => (r.precipProb ?? 0) >= 20 && (r.precipProb ?? 0) < 50);
  const highProb = withWind.filter(r => (r.precipProb ?? 0) >= 50);
  const clear    = withWind.filter(r => r.cloudCover < 25);
  const partly   = withWind.filter(r => r.cloudCover >= 25 && r.cloudCover < 75);
  const overcast = withWind.filter(r => r.cloudCover >= 75);

  const avgBias = arr => arr.length
    ? Math.round(arr.reduce((s,r)=>s+r.biasDir,0)/arr.length * 10) / 10
    : null;

  /* Wind direction correlation — does wind from certain directions
     consistently cause forecast errors? */
  const byDir = {};
  for (const r of withWind) {
    const dir = r.windCompass;
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(r.biasDir);
  }
  const dirBias = {};
  for (const [dir, biases] of Object.entries(byDir)) {
    if (biases.length >= 3) {
      dirBias[dir] = {
        avgBias: Math.round(biases.reduce((s,b)=>s+b,0)/biases.length * 10)/10,
        count: biases.length,
      };
    }
  }

  /* Find most significant wind direction bias */
  let worstDir = null, worstBias = 0;
  for (const [dir, d] of Object.entries(dirBias)) {
    if (Math.abs(d.avgBias) > Math.abs(worstBias)) {
      worstBias = d.avgBias;
      worstDir  = dir;
    }
  }

  return {
    windSpeed: {
      calm:     { n: calm.length,     avgBias: avgBias(calm) },
      moderate: { n: moderate.length, avgBias: avgBias(moderate) },
      strong:   { n: strong.length,   avgBias: avgBias(strong) },
    },
    cloudCover: {
      clear:    { n: clear.length,    avgBias: avgBias(clear) },
      partly:   { n: partly.length,   avgBias: avgBias(partly) },
      overcast: { n: overcast.length, avgBias: avgBias(overcast) },
    },
    precipitation: {
      dry:    { n: dry.length,    avgBias: avgBias(dry) },
      light:  { n: light.length,  avgBias: avgBias(light) },
      heavy:  { n: heavy.length,  avgBias: avgBias(heavy) },
    },
    precipProbability: {
      low:    { n: lowProb.length,  avgBias: avgBias(lowProb) },
      medium: { n: medProb.length,  avgBias: avgBias(medProb) },
      high:   { n: highProb.length, avgBias: avgBias(highProb) },
    },
    windDirection: dirBias,
    strongestWindBias: worstDir ? {
      direction: worstDir,
      avgBias: worstBias,
      meaning: worstBias > 0.3
        ? `${worstDir} wind → forecast runs warm (+${worstBias} buckets)`
        : worstBias < -0.3
        ? `${worstDir} wind → forecast runs cold (${worstBias} buckets)`
        : 'no strong directional bias found',
    } : null,
  };
}

async function main() {
  console.log(`PM Scanner Backtest v5 — ${DAYS_BACK} days | ${CITIES.length} cities`);
  console.log(`Includes wind speed, direction, and cloud cover correlation\n`);

  const results = [];
  let totalResolved = 0, exactHits = 0, within1Hits = 0, noForecast = 0, noMarket = 0;

  for (const city of CITIES) {
    const cityRows = [];
    process.stdout.write(`${city.name.padEnd(16)} `);

    for (let daysAgo = DAYS_BACK; daysAgo >= 7; daysAgo--) {
      const cityNow  = new Date(Date.now() + city.utc * 3600 * 1000);
      const targetMs = cityNow.getTime() - daysAgo * 86400000;
      const dateStr  = new Date(targetMs).toISOString().slice(0,10);

      /* Fetch forecast, market, and wind/cloud in parallel */
      const [forecast, market, wind] = await Promise.all([
        getDay1Forecast(city, dateStr),
        getResolvedMarket(city, dateStr),
        getWindCloud(city, dateStr),
      ]);
      await sleep(150);

      if (!market?.resolved || !market.winnerQuestion) { noMarket++; continue; }
      totalResolved++;
      if (!forecast) { noForecast++; continue; }

      const winnerRng = parseTempRange(market.winnerQuestion);
      if (!winnerRng) continue;

      const allRanges = market.allQuestions.map(parseTempRange).filter(Boolean);
      allRanges.sort((a,b) => a.lo - b.lo);
      const wi = allRanges.findIndex(r => r.lo===winnerRng.lo && r.hi===winnerRng.hi);

      const nearby = [
        wi>0 ? allRanges[wi-1] : null,
        winnerRng,
        wi<allRanges.length-1 ? allRanges[wi+1] : null,
      ].filter(Boolean);
      const w1    = nearby.some(r => forecastInBucket(forecast.tempF, forecast.tempC, r));
      const exact = forecastInBucket(forecast.tempF, forecast.tempC, winnerRng);

      const forecastRng = allRanges.find(r => forecastInBucket(forecast.tempF, forecast.tempC, r));
      const forecastIdx = forecastRng ? allRanges.indexOf(forecastRng) : null;
      const bucketsOff  = forecastIdx != null && wi >= 0 ? Math.abs(forecastIdx - wi) : null;
      const biasDir     = forecastIdx != null && wi >= 0 ? forecastIdx - wi : null;

      if (exact) exactHits++;
      if (w1)    within1Hits++;

      cityRows.push({
        date: dateStr,
        forecastC: forecast.tempC, forecastF: forecast.tempF,
        winner: market.winnerQuestion,
        exact, w1, bucketsOff, biasDir,
        windSpeed:   wind?.windSpeed   ?? null,
        windDir:     wind?.windDir     ?? null,
        windCompass: wind?.windCompass ?? null,
        cloudCover:  wind?.cloudCover  ?? null,
        precipNoon:  wind?.precipNoon  ?? null,
        precipProb:  wind?.precipProb  ?? null,
        precipDaily: wind?.precipDaily ?? null,
      });
    }

    const n      = cityRows.length;
    const eh     = cityRows.filter(r=>r.exact).length;
    const w1h    = cityRows.filter(r=>r.w1).length;
    const validB = cityRows.filter(r=>r.bucketsOff!=null);
    const avgOff = validB.length ? validB.reduce((s,r)=>s+r.bucketsOff,0)/validB.length : 0;

    const validBias = cityRows.filter(r=>r.biasDir!=null);
    const netBias   = validBias.length
      ? validBias.reduce((s,r)=>s+r.biasDir,0)/validBias.length : 0;
    const biasShift = Math.round(netBias);
    const biasLabel = Math.abs(netBias) < 0.3 ? 'neutral'
      : netBias > 0 ? `runs warm (+${netBias.toFixed(1)} buckets)`
      : `runs cold (${netBias.toFixed(1)} buckets)`;

    /* Compute wind/cloud correlations */
    const windCloud = computeWindCloudCorrelations(cityRows);

    /* Print strongest finding if meaningful */
    const windNote = windCloud?.strongestWindBias?.avgBias != null &&
      Math.abs(windCloud.strongestWindBias.avgBias) >= 0.5
      ? ` | ${windCloud.strongestWindBias.meaning}`
      : '';
    console.log(`${n.toString().padStart(2)} days | exact ${eh}/${n} (${n?Math.round(eh/n*100):'-'}%) | ±1 ${w1h}/${n} (${n?Math.round(w1h/n*100):'-'}%) | ${biasLabel}${windNote}`);

    results.push({
      city: city.name,
      days: n,
      exactHits: eh,
      within1: w1h,
      exactPct: n ? Math.round(eh/n*100) : 0,
      within1Pct: n ? Math.round(w1h/n*100) : 0,
      avgBucketsOff: Math.round(avgOff*10)/10,
      netBias: Math.round(netBias*10)/10,
      biasShift,
      biasLabel,
      windCloudCorrelation: windCloud,
      detail: cityRows,
    });
  }

  const ep  = totalResolved ? Math.round(exactHits/totalResolved*100) : 0;
  const w1p = totalResolved ? Math.round(within1Hits/totalResolved*100) : 0;

  console.log(`\n${'='.repeat(65)}`);
  console.log(`TOTAL: ${totalResolved} resolved | exact: ${ep}% | ±1: ${w1p}%`);

  /* Highlight cities with strong wind direction bias */
  const strongWindBias = results
    .filter(r => r.windCloudCorrelation?.strongestWindBias &&
      Math.abs(r.windCloudCorrelation.strongestWindBias.avgBias) >= 0.5)
    .sort((a,b) =>
      Math.abs(b.windCloudCorrelation.strongestWindBias.avgBias) -
      Math.abs(a.windCloudCorrelation.strongestWindBias.avgBias));

  if (strongWindBias.length) {
    console.log(`\nStrongest wind direction correlations:`);
    strongWindBias.slice(0,10).forEach(r => {
      const wb = r.windCloudCorrelation.strongestWindBias;
      console.log(`  ${r.city.padEnd(16)} ${wb.meaning} (n=${r.windCloudCorrelation.windDirection[wb.direction]?.count})`);
    });
  }

  fs.writeFileSync(path.join(__dirname,'backtest-results.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    daysBack: DAYS_BACK,
    summary: { totalResolved, exactHits, within1Hits, exactPct:ep, within1Pct:w1p,
      noForecastData:noForecast, noMarketData:noMarket },
    cities: results,
  }, null, 2));
  console.log(`\nSaved → backtest-results.json`);
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1);});

