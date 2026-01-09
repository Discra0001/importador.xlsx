# Documentação do Sistema de Importação de Planilhas

Este documento descreve a estrutura, arquivos, sistemática e funções do sistema de importação de planilhas, que processa dados de fornecedores (ex: sistema Barbosa), valida-os com APIs e os integra ao ERP.

## 1. Visão Geral do Projeto

Este sistema é responsável por automatizar o processo de importação de dados de planilhas (principalmente XLSX) fornecidas por diferentes fornecedores. Ele realiza as seguintes etapas:

*   **Leitura e Processamento:** Lê e interpreta os dados contidos nas planilhas.
*   **Validação via API:** Confirma e enriquece os dados lidos utilizando informações de APIs externas.
*   **Integração com ERP:** Insere os dados processados e validados no sistema ERP interno.

O sistema foi projetado para ser modular, permitindo a fácil adição de novos formatos de planilhas de fornecedores e adaptações para diferentes APIs e integrações com o ERP.

## 2. Estrutura do Projeto

A estrutura de diretórios do projeto é organizada da seguinte forma:

```
W:/api/importador/xlsx/
├───.Others/               # Contém backups, bases de dados de entrada e outros arquivos auxiliares.
│   ├───bases/             # Planilhas XLSX de entrada e arquivos de conversão.
│   └───Novas Importações/ # Possíveis novas fontes de dados, incluindo scripts Python para PDF.
├───config/                # Contém configurações e módulos relacionados a banco de dados.
│   └───db.js              # Módulo para conexão e operações com o banco de dados.
├───importers/             # Contém módulos para processamento de layouts específicos de planilhas.
│   └───barbosaImporter.js # Lógica de importação para o layout "Barbosa".
├───node_modules/          # Dependências do Node.js instaladas.
├───public/                # Arquivos estáticos acessíveis via web (ex: index.html).
├───utils/                 # Contém funções utilitárias e módulos auxiliares.
│   ├───conversion.js      # Módulo para gerenciamento de mapeamentos "de-para" (conversão de dados).
│   ├───erpApi.js          # Módulo para chamadas à API externa do ERP (ex: consulta de produtos).
│   └───sqlQueries.js      # Módulo para construção de queries SQL e gerenciamento de sequenciais.
├───views/                 # Modelos de visualização EJS para renderização de páginas web.
├───_headerLWL.json        # Arquivo de configuração ou mapeamento de cabeçalhos.
├───_node app.bat          # Script batch para iniciar a aplicação Node.js.
├───_requisitos.txt        # Lista de requisitos e dependências do sistema.
├───_start npm.bat         # Script batch para iniciar o npm (geralmente para desenvolvimento).
├───.htaccess              # Configurações do servidor web (se aplicável).
├───app.js                 # Ponto de entrada principal da aplicação Node.js (orquestrador).
├───conversao.json         # Arquivo de configuração para regras de conversão de dados.
├───estrutura_completa.log # Log da estrutura completa (gerado por z_CriaEstrutura.py).
├───log.txt                # Arquivo de log da aplicação.
├───package-lock.json      # Bloqueio de dependências do Node.js.
├───package.json           # Metadados do projeto Node.js e lista de dependências.
├───z_CriaEstrutura.py     # Script Python para criação ou organização da estrutura.
```

## 3. Arquivos Chave e Suas Funções

*   **`app.js`**: 
.
*   **`config/db.js`**: Gerencia a conexão com o banco de dados e executa operações de consulta e inserção.
*   **`utils/conversion.js`**: Contém funções para carregar, salvar e consultar mapeamentos "de-para" definidos em `conversao.json`, essenciais para a padronização de dados.
*   **`utils/erpApi.js`**: Responsável por realizar chamadas à API externa do ERP, como a consulta de informações detalhadas de produtos.
*   **`utils/sqlQueries.js`**: Contém funções para construir as strings SQL necessárias para inserção de cabeçalhos e itens de pedidos no ERP, além de gerenciar sequenciais.
*   **`importers/barbosaImporter.js`**: Módulo específico que encapsula a lógica de leitura, processamento e transformação de dados para planilhas do fornecedor "Barbosa".
*   **`package.json` / `package-lock.json`**: Definem as dependências do projeto Node.js. `package.json` lista as dependências, e `package-lock.json` garante que as mesmas versões sejam instaladas em diferentes ambientes.
*   **`_headerLWL.json`**: Provavelmente um arquivo de configuração que define o mapeamento ou a estrutura esperada dos cabeçalhos das planilhas de entrada.
*   **`conversao.json`**: Contém regras ou mapeamentos para converter dados de um formato para outro, essencial para padronizar as informações antes da validação e inserção no ERP.
*   **`_node app.bat` / `_start npm.bat`**: Scripts de automação para ambientes Windows, facilitando a execução da aplicação Node.js e comandos npm.
*   **`_requisitos.txt`**: Documenta as dependências de software ou bibliotecas necessárias para o ambiente de execução do sistema.
*   **`z_CriaEstrutura.py`**: Um script Python que pode ser usado para configurar o ambiente inicial, criar diretórios ou processar dados de forma auxiliar, como a geração de `estrutura_completa.log`.
*   **`views/`**: Contém os arquivos `.ejs` (Embedded JavaScript) que são modelos de página web. Isso sugere que o sistema pode ter uma interface web para upload, visualização de status ou configuração.
*   **`.Others/bases/`**: Este diretório armazena as planilhas XLSX originais dos fornecedores que servem como entrada para o sistema.

## 4. Sistemática e Fluxo de Trabalho

O fluxo de trabalho geral do sistema segue os seguintes passos:

1.  **Entrada de Dados:** Planilhas XLSX de fornecedores (ex: "Barbosa") são carregadas via interface web.
2.  **Início do Processamento:** A aplicação Node.js (`app.js`) é iniciada, possivelmente via um script batch (`_node app.bat`).
3.  **Leitura e Parsing:** O `app.js` identifica o tipo de layout (ex: "Barbosa") e delega o processamento ao módulo importador correspondente (ex: `importers/barbosaImporter.js`). Este módulo lê e faz o parsing dos dados da planilha, aplicando as regras de mapeamento e conversão definidas em `conversao.json`.
4.  **Validação e Enriquecimento (API):** Os dados processados são enviados para APIs externas (via `utils/erpApi.js`) para validação, consulta de informações adicionais ou enriquecimento (ex: verificar códigos de produtos, preços, etc.).
5.  **Tratamento de Erros:** Erros durante a leitura, validação ou integração são registrados (ex: `log.txt`) e tratados, possivelmente com feedback para o usuário via interface web (`views/envioERPerro.ejs`).
6.  **Inserção no ERP:** Após a validação bem-sucedida, os dados são formatados (usando `utils/sqlQueries.js`) e inseridos no sistema ERP da empresa (via `config/db.js`).
7.  **Feedback/Resultados:** O sistema pode fornecer feedback sobre o sucesso ou falha da importação, talvez através de uma página de resultados (`views/result.ejs`) ou logs.

## 5. Funções Principais (Alto Nível)

As funções principais do sistema estão agora distribuídas em módulos para melhor organização e reusabilidade:

*   **`app.js`**: Orquestração de rotas e fluxo principal.
*   **`config/db.js`**: `createConnection()`, `query()`, `insert()` - Gerenciamento de banco de dados.
*   **`utils/conversion.js`**: `carregarConversao()`, `salvarConversao()`, `consultarDeParaItens()`, `consultarDeParaLojas()`, `adicionarDePara()` - Mapeamento e conversão de dados.
*   **`utils/erpApi.js`**: `getProduto()` - Interação com a API externa do ERP.
*   **`utils/sqlQueries.js`**: `getTabela()`, `getSeq()`, `setSeq()`, `header()`, `item()` - Geração de queries SQL e gerenciamento de sequenciais.
*   **`importers/barbosaImporter.js`**: `processBarbosaExcel()` - Lógica específica para o layout "Barbosa".

## 6. Configuração e Execução

Para configurar e executar o sistema:

1.  **Requisitos:** Verifique o arquivo `_requisitos.txt` para garantir que todas as dependências de software (ex: Node.js, npm) estejam instaladas.
2.  **Instalação de Dependências:** Navegue até o diretório raiz do projeto (`W:/api/importador/xlsx/`) e execute `npm install` para instalar as dependências do Node.js listadas em `package.json`.
3.  **Execução:**
    *   Para iniciar a aplicação Node.js, execute `_node app.bat` (ou `npm start` se configurado no `package.json`).
    *   Para tarefas de desenvolvimento ou gerenciamento de pacotes, você pode usar `_start npm.bat`.

## 7. Adicionando Novos Layouts de Importação

Para adicionar um novo layout de planilha ao sistema, siga os passos abaixo:

1.  **Crie um novo módulo importador:**
    *   Dentro do diretório `importers/`, crie um novo arquivo JavaScript (ex: `importers/novoLayoutImporter.js`).
    *   Este arquivo deve conter a lógica específica para ler, processar e transformar os dados do novo layout de planilha.
    *   Exporte uma função principal (ex: `processNovoLayoutExcel`) que receba o `worksheet`, `selectedColumns`, `Rede`, `produtos_a_identificar` e `lojas_a_identificar` como parâmetros, e retorne um objeto contendo `data`, `produtos_a_identificar` e `lojas_a_identificar` atualizados.
    *   Utilize as funções de `utils/conversion.js` para mapeamento de "de-para" e `utils/erpApi.js` para consultas de produtos, se necessário.

2.  **Atualize `app.js`:**
    *   No `app.js`, importe o novo módulo importador:
        ```javascript
        const { processNovoLayoutExcel } = require('./importers/novoLayoutImporter');
        ```
    *   Na rota `/upload`, adicione uma condição para o novo layout, chamando a função de processamento correspondente:
        ```javascript
        // ... dentro da rota /upload
        if (Rede == 'barbosa') {
            const processedData = processBarbosaExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar);
            data = processedData.data;
            produtos_a_identificar = processedData.produtos_a_identificar;
            lojas_a_identificar = processedData.lojas_a_identificar;
        } else if (Rede == 'novoLayout') { // Substitua 'novoLayout' pelo nome da sua nova rede
            const processedData = processNovoLayoutExcel(worksheet, selectedColumns, Rede, produtos_a_identificar, lojas_a_identificar);
            data = processedData.data;
            produtos_a_identificar = processedData.produtos_a_identificar;
            lojas_a_identificar = processedData.lojas_a_identificar;
        }
        // ...
        ```

3.  **Atualize `conversao.json` (se necessário):**
    *   Se o novo layout precisar de mapeamentos "de-para" específicos para itens ou lojas, adicione uma nova entrada para a sua `Rede` no arquivo `conversao.json`.

---

**Nota:** Esta documentação é um ponto de partida. Detalhes específicos sobre as APIs utilizadas, a estrutura exata do ERP e as regras de negócio devem ser adicionados conforme o desenvolvimento avança.
---

## CI/CD - Deploy Automatizado

Este projeto possui deploy automatizado usando **GitHub Actions**.

### Como Funciona

1. Desenvolvedor faz push para branch `main` do GitHub
2. GitHub Actions é acionado automaticamente
3. Conecta via SSH ao servidor de produção (177.104.178.133:2222)
4. Atualiza o código no container Docker
5. Reinicia o container automaticamente

### Deploy Manual

Para executar o deploy manualmente:
1. Acesse: https://github.com/Discra0001/importador.xlsx/actions
2. Clique na aba "Actions"
3. Selecione o workflow "Deploy to Production Server"
4. Clique em "Run workflow" → "Run workflow"

### Comandos Úteis

```bash
# Fazer deploy de alterações locais
git add .
git commit -m "Descrição das alterações"
git push origin main

# Verificar status do último deploy
docker logs importador_xlsx --tail 50

# Reiniciar container manualmente
docker restart importador_xlsx
```

### Variáveis de Ambiente (GitHub Secrets)

O workflow utiliza as seguintes secrets configuradas no GitHub:
- `SSH_HOST`: 177.104.178.133
- `SSH_PORT`: 2222
- `SSH_USER`: discra
- `SSH_KEY`: Chave privada SSH
- `CONTAINER_NAME`: importador_xlsx
- `CONTAINER_PATH`: /home/discra/importador_xlsx

### Acesso

- **Produção:** http://177.104.178.133:3005
- **GitHub:** https://github.com/Discra0001/importador.xlsx

---
*Último deploy:* 2026-01-09 10:35:42

*CI/CD Test:* 2026-01-09 10:42:24

*CI/CD Test:* 2026-01-09 11:53:30

*Final CI/CD Test:* 2026-01-09 12:21:49

*Auto-Update Test:* 2026-01-09 14:51:43
