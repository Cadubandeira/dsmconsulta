const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { GoogleGenerativeAI } = require('@google/generative-ai'); 
const cors = require('cors')({ origin: true });
const express = require('express');

setGlobalOptions({ maxInstances: 10 });

const app = express();

app.use(express.json());
app.use(cors);

// Variáveis de escopo global, mas NÃO inicializadas aqui.
// Isso evita o erro no ambiente de build (GEMINI_API_KEY is not set)
let genAI;
let model;

exports.dsmQuery = onRequest(
    {
        region: 'us-central1',
        secrets: ['GEMINI_API_KEY'] 
    },
    app
);

app.post('/', async (req, res) => {
    // 1. Lógica Singleton: Inicializa o modelo APENAS no runtime
    if (!model) {
        try {
            // ADICIONE ESTA LINHA PARA FORÇAR O DEPLOY
            console.log("Forçando atualização do código com modelo 2.5-flash."); 
            
            if (!process.env.GEMINI_API_KEY) {
                // Isso só será atingido se o Secret Manager falhar no runtime
                throw new Error("GEMINI_API_KEY not set in runtime environment.");
            }
            // AQUI GARANTIMOS O MODELO CORRETO!
            genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash" 
            });
            console.log("Model initialized correctly in runtime.");
        } catch (e) {
            console.error("Initialization failure during runtime:", e.message);
            return res.status(500).json({ 
                error: 'AI Initialization Error',
                details: 'Failed to initialize Gemini model. ' + e.message 
            });
        }
    }
    // FIM DA LÓGICA SINGLETON

    if (!req.body || !req.body.query) {
        return res.status(400).send({
            error: 'Bad Request: A POST request with a "query" field is required.'
        });
    }

    const userQuery = req.body.query;

    const prompt = `Como um especialista em DSM-5, forneça um diagnóstico e raciocínio para a seguinte pergunta... Pergunta: ${userQuery} ...`;
    
    const responseSchema = {
        type: "OBJECT",
        properties: {
            diagnosis: { type: "STRING" },
            reasoning: { type: "STRING" },
        },
        required: ["diagnosis", "reasoning"],
    };

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json", 
                responseSchema: responseSchema,
                temperature: 0.2,
            }
        });

        const jsonResponse = result.response.json();
        
        return res.status(200).json(jsonResponse);
    } catch (error) {
        console.error("API call failed: ", error);
        return res.status(500).json({ 
            error: "API call failed", 
            details: error.message 
        });
    }
});