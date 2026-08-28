# Instructions de continuite du projet

## Regle prioritaire

Ce fichier est la source de continuite du projet `gestion-conge`. Avant toute modification, lire ce fichier, `PROJECT-CONTEXT.md`, `README.md` et les fichiers directement concernes. Ne jamais reinitialiser, remplacer ou recreer le projet sans verifier les changements locaux et demander confirmation en cas de doute.

Preserver les modifications existantes de l'utilisateur. Faire des changements cibles, ne pas supprimer une fonctionnalite pour simplifier une tache et ne pas modifier les fichiers sans rapport.

## Etat actuel au 2026-08-24

- Application RH de gestion des conges.
- Backend : Node.js, Express et PostgreSQL avec `pg`.
- Frontend : HTML, CSS et JavaScript natif, sans framework ni build step.
- Point d'entree serveur : `server/index.js`.
- Fichiers statiques : `public/`.
- Base locale : PostgreSQL 18, base `gestion_conge`, port `5432`.
- Application locale : `http://localhost:3000`.
- Lanceur Windows : `scripts/start-gestion-conge.ps1` ; il verifie PostgreSQL, evite les doubles instances, demarre Node et ouvre le navigateur.
- Lanceur production : `scripts/start-production.ps1` ; il verifie `.env`, PostgreSQL et le port `3000`, puis lance Node avec `NODE_ENV=production` sans Nodemon.
- Service Windows PostgreSQL : `postgresql-x64-18`.
- Chemin habituel des outils PostgreSQL : `C:\Program Files\PostgreSQL\18\bin`.

## Fonctionnalites deja realisees

- Authentification RH par session avec `bcrypt`.
- Deconnexion automatique apres 15 minutes d'inactivite sur les pages protegees, avec retour vers `login.html`; le minuteur partage est dans `public/js/api.js`.
- Le champ mot de passe de `login.html` possede un bouton accessible pour afficher ou masquer la saisie.
- Gestion des employes, directions, types de conge, exercices fiscaux, jours off et conges.
- Calcul des jours ouvres et de la date de reprise.
- Employes avec `statut` `employe` ou `contractuel`.
- Anciennete calculee dynamiquement depuis `date_embauche` jusqu'a la date du jour.
- Quota du `Congé Spécial` calcule selon l'anciennete : jusqu'a 5 ans = 15 jours, de 6 a 10 ans = 20 jours, a partir de 11 ans = 25 jours.
- Liste des conges filtrable par statut du conge, direction, statut employe et recherche.
- Types de conge activables/desactivables depuis `types.html` ; un type inactif reste visible dans l'administration et l'historique, mais n'est plus propose pour un nouveau conge.
- Le controle d'activation des types est un interrupteur accessible : `OFF` gris pour inactif et `ON` vert pour actif, avec confirmation avant changement.
- Import des jours feries depuis CSV ou PDF dans `feries.html`, avec validation des dates, doublons ignores et limite de 5 Mo. La dependance `pdf-parse` est necessaire.
- Generation automatique des jours feries haitiens pour chaque exercice fiscal actif, dans `server/utils/haitianHolidays.js` ; les dates fixes et mobiles sont ajoutees sans doublons lors du chargement, de la creation ou de l'activation d'un exercice.
- Page `backups.html` disponible dans le navbar pour telecharger une sauvegarde JSON complete et restaurer les donnees par transaction, avec validation et confirmation avant remplacement.
- Export CSV des employes avec le statut.
- Export Excel et PDF des conges avec le statut employe.
- Logo du sidebar : import local possible, avec logo par defaut `images/logo Conate.png`.
- En-tete officiel CONATEL reutilisable pour les impressions : `public/js/documentHeader.js` et `server/utils/documentHeader.js`.
- Logo des documents : `images/logo_header.png`, servi par `/images`.
- Impressions des fiches employe, des fiches multi-employes et de la liste des conges en A4 portrait.
- Impression d'une fiche employe : les soldes par type sont masques et seuls les conges enregistres sont imprimes. Le filtre propose les conges pris et a venir, pris/en cours ou a venir.
- Couleur institutionnelle principale : `#163cb6`, utilisee notamment dans le sidebar, les actions principales et les selections actives.

## Architecture a respecter

- Routes backend dans `server/routes/`.
- Authentification dans `server/middleware/auth.js`.
- Connexion PostgreSQL centralisee dans `server/db.js`.
- Calculs metier partages dans `server/utils/`, notamment `workingDays.js` et `seniority.js`.
- En-tete PDF dans `server/utils/documentHeader.js`.
- En-tete impression navigateur dans `public/js/documentHeader.js`.
- Un script page par HTML dans `public/js/`; `api.js` contient les appels partages et le sidebar.
- Schema de reference dans `db/schema.sql`.
- Toute evolution de schema doit etre compatible avec une base existante et documentee par une commande de migration ou une section SQL idempotente.

## Base de donnees et migrations

Tables actuelles : `hr_users`, `fiscal_exercices`, `leave_types`, `employees`, `holidays`, `leave_records`.

La table `employees` contient aussi :

```sql
statut VARCHAR(20) NOT NULL DEFAULT 'employe'
CHECK (statut IN ('employe', 'contractuel'))
```

Sur une nouvelle base, appliquer `db/schema.sql`. Sur une base deja creee, ne pas detruire les donnees : executer une migration idempotente similaire a :

```sql
ALTER TABLE employees ADD COLUMN IF NOT EXISTS statut VARCHAR(20) NOT NULL DEFAULT 'employe';
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_statut_check;
ALTER TABLE employees ADD CONSTRAINT employees_statut_check CHECK (statut IN ('employe', 'contractuel'));
```

Avant une migration importante, sauvegarder la base avec `pg_dump`. Ne jamais utiliser `DROP DATABASE`, `DROP TABLE` ou reinitialiser les donnees sans demande explicite.

## Installation sur un nouvel ordinateur Windows

1. Installer Node.js LTS et PostgreSQL 18.
2. Copier tout le dossier du projet, y compris `db/`, `images/`, `public/`, `server/`, `package.json` et `package-lock.json`.
3. Ouvrir un nouveau terminal apres l'installation pour actualiser le `PATH`.
4. Demarrer le service PostgreSQL et noter le mot de passe choisi pour l'utilisateur `postgres`.
5. Creer `.env` localement. Ne jamais copier ses secrets dans ce fichier d'instructions.
6. Installer les dependances avec `npm.cmd install`.
7. Creer la base `gestion_conge`, puis appliquer `db/schema.sql`.
8. Lancer `npm.cmd run seed`.
9. Demarrer avec `npm.cmd start`, puis ouvrir `http://localhost:3000`.

Commandes PowerShell depuis le dossier contenant `package.json` :

```powershell
npm.cmd install
psql -U postgres -c "CREATE DATABASE gestion_conge;"
psql -U postgres -d gestion_conge -f db/schema.sql
npm.cmd run seed
npm.cmd start
```

Si la base existe deja, ne pas recreer la base : appliquer uniquement les migrations necessaires et lancer le seed avec prudence.

## Configuration `.env`

Valeurs attendues en local :

```dotenv
PGHOST=localhost
PGPORT=5432
PGDATABASE=gestion_conge
PGUSER=postgres
PGPASSWORD=mot_de_passe_postgres_local
PORT=3000
SESSION_SECRET=secret_long_aleatoire
SEED_HR_USERNAME=admin
SEED_HR_PASSWORD=mot_de_passe_rh_local
```

Ne jamais afficher, copier ou enregistrer dans la documentation `PGPASSWORD`, `SESSION_SECRET` ou un mot de passe RH reel. Le compte RH de test peut etre `admin`, mais son mot de passe doit etre remplace avant toute utilisation professionnelle. Le seed ajoute les types de conge et l'exercice fiscal par defaut ; il n'est pas une procedure de changement de mot de passe pour un compte deja existant.

## Commandes de developpement

```powershell
npm.cmd install
npm.cmd start
npm.cmd run prod
npm.cmd run dev
npm.cmd run seed
```

`npm.cmd` est prefere dans PowerShell lorsque la politique d'execution bloque `npm.ps1`. `npm start` ne recharge pas automatiquement les changements backend : arreter l'ancien processus Node qui occupe le port `3000`, puis relancer le serveur. `npm run dev` utilise Nodemon.

La commande correcte de developpement sous Windows est `npm.cmd run dev`; `npx run dev` est incorrect et peut echouer.

Pour le lancement production local :

```powershell
npm.cmd run prod
```

Pour le lancement production controle sous Windows :

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\scripts\start-production.ps1
```

Le mode production ne doit pas etre lance en meme temps que `npm.cmd run dev` ou `npm.cmd start` sur le port `3000`. Le script s'arrete volontairement si le port est deja utilise. Il ne lance pas de navigateur automatiquement et reste au premier plan pour que les erreurs soient visibles.

## Demarrage automatique Windows

Le script `scripts/start-gestion-conge.ps1` est le point d'entree recommande sur le poste RH. Il utilise les chemins installes de Node.js et PostgreSQL 18, demarre le service PostgreSQL si necessaire, verifie `http://localhost:3000/login.html`, demarre `server/index.js` si le serveur n'est pas deja actif, puis ouvre le navigateur.

Pour l'utiliser manuellement :

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
& .\scripts\start-gestion-conge.ps1
```

Pour l'executer au demarrage de Windows, creer un raccourci dans `shell:startup` avec la cible suivante (adapter le chemin du projet) :

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\chemin\vers\gestion-conge\scripts\start-gestion-conge.ps1"
```

Le compte Windows doit avoir le droit de demarrer le service PostgreSQL. Pour un poste professionnel partage, le Planificateur de taches Windows est plus fiable qu'un raccourci : declencheur "A l'ouverture de session", option "Executer uniquement quand l'utilisateur est connecte", et action `powershell.exe` avec les memes arguments. Ne pas utiliser "Executer avec les autorisations maximales" sauf si le service l'exige.

## Verification obligatoire apres modification

- JavaScript : `node --check fichier.js` sur chaque script modifie.
- Backend : tester l'API concernee et verifier le code HTTP.
- Base : verifier la migration et les contraintes sans exposer le mot de passe.
- Frontend : ouvrir la page concernee sur `http://localhost:3000` et actualiser avec `Ctrl+F5`.
- Impression : tester l'aperçu A4 portrait, les marges, le logo, les sauts de page et les donnees filtrees.
- Avant livraison : relire le diff, verifier qu'aucun secret ou fichier utilisateur n'a ete supprime et documenter les limites restantes.

## Regles de securite et de qualite

- Utiliser des requetes SQL parametrees et les API ORM sures lorsqu'elles existent.
- Valider les donnees aux limites des routes et verifier l'autorisation cote serveur.
- Ne jamais faire confiance aux seuls controles du navigateur.
- Proteger les sessions, les cookies, les secrets, les exports, les fichiers importes et les messages d'erreur.
- Les sauvegardes applicatives ne doivent pas contenir de secrets : elles contiennent les donnees metier des tables mais pas les variables `.env`.
- Ne pas ajouter de dependance sans necessite ; mettre a jour `package-lock.json` si une dependance est ajoutee.
- Pour une revue de securite, analyser les entrees non fiables, injections, XSS, CSRF, controles d'acces, sessions, uploads, exports, erreurs, dependances et configuration.
- Signaler les risques par severite, corriger les problemes autorises et ajouter une verification ou une regression lorsque c'est possible.
- Ne jamais declarer le projet totalement securise ou pret pour la production sans preciser ce qui a ete verifie et ce qui reste a faire.

## Sauvegarde et continuite

Avant de changer d'ordinateur ou de faire une grosse modification :

```powershell
pg_dump -U postgres -d gestion_conge -F c -f gestion_conge.backup
```

Conserver ensemble le dossier du projet, `package-lock.json`, le backup PostgreSQL et une copie securisee des valeurs `.env` hors du depot. Sur le nouvel ordinateur, restaurer la base avec `pg_restore` dans une base vide, puis verifier le schema et les donnees avant de lancer l'application.

Ne jamais considerer `node_modules` comme une sauvegarde : il peut etre reconstruit avec `npm.cmd install`. Ne jamais supprimer une ancienne copie du projet avant d'avoir verifie la nouvelle installation et l'acces a la base.

## Prochaines evolutions

Avant chaque nouvelle fonctionnalite, decrire le besoin, identifier les fichiers et la migration necessaire, faire une petite modification, executer une verification ciblee, puis seulement continuer. Les pistes actuelles sont un demarrage Windows simplifie, une vraie procedure de changement du mot de passe RH, des tests automatises et une sauvegarde planifiee de la base.
