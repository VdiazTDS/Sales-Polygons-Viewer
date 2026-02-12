// =============================================================
// SUPABASE CONFIGURATION
// Handles cloud storage for GeoJSON files only
// =============================================================
const SUPABASE_URL = "https://lffazhbwvorwxineklsy.supabase.co";
const SUPABASE_KEY = "sb_publishable_Lfh2zlIiTSMB0U-Fe5o6Jg_mJ1qkznh";

// Storage bucket for GeoJSON layers
const GEOJSON_BUCKET = "geojson-files";

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

// Layer group for GeoJSON
const geojsonLayerGroup = L.layerGroup().addTo(map);

// Basemap selector dropdown
document.getElementById("baseMapSelect").addEventListener("change", e => {
  Object.values(baseMaps).forEach(l => map.removeLayer(l));
  baseMaps[e.target.value].addTo(map);
});


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
// Shows Open/Delete buttons for GeoJSON
// =============================================================
async function listFiles() {
  const ul = document.getElementById("savedFiles");
  ul.innerHTML = "";

  const { data: geoFiles } = await sb.storage.from(GEOJSON_BUCKET).list();

  geoFiles?.forEach(file => {
    const li = document.createElement("li");

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open";
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
// Uploads GeoJSON files to Supabase and displays them
// =============================================================
async function uploadFile(file) {
  if (!file) return;

  await sb.storage.from(GEOJSON_BUCKET).upload(file.name, file, { upsert: true });
  await loadGeoJSONFile(file.name);

  listFiles();
}


// =============================================================
// DRAG & DROP + FILE INPUT
// Connects UI upload box to upload handler
// =============================================================
const dropZone = document.getElementById("dropZone");

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".geojson,.json";

dropZone.onclick = () => fileInput.click();

dropZone.ondragover = e => e.preventDefault();

dropZone.ondrop = e => {
  e.preventDefault();
  uploadFile(e.dataTransfer.files[0]);
};

fileInput.onchange = e => uploadFile(e.target.files[0]);


// =============================================================
// INITIAL LOAD
// Pulls existing GeoJSON files from Supabase on page open
// =============================================================
// =============================================================
// RESET MAP VIEW BUTTON
// Returns map to world view
// =============================================================
const resetMapBtn = document.getElementById("resetMapBtn");

if (resetMapBtn) {
  resetMapBtn.onclick = () => {
    map.setView([0, 0], 2);
  };
}


listFiles();
