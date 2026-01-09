const axios = require('axios');

// Cache com TTL de 1 hora
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em milliseconds

// Função para limpar cache expirado
function limparCacheExpirado() {
  const agora = Date.now();
  for (const [url, dadosCache] of cache.entries()) {
    if (agora - dadosCache.timestamp > CACHE_TTL) {
      cache.delete(url);
      console.log(`Cache expirado removido para URL: ${url}`);
    }
  }
}

// Função para obter do cache ou fazer requisição
async function getProdutoComCache(url) {
  // Limpar cache expirado periodicamente
  limparCacheExpirado();
  
  // Verificar se existe no cache e ainda é válido
  if (cache.has(url)) {
    const dadosCache = cache.get(url);
    const agora = Date.now();
    
    if (agora - dadosCache.timestamp < CACHE_TTL) {
      console.log(`Cache HIT para URL: ${url}`);
      return dadosCache.dados;
    } else {
      // Cache expirado, remover
      cache.delete(url);
      console.log(`Cache expirado para URL: ${url}`);
    }
  }
  
  // Cache MISS - fazer requisição
  console.log(`Cache MISS - Fazendo requisição para URL: ${url}`);
  try {
    const retorno = await axios.get(url);
    const dados = retorno.data;
    
    // Armazenar no cache
    cache.set(url, {
      dados: dados,
      timestamp: Date.now()
    });
    
    console.log(`Dados armazenados no cache para URL: ${url}`);
    return dados;
  } catch (error) {
    console.error(`Erro na requisição para URL: ${url}`, error.message);
    throw error;
  }
}

async function getProduto(codigo = null, embalagem = null, idtabela = null, idcliente = null)  {
  var filtro = "";
  if (idtabela != null) {
    filtro += `&idtabela=${idtabela}`;
  }
  if (idcliente != null) {
    filtro += `&idcliente=${idcliente}`;
  }
  var url = "http://192.168.0.157:82/api/ws/produto/?codigo=" + codigo + "&embalagem=" + embalagem + filtro ;

  console.log("URL: ", url);

  // Usar cache para a requisição
  var retorno = await getProdutoComCache(url);

  if (retorno != '' && retorno != null && retorno != undefined && embalagem != null && retorno.length > 0) {
    retorno = retorno.filter((produto) => {
      if (produto.tipounidade == embalagem) {
        console.log(produto);
        return produto;
      }
    });
  }

  return {
    link: url,
    retorno: retorno[0]
  };
}

// Função para limpar todo o cache manualmente
function limparCache() {
  const tamanhoAnterior = cache.size;
  cache.clear();
  console.log(`Cache limpo manualmente. ${tamanhoAnterior} entradas removidas.`);
}

// Função para obter estatísticas do cache
function estatisticasCache() {
  return {
    entradas: cache.size,
    urls: Array.from(cache.keys()),
    memoriaAproximada: cache.size * 1024 // Estimativa aproximada em bytes
  };
}

module.exports = {
  getProduto,
  limparCache,
  estatisticasCache
};