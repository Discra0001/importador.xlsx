const { consultarDeParaItens, consultarDeParaLojas } = require('../utils/conversion');

function processRedeXExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar) {
    const allRows = worksheet.usedRange().value();
    const groupedData = {};
    let numeroPedidoRedeX = null;
    
    // Extrair número do pedido da linha 3 (índice 2)
    if (allRows.length > 2 && allRows[2]) {
        const linha3 = allRows[2].join(' '); // Junta todas as células da linha 3
        console.log('Linha 3 completa:', linha3);
        
        // Procurar por padrão "Pedido de Compra Número XXXXXX"
        const matchPedido = linha3.match(/Pedido de Compra Número\s+(\d+)/i);
        if (matchPedido && matchPedido[1]) {
            numeroPedidoRedeX = matchPedido[1];
            console.log('Número do pedido extraído da linha 3:', numeroPedidoRedeX);
        } else {
            // Tentar extrair qualquer sequência de números após "número"
            const matchNumero = linha3.match(/número\s+(\d+)/i);
            if (matchNumero && matchNumero[1]) {
                numeroPedidoRedeX = matchNumero[1];
                console.log('Número alternativo extraído da linha 3:', numeroPedidoRedeX);
            }
        }
    }
    
    // Encontrar o índice onde começam os dados detalhados das lojas
    // Procurar pela linha que contém os cabeçalhos "Loja", "Entrega", etc.
    let startIndex = -1;
    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        // Procurar pela linha de cabeçalho da seção detalhada
        if (row && row.length >= 7 && 
            row[0] === 'Loja' && 
            row[1] === 'Entrega' && 
            row[2] === 'GTIN/PLU Unitário' &&
            row[4] === 'Descrição do Produto') {
            startIndex = i + 1; // Próxima linha após os cabeçalhos
            break;
        }
    }
    
    // Se não encontrou o cabeçalho, retornar dados vazios
    if (startIndex === -1) {
        return { data: groupedData, produtos_a_identificar, lojas_a_identificar };
    }
    
    let currentRowIndex = startIndex;
    
    while (currentRowIndex < allRows.length) {
        const row = allRows[currentRowIndex];
        
        // Stop if we hit an empty row
        if (!row || row.every(cell => cell === null || cell === '' || cell === undefined)) {
            currentRowIndex++;
            continue;
        }
        
        // Check if this is a "Totais:" row - skip it
        if (row[4] === 'Totais: ') {
            currentRowIndex++;
            continue;
        }
        
        // Verificar se chegamos ao final dos dados detalhados (próxima linha de cabeçalho)
        if (row[0] === 'Loja' && row[1] === 'Entrega' && row[2] === 'GTIN/PLU Unitário' && row[4] === 'Descrição do Produto') {
            // Se não é a primeira linha de cabeçalho, significa que encontramos a próxima seção
            if (currentRowIndex > startIndex) {
                break;
            }
        }
        
        // Extract store data
        const loja = row[0];
        if (!loja || loja === 'Loja') { // Skip header rows
            currentRowIndex++;
            continue;
        }
        
        // Initialize store group if it doesn't exist
        if (!groupedData[loja]) {
            groupedData[loja] = [];
        }
        
        // Ajustar os índices corretos para os dados da planilha
        // Baseado na análise, os índices corretos são:
        // 0: Loja, 1: Entrega, 2: GTIN/PLU Unitário, 4: Descrição do Produto
        // 6: Ref. Fornecedor, 13: Qtde, 14: Custo, 15: Total
        const rowData = {
            Loja: loja,
            Entrega: row[1],
            GTIN_PLU_Unitario: row[2],
            Descricao_Produto: row[4],
            Ref_Fornecedor: row[6],
            Quantidade: row[13], // Índice correto para quantidade
            Custo: row[14],      // Índice correto para custo
            Total: row[15]       // Índice correto para total
        };
        
        // Verificar se os dados estão presentes antes de processar
        if (!rowData.GTIN_PLU_Unitario || !rowData.Descricao_Produto) {
            currentRowIndex++;
            continue;
        }
        
        // Map store to IDENTIDADE
        if (rowData.Loja != undefined) {
            rowData.IDENTIDADE = consultarDeParaLojas(Rede, rowData.Loja);
            if (rowData.IDENTIDADE == null && !lojas_a_identificar.includes(rowData.Loja)) {
                lojas_a_identificar.push(rowData.Loja);
            }
        }
        
        // Map GTIN to internal product code
        if (rowData.GTIN_PLU_Unitario != undefined) {
            rowData.CODIGOPRODUTOINTERNO = consultarDeParaItens(Rede, rowData.GTIN_PLU_Unitario);
            if (rowData.CODIGOPRODUTOINTERNO == null && !produtos_a_identificar.includes(rowData.GTIN_PLU_Unitario)) {
                produtos_a_identificar.push(rowData.GTIN_PLU_Unitario);
            }
        }
        
        // Assign standardized fields
        rowData.DSPRODUTO = rowData.Descricao_Produto;
        rowData.embalagem = 'CX'; // Assumindo embalagem padrão como 'CX'
        rowData.valor = rowData.Custo;
        rowData.quantidade = rowData.Quantidade;
        rowData.valorTotal = rowData.Total;
        rowData.status = 'OK';
        
        // Adicionar número do pedido extraído da linha 3
        if (numeroPedidoRedeX) {
            rowData.numeroPedidoRedeX = numeroPedidoRedeX;
        }
        
        groupedData[loja].push(rowData);
        currentRowIndex++;
    }
    
    return { data: groupedData, produtos_a_identificar, lojas_a_identificar, numeroPedidoRedeX };
}

module.exports = {
    processRedeXExcel
};