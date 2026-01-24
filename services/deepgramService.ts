import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";

let connection: any = null;
let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let stateChangeCallback: ((state: string) => void) | null = null;

export const stopDeepgram = () => {
    console.log("[Deepgram] Stopping...");

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (connection) {
        try {
            connection.finish();
        } catch (e) {
            console.warn("Connection cleanup error", e);
        }
        connection = null;
    }
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    // Manually trigger stopped state
    if (stateChangeCallback) {
        stateChangeCallback("stopped");
        stateChangeCallback = null;
    }
};

/**
 * Generate optimized keywords for Deepgram
 * Focus on:
 * 1. Hardcoded high-value Ayurvedic terms (boost 10)
 * 2. Exact product names (boost 5)
 * dynamically from the full product list.
 */
function generateKeywords(products: string[]): string[] {
    const keywords: string[] = [];
    const seenWords = new Set<string>();
    const seenCombos = new Set<string>();

    // Common words to skip (noise reduction)
    const skipWords = new Set([
        'the', 'a', 'an', 'of', 'for', 'with', 'and', 'or', 'in', 'to',
        'ml', 'gm', 'kg', 'mg', 'g', 'l', 'tablet', 'tablets', 'capsule',
        'capsules', 'syrup', 'powder', 'oil', 'drops', 'pack', 'bottle',
        'set', 'combo', 'kit', 'box', 'piece', 'pcs', 'unit',
        'mr', 'mrs', 'dr', 'prof', 'eng', 'er', 'ar',
        'exe', 'size', 'net', 'wt', 'vol', 'mrp', 'dp', 'sp',
        's', 'm', 'l', 'xl', 'xxl', // sizes
        'black', 'white', 'red', 'blue', 'green' // common colors
    ]);

    // 1. Core Ayurvedic/Medical Terms (Always Boosted High)
    const coreTerms = [
        'panch:10', 'tulsi:10', 'asclepius:10', 'ashwagandha:10',
        'immunodoc:10', 'curcidoc:10', 'orthodoc:10', 'thunderblast:10',
        'gynecodoc:10', 'liverdoc:10', 'kidgydoc:10', 'pilodoc:10',
        'thyrodoc:10', 'fenedoc:10', 'obdoc:10', 'cardiodoc:10',
        'diabodoc:10', 'triphala:10', 'shilajit:10', 'brahmi:10',
        'noni:10', 'spirulina:10', 'moringa:10', 'giloy:10',
        'curcumin:10', 'punarnava:10', 'shankhpushpi:10',
        'bhringraj:10', 'shikakai:10', 'amla:10', 'awla:10'
    ];
    keywords.push(...coreTerms);
    coreTerms.forEach(t => seenWords.add(t.split(':')[0]));

    // 2. Iterate continuously through ALL product names
    for (const productName of products) {
        if (!productName || productName.length < 2) continue;

        const clean = productName
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const words = clean.split(' ').filter(w => w.length > 2 && !skipWords.has(w));

        // Strategy A: Boost individual unique words
        for (const word of words) {
            // Avoid boosting simple numbers or short tokens
            if (/\d/.test(word)) continue;

            if (!seenWords.has(word)) {
                // Determine boost level
                // Words ending in 'doc' are usually brand names -> Higher boost
                const boost = word.endsWith('doc') ? 5 : 3;
                keywords.push(`${word}:${boost}`);
                seenWords.add(word);
            }
        }

        // Strategy B: Boost first 2 distinctive words as a phrase (if applicable)
        // Note: Deepgram keywords are single tokens, but sending "word1 word2" works for some models
        // Instead, we ensure both words are added.
        // We can also add "BrandName" style combination if it's split
    }

    // 3. Sort by boost to prioritize important terms
    const sorted = keywords.sort((a, b) => {
        const boostA = parseInt(a.split(':')[1] || '0');
        const boostB = parseInt(b.split(':')[1] || '0');
        return boostB - boostA;
    });

    console.log(`[Deepgram] Optimization complete. Generated ${sorted.length} keywords for ${products.length} products.`);

    // Send up to 800 keywords (Deepgram limit is ~1000ish, staying safe)
    return sorted.slice(0, 800);
}


export const startDeepgram = async (
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onStateChange: (state: string) => void,
    products: string[]
) => {
    try {
        stopDeepgram();

        // Store callback globally so stopDeepgram can use it
        stateChangeCallback = onStateChange;

        onStateChange("initializing");

        // STEP 1: Get API Key from Firebase Function
        const getDeepgramApiKey = httpsCallable(functions, 'getDeepgramApiKey');
        const result = await getDeepgramApiKey();
        const apiKey = (result.data as any).key;

        if (!apiKey) throw new Error("Failed to retrieve Deepgram API key");

        // STEP 2: Create a Deepgram client using the API key
        const deepgram = createClient(apiKey);

        // Prepare keywords
        const keywords = generateKeywords(products);
        console.log(`[Deepgram] Loaded ${keywords.length} keywords for recognition`);

        // Request microphone permission
        onStateChange("requesting_permission");
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        onStateChange("connecting");

        // Add number words as keywords too (to help with quantity recognition)
        const numberKeywords = [
            'one:3', 'two:3', 'three:3', 'four:3', 'five:3',
            'six:3', 'seven:3', 'eight:3', 'nine:3', 'ten:3'
        ];
        const allKeywords = [...keywords, ...numberKeywords];

        // STEP 3: Create a live transcription connection with keywords
        connection = deepgram.listen.live({
            model: "nova-2",
            language: "en-US",
            smart_format: true,
            keywords: allKeywords
        });

        // STEP 4: Listen for events from the live transcription connection
        connection.on(LiveTranscriptionEvents.Open, () => {
            console.log("[Deepgram] Connection opened.");
            onStateChange("listening");

            if (!stream) return;

            // Create MediaRecorder to capture audio
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });

            mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0 && connection?.getReadyState() === 1) {
                    connection.send(event.data);
                }
            });

            // Start recording and send chunks every 250ms
            mediaRecorder.start(250);
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log("[Deepgram] Connection closed.");
            onStateChange("stopped");
            stopDeepgram();
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            if (transcript) {
                console.log(`[Deepgram] Transcript: "${transcript}" (final: ${data.is_final})`);
                onTranscript(transcript, data.is_final);
            }
        });

        connection.on(LiveTranscriptionEvents.Metadata, (data: any) => {
            console.log("[Deepgram] Metadata:", data);
        });

        connection.on(LiveTranscriptionEvents.Error, (err: any) => {
            console.error("[Deepgram] Error:", err);
            onStateChange("error");
            stopDeepgram();
        });

    } catch (err) {
        console.error("[Deepgram] Setup Error:", err);
        onStateChange("error");
        stopDeepgram();
        throw err;
    }
};
