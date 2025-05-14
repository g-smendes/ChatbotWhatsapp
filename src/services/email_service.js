// Lógica de envio de e-mail
const nodemailer = require('nodemailer');
const { smtpConfig } = require('../config');

// Cria o transportador Nodemailer
const transporter = nodemailer.createTransport(smtpConfig);

// Verifica a conexão SMTP (opcional, boa prática) - rodará ao importar
transporter.verify(function (error, success) {
    if (error) {
        console.error('Erro ao conectar ao servidor SMTP:', error);
    } else {
        console.log('Servidor SMTP pronto para receber mensagens.');
    }
});

async function sendTaskCompletionEmail(mailOptions) {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`E-mail enviado com sucesso: ${info.messageId}`);
        return true; // Indica sucesso
    } catch (emailError) {
        console.error('Erro ao enviar e-mail:', emailError);
        return false; // Indica falha
    }
}

module.exports = {
    sendTaskCompletionEmail,
    // O transporter pode ser exportado se outras partes precisarem verifica-lo,
    // mas a função de envio encapsula a maior parte da necessidade.
};