// Lógica principal de recebimento e processamento de mensagens
const moment = require('moment-timezone'); // Usado apenas para data/hora em mensagens/email
const { initialMenuMessage, sectors, tasks, smtpConfig } = require('../config');
const { getSectorByOption, getSectorById, getTaskById, getSectorServices } = require('../utils');
const { sendTaskCompletionEmail } = require('../services/email_service.js');
const { getLmStudioCompletion } = require('../services/lmstudio_service.js');

// Este handler recebe o cliente, os estados e o histórico.
// Ele NÃO faz as verificações iniciais de grupo, status ou mídia vazia.
// Essas verificações são feitas no index.js antes de chamar este handler.
async function handleMessage(client, msg, chatStates, chatHistories) {
    const chatId = msg.from;
    const userInput = msg.body.trim();

    // Garante que o estado e histórico para este chat existem
    // Esta parte ainda precisa ser feita aqui, pois só sabemos o chatId dentro do handler
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
        chatHistories[chatId] = []; // Limpa histórico ao voltar para o menu principal
        await client.sendMessage(msg.from, initialMenuMessage);
        return; // Importante sair após processar o comando
    }

    // Comando !sair para encerrar atendimento
    if (userInput.toLowerCase() === '!sair') {
        console.log(`[${chatId}] Comando !sair recebido. Encerrando atendimento.`);
        await client.sendMessage(msg.from, 'Ok. Encerrando o atendimento. Se precisar de algo mais, me envie uma nova mensagem.');
        delete chatStates[chatId]; // Remove o estado do chat
        delete chatHistories[chatId]; // Remove o histórico do chat
        return; // Importante sair após processar o comando
    }

    // O comando !cancelar agora só funciona de in_task
    // Ao cancelar, volta para o menu de SERVIÇOS do setor
    if (currentChatState === 'in_task' && userInput.toLowerCase() === '!cancelar') {
        console.log(`[${chatId}] Comando !cancelar recebido. Cancelando tarefa "${currentTask}".`);
        const taskConfig = getTaskById(currentTask);
        const sectorConfigAfterCancel = getSectorById(selectedSectorId);
        const servicesListAfterCancel = sectorConfigAfterCancel ? sectorConfigAfterCancel.services.map(service => `${service.option} - ${service.name}`).join('\n') : 'Nenhum serviço encontrado.';
        await client.sendMessage(msg.from, `Tarefa "${taskConfig ? taskConfig.name : currentTask}" cancelada. Por favor, escolha um serviço no setor "${sectorConfigAfterCancel.name}" ou digite \`!menu\` para voltar:\n\n${servicesListAfterCancel}`);
        chatStates[chatId] = { state: 'sector_menu', sectorId: selectedSectorId, currentTask: null, taskStep: 0, taskData: {} }; // Volta para o menu de SERVIÇOS
        chatHistories[chatId] = []; // Limpa histórico ao cancelar tarefa
        return; // Importante sair após processar o comando
    }


    // --- Máquina de Estados do Chat ---
    switch (currentChatState) {
        case 'initial':
            console.log(`[${chatId}] Novo chat. Enviando menu inicial.`);
            chatStates[chatId].state = 'awaiting_selection';
            chatHistories[chatId] = []; // Limpa histórico no início
            await client.sendMessage(msg.from, initialMenuMessage);
            break;

        case 'awaiting_selection':
            console.log(`[${chatId}] Aguardando seleção de setor. Input: ${userInput}`);
            const selectedSector = getSectorByOption(userInput);

            if (selectedSector) {
                console.log(`[${chatId}] Setor "${selectedSector.name}" (${selectedSector.id}) selecionado.`);
                chatStates[chatId].state = 'sector_menu'; // Vai para o estado sector_menu
                chatStates[chatId].sectorId = selectedSector.id; // Salva o setor escolhido
                chatStates[chatId].currentTask = null;
                chatStates[chatId].taskStep = 0;
                chatStates[chatId].taskData = {};
                // chatHistories[chatId] = []; // O histórico é limpo ao selecionar o SERVIÇO, não o setor.

                // Envia o menu de serviços do setor
                const sectorServices = getSectorServices(selectedSector.id);
                if (sectorServices.length > 0) {
                    const servicesList = sectorServices.map(service => {
                         return `${service.option} - ${service.name}`;
                    }).join('\n');
                    await client.sendMessage(msg.from, `Você escolheu o setor "${selectedSector.name}".\nPor favor, selecione o serviço desejado, digitando o número:\n\n${servicesList}`);
                } else {
                    console.warn(`[${chatId}] Setor "${selectedSector.name}" (${selectedSector.id}) sem serviços definidos. Indo direto para conversa geral.`);
                    // Setor sem serviços definidos, vai para conversa geral diretamente
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

        case 'sector_menu':
            console.log(`[${chatId}] Em menu de serviço do setor "${selectedSectorId}". Input: ${userInput}`);
            const sectorConfigForMenu = getSectorById(selectedSectorId);
            const sectorServicesForMenu = sectorConfigForMenu ? sectorConfigForMenu.services : [];

            const selectedServiceOption = sectorServicesForMenu.find(service => service.option === userInput);

            if (selectedServiceOption) {
                console.log(`[${chatId}] Serviço "${selectedServiceOption.name}" (${selectedServiceOption.option}) selecionado no setor "${selectedSectorId}".`);

                // Limpa o histórico GERAL ao sair do menu de serviços e iniciar chat ou task
                chatHistories[chatId] = [];

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
                            // Permanece no estado sector_menu
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
                 return; // Importante sair
            }

            // Não verifica mais !iniciar aqui, pois o início da tarefa é feito pelo menu de serviço
            // O comando !menu já é tratado no início do handler globalmente

            // --- Processar mensagem com LM Studio ---
            if (!userInput.toLowerCase().startsWith('!')) { // Só processa com LM se não for um comando (embora comandos já sejam tratados globalmente)
                if (!chatHistories[chatId]) chatHistories[chatId] = [];
                chatHistories[chatId].push({ role: 'user', content: msg.body });
                console.log(`[${chatId}] Chamando LM Studio para conversa geral em ${sectorConfig.name} (${sectorConfig.model})...`);
                await msg.getChat().then(chat => chat.sendStateTyping()); // Envia status "digitando"
                const generatedText = await getLmStudioCompletion([
                    { role: 'system', content: sectorConfig.systemMessage }
                ].concat(chatHistories[chatId]), sectorConfig.model);

                if (generatedText) {
                    chatHistories[chatId].push({ role: 'assistant', content: generatedText });
                    await client.sendMessage(msg.from, generatedText.trim());
                    console.log(`[${chatId}] Resposta geral enviada para ${sectorConfig.name}:`, generatedText.trim());
                    // Limita o histórico para evitar que fique muito grande
                    const historyLimit = 20;
                    if (chatHistories[chatId].length > historyLimit) {
                        chatHistories[chatId] = chatHistories[chatId].slice(chatHistories[chatId].length - historyLimit);
                        console.log(`[${chatId}] Histórico geral limitado para ${historyLimit} pares.`);
                    }
                } else {
                    console.warn(`[${chatId}] Resposta da API vazia ou erro para conversa geral em ${sectorConfig.name}.`);
                    await client.sendMessage(msg.from, 'Desculpe, não consegui gerar uma resposta neste setor.');
                }
            }
            break; // Fim do case 'in_conversation'

        case 'in_task':
            console.log(`[${chatId}] Em tarefa "${currentTask}" passo ${taskStep}. Input: ${userInput}`);

            const taskConfig = getTaskById(currentTask);
            // Ao encontrar erro na tarefa, volta para o menu de SERVIÇOS
            if (!taskConfig || !taskConfig.steps || taskStep <= 0 || taskStep > taskConfig.steps.length) {
                 console.error(`[${chatId}] Erro: Tarefa "${currentTask}" ou passo ${taskStep} inválido. Voltando para menu de serviços.`);

                 const sectorConfigOnError = getSectorById(selectedSectorId);
                 const servicesListOnError = sectorConfigOnError ? sectorConfigOnError.services.map(service => `${service.option} - ${service.name}`).join('\n') : 'Nenhum serviço encontrado.';

                 await client.sendMessage(msg.from, `Ocorreu um problema na tarefa. Voltando para o menu de serviços do setor "${sectorConfigOnError.name}".\n\n${servicesListOnError}`);

                 // Transição de estado correta
                 chatStates[chatId].state = 'sector_menu'; // Volta para o menu de SERVIÇOS
                 chatStates[chatId].currentTask = null;
                 chatStates[chatId].taskStep = 0;
                 chatStates[chatId].taskData = {};
                 return; // Importante sair
             }

            const currentStep = taskConfig.steps[taskStep - 1];

            // ** Validação e Armazenamento do Input do Passo Atual **
            if (currentStep.validation && !currentStep.validation(userInput)) {
                console.log(`[${chatId}] Validação falhou para o passo ${taskStep}. Input: "${userInput}".`);
                await client.sendMessage(msg.from, `Entrada inválida para este passo. Por favor, ${currentStep.prompt}\n\nDigite \`!cancelar\` a qualquer momento para sair da tarefa.`);
                return; // Não avança se a validação falhar
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

                // Gerar número aleatório para o chamado
                const numeroChamado = Date.now() + Math.floor(Math.random() * 1000); // Combina timestamp com número aleatório pequeno para razoável unicidade
                console.log(`[${chatId}] Gerado número de chamado: #${numeroChamado}`);


                // 1. Enviar mensagem de conclusão para o usuário no WhatsApp
                const completionMessageText = taskConfig.completionMessage(taskData, numeroChamado); // Passa numeroChamado
                await client.sendMessage(msg.from, completionMessageText);
                console.log(`[${chatId}] Mensagem de conclusão da tarefa "${currentTask}" enviada para o usuário.`);


                // 2. Enviar E-mail para o setor responsável
                if (taskConfig.emailRecipient) {
                    const mailOptions = {
                        from: smtpConfig.auth.user,
                        to: taskConfig.emailRecipient,
                        subject: `[Chamado #${numeroChamado}] ${taskConfig.emailSubject || `Nova Tarefa Concluida: ${taskConfig.name}`}`, // Inclui numeroChamado no assunto
                        text: taskConfig.emailBodyFormatter ? taskConfig.emailBodyFormatter(taskData, chatId, numeroChamado) : `Dados da tarefa "${taskConfig.name}":\n${JSON.stringify(taskData, null, 2)}`, // Passa numeroChamado
                        // html: '<b>Corpo do e-mail em HTML</b>' // Opcional: corpo em HTML
                    };

                    console.log(`[${chatId}] Tentando enviar e-mail para ${taskConfig.emailRecipient}...`);
                    // Usa a função do service. Note que no código reestruturado,
                    // esta função sendTaskCompletionEmail estará em src/services/email.service.js
                    try {
                         const info = await transporter.sendMail(mailOptions); // Chame diretamente transporter.sendMail aqui se não usar o service
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
}

module.exports = {
    handleMessage,
};