/* Interactive map of India — Census 2011, state + district drill-down.
 * Plain JS + local d3 (no CDN). Loads LOCAL files only:
 *   public/data/india-states.geojson
 *   public/data/india-districts.geojson   (boundaries: DataMeet, CC BY 4.0)
 *   src/data/states.json                  [{ state, population }]
 *   public/data/districts.csv             [state, district, population + 115 more Census columns]
 */
(function () {
  "use strict";

  var STATE_GEO_URL = "./public/data/india-states.geojson";
  var DIST_GEO_URL = "./public/data/india-districts.geojson";
  var STATE_DATA_URL = "./src/data/states.json";
  var DIST_DATA_URL = "./src/data/districts.json"; // built by scripts/clean-data.js

  var holder = document.getElementById("map-holder");
  var tooltip = document.getElementById("tooltip");
  var statusEl = document.getElementById("status");
  var legendEl = document.getElementById("legend");
  var legendMin = document.getElementById("legend-min");
  var legendMax = document.getElementById("legend-max");
  var unmatchedBox = document.getElementById("unmatched");
  var unmatchedText = document.getElementById("unmatched-text");
  var backBtn = document.getElementById("back-btn");
  var crumb = document.getElementById("crumb");  var metricWrap = document.getElementById("metric-wrap");
  var metricBtn = document.getElementById("metric-btn");
  var metricBtnText = document.getElementById("metric-btn-text");
  var metricList = document.getElementById("metric-list");
  var themeBtn = document.getElementById("theme-btn");
  var themeIconMoon = document.getElementById("theme-icon-moon");
  var themeIconSun = document.getElementById("theme-icon-sun");
  var panel = document.getElementById("district-panel");
  var dpTitle = document.getElementById("dp-title");
  var dpSub = document.getElementById("dp-sub");
  var dpStats = document.getElementById("dp-stats");
  var dpTable = document.querySelector("#dp-table tbody");

  var WIDTH = 960;
  var HEIGHT = 1000;
  // Light-to-dark blue scale (ColorBrewer Blues, light end lifted so the
  // smallest values still read on a white card — no more white-on-white).
  var COLORS = ["#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"];
  var NO_DATA = "#9aa7b4";
  var NO_DATA_LABEL = "Data not available";

  /* ---------- name normalisation ---------- */
  function normalizeName(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // State aliases, normalised.
  // (a) state-geo vintage name -> states.json key (modern names).
  var STATE_FILE_ALIASES = {
    "orissa": "odisha",
    "uttaranchal": "uttarakhand",
    "andaman and nicobar": "andaman and nicobar islands",
    "dadra and nagar haveli": "dadra and nagar haveli and daman and diu",
    "daman and diu": "dadra and nagar haveli and daman and diu",
    "nct of delhi": "delhi",
    "national capital territory of delhi": "delhi"
  };
  // (b) any state name -> districts.csv key (2011 census names).
  var CENSUS_STATE_ALIASES = {
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
    "telangana": "andhra pradesh" // 2011 boundaries pre-date the split
  };

  // District aliases: "state|district" (scoped) or bare "district" (global),
  // normalised geo name -> normalised census name. Includes requested
  // bangalore/bengaluru + gurgaon/gurugram pairs plus vintage spellings.
  var DISTRICT_ALIASES = {
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
    // scoped: Sikkim geo uses bare directions; Delhi also has East/West/…
    "sikkim|east": "east district",
    "sikkim|west": "west district",
    "sikkim|north": "north district",
    "sikkim|south": "south district",
    // scoped: census district is literally PONDICHERRY
    "pondicherry|puducherry": "pondicherry"
  };

  function resolveStateFileName(norm, lookup) {
    if (lookup.has(norm)) return norm;
    var a = STATE_FILE_ALIASES[norm];
    if (a && lookup.has(a)) return a;
    return null;
  }

  // -> array of districts.csv state keys (usually one; two for the combined UT).
  function censusKeysForStateFileName(norm) {
    if (norm === "dadra and nagar haveli and daman and diu") {
      return ["dadra and nagar haveli", "daman and diu"];
    }
    if (norm === "ladakh") return []; // 2011 districts sit under J&K
    if (S.censusStates.has(norm)) return [norm];
    var a = CENSUS_STATE_ALIASES[norm];
    if (a && S.censusStates.has(a)) return [a];
    return [];
  }

  function resolveCensusStateName(norm) {
    if (S.censusStates.has(norm)) return norm;
    var a = CENSUS_STATE_ALIASES[norm];
    if (a && S.censusStates.has(a)) return a;
    return null;
  }

  function resolveDistrictName(stateNorm, distNorm) {
    var scoped = DISTRICT_ALIASES[stateNorm + "|" + distNorm];
    if (scoped) return scoped;
    return DISTRICT_ALIASES[distNorm] || distNorm;
  }

  /* ---------- Indian number formatting ---------- */
  function formatIndian(n) {
    n = Number(n) || 0;
    var grouped = n.toLocaleString("en-IN");
    var label;
    if (n >= 10000000) label = (n / 10000000).toFixed(2) + " crores";
    else if (n >= 100000) label = (n / 100000).toFixed(2) + " lakhs";
    else label = grouped;
    return { grouped: grouped, label: label };
  }
  function formatShort(n) {
    n = Number(n) || 0;
    if (n >= 10000000) return (n / 10000000).toFixed(1).replace(/\.0$/, "") + " cr";
    if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, "") + " L";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(Math.round(n));
  }
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function pct(a, b) {
    a = num(a); b = num(b);
    return b > 0 ? (100 * a) / b : 0;
  }

  /* ---------- district colour metrics (uses many CSV columns) ---------- */
  var METRICS = {
    population: {
      label: "Population",
      value: function (r) { return num(r.population); },
      format: function (v) { var f = formatIndian(v); return f.grouped + " (" + f.label + ")"; },
      short: formatShort
    },
    literacy_rate: {
      label: "Literacy rate",
      value: function (r) { return pct(r.Literate, r.population); },
      format: function (v) { return v.toFixed(1) + "% literate"; },
      short: function (v) { return v.toFixed(0) + "%"; }
    },
    sex_ratio: {
      label: "Sex ratio",
      value: function (r) { return num(r.Male) > 0 ? (1000 * num(r.Female)) / num(r.Male) : 0; },
      format: function (v) { return Math.round(v) + " females per 1000 males"; },
      short: function (v) { return String(Math.round(v)); }
    },
    electricity_pct: {
      label: "Households with electricity",
      // NOTE: source header has the typo "Housholds_…" — kept verbatim.
      value: function (r) { return pct(r.Housholds_with_Electric_Lighting, r.Households); },
      format: function (v) { return v.toFixed(1) + "% households electrified"; },
      short: function (v) { return v.toFixed(0) + "%"; }
    }
  };

  /* ---------- zoom: wheel / pinch / drag-pan / double-click + click-to-drill ---------- */
  var PAD = 24; // breathing room so edges (incl. the far north) never touch the frame
  var downXY = null; // pointerdown pos, to tell a click apart from a pan-drag
  function wasDrag(e) {
    if (!downXY || e.clientX == null) { downXY = null; return false; }
    var moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
    downXY = null;
    return moved > 6;
  }

  function zoomBehavior() {
    if (!S.zoom) {
      S.zoom = d3.zoom()
        .scaleExtent([1, 20])
        // Plain wheel scrolls the PAGE (never hijacked); only Ctrl/Cmd+wheel
        // (including trackpad pinch) zooms the map. Drag/pinch pan only when
        // already zoomed in, so the fit view stays perfectly locked.
        // Dblclick zoom always stays live.
        .filter(function (e) {
          if (e.type === "wheel") return e.ctrlKey || e.metaKey;
          if (e.type === "dblclick") return true;
          return currentK() > 1.01;
        })
        .on("zoom", function (e) {
          if (S.g) S.g.attr("transform", e.transform);
        });
    }
    return S.zoom;
  }

  function currentK() {
    try {
      if (S.svg) return d3.zoomTransform(S.svg.node()).k;
    } catch (e) { /* fresh svg */ }
    return 1;
  }

  function attachZoom(svg, g) {
    S.svg = svg;
    S.g = g;
    svg.on("pointerdown.zoomclick", function (e) { downXY = [e.clientX, e.clientY]; });
    svg.on("click.zoomback", function (e) {
      if (e.target !== svg.node() || wasDrag(e)) return;
      // background click zooms back out one level
      if (S.view.name === "district" && S.view.district) unfocusDistrict(true);
    });
    svg.call(zoomBehavior()); // wheel + pinch + drag-pan + double-click zoom
    svg.call(zoomBehavior().transform, d3.zoomIdentity);
    // one finger scrolls the page on touch screens; drag sideways / pinch to move the map
    svg.style("touch-action", "pan-y");
  }

  function fitProjection(obj) {
    return d3.geoMercator().fitExtent([[PAD, PAD], [WIDTH - PAD, HEIGHT - PAD]], obj);
  }

  // Zoom the current view so `obj` (FeatureCollection or Feature) fills the frame.
  function fitObj(obj, animate) {
    if (!S.svg || !S.path || !obj) return;
    var b, feats = obj.features || [obj];
    if (!feats.length) return;
    b = S.path.bounds(obj);
    var dx = Math.max(1e-6, b[1][0] - b[0][0]);
    var dy = Math.max(1e-6, b[1][1] - b[0][1]);
    var k = Math.min(10, 0.88 / Math.max(dx / WIDTH, dy / HEIGHT));
    var cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
    var t = d3.zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(k).translate(-cx, -cy);
    (animate ? S.svg.transition().duration(600) : S.svg).call(zoomBehavior().transform, t);
  }

  function fitLevel(animate) {
    if (S.view.name === "india") fitObj(S.stateGeo, animate);
    else if (S.view.district) fitObj(S.view.district.feature, animate);
    else fitObj(S.view.fc, animate);
  }

  function setBack() {
    if (S.view.name === "india") {
      backBtn.hidden = true;
      crumb.textContent = "India";
    } else if (S.view.district) {
      backBtn.hidden = false;
      backBtn.textContent = "← Back to " + S.view.label;
      crumb.textContent = "India / " + S.view.label + " / " + S.view.district.name;
    } else {
      backBtn.hidden = false;
      backBtn.textContent = "← Back to India";
      crumb.textContent = "India / " + S.view.label;
    }
  }

  function focusDistrict(feature, name, row, animate, scroll) {
    S.view.district = { feature: feature, name: name };
    if (S.g) {
      S.g.classed("dimmed", true);
      S.g.selectAll("path").classed("focused", function (d) { return d === feature; });
    }
    setBack();
    fitObj(feature, animate);
    if (row) showDistrictPanel(row);
    // on small screens the data panel sits below the map — bring it into view on tap
    if (scroll && window.innerWidth <= 860 && panel && !panel.hidden) {
      dpTitle.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function unfocusDistrict(animate) {
    if (!S.view.district) return;
    S.view.district = null;
    if (S.g) S.g.selectAll("path").classed("focused", false);
    if (S.g) S.g.classed("dimmed", false);
    setBack();
    fitObj(S.view.fc, animate);
  }

  /* ---------- tooltip ---------- */
  function showTooltip(evt, title, lines) {
    tooltip.innerHTML = "";
    var s = document.createElement("strong");
    s.textContent = title;
    tooltip.appendChild(s);
    lines.forEach(function (t) {
      var d = document.createElement("div");
      d.textContent = t;
      tooltip.appendChild(d);
    });
    tooltip.hidden = false;
    moveTooltip(evt);
  }
  function moveTooltip(evt) {
    var r = holder.getBoundingClientRect();
    var x = (evt.clientX != null ? evt.clientX : r.left + r.width / 2) - r.left;
    var y = (evt.clientY != null ? evt.clientY : r.top + 100) - r.top;
    x = Math.max(90, Math.min(r.width - 90, x));
    y = Math.max(70, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }
  function hideTooltip() { tooltip.hidden = true; }

  /* ---------- state ---------- */
  var S = {
    stateGeo: null, stateRows: null, stateLookup: new Map(),
    distGeo: null, distRows: null,
    distLookup: new Map(), // "censusStateNorm|censusDistNorm" -> row
    censusStates: new Set(),
    view: { name: "india" },
    metric: "population"
  };

  function loadJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + url + " (" + res.status + ")");
      return res.json();
    });
  }
  Promise.all([loadJSON(STATE_GEO_URL), loadJSON(STATE_DATA_URL), loadJSON(DIST_GEO_URL), loadJSON(DIST_DATA_URL)])
    .then(function (parts) {
      S.stateGeo = parts[0];
      S.stateRows = parts[1];
      S.distGeo = parts[2];
      // districts.json is { meta, columns, districts }; accept a bare array too.
      S.distRows = parts[3].districts || parts[3];
      S.stateRows.forEach(function (r) { S.stateLookup.set(normalizeName(r.state), r); });
      S.distRows.forEach(function (r) {
        var sk = r.state_norm || normalizeName(r.state), dk = r.district_norm || normalizeName(r.district);
        S.censusStates.add(sk);
        S.distLookup.set(sk + "|" + dk, r);
      });
      logUnmatchedDistricts();
      renderIndia();
      var totalPop = S.stateRows.reduce(function (a, r) { return a + num(r.population); }, 0);
      var tf = formatIndian(totalPop);
      document.getElementById("stat-pop").textContent = tf.grouped + " (" + tf.label + ")";
      document.getElementById("stat-states").textContent = String(S.stateRows.length);
      document.getElementById("stat-districts").textContent = String(S.distRows.length);
      statusEl.textContent = S.stateRows.length + " states/UTs · " + S.distRows.length + " districts · Source: Census 2011 — click a state to zoom in";
    })
    .catch(function (err) {
      statusEl.textContent = "Could not load local data. Serve this folder over http so ./public/data and ./src/data resolve. (" + err.message + ")";
    });

  // Log every district geometry name that has no census row, so the alias table can be fixed.
  function logUnmatchedDistricts() {
    var missing = [];
    var perState = {};
    S.distGeo.features.forEach(function (f) {
      var p = f.properties || {};
      var gs = normalizeName(p.state);
      var gd = normalizeName(p.district);
      var cs = resolveCensusStateName(gs);
      var row = null;
      if (cs) row = S.distLookup.get(cs + "|" + resolveDistrictName(cs, gd));
      if (!row) {
        var label = (p.state || "?") + " / " + (p.district || "?");
        missing.push(label);
        (perState[p.state || "?"] = perState[p.state || "?"] || []).push(p.district || "?");
      }
    });
    if (missing.length) {
      console.warn("[map] unmatched district geometries (no census row — add to DISTRICT_ALIASES):", missing);
      Object.keys(perState).sort().forEach(function (st) {
        console.warn("[map] unmatched in " + st + ":", perState[st].join(", "));
      });
    } else {
      console.log("[map] all district geometries matched a census row.");
    }
  }

  function drawLegend(lo, hi, fmtShort) {
    legendEl.innerHTML = "";
    COLORS.forEach(function (c) {
      var s = document.createElement("span");
      s.style.background = c;
      legendEl.appendChild(s);
    });
    legendMin.textContent = fmtShort(lo);
    legendMax.textContent = fmtShort(hi);
  }

  function stateFeatureName(props) {
    return props.st_name || props.NAME_1 || props.name || props.ST_NM || "Unknown";
  }

  /* ---------- INDIA view ---------- */
  function renderIndia() {
    S.view = { name: "india" };
    S.view.district = null;
    metricWrap.hidden = true;
    panel.hidden = true;
    hideTooltip();
    statusEl.textContent = S.stateRows.length + " states/UTs · " + S.distRows.length + " districts · Source: Census 2011 — click a state to zoom in";

    var pops = S.stateRows.map(function (r) { return num(r.population); });
    var color = d3.scaleQuantize().domain([d3.min(pops), d3.max(pops)]).range(COLORS);

    d3.select(holder).select("svg").remove();
    var svg = d3.select(holder).insert("svg", "#tooltip")
      .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
      .attr("role", "img")
      .attr("aria-label", "Choropleth map of India by Census 2011 population. Activate a state to see its districts.");
    var path = d3.geoPath(fitProjection(S.stateGeo));
    S.path = path;
    var g = svg.append("g");
    attachZoom(svg, g);
    setBack();

    var used = new Set();
    var missingStates = [];
    g.selectAll("path").data(S.stateGeo.features).join("path")
      .attr("class", "state")
      .attr("d", path)
      .attr("tabindex", "0");
    bindIndia(g, path, color, used, missingStates);
    fitLevel(false);
    drawLegend(d3.min(pops), d3.max(pops), function (v) {
      var f = formatIndian(v); return formatShort(v) + " (" + f.label + ")";
    });
    var noGeom = S.stateRows.filter(function (r) { return !used.has(normalizeName(r.state)); });
    var notes = [];
    if (missingStates.length) notes.push("No data matched for: " + missingStates.join(", ") + ".");
    if (noGeom.length) notes.push("No separate geometry for: " + noGeom.map(function (r) { return r.state; }).join(", ") + " (2011 boundaries pre-date Telangana/Ladakh splits).");
    if (notes.length) { unmatchedBox.hidden = false; unmatchedText.textContent = notes.join(" "); }
    else unmatchedBox.hidden = true;
  }

  // Separate binding fn so geo->data uses the state file lookup (not census states).
  function bindIndia(svg, path, color, used, missingStates) {
    var lookup = S.stateLookup;
    function keyOf(d) {
      return resolveStateFileName(normalizeName(stateFeatureName(d.properties || {})), lookup);
    }
    svg.selectAll("path")
      .attr("fill", function (d) {
        var k = keyOf(d);
        if (k) { used.add(k); return color(num(lookup.get(k).population)); }
        missingStates.push(stateFeatureName(d.properties || {}));
        return NO_DATA;
      })
      .attr("aria-label", function (d) {
        var k = keyOf(d);
        if (k) {
          var rec = lookup.get(k), f = formatIndian(rec.population);
          return rec.state + ", population " + f.grouped + " (" + f.label + "). Activate to see districts.";
        }
        return stateFeatureName(d.properties || {}) + ", no data";
      })
      .on("mousemove", function (evt, d) {
        d3.select(this).classed("active", true);
        var k = keyOf(d);
        if (k) {
          var rec = lookup.get(k), f = formatIndian(rec.population);
          showTooltip(evt, rec.state, [(f.label === f.grouped ? f.grouped : f.grouped + " (" + f.label + ")"), "Click to see districts · Census 2011"]);
        } else showTooltip(evt, stateFeatureName(d.properties || {}), [NO_DATA_LABEL]);
      })
      .on("mouseleave", function () { d3.select(this).classed("active", false); hideTooltip(); })
      .on("focus", function (evt, d) {
        d3.select(this).classed("active", true);
        var k = keyOf(d);
        if (k) {
          var rec = lookup.get(k), f = formatIndian(rec.population);
          showTooltip(evt, rec.state, [f.grouped + " (" + f.label + ")", "Enter to see districts · Census 2011"]);
        } else showTooltip(evt, stateFeatureName(d.properties || {}), [NO_DATA_LABEL]);
      })
      .on("blur", function () { d3.select(this).classed("active", false); hideTooltip(); })
      .on("click", function (evt, d) {
        if (wasDrag(evt)) return;
        var k = keyOf(d);
        if (k) drillDown(lookup.get(k));
      })
      .on("keydown", function (evt, d) {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          var k = keyOf(d);
          if (k) drillDown(lookup.get(k));
        }
      });
  }

  /* ---------- DISTRICT view ---------- */
  function drillDown(stateRec) {
    // Map the clicked state file entry -> districts.csv state key(s).
    var keys = censusKeysForStateFileName(normalizeName(stateRec.state));
    if (!keys.length) {
      // e.g. Telangana / Ladakh have no 2011-vintage district geometry.
      statusEl.textContent = "No 2011-vintage district geometry for " + stateRec.state + " · Source: Census 2011";
      return;
    }
    S.view = { name: "district", censusKeys: keys, label: stateRec.state, district: null, fc: null };
    metricWrap.hidden = false;
    panel.hidden = false;
    hideTooltip();
    renderDistricts();
    // on small screens the data panel sits below the map — bring it into view
    if (window.innerWidth <= 860) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function districtRowFor(props) {
    var gs = normalizeName(props.state);
    var gd = normalizeName(props.district);
    var cs = resolveCensusStateName(gs);
    if (!cs) return null;
    return S.distLookup.get(cs + "|" + resolveDistrictName(cs, gd)) || null;
  }

  function districtCensusKey(props) {
    return resolveCensusStateName(normalizeName(props.state));
  }

  function renderDistricts() {
    var st = S.view;
    var feats = S.distGeo.features.filter(function (f) {
      var ck = districtCensusKey(f.properties || {});
      return ck && st.censusKeys.indexOf(ck) !== -1;
    });
    var fc = { type: "FeatureCollection", features: feats };
    st.fc = fc;
    var m = METRICS[S.metric];

    var vals = feats.map(function (f) { var r = districtRowFor(f.properties || {}); return r ? m.value(r) : null; })
      .filter(function (v) { return v != null; });
    var lo = vals.length ? d3.min(vals) : 0, hi = vals.length ? d3.max(vals) : 1;
    if (lo === hi) hi = lo + 1;
    var color = d3.scaleQuantize().domain([lo, hi]).range(COLORS);

    d3.select(holder).select("svg").remove();
    var svg = d3.select(holder).insert("svg", "#tooltip")
      .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
      .attr("role", "img")
      .attr("aria-label", "Districts of " + st.label + " coloured by " + m.label + ", Census 2011. Activate a district to zoom in, Back to zoom out.");
    var path = d3.geoPath(fitProjection(feats.length ? fc : S.stateGeo));
    S.path = path;
    var g = svg.append("g");
    attachZoom(svg, g);
    setBack();

    var matched = 0, missing = [];
    g.selectAll("path").data(feats).join("path")
      .attr("class", "state")
      .attr("d", path)
      .attr("tabindex", "0")
      .attr("fill", function (d) {
        var r = districtRowFor(d.properties || {});
        if (r) { matched++; return color(m.value(r)); }
        missing.push(((d.properties || {}).district) || "?");
        return NO_DATA;
      })
      .attr("aria-label", function (d) {
        var p = d.properties || {}, r = districtRowFor(p);
        if (r) return p.district + ", " + m.label + " " + m.format(m.value(r)) + ", Census 2011";
        return (p.district || "Unknown") + ", " + NO_DATA_LABEL;
      })
      .on("mousemove", function (evt, d) {
        d3.select(this).classed("active", true);
        var p = d.properties || {}, r = districtRowFor(p);
        if (r) {
          var f = formatIndian(r.population);
          showTooltip(evt, p.district, [
            (f.label === f.grouped ? f.grouped : f.grouped + " (" + f.label + ")"),
            m.label + ": " + m.format(m.value(r)),
            "Census 2011"
          ]);
          showDistrictPanel(r);
        } else showTooltip(evt, p.district || "Unknown", [NO_DATA_LABEL]);
      })
      .on("mouseleave", function () { d3.select(this).classed("active", false); hideTooltip(); })
      .on("focus", function (evt, d) {
        d3.select(this).classed("active", true);
        var p = d.properties || {}, r = districtRowFor(p);
        if (r) { showDistrictPanel(r); showTooltip(evt, p.district, [formatIndian(r.population).grouped, "Census 2011"]); }
        else showTooltip(evt, p.district || "Unknown", [NO_DATA_LABEL]);
      })
      .on("blur", function () { d3.select(this).classed("active", false); hideTooltip(); })
      .on("click", function (evt, d) {
        if (wasDrag(evt)) return;
        var p = d.properties || {}, r = districtRowFor(p);
        if (!r) return;
        // toggle: same district zooms back out, another district zooms to it
        if (st.district && st.district.feature === d) unfocusDistrict(true);
        else focusDistrict(d, p.district || "Unknown", r, true, true);
      })
      .on("keydown", function (evt, d) {
        if (evt.key !== "Enter" && evt.key !== " ") return;
        evt.preventDefault();
        var p = d.properties || {}, r = districtRowFor(p);
        if (!r) return;
        if (st.district && st.district.feature === d) unfocusDistrict(true);
        else focusDistrict(d, p.district || "Unknown", r, true, true);
      });

    drawLegend(lo, hi, m.short);
    statusEl.textContent = st.label + ": " + feats.length + " district shapes · " + matched + " matched · " + missing.length + " without data · Source: Census 2011 — click a district to zoom in";
    if (missing.length) console.warn("[map] unmatched in " + st.label + " (" + st.censusKeys.join(" + ") + "):", missing.join(", "));
    if (st.district && feats.indexOf(st.district.feature) !== -1) {
      // keep the focused district across re-renders (e.g. metric change)
      g.classed("dimmed", true);
      g.selectAll("path").classed("focused", function (d) { return d === st.district.feature; });
      setBack();
      fitLevel(false);
      var refocused = districtRowFor(st.district.feature.properties || {});
      if (refocused) showDistrictPanel(refocused);
    } else {
      st.district = null;
      setBack();
      fitLevel(false);
      // auto-show the largest district in the panel
      var top = null;
      feats.forEach(function (f) {
        var r = districtRowFor(f.properties || {});
        if (r && (!top || num(r.population) > num(top.population))) top = r;
      });
      if (top) showDistrictPanel(top);
    }
  }

  backBtn.addEventListener("click", function () {
    if (S.view.name === "district" && S.view.district) unfocusDistrict(true);
    else renderIndia();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || S.view.name === "india") return;
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (S.view.district) unfocusDistrict(true);
    else renderIndia();
  });
  /* ---------- custom metric dropdown (button + listbox) ---------- */
  function setMetric(value) {
    if (!METRICS[value] || S.metric === value) { closeMetricMenu(); return; }
    S.metric = value;
    var opts = metricList.querySelectorAll('[role="option"]');
    opts.forEach(function (li) {
      var on = li.getAttribute("data-value") === value;
      li.setAttribute("aria-selected", on ? "true" : "false");
      li.classList.toggle("selected", on);
      if (on) metricBtnText.textContent = li.firstChild.textContent;
    });
    closeMetricMenu();
    if (S.view.name === "district") renderDistricts();
  }
  function openMetricMenu() {
    metricList.hidden = false;
    metricBtn.setAttribute("aria-expanded", "true");
    document.getElementById("metric-dd").classList.add("open");
  }
  function closeMetricMenu() {
    if (metricList.hidden) return;
    metricList.hidden = true;
    metricBtn.setAttribute("aria-expanded", "false");
    document.getElementById("metric-dd").classList.remove("open");
  }
  metricBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (metricList.hidden) openMetricMenu();
    else closeMetricMenu();
  });
  metricList.addEventListener("click", function (e) {
    var li = e.target.closest('[role="option"]');
    if (li) setMetric(li.getAttribute("data-value"));
  });
  metricList.addEventListener("keydown", function (e) {
    var opts = Array.from(metricList.querySelectorAll('[role="option"]'));
    var i = opts.indexOf(document.activeElement);
    if (e.key === "Escape") { closeMetricMenu(); metricBtn.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
    else if ((e.key === "Enter" || e.key === " ") && i >= 0) {
      e.preventDefault();
      setMetric(opts[i].getAttribute("data-value"));
      metricBtn.focus();
    }
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#metric-dd")) closeMetricMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMetricMenu();
  });

  /* ---------- light / dark theme for the entire site ---------- */
  function siteTheme() {
    return document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function applyTheme(t) {
    var dark = t === "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("india-map-theme", t); } catch (e) { /* private mode */ }
    themeIconMoon.hidden = dark; // in dark mode offer the sun (switch to light)
    themeIconSun.hidden = !dark;
    themeBtn.setAttribute("aria-pressed", dark ? "true" : "false");
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("india-map-theme"); } catch (e) { /* private mode */ }
    applyTheme(saved === "dark" || saved === "light" ? saved : siteTheme());
  })();
  themeBtn.addEventListener("click", function () {
    applyTheme(siteTheme() === "dark" ? "light" : "dark");
  });
  // Never let a stale tooltip float over content while the page scrolls.
  window.addEventListener("scroll", hideTooltip, { passive: true });
  holder.addEventListener("touchmove", hideTooltip, { passive: true });

  /* ---------- district details panel (uses ALL csv columns) ---------- */
  var EDU_COLS = ["Below_Primary_Education", "Primary_Education", "Middle_Education", "Secondary_Education", "Higher_Education", "Graduate_Education"];
  var AGE_COLS = ["Age_Group_0_29", "Age_Group_30_49", "Age_Group_50"];
  var RELIGION_COLS = ["Hindus", "Muslims", "Christians", "Sikhs", "Buddhists", "Jains", "Others_Religions", "Religion_Not_Stated"];

  function row2(div, label, value, barFrac) {
    var r = document.createElement("div");
    r.className = "dp-row";
    var l = document.createElement("span"); l.textContent = label;
    var v = document.createElement("span"); v.className = "v"; v.textContent = value;
    r.appendChild(l); r.appendChild(v);
    if (barFrac != null) {
      var b = document.createElement("div"); b.className = "dp-bar";
      var i = document.createElement("i");
      i.style.width = Math.max(0, Math.min(100, 100 * barFrac)) + "%";
      b.appendChild(i); r.appendChild(b);
    }
    div.appendChild(r);
  }
  function group(title) {
    var g = document.createElement("div"); g.className = "dp-group";
    var h = document.createElement("h3"); h.textContent = title;
    g.appendChild(h); dpStats.appendChild(g);
    return g;
  }

  function showDistrictPanel(r) {
    dpStats.innerHTML = "";
    dpTable.innerHTML = "";
    var f = formatIndian(r.population);
    dpTitle.textContent = r.district;
    dpSub.textContent = r.state + " · " + (f.label === f.grouped ? f.grouped : f.grouped + " (" + f.label + ")") + " · Census 2011";

    var g = group("Population & sex ratio");
    var sr = num(r.Male) > 0 ? (1000 * num(r.Female)) / num(r.Male) : 0;
    row2(g, "Male", num(r.Male).toLocaleString("en-IN"), num(r.Male) / num(r.population));
    row2(g, "Female", num(r.Female).toLocaleString("en-IN"), num(r.Female) / num(r.population));
    row2(g, "Sex ratio (F per 1000 M)", Math.round(sr));

    g = group("Literacy");
    row2(g, "Literate", num(r.Literate).toLocaleString("en-IN") + " (" + pct(r.Literate, r.population).toFixed(1) + "%)", num(r.Literate) / num(r.population));
    row2(g, "Male literate", num(r.Male_Literate).toLocaleString("en-IN"));
    row2(g, "Female literate", num(r.Female_Literate).toLocaleString("en-IN"));

    g = group("Social groups");
    row2(g, "Scheduled Castes", num(r.SC).toLocaleString("en-IN") + " (" + pct(r.SC, r.population).toFixed(1) + "%)", num(r.SC) / num(r.population));
    row2(g, "Scheduled Tribes", num(r.ST).toLocaleString("en-IN") + " (" + pct(r.ST, r.population).toFixed(1) + "%)", num(r.ST) / num(r.population));

    g = group("Workers");
    row2(g, "Total workers", num(r.Workers).toLocaleString("en-IN") + " (" + pct(r.Workers, r.population).toFixed(1) + "%)", num(r.Workers) / num(r.population));
    row2(g, "Main / Marginal", num(r.Main_Workers).toLocaleString("en-IN") + " / " + num(r.Marginal_Workers).toLocaleString("en-IN"));
    row2(g, "Non-workers", num(r.Non_Workers).toLocaleString("en-IN"));
    row2(g, "Cultivators", num(r.Cultivator_Workers).toLocaleString("en-IN"), num(r.Cultivator_Workers) / Math.max(1, num(r.Workers)));
    row2(g, "Agricultural labourers", num(r.Agricultural_Workers).toLocaleString("en-IN"), num(r.Agricultural_Workers) / Math.max(1, num(r.Workers)));
    row2(g, "Household industry", num(r.Household_Workers).toLocaleString("en-IN"), num(r.Household_Workers) / Math.max(1, num(r.Workers)));
    row2(g, "Other workers", num(r.Other_Workers).toLocaleString("en-IN"), num(r.Other_Workers) / Math.max(1, num(r.Workers)));

    g = group("Religion");
    RELIGION_COLS.forEach(function (c) {
      row2(g, c.replace(/_/g, " "), num(r[c]).toLocaleString("en-IN"), num(r[c]) / Math.max(1, num(r.population)));
    });

    g = group("Households & amenities");
    row2(g, "Households", num(r.Households).toLocaleString("en-IN"));
    row2(g, "Rural / Urban", num(r.Rural_Households).toLocaleString("en-IN") + " / " + num(r.Urban_Households).toLocaleString("en-IN"));
    row2(g, "Electric lighting", pct(r.Housholds_with_Electric_Lighting, r.Households).toFixed(1) + "%", num(r.Housholds_with_Electric_Lighting) / Math.max(1, num(r.Households)));
    row2(g, "Internet", pct(r.Households_with_Internet, r.Households).toFixed(1) + "%", num(r.Households_with_Internet) / Math.max(1, num(r.Households)));
    row2(g, "Computer", pct(r.Households_with_Computer, r.Households).toFixed(1) + "%", num(r.Households_with_Computer) / Math.max(1, num(r.Households)));
    row2(g, "Television", pct(r.Households_with_Television, r.Households).toFixed(1) + "%", num(r.Households_with_Television) / Math.max(1, num(r.Households)));
    row2(g, "LPG / PNG", pct(r.LPG_or_PNG_Households, r.Households).toFixed(1) + "%", num(r.LPG_or_PNG_Households) / Math.max(1, num(r.Households)));
    row2(g, "Own / Rented homes", num(r.Ownership_Owned_Households).toLocaleString("en-IN") + " / " + num(r.Ownership_Rented_Households).toLocaleString("en-IN"));
    row2(g, "Latrine in premises", pct(r.Having_latrine_facility_within_the_premises_Total_Households, r.Households).toFixed(1) + "%", num(r.Having_latrine_facility_within_the_premises_Total_Households) / Math.max(1, num(r.Households)));
    row2(g, "Tap water", pct(r.Main_source_of_drinking_water_Tapwater_Households, r.Households).toFixed(1) + "%", num(r.Main_source_of_drinking_water_Tapwater_Households) / Math.max(1, num(r.Households)));

    g = group("Education levels");
    EDU_COLS.forEach(function (c) {
      row2(g, c.replace(/_/g, " "), num(r[c]).toLocaleString("en-IN"), num(r[c]) / Math.max(1, num(r.Total_Education)));
    });

    g = group("Age groups");
    AGE_COLS.forEach(function (c) {
      row2(g, c.replace(/_/g, " "), num(r[c]).toLocaleString("en-IN"), num(r[c]) / Math.max(1, num(r.population)));
    });

    // Every remaining column, verbatim — all 118 indicators reachable.
    Object.keys(r).forEach(function (k) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td"); td1.textContent = k;
      var td2 = document.createElement("td");
      var v = r[k];
      td2.textContent = (typeof v === "number") ? v.toLocaleString("en-IN") : String(v);
      tr.appendChild(td1); tr.appendChild(td2);
      dpTable.appendChild(tr);
    });
  }
})();
