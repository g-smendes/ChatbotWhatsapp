// Importa as bibliotecas necessárias
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer'); // ** Importa Nodemailer **


const API_BASE_URL = 'http://127.0.0.1:1234/v1';

const LLM_MODEL = 'llama-3.2-1b-instruct'; // <<< SUBSTITUA

const smtpConfig = {
    host: 'smtp.gmail.com', // Ex: smtp.gmail.com, outlook.office365.com
    port: 587, // Geralmente 587 para TLS, 465 para SSL
    secure: false, // Use true para porta 465 (SSL), false para outras portas como 587 (TLS)
    auth: {
        user: 'gsmmendes58@gmail.com', // Seu endereço de e-mail
        pass: 'ztwdogdbwbcujdty', // Sua senha ou senha de app/token
    },
    // Opcional: Ignorar verificação de certificado (não recomendado para produção)
    // tls: { rejectUnauthorized: false }
};

const transporter = nodemailer.createTransport(smtpConfig);

// ** Verifica a conexão SMTP (opcional, boa prática) **
transporter.verify(function (error, success) {
    if (error) {
        console.error('Erro ao conectar ao servidor SMTP:', error);
    } else {
        console.log('Servidor SMTP pronto para receber mensagens.');
    }
});

// ** Configurações dos setores/opções de atendimento **
const sectors = [
    {
        id: 'geral',
        option: '1',
        name: 'Atendimento',
        systemMessage: 'Você é o assistente de Suporte Geral. Responda a perguntas amplas e encaminhe se necessário.',
        model: LLM_MODEL,
        // ** Serviços disponíveis neste setor **
        services: [
            { option: '1', name: 'Solicitar Autorização', type: 'general_chat' },
            { option: '2', name: 'Cancelamento de Guias', type: 'general_chat' },
            { option: '3', name: 'Troca de E-mail App Unimed Cliente', type: 'task', taskId: 'email_change_unimed' },
            { option: '4', name: 'Falar com Assistente Geral', type: 'general_chat' },
            { option: '5', name: 'Voltar para o Menu Principal', type: 'main_menu' },
        ]
    },
    {
        id: 'ti',
        option: '2',
        name: 'Suporte Técnico (TI)',
        systemMessage: 'Você é o assistente de Suporte Técnico (TI). Responda a dúvidas gerais sobre informática, sistemas, hardware, software, etc. Você também pode ajudar com a troca de e-mail do App Unimed Cliente.',
        model: LLM_MODEL,
        // ** Serviços disponíveis neste setor **
        services: [
             { option: '1', name: 'Troca de E-mail App Unimed Cliente', type: 'task', taskId: 'email_change_unimed' },
             { option: '2', name: 'Falar com Assistente de TI', type: 'general_chat' },
             { option: '3', name: 'Voltar para o Menu Principal', type: 'main_menu' },
        ]
    },
    {
        id: '24horas',
        option: '3',
        name: 'Pronto Atendimento',
        systemMessage: 'Você é o assistente de Suporte 24h. Responda a emergências ou questões urgentes.',
        model: LLM_MODEL,
        // ** Serviços disponíveis neste setor **
        services: [
             { option: '1', name: 'Falar com Atendimento 24h', type: 'general_chat' },
             { option: '2', name: 'Voltar para o Menu Principal', type: 'main_menu' },
            ]
    },
    {
        id: 'Vendas',
        option: '4',
        name: 'Vendas',
        systemMessage: 'Você é o assistente de Vendas. Responda a perguntas sobre produtos e serviços.',
        model: LLM_MODEL,
        // ** Serviços disponíveis neste setor **
            services: [
                 { option: '1', name: 'Falar com Vendas', type: 'general_chat' },
                 { option: '2', name: 'Voltar para o Menu Principal', type: 'main_menu' },
                ]
    }
];

// ** Definição dos fluxos/tarefas específicas **
const tasks = {
    'email_change_unimed': {
        name: 'Troca de E-mail App Unimed Cliente',
        description: 'Processo para solicitar a troca de e-mail do App Unimed Cliente.',
        steps: [
            { id: 'name', prompt: 'Por favor, informe o seu Nome Completo:', validation: (input) => input && input.length > 5 },
            { id: 'card', prompt: 'Agora, informe o Número da sua Carteirinha (apenas números):', validation: (input) => /^\d+$/.test(input) && input.length > 5 },
            { id: 'cpf', prompt: 'Informe o seu CPF (apenas números):', validation: (input) => /^\d{11}$/.test(input) },
            { id: 'email', prompt: 'Por fim, informe o Novo E-mail para cadastro:', validation: (input) => /\S+@\S+\.\S+/.test(input) },
        ],
        // Mensagem final para o usuário no WhatsApp
        completionMessage: (data, numeroChamado) => {
                const now = moment().tz('America/Sao_Paulo');
                const businessHoursEnd = moment().tz('America/Sao_Paulo').set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
                const isAfterHours = now.isAfter(businessHoursEnd) || now.day() === 0 || now.day() === 6;

                let response = `✅ Sua solicitação de troca de e-mail foi registrada com sucesso **(Chamado #${numeroChamado})** para os seguintes dados:\n\n`;
                response += `Nome Completo: ${data.name}\n`;
                response += `Número da Carteirinha: ${data.card}\n`;
                response += `CPF: ${data.cpf}\n`;
                response += `Novo E-mail: ${data.email}\n\n`;
                response += `**Prazo:** Sua solicitação será processada em até 48 horas úteis.`;

                if (isAfterHours) {
                    response += `\n\n🚨 **Atenção:** Sua solicitação foi enviada fora do horário comercial (Segunda a Sexta, 8h às 18h). O prazo de 48 horas úteis começa a contar a partir do próximo dia útil.';`;
                } else {
                    response += `\n\nSua solicitação foi enviada dentro do horário comercial.`;
                }
                response += `\n\nAssim que a alteração for concluída, você será notificado (se aplicável pelo sistema).`;
                response += `\n\nPosso ajudar com mais alguma dúvida geral sobre TI ou deseja voltar ao menu principal (\`!menu\`)?`;

                return response;
            },
        // ** Configuração de E-mail para esta tarefa **
        emailRecipient: 'gsmmendes58@gmail.com',
        emailSubject: 'Nova Solicitacao Troca Email App Unimed Cliente',
        emailBodyFormatter: (data, chatId, numeroChamado) => {
             let body = `Nova solicitacao de troca de email App Unimed Cliente recebida via WhatsApp Bot (Chat ID: ${chatId}).\n`;
             body += `Numero do Chamado: ${numeroChamado}\n\n`;
             body += `Dados fornecidos pelo usuario:\n\n`;
             body += `Nome Completo: ${data.name}\n`;
             body += `Numero da Carteirinha: ${data.card}\n`;
             body += `CPF: ${data.cpf}\n`;
             body += `Novo Email: ${data.email}\n\n`;
             body += `--------------------\n`;
             body += `Mensagem gerada automaticamente pelo bot.\n`;
             body += `Horario da solicitacao: ${moment().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm:ss')}\n`;
             return body;
        }
        }
    }
    // Adicione mais definições de tarefas aqui
;

// Mensagem do menu inicial
const initialMenuMessage =  'Olá! Eu sou seu assistente virtual. Por favor, escolha o setor com o qual deseja falar, digitando o número correspondente:\n\n' +
    sectors.map(s => `${s.option} - ${s.name}`).join('\n') +
    '\n\nDigite `!menu` a qualquer momento para voltar a este menu.';

// Objetos de estado e histórico
const chatStates = {};
const chatHistories = {};

// --- Funções Auxiliares ---
function getSectorByOption(option) { return sectors.find(sector => sector.option === option); }
function getSectorById(id) { return sectors.find(sector => sector.id === id); }
function getTaskById(id) { return tasks[id]; }
function getSectorServices(sectorId) {
    const sectorConfig = getSectorById(sectorId);
    return sectorConfig ? sectorConfig.services : [];
}

// Configura o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] }
});

// ** NOVO: Flag para verificar se o cliente está pronto **
let isClientReady = false;


// --- Eventos do Cliente WhatsApp ---
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
    // ** Define o flag como true quando o cliente está pronto **
    isClientReady = true;
});

client.on('authenticated', () => { console.log('Autenticado!'); });
client.on('auth_failure', msg => { console.error('Falha na autenticação', msg); });
client.on('disconnected', (reason) => { console.log('Cliente desconectado', reason);
    // ** Opcional: Resetar o flag se desconectar **
    isClientReady = false;
});


// --- Lógica Principal: Receber Mensagens e Gerenciar Estados e Tarefas ---
client.on('message', async msg => {
    // ** NOVA VERIFICAÇÃO: Ignora mensagens se o cliente ainda não estiver pronto **
    if (!isClientReady) {
        console.log(`[${msg.from}] Ignorando mensagem recebida antes do cliente estar pronto.`);
        return; // Sai da função se o cliente não estiver pronto
    }

    // ** ESTAS SÃO AS PRÓXIMAS VERIFICAÇÕES **
    // Ignora mensagens vazias, de status ou com mídia
    if (msg.body === '' || msg.isStatus || msg.hasMedia) {
         if (msg.hasMedia) console.log('Ignorando mensagem de mídia.');
        return; // Sai da função se for um desses tipos
    }

    // ** VERIFICAÇÃO PARA IGNORAR GRUPOS **
    if (msg.isGroup || msg.from.endsWith('@g.us')) {
        console.log(`[${msg.from}] Mensagem de grupo ignorada.`);
        return; // Sai da função handler sem processar mais nada para esta mensagem
    }

    // --- A PARTIR DAQUI, VOCÊ TEM CERTEZA QUE É UMA MENSAGEM NOVA, DE CHAT PRIVADO (não vazia, não status, não mídia) ---
    const chatId = msg.from;
    const userInput = msg.body.trim();

    if (!chatStates[chatId]) {
         chatStates[chatId] = { state: 'initial', sectorId: null, currentTask: null, taskStep: 0, taskData: {} };
         chatHistories[chatId] = [];
    }

    let currentChatState = chatStates[chatId].state;
    let selectedSectorId = chatStates[chatId].sectorId;
    let currentTask = chatStates[chatId].currentTask;
    let taskStep = chatStates[chatId].taskStep;
    let taskData = chatStates[chatId].taskData;

    console.log(`[${chatId}] Estado: ${currentChatState}, Setor: ${selectedSectorId}, Tarefa: ${currentTask}, Passo: ${taskStep}. Input: "${userInput}"`);

    // --- Lógica de Comandos Globais ---
    // O comando !menu agora funciona de sector_menu, in_conversation e in_task
    if (userInput.toLowerCase() === '!menu') {
        console.log(`[${chatId}] Comando !menu recebido. Resetando estado.`);
        chatStates[chatId] = { state: 'awaiting_selection', sectorId: null, currentTask: null, taskStep: 0, taskData: {} };
        chatHistories[chatId] = [];
        await client.sendMessage(msg.from, initialMenuMessage);
        return;
    }

    // ** Comando !sair para encerrar atendimento **
    if (userInput.toLowerCase() === '!sair') {
        console.log(`[${chatId}] Comando !sair recebido. Encerrando atendimento.`);
        // Envia uma mensagem de despedida
        await client.sendMessage(msg.from, 'Ok. Encerrando o atendimento. Se precisar de algo mais, me envie uma nova mensagem.');
        // Limpa o estado do chat para recomeçar na próxima mensagem
        delete chatStates[chatId];
        delete chatHistories[chatId];
        return; // Sai do handler para não processar mais nada
    }

    // O comando !cancelar agora só funciona de in_task
    // Ao cancelar, volta para o menu de SERVIÇOS do setor
    if (currentChatState === 'in_task' && userInput.toLowerCase() === '!cancelar') {
        console.log(`[${chatId}] Comando !cancelar recebido. Cancelando tarefa "${currentTask}".`);
         const taskConfig = getTaskById(currentTask);
        // Obter config do setor atual para mostrar menu de serviços
        const sectorConfigAfterCancel = getSectorById(selectedSectorId);
        const servicesListAfterCancel = sectorConfigAfterCancel ? sectorConfigAfterCancel.services.map(service => `${service.option} - ${service.name}`).join('\n') : 'Nenhum serviço encontrado.';
        await client.sendMessage(msg.from, `Tarefa "${taskConfig ? taskConfig.name : currentTask}" cancelada. Por favor, escolha um serviço no setor "${sectorConfigAfterCancel.name}" ou digite \`!menu\` para voltar:\n\n${servicesListAfterCancel}`);
        // Transição de estado correta: volta para o menu de SERVIÇOS
        chatStates[chatId] = { state: 'sector_menu', sectorId: selectedSectorId, currentTask: null, taskStep: 0, taskData: {} };
         return;
    }


    // --- Máquina de Estados do Chat ---
    switch (currentChatState) {
        case 'initial':
             console.log(`[${chatId}] Novo chat. Enviando menu inicial.`);
             chatStates[chatId].state = 'awaiting_selection';
             chatHistories[chatId] = [];
             await client.sendMessage(msg.from, initialMenuMessage);
             break;

        case 'awaiting_selection':
            console.log(`[${chatId}] Aguardando seleção de setor. Input: ${userInput}`);
            const selectedSector = getSectorByOption(userInput);

            if (selectedSector) {
                 console.log(`[${chatId}] Setor "${selectedSector.name}" (${selectedSector.id}) selecionado.`);
                 // ** MUDANÇA: Vai para o estado sector_menu **
                 chatStates[chatId].state = 'sector_menu'; // <-- MUDA O ESTADO AQUI
                 chatStates[chatId].sectorId = selectedSector.id; // Salva o setor escolhido
                 chatStates[chatId].currentTask = null;
                 chatStates[chatId].taskStep = 0;
                 chatStates[chatId].taskData = {};
                 // chatHistories[chatId] = []; // Não limpa o histórico AQUI ainda

                 // ** Envia o menu de serviços do setor **
                 const sectorServices = getSectorServices(selectedSector.id);
                 if (sectorServices.length > 0) {
                     const servicesList = sectorServices.map(service => {
                          return `${service.option} - ${service.name}`;
                     }).join('\n');
                     await client.sendMessage(msg.from, `Você escolheu o setor "${selectedSector.name}".\nPor favor, selecione o serviço desejado, digitando o número:\n\n${servicesList}`);
                 } else {
                     // Setor sem serviços definidos, vai para conversa geral diretamente?
                     console.warn(`[${chatId}] Setor "${selectedSector.name}" (${selectedSector.id}) sem serviços definidos.`);
                     // ** Opção: Ir direto para conversa geral se não há serviços **
                     chatStates[chatId].state = 'in_conversation';
                     chatHistories[chatId] = []; // Limpa histórico geral ao iniciar conversa geral
                     await client.sendMessage(msg.from, `Você escolheu o setor "${selectedSector.name}". Não há serviços específicos listados. Pode digitar sua pergunta para o assistente.`);

                 }


             } else {
                 console.log(`[${chatId}] Seleção inválida: "${userInput}". Reenviando menu.`);
                 await client.sendMessage(msg.from, 'Opção inválida. Por favor, digite apenas o número do setor desejado.\n\n' + initialMenuMessage);
                 // Permanece no estado 'awaiting_selection'
             }
             break;

        // ** NOVO ESTADO: Menu de Serviços do Setor **
        case 'sector_menu':
             console.log(`[${chatId}] Em menu de serviço do setor "${selectedSectorId}". Input: ${userInput}`);
             const sectorConfigForMenu = getSectorById(selectedSectorId);
             const sectorServicesForMenu = sectorConfigForMenu ? sectorConfigForMenu.services : [];

             const selectedServiceOption = sectorServicesForMenu.find(service => service.option === userInput);

             if (selectedServiceOption) {
                 console.log(`[${chatId}] Serviço "${selectedServiceOption.name}" (${selectedServiceOption.option}) selecionado no setor "${selectedSectorId}".`);

                 // Limpa o histórico GERAL ao sair do menu de serviços
                 chatHistories[chatId] = []; // Limpa histórico

                 switch (selectedServiceOption.type) {
                     case 'task':
                          const taskConfigFromService = getTaskById(selectedServiceOption.taskId);
                          if (taskConfigFromService && taskConfigFromService.steps && taskConfigFromService.steps.length > 0) {
                               console.log(`[${chatId}] Iniciando tarefa "${taskConfigFromService.name}" (${selectedServiceOption.taskId}).`);
                               chatStates[chatId].state = 'in_task';
                               chatStates[chatId].currentTask = selectedServiceOption.taskId;
                               chatStates[chatId].taskStep = 1; // Começa no passo 1
                               chatStates[chatId].taskData = {}; // Limpa dados de tarefas anteriores

                               const firstStep = taskConfigFromService.steps[0];
                               await client.sendMessage(msg.from, `Ok, vamos iniciar o processo "${taskConfigFromService.name}".\n\n${firstStep.prompt}\n\nDigite \`!cancelar\` a qualquer momento para sair.`);
                          } else {
                               console.warn(`[${chatId}] Tarefa "${selectedServiceOption.taskId}" encontrada no serviço, mas sem passos definidos.`);
                               const servicesList = sectorServicesForMenu.map(service => `${service.option} - ${service.name}`).join('\n');
                               await client.sendMessage(msg.from, `Ocorreu um problema. Por favor, selecione outro serviço no setor "${sectorConfigForMenu.name}" ou digite \`!menu\` para voltar:\n\n${servicesList}`);
                          }
                         break;

                     case 'general_chat':
                          console.log(`[${chatId}] Iniciando conversa geral no setor "${selectedSectorId}".`);
                          chatStates[chatId].state = 'in_conversation';
                          // chatHistories[chatId] já foi limpo acima
                          await client.sendMessage(msg.from, `Você escolheu conversar com o assistente de ${sectorConfigForMenu.name}. Pode digitar sua pergunta.`);
                         break;

                     case 'main_menu':
                          console.log(`[${chatId}] Voltando para o menu principal.`);
                          chatStates[chatId] = { state: 'awaiting_selection', sectorId: null, currentTask: null, taskStep: 0, taskData: {} };
                          // chatHistories[chatId] já foi limpo acima
                          await client.sendMessage(msg.from, initialMenuMessage);
                         break;

                     default:
                          console.warn(`[${chatId}] Tipo de serviço desconhecido "${selectedServiceOption.type}".`);
                          const servicesList = sectorServicesForMenu.map(service => `${service.option} - ${service.name}`).join('\n');
                          await client.sendMessage(msg.from, `Opção inválida. Por favor, selecione um serviço na lista:\n\n${servicesList}`);
                         // Permanece no estado sector_menu
                         break;
                 }

             } else {
                  console.log(`[${chatId}] Seleção de serviço inválida: "${userInput}". Reenviando menu de serviços.`);
                 const servicesList = sectorServicesForMenu.map(service => `${service.option} - ${service.name}`).join('\n');
                 await client.sendMessage(msg.from, `Opção inválida. Por favor, selecione um serviço na lista:\n\n${servicesList}`);
                 // Permanece no estado sector_menu
             }
             break;


        case 'in_conversation':
             console.log(`[${chatId}] Em conversa geral no setor "${selectedSectorId}".`);

             const sectorConfig = getSectorById(selectedSectorId);
             if (!sectorConfig) {
                  console.error(`[${chatId}] Erro: Setor "${selectedSectorId}" não encontrado! Voltando para o menu.`);
                  chatStates[chatId] = { state: 'awaiting_selection', sectorId: null, currentTask: null, taskStep: 0, taskData: {} };
                  chatHistories[chatId] = [];
                 await client.sendMessage(msg.from, 'Ocorreu um erro no setor. Por favor, escolha o setor novamente.\n\n' + initialMenuMessage);
                  return;
             }

             // Não verifica mais !iniciar aqui, pois o início da tarefa é feito pelo menu de serviço
             // O comando !menu já é tratado no início do handler

             // --- Processar mensagem com LM Studio ---
             if (!userInput.toLowerCase().startsWith('!')) { // Só processa com LM se não for comando como !menu ou !cancelar (embora esses sejam tratados globalmente agora)
                 if (!chatHistories[chatId]) chatHistories[chatId] = [];
                 chatHistories[chatId].push({ role: 'user', content: msg.body });
                 console.log(`[${chatId}] Chamando LM Studio para conversa geral em ${sectorConfig.name} (${sectorConfig.model})...`);
                 try {
                     const messagesForApi = [
                         { role: 'system', content: sectorConfig.systemMessage }
                     ].concat(chatHistories[chatId]);
                     const payload = {
                         model: sectorConfig.model || LLM_MODEL, // Usando LLM_MODEL do código fornecido
                         messages: messagesForApi,
                         temperature: 0.7,
                         max_tokens: 500
                     };
                     await msg.getChat().then(chat => chat.sendStateTyping());
                     const response = await axios.post(`${API_BASE_URL}/chat/completions`, payload);
                     const generatedText = response.data.choices[0].message.content;
                     if (generatedText) {
                         chatHistories[chatId].push({ role: 'assistant', content: generatedText });
                         await client.sendMessage(msg.from, generatedText.trim());
                         console.log(`[${chatId}] Resposta geral enviada para ${sectorConfig.name}:`, generatedText.trim());
                         const historyLimit = 20;
                          if (chatHistories[chatId].length > historyLimit) {
                              chatHistories[chatId] = chatHistories[chatId].slice(chatHistories[chatId].length - historyLimit);
                              console.log(`[${chatId}] Histórico geral limitado para ${historyLimit} pares.`);
                          }
                     } else {
                         console.warn(`[${chatId}] Resposta da API vazia para conversa geral em ${sectorConfig.name}.`);
                         await client.sendMessage(msg.from, 'Desculpe, não consegui gerar uma resposta neste setor.');
                     }

                 } catch (error) {
                     console.error(`\n--- Erro ao chamar LM Studio para conversa geral em ${sectorConfig.name} (${chatId}) ---`);
                    if (error.response) {
                        console.error('Status:', error.response.status);
                        console.error('Dados do Erro:', error.response.data);
                        await client.sendMessage(msg.from, `[${sectorConfig.name}] Erro da API (${error.response.status}) na conversa geral. Verifique o console.`);
                    } else if (error.request) {
                        console.error('Erro na requisição:', error.request);
                        await client.sendMessage(msg.from, `[${sectorConfig.name}] Erro ao comunicar com o servidor LM Studio na conversa geral. Verifique se está rodando.`);
                    } else {
                        console.error(`[${chatId}] Erro:`, error.message);
                        await client.sendMessage(msg.from, `[${sectorConfig.name}] Erro interno: ${error.message}`);
                    }
                    console.error('---------------------------------------');
                 }
             } // Fim do if (!userInput.toLowerCase().startsWith('!'))
             break; // Fim do case 'in_conversation'

        case 'in_task':
             console.log(`[${chatId}] Em tarefa "${currentTask}" passo ${taskStep}. Input: ${userInput}`);

             const taskConfig = getTaskById(currentTask);
             // Corrigido: Ao encontrar erro na tarefa, volta para o menu de SERVIÇOS
             if (!taskConfig || !taskConfig.steps || taskStep <= 0 || taskStep > taskConfig.steps.length) {
                  console.error(`[${chatId}] Erro: Tarefa "${currentTask}" ou passo ${taskStep} inválido. Voltando para menu de serviços.`);

                 // Obter config do setor atual para mostrar menu de serviços
                 const sectorConfigOnError = getSectorById(selectedSectorId);
                 const servicesListOnError = sectorConfigOnError ? sectorConfigOnError.services.map(service => `${service.option} - ${service.name}`).join('\n') : 'Nenhum serviço encontrado.';

                 await client.sendMessage(msg.from, `Ocorreu um problema na tarefa. Voltando para o menu de serviços do setor "${sectorConfigOnError.name}".\n\n${servicesListOnError}`);

                 // Transição de estado correta
                 chatStates[chatId].state = 'sector_menu'; // Volta para o menu de SERVIÇOS
                 chatStates[chatId].currentTask = null;
                 chatStates[chatId].taskStep = 0;
                 chatStates[chatId].taskData = {};
                  return;
              }

             const currentStep = taskConfig.steps[taskStep - 1];

             // ** Validação e Armazenamento do Input do Passo Atual **
             if (currentStep.validation && !currentStep.validation(userInput)) {
                 console.log(`[${chatId}] Validação falhou para o passo ${taskStep}. Input: "${userInput}".`);
                 await client.sendMessage(msg.from, `Entrada inválida para este passo. Por favor, ${currentStep.prompt}\n\nDigite \`!cancelar\` a qualquer momento para sair da tarefa.`);
                  return;
             }

             taskData[currentStep.id] = userInput;
             chatStates[chatId].taskData = taskData;


             // ** Avançar para o Próximo Passo ou Completar a Tarefa **
             const nextStepIndex = taskStep;
             if (nextStepIndex < taskConfig.steps.length) {
                 // Ainda há passos restantes
                 const nextStep = taskConfig.steps[nextStepIndex];
                 chatStates[chatId].taskStep = taskStep + 1;
                 console.log(`[${chatId}] Passo ${taskStep} completo. Próximo passo ${taskStep + 1}.`);
                 await client.sendMessage(msg.from, `${nextStep.prompt}\n\nDigite \`!cancelar\` a qualquer momento para sair da tarefa.`);

             } else {
                 // Todos os passos completos!
                 console.log(`[${chatId}] Todos os passos da tarefa "${currentTask}" completos.`);

                 // --- Ação de Conclusão da Tarefa ---

                     // ** Gerar número aleatório para o chamado **
                     // Combina timestamp com número aleatório pequeno para razoável unicidade
                     const numeroChamado = Date.now() + Math.floor(Math.random() * 1000);
                     console.log(`[${chatId}] Gerado número de chamado: #${numeroChamado}`);


                     // 1. Enviar mensagem de conclusão para o usuário no WhatsApp
                     // ** Passando numeroChamado **
                     const completionMessageText = taskConfig.completionMessage(taskData, numeroChamado); // <-- Passe numeroChamado aqui
                     await client.sendMessage(msg.from, completionMessageText); // Use a variável com o texto gerado
                     console.log(`[${chatId}] Mensagem de conclusão da tarefa "${currentTask}" enviada para o usuário.`);


                 // 2. Enviar E-mail para o setor responsável
                 if (taskConfig.emailRecipient) {
                     const mailOptions = {
                         from: smtpConfig.auth.user,
                         to: taskConfig.emailRecipient,
                             // ** Incluindo numeroChamado no assunto **
                         subject: `[Chamado #${numeroChamado}] ${taskConfig.emailSubject || `Nova Tarefa Concluida: ${taskConfig.name}`}`, // <-- Inclua aqui
                         // ** Passando numeroChamado para o formatter **
                         text: taskConfig.emailBodyFormatter ? taskConfig.emailBodyFormatter(taskData, chatId, numeroChamado) : `Dados da tarefa "${taskConfig.name}":\n${JSON.stringify(taskData, null, 2)}`, // <-- Passe numeroChamado aqui
                         // html: '<b>Corpo do e-mail em HTML</b>' // Opcional: corpo em HTML
                     };

                     console.log(`[${chatId}] Tentando enviar e-mail para ${taskConfig.emailRecipient}...`);
                     try {
                         const info = await transporter.sendMail(mailOptions);
                         console.log(`[${chatId}] E-mail enviado com sucesso: ${info.messageId}`);
                     } catch (emailError) {
                         console.error(`[${chatId}] Erro ao enviar e-mail para ${taskConfig.emailRecipient}:`, emailError);
                         await client.sendMessage(msg.from, 'Ocorreu um problema ao enviar a notificação por e-mail. Por favor, tente novamente mais tarde ou entre em contato por outro canal se for urgente.');
                     }
                 } else {
                     console.warn(`[${chatId}] Tarefa "${currentTask}" concluída, mas nenhum destinatário de e-mail configurado (emailRecipient).`);
                 }

                 // ** Finaliza a tarefa e volta para o menu de SERVIÇOS do setor **
                 console.log(`[${chatId}] Tarefa "${currentTask}" completa. Voltando para menu de serviços.`);
                 // Obter config do setor atual para mostrar menu de serviços
                 const sectorConfigAfterTask = getSectorById(selectedSectorId);
                 const servicesListAfterTask = sectorConfigAfterTask ? sectorConfigAfterTask.services.map(service => `${service.option} - ${service.name}`).join('\n') : 'Nenhum serviço encontrado.';

                 chatStates[chatId].state = 'sector_menu'; // Volta para o menu de SERVIÇOS
                 chatStates[chatId].currentTask = null;
                 chatStates[chatId].taskStep = 0;
                 chatStates[chatId].taskData = {}; // Limpa os dados coletados da tarefa

                 // Avisa o usuário e mostra novamente o menu de serviços
                 await client.sendMessage(msg.from, `Tarefa concluída. Por favor, escolha outro serviço no setor "${sectorConfigAfterTask.name}" ou digite \`!menu\` para voltar:\n\n${servicesListAfterTask}`);

             } // Fim do else (tarefa completa)

            break; // Fim do case 'in_task'


        default:
             // Estado desconhecido
             console.warn(`[${chatId}] Estado desconhecido "${currentChatState}". Resetando para menu.`);
             chatStates[chatId] = { state: 'awaiting_selection', sectorId: null, currentTask: null, taskStep: 0, taskData: {} };
             chatHistories[chatId] = [];
             await client.sendMessage(msg.from, 'Estado inválido. Por favor, escolha o setor novamente.\n\n' + initialMenuMessage);
             break;

    } // Fim do switch

}); // Fim do client.on('message', ...)


// Inicia o cliente WhatsApp
console.log('Iniciando cliente WhatsApp (Número Principal)...');
client.initialize()