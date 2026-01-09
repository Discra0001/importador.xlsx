const { consultarDeParaItens, consultarDeParaLojas } = require('../utils/conversion');

function processBarbosaExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar) {
    let data = [];
    const headerRow = worksheet.usedRange().value()[0];

    worksheet.usedRange().value().slice(1).forEach((row) => {
        const rowData = {};

        selectedColumns.forEach((column) => {
            const columnIndex = headerRow.indexOf(column);
            if (columnIndex !== -1) {
                rowData[column] = row[columnIndex];
            }
        });

        if (rowData.Material == undefined) {
            rowData.numeroDoc = rowData.Item;
        }

        data.push(rowData);
    });

    data = data.filter((row) => {
        return Object.keys(row).length > 0;
    });

    if (data.length > 0 && selectedColumns.includes('Centro') && Rede == 'barbosa') {
        var groupedData = data.reduce((result, row) => {
            const center = row.Centro;
            
            if (!result[center]) {
                result[center] = [];
            }

            if (row.Material != undefined)
              row.CODIGOPRODUTOINTERNO = consultarDeParaItens('barbosa', row.Material);
              if (row.CODIGOPRODUTOINTERNO == null) {
                produtos_a_identificar.push(row.Material);
              }

              row.DSPRODUTO = 'TESTE';
              row.embalagem = row['UM pedido'] ?? row['Unidade'];
              if (row.embalagem == "CX1")
                row.embalagem = 'CX';
              row.valor = row['Preço líquido'] ?? row['Valor'] ?? row['Preço'] ;
              row.quantidade = row['Qtd.do pedido'] ?? row['Quantidade'];
              row.valorTotal = row.valor * row.quantidade;
              row.status = 'OK';

            if (row.Centro != undefined)
              row.IDENTIDADE = consultarDeParaLojas('barbosa', row.Centro);

            if (row.IDENTIDADE == null) {
              lojas_a_identificar.push(row.Centro);
            }
            
            result[center].push(row);
            
            return result;
        }, {});
        
        if (Object.keys(groupedData).length > 0) {
            data = groupedData;
        }
    }

    return { data, produtos_a_identificar, lojas_a_identificar };
}

module.exports = {
    processBarbosaExcel
};