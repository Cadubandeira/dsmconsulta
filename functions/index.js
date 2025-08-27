const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineString } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors')({ origin: true });
const express = require('express');

// Define your API key as a secure parameter.
const GEMINI_API_KEY = defineString('GEMINI_API_KEY');

// Set a global option to limit concurrent instances
setGlobalOptions({ maxInstances: 10 });

const app = express();

app.use(express.json());
app.use(cors);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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

    const jsonResponse = JSON.parse(text);

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("API call failed: ", error);
    return res.status(500).json({ error: "API call failed", details: error.message });
  }
});