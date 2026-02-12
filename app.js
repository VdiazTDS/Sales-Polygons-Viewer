// =============================================================
// SUPABASE CONFIGURATION
// Handles cloud storage for Excel and GeoJSON files
// =============================================================
const SUPABASE_URL = "https://lffazhbwvorwxineklsy.supabase.co";
const SUPABASE_KEY = "sb_publishable_Lfh2zlIiTSMB0U-Fe5o6Jg_mJ1qkznh";

// Storage buckets
const EXCEL_BUCKET = "excel-files";
const GEOJSON_BUCKET = "geojson-files"; // New bucket for GeoJSON layers

// Create Supabase client
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// =============================================================
// MAP INITIALIZATION
// Sets up Leaflet map and base layers
// =============================================================
const map = L.map("map").setView([0, 0], 2);

const baseMaps = {
  streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  )
};

// Default basemap
baseMaps.streets.addTo(map);

// Separate layer groups so Excel + GeoJSON never conflict
const excelLayerGroup = L.layerGroup().addTo(map);
const geojsonLayerGroup = L.layerGroup().addTo(map);

// Basemap selector dropdown
document.getElementById("baseMapSelect").addEventListener("change", e => {
  Object.values(baseMaps).forEach(l => map.removeLayer(l));
  baseMaps[e.target.value].addTo(map);
});


// =============================================================
// EXCEL DATA SYMBOL SYSTEM
// Assigns consistent colors/shapes per Route + Day
// =============================================================
const colors = ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#1abc9c"];
const shapes = ["circle","square","triangle","diamond"];

const symbolMap = {};      // Stores symbol per route/day
const routeDayGroups = {}; // Stores markers grouped by route/day

let symbolIndex = 0;
let globalBounds = L.latLngBounds();

function dayName(n) {
  return ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][n-1];
}

function getSymbol(key) {
  if (!symbolMap[key]) {
    symbolMap[key] = {
      color: colors[symbolIndex % colors.length],
      shape: shapes[Math.floor(symbolIndex / colors.length) % shapes.length]
    };
    symbolIndex++;
  }
  return symbolMap[key];
}


// =============================================================
// MARKER CREATION
// Builds Leaflet markers with custom shapes
// =============================================================
function createMarker(lat, lon, symbol) {
  if (symbol.shape === "circle") {
    return L.circleMarker([lat, lon], {
      radius: 5,
      color: symbol.color,
      fillColor: symbol.color,
      fillOpacity: 0.9
    });
  }

  let html = "";

  if (symbol.shape === "square")
    html = `<div style="width:10px;height:10px;background:${symbol.color}"></div>`;

  if (symbol.shape === "triangle")
    html = `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid ${symbol.color}"></div>`;

  if (symbol.shape === "diamond")
    html = `<div style="width:10px;height:10px;background:${symbol.color};transform:rotate(45deg)"></div>`;

  return L.marker([lat, lon], { icon: L.divIcon({ html, className: "" }) });
}


// =============================================================
// FILTERING LOGIC
// Shows/hides markers based on selected Routes + Days
// =============================================================
function applyFilters() {
  const routes = [...document.querySelectorAll("#routeCheckboxes input:checked")].map(i => i.value);
  const days   = [...document.querySelectorAll("#dayCheckboxes input:checked")].map(i => i.value);

  Object.entries(routeDayGroups).forEach(([key, group]) => {
    const [r, d] = key.split("|");
    const show = routes.includes(r) && days.includes(d);

    group.layers.forEach(layer => {
      show ? excelLayerGroup.addLayer(layer) : excelLayerGroup.removeLayer(layer);
    });
  });

  updateStats();
}


// =============================================================
// STATISTICS PANEL
// Displays visible stop counts per Route + Day
// =============================================================
function updateStats() {
  const list = document.getElementById("statsList");
  list.innerHTML = "";

  Object.entries(routeDayGroups).forEach(([key, group]) => {
    const visible = group.layers.filter(l => excelLayerGroup.hasLayer(l)).length;
    if (!visible) return;

    const [r, d] = key.split("|");

    const li = document.createElement("li");
    li.textContent = `Route ${r} – ${dayName(d)}: ${visible}`;

    list.appendChild(li);
  });
}


// =============================================================
// EXCEL PROCESSING
// Converts spreadsheet rows into map markers
// =============================================================
function processExcelBuffer(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  // Reset previous data
  excelLayerGroup.clearLayers();
  Object.keys(routeDayGroups).forEach(k => delete routeDayGroups[k]);
  Object.keys(symbolMap).forEach(k => delete symbolMap[k]);

  symbolIndex = 0;
  globalBounds = L.latLngBounds();

  const routeSet = new Set();

  rows.forEach(row => {
    const lat = Number(row.LATITUDE);
    const lon = Number(row.LONGITUDE);
    const route = String(row.NEWROUTE);
    const day = String(row.NEWDAY);

    if (!lat || !lon || !route || !day) return;

    const key = `${route}|${day}`;
    const symbol = getSymbol(key);

    if (!routeDayGroups[key]) routeDayGroups[key] = { layers: [] };

    const marker = createMarker(lat, lon, symbol)
      .bindPopup(`Route ${route}<br>${dayName(day)}`);

    routeDayGroups[key].layers.push(marker);
    routeSet.add(route);
    globalBounds.extend([lat, lon]);
  });

  buildRouteCheckboxes([...routeSet]);
  applyFilters();
  map.fitBounds(globalBounds);
}


// =============================================================
// GEOJSON LOADING
// Downloads GeoJSON from Supabase and renders on map
// =============================================================
async function loadGeoJSONFile(name) {
  const { data } = sb.storage.from(GEOJSON_BUCKET).getPublicUrl(name);

  const res = await fetch(data.publicUrl);
  const geojson = await res.json();

  const layer = L.geoJSON(geojson, {
    style: { color: "#ffcc00", weight: 2 },

    onEachFeature: (feature, layer) => {
      if (!feature.properties) return;

      const content = Object.entries(feature.properties)
        .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
        .join("<br>");

      layer.bindPopup(content);
    }
  });

  geojsonLayerGroup.addLayer(layer);
  map.fitBounds(layer.getBounds());
}


// =============================================================
// FILE LISTING FROM SUPABASE
// Shows Open/Delete buttons for Excel + GeoJSON
// =============================================================
async function listFiles() {
  const ul = document.getElementById("savedFiles");
  ul.innerHTML = "";

  // ---------- Excel Files ----------
  const { data: excelFiles } = await sb.storage.from(EXCEL_BUCKET).list();

  excelFiles?.forEach(file => {
    const li = document.createElement("li");

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open Excel";
    openBtn.onclick = async () => {
      const { data } = sb.storage.from(EXCEL_BUCKET).getPublicUrl(file.name);
      const r = await fetch(data.publicUrl);
      processExcelBuffer(await r.arrayBuffer());
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      await sb.storage.from(EXCEL_BUCKET).remove([file.name]);
      listFiles();
    };

    li.append(openBtn, delBtn, document.createTextNode(" " + file.name));
    ul.appendChild(li);
  });


  // ---------- GeoJSON Files ----------
  const { data: geoFiles } = await sb.storage.from(GEOJSON_BUCKET).list();

  geoFiles?.forEach(file => {
    const li = document.createElement("li");

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open GeoJSON";
    openBtn.onclick = () => loadGeoJSONFile(file.name);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      await sb.storage.from(GEOJSON_BUCKET).remove([file.name]);
      listFiles();
    };

    li.append(openBtn, delBtn, document.createTextNode(" " + file.name));
    ul.appendChild(li);
  });
}


// =============================================================
// FILE UPLOAD HANDLER
// Detects Excel vs GeoJSON and uploads to correct bucket
// =============================================================
async function uploadFile(file) {
  if (!file) return;

  const isGeoJSON = file.name.toLowerCase().endsWith(".geojson") || file.name.toLowerCase().endsWith(".json");

  if (isGeoJSON) {
    await sb.storage.from(GEOJSON_BUCKET).upload(file.name, file, { upsert: true });
    await loadGeoJSONFile(file.name);
  } else {
    await sb.storage.from(EXCEL_BUCKET).upload(file.name, file, { upsert: true });
    processExcelBuffer(await file.arrayBuffer());
  }

  listFiles();
}


// =============================================================
// DRAG & DROP + FILE INPUT
// Connects UI upload box to upload handler
// =============================================================
const dropZone = document.getElementById("dropZone");

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".xlsx,.xls,.geojson,.json";

dropZone.onclick = () => fileInput.click();

dropZone.ondragover = e => e.preventDefault();

dropZone.ondrop = e => {
  e.preventDefault();
  uploadFile(e.dataTransfer.files[0]);
};

fileInput.onchange = e => uploadFile(e.target.files[0]);


// =============================================================
// INITIAL LOAD
// Pulls existing files from Supabase on page open
// =============================================================
listFiles();
