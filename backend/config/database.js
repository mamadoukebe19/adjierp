const mysql = require('mysql2');

// Configuration de la connexion MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'docc_user',
  password: process.env.DB_PASSWORD || 'docc_pass',
  database: process.env.DB_NAME || 'docc_erp',
  charset: 'utf8mb4',
  timezone: '+00:00',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
};

// Création du pool de connexions
const pool = mysql.createPool(dbConfig);

// Promisify pool pour utiliser async/await
const promisePool = pool.promise();

// Test de connexion initial
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Erreur de connexion MySQL:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Connexion à la base de données perdue');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Trop de connexions à la base de données');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Connexion refusée par la base de données');
    }
  } else {
    console.log('✅ Pool MySQL connecté avec ID:', connection.threadId);
    connection.release();
  }
});

// Gestion des erreurs de pool
pool.on('connection', (connection) => {
  console.log('🔗 Nouvelle connexion établie:', connection.threadId);
});

pool.on('error', (err) => {
  console.error('❌ Erreur du pool MySQL:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Tentative de reconnexion...');
  } else {
    throw err;
  }
});

// Fonctions utilitaires pour les requêtes
const executeQuery = async (query, params = []) => {
  try {
    const [rows] = await promisePool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la requête:', error.message);
    console.error('Requête:', query);
    console.error('Paramètres:', params);
    throw error;
  }
};

const executeTransaction = async (queries) => {
  const connection = await promisePool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Fermeture propre du pool
const closePool = () => {
  return new Promise((resolve, reject) => {
    pool.end((err) => {
      if (err) {
        console.error('Erreur lors de la fermeture du pool:', err);
        reject(err);
      } else {
        console.log('✅ Pool MySQL fermé proprement');
        resolve();
      }
    });
  });
};

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  console.log('🛑 Arrêt du serveur en cours...');
  try {
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
});

module.exports = {
  pool,
  promisePool,
  executeQuery,
  executeTransaction,
  closePool,
  // Compatibilité avec l'ancien code
  getConnection: (callback) => pool.getConnection(callback),
  query: (query, params, callback) => pool.query(query, params, callback)
};
