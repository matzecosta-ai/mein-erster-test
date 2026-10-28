// BVG-Abfahrten für Scriptable (iPhone-Widget)
// Anleitung: ios/README.md
//
// Im Widget: zeigt die nächsten Abfahrten (Standort oder fest gewählte Haltestellen).
// In der App (Skript antippen): Live-Liste, Haltestellen wählen, nach Linien und Richtungen filtern.
// Widget-Parameter (optional): Profilname, z. B. "arbeit" – so kann jedes Widget eigene Einstellungen haben.

const API = "https://v6.bvg.transport.rest";
const RADIUS_M = 500;
const MAX_STOPS = 6;
const WINDOW_MIN = 60;
const REFRESH_MIN = 5; // Hinweis an iOS; wann das Widget wirklich neu lädt, entscheidet iOS selbst

const BADGE_COLORS = {
  subway: "#0d5fa8", suburban: "#1d8a3a", tram: "#c8102e",
  bus: "#9b2d8f", ferry: "#0f8fa3",
};

// ---------- Logik (ohne Oberfläche) ----------

function shortName(name) {
  return String(name || "").replace(" (Berlin)", "").replace(/^S\+U /, "");
}

function filterKey(dep) {
  return dep.line + "|" + dep.direction;
}

// "U2" < "U12", "M5" < "U2"
function compareLines(a, b) {
  const pa = a.replace(/[0-9]+$/, ""), pb = b.replace(/[0-9]+$/, "");
  if (pa !== pb) return pa < pb ? -1 : 1;
  const na = a.slice(pa.length), nb = b.slice(pb.length);
  if (na && nb) return parseInt(na, 10) - parseInt(nb, 10);
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareKeys(a, b) {
  const [la, da] = a.split("|"), [lb, db] = b.split("|");
  const c = compareLines(la, lb);
  return c !== 0 ? c : (da < db ? -1 : da > db ? 1 : 0);
}

async function getJson(url) {
  const req = new Request(url);
  req.timeoutInterval = 15;
  return await req.loadJSON();
}

async function fetchNearby(lat, lon) {
  const near = await getJson(`${API}/locations/nearby?latitude=${lat}&longitude=${lon}` +
    `&distance=${RADIUS_M}&results=${MAX_STOPS}&stops=true&poi=false&addresses=false`);
  const stops = (Array.isArray(near) ? near : [])
    .filter(s => s.type === "stop")
    .map(s => ({ id: s.id, name: shortName(s.name), distance: s.distance || 0 }));
  if (!stops.length) throw new Error(`Keine Haltestelle im Umkreis von ${RADIUS_M} m`);
  return stops;
}

// Nahe Haltestellen liefern oft dieselben Fahrten: jede Fahrt nur einmal,
// bei der zuerst genannten Haltestelle.
async function fetchDepartures(stops) {
  const results = await Promise.all(stops.map(s =>
    getJson(`${API}/stops/${s.id}/departures?duration=${WINDOW_MIN}&linesOfStops=false&remarks=false`)));
  const seen = new Set();
  const deps = [];
  results.forEach((r, i) => {
    for (const d of (r.departures || [])) {
      if (seen.has(d.tripId)) continue;
      seen.add(d.tripId);
      const when = d.when || d.plannedWhen;
      if (!when) continue;
      deps.push({
        line: d.line ? d.line.name : "?",
        product: d.line ? d.line.product : "",
        direction: shortName(d.direction),
        stopName: stops[i].name,
        when: new Date(when).getTime(),
        delayMin: d.delay == null ? 0 : Math.round(d.delay / 60),
        cancelled: !!d.cancelled || d.when == null,
      });
    }
  });
  deps.sort((a, b) => a.when - b.when);
  return deps;
}

// Bereits abgefahrene Fahrten raus, Filter ("Linie|Richtung") anwenden; leerer Filter = alles.
function visibleDepartures(deps, filter, now) {
  const set = new Set(filter);
  return deps.filter(d => d.when >= now - 30000 && (set.size === 0 || set.has(filterKey(d))));
}

async function searchStops(query) {
  const arr = await getJson(`${API}/locations?query=${encodeURIComponent(query)}` +
    `&results=6&stops=true&addresses=false&poi=false`);
  return (Array.isArray(arr) ? arr : []).filter(s => s.type === "stop")
    .map(s => ({ id: s.id, name: shortName(s.name), distance: 0 }));
}

// Nächste Verbindungen vom Standort (inkl. Fußweg) zur Zielhaltestelle; nur BVG-Verkehrsmittel.
async function fetchJourneys(lat, lon, destId) {
  const r = await getJson(`${API}/journeys?from.latitude=${lat}&from.longitude=${lon}` +
    `&from.address=${encodeURIComponent("Mein Standort")}&to=${destId}` +
    `&results=5&stopovers=false&remarks=false` +
    `&suburban=true&subway=true&tram=true&bus=true&ferry=true&express=false&regional=false`);
  const result = [];
  for (const j of (r.journeys || [])) {
    const transit = j.legs.filter(l => l.line);
    if (!transit.length) continue; // reiner Fußweg
    const first = transit[0], last = j.legs[j.legs.length - 1];
    const dep = first.departure || first.plannedDeparture;
    const arr = last.arrival || last.plannedArrival;
    result.push({
      legs: j.legs.map(parseLeg),
      firstLine: first.line.name || "?",
      product: first.line.product || "",
      lines: transit.map(t => t.line.name || "?").join(" → "),
      originStop: first.origin ? shortName(first.origin.name) : "",
      depart: new Date(dep).getTime(),
      arrive: new Date(arr).getTime(),
      transfers: transit.length - 1,
      delayMin: first.departureDelay == null ? 0 : Math.round(first.departureDelay / 60),
      cancelled: transit.some(t => t.cancelled),
    });
  }
  return result;
}

function placeName(place, fallback) {
  return place && place.type === "stop" ? shortName(place.name) : fallback;
}

// Ein Abschnitt: Fußweg (line == null) oder Fahrt.
function parseLeg(l) {
  const dep = l.departure || l.plannedDeparture, arr = l.arrival || l.plannedArrival;
  return {
    line: l.line ? l.line.name || "?" : null,
    product: l.line ? l.line.product || "" : "",
    direction: shortName(l.direction),
    from: placeName(l.origin, "Mein Standort"),
    to: placeName(l.destination, "Ziel"),
    depart: new Date(dep).getTime(),
    arrive: new Date(arr).getTime(),
    depDelay: l.departureDelay == null ? 0 : Math.round(l.departureDelay / 60),
    arrDelay: l.arrivalDelay == null ? 0 : Math.round(l.arrivalDelay / 60),
    depPlatform: l.departurePlatform || "",
    arrPlatform: l.arrivalPlatform || "",
    distance: l.distance || 0,
    cancelled: !!l.cancelled,
  };
}

function timeText(ms) {
  return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function journeyMinutesText(j, now) {
  if (j.cancelled) return "entfällt";
  const min = Math.max(0, Math.round((j.depart - now) / 60000));
  return min === 0 ? "jetzt" : `${min} min`;
}

function visibleJourneys(journeys, now) {
  return journeys.filter(j => j.depart >= now - 30000);
}

function minutesText(dep, now) {
  if (dep.cancelled) return "entfällt";
  const min = Math.max(0, Math.round((dep.when - now) / 60000));
  return min === 0 ? "jetzt" : `${min} min`;
}

// ---------- Einstellungen (pro Profil in einer Datei) ----------

function settingsPath(profile) {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), `bvg-abfahrten-${profile}.json`);
}

function loadSettings(profile) {
  const fm = FileManager.local();
  const p = settingsPath(profile);
  const def = { stops: [], filter: [], lastLocation: null, destination: null };
  if (!fm.fileExists(p)) return def;
  try { return Object.assign(def, JSON.parse(fm.readString(p))); } catch (e) { return def; }
}

function saveSettings(profile, settings) {
  FileManager.local().writeString(settingsPath(profile), JSON.stringify(settings));
}

// ---------- Daten laden (Standort oder feste Haltestellen) ----------

async function getLocation(settings) {
  try {
    Location.setAccuracyToHundredMeters();
    const l = await Location.current();
    settings.lastLocation = { latitude: l.latitude, longitude: l.longitude };
    return settings.lastLocation;
  } catch (e) {
    if (settings.lastLocation) return settings.lastLocation; // z. B. im Widget ohne Standortfreigabe
    throw new Error("Standort nicht verfügbar – in iOS für Scriptable erlauben");
  }
}

async function loadData(profile) {
  const settings = loadSettings(profile);
  if (settings.destination) { // Verbindungsmodus: Start ist immer der Standort
    const loc = await getLocation(settings);
    const journeys = await fetchJourneys(loc.latitude, loc.longitude, settings.destination.id);
    saveSettings(profile, settings);
    return { settings, stops: [], nearby: [], departures: [], journeys, updatedAt: Date.now() };
  }
  let stops, nearby = [];
  if (settings.stops.length) {
    stops = settings.stops;
    try {
      const loc = await getLocation(settings);
      nearby = await fetchNearby(loc.latitude, loc.longitude);
    } catch (e) { /* Auswahl funktioniert auch ohne Standort */ }
  } else {
    const loc = await getLocation(settings);
    stops = nearby = await fetchNearby(loc.latitude, loc.longitude);
  }
  const departures = await fetchDepartures(stops);
  saveSettings(profile, settings);
  return { settings, stops, nearby, departures, journeys: [], updatedAt: Date.now() };
}

// ---------- Widget ----------

function rowCount(family) {
  return family === "large" ? 9 : family === "medium" ? 4 : 3;
}

function addRow(widget, dep, now, family) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 8;

  const badge = row.addStack();
  badge.backgroundColor = new Color(BADGE_COLORS[dep.product] || "#666666");
  badge.cornerRadius = 5;
  badge.size = new Size(42, 20);
  badge.centerAlignContent();
  const line = badge.addText(dep.line);
  line.font = Font.boldSystemFont(12);
  line.textColor = Color.white();
  line.lineLimit = 1;
  line.minimumScaleFactor = 0.7;

  const info = row.addStack();
  info.layoutVertically();
  const dir = info.addText(dep.direction);
  dir.font = Font.systemFont(13);
  dir.textColor = Color.white();
  dir.lineLimit = 1;
  if (family === "large") {
    const stop = info.addText(dep.stopName);
    stop.font = Font.systemFont(10);
    stop.textColor = new Color("#9a9a94");
    stop.lineLimit = 1;
  }

  row.addSpacer();
  const min = row.addText(minutesText(dep, now));
  min.font = Font.boldSystemFont(14);
  min.textColor = dep.cancelled ? new Color("#9a9a94")
    : dep.delayMin >= 3 ? new Color("#ff6b6b") : Color.white();
  min.rightAlignText();
}

function addJourneyRow(widget, j, now, family) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 8;

  const badge = row.addStack();
  badge.backgroundColor = new Color(BADGE_COLORS[j.product] || "#666666");
  badge.cornerRadius = 5;
  badge.size = new Size(42, 20);
  badge.centerAlignContent();
  const line = badge.addText(j.firstLine);
  line.font = Font.boldSystemFont(12);
  line.textColor = Color.white();
  line.lineLimit = 1;
  line.minimumScaleFactor = 0.7;

  const info = row.addStack();
  info.layoutVertically();
  const lines = info.addText(j.lines + (j.transfers ? ` · ${j.transfers} Umst.` : ""));
  lines.font = Font.systemFont(13);
  lines.textColor = Color.white();
  lines.lineLimit = 1;
  if (family !== "small") {
    const dur = Math.max(1, Math.round((j.arrive - j.depart) / 60000));
    const sub = info.addText(`ab ${j.originStop} · an ${timeText(j.arrive)} (${dur} min)`);
    sub.font = Font.systemFont(10);
    sub.textColor = new Color("#9a9a94");
    sub.lineLimit = 1;
  }

  row.addSpacer();
  const min = row.addText(journeyMinutesText(j, now));
  min.font = Font.boldSystemFont(14);
  min.textColor = j.cancelled ? new Color("#9a9a94")
    : j.delayMin >= 3 ? new Color("#ff6b6b") : Color.white();
  min.rightAlignText();
}

function buildWidget(data, family, error) {
  const now = Date.now();
  const w = new ListWidget();
  w.backgroundColor = new Color("#1b1b1b");
  w.setPadding(10, 12, 8, 12);
  w.refreshAfterDate = new Date(now + REFRESH_MIN * 60000);

  const dest = data && data.settings.destination;
  const title = w.addText(dest ? `→ ${dest.name}` : data && data.settings.stops.length
    ? data.stops.map(s => s.name).join(" · ") : "Abfahrten in der Nähe");
  title.font = Font.boldSystemFont(13);
  title.textColor = new Color("#f0d722");
  title.lineLimit = 1;
  w.addSpacer(6);

  if (error) {
    const t = w.addText(error);
    t.font = Font.systemFont(12);
    t.textColor = new Color("#ff6b6b");
    return w;
  }

  if (dest) {
    const js = visibleJourneys(data.journeys, now).slice(0, rowCount(family));
    js.forEach((j, i) => {
      if (i > 0) w.addSpacer(family === "small" ? 4 : 6);
      addJourneyRow(w, j, now, family);
    });
    if (!js.length) {
      const t = w.addText("Keine Verbindung gefunden");
      t.font = Font.systemFont(12);
      t.textColor = new Color("#9a9a94");
    }
    w.addSpacer();
    const st = w.addText(`Stand ${timeText(data.updatedAt)}`);
    st.font = Font.systemFont(10);
    st.textColor = new Color("#9a9a94");
    return w;
  }

  const filter = data.settings.filter;
  const list = visibleDepartures(data.departures, filter, now).slice(0, rowCount(family));
  list.forEach((d, i) => {
    if (i > 0) w.addSpacer(family === "small" ? 4 : 6);
    addRow(w, d, now, family);
  });
  if (!list.length) {
    const t = w.addText(filter.length ? "Keine Abfahrten für den Filter" : "Keine Abfahrten");
    t.font = Font.systemFont(12);
    t.textColor = new Color("#9a9a94");
  }

  w.addSpacer();
  const time = new Date(data.updatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const status = w.addText(`Stand ${time}${filter.length ? " · Filter aktiv" : ""}`);
  status.font = Font.systemFont(10);
  status.textColor = new Color("#9a9a94");
  return w;
}

// ---------- In der App: Liste und Einstellungen ----------

// Mehrfachauswahl als Tabelle mit Häkchen; liefert die gewählten Schlüssel.
async function pickMany(title, items, selectedKeys) {
  const selected = new Set(selectedKeys);
  const table = new UITable();
  table.showSeparators = true;
  const render = () => {
    table.removeAllRows();
    const head = new UITableRow();
    head.isHeader = true;
    head.addText(title, "Antippen zum Auswählen, oben links schließen. Nichts gewählt = alles zeigen.");
    table.addRow(head);
    for (const item of items) {
      const row = new UITableRow();
      row.dismissOnSelect = false;
      row.addText((selected.has(item.key) ? "✓  " : "      ") + item.label);
      row.onSelect = () => {
        if (selected.has(item.key)) selected.delete(item.key); else selected.add(item.key);
        render();
        table.reload();
      };
      table.addRow(row);
    }
  };
  render();
  await table.present();
  return items.map(i => i.key).filter(k => selected.has(k));
}

async function chooseStops(profile, data) {
  const known = new Map();
  for (const s of data.nearby.concat(data.settings.stops)) if (!known.has(s.id)) known.set(s.id, s);
  const items = [...known.values()].map(s => ({
    key: s.id, label: s.distance ? `${s.name}  (${s.distance} m)` : s.name,
  }));
  const chosen = await pickMany("Nur diese Haltestellen zeigen", items, data.settings.stops.map(s => s.id));
  data.settings.stops = chosen.map(id => {
    const s = known.get(id);
    return { id: s.id, name: s.name, distance: s.distance || 0 };
  });
  saveSettings(profile, data.settings);
}

async function chooseFilter(profile, data) {
  const labels = new Map();
  for (const d of data.departures) labels.set(filterKey(d), `${d.line}  →  ${d.direction}`);
  for (const key of data.settings.filter) {
    if (!labels.has(key)) labels.set(key, key.replace("|", "  →  "));
  }
  const items = [...labels.keys()].sort(compareKeys).map(key => ({ key, label: labels.get(key) }));
  data.settings.filter = await pickMany("Nur diese Linien & Richtungen", items, data.settings.filter);
  saveSettings(profile, data.settings);
}

function hasActiveSettings(settings) {
  return settings.stops.length > 0 || settings.filter.length > 0 || !!settings.destination;
}

function clearSettings(profile, settings) {
  settings.stops = [];
  settings.filter = [];
  settings.destination = null;
  saveSettings(profile, settings);
}

// Umstieg zwischen zwei Fahrten, optional mit Fußweg dazwischen.
function transferText(prev, walk, next) {
  const wait = Math.max(0, Math.round((next.depart - prev.arrive) / 60000));
  return `↻  Umsteigen in ${prev.to}` +
    (walk && walk.distance > 0 ? ` · Fußweg ${walk.distance} m` : "") +
    ` · ${wait} min Zeit` +
    (next.depPlatform ? ` · weiter ab Gleis ${next.depPlatform}` : "");
}

// Ganzer Verlauf einer Verbindung: Fußwege, Fahrten mit Gleis und Zeit, Umstiege.
async function showJourneyDetail(j, dest) {
  const table = new UITable();
  table.showSeparators = true;
  const dur = Math.max(1, Math.round((j.arrive - j.depart) / 60000));
  const head = new UITableRow();
  head.isHeader = true;
  head.addText(`→ ${dest ? dest.name : "Ziel"}`,
    `Abfahrt ${timeText(j.depart)} · Ankunft ${timeText(j.arrive)} · ${dur} min · ` +
    (j.transfers === 0 ? "ohne Umstieg" : j.transfers === 1 ? "1 Umstieg" : `${j.transfers} Umstiege`));
  table.addRow(head);

  const legs = j.legs || [];
  const note = (text, highlight) => {
    const row = new UITableRow();
    const c = row.addText(text);
    if (highlight) { row.backgroundColor = new Color("#FFF3B0"); c.titleColor = Color.black(); }
    table.addRow(row);
  };
  const stop = (ms, delay, name, platform) => {
    const row = new UITableRow();
    const t = row.addText(timeText(ms) + (delay >= 1 ? ` +${delay}` : ""));
    t.widthWeight = 25;
    if (delay >= 3) t.titleColor = new Color("#c62828");
    row.addText(name + (platform ? `  ·  Gleis ${platform}` : "")).widthWeight = 75;
    table.addRow(row);
  };

  legs.forEach((leg, i) => {
    if (!leg.line) { // Fußweg
      const middle = i > 0 && i < legs.length - 1;
      if (middle) { note(transferText(legs[i - 1], leg, legs[i + 1]), true); return; }
      const min = Math.max(1, Math.round((leg.arrive - leg.depart) / 60000));
      note(`🚶  ${i === 0 ? "Fußweg zur Haltestelle" : "Fußweg zum Ziel"} · ${leg.distance} m · ca. ${min} min`, false);
      return;
    }
    if (i > 0 && legs[i - 1].line) note(transferText(legs[i - 1], null, leg), true); // Umstieg ohne Fußweg
    stop(leg.depart, leg.depDelay, leg.from, leg.depPlatform);
    const ride = new UITableRow();
    const m = Math.max(1, Math.round((leg.arrive - leg.depart) / 60000));
    ride.addText(`${leg.line}  →  ${leg.direction}`, `${m} min Fahrt${leg.cancelled ? " · entfällt" : ""}`);
    ride.backgroundColor = new Color(BADGE_COLORS[leg.product] || "#666666", 0.25);
    table.addRow(ride);
    stop(leg.arrive, leg.arrDelay, leg.to, leg.arrPlatform);
  });
  await table.present();
}

async function chooseDestination(profile, data) {
  const input = new Alert();
  input.title = "Wohin willst du fahren?";
  input.message = "Start ist dein aktueller Standort.";
  input.addTextField("z. B. Hermannstr.", "");
  input.addAction("Suchen");
  input.addCancelAction("Abbrechen");
  if ((await input.presentAlert()) === -1) return;
  const query = input.textFieldValue(0).trim();
  if (!query) return;

  let found;
  try { found = await searchStops(query); } catch (e) { found = null; }
  const res = new Alert();
  if (!found || !found.length) {
    res.title = found ? "Nichts gefunden" : "Suche fehlgeschlagen";
    res.message = found ? `Keine Haltestelle zu „${query}“.` : "Bitte später nochmal versuchen.";
    res.addCancelAction("OK");
    await res.presentAlert();
    return;
  }
  res.title = "Ziel wählen";
  found.forEach(s => res.addAction(s.name));
  res.addCancelAction("Abbrechen");
  const idx = await res.presentAlert();
  if (idx === -1) return;
  data.settings.destination = found[idx];
  saveSettings(profile, data.settings);
}

async function showInApp(profile) {
  let cached = null; // nach der Detailansicht ohne neuen Abruf zurück zur Liste
  while (true) {
    let data;
    if (cached) {
      data = cached;
      cached = null;
    } else try {
      data = await loadData(profile);
    } catch (e) {
      const a = new Alert();
      a.title = "Fehler";
      a.message = e.message || String(e);
      a.addAction("Nochmal");
      a.addCancelAction("Schließen");
      if ((await a.presentAlert()) === -1) return;
      continue;
    }

    const now = Date.now();
    const list = visibleDepartures(data.departures, data.settings.filter, now);
    const table = new UITable();
    table.showSeparators = true;

    const head = new UITableRow();
    head.isHeader = true;
    const dest = data.settings.destination;
    head.addText(dest ? `→ ${dest.name}` : data.settings.stops.length ? data.stops.map(s => s.name).join(" · ") : "Abfahrten in der Nähe",
      `Profil „${profile}“ · Stand ${new Date(data.updatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
    table.addRow(head);

    let action = null, picked = null;
    const add = (text, name) => {
      const row = new UITableRow();
      row.addText(text);
      row.onSelect = () => { action = name; };
      table.addRow(row);
    };
    if (hasActiveSettings(data.settings)) add("✕  Alles zurücksetzen (Haltestellen, Filter, Ziel)", "reset");
    add(dest ? `⚙  Ziel ändern: ${dest.name}` : "⚙  Ziel eingeben (Verbindung)", "destination");
    if (dest) add("✕  Kein Ziel (zurück zu Abfahrten)", "nodestination");
    if (!dest) {
      add("⚙  Haltestellen wählen" + (data.settings.stops.length ? ` (${data.settings.stops.length})` : ""), "stops");
      add("⚙  Linien & Richtungen filtern" + (data.settings.filter.length ? ` (${data.settings.filter.length})` : ""), "filter");
    }
    add("⟳  Aktualisieren", "reload");

    if (dest) {
      const js = visibleJourneys(data.journeys, now);
      for (const j of js) {
        const row = new UITableRow();
        row.onSelect = () => { action = "detail"; picked = j; };
        const dur = Math.max(1, Math.round((j.arrive - j.depart) / 60000));
        row.addText(`${j.lines}${j.transfers ? ` · ${j.transfers} Umst.` : ""}`,
          `ab ${j.originStop} · an ${timeText(j.arrive)} (${dur} min)`).widthWeight = 80;
        const m = row.addText(journeyMinutesText(j, now), j.delayMin >= 1 && !j.cancelled ? `+${j.delayMin}` : "");
        m.widthWeight = 20;
        m.rightAligned();
        table.addRow(row);
      }
      if (!js.length) {
        const row = new UITableRow();
        row.addText("Keine Verbindung gefunden");
        table.addRow(row);
      }
      await table.present();
      if (action === "detail") { await showJourneyDetail(picked, dest); cached = data; }
      else if (action === "reset") clearSettings(profile, data.settings);
      else if (action === "destination") await chooseDestination(profile, data);
      else if (action === "nodestination") { data.settings.destination = null; saveSettings(profile, data.settings); }
      else if (action !== "reload") return; // Tabelle wurde geschlossen
      continue;
    }

    for (const d of list.slice(0, 40)) {
      const row = new UITableRow();
      row.addText(`${d.line}  →  ${d.direction}`, d.stopName).widthWeight = 80;
      const m = row.addText(minutesText(d, now), d.delayMin >= 1 && !d.cancelled ? `+${d.delayMin}` : "");
      m.widthWeight = 20;
      m.rightAligned();
      table.addRow(row);
    }
    if (!list.length) {
      const row = new UITableRow();
      row.addText(data.settings.filter.length ? "Keine Abfahrten für den Filter" : "Keine Abfahrten");
      table.addRow(row);
    }

    await table.present();
    if (action === "reset") clearSettings(profile, data.settings);
    else if (action === "destination") await chooseDestination(profile, data);
    else if (action === "stops") await chooseStops(profile, data);
    else if (action === "filter") await chooseFilter(profile, data);
    else if (action !== "reload") return; // Tabelle wurde geschlossen
  }
}

// ---------- Start ----------

async function main() {
  const profile = (args.widgetParameter || "standard").trim() || "standard";
  if (config.runsInWidget) {
    let widget;
    try {
      widget = buildWidget(await loadData(profile), config.widgetFamily || "medium", null);
    } catch (e) {
      widget = buildWidget(null, config.widgetFamily || "medium", e.message || String(e));
    }
    Script.setWidget(widget);
  } else {
    await showInApp(profile);
  }
  Script.complete();
}

// Für Tests unter Node: __BVG_TEST__ setzen, dann startet main() nicht von selbst.
if (typeof __BVG_TEST__ === "undefined") {
  await main();
} else {
  module.exports = {
    shortName, filterKey, compareLines, compareKeys, fetchNearby, fetchDepartures,
    visibleDepartures, minutesText, loadData, buildWidget, main, showInApp, searchStops, fetchJourneys, showJourneyDetail, clearSettings, hasActiveSettings,
  };
}
