// Lógica de interação com LM Studio
const axios = require('axios');
const { API_BASE_URL, LLM_MODEL } = require('../config');

async function getLmStudioCompletion(messages, model = LLM_MODEL) {
    const payload = {
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500 // Ajuste conforme necessário
    };

    try {
        const response = await axios.post(`${API_BASE_URL}/chat/completions`, payload);
        const generatedText = response.data.choices[0].message.content;
        return generatedText;
    } catch (error) {
        console.error('\n--- Erro ao chamar LM Studio ---');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados do Erro:', error.response.data);
        } else if (error.request) {
            console.error('Erro na requisição:', error.request);
        } else {
            console.error('Erro:', error.message);
        }
        console.error('---------------------------------');
        return null; // Retorna null ou joga o erro, dependendo de como quer tratar
    }
}

module.exports = {
    getLmStudioCompletion,
};