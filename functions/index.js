const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
// O SDK '@google/generative-ai' foi renomeado para '@google/genai'
// mas vamos manter o que você usou se for mais compatível com sua versão.
const { GoogleGenerativeAI } = require('@google/generative-ai'); 
const cors = require('cors')({ origin: true });
const express = require('express');

// Set a global option to limit concurrent instances
setGlobalOptions({ maxInstances: 10 });

const app = express();

app.use(express.json());
app.use(cors);

// --- 1. Inicialização do Modelo (Robustez de Inicialização) ---
let genAI;
let model;

try {
    // Verifica se a chave foi carregada corretamente
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set. Check your Secret Manager configuration.");
    }
    
    // Inicializa a API
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Inicializa o Modelo
    model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash" 
    });

    console.log("Gemini model initialized successfully.");
} catch (e) {
    console.error("⚠️ ERRO CRÍTICO: Falha na inicialização da IA:", e.message);
    // Em caso de falha na inicialização, o 'model' permanecerá 'undefined'.
}
// -------------------------------------------------------------------

// --- 2. Configuração da Função de Exportação ---
exports.dsmQuery = onRequest(
    {
        region: 'us-central1',
        secrets: ['GEMINI_API_KEY'] // Importação segura da chave
    },
    app
);
// -------------------------------------------------------------------

// --- 3. Rota POST Principal (/): Lógica de Consulta ---
app.post('/', async (req, res) => {
    // Verifica se o modelo foi inicializado corretamente
    if (!model) {
        return res.status(503).json({ 
            error: 'Service Unavailable',
            details: 'O modelo de IA falhou ao inicializar. Verifique a chave de API no Secret Manager.'
        });
    }

    // Validação de entrada
    if (!req.body || !req.body.query) {
        return res.status(400).send({
            error: 'Bad Request: A POST request with a "query" field is required.'
        });
    }

    const userQuery = req.body.query;

    // Prompt com ênfase na saída JSON estruturada
    const prompt = `Como um especialista em DSM-5, forneça um diagnóstico e raciocínio para a seguinte pergunta. A resposta deve ser baseada *apenas* no DSM-5. Se você não puder fornecer um diagnóstico, declare isso claramente e forneça o raciocínio.

    Pergunta: ${userQuery}

    A resposta deve aderir estritamente ao formato JSON com as chaves "diagnosis" e "reasoning". O raciocínio deve ser detalhado e citar os critérios relevantes do DSM-5.`;
    
    // Schema de resposta para reforçar a estrutura JSON
    const responseSchema = {
        type: "OBJECT",
        properties: {
            diagnosis: {
                type: "STRING",
                description: "The final DSM-5 diagnosis (e.g., 'Transtorno de Ansiedade Generalizada') or a statement that a diagnosis cannot be provided.",
            },
            reasoning: {
                type: "STRING",
                description: "Detailed rationale citing relevant DSM-5 criteria and a brief summary of how the criteria were met or why a diagnosis is not possible.",
            },
        },
        required: ["diagnosis", "reasoning"],
    };


    try {
        // Chamada à API usando generateContent com JSON Mode
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                // Habilita o JSON Mode
                responseMimeType: "application/json", 
                // Define a estrutura que o JSON deve seguir
                responseSchema: responseSchema,
                // Parâmetros opcionais de qualidade
                temperature: 0.2, // Baixa temperatura para respostas mais determinísticas/fatuais
            }
        });

        // O método .json() é mais seguro e limpo para outputs com JSON Mode
        const jsonResponse = result.response.json();
        
        return res.status(200).json(jsonResponse);
    } catch (error) {
        console.error("API call failed: ", error);
        // Retorna um erro 500 com os detalhes do erro para ajudar no debug
        return res.status(500).json({ 
            error: "Falha na chamada da API do Gemini", 
            details: error.message 
        });
    }
});
// -------------------------------------------------------------------