// ============================================
// UTILS.JS — Fonctions utilitaires partagées
// ============================================

// === JOURS ===
export const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const DAYS_CONFIG = [
  { idx: 1, label: 'LUN', num: '01' },
  { idx: 2, label: 'MAR', num: '02' },
  { idx: 3, label: 'MER', num: '03' },
  { idx: 4, label: 'JEU', num: '04' },
  { idx: 5, label: 'VEN', num: '05' },
  { idx: 6, label: 'SAM', num: '06' },
  { idx: 0, label: 'DIM', num: '07' },
];

/** Formate un tableau de jours en texte lisible */
export function formatDays(days) {
  if (!days || days.length === 0) return 'Tous les jours';
  if (days.length === 7) return 'Tous les jours';

  const sorted = [...days].sort((a, b) => a - b);

  if (sorted.join(',') === '1,2,3,4,5') return 'Lun – Ven';
  if (sorted.join(',') === '1,2,3,4,5,6') return 'Lun – Sam';
  if (sorted.join(',') === '0,6' || sorted.join(',') === '6,0') return 'Week-end';

  if (sorted.length >= 5) {
    const missing = [0, 1, 2, 3, 4, 5, 6].filter(d => !sorted.includes(d));
    if (missing.length <= 2) {
      const missingNames = missing.map(d => DAYS_FR[d]).join(', ');
      return missing.length ? `Sauf ${missingNames}` : 'Tous les jours';
    }
  }

  return sorted.map(d => DAYS_FR[d]).join(', ');
}

/** Vérifie si la boutique est ouverte aujourd'hui (jour de la semaine) */
export function isOpenToday(shop) {
  if (!shop.days || shop.days.length === 0) return true; // compatibilité ascendante
  const today = new Date().getDay(); // 0=Dim … 6=Sam
  return shop.days.includes(today);
}

// === HORAIRES ===

/** Retourne l'heure actuelle en minutes depuis minuit */
export function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Convertit "HH:MM" en minutes */
export function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// === STATUT ===

/**
 * Retourne le statut d'une boutique :
 * 'open' | 'closing' | 'urgent' | 'closed' | 'dayoff'
 */
export function getStatus(shop) {
  if (!isOpenToday(shop)) return 'dayoff';
  const now = nowMin();
  const o = toMin(shop.open_time);
  const c = toMin(shop.close_time);
  if (now < o || now >= c) return 'closed';
  const rem = c - now;
  if (rem <= 10) return 'urgent';
  if (rem <= 30) return 'closing';
  return 'open';
}

/** Retourne la couleur CSS associée à un statut */
export function statusColor(s) {
  if (s === 'open')    return '#22c55e';
  if (s === 'closing') return '#f97316';
  if (s === 'urgent')  return '#ef4444';
  return '#334155';
}

/** Retourne le texte du badge statut */
export function statusLabel(s, shop) {
  if (s === 'dayoff') return 'Repos';
  if (s === 'closed') return 'Fermé';
  if (s === 'open')   return 'Ouvert';
  const rem = toMin(shop.close_time) - nowMin();
  return `Ferme dans ${rem}min`;
}

/** Retourne la classe CSS du badge */
export function badgeClass(s) {
  if (s === 'open')    return 'badge-open';
  if (s === 'closing') return 'badge-closing';
  if (s === 'urgent')  return 'badge-urgent';
  if (s === 'dayoff')  return 'badge-dayoff';
  return 'badge-closed';
}

// === CATÉGORIES ===

/** Retourne l'emoji correspondant au type de boutique */
export function shopIcon(type) {
  const icons = {
    'Épicerie':     '🛒',
    'Pharmacie':    '💊',
    'Boulangerie':  '🥖',
    'Pressing':     '👔',
    'Téléphonie':   '📱',
    'Coiffeur':     '✂️',
    'Restaurant':   '🍽',
    'Maquis':       '🍺',
    'Quincaillerie':'🔧',
    'Couture':      '🪡',
  };
  return icons[type] || '🏪';
}
