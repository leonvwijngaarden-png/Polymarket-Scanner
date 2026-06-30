#!/usr/bin/env node
/* ============================================================
   PM Scanner — Peak Hour Calibration Script
   Run this manually (or on a monthly schedule) to refresh the
   "typical hour of daily high" for every city using REAL hourly
   forecast data from Open-Meteo, rather than guessed values.

   It fetches a 5-day hourly forecast per city, finds the hour of
   peak temperature for each day, averages across days, and writes
   the result to peak-hours.json — which scan.js reads from instead
   of using hardcoded highH values.

   Usage: node calibrate-peak-hours.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const CITIES = [
  {name:'New York',      lat:40.7772,  lon:-73.8726,  utc:-4},
  {name:'Chicago',       lat:41.9742,  lon:-87.9073,  utc:-5},
  {name:'Miami',         lat:25.7587,  lon:-80.2870,  utc:-4},
  {name:'Dallas',        lat:32.8471,  lon:-96.8518,  utc:-5},
  {name:'Seattle',       lat:47.4502,  lon:-122.3088, utc:-7},
  {name:'Atlanta',       lat:33.6407,  lon:-84.4277,  utc:-4},
  {name:'Los Angeles',   lat:33.9425,  lon:-118.4081, utc:-7},
  {name:'Houston',       lat:29.6454,  lon:-95.2789,  utc:-5},
  {name:'Denver',        lat:39.7170,  lon:-104.7517, utc:-6},
  {name:'San Francisco', lat:37.6213,  lon:-122.3790, utc:-7},
  {name:'Austin',        lat:30.1975,  lon:-97.6664,  utc:-5},
  {name:'London',        lat:51.5033,  lon:0.0564,    utc:+1},
  {name:'Paris',         lat:49.0244,  lon:2.3567,    utc:+2},
  {name:'Amsterdam',     lat:52.3086,  lon:4.7639,    utc:+2},
  {name:'Madrid',        lat:40.4936,  lon:-3.5668,   utc:+2},
  {name:'Milan',         lat:45.6306,  lon:8.7231,    utc:+2},
  {name:'Munich',        lat:48.3537,  lon:11.7750,   utc:+2},
  {name:'Helsinki',      lat:60.3172,  lon:24.9633,   utc:+3},
  {name:'Warsaw',        lat:52.1657,  lon:20.9671,   utc:+2},
  {name:'Istanbul',      lat:41.2753,  lon:28.7519,   utc:+3},
  {name:'Ankara',        lat:40.1281,  lon:32.9951,   utc:+3},
  {name:'Moscow',        lat:55.5983,  lon:37.2615,   utc:+3},
  {name:'Tokyo',         lat:35.5533,  lon:139.7811,  utc:+9},
  {name:'Hong Kong',     lat:22.3020,  lon:114.1740,  utc:+8},
  {name:'Seoul',         lat:37.4602,  lon:126.4407,  utc:+9},
  {name:'Busan',         lat:35.1796,  lon:128.9382,  utc:+9},
  {name:'Singapore',     lat:1.3644,   lon:103.9915,  utc:+8},
  {name:'Shanghai',      lat:31.1443,  lon:121.8083,  utc:+8},
  {name:'Beijing',       lat:40.0799,  lon:116.5838,  utc:+8},
  {name:'Guangzhou',     lat:23.3924,  lon:113.2988,  utc:+8},
  {name:'Shenzhen',      lat:22.6395,  lon:113.8145,  utc:+8},
  {name:'Chengdu',       lat:30.5785,  lon:103.9471,  utc:+8},
  {name:'Chongqing',     lat:29.7192,  lon:106.6416,  utc:+8},
  {name:'Wuhan',         lat:30.7839,  lon:114.2081,  utc:+8},
  {name:'Qingdao',       lat:36.2661,  lon:120.3747,  utc:+8},
  {name:'Kuala Lumpur',  lat:2.7456,   lon:101.7072,  utc:+8},
  {name:'Manila',        lat:14.5086,  lon:121.0197,  utc:+8},
  {name:'Taipei',        lat:25.0697,  lon:121.5524,  utc:+8},
  {name:'Lucknow',       lat:26.7606,  lon:80.8893,   utc:+5.5},
  {name:'Karachi',       lat:24.8900,  lon:66.9389,   utc:+5},
  {name:'Jeddah',        lat:21.6796,  lon:39.1565,   utc:+3},
  {name:'Tel Aviv',      lat:32.0055,  lon:34.8854,   utc:+3},
  {name:'Wellington',    lat:-41.3272, lon:174.8052,  utc:+12},
  {name:'Cape Town',     lat:-33.9648, lon:18.5979,   utc:+2},
  {name:'Toronto',       lat:43.6772,  lon:-79.6306,  utc:-4},
  {name:'Mexico City',   lat:19.4363,  lon:-99.0721,  utc:-5},
  {name:'Panama City',   lat:8.9714,   lon:-79.5355,  utc:-5},
  {name:'São Paulo',     lat:-23.4356, lon:-46.4731,  utc:-3},
  {name:'Buenos Aires',  lat:-34.8222, lon:-58.5358,  utc:-3},
];

async function findPeakHour(city) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      `&hourly=temperature_2m&forecast_days=5&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json();
    const times = data.hourly?.time || [];
    const temps = data.hourly?.temperature_2m || [];

    const byDate = {};
    for (let i = 0; i < times.length; i++) {
      const date = times[i].slice(0, 10);
      const hour = parseInt(times[i].slice(11, 13));
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({ hour, temp: temps[i] });
    }

    const peakHours = [];
    for (const date in byDate) {
      const day = byDate[date];
      if (day.length < 20) continue; /* skip partial first/last day */
      const max = day.reduce((a, b) => (b.temp > a.temp ? b : a));
      peakHours.push(max.hour);
    }
    if (!peakHours.length) return null;

    /* Circular-safe average isn't needed here since peak hour is always
       daytime (roughly 11-18), no midnight wraparound to worry about. */
    const avg = peakHours.reduce((s, h) => s + h, 0) / peakHours.length;
    return { peakHourLocal: Math.round(avg), samples: peakHours };
  } catch (e) {
    console.warn(`  Failed for ${city.name}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`Calibrating peak temperature hour for ${CITIES.length} cities using live Open-Meteo data...\n`);
  const results = {};

  for (const city of CITIES) {
    const r = await findPeakHour(city);
    if (r) {
      results[city.name] = { highH: r.peakHourLocal, utc: city.utc, samples: r.samples };
      console.log(`${city.name.padEnd(16)} peak hour (local): ${r.peakHourLocal}:00  (samples: ${r.samples.join(',')})`);
    } else {
      console.log(`${city.name.padEnd(16)} FAILED — keeping previous value if any`);
    }
    /* Be polite to the free API — small delay between requests */
    await new Promise(res => setTimeout(res, 200));
  }

  const outPath = path.join(__dirname, 'peak-hours.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    cities: results,
  }, null, 2));

  console.log(`\nDone. Wrote ${Object.keys(results).length}/${CITIES.length} cities to peak-hours.json`);
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
