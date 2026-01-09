const { query } = require('../config/db');

async function getTabela(idCliente) {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      // Adiciona pequeno delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));

      const IDTPLSTVENDA = await query(`
       SELECT DISTINCT TOP 1
        CC.IDTPLSTVENDA
     FROM
       LSTVENDAPRODUTO LVENDA (NOLOCK)
       INNER JOIN COBERTURACLIENTE CC (NOLOCK) ON LVENDA.IDTPLSTVENDA = CC.IDTPLSTVENDA
     WHERE
       CC.IDCLIENTE = ${idCliente} `);

      // Validar se o resultado existe e tem dados
      if (IDTPLSTVENDA && IDTPLSTVENDA.recordset && IDTPLSTVENDA.recordset.length > 0) {
        return IDTPLSTVENDA.recordset[0].IDTPLSTVENDA;
      } else {
        console.log(`Nenhuma tabela encontrada para o cliente ${idCliente}, usando tabela padrão`);
        return 3; // Tabela padrão conforme definido na função header
      }
    } catch (error) {
      retries++;
      console.error(`Erro ao buscar tabela do cliente (tentativa ${retries}/${maxRetries}):`, error.message);

      if (retries >= maxRetries) {
        console.log('Usando tabela padrão devido a falhas na consulta');
        return 3; // Tabela padrão
      }

      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 2000 * retries));
    }
  }
}

async function getSeq() {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      // Adiciona pequeno delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));

      const idSequencial = await query('SELECT SEQUENCIAL FROM SEQUENCIAL WHERE IDSEQUENCIAL = 38;');

      // Validar se o resultado existe e tem dados
      if (idSequencial && idSequencial.recordset && idSequencial.recordset.length > 0) {
        const seqValue = idSequencial.recordset[0].SEQUENCIAL;
        console.log('IDSEQUENCIAL: ', seqValue);
        return seqValue;
      } else {
        throw new Error('Sequencial não encontrado na tabela SEQUENCIAL');
      }
    } catch (error) {
      retries++;
      console.error(`Erro ao buscar sequencial (tentativa ${retries}/${maxRetries}):`, error.message);

      if (retries >= maxRetries) {
        // Se falhar tudo, gerar um número aleatório baseado no timestamp
        const fallbackSeq = Date.now() % 100000;
        console.log(`Usando sequencial de fallback: ${fallbackSeq}`);
        return fallbackSeq;
      }

      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 2000 * retries));
    }
  }
}

async function setSeq() {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      // Adiciona pequeno delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));

      const update = await query('UPDATE SEQUENCIAL SET SEQUENCIAL = SEQUENCIAL + 1 WHERE IDSEQUENCIAL = 38;');
      console.log('UPDATE SEQUENCIAL: ', update);

      // Verificar se o UPDATE foi bem sucedido
      if (update && update.rowsAffected && update.rowsAffected > 0) {
        return update;
      } else {
        console.log('AVISO: UPDATE não afetou nenhuma linha, mas continuando...');
        return update;
      }
    } catch (error) {
      retries++;
      console.error(`Erro ao atualizar sequencial (tentativa ${retries}/${maxRetries}):`, error.message);

      if (retries >= maxRetries) {
        console.log('Falha ao atualizar sequencial após todas as tentativas');
        return null; // Retornar null em vez de lançar erro
      }

      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 2000 * retries));
    }
  }
}

function header (sequencial, idcliente, idcondicao, idtppedido = 102, idtabela = 3, codVend, numpedido, vltotal , idformapagamento = 2 ) {
  var base = `INSERT INTO [dbo].[T_PEDIDO_LWL] (
	[NUMPEDIDOAFVSERVER],
	[NUMPEDIDOAFV],
	[DATAPEDIDO],
	[HORAINICIAL],
	[HORAFINAL],
	[DATAFATURAMENTO],
	[CODIGOCLIENTE],
	[CODIGOTIPOPEDIDO],
	[CODIGOCONDPAGTO],
	[CODIGOFORMAPAGTO],
	[CODIGONOMEENDERECO],
	[CODIGOTRANSPORTADORA],
	[CODIGOUNIDFAT],
	[CODIGOTABPRECO],
	[CODIGOFRETE],
	[ORDEMCOMPRA_OLD],
	[OBSERVACAONF],
	[OBSERVACAOPEDIDO_OLD],
	[CODIGOVENDEDORESP],
	[VALORLIQUIDO],
	[VALORBRUTO],
	[NUMPEDIDOAFVASSOC],
	[DATAENTREGA],
	[OBSERVACAOI],
	[OBSERVACAOII],
	[DESCONTOI],
	[QTDEBONIFICADA],
	[CODIGOEMPRESAESP],
	[EXPORTADOTXT],
	[EXPORTADOERP],
	[LogImportacao],
	[OBSERVACAOPEDIDO],
	[CESP_DATAENVIOTABLET],
	[ORDEMCOMPRA],
	[DATA_ENVIO_TABLET],
	[HASHCODE],
	[INCLUIDOPOR],
	[INCLUIDOEM],
	[ALTERADOPOR],
	[ALTERADOEM],
	[CriadoNaVersao],
	[AlteradoNaVersao],
	[ValorFrete],
	[IdOrigempedido],
	[ValorDoFrete],
	[IdPlataforma]
)
VALUES
	(
    ${sequencial},
		'${sequencial}',
		GETDATE( ),
		'00:00',
		'00:00',
		NULL,
		'${idcliente}',
		'${idtppedido}',
		${idcondicao},
		'${idformapagamento}',
		NULL,
		'1',
		'1',
		'${idtabela}',
		'1',
		NULL,
		'${numpedido}',
		NULL,
		'${codVend}',
		${vltotal},
		${vltotal},
		NULL,
		NULL,
		'${numpedido}',
		NULL,
		0,
		NULL,
		NULL,
		NULL,
		0,
		'NULL',
		N'${numpedido}',
		GETDATE(),
		N'${numpedido}',
		GETDATE(),
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL,
		NULL
	);`;

  return base;

}


function item (sequencial, idcliente, codproduto, embalagem, quantidade, vlunit, codigovendedor) {
  var base = `INSERT INTO [dbo].[T_PEDIDOITEM_LWL] (
    [NUMPEDIDOAFVSERVER],
    [NUMPEDIDOAFV],
    [DATAPEDIDO],
    [HORAINICIAL],
    [CODIGOCLIENTE],
    [CODIGOPRODUTO],
    [CODIGOEMBALAGEM],
    [QTDEVENDA],
    [QTDEBONIFICADAFLEX],
    [VALORVENDA],
    [VALORBRUTO],
    [DESCONTOCOMERCIAL],
    [VALORVERBA],
    [CODIGOVENDEDORESP],
    [FLAG_GEROUVERBA],
    [FLAG_GEROUCOTA],
    [DESCONTOCAMPANHA],
    [QTDEBONIFICADACAMP],
    [VALORST],
    [QTDEBONIFICADA],
    [DESCONTOI],
    [DESCONTOII],
    [DESCONTOIII],
    [codigoempresaesp],
    [CodigoKitEDI],
    [HASHCODE],
    [INCLUIDOPOR],
    [INCLUIDOEM],
    [ALTERADOPOR],
    [ALTERADOEM],
    [CriadoNaVersao],
    [AlteradoNaVersao] 
  )
  VALUES
    (
      ${sequencial},
      '${sequencial}',
      GETDATE( ),
      '00:00',
      '${idcliente}',
      '${codproduto}',
      '${embalagem}',
      ${quantidade},
      NULL,
      ${vlunit},
      ${vlunit},
      NULL,
      NULL,
      '${codigovendedor}',
      NULL,
      NULL,
      0,
      NULL,
      0,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
  NULL 
    );
  `;
  return base;
}

async function getAreaVenda() {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      // Adiciona pequeno delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));

      const areaVenda = await query(`
        SELECT AREAVENDA.DSAREAVENDA, AREAVENDA.CODIGOINTERNOAREAVEN
        FROM AREAVENDA
        WHERE ISNULL(AREAVENDA.ATIVO, 0) = 1 AND AREAVENDA.IDVENDEDOR <> 1
      `);

      // Validar se o resultado existe
      if (areaVenda && areaVenda.recordset) {
        return areaVenda.recordset;
      } else {
        console.log('Nenhuma área de venda encontrada, retornando array vazio');
        return [];
      }
    } catch (error) {
      retries++;
      console.error(`Erro ao buscar áreas de venda (tentativa ${retries}/${maxRetries}):`, error.message);

      if (retries >= maxRetries) {
        console.log('Retornando array vazio devido a falhas na consulta');
        return []; // Retornar array vazio em vez de null
      }

      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 2000 * retries));
    }
  }
}

module.exports = {
  getTabela,
  getSeq,
  setSeq,
  header,
  item,
  getAreaVenda
};