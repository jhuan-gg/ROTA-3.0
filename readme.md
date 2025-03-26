# ROTA 3.0

## Descrição

O projeto **ROTA 3.0** é uma aplicação web para envio e agendamento de rotas utilizando arquivos CSV. Ele permite o envio imediato de mensagens ou o agendamento para horários e dias específicos. Além disso, oferece funcionalidades para limpar configurações e cache residual.

## Funcionalidades

- **Envio de Rota**: Envie mensagens com IDs e Ordens de Serviço (OS) diretamente.
- **Agendamento de Rota**: Configure horários e dias da semana para envio automático.
- **Limpeza de Configurações**: Remova configurações de agendamento salvas.
- **Limpeza de Cache Residual**: Exclua arquivos temporários armazenados no servidor.

## Estrutura do Projeto

- **`server.js`**: Arquivo principal do servidor que processa os arquivos CSV e gerencia as rotas.
- **`public/`**: Contém os arquivos estáticos, como HTML, CSS e imagens.
  - `index.html`: Página para envio imediato de rotas.
  - `agendamento.html`: Página para agendamento de envio de rotas.
  - `styles.css`: Estilos visuais da aplicação.
- **`node_modules/`**: Dependências do projeto gerenciadas pelo npm.
- **`.gitignore`**: Arquivo para ignorar diretórios e arquivos desnecessários no controle de versão.

## Pré-requisitos

- **Node.js**: Certifique-se de ter o Node.js instalado.
- **npm**: Gerenciador de pacotes do Node.js.

## Instalação

1. Clone o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd ROTA-3.0
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

## Uso

### Iniciar o Servidor

Execute o comando abaixo para iniciar o servidor:
```bash
node server.js
```

O servidor estará disponível em `http://localhost:3000`.

### Funcionalidades Disponíveis

1. **Envio de Rota**:
   - Acesse `http://localhost:3000/index.html`.
   - Faça upload de um arquivo CSV e insira os IDs e OS.
   - Clique em "Enviar".

2. **Agendamento de Rota**:
   - Acesse `http://localhost:3000/agendamento.html`.
   - Faça upload de um arquivo CSV, insira os IDs e OS, configure o horário e os dias da semana.
   - Clique em "Salvar Configuração".

3. **Limpar Configurações**:
   - Na página de agendamento, clique em "Limpar Configuração".

4. **Limpar Cache Residual**:
   - Em qualquer página, clique em "Limpar Cache Residual".

## Estrutura do Arquivo CSV

O arquivo CSV deve conter as seguintes colunas:
- **ID**: Identificador único.
- **OS**: Ordem de Serviço.
- **Cliente**: Nome do cliente.

## Tecnologias Utilizadas

- **Node.js**: Backend.
- **Express.js**: Framework para servidor.
- **csv-parser**: Biblioteca para leitura de arquivos CSV.
- **HTML/CSS**: Interface do usuário.

## Contribuição

1. Faça um fork do repositório.
2. Crie uma branch para sua feature:
   ```bash
   git checkout -b minha-feature
   ```
3. Faça commit das suas alterações:
   ```bash
   git commit -m "Minha nova feature"
   ```
4. Envie para o repositório remoto:
   ```bash
   git push origin minha-feature
   ```