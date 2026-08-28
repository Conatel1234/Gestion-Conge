-- ============================================================
-- Gestion des Conges - schema PostgreSQL
-- ============================================================

CREATE TABLE IF NOT EXISTS hr_users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- Exercices fiscaux (ex: 01 Octobre 2025 -> 30 Septembre 2026)
CREATE TABLE IF NOT EXISTS fiscal_exercices (
    id          SERIAL PRIMARY KEY,
    label       VARCHAR(50) NOT NULL,          -- '2025-2026'
    date_debut  DATE NOT NULL,
    date_fin    DATE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (date_fin > date_debut),
    UNIQUE (date_debut, date_fin)
);

-- Un seul exercice actif a la fois
CREATE UNIQUE INDEX IF NOT EXISTS one_active_exercice
    ON fiscal_exercices (is_active) WHERE is_active = true;

-- Types de conge : chacun a son propre quota de jours/an
CREATE TABLE IF NOT EXISTS leave_types (
    id           SERIAL PRIMARY KEY,
    nom          VARCHAR(100) NOT NULL UNIQUE,
    quota_jours  INTEGER NOT NULL DEFAULT 0,
    couleur      VARCHAR(20) NOT NULL DEFAULT '#10b981',
    actif        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS employees (
    id             SERIAL PRIMARY KEY,
    nom            VARCHAR(100) NOT NULL,
    prenom         VARCHAR(100) NOT NULL,
    direction      VARCHAR(100) NOT NULL,
    date_embauche  DATE,
    statut         VARCHAR(20) NOT NULL DEFAULT 'employe' CHECK (statut IN ('employe', 'contractuel')),
    actif          BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- Jours off / feries personnalises, exclus du calcul des jours ouvres
CREATE TABLE IF NOT EXISTS holidays (
    id        SERIAL PRIMARY KEY,
    date_off  DATE NOT NULL UNIQUE,
    libelle   VARCHAR(150) NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_records (
    id                  SERIAL PRIMARY KEY,
    employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id       INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    fiscal_exercice_id  INTEGER NOT NULL REFERENCES fiscal_exercices(id) ON DELETE RESTRICT,
    date_debut          DATE NOT NULL,
    date_fin             DATE NOT NULL,
    jours_ouvres        INTEGER NOT NULL,   -- calcule et fige au moment de l'enregistrement
    date_reprise        DATE,               -- calcule : premier jour ouvre apres date_fin
    note                TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_leave_records_employee ON leave_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_records_dates    ON leave_records(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_leave_records_exercice ON leave_records(fiscal_exercice_id);
