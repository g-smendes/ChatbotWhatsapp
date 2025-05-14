
const moment = require('moment-timezone');


const API_BASE_URL = 'http://127.0.0.1:1234/v1';


const LLM_MODEL = 'llama-3.2-1b-instruct'; 

// Configuração do Servidor SMTP
// !!! ATENÇÃO: Armazenar credenciais diretamente no código NÃO é seguro para produção.
// Considere usar variáveis de ambiente (process.env.SMTP_USER, etc.) para credenciais em um ambiente real.
const smtpConfig = {
    host: 'smtp.gmail.com', // Ex: smtp.gmail.com, outlook.office365.com
    port: 587, // Geralmente 587 para TLS, 465 para SSL
    secure: false, // Use true para porta 465 (SSL), false para outras portas como 587 (TLS)
    auth: {
        user: {AUTH_USER}, // Seu endereço de e-mail
        pass: {AUTH_PASS}, // Sua senha ou senha de app/token
    },
    // Opcional: Ignorar verificação de certificado (não recomendado para produção)
    // tls: { rejectUnauthorized: false }
};

// Configurações dos setores/opções de atendimento
const sectors = [
    {
        id: 'geral',
        option: '1',
        name: 'Atendimento',
        systemMessage: 'Você é o assistente de Suporte Geral. Responda a perguntas amplas e encaminhe se necessário.',
        model: LLM_MODEL,
        services: [
            { option: '1', name: 'Solicitar Autorização', type: 'general_chat' },
            { option: '2', name: 'Cancelamento de Guias', type: 'general_chat' },
            { option: '3', name: 'Troca de E-mail App ', type: 'task', taskId: 'email_change_unimed' },
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
        services: [
             { option: '1', name: 'Troca de E-mail App ', type: 'task', taskId: 'email_change_unimed' },
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
            services: [
                 { option: '1', name: 'Falar com Vendas', type: 'general_chat' },
                 { option: '2', name: 'Voltar para o Menu Principal', type: 'main_menu' },
                ]
    },
    {
        id: 'Financeiro',
        option: '5',
        name: 'Financeiro',
        systemMessage: 'Você é o assistente de Financeiro. Responda a perguntas sobre produtos e serviços.',
        model: LLM_MODEL,
            services: [
                 { option: '1', name: 'Falar com Atendente', type: 'general_chat' },
                 { option: '2', name: 'Voltar para o Menu Principal', type: 'main_menu' },
                ]
    }
];

// Definição dos fluxos/tarefas específicas
const tasks = {
    'email_change_unimed': {
        name: 'Troca de E-mail App ',
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


module.exports = {
    API_BASE_URL,
    LLM_MODEL,
    smtpConfig,
    sectors,
    tasks,
    initialMenuMessage,
};