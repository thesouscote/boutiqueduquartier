// ============================================
// DASHBOARD.JS — Logique du tableau de bord admin
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc,
  addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { firebaseConfig } from './config.js';
import {
  DAYS_CONFIG, getStatus, statusColor, shopIcon, toMin, nowMin, isOpenToday
} from './utils.js';

// === FIREBASE ===
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ============================================
// AUTHENTIFICATION
// ============================================

window.doLogin = async () => {
  const email  = document.getElementById('loginEmail').value.trim();
  const pwd    = document.getElementById('loginPwd').value;
  const errEl  = document.getElementById('loginErr');
  const loadEl = document.getElementById('loginLoading');
  errEl.style.display  = 'none';
  loadEl.style.display = 'block';
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
  } catch {
    loadEl.style.display = 'none';
    errEl.style.display  = 'block';
  }
};

window.doLogout = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display         = 'flex';
    document.getElementById('userEmail').textContent     = user.email.split('@')[0];
    initApp();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display         = 'none';
  }
});

// ============================================
// ÉTAT GLOBAL
// ============================================
let shops     = [];
let editingId = null;

// ============================================
// LISTE DES BOUTIQUES (panneau gauche)
// ============================================

window.renderShopList = () => {
  const query2   = (document.getElementById('searchInput').value || '').toLowerCase();
  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(query2) ||
    (s.type || '').toLowerCase().includes(query2)
  );
  document.getElementById('shopCount').textContent = shops.length;
  const scroll = document.getElementById('shopScroll');

  if (filtered.length === 0) {
    scroll.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">
        Aucune boutique
      </div>`;
    return;
  }

  scroll.innerHTML = '';
  filtered.forEach(shop => {
    const s   = getStatus(shop);
    const div = document.createElement('div');
    div.className = 'shop-row' + (shop.id === editingId ? ' selected' : '');
    div.innerHTML = `
      <div class="shop-row-dot" style="background:${statusColor(s)}"></div>
      <div class="shop-row-info">
        <div class="shop-row-name">${shopIcon(shop.type)} ${shop.name}</div>
        <div class="shop-row-meta">${shop.type} · ${shop.open_time}–${shop.close_time}</div>
      </div>
      <div class="shop-row-actions">
        <button class="icon-btn" title="Modifier"
          onclick="editShop('${shop.id}');event.stopPropagation()">✏️</button>
        <button class="icon-btn del" title="Supprimer"
          onclick="confirmDelete('${shop.id}','${shop.name.replace(/'/g, "\\'")}');event.stopPropagation()">🗑</button>
      </div>
    `;
    div.onclick = () => editShop(shop.id);
    scroll.appendChild(div);
  });
};

// ============================================
// CARTE PICKER (positionnement boutique)
// ============================================

let pickerMap            = null;
let pickerMarker         = null;
let pickerExistingMarkers = [];

function initPickerMap() {
  if (pickerMap) {
    setTimeout(() => { pickerMap.invalidateSize(); renderPickerExisting(); }, 100);
    return;
  }
  pickerMap = L.map('mapPicker').setView([5.3600, -4.0083], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
    .addTo(pickerMap);
  pickerMap.on('click', e => setCoords(e.latlng.lat, e.latlng.lng));
  setTimeout(() => { pickerMap.invalidateSize(); renderPickerExisting(); }, 200);
}

/** Affiche les boutiques déjà placées sur la carte picker */
function renderPickerExisting() {
  if (!pickerMap) return;
  pickerExistingMarkers.forEach(m => pickerMap.removeLayer(m));
  pickerExistingMarkers = [];

  shops.forEach(shop => {
    if (!shop.lat || !shop.lng)  return;
    if (shop.id === editingId)   return; // ne pas afficher soi-même

    const color = statusColor(getStatus(shop));
    const icon  = L.divIcon({
      className: '',
      html: `<div title="${shop.name}" style="
        width:12px; height:12px;
        background:${color}; border-radius:50%;
        border:2px solid rgba(255,255,255,0.8);
        box-shadow:0 0 6px ${color}99;
      "></div>`,
      iconSize: [12, 12], iconAnchor: [6, 6]
    });

    const m = L.marker([shop.lat, shop.lng], { icon })
      .addTo(pickerMap)
      .bindTooltip(
        `<b>${shop.name}</b><br><span style="font-size:11px;color:#94a3b8">${shop.type}</span>`,
        { direction: 'top', offset: [0, -8], className: 'picker-tooltip' }
      );
    pickerExistingMarkers.push(m);
  });
}

function setCoords(lat, lng) {
  document.getElementById('f-lat').value          = lat.toFixed(6);
  document.getElementById('f-lng').value          = lng.toFixed(6);
  document.getElementById('coordsDisplay').textContent =
    `📍 Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  if (pickerMarker) pickerMap.removeLayer(pickerMarker);
  pickerMarker = L.marker([lat, lng]).addTo(pickerMap);
}

window.locateMe = () => {
  if (!navigator.geolocation) {
    showToast('⚠️ Géolocalisation non supportée', 'error');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      if (!pickerMap) return;
      pickerMap.setView([pos.coords.latitude, pos.coords.longitude], 17);
      setCoords(pos.coords.latitude, pos.coords.longitude);
    },
    () => showToast('⚠️ Impossible d\'obtenir la position', 'error')
  );
};

// ============================================
// SÉLECTEUR DE JOURS
// ============================================

function buildDaysGrid(selectedDays) {
  const grid = document.getElementById('daysGrid');
  grid.innerHTML = '';
  DAYS_CONFIG.forEach(({ idx, label, num }) => {
    const wrap = document.createElement('div');
    wrap.className = 'day-toggle';
    wrap.innerHTML = `
      <input type="checkbox" id="day${idx}" value="${idx}"
             ${selectedDays.includes(idx) ? 'checked' : ''}>
      <label for="day${idx}">
        ${label}
        <span class="day-num">${num}</span>
      </label>
    `;
    grid.appendChild(wrap);
  });
}

function getSelectedDays() {
  return DAYS_CONFIG
    .map(d => d.idx)
    .filter(idx => document.getElementById(`day${idx}`)?.checked);
}

// ============================================
// CUSTOM 24H TIME PICKERS
// ============================================

let _timePickersInit = false;

function initTimePickers() {
  if (_timePickersInit) return;
  ['f-open', 'f-close'].forEach(prefix => {
    const hSel = document.getElementById(`${prefix}-h`);
    const mSel = document.getElementById(`${prefix}-m`);
    const hidden = document.getElementById(prefix);
    if (!hSel || !mSel) return;

    // Populate hours 00–23
    hSel.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      const val = String(h).padStart(2, '0');
      hSel.innerHTML += `<option value="${val}">${val}h</option>`;
    }
    // Populate minutes 00, 15, 30, 45
    mSel.innerHTML = '';
    [0, 15, 30, 45].forEach(m => {
      const val = String(m).padStart(2, '0');
      mSel.innerHTML += `<option value="${val}">${val}</option>`;
    });

    // Sync hidden input on change
    const sync = () => { hidden.value = `${hSel.value}:${mSel.value}`; };
    hSel.addEventListener('change', sync);
    mSel.addEventListener('change', sync);
  });
  _timePickersInit = true;
}

function setTimePicker(prefix, timeStr) {
  // Ensure pickers are initialized
  initTimePickers();
  const [h, m] = (timeStr || '08:00').split(':');
  const hSel = document.getElementById(`${prefix}-h`);
  const mSel = document.getElementById(`${prefix}-m`);
  const hidden = document.getElementById(prefix);
  if (!hSel || !mSel) return;
  hSel.value = h.padStart(2, '0');
  // Snap to nearest available minute option
  const mNum = parseInt(m);
  const available = [0, 15, 30, 45];
  const closest = available.reduce((prev, curr) =>
    Math.abs(curr - mNum) < Math.abs(prev - mNum) ? curr : prev
  );
  mSel.value = String(closest).padStart(2, '0');
  hidden.value = `${hSel.value}:${mSel.value}`;
}

// ============================================
// FORMULAIRE (créer / modifier)
// ============================================

function resetForm() {
  ['f-name', 'f-phone'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-type').value  = 'Épicerie';
  setTimePicker('f-open', '08:00');
  setTimePicker('f-close', '18:00');
  document.getElementById('f-lat').value   = '';
  document.getElementById('f-lng').value   = '';
  document.getElementById('coordsDisplay').textContent = '📍 Aucune position définie';
  if (pickerMarker && pickerMap) { pickerMap.removeLayer(pickerMarker); pickerMarker = null; }
  buildDaysGrid([1, 2, 3, 4, 5, 6]); // Lun–Sam par défaut
}

function showForm() {
  document.getElementById('emptyForm').style.display    = 'none';
  document.getElementById('shopForm').style.display     = 'block';
  document.getElementById('formActions').style.display  = 'flex';
}

window.openNew = () => {
  editingId = null;
  switchTab('form');
  resetForm();
  showForm();
  document.getElementById('formTitleText').textContent = 'Nouvelle boutique';
  document.getElementById('formBadge').textContent     = 'Nouveau';
  document.getElementById('formBadge').style.cssText   =
    'background:rgba(34,197,94,.15);color:#22c55e';
  renderShopList();
  setTimeout(initPickerMap, 100);
};

window.editShop = (id) => {
  const shop = shops.find(s => s.id === id);
  if (!shop) return;
  editingId = id;
  switchTab('form');
  showForm();

  document.getElementById('formTitleText').textContent = shop.name;
  document.getElementById('formBadge').textContent     = 'Modifier';
  document.getElementById('formBadge').style.cssText   =
    'background:rgba(240,192,64,.12);color:var(--accent)';

  document.getElementById('f-name').value  = shop.name;
  document.getElementById('f-type').value  = shop.type;
  document.getElementById('f-phone').value = shop.phone || '';
  setTimePicker('f-open', shop.open_time);
  setTimePicker('f-close', shop.close_time);
  document.getElementById('f-lat').value   = shop.lat || '';
  document.getElementById('f-lng').value   = shop.lng || '';
  document.getElementById('coordsDisplay').textContent = shop.lat
    ? `📍 Lat: ${parseFloat(shop.lat).toFixed(5)}, Lng: ${parseFloat(shop.lng).toFixed(5)}`
    : '📍 Aucune position définie';

  buildDaysGrid(shop.days?.length ? shop.days : [1, 2, 3, 4, 5, 6]);

  renderShopList();
  setTimeout(() => {
    initPickerMap();
    if (shop.lat && shop.lng) {
      pickerMap.setView([shop.lat, shop.lng], 16);
      if (pickerMarker) pickerMap.removeLayer(pickerMarker);
      pickerMarker = L.marker([shop.lat, shop.lng]).addTo(pickerMap);
      pickerMap.invalidateSize();
    }
  }, 120);
};

window.cancelForm = () => {
  editingId = null;
  document.getElementById('emptyForm').style.display   = 'flex';
  document.getElementById('shopForm').style.display    = 'none';
  document.getElementById('formActions').style.display = 'none';
  renderShopList();
};

window.saveShop = async () => {
  const name       = document.getElementById('f-name').value.trim();
  const type       = document.getElementById('f-type').value;
  const phone      = document.getElementById('f-phone').value.trim();
  const open_time  = document.getElementById('f-open').value;
  const close_time = document.getElementById('f-close').value;
  const lat        = parseFloat(document.getElementById('f-lat').value)  || null;
  const lng        = parseFloat(document.getElementById('f-lng').value)  || null;
  const days       = getSelectedDays();

  // Validation
  if (!name)              { showToast('⚠️ Le nom est obligatoire', 'error');              return; }
  if (!open_time || !close_time) { showToast('⚠️ Les horaires sont obligatoires', 'error'); return; }
  if (toMin(open_time) >= toMin(close_time)) {
    showToast('⚠️ Fermeture doit être après ouverture', 'error'); return;
  }
  if (days.length === 0) { showToast('⚠️ Sélectionnez au moins un jour', 'error'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Enregistrement…';

  try {
    const data = {
      name, type, phone, open_time, close_time,
      lat, lng, days,
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      await updateDoc(doc(db, 'boutiques', editingId), data);
      showToast('✅ Boutique mise à jour !', 'success');
    } else {
      data.created_at = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'boutiques'), data);
      editingId    = docRef.id;
      showToast('✅ Boutique ajoutée !', 'success');
    }

    document.getElementById('formTitleText').textContent = name;
    document.getElementById('formBadge').textContent     = 'Modifier';
    document.getElementById('formBadge').style.cssText   =
      'background:rgba(240,192,64,.12);color:var(--accent)';
  } catch (e) {
    console.error(e);
    showToast('❌ Erreur : ' + e.message, 'error');
  }

  btn.disabled  = false;
  btn.innerHTML = '💾 Enregistrer';
};

window.confirmDelete = async (id, name) => {
  if (!confirm(`Supprimer "${name}" ?\nCette action est irréversible.`)) return;
  try {
    await deleteDoc(doc(db, 'boutiques', id));
    if (editingId === id) cancelForm();
    showToast('🗑 Boutique supprimée', 'success');
  } catch {
    showToast('❌ Erreur lors de la suppression', 'error');
  }
};

// ============================================
// ONGLETS
// ============================================

let overviewMap = null;

window.switchTab = (tab) => {
  ['form', 'map', 'stats'].forEach(t => {
    document.getElementById(t + 'Tab').style.display = 'none';
    document.getElementById('tab-' + t).classList.remove('active');
  });

  const el = document.getElementById(tab + 'Tab');
  el.style.display = tab === 'form' ? 'flex' : 'block';
  document.getElementById('tab-' + tab).classList.add('active');

  if (tab === 'map') {
    setTimeout(() => {
      if (!overviewMap) {
        overviewMap = L.map('mapOverview').setView([5.3600, -4.0083], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
          .addTo(overviewMap);
      }
      overviewMap.invalidateSize();
      renderOverviewMap();
    }, 100);
  }
  if (tab === 'stats') renderStatsTab();
};

function renderOverviewMap() {
  if (!overviewMap) return;
  overviewMap.eachLayer(l => { if (l instanceof L.Marker) overviewMap.removeLayer(l); });

  shops.forEach(shop => {
    if (!shop.lat || !shop.lng) return;
    const color = statusColor(getStatus(shop));
    const icon  = L.divIcon({
      className: '',
      html: `<div style="
        width:14px; height:14px; background:${color}; border-radius:50%;
        border:2.5px solid rgba(255,255,255,.9); box-shadow:0 0 10px ${color}bb;
      "></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7]
    });
    L.marker([shop.lat, shop.lng], { icon }).addTo(overviewMap)
      .bindPopup(`
        <b style="color:#fff;font-size:14px">${shopIcon(shop.type)} ${shop.name}</b><br>
        <span style="color:#94a3b8;font-size:12px">${shop.type} · ${shop.open_time}–${shop.close_time}</span>
      `);
  });
}

// ============================================
// STATISTIQUES
// ============================================

function renderStatsTab() {
  let open = 0, closing = 0, closed = 0, dayoff = 0;
  shops.forEach(s => {
    const st = getStatus(s);
    if (st === 'closed')        closed++;
    else if (st === 'open')     open++;
    else if (st === 'dayoff')   dayoff++;
    else                        closing++;
  });

  const cats   = {};
  shops.forEach(s => { cats[s.type] = (cats[s.type] || 0) + 1; });
  const maxCat = Math.max(...Object.values(cats), 1);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">🏪</div>
      <div class="stat-label">Total</div>
      <div class="stat-num" style="color:var(--accent)">${shops.length}</div>
      <div class="stat-sub">boutiques enregistrées</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div class="stat-label">Ouvertes</div>
      <div class="stat-num" style="color:var(--green)">${open}</div>
      <div class="stat-sub">en ce moment</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⏳</div>
      <div class="stat-label">Ferment bientôt</div>
      <div class="stat-num" style="color:var(--orange)">${closing}</div>
      <div class="stat-sub">moins de 30 minutes</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">💤</div>
      <div class="stat-label">Fermées / Repos</div>
      <div class="stat-num" style="color:var(--muted)">${closed + dayoff}</div>
      <div class="stat-sub">dont ${dayoff} en repos</div>
    </div>
  `;

  const catList = document.getElementById('categoryList');
  catList.innerHTML = '';
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    const pct = Math.round((count / maxCat) * 100);
    const div = document.createElement('div');
    div.className = 'cat-row';
    div.innerHTML = `
      <div class="cat-row-icon">${shopIcon(type)}</div>
      <div class="cat-row-info">
        <div class="cat-row-name">${type}</div>
        <div class="cat-row-bar">
          <div class="cat-row-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="cat-row-count">${count}</div>
    `;
    catList.appendChild(div);
  });
}

// ============================================
// TOAST (notifications)
// ============================================

let toastTimer = null;

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = `toast ${type}`; }, 3500);
}

// ============================================
// INITIALISATION
// ============================================

function initApp() {
  initTimePickers();
  const q = query(collection(db, 'boutiques'), orderBy('name'));
  onSnapshot(q, snapshot => {
    shops = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderShopList();
    renderOverviewMap();
  });
}
