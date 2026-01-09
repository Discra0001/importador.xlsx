const express = require('express');
const xlsxPopulate = require('xlsx-populate');
const XLSX = require('xlsx');
const multer = require('multer');
const ejs = require('ejs');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const { consultarDeParaItens, consultarDeParaLojas, adicionarDePara } = require('./utils/conversion');
const { getProduto } = require('./utils/erpApi');
const { getTabela, getSeq, setSeq, header, item, getAreaVenda } = require('./utils/sqlQueries');
const { processBarbosaExcel } = require('./importers/barbosaImporter');
const { processRedeXExcel } = require('./importers/RedeXImporter');
const { processGenericExcel, detectGenericLayout } = require('./importers/genericImporter');
const bodyParser = require('body-parser'); // Importe o body-parser
const { createConnection, query, insertItemsInBatches } = require('./config/db');


const readFileAsync = promisify(fs.readFile);

// Limpar log.txt ao iniciar - usando try/catch para evitar erro EBUSY
try {
    if (fs.existsSync('log.txt')) {
        fs.truncateSync('log.txt', 0);
    }
} catch (error) {
    console.log('Aviso: Não foi possível limpar o log.txt:', error.message);
}

console.log("Iniciando o app.js");

const app = express();
createConnection(); // Conecta ao banco de dados na inicialização
const port = 3005;


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
 // console.log(`${req.method} ${req.url}`);
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

app.set('view engine', 'ejs');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
// Use o middleware body-parser para analisar o corpo das solicitações
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var produtos_a_identificar = [];
var lojas_a_identificar = [];
var somatizacaoData = [];
var tipoPedidoSelecionado = '';
var areaVendaSelecionada = '';

app.get('/', async (req, res) => {
    try {
        const areasVenda = await getAreaVenda();
        res.render('index', { areasVenda: areasVenda });
    } catch (error) {
        console.error('Erro ao buscar áreas de venda:', error);
        res.status(500).send('Erro ao carregar a página.');
    }
});

app.post('/upload', upload.single('file'), async (req, res) => {

    try {
        produtos_a_identificar = [];
        lojas_a_identificar = [];
        somatizacaoData = [];
        global.numeroPedidoRedeX = null;
        global.metadataGeneric = null;
        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname.toLowerCase();

        let worksheet;
        
        // Detectar tipo de arquivo e processar adequadamente
        if (fileName.endsWith('.xlsx')) {
            const workbook = await xlsxPopulate.fromDataAsync(fileBuffer);
            worksheet = workbook.sheet(0);
        } else if (fileName.endsWith('.xls')) {
            const workbook = XLSX.read(fileBuffer);
            const sheetName = workbook.SheetNames[0];
            const xlsWorksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(xlsWorksheet, { header: 1 });
            
            // Criar objeto compatível com xlsxPopulate
            worksheet = {
                usedRange: () => ({
                    value: () => jsonData
                })
            };
        } else {
            throw new Error('Formato de arquivo não suportado');
        }

        var data = [];
        const selectedColumns = req.body.selected_columns;
        const Rede = req.body.Rede;
        const tipoPedido = req.body['tipo-pedido'];
        tipoPedidoSelecionado = tipoPedido;
        areaVendaSelecionada = req.body.area_venda;
        
        console.log('DEBUG UPLOAD - Rede selecionada:', Rede);
        console.log('DEBUG UPLOAD - req.body.Rede:', req.body.Rede);
        const headerRow = worksheet.usedRange().value()[0];

        worksheet.usedRange().value().slice(1).forEach((row) => {
            const rowData = {};

            selectedColumns.forEach((column) => {
                const columnIndex = headerRow.indexOf(column);
                if (columnIndex !== -1) {
                    rowData[column] = row[columnIndex];
                }
            });

            // Verifica se a linha é a primeira
            if (rowData.Material == undefined) {
                // Insere o número do pedido do cliente na array row.numeroDoc
                rowData.numeroDoc = rowData.Item;
            }


            data.push(rowData);
        });

        if (req.body.match_code) {
            // Implemente a lógica de correspondência aqui, se necessário
        }

        //remove valores vazios dentro do array
        data = data.filter((row) => {
            return Object.keys(row).length > 0;
          });

        //se data for maior que 0, então tem dados e se selectedColumns possui o valor Centro, então agrupa por centro
        if (Rede == 'barbosa') {
            const processedData = processBarbosaExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar);
            data = processedData.data;
            produtos_a_identificar = processedData.produtos_a_identificar;
            lojas_a_identificar = processedData.lojas_a_identificar;
        } else if (Rede == 'redex') {
            const processedData = processRedeXExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar);
            data = processedData.data;
            produtos_a_identificar = processedData.produtos_a_identificar;
            lojas_a_identificar = processedData.lojas_a_identificar;

            // Armazenar o número do pedido RedeX para uso posterior
            if (processedData.numeroPedidoRedeX) {
                global.numeroPedidoRedeX = processedData.numeroPedidoRedeX;
                console.log('Número do pedido RedeX armazenado globalmente:', global.numeroPedidoRedeX);
            }
        } else if (Rede == 'generic') {
            const processedData = processGenericExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar);
            data = processedData.data;
            produtos_a_identificar = processedData.produtos_a_identificar;
            lojas_a_identificar = processedData.lojas_a_identificar;

            // Armazenar metadados do pedido genérico
            if (processedData.metadata) {
                global.metadataGeneric = processedData.metadata;
                console.log('Metadados do pedido genérico:', global.metadataGeneric);
            }
        } else {
            // Tentativa de detecção automática para redes desconhecidas
            console.log(`🔍 Rede "${Rede}" não reconhecida. Tentando detecção automática...`);

            const allRows = worksheet.usedRange().value();
            const detection = detectGenericLayout(allRows, allRows);

            if (detection.isGeneric && detection.confidence > 0.6) {
                console.log(`✅ Layout genérico detectado com ${Math.round(detection.confidence * 100)}% de confiança`);
                const processedData = processGenericExcel(worksheet, selectedColumns, 'generic', produtos_a_identificar, lojas_a_identificar);
                data = processedData.data;
                produtos_a_identificar = processedData.produtos_a_identificar;
                lojas_a_identificar = processedData.lojas_a_identificar;

                if (processedData.metadata) {
                    global.metadataGeneric = processedData.metadata;
                    console.log('Metadados do pedido genérico:', global.metadataGeneric);
                }
            } else {
                console.warn(`⚠️ Layout não detectado automaticamente. Processando como genérico assim mesmo.`);
                const processedData = processGenericExcel(worksheet, selectedColumns, 'generic', produtos_a_identificar, lojas_a_identificar);
                data = processedData.data;
                produtos_a_identificar = processedData.produtos_a_identificar;
                lojas_a_identificar = processedData.lojas_a_identificar;
            }
        }

        // remove qualquer valor como nulo ou em branco
        produtos_a_identificar = produtos_a_identificar.filter((item) => {
          return item != null && item != '';
        });
        lojas_a_identificar = lojas_a_identificar.filter((item) => {
          return item != null && item != '';
        });

      

        if (produtos_a_identificar.length > 0 || lojas_a_identificar.length > 0) {
          // Se houver valores a identificar, redirecione para 'identificar.ejs'
          //deixa as informações como distintas em produtos_a_identificar depois em lojas_a_identificar
          produtos_a_identificar = [...new Set(produtos_a_identificar)];
          lojas_a_identificar = [...new Set(lojas_a_identificar)];

          console.log('DEBUG RENDER - Passando Rede para template:', Rede);
          console.log('DEBUG RENDER - Produtos a identificar:', produtos_a_identificar.length);
          console.log('DEBUG RENDER - Lojas a identificar:', lojas_a_identificar.length);
          
          res.render('identificar', { produtos_a_identificar, lojas_a_identificar, Rede });
        } else {
            //remove data[undefined]
            if (Array.isArray(data)) {
              // Remova elementos undefined da matriz (se houver)
              data = data.filter((item) => item !== undefined);
            } else if (typeof data === 'object') {
              // Converta o objeto em uma matriz de valores
              const dataArray = Object.values(data);

              // Remova elementos undefined da matriz (se houver)
              const filteredData = dataArray.filter((item) => item !== undefined);
            } else {
              console.error('A variável "data" não é um array nem um objeto.');
            }

            // Caso contrário, redirecione para 'result.ejs'
            somatizacaoData = data;

            var somatizacaoData2 = Object.values(data);

            // Cria de Obejtos para retornar com JSON do item que vai ser requisitado em getProduto
            var erro = false;
            var produtos = [];
            // Cria Lista com todos os codigointernoproduto que possuem em somatizacaoData
            var codigointernoproduto = [];

            const promises = somatizacaoData2.map( async (items) => {
              for (const item of items) {
                if (item.CODIGOPRODUTOINTERNO != 'undefined' && item.CODIGOPRODUTOINTERNO != undefined && item.CODIGOPRODUTOINTERNO != null) {
                  codigointernoproduto.push(item.CODIGOPRODUTOINTERNO+'-'+item.embalagem);
                  try {
                    // Chame a função getProduto e aguarde a resposta
                    if ((!produtos.includes(item.CODIGOPRODUTOINTERNO))) {
                      let response = await getProduto(item.CODIGOPRODUTOINTERNO, item.embalagem, null, item.IDENTIDADE); // 6088 Barbosa - pega a tabela especial

                      // console.log(response);

                      // Regra: Se embalagem for 'CX' e response for null ou erro, tentar com 'FD'
                      if ((response == null || response == '' || response.retorno == null) && item.embalagem === 'CX') {
                        console.log(`Tentando com embalagem FD para o produto ${item.CODIGOPRODUTOINTERNO} pois CX retornou null/erro`);
                        const responseFD = await getProduto(item.CODIGOPRODUTOINTERNO, 'FD', null, item.IDENTIDADE);

                        // Se FD retornar dados válidos, usa o FD e atualiza a embalagem no item
                        if (responseFD != null && responseFD != '' && typeof responseFD === 'object' && responseFD.retorno != null) {
                          response = responseFD;
                          item.embalagem = 'FD'; // Atualiza a embalagem para FD
                          console.log(`Embalagem atualizada para FD para o produto ${item.CODIGOPRODUTOINTERNO}`);
                        }
                      }

                      // Verifique se a resposta é válida e adicione-a a produtos
                      if (response != null && response != '' && typeof response === 'object' && response.retorno != null) {
                          produtos[item.CODIGOPRODUTOINTERNO] = response.retorno;
                      } else {
                          erro = true;
                      }
                    } else {
                      console.log("Item: " + item.CODIGOPRODUTOINTERNO + " Já consultado.");
                    }
                  } catch (error) {
                      erro = true;
                  }
                }
              }
            });

            // Espere que todas as promessas sejam resolvidas
            await Promise.all(promises);

            // Remove valores duplicados
            codigointernoproduto = [...new Set(codigointernoproduto)];

            

            // Espere que todas as promessas sejam resolvidas
            await Promise.all(promises);

            // Insiro o numero do pedido em cada item.
            var count = 0;
            if (somatizacaoData && typeof somatizacaoData === 'object' && somatizacaoData['undefined'] && somatizacaoData['undefined'] !== null) {
                count = Object.keys(somatizacaoData['undefined']).length;
            }
            
            for (var i = 2; i < count; i++) {
              if (somatizacaoData['undefined'] && somatizacaoData['undefined'][i]) {
                var value = somatizacaoData['undefined'][i];
                if (somatizacaoData[i-2]) { // Verifica se o objeto existe antes de tentar definir a propriedade 'numPed'
                    somatizacaoData[i-2]['numeroDoc'] = somatizacaoData['undefined'][i]['numeroDoc'];
                }
              }
            }


            // salva somatizacaoData que é um objeto como json em um arquivo somatizacaoData.json
            fs.writeFileSync('somatizacaoData.json', JSON.stringify(somatizacaoData));

            res.render('somatizar', { somatizacaoData, produtos, erro });
        }
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao processar o arquivo XLSX.');
    }
});





// Rota para exibir a página "identificar.ejs"
app.get('/identificar', (req, res) => {
  res.render('identificar', { produtos_a_identificar: [], lojas_a_identificar: [] });
});



app.get('/somatizar', (req, res) => {
  if (!somatizacaoData || (Array.isArray(somatizacaoData) && somatizacaoData.length === 0)) { 
    res.redirect('/');
  }
  // Renderize a página de somatização
  res.render('somatizar');
});

app.post('/enviaERP', async (req, res) => {
  try {
    var dados = JSON.parse(req.body.somatizacaoData);

    // salva s string em um arquivo somatizacaoData.json
    fs.writeFileSync('somatizacaoData.json', req.body.somatizacaoData);

    var position = 0;
    // ACESSA O PEDIDO
    for (const pedido in dados) { 
      if (pedido != 'undefined') {
        var ped = dados[pedido];
        // Compatibilidade com Barbosa (Centro) e RedeX (Loja)
        var identificadorLoja = ped[0].Centro || ped[0].Loja;
        if (identificadorLoja != undefined && identificadorLoja != null && identificadorLoja != 'undefined') {
          
          var idcliente = ped[0].IDENTIDADE;
          var vlTotal = 0;
          var idforma = 2;
          
          // Definir condição baseada na rede
          var idcondicao;
          if (global.metadataGeneric && global.metadataGeneric.condPagto) {
            // Genérico - usar valor da planilha
            idcondicao = global.metadataGeneric.condPagto;
            console.log('Condição de pagamento genérica usada:', idcondicao);
          } else if (global.numeroPedidoRedeX) {
            // RedeX
            idcondicao = 7;
          } else {
            // Barbosa (padrão)
            idcondicao = 17;
          }
          
          // Buscar tabela de preço do cliente (mesma usada na somatização)
          var idtabela = 3; // Default
          try {
            idtabela = await getTabela(idcliente);
            console.log(`Tabela de preço obtida para cliente ${idcliente}: ${idtabela}`);
          } catch (error) {
            console.error('Erro ao obter tabela de preço:', error);
            console.log('Usando tabela padrão:', idtabela);
          }
          
          let idtppedido;
          if (tipoPedidoSelecionado === 'bonificacao') {
            idtppedido = 5;
          } else if (tipoPedidoSelecionado === 'venda') {
            idtppedido = 1;
          } else {
            idtppedido = 102; // Negociação ou padrão
          }

          // Melhor geração do número do pedido
          var numpedido;

          if (global.metadataGeneric && global.metadataGeneric.numPedido) {
            // Genérico - formato "EDI PEDIDO (numero)"
            numpedido = `EDI PEDIDO (${global.metadataGeneric.numPedido})`;
            console.log('Número do pedido genérico gerado:', numpedido);
          } else if (dados['undefined'] && dados['undefined'][position + 2] && dados['undefined'][position + 2].Item) {
            // Barbosa - usar o número do pedido da planilha
            numpedido = dados['undefined'][position + 2].Item;
          } else if (global.numeroPedidoRedeX && pedido) {
            // RedeX - usar o número extraído da linha 3 da planilha + nome da loja
            numpedido = `Rede X (Loja ${pedido}) Pedido ${global.numeroPedidoRedeX}`;
            console.log('Número do pedido RedeX gerado:', numpedido);
          } else {
            // Fallback genérico
            numpedido = `PEDIDO-${pedido}-${Date.now()}`;
          }
  
          var codVend = areaVendaSelecionada; // 1703 CHRISTIANE, 2705 DOUGLAS RUFINO <<<<<<
          var sequencial = await getSeq();

          // Insere Header
          var tpedidolwl_query = header(sequencial, idcliente, idcondicao, idtppedido, idtabela, codVend, numpedido, vlTotal , idforma);
          // adiciona a string tpedidolwl_query em um arquivo header.json, vai acrescentando e não substituindo
          //fs.appendFileSync("_headerLWL.json", tpedidolwl_query);
          var insertHeader = await query(tpedidolwl_query);

          // ACESSA OS ITENS - Usar função robusta de processamento em lotes
          console.log(`Processando ${ped.length} itens para o sequencial ${sequencial}`);

          // Preparar as queries dos itens
          const itemQueries = ped.map(vitem => {
            /* Layout
                 Material: 110381,
                 Centro: 1005,
                 'Qtd.do pedido': 1,
                 'UM pedido': 'CX',
                 'Preço líquido': 146.02,
                 Item: 10,
                 CODIGOPRODUTOINTERNO: '4164',
                 DSPRODUTO: 'TESTE',
                 embalagem: 'CX',
                 valor: 146.02,
                 quantidade: 1,
                 valorTotal: 146.02,
                 status: 'OK',
                 IDENTIDADE: '6091'
              */

               // Compatibilidade de preços: Barbosa usa 'Preço líquido', RedeX usa 'valor'
               var precoItem = vitem['Preço líquido'] || vitem.valor;
               var itemPedido = item(sequencial, idcliente, vitem['CODIGOPRODUTOINTERNO'], vitem['embalagem'], vitem['quantidade'], precoItem, codVend);
               return itemPedido;
          });

          // Usar a função robusta de inserção em lotes
          try {
            const results = await insertItemsInBatches(itemQueries, 2, 1500);

            // Verificar se houve falhas
            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
              console.error(`${failures.length} itens falharam na inserção de ${ped.length} totais.`);
              console.warn('O pedido será processado com os itens que foram inseridos com sucesso.');

              // Log detalhado das falhas (apenas os primeiros 10 para não poluir)
              failures.slice(0, 10).forEach(f => {
                console.error(`Erro item ${f.itemIndex + 1}: ${f.error.message}`);
              });
              if (failures.length > 10) {
                console.error(`... e mais ${failures.length - 10} falhas`);
              }
            }

            const successCount = ped.length - failures.length;
            if (successCount === 0) {
              throw new Error('Nenhum item pôde ser inserido no pedido');
            }

            console.log(`Processamento concluído: ${successCount}/${ped.length} itens inseridos com sucesso`);
          } catch (batchError) {
            console.error('Erro crítico no processamento dos itens:', batchError.message);
            throw new Error(`Falha ao inserir itens do pedido: ${batchError.message}`);
          }

          // Importante: Atualizar o sequencial APENAS uma vez por pedido completo
          await setSeq()
          position++;

          await query(`UPDATE T_PEDIDO_LWL SET VALORBRUTO = (
                          SELECT SUM(T_PEDIDOITEM_LWL.VALORBRUTO * T_PEDIDOITEM_LWL.QTDEVENDA) FROM T_PEDIDOITEM_LWL (NOLOCK) WHERE T_PEDIDOITEM_LWL.NUMPEDIDOAFVSERVER = T_PEDIDO_LWL.NUMPEDIDOAFVSERVER
                      ), VALORLIQUIDO = (
                        SELECT SUM(T_PEDIDOITEM_LWL.VALORVENDA * T_PEDIDOITEM_LWL.QTDEVENDA) FROM T_PEDIDOITEM_LWL (NOLOCK) WHERE T_PEDIDOITEM_LWL.NUMPEDIDOAFVSERVER = T_PEDIDO_LWL.NUMPEDIDOAFVSERVER
                      ) WHERE T_PEDIDO_LWL.CODIGOCONDPAGTO IN (17, 7) AND ISNULL(T_PEDIDO_LWL.VALORBRUTO,0) = 0 OR ISNULL(T_PEDIDO_LWL.VALORLIQUIDO,0) = 0`);
  
        }
      }
    }
    res.render('envioERP');
 } catch (error) {
    console.error('Erro ao processar envio para ERP:', error);

    // Verificar se é erro de chave duplicada
    if (error.number === 2627 || (error.originalError && error.originalError.number === 2627)) {
      console.log('Erro de chave duplicada detectado');

      // Renderizar página de erro específica para chave duplicada
      res.render('envioERP', {
        erro: true,
        mensagem: 'Erro de número de pedido duplicado. Por favor, tente enviar novamente.',
        dadosReenvio: req.body.somatizacaoData
      });
      return; // Importante: parar execução aqui
    }

    // Verificar se é erro de conexão
    if (error.code === 'ESOCKET' || error.code === 'ECONNRESET' ||
        (error.originalError && (error.originalError.code === 'ESOCKET' ||
         error.originalError.code === 'ECONNRESET'))) {
      console.log('Erro de conexão detectado');

      // Renderizar página de erro com opção de reenviar
      res.render('envioERP', {
        erro: true,
        mensagem: 'Erro de conexão com o banco de dados. Por favor, tente enviar novamente.',
        dadosReenvio: req.body.somatizacaoData
      });
      return; // Importante: parar execução aqui
    } else {
      // Outro tipo de erro
      res.render('envioERP', {
        erro: true,
        mensagem: `Erro ao processar pedido: ${error.message}`,
        dadosReenvio: req.body.somatizacaoData
      });
      return; // Importante: parar execução aqui
    }
 } finally {
    // Closing the connection after the loop
    // closeConnection();
 }
   // Renderize a página de somatização
   res.render('envioERP');
});


// Rota para identificar lojas
app.post('/identificar-lojas', (req, res) => {
    try {
        const Rede = req.body.Rede || 'barbosa';
        const lojas_para = req.body.lojas_para;
        
        console.log('DEBUG - Rede:', Rede);
        console.log('DEBUG - req.body:', req.body);
        console.log('DEBUG - lojas_para:', lojas_para);
        console.log('DEBUG - typeof lojas_para:', typeof lojas_para);
        
        if (lojas_para && typeof lojas_para === 'object') {
            Object.keys(lojas_para).forEach(de => {
                const para = lojas_para[de];
                if (para && para.trim() !== '') {
                    console.log(`DEBUG - Salvando: de="${de}" para="${para}" na rede="${Rede}"`);
                    adicionarDePara(Rede, de, para, 'lojas');
                }
            });
        } else {
            console.log('DEBUG - lojas_para não é um objeto válido');
        }
        
        // Remover lojas identificadas da lista
        if (lojas_para && typeof lojas_para === 'object') {
            lojas_a_identificar = lojas_a_identificar.filter(loja => !Object.keys(lojas_para).includes(loja));
        }
        
        // Se ainda há produtos ou lojas para identificar, voltar para a tela de identificação
        if (produtos_a_identificar.length > 0 || lojas_a_identificar.length > 0) {
            res.render('identificar', { produtos_a_identificar, lojas_a_identificar, Rede });
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error('Erro ao identificar lojas:', error);
        res.status(500).send('Erro ao processar identificação de lojas');
    }
});

// Rota para identificar produtos
app.post('/identificar-produtos', (req, res) => {
    try {
        const Rede = req.body.Rede || 'barbosa';
        const produtos_para = req.body.produtos_para;
        
        console.log('DEBUG - Rede:', Rede);
        console.log('DEBUG - req.body:', req.body);
        console.log('DEBUG - produtos_para:', produtos_para);
        console.log('DEBUG - typeof produtos_para:', typeof produtos_para);
        
        if (produtos_para && typeof produtos_para === 'object') {
            Object.keys(produtos_para).forEach(de => {
                const para = produtos_para[de];
                if (para && para.trim() !== '') {
                    console.log(`DEBUG - Salvando: de="${de}" para="${para}" na rede="${Rede}"`);
                    adicionarDePara(Rede, de, para, 'itens');
                }
            });
        } else {
            console.log('DEBUG - produtos_para não é um objeto válido');
        }
        
        // Remover produtos identificados da lista
        if (produtos_para && typeof produtos_para === 'object') {
            produtos_a_identificar = produtos_a_identificar.filter(produto => !Object.keys(produtos_para).includes(produto));
        }
        
        // Se ainda há produtos ou lojas para identificar, voltar para a tela de identificação
        if (produtos_a_identificar.length > 0 || lojas_a_identificar.length > 0) {
            res.render('identificar', { produtos_a_identificar, lojas_a_identificar, Rede });
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error('Erro ao identificar produtos:', error);
        res.status(500).send('Erro ao processar identificação de produtos');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor em execução em http://0.0.0.0:${port}`);
    console.log(`Acesso externo: http://discrad.asuscomm.com:${port}`);
});





 

// idformapagamento = 2 > Boleto, 12> PIX
// idcondicao = 17 > Barbosa, 7 > RedeX
// idtppedido = 1 > Venda, 5 > Bonificacao, 102 > Negociação
// idtabela = Obtida via getTabela(idcliente) - tabela específica do cliente
// codigovendedor = 2705 > Douglas (Codigo Interno)










 


 



