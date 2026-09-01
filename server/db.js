require('dotenv').config();
const { Pool } = require('pg');

const isRemoteHost = Boolean(
  process.env.PGHOST &&
    !['localhost', '127.0.0.1', '::1'].includes(process.env.PGHOST)
);

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'gestion_conge',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  ssl: isRemoteHost ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
