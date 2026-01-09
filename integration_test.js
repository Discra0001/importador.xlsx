// Teste de integração completa
const express = require('express');
const xlsxPopulate = require('xlsx-populate');
const XLSX = require('xlsx');
const fs = require('fs');
const { processRedeXExcel } = require('./importers/RedeXImporter');

console.log('=== TESTE DE INTEGRAÇÃO REDEX ===');

// Testar com a planilha pedido_teste_2.xlsx
const filePath = './pedido_teste_2.xlsx';

try {
    // Ler a planilha usando xlsx-populate (como o app.js faz)
    xlsxPopulate.fromFileAsync(filePath).then(workbook => {
        // Criar objeto compatível com o que o app.js espera
        const mockWorksheet = workbook.sheet(0);
        
        let produtos_a_identificar = [];
        let lojas_a_identificar = [];
        
        console.log('Processando planilha com processRedeXExcel...');
        const result = processRedeXExcel(mockWorksheet, [], 'redex', produtos_a_identificar, lojas_a_identificar);
        
        console.log('\n=== RESULTADOS ===');
        console.log('Lojas encontradas:', Object.keys(result.data).length);
        console.log('Produtos a identificar:', result.produtos_a_identificar.length);
        console.log('Lojas a identificar:', result.lojas_a_identificar.length);
        
        // Verificar algumas lojas específicas
        const lojas = Object.keys(result.data);
        console.log('\nPrimeiras 5 lojas:', lojas.slice(0, 5));
        
        // Verificar dados da primeira loja
        if (lojas.length > 0) {
            const primeiraLoja = lojas[0];
            console.log(`\nDados da loja ${primeiraLoja}:`);
            console.log(`  Total de itens: ${result.data[primeiraLoja].length}`);
            if (result.data[primeiraLoja].length > 0) {
                const primeiroItem = result.data[primeiraLoja][0];
                console.log(`  Primeiro item: ${primeiroItem.Descricao_Produto}`);
                console.log(`  GTIN: ${primeiroItem.GTIN_PLU_Unitario}`);
                console.log(`  Quantidade: ${primeiroItem.quantidade}`);
                console.log(`  Valor total: ${primeiroItem.valorTotal}`);
            }
        }
        
        console.log('\n=== TESTE CONCLUÍDO COM SUCESSO ===');
    }).catch(error => {
        console.error('Erro ao ler a planilha:', error.message);
    });
    
} catch (error) {
    console.error('Erro geral:', error.message);
}