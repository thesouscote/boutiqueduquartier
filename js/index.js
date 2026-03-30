// ============================================
// INDEX.JS — Logique du site public
// ============================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { firebaseConfig } from './config.js';
import {
  getStatus, statusColor, statusLabel, badgeClass,
  shopIcon, formatDays, toMin, nowMin
} from './utils.js';

// === FIREBASE ===
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// === CARTE LEAFLET ===
const map = L.map('map', { zoomControl: true }).setView([5.3600, -4.0083], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

// === GÉOLOCALISATION UTILISATEUR ===
let userMarker = null;
let userCircle = null;

function locateUser() {
  const btn = document.getElementById('locateBtn');
  if (btn) { btn.classList.add('locating'); btn.textContent = '⏳'; }

  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    if (btn) { btn.classList.remove('locating'); btn.textContent = '📍'; }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      // Remove previous markers
      if (userMarker) map.removeLayer(userMarker);
      if (userCircle) map.removeLayer(userCircle);

      // Blue pulsing dot for user position
      userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="user-position-dot"><div class="user-position-pulse"></div></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        }),
        zIndexOffset: 1000
      }).addTo(map)
        .bindPopup('<div style="font-weight:700;font-size:14px;color:#60a5fa">📍 Vous êtes ici</div><div style="font-size:12px;color:#94a3b8">Précision: ~' + Math.round(accuracy) + 'm</div>');

      // Accuracy circle
      userCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 1.5,
        opacity: 0.3
      }).addTo(map);

      map.setView([lat, lng], 16, { animate: true });
      userMarker.openPopup();

      if (btn) { btn.classList.remove('locating'); btn.textContent = '📍'; }
    },
    (err) => {
      let msg = 'Impossible de déterminer votre position.';
      if (err.code === 1) msg = 'Veuillez autoriser l\'accès à votre position dans les paramètres du navigateur.';
      else if (err.code === 2) msg = 'Position indisponible. Vérifiez votre GPS/connexion.';
      else if (err.code === 3) msg = 'Délai de localisation dépassé. Réessayez.';
      alert(msg);
      if (btn) { btn.classList.remove('locating'); btn.textContent = '📍'; }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

// Add locate button to map
function addLocateButton() {
  const locateControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function () {
      const container = L.DomUtil.create('div', 'leaflet-bar locate-control');
      const btn = L.DomUtil.create('a', 'locate-btn', container);
      btn.id = 'locateBtn';
      btn.href = '#';
      btn.title = 'Ma position';
      btn.textContent = '📍';
      btn.setAttribute('role', 'button');
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(btn, 'click', function (e) {
        L.DomEvent.preventDefault(e);
        locateUser();
      });
      return container;
    }
  });
  map.addControl(new locateControl());
}
addLocateButton();

let markers = {};

function makeIcon(color, isUrgent = false) {
  const size = isUrgent ? 18 : 14;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px; height:${size}px;
      background:${color}; border-radius:50%;
      border:2.5px solid rgba(255,255,255,0.9);
      box-shadow:0 0 12px ${color}bb;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// === ÉTAT ===
let shops       = [];
let activeFilter = 'Tous';

// === FILTRES ===
export function applyFilters() {
  const search    = document.getElementById('searchInput').value.toLowerCase();
  const filtered  = shops.filter(s => {
    const matchCat    = activeFilter === 'Tous' || s.type === activeFilter;
    const matchSearch = !search
      || s.name.toLowerCase().includes(search)
      || (s.type || '').toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
  renderList(filtered);
}
// Exposé pour oninput dans le HTML
window.applyFilters = applyFilters;

function renderFilters() {
  const cats = ['Tous', ...new Set(shops.map(s => s.type).filter(Boolean))];
  const el   = document.getElementById('filters');
  el.innerHTML = '';

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (cat === activeFilter ? ' active' : '');
    btn.textContent = cat === 'Tous' ? 'Tous' : `${shopIcon(cat)} ${cat}`;
    btn.dataset.cat = cat;
    btn.onclick = () => {
      activeFilter = cat;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    };
    el.appendChild(btn);
  });
}

// === LISTE ===
function renderList(filtered) {
  const list = document.getElementById('shopList');
  if (!filtered) filtered = shops;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <p>Aucune boutique trouvée.</p>
      </div>`;
    return;
  }

  const order  = { open: 0, closing: 1, urgent: 2, dayoff: 3, closed: 4 };
  const sorted = [...filtered].sort((a, b) => order[getStatus(a)] - order[getStatus(b)]);

  list.innerHTML = '';

  sorted.forEach((shop, i) => {
    const s     = getStatus(shop);
    const color = statusColor(s);

    const div = document.createElement('div');
    div.className           = 'shop-card';
    div.style.animationDelay = `${i * 30}ms`;

    const hasPhoto = shop.photo && shop.photo.startsWith('http');
    const photoHTML = hasPhoto
      ? `<img class="shop-card-photo" src="${shop.photo}" alt="${shop.name}" loading="lazy">`
      : '';

    div.innerHTML = `
      ${photoHTML}
      <div class="shop-card-main">
        <div class="shop-indicator ${s === 'urgent' ? 'pulse-anim' : ''}"
             style="background:${color}"></div>
        <div class="shop-card-body">
          <div class="shop-card-top">
            <div class="shop-name">${shop.name}</div>
            <span class="shop-badge ${badgeClass(s)}">${statusLabel(s, shop)}</span>
          </div>
          <div class="shop-meta">
            <span class="shop-type-tag">${shopIcon(shop.type)} ${shop.type}</span>
            ${shop.days ? `<span class="shop-days-tag">${formatDays(shop.days)}</span>` : ''}
          </div>
          <div class="shop-hours">
            <strong>${shop.open_time}</strong>
            <span class="shop-hours-sep">–</span>
            <strong>${shop.close_time}</strong>
          </div>
          ${shop.phone ? `<div class="shop-phone">📞 ${shop.phone}</div>` : ''}
          ${shop.lat && shop.lng ? `
            <a class="shop-directions-btn" href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}&travelmode=walking" target="_blank" rel="noopener" onclick="event.stopPropagation()">
              🧭 Itinéraire
            </a>
          ` : ''}
        </div>
      </div>
    `;

    div.onclick = () => {
      document.querySelectorAll('.shop-card').forEach(c => c.classList.remove('active'));
      div.classList.add('active');
      if (shop.lat && shop.lng && markers[shop.id]) {
        map.setView([shop.lat, shop.lng], 17, { animate: true });
        markers[shop.id].openPopup();
      }
    };

    list.appendChild(div);
  });
}

// === MARQUEURS CARTE ===
function renderMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  shops.forEach(shop => {
    if (!shop.lat || !shop.lng) return;
    const s     = getStatus(shop);
    const color = statusColor(s);

    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}&travelmode=walking`;

    const m = L.marker([shop.lat, shop.lng], { icon: makeIcon(color, s === 'urgent') })
      .addTo(map)
      .bindPopup(`
        ${shop.photo ? `<img class="popup-photo" src="${shop.photo}" alt="${shop.name}">` : ''}
        <div class="popup-name">${shop.name}</div>
        <div class="popup-type">${shopIcon(shop.type)} ${shop.type}</div>
        <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px">
          ${statusLabel(s, shop)}
        </div>
        <div style="font-size:12px;color:#94a3b8">${shop.open_time} – ${shop.close_time}</div>
        ${shop.days
          ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${formatDays(shop.days)}</div>`
          : ''}
        ${shop.phone
          ? `<div style="font-size:12px;color:#4fc3f7;margin-top:5px">📞 ${shop.phone}</div>`
          : ''}
        <a href="${directionsUrl}" target="_blank" rel="noopener" class="popup-directions-btn">
          🧭 Itinéraire
        </a>
      `);

    markers[shop.id] = m;
  });
}

// === STATS ===
function renderStats() {
  let open = 0, closing = 0, closed = 0;
  shops.forEach(s => {
    const st = getStatus(s);
    if (st === 'closed' || st === 'dayoff') closed++;
    else if (st === 'open') open++;
    else closing++;
  });
  document.getElementById('cntOpen').textContent    = open;
  document.getElementById('cntClosing').textContent = closing;
  document.getElementById('cntClosed').textContent  = closed;
}

// === RENDU GÉNÉRAL ===
function renderAll() {
  renderFilters();
  applyFilters();
  renderMarkers();
  renderStats();
}

// === FIREBASE LISTENER ===
const q = query(collection(db, 'boutiques'), orderBy('name'));
onSnapshot(q, snapshot => {
  shops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderAll();
});

// === HORLOGE ===
function updateClock() {
  const n = new Date();
  document.getElementById('navClock').textContent =
    n.getHours().toString().padStart(2, '0') + ':' +
    n.getMinutes().toString().padStart(2, '0');
}
updateClock();
setInterval(() => { updateClock(); renderAll(); }, 30_000);
