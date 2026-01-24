
import { GoogleGenAI } from "@google/genai";

const apiKey = 'AIzaSyBlCOYAySJa3uGCMrRSnIpkFflpuQ9qJUg';
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
