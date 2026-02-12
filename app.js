// =============================================================
// SUPABASE CONFIGURATION
// =============================================================
const SUPABASE_URL = "https://lffazhbwvorwxineklsy.supabase.co";
const SUPABASE_KEY = "sb_publishable_Lfh2zlIiTSMB0U-Fe5o6Jg_mJ1qkznh";
const GEOJSON_BUCKET = "geojson-files";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// =============================================================
// MAP INITIALIZATION
// =============================================================
const map = L.map("map").setView([0, 0], 2);

const baseMaps = {
  streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  )
};

baseMaps.streets.addTo(map);

const geojsonLayerGroup = L.layerGroup().addTo(map);

document.getElementById("baseMapSelect").addEventListener("change", e => {
  Object.values(baseMaps).forEach(l => map.removeLayer(l));
  baseMaps[e.target.value].addTo(map);
});


// =============================================================
// MAP LEGEND WITH COLOR PICKER
// =============================================================
const legend = document.getElementById("mapLegend");
const legendList = document.getElementById("legendList");
const openLayers = new Map();

function updateLegend() {
  legendList.innerHTML = "";

  if (openLayers.size === 0) {
    legend.style.display = "none";
    return;
  }

  legend.style.display = "block";

  openLayers.forEach((layerData, name) => {
    const { color, layer } = layerData;

    const li = document.createElement("li");

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = color;

    colorInput.oninput = (e) => {
      const newColor = e.target.value;
      layer.setStyle({ color: newColor });
      openLayers.set(name, { color: newColor, layer });
    };

    const label = document.createElement("span");
    label.textContent = " " + name;

    li.append(colorInput, label);
    legendList.appendChild(li);
  });
}


// =============================================================
// GEOJSON LOADING
// =============================================================
async function loadGeoJSONFile(name) {
  const { data } = sb.storage.from(GEOJSON_BUCKET).getPublicUrl(name);

  const res = await fetch(data.publicUrl);
  const geojson = await res.json();

  const color = "#" + Math.floor(Math.random() * 16777215).toString(16);

  const layer = L.geoJSON(geojson, {
    style: { color, weight: 2 },

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

  openLayers.set(name, { color, layer });
  updateLegend();
}


// =============================================================
// FILE LISTING FROM SUPABASE
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
      openLayers.delete(file.name);
      updateLegend();
      listFiles();
    };

    li.append(openBtn, delBtn, document.createTextNode(" " + file.name));
    ul.appendChild(li);
  });
}


// =============================================================
// FILE UPLOAD
// =============================================================
async function uploadFile(file) {
  if (!file) return;

  await sb.storage.from(GEOJSON_BUCKET).upload(file.name, file, { upsert: true });
  await loadGeoJSONFile(file.name);

  listFiles();
}


// =============================================================
// DRAG & DROP
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
// RESET MAP VIEW
// =============================================================
const resetMapBtn = document.getElementById("resetMapBtn");

if (resetMapBtn) {
  resetMapBtn.onclick = () => {
    geojsonLayerGroup.clearLayers();
    openLayers.clear();
    updateLegend();
    map.setView([0, 0], 2);
  };
}


// =============================================================
// SIDEBAR / MOBILE MENU
// =============================================================
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const sidebar = document.querySelector(".sidebar");
const appContainer = document.querySelector(".app-container");

if (mobileMenuBtn && sidebar) {
  mobileMenuBtn.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    mobileMenuBtn.innerHTML = isOpen ? "✕ Close" : "☰ Menu";
    setTimeout(() => map.invalidateSize(), 250);
  });
}

if (toggleSidebarBtn && appContainer) {
  toggleSidebarBtn.addEventListener("click", () => {
    appContainer.classList.toggle("collapsed");
    toggleSidebarBtn.textContent =
      appContainer.classList.contains("collapsed") ? "▶" : "◀";
    setTimeout(() => map.invalidateSize(), 250);
  });
}


// =============================================================
// INITIAL LOAD
// =============================================================
listFiles();
