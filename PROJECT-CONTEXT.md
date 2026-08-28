# Contexte du projet

Derniere mise a jour : 2026-08-20

## Projet

`gestion-conge` est une application de gestion des conges pour le personnel RH.

- Backend : Node.js, Express, PostgreSQL
- Frontend : HTML, CSS et JavaScript natif
- Authentification : session RH avec `bcrypt`
- Port local : `3000`
- Base de donnees : PostgreSQL `gestion_conge`

## Travaux realises

- PostgreSQL 18 a ete installe sur Windows.
- Le service Windows PostgreSQL 18 utilise le nom `postgresql-x64-18`.
- Le client `psql` est installe dans `C:\Program Files\PostgreSQL\18\bin`.
- La base du projet a ete creee ou devait etre creee dans pgAdmin 4 sous le nom `gestion_conge`.
- Le schema se trouve dans `db/schema.sql`.
- Les tables du projet sont :
  - `hr_users`
  - `fiscal_exercices`
  - `leave_types`
  - `employees`
  - `holidays`
  - `leave_records`
- Un fichier `copilot-instructions.md` contient les regles d'architecture et de developpement du projet.

## Configuration locale

Le fichier `.env` contient la configuration PostgreSQL et les parametres de l'application.

Ne jamais copier dans la documentation :

- `PGPASSWORD`
- `SESSION_SECRET`
- les mots de passe RH

Avant une utilisation professionnelle, remplacer les valeurs de test par des valeurs fortes et privees.

## Compte RH

Le compte par defaut est configure par ces variables :

- `SEED_HR_USERNAME`
- `SEED_HR_PASSWORD`

Le compte de test utilise actuellement l'identifiant `admin` et le mot de passe `admin123`.
Ce mot de passe doit etre change avant la mise en service.

Le fichier `server/seed.js` a ete corrige : relancer le seed met maintenant a jour le hash du mot de passe d'un compte RH existant au lieu de l'ignorer.

Commande :

```powershell
npm.cmd run seed
```

`npm.cmd` est utilise car PowerShell peut bloquer le script `npm.ps1` selon la politique d'execution Windows.

## Commandes utiles

Depuis le dossier du projet :

```powershell
npm.cmd install
npm.cmd run seed
npm.cmd start
```

Pour le developpement avec rechargement automatique :

```powershell
npm.cmd run dev
```

Application locale :

```text
http://localhost:3000
```

## Mise en service sur l'ordinateur RH

Mode recommande : installation locale uniquement sur l'ordinateur de la RH.

1. Installer Node.js et PostgreSQL 18.
2. Copier le projet sur l'ordinateur RH.
3. Installer les dependances avec `npm.cmd install`.
4. Creer la base `gestion_conge` et appliquer `db/schema.sql`.
5. Configurer `.env` avec des secrets professionnels.
6. Lancer `npm.cmd run seed`.
7. Demarrer avec `npm.cmd start`.
8. Ouvrir `http://localhost:3000`.

Dans ce mode, l'application reste accessible uniquement sur l'ordinateur RH.
Le mode reseau interne necessite une configuration supplementaire du serveur, du pare-feu, des sessions et des sauvegardes.

## Verification a reprendre si besoin

Dans pgAdmin 4 :

```text
PostgreSQL 18
  > Databases
    > gestion_conge
      > Schemas
        > public
          > Tables
```

Si la base ou les tables ne sont pas visibles, actualiser `Databases`, puis `Schemas` et `Tables`.

## Prochaine etape possible

Preparer un demarrage simplifie pour Windows, avec un raccourci ou un script qui lance l'application et ouvre automatiquement le navigateur de la RH.
