// Arquivo principal que inicia o bot e conecta as partes
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Importa os handlers e outras partes necessárias
const { initialMenuMessage } = require('./config'); // Pode importar algo do config se precisar aqui
const { handleMessage } = require('./handlers/message_handler.js');
const { sendTaskCompletionEmail } = require('./services/email_service.js'); // Importa a função de teste de conexão, se quiser (email.service já verifica ao ser importado)



const chatStates = {};
const chatHistories = {};

// Flag para verificar se o cliente está pronto
let isClientReady = false;


// Configura o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] }
});


// --- Eventos do Cliente WhatsApp ---
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
    isClientReady = true;
});

client.on('authenticated', () => {
    console.log('Autenticado!');
});

client.on('auth_failure', msg => {
    console.error('Falha na autenticação', msg);
});

client.on('disconnected', (reason) => {
    console.log('Cliente desconectado', reason);
    // ** Opcional: Resetar o flag se desconectar **
    isClientReady = false;
    // Tentar reinicializar ou logar erro fatal
});

// --- Listener Principal de Mensagens ---
client.on('message', async msg => {
    
    if (!isClientReady) {
        return;
    }

    // ** PRÓXIMAS VERIFICAÇÕES: Ignora mensagens vazias, de status, mídia ou de grupo **
    if (msg.body === '' || msg.isStatus || msg.hasMedia || msg.isGroup || msg.from.endsWith('@g.us')) {
         
        return; 
    }

    
    await handleMessage(client, msg, chatStates, chatHistories);
});


// Inicia o cliente WhatsApp
console.log('Iniciando cliente WhatsApp...');
client.initialize();