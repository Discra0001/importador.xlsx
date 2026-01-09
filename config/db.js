const sql = require('mssql');

let dbConnection = null;
let connectionConfig = null;
let reconnecting = false;
let connectionPool = null;

async function createConnection() {
  connectionConfig = {
     user: 'vabroker',
     password: 'vabroker',
     server: '142.215.5.135',
     database: 'NextAgeERP',
     encrypt: false,
     connectionTimeout: 120000,
     requestTimeout: 120000, // Aumentado para 60 segundos
     pool: {
       max: 2, // Reduzido ainda mais para evitar sobrecarga
       min: 1,
       idleTimeoutMillis: 15000, // Aumentado para manter conexões por mais tempo
       acquireTimeoutMillis: 45000,
       createTimeoutMillis: 10000,
       destroyTimeoutMillis: 5000,
       reapIntervalMillis: 1000,
       createRetryIntervalMillis: 500
     },
     options: {
       enableArithAbort: true,
       trustServerCertificate: false,
       useUTC: false,
       cancelTimeout: 5000 // Timeout para cancelamento
     }
  };

  try {
     // Se já existe um pool, fecha primeiro
     if (connectionPool) {
       try {
         await connectionPool.close();
       } catch (e) {
         // Ignorar erro ao fechar
       }
       connectionPool = null;
     }

     // Se existe conexão única, fecha também
     if (dbConnection) {
       try {
         await dbConnection.close();
       } catch (e) {
         // Ignorar erro ao fechar
       }
       dbConnection = null;
     }

     // Cria novo pool de conexões
     connectionPool = new sql.ConnectionPool(connectionConfig);

     // Aumenta o limite de listeners para evitar warnings
     connectionPool.setMaxListeners(50);

     // Limpa todos os listeners antigos
     connectionPool.removeAllListeners();

     // Configurar listener único de erro
     const errorHandler = async (err) => {
       console.error('Database connection pool error:', err);
       if (!reconnecting && (err.code === 'ECONNCLOSED' || err.code === 'ESOCKET' || err.code === 'ECONNRESET')) {
         reconnecting = true;
         console.log('Connection lost, attempting reconnection...');
         setTimeout(() => attemptReconnection(), 1000);
       }
     };

     connectionPool.once('error', errorHandler);

     await connectionPool.connect();
     console.log('Connected to database with connection pool');

     reconnecting = false;
     return true;
  } catch (err) {
     console.log('Error connecting to database', err);
     reconnecting = false;
     return false;
  }
}

async function attemptReconnection() {
  console.log('Attempting to reconnect to database...');
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempts + 1))); // Espera progressiva
      console.log(`Reconnection attempt ${attempts + 1}/${maxAttempts}`);

      // Limpa conexões antigas
      if (connectionPool) {
        try {
          connectionPool.removeAllListeners();
          await connectionPool.close();
        } catch (e) {
          // Ignorar erro ao fechar pool já perdido
        }
        connectionPool = null;
      }

      if (dbConnection) {
        try {
          await dbConnection.close();
        } catch (e) {
          // Ignorar erro ao fechar conexão já perdida
        }
        dbConnection = null;
      }

      // Cria novo pool com configurações otimizadas para resiliência
      const newConnectionConfig = {
        ...connectionConfig,
        pool: {
          ...connectionConfig.pool,
          max: 3, // Reduzido ainda mais para evitar sobrecarga
          min: 1,
          idleTimeoutMillis: 5000, // Reduzido para 5 segundos
          acquireTimeoutMillis: 15000,
          createTimeoutMillis: 5000,
          createRetryIntervalMillis: 100
        }
      };

      connectionPool = new sql.ConnectionPool(newConnectionConfig);
      connectionPool.setMaxListeners(30);
      connectionPool.removeAllListeners();

      // Configura listener único para evitar múltiplos listeners
      const errorHandler = async (err) => {
        console.error('Database connection pool error after reconnection:', err);
        if (!reconnecting && (err.code === 'ECONNCLOSED' || err.code === 'ESOCKET' || err.code === 'ECONNRESET')) {
          setTimeout(() => attemptReconnection(), 2000);
        }
      };

      connectionPool.once('error', errorHandler);

      await connectionPool.connect();
      console.log('Successfully reconnected to database with connection pool');

      reconnecting = false;
      return true;
    } catch (err) {
      console.error(`Reconnection attempt ${attempts + 1} failed:`, err.message);
      attempts++;
    }
  }

  console.error('Failed to reconnect after maximum attempts');
  reconnecting = false;
  return false;
}

async function checkConnection() {
  // Verifica o pool primeiro
  if (!connectionPool || connectionPool.closed) {
    console.log('Connection pool lost, attempting to reconnect...');
    return await createConnection();
  }
  return true;
}

async function queryWithNewConnection(queryString, retries = 2) {
  if (!connectionConfig) {
    console.log('Error: Database not configured');
    throw new Error('Database not configured');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    let tempConnection = null;

    try {
      // Cria uma nova conexão para cada query com configurações específicas
      const connectConfig = {
        user: connectionConfig.user,
        password: connectionConfig.password,
        server: connectionConfig.server,
        database: connectionConfig.database,
        encrypt: false,
        connectionTimeout: 30000,
        requestTimeout: 45000,
        pool: {
          max: 1,
          min: 0,
          idleTimeoutMillis: 1000
        },
        options: {
          enableArithAbort: true,
          trustServerCertificate: false,
          useUTC: false,
          connectTimeout: 30000,
          cancelTimeout: 5000,
          packetSize: 32767
        }
      };

      tempConnection = await sql.connect(connectConfig);

      const request = new sql.Request(tempConnection);
      request.timeout = 45000; // 45 segundos de timeout
      request.commandTimeout = 45000;

      const result = await request.query(queryString);
      console.log('Query executed successfully');
      return result;
    } catch (err) {
      console.error(`Query attempt ${attempt} failed:`, err.message);

      // Se for erro de "aborted", tenta novamente com nova conexão
      if (err.message === 'aborted' || err.message.includes('aborted')) {
        console.log('Aborted error detected, will retry with fresh connection...');
      }

      // Se for a última tentativa, retornar erro
      if (attempt === retries) {
        console.error('All retry attempts failed');
        throw err;
      }

      // Esperar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    } finally {
      // Sempre fecha a conexão temporária
      if (tempConnection) {
        try {
          await tempConnection.close();
        } catch (e) {
          // Ignora erro ao fechar
        }
      }
    }
  }
}

async function query(queryString, retries = 2) {
  // Para operações críticas como insert/update, usa conexão dedicada para evitar concorrência
  if (queryString.toUpperCase().includes('INSERT') ||
      queryString.toUpperCase().includes('UPDATE') ||
      queryString.toUpperCase().includes('DELETE')) {
    return await queryWithNewConnection(queryString, retries);
  }

  // Para SELECT, tenta usar o pool primeiro
  if (!connectionConfig) {
    console.log('Error: Database not configured');
    throw new Error('Database not configured');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Verificar se o pool está ativo
      if (!connectionPool || connectionPool.closed || reconnecting) {
        const connected = await checkConnection();
        if (!connected) {
          // Se não conseguir pool, fallback para conexão dedicada
          return await queryWithNewConnection(queryString, retries);
        }
      }

      // Criar nova request usando o pool
      const request = new sql.Request(connectionPool);
      request.timeout = 45000; // 45 segundos de timeout

      const result = await request.query(queryString);
      console.log('Query executed successfully');
      return result;
    } catch (err) {
      console.error(`Query attempt ${attempt} failed:`, err.message);

      // Tratamento específico para erro 'aborted' - usar conexão dedicada imediatamente
      if (err.message === 'aborted' || err.message.includes('aborted') ||
          err.code === 'ECONNRESET' || err.code === 'ESOCKET' ||
          (err.originalError && (err.originalError.code === 'ECONNRESET' ||
           err.originalError.code === 'ESOCKET'))) {
        console.log('Connection error detected, switching to dedicated connection...');
        // Para erros de conexão, usa conexão dedicada na próxima tentativa
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        } else {
          return await queryWithNewConnection(queryString, 1);
        }
      }

      // Se for a última tentativa, usa conexão dedicada
      if (attempt === retries) {
        return await queryWithNewConnection(queryString, 1);
      }

      // Esperar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
}

async function insert(queryString) {
  // This function was in app.js but not used, so I'm keeping it for completeness
  // but it's essentially the same as query for inserts.
  return query(queryString);
}

// Função para obter uma transação para operações críticas
async function getTransaction() {
  if (!connectionPool || connectionPool.closed) {
    await checkConnection();
  }
  return new sql.Transaction(connectionPool);
}

// Função para executar queries com transação
async function queryWithTransaction(queryStrings) {
  const transaction = await getTransaction();
  try {
    await transaction.begin();
    const results = [];

    for (const queryString of queryStrings) {
      const request = new sql.Request(transaction);
      request.timeout = 45000;
      const result = await request.query(queryString);
      results.push(result);
    }

    await transaction.commit();
    console.log(`Transaction with ${queryStrings.length} queries executed successfully`);
    return results;
  } catch (err) {
    await transaction.rollback();
    console.error('Transaction failed, rolled back:', err.message);
    throw err;
  }
}

// Função para executar inserção de múltiplos itens com controle de concorrência
async function insertItemsInBatches(items, batchSize = 2, delayBetweenBatches = 1000) {
  const results = [];
  const batches = [];

  // Dividir itens em lotes
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  console.log(`Iniciando processamento de ${items.length} itens em ${batches.length} lotes de ${batchSize} itens`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processando batch ${batchIndex + 1}/${batches.length} com ${batch.length} itens`);

    // Processar itens em sequência dentro do lote para evitar concorrência
    for (let itemIndex = 0; itemIndex < batch.length; itemIndex++) {
      const item = batch[itemIndex];
      const globalIndex = batchIndex * batchSize + itemIndex;

      try {
        // Usar uma conexão dedicada para cada item
        const result = await queryWithNewConnection(item, 2);
        results.push({ success: true, result, itemIndex: globalIndex });
        console.log(`Item ${globalIndex + 1}/${items.length} inserido com sucesso`);
      } catch (error) {
        console.error(`Erro no item ${globalIndex + 1}/${items.length}:`, error.message);

        // Tentar mais uma vez com delay maior
        console.log(`Tentando reenviar item ${globalIndex + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          const result = await queryWithNewConnection(item, 1);
          results.push({ success: true, result, itemIndex: globalIndex });
          console.log(`Item ${globalIndex + 1}/${items.length} inserido com sucesso na retry`);
        } catch (retryError) {
          console.error(`Falha definitiva no item ${globalIndex + 1}/${items.length}:`, retryError.message);
          results.push({ success: false, error: retryError, itemIndex: globalIndex });

          // Se houver muitas falhas consecutivas, esperar mais tempo
          if (itemIndex > 0 && itemIndex % 5 === 0) {
            console.log('Pausa longer devido a múltiplas falhas...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }

      // Pequeno delay entre itens do mesmo lote
      if (itemIndex < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Esperar entre lotes, exceto após o último
    if (batchIndex < batches.length - 1) {
      console.log(`Pausa de ${delayBetweenBatches}ms entre lotes...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  console.log(`Processamento concluído: ${successCount} sucessos, ${failCount} falhas`);

  return results;
}

module.exports = {
  createConnection,
  query,
  queryWithNewConnection,
  insert,
  getTransaction,
  queryWithTransaction,
  insertItemsInBatches
};