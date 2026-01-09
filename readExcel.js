const XLSX = require('xlsx');
const path = require('path');

/**
 * Lê e analisa um arquivo Excel
 * @param {string} filePath - Caminho completo para o arquivo Excel
 * @param {Object} options - Opções de leitura
 * @returns {Object} Dados estruturados da planilha
 */
function readExcelFile(filePath, options = {}) {
    const {
        sheetIndex = 0,
        includeHeaders = true,
        maxRows = 1000,
        showStructure = false,
        showData = true
    } = options;

    try {
        console.log(`\n=== Lendo arquivo: ${path.basename(filePath)} ===`);

        const workbook = XLSX.readFile(filePath);
        const sheetNames = workbook.SheetNames;

        console.log(`Planilhas encontradas: ${sheetNames.join(', ')}`);

        if (sheetIndex >= sheetNames.length) {
            throw new Error(`Índice ${sheetIndex} inválido. Planilhas disponíveis: 0-${sheetNames.length - 1}`);
        }

        const sheetName = sheetNames[sheetIndex];
        const worksheet = workbook.Sheets[sheetName];

        // Converter para JSON com headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null
        });

        const result = {
            fileName: path.basename(filePath),
            sheetName: sheetName,
            totalRows: jsonData.length,
            totalCols: jsonData.length > 0 ? jsonData[0].length : 0,
            data: jsonData,
            headers: jsonData.length > 0 ? jsonData[0] : [],
            rows: jsonData.slice(1)
        };

        if (showStructure) {
            console.log(`\n📊 Estrutura da Planilha:`);
            console.log(`   - Total de linhas: ${result.totalRows}`);
            console.log(`   - Total de colunas: ${result.totalCols}`);
            console.log(`   - Cabeçalhos: ${result.headers.join(' | ')}`);
        }

        if (showData) {
            console.log(`\n📋 Dados da Planilha:`);
            console.log(JSON.stringify(result.data, null, 2));
        }

        return result;

    } catch (error) {
        console.error(`❌ Erro ao ler arquivo ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Analisa específicamente um layout de pedido
 * @param {string} filePath - Caminho do arquivo
 * @returns {Object} Análise detalhada do layout
 */
function analyzeLayout(filePath) {
    const result = readExcelFile(filePath, {
        showStructure: true,
        showData: false,
        maxRows: 50
    });

    if (!result) {
        return null;
    }

    console.log(`\n🔍 Análise de Layout:`);

    // Encontrar padrões de colunas importantes
    const importantPatterns = [
        /código|codigo|cod|sku/i,
        /descrição|descricao|produto|item/i,
        /quantidade|qtde|qty/i,
        /valor|preço|price|custo/i,
        /loja|centro|filial/i,
        /pedido|order|num/i,
        /embalagem|um|unidade/i
    ];

    const columnAnalysis = {};
    result.headers.forEach((header, index) => {
        if (header) {
            columnAnalysis[header] = {
                index: index,
                type: detectColumnType(result.rows, index),
                sample: getSampleValues(result.rows, index, 3)
            };
        }
    });

    console.log(`\n📋 Análise de Colunas:`);
    Object.entries(columnAnalysis).forEach(([colName, analysis]) => {
        console.log(`   ${colName}: ${analysis.type} | Ex: ${analysis.sample.join(', ')}`);
    });

    return {
        ...result,
        columnAnalysis,
        detectedPatterns: detectLayoutPatterns(result.headers, result.data)
    };
}

/**
 * Detecta o tipo de dados em uma coluna
 */
function detectColumnType(rows, colIndex) {
    const values = rows.slice(0, 10).map(row => row[colIndex]).filter(v => v !== null && v !== undefined);

    if (values.length === 0) return 'vazio';

    const numbers = values.filter(v => !isNaN(v));
    const strings = values.filter(v => typeof v === 'string');

    if (numbers.length > values.length * 0.8) return 'numérico';
    if (strings.length > values.length * 0.8) return 'texto';
    return 'misto';
}

/**
 * Obtém valores amostra de uma coluna
 */
function getSampleValues(rows, colIndex, count = 3) {
    return rows.slice(0, count * 2)
        .map(row => row[colIndex])
        .filter(v => v !== null && v !== undefined)
        .slice(0, count);
}

/**
 * Detecta padrões de layout conhecidos
 */
function detectLayoutPatterns(headers, data) {
    const headerStr = headers.join(' ').toLowerCase();

    if (headerStr.includes('material') || headerStr.includes('barbosa')) {
        return { type: 'barbosa', confidence: 0.9 };
    }

    if (headerStr.includes('loja') || headerStr.includes('gtin') || headerStr.includes('grupo x')) {
        return { type: 'redex', confidence: 0.8 };
    }

    return { type: 'generic', confidence: 0.5 };
}

// Função principal caso o arquivo seja chamado diretamente
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Uso: node readExcel.js <arquivo_excel> [opções]');
        console.log('Exemplo: node readExcel.js PedidosBase.xlsx');
        console.log('Exemplo: node readExcel.js PedidosBase.xlsx analyze');
        process.exit(1);
    }

    const filePath = args[0];
    const shouldAnalyze = args.includes('analyze');

    if (shouldAnalyze) {
        analyzeLayout(filePath);
    } else {
        readExcelFile(filePath, { showStructure: true, showData: true });
    }
}

module.exports = { readExcelFile, analyzeLayout };