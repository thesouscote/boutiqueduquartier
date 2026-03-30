# 🏘 Boutikinator — Trouvez vos boutiques

Plateforme de disponibilité en temps réel des boutiques de votre quartier.

## Structure du projet

```
boutiqueduquartier/
├── index.html          # Site public (visiteurs)
├── dashboard.html      # Espace admin (gérant)
│
├── css/
│   ├── common.css      # Variables, reset, composants partagés
│   ├── index.css       # Styles spécifiques au site public
│   └── dashboard.css   # Styles spécifiques au dashboard admin
│
├── js/
│   ├── config.js       # Configuration Firebase (clés, projet)
│   ├── utils.js        # Fonctions utilitaires partagées
│   ├── index.js        # Logique du site public
│   └── dashboard.js    # Logique du dashboard admin
│
├── package.json        # Scripts npm
└── README.md           # Ce fichier
```

## Lancer le projet en local

> ⚠️ Les modules ES (`import/export`) nécessitent un serveur HTTP.  
> Ne pas ouvrir les fichiers directement avec `file://` dans le navigateur.

### Première installation

```bash
npm install
```

### Démarrer le serveur de développement

```bash
npm run dev
```

Puis ouvrir : **http://localhost:3000**

---

## Pages

| Page | URL | Accès |
|---|---|---|
| Site public | `/index.html` | Tout le monde |
| Dashboard admin | `/dashboard.html` | Authentification Firebase |

## Stack technique

- **Frontend** : HTML5 / CSS3 / JavaScript ES Modules (vanilla)
- **Base de données** : Firebase Firestore (temps réel)
- **Authentification** : Firebase Auth (email/mot de passe)
- **Carte** : Leaflet.js + CartoDB dark tiles
- **Typographie** : Plus Jakarta Sans (Google Fonts)
- **Serveur dev** : `serve` (npm)

## Fonctionnalités

### Site public (`index.html`)
- Affichage en temps réel des boutiques (toutes les 30s)
- Statuts : ✅ Ouvert / ⏳ Ferme bientôt / 🔴 Urgent (<10 min) / 💤 Repos / ⚫ Fermé
- Gestion des jours d'ouverture (ex: « Fermé le dimanche »)
- Recherche par nom ou catégorie
- Filtres par type de boutique
- Carte interactive avec marqueurs colorés
- Design dark mode responsive

### Dashboard admin (`dashboard.html`)
- Connexion sécurisée (Firebase Auth)
- CRUD complet : créer, modifier, supprimer des boutiques
- Sélecteur de jours d'ouverture (Lun–Dim)
- Placement précis sur carte avec bouton géolocalisation
- Carte vue d'ensemble de toutes les boutiques
- Statistiques : totaux, statuts, catégories avec barres de progression

## Firebase — Règles Firestore recommandées

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boutiques/{shopId} {
      allow read: if true;               // Lecture publique
      allow write: if request.auth != null; // Écriture admin uniquement
    }
  }
}
```
