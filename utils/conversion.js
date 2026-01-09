const path = require('path');
const fs = require('fs');

const conversaoPath = path.join(__dirname, '../conversao.json');

function carregarConversao() {
  try {
      const conversaoData = fs.readFileSync(conversaoPath, 'utf8');
      return JSON.parse(conversaoData);
  } catch (error) {
      console.error('Erro ao carregar o arquivo conversao.json:', error);
      return {};
  }
}

function salvarConversao(conversao) {
  try {
      fs.writeFileSync(conversaoPath, JSON.stringify(conversao, null, 2), 'utf8');
  } catch (error) {
      console.error('Erro ao salvar o arquivo conversao.json:', error);
  }
}

function consultarDeParaItens(rede, de) {
  const conversao = carregarConversao();

  if (conversao[rede] && conversao[rede].itens) {
      const item = conversao[rede].itens.find((item) => {
        if (item.de == de ) {
          return item;
        }
      });
      if (item) {
          return item.para;
      }
  }

  return null;
}

function consultarDeParaLojas(rede, de) {
  const conversao = carregarConversao();

  if (conversao[rede] && conversao[rede].lojas) {
      const loja = conversao[rede].lojas.find((loja) => {
        if (loja.de == de) {
          return loja;
        }
      });
      if (loja) {
          return loja.para;
      }
  }

  return null;
}

function adicionarDePara(rede, de, para, tipo) {
  const conversao = carregarConversao();

  if (!conversao[rede]) {
      conversao[rede] = {};
  }

  if (!conversao[rede][tipo]) {
      conversao[rede][tipo] = [];
  }

  // Verificar se já existe antes de adicionar
  const existeMapping = conversao[rede][tipo].find(item => item.de === de);
  if (!existeMapping) {
      conversao[rede][tipo].push({ de, para });
      salvarConversao(conversao);
      console.log(`Adicionado mapping: ${rede} -> ${tipo} -> de:${de} para:${para}`);
  } else {
      console.log(`Mapping já existe: ${rede} -> ${tipo} -> de:${de}`);
  }
}

module.exports = {
  carregarConversao,
  salvarConversao,
  consultarDeParaItens,
  consultarDeParaLojas,
  adicionarDePara
};