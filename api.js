// Importa a biblioteca axios que instalamos
const axios = require('axios');

// Define o endereço base da API do LM Studio
// Certifique-se de que esta URL e porta correspondam ao que o LM Studio mostra!
const API_BASE_URL = 'http://127.0.0.1:1234/v1';

// Define a função assíncrona para chamar a API
async function testLMApi() {
    try {
        console.log('Chamando a API do LM Studio...');

        // Define os dados que serão enviados na requisição (formato compatível com OpenAI)
        const payload = {
            model: 'llama-3.2-1b-instruct', // <-- SUBSTITUA PELO NOME DO SEU MODELO NO LM STUDIO
            messages: [
                { role: 'system', content: 'Você é um assistente útil e conciso.' },
                { role: 'user', content: 'Tamanho do Brasil?' }
            ],
            temperature: 0.7, // Controla a aleatoriedade (0 é mais determinístico)
            max_tokens: 100 // Limita o tamanho da resposta para este teste
        };

        // Faz a requisição POST para o endpoint de chat completions
        const response = await axios.post(`${API_BASE_URL}/chat/completions`, payload);

        // Processa a resposta
        const generatedText = response.data.choices[0].message.content;

        console.log('\n--- Resposta do Modelo ---');
        console.log(generatedText.trim()); // .trim() remove espaços em branco extras no início/fim
        console.log('-------------------------');

    } catch (error) {
        console.error('\n--- Erro ao chamar a API ---');
        // Verifica se é um erro de resposta HTTP
        if (error.response) {
            console.error('Código de Status:', error.response.status);
            console.error('Dados do Erro:', error.response.data);
        } else {
            console.error('Erro:', error.message);
        }
        console.error('-------------------------');
        console.error('Verifique se o LM Studio está aberto e o servidor local está rodando na porta 1234.');
        console.error('Verifique se o nome do modelo no código ("YOUR_MODEL_NAME") corresponde ao nome do modelo carregado no LM Studio.');
    }
}

// Chama a função para iniciar o teste
testLMApi();