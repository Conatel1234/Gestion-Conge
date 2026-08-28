require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'gestion_conge',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
});

pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
