
import { Product } from '../types';

// Gemini API Key - Move to .env.local in production
const GEMINI_API_KEY = 'AIzaSyBlCOYAySJa3uGCMrRSnIpkFflpuQ9qJUg';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

interface GeminiResponse {
    candidates: {
        content: {
            parts: {
                text: string;
            }[];
        };
    }[];
}

export interface ParsedBillItem {
    productName: string;
    quantity: number;
}

export const geminiService = {
    async parseTranscript(transcript: string, products: Product[]): Promise<ParsedBillItem[]> {
        try {
            // Simplified prompt - don't send all products to reduce token count
            // Let Gemini extract what it thinks the products are, we'll match later
            const prompt = `
You are a billing assistant for an Ayurvedic medicine shop.
Extract ONLY actual product names and quantities from this voice transcript.

RULES:
1. Only extract words that sound like product names (medicine/health products like tablets, syrups, oils, powders, etc.)
2. Ignore filler words like "add", "make a bill", "with", "and", "please", etc.
3. If NO quantity is mentioned before a product, default to 1
4. Product names often contain: DOC, RAS, KWATH, TABLET, CAPSULE, POWDER, OIL, SYRUP, CREAM, etc.

NUMBER NORMALIZATION (common speech mishearings):
- "to", "too", "tu" = 2
- "for", "fore" = 4  
- "won", "wan" = 1
- "tree", "free" = 3
- "ate", "ait" = 8

Return ONLY a valid JSON array: [{"productName": "...", "quantity": 1}, ...]
If you cannot identify any products, return empty array: []

Transcript: "${transcript}"

JSON Output:`;

            console.log('🤖 Calling Gemini with transcript:', transcript);

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.05, // Lower temperature for more deterministic output
                        maxOutputTokens: 1000
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('Gemini API response:', response.status, errText);
                throw new Error(`Gemini API Error: ${response.status} - ${response.statusText}`);
            }

            const data: GeminiResponse = await response.json();
            console.log('Gemini response:', JSON.stringify(data));

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) return [];

            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json|```/g, '').trim();
            let items: ParsedBillItem[] = JSON.parse(jsonStr);

            // POST-PARSE VALIDATION: Ensure all items have valid quantity
            items = items.map(item => ({
                productName: item.productName?.trim() || '',
                quantity: (typeof item.quantity === 'number' && item.quantity > 0) ? item.quantity : 1
            })).filter(item => item.productName.length >= 3); // Filter out very short/invalid names

            console.log('✅ Parsed items:', items);
            return items;
        } catch (error) {
            console.error('Gemini Parse Error:', error);
            return [];
        }
    }
};
