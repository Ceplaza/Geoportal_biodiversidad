const CONFIG = {
  supabaseUrl: 'https://jyzdfbyaqzqvknouloqy.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5emRmYnlhcXpxdmtub3Vsb3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NTU0NTUsImV4cCI6MjA5ODUzMTQ1NX0.rGf2xcMf6lxXpFitk2qarQT5Drd38rBbuxo2Oazpbek',
  columnasGeom: ['geom', 'geometry', 'geojson'],
  columnasLatLon: ['lat', 'latitude', 'latitud', 'lon', 'lng', 'longitude', 'longitud']
};

const TABLAS = [
  { nombre: 'areas_verdes_geom',     color: '#2ecc71', icon: 'Polígono', desc: 'Áreas verdes' },
  { nombre: 'ave_ucuenca',           color: '#f39c12', icon: 'Punto',    desc: 'Avistamiento de aves' },
  { nombre: 'emplazamiento_ucuenca', color: '#3498db', icon: 'Polígono', desc: 'Emplazamientos urbanos' }
];

const camposVisibles = {
  areas_verdes_geom: [
    ['name', 'Nombre'],
    ['tipo', 'Tipo'],
    ['area_ha', 'Área (ha)'],
    ['direccion', 'Dirección'],
    ['codigo', 'Código'],
    ['altitudemo', 'Altitud'],
    ['descriptio', 'Descripción']
  ],
  ave_ucuenca: [
    ['common_nam', 'Nombre común'],
    ['scientific', 'Nombre científico'],
    ['species_gu', 'Especie'],
    ['observed_o', 'Fecha obs.'],
    ['user_name', 'Observador'],
    ['place_gues', 'Lugar'],
    ['quality_gr', 'Calidad'],
    ['image_url', 'Imagen'],
    ['sound_url', 'Sonido'],
    ['tag_list', 'Etiquetas'],
    ['descriptio', 'Descripción'],
    ['license', 'Licencia']
  ],
  emplazamiento_ucuenca: [
    ['name', 'Nombre'],
    ['amenity', 'Tipo'],
    ['addr_city', 'Ciudad'],
    ['addr_full', 'Dirección'],
    ['contact_ph', 'Teléfono'],
    ['contact_we', 'Web'],
    ['campus', 'Campus'],
    ['ec_campus', 'Campus (ec)'],
    ['ec_tipo', 'Tipo (ec)'],
    ['operator', 'Operador'],
    ['opening_ho', 'Horario'],
    ['building', 'Edificio'],
    ['leisure', 'Ocio'],
    ['landuse', 'Uso suelo'],
    ['height', 'Altura'],
    ['source', 'Fuente'],
    ['type', 'Tipo OSM']
  ]
};

/* ---- BASEMAPS ---- */
const basemaps = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }),
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri'
  })
};

const map = L.map('map', { zoomControl: true });
basemaps.osm.addTo(map);

let controlLayers = L.control.layers(null, null, { collapsed: false }).addTo(map);
let capasCargadas = {};
let featureCounts = {};

/* ---- BASEMAP SWITCHER ---- */
document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.base;
    Object.keys(basemaps).forEach(k => {
      if (k === id) basemaps[k].addTo(map);
      else map.removeLayer(basemaps[k]);
    });
  });
});

/* ---- UI ---- */
function estado(msg, color) {
  const el = document.getElementById('estado');
  el.innerHTML = msg;
  el.style.color = color || 'var(--text)';
}

function iniciarSpinner() {
  document.getElementById('estado').innerHTML = '<span class="spinner"></span> Cargando capas...';
}

function listarCapas() {
  const container = document.getElementById('listaCapas');
  container.innerHTML = TABLAS.map(t => `
    <div class="capa-card" style="border-left-color:${t.color}" data-tabla="${t.nombre}">
      <div class="header">
        <span class="nombre">
          <span class="legend-dot" style="background:${t.color};color:${t.color}"></span>
          ${t.nombre}
        </span>
        <span class="tipo">${t.icon}</span>
      </div>
      <div class="info">${t.desc}</div>
      <div class="count-badge" id="count-${t.nombre}"></div>
    </div>
  `).join('');
}

/* ---- DATA ---- */
function reprojectarGeom(geom) {
  if (!geom || !geom.type) return geom;
  return geom;
}

async function consultarTabla(tabla, color) {
  const url = `${CONFIG.supabaseUrl}/rest/v1/${tabla}?select=*&limit=5000`;
  const r = await fetch(url, {
    headers: {
      apikey: CONFIG.anonKey,
      Authorization: `Bearer ${CONFIG.anonKey}`
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} en "${tabla}"`);
  const datos = await r.json();
  if (!Array.isArray(datos) || datos.length === 0) return null;

  const features = [];
  for (const reg of datos) {
    let geom = null;
    for (const col of CONFIG.columnasGeom) {
      if (reg[col]) { geom = reg[col]; break; }
    }
    if (typeof geom === 'string') { try { geom = JSON.parse(geom); } catch (_) {} }
    if (geom && geom.type) {
      const g = reprojectarGeom(geom);
      if (g) features.push({ type: 'Feature', properties: reg, geometry: g });
    } else {
      let lat, lon;
      for (const c of CONFIG.columnasLatLon) {
        if (reg.lat !== undefined) lat ??= reg.lat;
        if (reg.latitude !== undefined) lat ??= reg.latitude;
        if (reg.latitud !== undefined) lat ??= reg.latitud;
        if (reg.lon !== undefined) lon ??= reg.lon;
        if (reg.lng !== undefined) lon ??= reg.lng;
        if (reg.longitude !== undefined) lon ??= reg.longitude;
        if (reg.longitud !== undefined) lon ??= reg.longitud;
      }
      if (lat !== undefined && lon !== undefined) {
        features.push({
          type: 'Feature', properties: reg,
          geometry: { type: 'Point', coordinates: [parseFloat(lon), parseFloat(lat)] }
        });
      }
    }
  }
  if (features.length === 0) return null;

  return L.geoJSON({ type: 'FeatureCollection', features }, {
    style: { color, weight: 2, fillOpacity: 0.25 },
    pointToLayer: (f, ll) => L.circleMarker(ll, {
      radius: 7, fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.8
    }),
    onEachFeature: (feature, layer) => {
      const campos = camposVisibles[tabla] || [];
      let html = `<span class="popup-title" style="color:${color}">${tabla}</span>`;
      let count = 0;
      for (const [key, label] of campos) {
        const v = feature.properties[key];
        if (v === null || v === undefined || v === '') continue;
        let val = String(v);
        if (key === 'image_url' || key === 'sound_url') {
          const txt = key === 'image_url' ? 'ver imagen' : 'escuchar';
          val = `<a href="${v}" target="_blank">🔗 ${txt}</a>`;
        }
        html += `<div class="popup-row"><span class="popup-label">${label}</span><span class="popup-value">${val}</span></div>`;
        count++;
      }
      if (count === 0) html += '<div class="popup-row" style="color:var(--text-muted)"><i>Sin atributos</i></div>';
      layer.bindPopup(html);
    }
  });
}

async function cargarTabla(tablaCfg) {
  const { nombre, color } = tablaCfg;
  const card = document.querySelector(`[data-tabla="${nombre}"]`);
  try {
    const capa = await consultarTabla(nombre, color);
    if (capa) {
      capa.addTo(map);
      controlLayers.addOverlay(capa, nombre);
      capasCargadas[nombre] = capa;
      if (card) {
        card.classList.add('loaded');
        const n = capa.getLayers().length;
        document.getElementById(`count-${nombre}`).textContent = `✦ ${n} elemento(s)`;
      }
      return capa;
    } else {
      if (card) {
        card.classList.add('loaded');
        document.getElementById(`count-${nombre}`).textContent = '— vacía';
      }
      return null;
    }
  } catch (err) {
    estado(`Error en "${nombre}": ${err.message}`, '#e94560');
    console.error(err);
    if (card) {
      card.classList.add('loaded');
      document.getElementById(`count-${nombre}`).textContent = '✗ error';
    }
    return null;
  }
}

async function recargarTodas() {
  Object.values(capasCargadas).forEach(c => map.removeLayer(c));
  capasCargadas = {};
  map.removeControl(controlLayers);
  controlLayers = L.control.layers(null, null, { collapsed: false }).addTo(map);
  document.querySelectorAll('.capa-card').forEach(c => c.classList.remove('loaded'));
  Object.keys(featureCounts).forEach(k => { document.getElementById(`count-${k}`).textContent = ''; });

  iniciarSpinner();
  const grupos = [];
  for (const t of TABLAS) {
    const capa = await cargarTabla(t);
    if (capa) grupos.push(capa);
  }
  if (grupos.length > 0) {
    const grupo = L.featureGroup(grupos);
    map.fitBounds(grupo.getBounds().pad(0.1));
  }
  const ok = Object.keys(capasCargadas).length;
  estado(`${ok}/${TABLAS.length} capas cargadas`, ok > 0 ? '#2ecc71' : 'var(--text-muted)');
}

function zoomTotal() {
  const layers = Object.values(capasCargadas);
  if (layers.length === 0) return;
  const g = L.featureGroup(layers);
  map.fitBounds(g.getBounds().pad(0.1));
}

/* ---- EVENTS ---- */
document.getElementById('btnRecargar').addEventListener('click', recargarTodas);
document.getElementById('btnZoom').addEventListener('click', zoomTotal);

/* ---- START ---- */
listarCapas();
recargarTodas();
