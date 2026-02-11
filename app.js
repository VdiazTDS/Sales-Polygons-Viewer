// ================= SUPABASE CONFIG =================
const SUPABASE_URL = "https://lffazhbwvorwxineklsy.sb.co";
const SUPABASE_KEY = "sb_publishable_Lfh2zlIiTSMB0U-Fe5o6Jg_mJ1qkznh";
const BUCKET = "excel-files";

const sb = window.sb.createClient(SUPABASE_URL, SUPABASE_KEY);



// ================= MAP =================
const map = L.map("map").setView([0, 0], 2);

const baseMaps = {
  streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  )
};

baseMaps.streets.addTo(map);

document.getElementById("baseMapSelect").addEventListener("change", e => {
  Object.values(baseMaps).forEach(l => map.removeLayer(l));
  baseMaps[e.target.value].addTo(map);
});


// ================= DATA =================
const colors = ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#1abc9c"];
const shapes = ["circle","square","triangle","diamond"];
const symbolMap = {};
const routeDayGroups = {};
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


// ================= FILTER UI =================
function buildRouteCheckboxes(routes) {
  const c = document.getElementById("routeCheckboxes");
  c.innerHTML = "";
  routes.forEach(r => {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" value="${r}" checked> ${r}`;
    l.querySelector("input").addEventListener("change", applyFilters);
    c.appendChild(l);
  });
}

function buildDayCheckboxes() {
  const c = document.getElementById("dayCheckboxes");
  c.innerHTML = "";
  [1,2,3,4,5,6,7].forEach(d => {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" value="${d}" checked> ${dayName(d)}`;
    l.querySelector("input").addEventListener("change", applyFilters);
    c.appendChild(l);
  });
}
buildDayCheckboxes();

function setCheckboxGroup(containerId, checked) {
  document.querySelectorAll(`#${containerId} input`).forEach(b => (b.checked = checked));
  applyFilters();
}

routesAll.onclick  = () => setCheckboxGroup("routeCheckboxes", true);
routesNone.onclick = () => setCheckboxGroup("routeCheckboxes", false);
daysAll.onclick    = () => setCheckboxGroup("dayCheckboxes", true);
daysNone.onclick   = () => setCheckboxGroup("dayCheckboxes", false);


// ================= FILTER =================
function applyFilters() {
  const routes = [...document.querySelectorAll("#routeCheckboxes input:checked")].map(i => i.value);
  const days   = [...document.querySelectorAll("#dayCheckboxes input:checked")].map(i => i.value);

  Object.entries(routeDayGroups).forEach(([key, group]) => {
    const [r, d] = key.split("|");
    const show = routes.includes(r) && days.includes(d);
    group.layers.forEach(l => show ? l.addTo(map) : map.removeLayer(l));
  });

  updateStats();
}


// ================= STATS =================
function updateStats() {
  const list = document.getElementById("statsList");
  list.innerHTML = "";

  Object.entries(routeDayGroups).forEach(([key, group]) => {
    const visible = group.layers.filter(l => map.hasLayer(l)).length;
    if (!visible) return;

    const [r,d] = key.split("|");
    const li = document.createElement("li");
    li.textContent = `Route ${r} – ${dayName(d)}: ${visible}`;
    list.appendChild(li);
  });
}


// ================= EXCEL PROCESS =================
function processExcelBuffer(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  Object.values(routeDayGroups).forEach(g => g.layers.forEach(l => map.removeLayer(l)));
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

    const m = createMarker(lat, lon, symbol)
      .bindPopup(`Route ${route}<br>${dayName(day)}`)
      .addTo(map);

    routeDayGroups[key].layers.push(m);
    routeSet.add(route);
    globalBounds.extend([lat, lon]);
  });

  buildRouteCheckboxes([...routeSet]);
  applyFilters();
  map.fitBounds(globalBounds);
}


// ================= SUPABASE FILE LIST =================
async function listFiles() {
  const { data, error } = await sb.storage.from(BUCKET).list();
  if (error) return console.error(error);

  const ul = document.getElementById("savedFiles");
  ul.innerHTML = "";

  data.forEach(file => {
    const li = document.createElement("li");

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open";
    openBtn.onclick = async () => {
      const { data } = sb.storage.from(BUCKET).getPublicUrl(file.name);
      const r = await fetch(data.publicUrl);
      processExcelBuffer(await r.arrayBuffer());
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      await sb.storage.from(BUCKET).remove([file.name]);
      listFiles();
    };

    li.append(openBtn, delBtn, document.createTextNode(" " + file.name));
    ul.appendChild(li);
  });
}


// ================= UPLOAD =================
async function uploadFile(file) {
  if (!file) return;

  await sb.storage.from(BUCKET).upload(file.name, file, { upsert: true });

  processExcelBuffer(await file.arrayBuffer());
  listFiles();
}


// ================= INPUT =================
const dropZone = document.getElementById("dropZone");
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".xlsx,.xls";

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = e => e.preventDefault();
dropZone.ondrop = e => {
  e.preventDefault();
  uploadFile(e.dataTransfer.files[0]);
};

fileInput.onchange = e => uploadFile(e.target.files[0]);


// ================= SIDEBAR / MOBILE =================
mobileMenuBtn.onclick = () => {
  const isOpen = sidebar.classList.toggle("open");
  mobileMenuBtn.textContent = isOpen ? "✕" : "☰";
  setTimeout(() => map.invalidateSize(), 200);
};

toggleSidebarBtn.onclick = () => {
  if (window.innerWidth <= 900) {
    sidebar.classList.toggle("open");
  } else {
    document.querySelector(".app-container").classList.toggle("collapsed");
    toggleSidebarBtn.textContent =
      document.querySelector(".app-container").classList.contains("collapsed") ? "▶" : "◀";
  }
  setTimeout(() => map.invalidateSize(), 200);
};


// ================= INIT =================
listFiles();
