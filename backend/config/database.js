const mysql = require('mysql2');

// Configuration de la connexion MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'docc_user',
  password: process.env.DB_PASSWORD || 'docc_password',
  database: process.env.DB_NAME || 'docc_erp',
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 20,
  queueLimit: 0,
  multipleStatements: true,
  // Options valides pour MySQL2
  idleTimeout: 300000,
  maxIdle: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
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
    console.log('🔄 Connexion perdue, le pool va se reconnecter automatiquement');
  } else if (err.code === 'ER_CON_COUNT_ERROR') {
    console.error('❌ Trop de connexions actives');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('❌ Connexion refusée par MySQL');
  } else {
    console.error('❌ Erreur MySQL non gérée:', err.code);
  }
});

// Ping périodique pour maintenir les connexions
setInterval(() => {
  pool.query('SELECT 1', (err) => {
    if (err) {
      console.error('❌ Ping MySQL échoué:', err.message);
    }
  });
}, 300000); // Toutes les 5 minutes

// Attendre que MySQL soit prêt
const waitForDatabase = async () => {
  let retries = 30;
  while (retries > 0) {
    try {
      await executeQuery('SELECT 1');
      console.log('✅ Base de données prête');
      return;
    } catch (error) {
      console.log(`⏳ Attente de la base de données... (${retries} tentatives restantes)`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('❌ Impossible de se connecter à la base de données');
};

// Initialiser la connexion
waitForDatabase().catch(error => {
  console.error('Erreur fatale de base de données:', error);
  process.exit(1);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
  process.exit(1);
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
