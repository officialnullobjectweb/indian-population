#!/usr/bin/env node
/* Clean the raw Census 2011 district CSV and report GeoJSON <-> CSV mismatches.
 *
 * Usage:
 *   node scripts/clean-data.js [rawCsv] [districtsGeojson] [outJson]
 *
 * Defaults (relative to the Indian-pupulation folder):
 *   rawCsv         india-districts-census-2011.csv  (falls back to public/data/districts.csv)
 *   districtsGeo   public/data/india-districts.geojson
 *   outJson        public/data/districts.json
 *
 * Cleaning:
 *   - trims every cell and collapses inner whitespace in names
 *   - keeps display case, adds `state_norm` / `district_norm` keys
 *     (lowercase, `&` -> `and`, punctuation stripped)
 *   - converts numeric-looking cells (incl. comma-grouped) to Number;
 *     `population` is guaranteed numeric (0 when missing)
 *
 * Report (stdout):
 *   - district shapes in the GeoJSON with NO row in the CSV
 *   - CSV rows with NO geometry in the GeoJSON
 *
 * NOTE: the normaliser + alias tables below intentionally mirror app.js.
 * Keep them in sync when either file changes.
 */
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const RAW_CANDIDATES = ["india-districts-census-2011.csv", "public/data/districts.csv"];
const rawArg = process.argv[2];
const geoArg = process.argv[3] || "public/data/india-districts.geojson";
const outArg = process.argv[4] || "public/data/districts.json";

function pickRaw() {
  if (rawArg) return rawArg;
  for (const c of RAW_CANDIDATES) {
    if (fs.existsSync(path.join(ROOT, c))) return c;
  }
  throw new Error("raw census CSV not found (tried " + RAW_CANDIDATES.join(", ") + ")");
}

/* ---------- tiny robust CSV parser (quotes, commas, newlines, BOM) ---------- */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = "", quoted = false, i = 0;
  const pushField = () => { row.push(field); field = ""; };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === ",") { pushField(); i++; continue; }
    if (ch === "\r" || ch === "\n") {
      pushField(); rows.push(row); row = [];
      if (ch === "\r" && text[i + 1] === "\n") i += 2; else i++;
      continue;
    }
    field += ch; i++;
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
  const header = rows.shift().map((h) => h.trim());
  return { header, rows };
}

/* ---------- normalisation (mirrors app.js normalizeName) ---------- */
function normalizeName(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tidyName(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}

// (mirrors CENSUS_STATE_ALIASES in app.js)
const CENSUS_STATE_ALIASES = {
  "odisha": "orissa",
  "uttarakhand": "uttarakhand",
  "puducherry": "pondicherry",
  "nct of delhi": "nct of delhi",
  "national capital territory of delhi": "nct of delhi",
  "delhi": "nct of delhi",
  "andaman and nicobar": "andaman and nicobar islands",
  "andaman and nicobar island": "andaman and nicobar islands",
  "arunanchal pradesh": "arunachal pradesh",
  "dadara and nagar havelli": "dadra and nagar haveli",
  "telangana": "andhra pradesh"
};
// (mirrors DISTRICT_ALIASES in app.js)
const DISTRICT_ALIASES = {
  "bengaluru": "bangalore",
  "bangalore urban": "bangalore",
  "gurugram": "gurgaon",
  "gurgaon": "gurgaon",
  "nicobar": "nicobars",
  "marigaon": "morigaon",
  "saran chhapra": "saran",
  "chamrajnagar": "chamarajanagar",
  "east nimar": "khandwa east nimar",
  "west nimar": "khargone west nimar",
  "garhchiroli": "gadchiroli",
  "ri bhoi": "ribhoi",
  "lawangtlai": "lawngtlai",
  "bauda": "baudh",
  "nagappattinam": "nagapattinam",
  "virudunagar": "virudhunagar",
  "kansiram nagar": "kanshiram nagar",
  "maharajganj": "mahrajganj",
  "sant ravi das nagar bhadohi": "sant ravidas nagar bhadohi",
  "siddharth nagar": "siddharthnagar",
  "north parganas": "north twenty four parganas",
  "north 24 parganas": "north twenty four parganas",
  "south parganas": "south twenty four parganas",
  "south 24 parganas": "south twenty four parganas",
  "pashchim medinipur": "paschim medinipur",
  "sikkim|east": "east district",
  "sikkim|west": "west district",
  "sikkim|north": "north district",
  "sikkim|south": "south district",
  "pondicherry|puducherry": "pondicherry"
};

function toNumber(v) {
  if (typeof v === "number") return v;
  const t = String(v == null ? "" : v).replace(/[, ]/g, "").trim();
  if (t === "" || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/* ---------- main ---------- */
function main() {
  const rawRel = pickRaw();
  const raw = fs.readFileSync(path.join(ROOT, rawRel), "utf8");
  const { header, rows } = parseCSV(raw);

  const si = header.findIndex((h) => normalizeName(h) === "state name" || h === "state");
  const di = header.findIndex((h) => normalizeName(h) === "district name" || h === "district");
  const pi = header.findIndex((h) => normalizeName(h) === "population");
  if (si < 0 || di < 0 || pi < 0) {
    throw new Error("expected state/district/population columns, got: " + header.slice(0, 8).join(" | "));
  }

  const districts = rows
    .filter((r) => r.length >= header.length && r.slice(0, 3).join("").trim() !== "")
    .map((r) => {
      const obj = {};
      header.forEach((h, idx) => {
        const rawCell = r[idx] == null ? "" : r[idx];
        const n = toNumber(rawCell);
        obj[h] = n == null ? String(rawCell).trim() : n;
      });
      const state = tidyName(obj[header[si]]);
      const district = tidyName(obj[header[di]]);
      obj.state = state;
      obj.district = district;
      obj.population = toNumber(obj[header[pi]]) || 0;
      obj.state_norm = normalizeName(state);
      obj.district_norm = normalizeName(district);
      return obj;
    });

  const out = {
    meta: {
      generated: new Date().toISOString(),
      source: rawRel,
      rows: districts.length,
      columns: header.length,
      note: "Census 2011 district data. populations are numbers; state_norm/district_norm are normalised match keys."
    },
    columns: header,
    districts
  };
  const outPath = path.join(ROOT, outArg);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));

  // ---- mismatch report: GeoJSON vs CSV ----
  const geo = JSON.parse(fs.readFileSync(path.join(ROOT, geoArg), "utf8"));
  const censusStates = new Set(districts.map((d) => d.state_norm));
  const csvKeys = new Set(districts.map((d) => d.state_norm + "|" + d.district_norm));
  const resState = (n) => {
    if (censusStates.has(n)) return n;
    const a = CENSUS_STATE_ALIASES[n];
    return a && censusStates.has(a) ? a : null;
  };
  const resDist = (s, d) => DISTRICT_ALIASES[s + "|" + d] || DISTRICT_ALIASES[d] || d;

  const geoOnly = [];
  const usedCsv = new Set();
  for (const f of geo.features) {
    const p = f.properties || {};
    const gs = normalizeName(p.state);
    const gd = normalizeName(p.district);
    const cs = resState(gs);
    const key = cs ? cs + "|" + resDist(cs, gd) : null;
    if (key && csvKeys.has(key)) {
      usedCsv.add(key);
    } else {
      geoOnly.push(`${p.state || "?"} / ${p.district || "?"}`);
    }
  }
  const csvOnly = districts
    .filter((d) => !usedCsv.has(d.state_norm + "|" + d.district_norm))
    .map((d) => `${d.state} / ${d.district} (${d.population.toLocaleString("en-IN")})`);

  // ---- print ----
  console.log("clean-data: read %d rows x %d cols from %s", rows.length, header.length, rawRel);
  console.log("clean-data: wrote %d districts -> %s", districts.length, outArg);
  console.log("clean-data: geo shapes=%d csv rows=%d matched=%d",
    geo.features.length, districts.length, usedCsv.size);
  console.log("");
  console.log("IN GEOJSON BUT NOT IN CSV (%d):", geoOnly.length);
  geoOnly.sort().forEach((s) => console.log("  - " + s));
  console.log("");
  console.log("IN CSV BUT NOT IN GEOJSON (%d):", csvOnly.length);
  const byState = {};
  csvOnly.forEach((s) => {
    const st = s.split(" / ")[0];
    (byState[st] = byState[st] || []).push(s);
  });
  Object.keys(byState).sort().forEach((st) => {
    console.log("  [%s] (%d): %s", st, byState[st].length,
      byState[st].map((s) => s.split(" / ")[1]).join(", "));
  });
}

main();
