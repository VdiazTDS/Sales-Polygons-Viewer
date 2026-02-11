// ======== GITHUB CONFIG ========
const GITHUB_USER = "VdiazTDS";
const GITHUB_REPO = "VdiazTDS.github.io";
const GITHUB_FOLDER = "data";
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN = "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";


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

  return L.marker([lat, lon], {
    icon: L.divIcon({ html, className: "" })
  });
}


// ================= CHECKBOXES =================
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

// ================= SELECT ALL / NONE =================
function setCheckboxGroup(containerId, checked) {
  const boxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
  boxes.forEach(b => (b.checked = checked));
  applyFilters();
}

// Routes buttons
document.getElementById("routesAll").onclick = () =>
  setCheckboxGroup("routeCheckboxes", true);

document.getElementById("routesNone").onclick = () =>
  setCheckboxGroup("routeCheckboxes", false);

// Days buttons
document.getElementById("daysAll").onclick = () =>
  setCheckboxGroup("dayCheckboxes", true);

document.getElementById("daysNone").onclick = () =>
  setCheckboxGroup("dayCheckboxes", false);


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

    if (!routeDayGroups[key])
      routeDayGroups[key] = { layers: [] };

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


// ================= GITHUB REQUEST =================
async function githubRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    ...options
  });

  return res;
}


// ================= LIST FILES =================
async function githubListFiles() {
  const res = await githubRequest(
    `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${GITHUB_FOLDER}?ref=${GITHUB_BRANCH}`
  );

  if (!res.ok) return;

  const files = await res.json();

  const ul = document.getElementById("savedFiles");
  if (!ul) return;

  ul.innerHTML = "";

  files.forEach(f => {
    const li = document.createElement("li");

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open";
    openBtn.onclick = async () => {
      const r = await fetch(f.download_url);
      const buffer = await r.arrayBuffer();
      processExcelBuffer(buffer);
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      await githubRequest(
        `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${f.path}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            message: `Delete ${f.name}`,
            sha: f.sha,
            branch: GITHUB_BRANCH
          })
        }
      );
      githubListFiles();
    };

    li.append(openBtn, delBtn, document.createTextNode(" " + f.name));
    ul.appendChild(li);
  });
}


// ================= UPLOAD FILE =================
async function githubUploadFile(file) {
  if (!file) return;

  const buffer = await file.arrayBuffer();

  const content = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const path = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${GITHUB_FOLDER}/${file.name}`;

  // check if file exists
  const existingRes = await githubRequest(`${path}?ref=${GITHUB_BRANCH}`);
  let sha = null;

  if (existingRes.status === 200) {
    const existingJson = await existingRes.json();
    sha = existingJson.sha;
  }

  const uploadRes = await githubRequest(path, {
    method: "PUT",
    body: JSON.stringify({
      message: `Upload ${file.name}`,
      content,
      branch: GITHUB_BRANCH,
      ...(sha && { sha })
    })
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    console.error("GitHub upload error:", err);
    alert("Upload failed. Check console.");
    return;
  }

  await githubListFiles();
  processExcelBuffer(buffer);
}


// ================= INPUT =================
const dropZone = document.getElementById("dropZone");
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".xlsx,.xls";

if (dropZone) {
  dropZone.onclick = () => fileInput.click();

  dropZone.ondragover = e => e.preventDefault();

  dropZone.ondrop = e => {
    e.preventDefault();
    githubUploadFile(e.dataTransfer.files[0]);
  };
}

fileInput.onchange = e => githubUploadFile(e.target.files[0]);

// ================= MOBILE MENU =================
const mobileBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.querySelector(".sidebar");

if (mobileBtn && sidebar) {
  mobileBtn.onclick = () => {
    const isOpen = sidebar.classList.toggle("open");

    // visual active state
    mobileBtn.classList.toggle("active", isOpen);

    // change icon for clarity
    mobileBtn.textContent = isOpen ? "✕" : "☰";

    setTimeout(() => map.invalidateSize(), 200);
  };
}

// ================= SIDEBAR TOGGLE (CLEAN) =================
const toggleBtn = document.getElementById("toggleSidebarBtn");
const appContainer = document.querySelector(".app-container");
const sidebarEl = document.querySelector(".sidebar");

if (toggleBtn && appContainer && sidebarEl) {

  function updateDesktopArrow() {
    const collapsed = appContainer.classList.contains("collapsed");
    toggleBtn.textContent = collapsed ? "▶" : "◀";
  }

  // Initial arrow direction
  updateDesktopArrow();

  // Prevent Leaflet from stealing tap
  toggleBtn.addEventListener("touchstart", e => e.stopPropagation());

  toggleBtn.onclick = () => {
    const isMobile = window.innerWidth <= 900;

    if (isMobile) {
      sidebarEl.classList.toggle("open");
    } else {
      appContainer.classList.toggle("collapsed");
      updateDesktopArrow();
    }

    setTimeout(() => map.invalidateSize(), 200);
  };
}




// ================= INIT =================
githubListFiles();










