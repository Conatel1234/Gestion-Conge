# Gestion des Congés — Système RH

Application complète (Node.js + Express + PostgreSQL + HTML/CSS/JS vanilla) pour
remplacer le suivi Excel des congés. Accès réservé au personnel RH (identifiant +
mot de passe).

## Fonctionnalités

- Journal des congés : Direction, Nom, Prénom, Type de congé, Période, jours
  demandés, jours restants, date de reprise de service.
- Calcul des jours **ouvrés uniquement** (weekends + jours off personnalisés exclus).
- Filtres actifs : Tous / En congé / À venir / Historique + recherche.
- Chaque **type de congé** a son propre quota de jours par exercice fiscal
  (Congé Annuel, Maladie, Maternité, Paternité, Sans Solde, Deuil — modifiables).
- **Exercice fiscal** chargeable (ex : 01 Octobre 2025 → 30 Septembre 2026),
  possibilité d'en créer et activer de nouveaux.
- Fiche employé avec **barre de progression** jours pris / jours disponibles,
  par type de congé.
- Alerte "reprises de service à venir" (7 jours) sur le tableau de bord.
- Export **Excel (.xlsx)** et **PDF** de la liste des congés.
- HR uniquement : connexion par session, aucune inscription publique.

## Stack

- Backend : Node.js, Express, PostgreSQL (`pg`), `express-session`, `bcrypt`
- Export : `exceljs` (Excel), `pdfkit` (PDF)
- Frontend : HTML / CSS / JavaScript natif (aucun framework, aucune build step)

## Installation (serveur local)

### 1. Prérequis
- Node.js 18+
- PostgreSQL installé et démarré localement

### 2. Créer la base de données
```bash
createdb gestion_conge
```

### 3. Installer les dépendances
```bash
cd gestion-conge
npm install
```

### 4. Configurer l'environnement
```bash
cp .env.example .env
# éditez .env avec vos identifiants PostgreSQL locaux
```

### 5. Créer les tables
```bash
psql -U postgres -d gestion_conge -f db/schema.sql
```

### 6. Initialiser les données (compte RH, types de congé, exercice fiscal)
```bash
npm run seed
```
Ceci affiche l'identifiant/mot de passe RH créé (par défaut `admin` / `admin123`,
personnalisable dans `.env` avant le seed).

### 7. Démarrer le serveur
```bash
npm start
# ou en développement avec rechargement auto :
npm run dev
```

Ouvrez ensuite **http://localhost:3000** — vous serez redirigé vers la page de
connexion.

## Déploiement en production avec PM2

### 1. Installer PM2 globalement
```bash
npm install -g pm2
```

### 2. Configurer l'environnement de production
Assurez-vous que votre fichier `.env` contient :
- Identifiants PostgreSQL de production
- `SESSION_SECRET` sécurisé (généré aléatoirement)
- Port approprié (défaut : 3000)

### 3. Démarrer avec PM2
```bash
pm2 start ecosystem.config.js
```

### 4. Commandes PM2 utiles
```bash
pm2 list                    # Voir tous les processus
pm2 logs gestion-conge      # Voir les logs
pm2 stop gestion-conge      # Arrêter l'application
pm2 restart gestion-conge   # Redémarrer l'application
pm2 delete gestion-conge    # Supprimer de PM2
pm2 monit                   # Surveiller CPU/mémoire
```

### 5. Démarrage automatique au boot
```bash
pm2 startup
pm2 save
```

## Structure du projet

```
gestion-conge/
├── db/schema.sql            # schéma PostgreSQL
├── server/
│   ├── index.js             # point d'entrée Express
│   ├── db.js                # pool PostgreSQL
│   ├── seed.js               # données initiales
│   ├── middleware/auth.js    # protection des routes RH
│   ├── utils/workingDays.js  # calcul des jours ouvrés (coeur métier)
│   └── routes/
│       ├── auth.js
│       ├── employees.js
│       ├── leaveTypes.js
│       ├── fiscalExercices.js
│       ├── holidays.js
│       ├── leaveRecords.js
│       ├── dashboard.js
│       └── exports.js        # Excel + PDF
└── public/                   # frontend HTML/CSS/JS
    ├── login.html / index.html / conges.html
    ├── employes.html / employe.html
    ├── types.html / feries.html
    ├── css/style.css
    └── js/ (un fichier par page + api.js partagé)
```

## Notes

- La date de reprise de service = premier jour ouvré après la date de fin du
  congé (weekends et jours off exclus).
- "Jours restants" = quota annuel du type de congé - jours déjà pris de ce
  même type sur l'exercice fiscal en cours.
- Un exercice fiscal inactif et sans congés peut être supprimé depuis le tableau
  de bord. Les exercices actifs ou contenant déjà des congés sont protégés.
- Pensez à changer `SESSION_SECRET` dans `.env` avant toute utilisation
  au-delà d'un poste de test.
