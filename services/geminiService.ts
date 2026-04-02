
import { Product } from '../types';

// Gemini API Key - loaded from .env (VITE_GEMINI_API_KEY)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

export interface ReceiptDetectedItem {
    name: string;
    quantity: number;
    matchedInventoryName?: string;
}

export async function analyzeReceipt(base64Image: string, inventoryProductNames: string[]): Promise<ReceiptDetectedItem[]> {
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mimeMatch = base64Image.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const prompt = `You are a stock receipt scanner for an Ayurvedic / general store.
Analyze this receipt image and extract ALL product names and their quantities.

Here is the store's product inventory for matching:
${inventoryProductNames.slice(0, 200).join('\n')}

INSTRUCTIONS:
1. Extract every product line from the receipt - look for product names and quantities.
2. For each detected product, try to match it to the closest inventory product name above.
3. If a quantity column exists, use that. Otherwise default to 1.
4. Be thorough - do NOT skip any products. Scan every row of the receipt.
5. Product names on receipts may be abbreviated or truncated - match as best you can.

Return ONLY a valid JSON array:
[{"name": "detected product name from receipt", "quantity": 5, "matchedInventoryName": "closest inventory match or null"}, ...]

If you cannot detect any products, return empty array: []
JSON Output:`;

    const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    {
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    },
                    { text: prompt }
                ]
            }],
            generationConfig: {
                temperature: 0.05,
                maxOutputTokens: 4096
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini Receipt API error:', response.status, errText);
        throw new Error(`Gemini API Error: ${response.status} - ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return [];

    const jsonStr = text.replace(/```json|```/g, '').trim();
    const items: ReceiptDetectedItem[] = JSON.parse(jsonStr);

    // Validate
    return items
        .map(item => ({
            name: item.name?.trim() || '',
            quantity: (typeof item.quantity === 'number' && item.quantity > 0) ? item.quantity : 1,
            matchedInventoryName: item.matchedInventoryName || undefined
        }))
        .filter(item => item.name.length >= 2);
}
