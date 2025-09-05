// ...existing code...

// Endpoint para reiniciar a sessão do WhatsApp

const express = require('express');
const app = express();
const wppconnect = require('@wppconnect-team/wppconnect');
const puppeteer = require('puppeteer');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const schedule = require('node-schedule'); 
const path = require('path');

app.post('/restart-session', async (req, res) => {
  try {
    // Fecha o client atual se existir
    if (globalClient && typeof globalClient.close === 'function') {
      await globalClient.close();
      globalClient = null;
      console.log('Client antigo fechado.');
    }
    // Cria nova instância do WPPConnect
    wppconnect.create({
      session: 'sessionName',
      headless: false,
      useChrome: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-zygote',
        '--disable-gpu'
      ],
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        try {
          const base64Data = base64Qr.replace(/^data:image\/png;base64,/, "");
          fs.writeFileSync(path.join(__dirname, 'public', 'qr.png'), base64Data, 'base64');
          console.log('QR code salvo como imagem em public/qr.png');
        } catch (err) {
          console.error('Erro ao salvar QR code como imagem:', err);
        }
        sendQrToClients(base64Qr);
        console.log(asciiQR);
        logMessage(`QR Code gerado: ${asciiQR}`);
      },
      statusFind: (statusSession, session) => {
        console.log('Status Session:', statusSession);
        console.log('Session name:', session);
        logMessage(`Status da sessão: ${statusSession}, Nome da sessão: ${session}`);
      }
    })
    .then((client) => {
      globalClient = client;
      start(client);
      console.log('Novo client WPPConnect iniciado!');
      res.json({ status: 'Sessão reiniciada!' });
    })
    .catch((error) => {
      console.error('Erro ao reiniciar o WPPConnect:', error);
      logMessage(`Erro ao reiniciar o WPPConnect: ${error.message}`);
      res.status(500).json({ status: 'ERRO', error: error.message });
    });
  } catch (err) {
    console.error('Erro ao reiniciar sessão:', err);
    res.status(500).json({ status: 'ERRO', error: err.message });
  }
});
// Endpoint para retornar status da sessão
app.get('/status-session', async (req, res) => {
  try {
    if (!globalClient) return res.json({ status: 'DESCONECTADO' });
    const state = await globalClient.getConnectionState();
    res.json({ status: state });
  } catch (err) {
    res.json({ status: 'ERRO', error: err.message });
  }
});
const { format } = require('date-fns');
const { zonedTimeToUtc, format: formatTz } = require('date-fns-tz'); 

const { remove } = require('diacritics'); // instale com: npm install diacritics

// Set para armazenar conexões SSE para QR code
const qrClients = new Set();

// Rota SSE para enviar QR code em tempo real
app.get('/qr', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  qrClients.add(res);
  req.on('close', () => qrClients.delete(res));
});

// Função para enviar QR code para todos os clientes conectados
function sendQrToClients(base64Qr) {
  const data = JSON.stringify({ qr: base64Qr });
  qrClients.forEach(client => client.write(`data: ${data}\n\n`));
}

let globalClient = null; // ✅ Variável global para armazenar o client

const port = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

let cachedChats = []; // variável global que guarda os chats
let cacheInterval = null;

async function updateChatsCache(client) {
  try {
    const state = await client.getConnectionState();
    if (state === 'CONNECTED') {
      cachedChats = await client.getAllChats();
      console.log(`✅ Cache de chats atualizado: ${cachedChats.length} chats carregados`);
      logMessage(`Cache de chats atualizado: ${cachedChats.length} chats carregados`);
    } else {
      console.warn(`⚠️ Não foi possível atualizar cache: estado = ${state}`);
      logMessage(`Aviso: não foi possível atualizar cache: estado = ${state}`);
    }
  } catch (error) {
    console.error('Erro ao atualizar cache de chats:', error);
    logMessage(`Erro ao atualizar cache de chats: ${error.message}`);
  }
}


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
    'Saulo Venancio Carneiro da Cunha': 'Atendimentos Saulo',
    'Benicio Rodrigues de Moraes Junior': 'Atendimentos Benício',
    'Uilderlanio Ferreira Braz': 'Atendimentos Uilderlanio',
    'Vinicius Roseo Matos Sousa': 'Atendimentos Vinícius',
    'Téc Terceirizado WENDEL - Diego Fernandes': 'Atendimentos Diego - Wendel',

    
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
    'Téc Terceirizado WENDEL - José Carlos de Castilho',
    'Téc Terceirizado WENDEL - Diego Fernandes',
];

let currentJob = null;
let currentProgress = 0;
let clients = new Set();

function logMessage(message) {
    const logDir = path.join(__dirname, 'logs');
    const logFile = path.join(logDir, 'application.log');
    const timeZone = 'America/Sao_Paulo';
    const now = new Date(); 
    const timestamp = formatTz(now, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone });

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logEntry);
}

wppconnect.create({
  session: 'sessionName',
  headless: false,
  useChrome: true,
  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-zygote',
    '--disable-gpu'
  ],
  catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
    // Salva o QR code como imagem PNG
    try {
      const base64Data = base64Qr.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(path.join(__dirname, 'public', 'qr.png'), base64Data, 'base64');
      console.log('QR code salvo como imagem em public/qr.png');
    } catch (err) {
      console.error('Erro ao salvar QR code como imagem:', err);
    }
    // Envia o QR code em base64 para o front via SSE
    sendQrToClients(base64Qr);
    console.log(asciiQR);
    logMessage(`QR Code gerado: ${asciiQR}`);
  },
  statusFind: (statusSession, session) => {
    console.log('Status Session:', statusSession);
    console.log('Session name:', session);
    logMessage(`Status da sessão: ${statusSession}, Nome da sessão: ${session}`);
  }
})
.then((client) => start(client))
.catch((error) => {
  console.error('Erro ao iniciar o WPPConnect:', error);
  logMessage(`Erro ao iniciar o WPPConnect: ${error.message}`);
});


// 🟢 FUNÇÃO PRINCIPAL
async function start(client) {
  globalClient = client; // ✅ guarda o client para usar em outras rotas

  console.log('Client iniciado, aguardando conexão...');

  client.onStateChange(async (state) => {
    console.log('🔄 Estado atual do WhatsApp:', state);
    logMessage(`Estado atual do WhatsApp: ${state}`);

    if (state === 'CONNECTED') {
      console.log('✅ Conexão confirmada, atualizando cache de chats...');
      await updateChatsCache(client);

      if (!cacheInterval) {
        cacheInterval = setInterval(() => updateChatsCache(client), 5 * 60 * 1000);
      }
    }
  });
}


  app.get('/message-progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Adiciona este cliente à lista de clientes conectados
    clients.add(res);

    // Remove o cliente quando a conexão for fechada
    req.on('close', () => {
      clients.delete(res);
    });
  });

  app.post('/schedule-message', upload.single('csvFile'), (req, res) => {
  const { messageData, scheduleTime, scheduleDays, technicianType } = req.body;
  console.log('Dados recebidos no /schedule-message:');
  console.log('req.file:', req.file);
  console.log('messageData:', messageData);
  console.log('scheduleTime:', scheduleTime);
  console.log('scheduleDays:', scheduleDays);
  console.log('technicianType:', technicianType);

  if (req.file && messageData && scheduleTime && scheduleDays && technicianType) {
    console.log(`Arquivo CSV recebido para agendamento: ${req.file.path}`);
    logMessage(`Arquivo CSV recebido para agendamento: ${req.file.path}`);
    const scheduleConfig = {
      csvFilePath: req.file.path,
      messageData,
      scheduleTime,
      scheduleDays: JSON.parse(scheduleDays),
      technicianType
    };
    fs.writeFileSync('scheduleConfig.json', JSON.stringify(scheduleConfig));
    logMessage('Configuração de agendamento salva com sucesso!');
  scheduleMessages(globalClient, scheduleConfig);
    res.status(200).send({ message: 'Configuração de agendamento salva com sucesso!' });
  } else {
    console.log('Erro: Dados de agendamento incompletos');
    if (!req.file) console.log('Motivo: req.file está ausente');
    if (!messageData) console.log('Motivo: messageData está ausente');
    if (!scheduleTime) console.log('Motivo: scheduleTime está ausente');
    if (!scheduleDays) console.log('Motivo: scheduleDays está ausente');
    if (!technicianType) console.log('Motivo: technicianType está ausente');
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

  app.post('/send-encaixe', upload.single('csvFile'), (req, res) => {
    const { osNumber, technicianType } = req.body;
    if (req.file && osNumber && technicianType) {
        currentProgress = 0;
        // Criar uma mensagem simples sem numeração de rota
        processEncaixe(client, req.file.path, osNumber, technicianType);
        res.status(200).send({ message: 'Processamento iniciado' });
    } else {
        res.status(400).send({ error: 'Arquivo CSV, número da OS ou tipo de técnico não encontrados' });
        logMessage('Erro: Arquivo CSV, número da OS ou tipo de técnico não encontrados');
    }
});

app.post('/send-message', upload.single('csvFile'), async (req, res) => {
  try {
    const { messageData, technicianType } = req.body;

    if (!req.file || !messageData || !technicianType) {
      return res.status(400).json({ error: 'Arquivo CSV, messageData e technicianType são obrigatórios' });
    }

    if (!globalClient) {
      return res.status(500).json({ error: 'Cliente do WhatsApp não inicializado ainda' });
    }

    // ✅ Agora processa usando a função que já existe para CSV
    processCSV(globalClient, req.file.path, messageData, technicianType);

    res.status(200).json({ message: 'Processamento iniciado com sucesso!' });

  } catch (error) {
    console.error('Erro ao enviar mensagens:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagens' });
  }
});



function scheduleMessages(client, config) {
  const [hour, minute] = config.scheduleTime.split(':').map(Number);
  const daysOfWeek = config.scheduleDays.map(Number);

  if (currentJob) {
    currentJob.cancel(); 
    logMessage('Job anterior cancelado');
  }

  currentJob = schedule.scheduleJob({ hour, minute, dayOfWeek: daysOfWeek }, () => {
    processCSV(client, config.csvFilePath, config.messageData, config.technicianType);
    logMessage('Rota agendada iniciada');
  });

  console.log(`Mensagens agendadas para ${config.scheduleTime} nos dias ${config.scheduleDays.join(', ')}`);
  logMessage(`Mensagens agendadas para ${config.scheduleTime} nos dias ${config.scheduleDays.join(', ')}`);
}

// Modifique a função processCSV para:
async function processCSV(client, filePath, messageData, technicianType) {
  const results = [];
  let totalMessages = 0;
  let processedMessages = 0;
  let currentChat = null;
  let orderCounter = 1;

  // Conta quantas linhas tem para calcular progresso
  messageData.split('\n').forEach(line => {
    const [id, os] = line.split('\t');
    if (id && os) totalMessages++;
  });

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const connectionState = await client.getConnectionState();
        if (connectionState !== 'CONNECTED') {
          logMessage(`Cliente não está conectado ao WhatsApp (estado: ${connectionState})`);
          return;
        }

        for (const line of messageData.split('\n')) {
          const [id, os] = line.split('\t');
          if (!id || !os) continue;

          const item = results.find(row => row.ID === os.trim());
          if (!item) {
            logMessage(`Erro: OS ${os.trim()} não encontrada no arquivo CSV.`);
            continue;
          }

          // Normaliza nome do técnico para evitar erro com acentos/espaços
          const tecnico = remove(item.Colaborador.trim());
          const tecnicoKey = Object.keys(chatsTecnicos).find(key => 
            remove(key) === tecnico
          );

          if (!tecnicoKey) {
            logMessage(`Erro: Chat do técnico "${item.Colaborador}" não encontrado!`);
            continue;
          }

          // Filtro de tipo de técnico
          if (
            (technicianType === 'terceirizados' && !tecnicosTerceirizados.includes(tecnicoKey)) ||
            (technicianType === 'internos' && tecnicosTerceirizados.includes(tecnicoKey)) ||
            (technicianType === 'naoEncaminhadas' && tecnicoKey !== 'Técnico Zuttel')
          ) {
            continue;
          }

          try {
            const nomeCliente = item.Cliente.split(' - ')[1] || item.Cliente;
            let mensagem = `
*OS:* ${item.ID}
*Cliente:* ${id.trim()} - ${nomeCliente}
*Endereço:* ${item.Endereço} *Bairro:* ${item.Bairro} *Cidade:* ${item.Cidade}
*Bloco:* ${item.Bloco} *Apto:* ${item.Apartamento}
*Referência:* ${item.Referência}
*Loc:* ${item.Mensagem.match(/https:\/\/[^\s]+/)?.[0] || 'Link não encontrado'}

*Horário:* ${item['Melhor horário']}

*Assunto:* ${item.Assunto}

*Descrição:* ${item.Mensagem}

*Login PPPoE:* ${item.Login}
*Senha PPPoE:* ${item['Senha MD5 PPPoE/Hotspot']}`;

            if (tecnicosTerceirizados.includes(tecnicoKey) || technicianType === 'naoEncaminhadas') {
              mensagem += `\n*Telefone do Cliente:* ${item['Telefone celular']}`;
            }

            // Se mudou o chat, zera contador
            if (currentChat !== chatsTecnicos[tecnicoKey]) {
              currentChat = chatsTecnicos[tecnicoKey];
              orderCounter = 1;
            }

            mensagem = `*${orderCounter}° da rota*\n` + mensagem;

            // ✅ ENVIA A MENSAGEM PARA O GRUPO CORRETO
            await buscarEEnviarMensagem(client, currentChat, mensagem, cachedChats);

            orderCounter++;
            processedMessages++;

            const progress = Math.round((processedMessages / totalMessages) * 100);
            const progressData = JSON.stringify({ progress });
            clients.forEach(client => client.write(`data: ${progressData}\n\n`));
          } catch (error) {
            logMessage(`Erro ao enviar mensagem: ${error.message}`);
          }
        }

        const completeData = JSON.stringify({ progress: 100, complete: true });
        clients.forEach(client => {
          client.write(`data: ${completeData}\n\n`);
          client.end();
        });

        logMessage('Processamento concluído com sucesso!');
      } catch (error) {
        logMessage(`Erro ao processar mensagens: ${error.message}`);
        const errorData = JSON.stringify({ error: error.message });
        clients.forEach(client => {
          client.write(`data: ${errorData}\n\n`);
          client.end();
        });
      }
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

async function buscarEEnviarMensagem(client, nomeChat, mensagem, chatsCache) {
  try {
    // Usa o cache global (se estiver vazio, tenta atualizar uma vez)
    if (cachedChats.length === 0) {
      await updateChatsCache(client);
    }

    const chatEncontrado = cachedChats.find((chat) => chat.name === nomeChat);

    if (chatEncontrado) {
      console.log(`Chat "${nomeChat}" encontrado! ID: ${chatEncontrado.id._serialized}`);
      logMessage(`Chat "${nomeChat}" encontrado! ID: ${chatEncontrado.id._serialized}`);
      await enviarMensagens(client, chatEncontrado.id._serialized, mensagem);
    } else {
      console.error(`Chat "${nomeChat}" não encontrado no cache!`);
      logMessage(`Erro: Chat "${nomeChat}" não encontrado no cache!`);
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

// Função para processar o encaixe
async function processEncaixe(client, filePath, osNumber, technicianName) {
    const results = [];
    fs.createReadStream(filePath)
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                const item = results.find(row => row.ID === osNumber.trim());
                if (item) {
                    const tecnico = technicianName.trim(); // Usando o nome do técnico selecionado
                    try {
                        const nomeCliente = item.Cliente.split(' - ')[1] || item.Cliente;
                        let mensagem = `
*OS:* ${item.ID}
*Cliente:* ${item.ID} - ${nomeCliente}
*Endereço:* ${item.Endereço} *Bairro:* ${item.Bairro} *Cidade:* ${item.Cidade}
*Bloco:* ${item.Bloco} *Apto:* ${item.Apartamento}
*Referência:* ${item.Referência}
*Loc:* ${item.Mensagem.match(/https:\/\/[^\s]+/)?.[0] || 'Link não encontrado'}

*Horário:* ${item['Melhor horário']}

*Assunto:* ${item.Assunto}

*Descrição:* ${item.Mensagem}

*Login PPPoE:* ${item.Login}
*Senha PPPoE:* ${item['Senha MD5 PPPoE/Hotspot']}`;

                        if (tecnicosTerceirizados.includes(tecnico) || tecnico === 'Técnico Zuttel') {
                            mensagem += `\n*Telefone do Cliente:* ${item['Telefone celular']}`;
                        }

                        if (chatsTecnicos[tecnico]) {
                            
                            // Notifica conclusão
                            const completeData = JSON.stringify({ progress: 100, complete: true });
                            clients.forEach(client => {
                                client.write(`data: ${completeData}\n\n`);
                                client.end();
                            });
                        } else {
                            throw new Error(`Chat do técnico "${tecnico}" não encontrado!`);
                        }
                    } catch (error) {
                        console.error('Erro ao enviar mensagem:', error);
                        logMessage(`Erro ao enviar mensagem: ${error.message}`);
                        throw error;
                    }
                } else {
                    throw new Error(`OS ${osNumber.trim()} não encontrada no arquivo CSV.`);
                }
            } catch (error) {
                console.error('Erro ao processar encaixe:', error);
                logMessage(`Erro ao processar encaixe: ${error.message}`);
                
                const errorData = JSON.stringify({ error: error.message });
                clients.forEach(client => {
                    client.write(`data: ${errorData}\n\n`);
                    client.end();
                });
            }
        });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  logMessage(`Server running at http://0.0.0.0:${port}`);
});
