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
try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (e) {
    console.error("Failed to initialize GoogleGenerativeAI:", e);
    // You might want to handle this more gracefully in a real app
}
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

exports.dsmQuery = onRequest(
  {
    region: 'us-central1',
    secrets: ['GEMINI_API_KEY']
  },
  app
);

app.post('/', async (req, res) => {
  if (!req.body || !req.body.query) {
    return res.status(400).send({
      error: 'Bad Request: A POST request with a "query" field is required.'
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