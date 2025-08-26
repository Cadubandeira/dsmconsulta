/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const functions = require('firebase-functions');
const fetch = require('node-fetch');

// This is the recommended way to get environment variables.
// The key is set via the .env file.
const GEMINI_API_KEY = process.env.DSM_KEY;
const BASE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=';

exports.dsmQuery = functions.https.onRequest(async (req, res) => {
    // Set CORS headers to allow your frontend to access this function
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST' || !req.body || !req.body.query) {
        res.status(400).send('Bad Request: A POST request with a "query" field is required.');
        return;
    }

    const { query } = req.body;

    try {
        const urlWithKey = `${BASE_API_URL}${GEMINI_API_KEY}`;
        const payload = {
            contents: [{
                role: 'user',
                parts: [{ text: `Como um especialista em DSM-5, forneça um diagnóstico e raciocínio para a seguinte pergunta: ${query}` }],
            }],
        };

        const apiResponse = await fetch(urlWithKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await apiResponse.json();
        res.status(apiResponse.status).send(data);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).send('Internal Server Error: Failed to process your request.');
    }
});