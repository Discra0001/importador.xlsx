const { consultarDeParaItens, consultarDeParaLojas } = require('../utils/conversion');

/**
 * Processa planilha com layout genérico (baseado em PedidosBase.xlsx)
 * Formato:
 * - Linhas 0-4: Metadados (COND PAGTO, CNPJ, COD. CLIENTE, N° PEDIDO, VENDEDOR)
 * - Linha 5: Cabeçalho dos itens
 * - Linhas 6+: Itens do pedido
 */
function processGenericExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar) {
    let data = [];
    const allRows = worksheet.usedRange().value();

    // Extrair metadados do pedido
    const metadata = extractOrderMetadata(allRows);

    // Encontrar onde começam os itens
    const itemsStartIndex = findItemsStartIndex(allRows);

    if (itemsStartIndex === -1) {
        console.log('⚠️ Cabeçalho de itens não encontrado na planilha');
        return { data: {}, produtos_a_identificar, lojas_a_identificar };
    }

    // Extrair cabeçalho dos itens
    const itemsHeader = allRows[itemsStartIndex];
    const itemsData = allRows.slice(itemsStartIndex + 1);

    // Mapeamento de colunas baseado no layout genérico
    const columnMap = mapGenericColumns(itemsHeader);

    console.log('📋 Processando layout genérico...');
    console.log('📊 Metadados:', metadata);
    console.log('🗂️ Mapeamento de colunas:', columnMap);

    // Agrupar itens por cliente (todos os itens pertencem ao mesmo cliente)
    const clientKey = metadata.codCliente || 'CLIENTE_GENERICO';
    data[clientKey] = [];

    // Processar cada item
    itemsData.forEach((row, index) => {
        // Pular linhas vazias ou inválidas
        if (!row || !row[0] || row.every(cell => cell === null || cell === '')) {
            return;
        }

        const rowData = processGenericRow(row, columnMap, metadata);

        if (rowData) {
            // Mapear produto (código direto) e loja usando conversao.json
            mapProductAndStore(rowData, Rede, [], lojas_a_identificar);

            data[clientKey].push(rowData);
        }
    });

    console.log(`✅ Processados ${data[clientKey].length} itens para o cliente ${clientKey}`);

    return {
        data,
        produtos_a_identificar,
        lojas_a_identificar,
        metadata: metadata
    };
}

/**
 * Extrai metadados do pedido das primeiras linhas
 */
function extractOrderMetadata(rows) {
    const metadata = {
        condPagto: null,
        cnpj: null,
        codCliente: null,
        numPedido: null,
        vendedor: null
    };

    // Linha 0: COND PAGTO | 60
    if (rows[0] && rows[0][1]) {
        metadata.condPagto = rows[0][1];
    }

    // Linha 1: CNPJ | 48.076.228/0030-26
    if (rows[1] && rows[1][1]) {
        metadata.cnpj = rows[1][1];
    }

    // Linha 2: COD. CLIENTE | 24155
    if (rows[2] && rows[2][1]) {
        metadata.codCliente = rows[2][1];
    }

    // Linha 3: N° PEDIDO | PCSZ000457
    if (rows[3] && rows[3][1]) {
        metadata.numPedido = rows[3][1];
    }

    // Linha 4: VENDEDOR | 6
    if (rows[4] && rows[4][1]) {
        metadata.vendedor = rows[4][1];
    }

    return metadata;
}

/**
 * Encontra o índice onde começa a tabela de itens
 */
function findItemsStartIndex(rows) {
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row && row.length >= 6 &&
            row[0] === 'Codigo Produto' &&
            row[1] === 'Descrição do produto' &&
            row[2] === 'Quantidade') {
            return i;
        }
    }
    return -1;
}

/**
 * Mapeia colunas do layout genérico para padrão interno
 */
function mapGenericColumns(headerRow) {
    const map = {
        codigoProduto: null,
        descricao: null,
        quantidade: null,
        embalagem: null,
        valorUnitario: null,
        valorTotal: null
    };

    headerRow.forEach((header, index) => {
        if (header) {
            const headerLower = header.toLowerCase();

            if (headerLower.includes('codigo produto') || headerLower.includes('código produto')) {
                map.codigoProduto = index;
            } else if (headerLower.includes('descrição') || headerLower.includes('descricao')) {
                map.descricao = index;
            } else if (headerLower.includes('quantidade') || headerLower.includes('qtde')) {
                map.quantidade = index;
            } else if (headerLower.includes('embalagem') || headerLower.includes('um')) {
                map.embalagem = index;
            } else if (headerLower.includes('valor unitário') || headerLower.includes('valor unitario') ||
                      headerLower.includes('preço') || headerLower.includes('preco')) {
                map.valorUnitario = index;
            } else if (headerLower.includes('vl total') || headerLower.includes('valor total')) {
                map.valorTotal = index;
            }
        }
    });

    return map;
}

/**
 * Processa uma linha de itens do layout genérico
 */
function processGenericRow(row, columnMap, metadata) {
    // Verificar se a linha tem pelo menos código do produto
    if (!row[columnMap.codigoProduto] || row[columnMap.codigoProduto] === null) {
        return null;
    }

    const rowData = {
        // Dados originais
        CodigoProduto: row[columnMap.codigoProduto],
        DescricaoProduto: row[columnMap.descricao] || '',
        Quantidade: row[columnMap.quantidade] || 1,
        Embalagem: row[columnMap.embalagem] || 'CX',
        ValorUnitario: row[columnMap.valorUnitario] || 0,
        ValorTotal: row[columnMap.valorTotal] || 0,

        // Metadados do pedido
        numeroDoc: metadata.numPedido || '',
        CNPJ: metadata.cnpj || '',
        Vendedor: metadata.vendedor || '',

        // Campos padronizados para compatibilidade
        CODIGOPRODUTOINTERNO: null, // Será preenchido pelo mapeamento
        IDENTIDADE: metadata.codCliente || null, // Usa código do cliente como identidade
        DSPRODUTO: row[columnMap.descricao] || 'PRODUTO GENERIC',
        embalagem: row[columnMap.embalagem] || 'CX',
        valor: row[columnMap.valorUnitario] || 0,
        quantidade: row[columnMap.quantidade] || 1,
        valorTotal: row[columnMap.valorTotal] || (row[columnMap.valorUnitario] * row[columnMap.quantidade]) || 0,
        status: 'OK',

        // Informações adicionais
        Centro: metadata.codCliente || 'GENERIC',
        Loja: metadata.codCliente || 'GENERIC'
    };

    // Calcular valor total se não existir
    if (!rowData.valorTotal && rowData.valor && rowData.quantidade) {
        rowData.valorTotal = rowData.valor * rowData.quantidade;
    }

    return rowData;
}

/**
 * Aplica mapeamentos de produto e loja usando conversao.json
 * Para layout genérico, o código do produto já é o código interno
 */
function mapProductAndStore(rowData, Rede, produtos_a_identificar, lojas_a_identificar) {
    // Para layout genérico, usar diretamente o código da planilha como código interno
    if (rowData.CodigoProduto) {
        rowData.CODIGOPRODUTOINTERNO = rowData.CodigoProduto.toString();
        console.log(`✅ Produto genérico: Código ${rowData.CodigoProduto} usado diretamente como código interno`);
    }

    // Mapear loja (usa o código do cliente como loja)
    if (rowData.IDENTIDADE) {
        const lojaKey = rowData.IDENTIDADE.toString();
        const mappedLoja = consultarDeParaLojas(Rede, lojaKey);
        if (mappedLoja != null) {
            rowData.IDENTIDADE = mappedLoja;
            console.log(`✅ Loja mapeada: ${lojaKey} -> ${mappedLoja}`);
        } else if (!lojas_a_identificar.includes(lojaKey)) {
            lojas_a_identificar.push(lojaKey);
            console.log(`⚠️ Loja não mapeada: ${lojaKey} adicionada para identificação manual`);
        }
    }
}

/**
 * Função auxiliar para detectar se uma planilha usa o layout genérico
 */
function detectGenericLayout(headerRow, allRows) {
    // Verificar se há metadados nas primeiras linhas
    const hasCondPagto = allRows[0] && allRows[0][0] === 'COND PAGTO';
    const hasCnpj = allRows[1] && allRows[1][0] === 'CNPJ';
    const hasCodCliente = allRows[2] && allRows[2][0] === 'COD. CLIENTE';
    const hasNumPedido = allRows[3] && allRows[3][0] === 'N° PEDIDO';
    const hasItemsHeader = findItemsStartIndex(allRows) !== -1;

    const score = [hasCondPagto, hasCnpj, hasCodCliente, hasNumPedido, hasItemsHeader].filter(Boolean).length;

    return {
        isGeneric: score >= 3,
        confidence: score / 5,
        details: {
            hasCondPagto,
            hasCnpj,
            hasCodCliente,
            hasNumPedido,
            hasItemsHeader
        }
    };
}

module.exports = {
    processGenericExcel,
    detectGenericLayout
};