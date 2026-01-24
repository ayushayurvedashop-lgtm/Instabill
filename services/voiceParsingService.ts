import { Product } from '../types';

// ==========================================
// COMPREHENSIVE NUMBER MAPPINGS
// ==========================================
const wordToNumber: Record<string, number> = {
    // English numbers
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    // Hindi numbers
    'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'panch': 5,
    'che': 6, 'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
    'gyarah': 11, 'barah': 12,
    // COMMON MISHEARINGS
    'to': 2, 'too': 2, 'tu': 2, 'tow': 2,
    'for': 4, 'fore': 4, 'foor': 4,
    'tree': 3, 'free': 3, 'tri': 3,
    'won': 1, 'wan': 1, 'wun': 1,
    'ate': 8, 'ait': 8,
    'sex': 6, 'sicks': 6,
    'nein': 9, 'non': 9,
    'tan': 10, 'tin': 10,
    // Digits
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
};

// Stop words to remove
const stopWords = new Set([
    'add', 'please', 'give', 'me', 'i', 'want', 'need', 'get', 'put',
    'piece', 'pieces', 'qty', 'quantity', 'item', 'items', 'units', 'unit',
    'the', 'a', 'an', 'some', 'of', 'with', 'also', 'then', 'next', 'after', 'that'
]);

// KNOWN PHRASE MAPPINGS (Fix common mishearings)
const knownPhraseMappings: Record<string, string> = {
    'punctuation': 'panch tulsi',
    'punch tulsi': 'panch tulsi',
    'panchiatici': 'panch tulsi',
    'panchatulsi': 'panch tulsi',
    'immunodoc': 'immunodoc ras',
    'immuno doc': 'immunodoc ras',
    'thunder': 'thunderblast',
    'ortho': 'orthodoc',
    'gyno': 'gynecodoc',
    'liver': 'liverdoc',
    'kidney': 'kidgydoc',
    'diabo': 'diabodoc',
    'sugar': 'diabodoc'
};

interface ParsedVoiceItem {
    productName: string;
    quantity: number;
    matchedProduct?: Product;
    confidence: number;
}

// ==========================================
// PHONETIC ENCODING (Simplified Soundex)
// ==========================================
function soundex(str: string): string {
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';

    const codes: Record<string, string> = {
        'B': '1', 'F': '1', 'P': '1', 'V': '1',
        'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
        'D': '3', 'T': '3',
        'L': '4',
        'M': '5', 'N': '5',
        'R': '6'
    };

    let result = s[0];
    let prevCode = codes[s[0]] || '';

    for (let i = 1; i < s.length && result.length < 4; i++) {
        const code = codes[s[i]] || '';
        if (code && code !== prevCode) {
            result += code;
        }
        prevCode = code || prevCode;
    }

    return result.padEnd(4, '0');
}

// ==========================================
// LEVENSHTEIN DISTANCE
// ==========================================
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

// ==========================================
// N-GRAM SIMILARITY
// ==========================================
function getNGrams(str: string, n: number): Set<string> {
    const s = str.toLowerCase().replace(/\s+/g, '');
    const grams = new Set<string>();
    for (let i = 0; i <= s.length - n; i++) {
        grams.add(s.substring(i, i + n));
    }
    return grams;
}

function ngramSimilarity(a: string, b: string, n: number = 2): number {
    const gramsA = getNGrams(a, n);
    const gramsB = getNGrams(b, n);
    if (gramsA.size === 0 || gramsB.size === 0) return 0;

    let intersection = 0;
    gramsA.forEach(g => { if (gramsB.has(g)) intersection++; });

    return (2 * intersection) / (gramsA.size + gramsB.size);
}

// ==========================================
// COMPREHENSIVE PRODUCT MATCHING
// ==========================================
function matchProduct(spoken: string, products: Product[]): { product: Product | null; confidence: number } {
    if (!spoken || spoken.length < 2) return { product: null, confidence: 0 };

    const spokenClean = spoken.toLowerCase().trim();
    const spokenSoundex = soundex(spokenClean);

    let bestMatch: Product | null = null;
    let bestScore = 0;

    for (const product of products) {
        const productName = product.name.toLowerCase();
        const productSoundex = soundex(productName);

        // Strategy 1: Exact contains
        if (productName.includes(spokenClean) || spokenClean.includes(productName.split(' ')[0])) {
            const score = 0.95;
            if (score > bestScore) { bestScore = score; bestMatch = product; }
            continue;
        }

        // Strategy 2: First word match
        const productFirstWord = productName.split(/\s+/)[0];
        const spokenFirstWord = spokenClean.split(/\s+/)[0];
        if (productFirstWord === spokenFirstWord ||
            productFirstWord.startsWith(spokenFirstWord) ||
            spokenFirstWord.startsWith(productFirstWord)) {
            const score = 0.85;
            if (score > bestScore) { bestScore = score; bestMatch = product; }
            continue;
        }

        // Strategy 3: Soundex match (phonetic)
        if (spokenSoundex === productSoundex) {
            const score = 0.80;
            if (score > bestScore) { bestScore = score; bestMatch = product; }
            continue;
        }

        // Strategy 4: N-gram similarity
        const ngramScore = ngramSimilarity(spokenClean, productName, 2);
        if (ngramScore > 0.4) {
            const score = ngramScore * 0.9;
            if (score > bestScore) { bestScore = score; bestMatch = product; }
            continue;
        }

        // Strategy 5: Levenshtein on first significant word
        const productWords = productName.split(/\s+/).filter(w => w.length > 2);
        const spokenWords = spokenClean.split(/\s+/).filter(w => w.length > 2);

        for (const sw of spokenWords) {
            for (const pw of productWords) {
                const distance = levenshtein(sw, pw);
                const maxLen = Math.max(sw.length, pw.length);
                const similarity = 1 - (distance / maxLen);

                if (similarity > 0.6) {
                    const score = similarity * 0.75;
                    if (score > bestScore) { bestScore = score; bestMatch = product; }
                }
            }
        }

        // Strategy 6: Partial word matching (for badly transcribed words like "panchiatici" -> "panch")
        for (const pw of productWords) {
            if (spokenClean.includes(pw.substring(0, 4)) && pw.length >= 4) {
                const score = 0.70;
                if (score > bestScore) { bestScore = score; bestMatch = product; }
            }
            // Check if spoken contains beginning of product word
            if (pw.length >= 5) {
                const prefix = pw.substring(0, Math.floor(pw.length * 0.6));
                if (spokenClean.includes(prefix)) {
                    const score = 0.75;
                    if (score > bestScore) { bestScore = score; bestMatch = product; }
                }
            }
        }
    }

    console.log(`[Match] "${spoken}" → "${bestMatch?.name || 'NONE'}" (${(bestScore * 100).toFixed(0)}%)`);
    return { product: bestMatch, confidence: bestScore };
}

// ==========================================
// PARSE VOICE TRANSCRIPT
// ==========================================
function isQuantityWord(word: string): boolean {
    const w = word.toLowerCase().replace(/[.,!?]/g, '');
    return wordToNumber[w] !== undefined || /^\d+$/.test(w);
}

function getQuantity(word: string): number {
    const w = word.toLowerCase().replace(/[.,!?]/g, '');
    if (/^\d+$/.test(w)) return parseInt(w, 10);
    return wordToNumber[w] || 1;
}

export function parseVoiceTranscript(transcript: string): { productName: string; quantity: number } {
    let text = transcript.toLowerCase().trim().replace(/[.,!?]/g, '');
    text = text.replace(/^(add|please add|give me|i want|get)\s+/i, '');

    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return { productName: '', quantity: 1 };

    let quantity = 1;
    let productWords: string[] = [];

    // Check first word for quantity
    if (words.length > 0 && isQuantityWord(words[0])) {
        quantity = getQuantity(words[0]);
        productWords = words.slice(1);
    }
    // Check last word for quantity
    else if (words.length > 1 && isQuantityWord(words[words.length - 1])) {
        quantity = getQuantity(words[words.length - 1]);
        productWords = words.slice(0, -1);
    }
    else {
        productWords = words;
    }

    // Remove stop words but keep product-relevant words
    productWords = productWords.filter(w => !stopWords.has(w));

    let productName = productWords.join(' ');

    // Apply known phrase mappings (fixes "punctuation" -> "panch tulsi")
    Object.keys(knownPhraseMappings).forEach(key => {
        if (productName.includes(key)) {
            productName = productName.replace(key, knownPhraseMappings[key]);
        }
    });

    console.log(`[Parse] "${transcript}" → Product: "${productName}", Qty: ${quantity}`);

    return { productName, quantity: Math.max(1, Math.min(100, quantity)) };
}

// ==========================================
// MAIN PROCESSING FUNCTION
// ==========================================
export function processVoiceInput(transcript: string, products: Product[]): ParsedVoiceItem[] {
    console.log(`\n========== PROCESSING VOICE INPUT ==========`);
    console.log(`Full transcript: "${transcript}"`);

    // Split by separators (and, aur, comma) OR by "add" keyword
    let segments: string[] = [];

    // First try splitting by "add"
    const addSplits = transcript.toLowerCase().split(/\s*add\s+/i).filter(s => s.trim());

    if (addSplits.length > 1) {
        segments = addSplits;
    } else {
        // Try splitting by and/aur/comma
        segments = transcript
            .split(/[,]|\s+and\s+|\s+aur\s+|\s+then\s+/gi)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    // If no splits worked, use the whole transcript as one segment
    if (segments.length === 0) {
        segments = [transcript];
    }

    console.log(`Segments: ${JSON.stringify(segments)}`);

    const results: ParsedVoiceItem[] = [];

    for (const segment of segments) {
        const { productName, quantity } = parseVoiceTranscript(segment);

        if (productName && productName.length >= 2) {
            const { product, confidence } = matchProduct(productName, products);

            results.push({
                productName,
                quantity,
                matchedProduct: product || undefined,
                confidence,
            });

            if (product) {
                console.log(`✅ MATCHED: "${productName}" → "${product.name}" ×${quantity} (${(confidence * 100).toFixed(0)}%)`);
            } else {
                console.log(`❌ NO MATCH: "${productName}"`);
            }
        }
    }

    console.log(`========== END PROCESSING ==========\n`);
    return results;
}

// Export for use elsewhere
export { matchProduct as findMatchingProduct };
