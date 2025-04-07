const express = require('express');
const venom = require('venom-bot');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const schedule = require('node-schedule'); 
const path = require('path');
const { format } = require('date-fns');
const { zonedTimeToUtc, format: formatTz } = require('date-fns-tz'); 
const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

const chatsTecnicos = {
    'Téc Terceirizado - William Giovane Ribas de Lima': 'Atendimentos William',
    'Thiago Lima de Sousa Boita': 'Atendimentos Thiago',
    'Daniel Santos Romualdo': 'Atendimentos Daniel',
    'Téc Terceirizado - Lucimar Moreira': 'Atendimentos Lucimar',
    'Francisco Leandro Ferreira Lima': 'Atendimentos Francisco',
    'Téc Terceirizado HIF - Lucas Thiago Alves': 'Atendimentos Lucas Thiago - HIF 1',
    'France Wilton de Oliveira Rodrigues': 'Atendimentos France',
    'Nelson dos Santos Prieto': 'Atendimentos Nelson',
    'Téc Terceirizado - José Mário Souza Suzarte Júnior': 'Instalações - José',
    'Estevão Pacheco': 'Atendimentos Estevão',
    'Jefferson da Graça': 'Atendimentos Jefferson',
    'Kaique Cassiano Souza': 'Atendimentos Kaique',
    'Téc Terceirizado - Odair José Vieira': 'Atendimentos Odair',
    'Téc Terceirizado WENDEL - Alisson Santos de Cristo': 'Atendimentos Alisson - Wendel',
    'Andressa Pereira Fernandes': 'Atendimentos Andressa',
    'Téc Terceirizado HIF - Thiago Fonseca': 'Atendimentos Thiago - HIF 2',
    'Téc Terceirizado EZEQUIEL - Ezequiel dos Santos': 'Atendimentos Ezequiel',
    'Téc Terceirizado - Cleverson Gregorio dos Santos': 'Instalações - Cleverson',
    'Técnico Zuttel': 'OS´s não encaminhadas',
    'Téc Terceirizado WENDEL - José Carlos de Castilho': 'Atendimentos José - Wendel',
};

const tecnicosTerceirizados = [
    'Téc Terceirizado - William Giovane Ribas de Lima',
    'Téc Terceirizado - Lucimar Moreira',
    'Téc Terceirizado HIF - Lucas Thiago Alves',
    'Téc Terceirizado - José Mário Souza Suzarte Júnior',
    'Téc Terceirizado - Odair José Vieira',
    'Téc Terceirizado WENDEL - Alisson Santos de Cristo',
    'Téc Terceirizado HIF - Thiago Fonseca',
    'Téc Terceirizado EZEQUIEL - Ezequiel dos Santos',
    'Téc Terceirizado - Cleverson Gregorio dos Santos',
    'Técnico Zuttel',
];

let currentJob = null;


function logMessage(message) {
    const logDir = path.join(__dirname, 'logs');
    const logFile = path.join(logDir, 'application.log');
    const timeZone = 'America/Sao_Paulo';
    const now = new Date(); // Corrigido para usar Date diretamente
    const timestamp = formatTz(now, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone });

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logEntry);
}

venom.create(
    'sessionName',
    (base64Qr, asciiQR, attempts, urlCode) => {
        console.log(asciiQR);
        logMessage(`QR Code gerado: ${asciiQR}`);
    },
    (statusSession, session) => {
        console.log('Status Session: ', statusSession);
        console.log('Session name: ', session);
        logMessage(`Status da sessão: ${statusSession}, Nome da sessão: ${session}`);
    },
    {
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        browserArgs: ['--no-sandbox'],
        refreshQR: 15000,
        autoClose: 60000,
        disableSpins: true,
    }
).then((client) => start(client))
  .catch((error) => {
      console.error('Erro ao iniciar o Venom:', error);
      logMessage(`Erro ao iniciar o Venom: ${error.message}`);
  });

function start(client) {
  app.post('/send-message', upload.single('csvFile'), (req, res) => {
    const { messageData } = req.body;
    if (req.file && messageData) {
      console.log(`Arquivo CSV recebido: ${req.file.path}`); // Log do arquivo recebido
      logMessage(`Arquivo CSV recebido: ${req.file.path}`);
      processCSV(client, req.file.path, messageData, res);
    } else {
      res.status(400).send({ error: 'Arquivo CSV ou dados de mensagem não encontrados' });
      logMessage('Erro: Arquivo CSV ou dados de mensagem não encontrados');
    }
  });

  app.post('/schedule-message', upload.single('csvFile'), (req, res) => {
    const { messageData, scheduleTime, scheduleDays } = req.body;
    if (req.file && messageData && scheduleTime && scheduleDays) {
      console.log(`Arquivo CSV recebido para agendamento: ${req.file.path}`); // Log do arquivo recebido
      logMessage(`Arquivo CSV recebido para agendamento: ${req.file.path}`);
      const scheduleConfig = {
        csvFilePath: req.file.path,
        messageData,
        scheduleTime,
        scheduleDays: JSON.parse(scheduleDays)
      };
      fs.writeFileSync('scheduleConfig.json', JSON.stringify(scheduleConfig)); // Salvar configuração em um arquivo JSON
      logMessage('Configuração de agendamento salva com sucesso!');
      scheduleMessages(client, scheduleConfig);
      res.status(200).send({ message: 'Configuração de agendamento salva com sucesso!' });
    } else {
      res.status(400).send({ error: 'Dados de agendamento incompletos' });
      logMessage('Erro: Dados de agendamento incompletos');
    }
  });

  app.post('/clear-schedule', (req, res) => {
    if (currentJob) {
      currentJob.cancel(); // Cancelar o job agendado
      currentJob = null;
      fs.unlinkSync('scheduleConfig.json'); // Remover o arquivo de configuração
      res.status(200).send({ message: 'Configuração de agendamento limpa com sucesso!' });
      logMessage('Configuração de agendamento limpa com sucesso!');
    } else {
      res.status(400).send({ error: 'Nenhuma configuração de agendamento encontrada' });
      logMessage('Erro: Nenhuma configuração de agendamento encontrada');
    }
  });

  app.post('/clear-uploads', (req, res) => {
    const directory = 'uploads';

    fs.readdir(directory, (err, files) => {
      if (err) {
        logMessage(`Erro ao ler a pasta de uploads: ${err.message}`);
        return res.status(500).send({ error: 'Erro ao ler a pasta de uploads' });
      }

      let errorOccurred = false;

      files.forEach((file) => {
        fs.unlink(path.join(directory, file), (err) => {
          if (err) {
            errorOccurred = true;
            console.error(`Erro ao limpar arquivo ${file}:`, err);
            logMessage(`Erro ao limpar arquivo ${file}: ${err.message}`);
          }
        });
      });

      if (errorOccurred) {
        logMessage('Erro ao limpar alguns arquivos de uploads');
        return res.status(500).send({ error: 'Erro ao limpar alguns arquivos de uploads' });
      }

      res.status(200).send({ message: 'Cache residual limpo com sucesso!' });
      logMessage('Cache residual limpo com sucesso!');
    });
  });
}

function scheduleMessages(client, config) {
  const [hour, minute] = config.scheduleTime.split(':').map(Number);
  const daysOfWeek = config.scheduleDays.map(Number);

  if (currentJob) {
    currentJob.cancel(); 
    logMessage('Job anterior cancelado');
  }

  currentJob = schedule.scheduleJob({ hour, minute, dayOfWeek: daysOfWeek }, () => {
    processCSV(client, config.csvFilePath, config.messageData, {
      status: (code) => ({ send: (response) => {
        console.log(response);
        logMessage(`Rota agendada enviada com sucesso! Resposta: ${response}`);
      }})
    });
  });

  console.log(`Mensagens agendadas para ${config.scheduleTime} nos dias ${config.scheduleDays.join(', ')}`);
  logMessage(`Mensagens agendadas para ${config.scheduleTime} nos dias ${config.scheduleDays.join(', ')}`);
}

function processCSV(client, filePath, messageData, res) {
  const results = [];
  const messageMap = parseMessageData(messageData);
  fs.createReadStream(filePath)
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let currentChat = null;
      let orderCounter = 1;

      for (const line of messageData.split('\n')) {
        const [id, os] = line.split('\t');
        if (id && os) {
          const item = results.find(row => row.ID === os.trim());
          if (item) {
            const tecnico = item.Colaborador.trim();
            const nomeCliente = item.Cliente.split(' - ')[1] || item.Cliente;
            let mensagem = `
*OS:* ${item.ID}
*Cliente:* ${id.trim()} - ${nomeCliente}
*Endereço:* ${item.Endereço} *Bairro:* ${item.Bairro} *Cidade:* ${item.Cidade}
*Bloco:* ${item.Bloco}
*Apto:* ${item.Apartamento}
*Loc:* ${item.Mensagem.match(/https:\/\/[^\s]+/)?.[0] || 'Link não encontrado'}

*Horário:* ${item['Melhor horário']}

*Assunto:* ${item.Assunto}

*Descrição:* ${item.Mensagem}

*Login PPPoE:* ${item.Login}
*Senha PPPoE:* ${item['Senha MD5 PPPoE/Hotspot']}
            `;

            if (tecnicosTerceirizados.includes(tecnico)) {
              mensagem += `\n*Telefone do Cliente:* ${item['Telefone celular']}`;
            }

            if (chatsTecnicos[tecnico]) {
              if (currentChat !== chatsTecnicos[tecnico]) {
                currentChat = chatsTecnicos[tecnico];
                orderCounter = 1; // Redefine o contador para 1 ao mudar de chat
              }
              mensagem = `*${orderCounter}° da rota*\n` + mensagem; // Adiciona a ordem de execução na mensagem
              await buscarEEnviarMensagem(client, currentChat, mensagem);
              orderCounter++;
            } else {
              console.error(`Chat do técnico "${tecnico}" não encontrado!`);
              logMessage(`Erro: Chat do técnico "${tecnico}" não encontrado!`);
            }
          } else {
            console.error(`OS ${os.trim()} não encontrada no arquivo CSV.`);
            logMessage(`Erro: OS ${os.trim()} não encontrada no arquivo CSV.`);
          }
        }
      }
      res.status(200).send({ message: 'Mensagens enviadas com sucesso!', rotaEnviada: true });
      logMessage('Mensagens enviadas com sucesso!');
      console.log('Rota agendada enviada com sucesso!'); // Log após o envio das mensagens
    });
}

function parseMessageData(data) {
  const lines = data.split('\n');
  const map = {};
  lines.forEach(line => {
    const [id, os] = line.split('\t');
    if (id && os) {
      map[id.trim()] = os.trim();
    }
  });
  return map;
}

async function buscarEEnviarMensagem(client, nomeChat, mensagem) {
  try {
    const chats = await client.getAllChats();
    const chatEncontrado = chats.find((chat) => chat.name === nomeChat);

    if (chatEncontrado) {
      console.log(`Chat "${nomeChat}" encontrado! ID: ${chatEncontrado.id._serialized}`);
      logMessage(`Chat "${nomeChat}" encontrado! ID: ${chatEncontrado.id._serialized}`);
      await enviarMensagens(client, chatEncontrado.id._serialized, mensagem);
    } else {
      console.error(`Chat "${nomeChat}" não encontrado!`);
      logMessage(`Erro: Chat "${nomeChat}" não encontrado!`);
    }
  } catch (error) {
    console.error(`Erro ao buscar o chat "${nomeChat}":`, error);
    logMessage(`Erro ao buscar o chat "${nomeChat}": ${error.message}`);
  }
}

async function enviarMensagens(client, chat, mensagem) {
  try {
    await client.sendText(chat, mensagem);
    console.log(`Mensagem enviada para ${chat}: ${mensagem}`);
    logMessage(`Mensagem enviada para ${chat}: ${mensagem}`);
  } catch (error) {
    console.error(`Erro ao enviar mensagem para ${chat}:`, error);
    logMessage(`Erro ao enviar mensagem para ${chat}: ${error.message}`);
  }
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  logMessage(`Server running at http://0.0.0.0:${port}`);
});
