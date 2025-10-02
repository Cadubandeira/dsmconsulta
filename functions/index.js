const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors')({ origin: true });
const express = require('express');

// Set a global option to limit concurrent instances
setGlobalOptions({ maxInstances: 10 });

const app = express();

app.use(express.json());
app.use(cors);

// The API key is now read directly from the environment variables,
// which is populated by the `secrets` configuration below.
let genAI;
try {{
    // 1. Garante que a chave existe antes de tentar inicializar
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

} catch (e) {
    console.error("⚠️ ERRO CRÍTICO: Falha na inicialização do GoogleGenerativeAI ou falta da chave:", e.message);
    // Deixe 'model' como 'undefined' e lide com isso dentro da rota POST.
}

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

exports.dsmQuery = onRequest(
  {
    region: 'us-central1',
    secrets: ['GEMINI_API_KEY']
  },
  app
);

app.post('/', async (req, res) => {
if (!model) {
    return res.status(503).json({ 
        error: 'Service Unavailable: AI model failed to initialize.',
        details: 'API Key may be missing or failed to load from secret.'
    });
}

  const userQuery = req.body.query;

  const prompt = `Como um especialista em DSM-5, forneça um diagnóstico e raciocínio para a seguinte pergunta. A resposta deve ser baseada *apenas* no DSM-5. Se você não puder fornecer um diagnóstico, declare isso claramente e forneça o raciocínio.

  Pergunta: ${userQuery}

  Formate sua resposta como um objeto JSON com duas chaves: "diagnosis" e "reasoning". O raciocínio deve ser detalhado e citar os critérios relevantes do DSM-5.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Remove markdown formatting before parsing
    const cleanedText = text.replace(/```json\n|```/g, '').trim();

    // Now parse the cleaned JSON string
    const jsonResponse = JSON.parse(cleanedText);

    return res.status(200).json(jsonResponse);
} catch (error) {
    console.error("API call failed: ", error);
    return res.status(500).json({ error: "API call failed", details: error.message });
}
});