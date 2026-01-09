const XLSX = require('xlsx');
const fs = require('fs');

// Criar um script para analisar a estrutura exata da planilha
const filePath = './pedido_teste_2.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    
    console.log('=== ANÁLISE DA ESTRUTURA DA PLANILHA ===');
    console.log('Total de linhas:', worksheet.length);
    
    // Encontrar as seções de dados
    let headerSectionStart = -1;
    let detailSectionStart = -1;
    
    for (let i = 0; i < worksheet.length; i++) {
        const row = worksheet[i];
        if (row && row.length >= 3) {
            // Procurar cabeçalho principal
            if (row[0] === 'GTIN/PLU Unitário' && row[2] === 'Descrição') {
                headerSectionStart = i;
                console.log('\nCabeçalho principal encontrado na linha', i, ':', row);
            }
            
            // Procurar cabeçalho de detalhes
            if (row[0] === 'Loja' && row[1] === 'Entrega' && row[2] === 'GTIN/PLU Unitário' && row[4] === 'Descrição do Produto') {
                detailSectionStart = i;
                console.log('\nCabeçalho de detalhes encontrado na linha', i, ':', row);
            }
        }
    }
    
    // Analisar a seção de detalhes
    if (detailSectionStart !== -1) {
        console.log('\n=== ANÁLISE DA SEÇÃO DE DETALHES ===');
        let detailRowCount = 0;
        let lojasEncontradas = new Set();
        
        for (let i = detailSectionStart + 1; i < worksheet.length; i++) {
            const row = worksheet[i];
            
            // Parar se encontrar outro cabeçalho
            if (row[0] === 'Loja' && row[1] === 'Entrega' && row[2] === 'GTIN/PLU Unitário' && row[4] === 'Descrição do Produto') {
                console.log('Próximo cabeçalho encontrado na linha', i);
                break;
            }
            
            // Parar se encontrar linha de totais
            if (row[4] === 'Totais: ') {
                console.log('Linha de totais encontrada na linha', i);
                continue;
            }
            
            // Parar se encontrar linha vazia
            if (!row || row.every(cell => cell === null || cell === '' || cell === undefined)) {
                continue;
            }
            
            // Verificar se é uma linha de dados válida
            if (row[0] && row[0] !== 'Loja' && row[2]) {
                detailRowCount++;
                lojasEncontradas.add(row[0]);
                
                // Mostrar algumas linhas de exemplo
                if (detailRowCount <= 5) {
                    console.log(`Linha ${i} (Loja ${row[0]}):`, {
                        'Loja': row[0],
                        'Entrega': row[1],
                        'GTIN': row[2],
                        'Descricao': row[4],
                        'Ref': row[6],
                        'Quantidade': row[13],
                        'Custo': row[14],
                        'Total': row[15]
                    });
                }
            }
        }
        
        console.log('\nTotal de linhas de detalhe processadas:', detailRowCount);
        console.log('Lojas encontradas:', Array.from(lojasEncontradas));
    }
    
} catch (error) {
    console.error('Erro:', error.message);
}