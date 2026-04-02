
import { GoogleGenAI } from "@google/genai";

// Load API key from environment: set VITE_GEMINI_API_KEY in .env
const apiKey = process.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

async function listModels() {
    try {
        console.log("Listing models...");
        const response = await ai.models.list();
        console.log("Available models:");
        for await (const model of response) {
            console.log(`- ${model.name}`);
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
