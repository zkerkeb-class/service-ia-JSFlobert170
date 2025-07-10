const { Pool } = require('pg');

// Configuration du pool de connexions PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL//, // Assurez-vous que cette variable d'environnement est définie
//   ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Test de la connexion dès l'importation
pool.connect(err => {
  if (err) {
    console.error('Erreur de connexion à la base de données', err.stack);
  } else {
    console.log('Connecté à la base de données');
  }
});

module.exports = pool;
