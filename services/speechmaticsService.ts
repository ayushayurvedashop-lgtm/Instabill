
import { Product } from '../types';
import { functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const SPEECHMATICS_URL = 'wss://eu2.rt.speechmatics.com/v2';

export class SpeechmaticsService {
    private socket: WebSocket | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sessionStarted = false;

    constructor() { }

    /**
     * COMPREHENSIVE PHONETIC DICTIONARY GENERATOR
     * 
     * Strategy for 99% accuracy:
     * 1. Break each product name into individual words
     * 2. Auto-generate phonetic hints for EVERY word (not just keywords)
     * 3. Add size/flavor disambiguation hints
     * 4. Include spaced-out word variations for compound words
     */
    private generateCustomDictionary(products: Product[]) {
        const customDictionary: Array<{ content: string, sounds_like?: string[] }> = [];

        // === MASTER PHONETIC DATABASE ===
        // This covers ALL possible words that appear in product names
        const masterPhonetics: Record<string, string[]> = {
            // --- DOC SERIES (Most Common) ---
            'IMMUNODOC': ['immuno doc', 'immune o doc', 'immuno dock', 'immyuno doc', 'imuno doc'],
            'DENTODOC': ['dento doc', 'dental doc', 'dent o doc', 'denta doc', 'den toe doc'],
            'DIABODOC': ['diabo doc', 'diabeto doc', 'diab o doc', 'dia bo doc', 'diya bo doc'],
            'LIVERDOC': ['liver doc', 'liver dock', 'livardoc', 'liva doc'],
            'KIDGYDOC': ['kidgy doc', 'kidney doc', 'kiddy doc', 'kid gy doc', 'kid gee doc'],
            'KIDGDOC': ['kidg doc', 'kidney doc', 'kid g doc', 'kidgee doc'],
            'ORTHODOC': ['ortho doc', 'ortho dock', 'arthro doc', 'ortho dox'],
            'GYNECODOC': ['gyneco doc', 'gynae doc', 'gyna doc', 'gynaeco doc', 'gine co doc'],
            'GYNEDOC': ['gyne doc', 'gynae doc', 'gyni doc', 'gine doc'],
            'SPIRADOC': ['spira doc', 'spirulina doc', 'spiro doc', 'speera doc'],
            'CURCIDOC': ['curci doc', 'curcumin doc', 'turmeric doc', 'curcy doc', 'kursi doc'],
            'VITADOC': ['vita doc', 'vitamin doc', 'veet a doc'],
            'OMEGADOC': ['omega doc', 'omega dock', 'o mega doc'],
            'NONIDOC': ['noni doc', 'nonee doc', 'nony doc'],
            'BERRYDOC': ['berry doc', 'berri doc', 'bare ee doc'],
            'SEABUCKDOC': ['sea buck doc', 'seabuck doc', 'see buck doc'],
            'MORIDOC': ['mori doc', 'moree doc', 'moringa doc'],
            'STEVIADOC': ['stevia doc', 'steevi a doc'],
            'HEIGHTDOC': ['height doc', 'hight doc', 'hi doc'],
            'MASSDOC': ['mass doc', 'mus doc'],
            'FITDOC': ['fit doc', 'feet doc'],
            'DIGIDOC': ['digi doc', 'digee doc', 'digital doc'],
            'SLIMDOC': ['slim doc', 'sleem doc'],
            'HAIRDOC': ['hair doc', 'hare doc', 'her doc'],
            'PROTEINDOC': ['protein doc', 'protean doc'],
            'PRODOC': ['pro doc', 'proh doc'],
            'ADIDOC': ['adi doc', 'aadi doc', 'adee doc'],
            'ALRGYDOC': ['allergy doc', 'alrgy doc', 'alergy doc'],
            'EYEDOC': ['eye doc', 'i doc', 'aai doc'],
            'BRAINDOC': ['brain doc', 'brane doc'],
            'LIVODOC': ['livo doc', 'leevo doc', 'liver doc'],
            'THYDOC': ['thy doc', 'thyroid doc', 'thi doc'],
            'CARDIODOC': ['cardio doc', 'cardee o doc', 'heart doc'],
            'PILODOC': ['pilo doc', 'pile o doc', 'peelo doc'],
            'CHLORODOC': ['chloro doc', 'kloro doc', 'chlorophyll doc'],
            'STONDOC': ['ston doc', 'stone doc', 'stoan doc'],
            'OBEODOC': ['obeo doc', 'obesity doc', 'obee o doc'],
            'FEVODOC': ['fevo doc', 'fever doc', 'feevo doc'],
            'COUGHDOC': ['cough doc', 'kof doc', 'kauf doc'],
            'VIRALDOC': ['viral doc', 'virus doc', 'vayral doc'],
            'GASDOC': ['gas doc', 'gus doc'],
            'KABZDOC': ['kabz doc', 'constipation doc', 'kubz doc'],
            'HIIMODOC': ['hiimo doc', 'hemo doc', 'himo doc'],
            'ASTHMDOC': ['asthm doc', 'asthma doc', 'asthum doc'],
            'METAADOC': ['metaa doc', 'meta doc', 'metaholic doc'],
            'RAAKTDOC': ['raaktdoc', 'blood doc', 'rakt doc', 'rakta doc'],
            'VETDOC': ['vet doc', 'veterinary doc'],
            'HEALDOC': ['heal doc', 'heel doc', 'health doc'],
            'FENNELDOC': ['fennel doc', 'fenel doc'],

            // --- AYURVEDIC HERBS ---
            'PANCHTULSI': ['panch tulsi', 'punch tulsi', 'pancha tulasi', 'panchh tulsi', '5 tulsi', 'five tulsi'],
            'PANCH': ['panch', 'punch', 'paanch', 'five'],
            'TULSI': ['tulsi', 'tulasi', 'thulsi', 'toolsi', 'holy basil'],
            'ASHWAGANDHA': ['ashwagandha', 'ashwa gandha', 'ashwaganda', 'aswaganda', 'ashwgandha'],
            'CHYAWANPRASH': ['chyawanprash', 'chawan prash', 'chyavanprash', 'chawanprash', 'chya van prash'],
            'TRIPHALA': ['triphala', 'triphla', 'tri phala', 'trifala', '3 fruits'],
            'BRAHMI': ['brahmi', 'brahme', 'brahmee', 'bra mi'],
            'SHILAJIT': ['shilajit', 'shila jit', 'shilajeet', 'sheela jeet', 'shaila jit'],
            'GILOY': ['giloy', 'giloye', 'giloi', 'geeloy', 'giloe'],
            'NEEM': ['neem', 'nim', 'neam', 'neem tree'],
            'AMLA': ['amla', 'amlaa', 'amala', 'aamla', 'indian gooseberry'],
            'ARJUN': ['arjun', 'arjuna', 'arjunaa'],
            'MORINGA': ['moringa', 'moringaa', 'morenga', 'drumstick'],
            'PUNARNAVA': ['punarnava', 'punar nava', 'punerna va'],
            'GINSENG': ['ginseng', 'jinseng', 'gin seng'],
            'FENUGREEK': ['fenugreek', 'methi', 'venugrek'],
            'ALOEVERA': ['aloevera', 'aloe vera', 'alo vera', 'elovera'],
            'TURMERIC': ['turmeric', 'haldi', 'termeric'],
            'SHATAVARI': ['shatavari', 'shata vari', 'shatawari', 'shatavri'],

            // --- PRODUCT FORMS ---
            'TABLET': ['tablet', 'tab', 'tabs', 'tablett', 'tablets'],
            'CAPSULE': ['capsule', 'cap', 'caps', 'capsul', 'capsules'],
            'POWDER': ['powder', 'poweder', 'pawder', 'pauder'],
            'SYRUP': ['syrup', 'sirup', 'serup'],
            'OIL': ['oil', 'oyl', 'oill', 'tel'],
            'CREAM': ['cream', 'creme', 'creem', 'creem'],
            'DROP': ['drop', 'dropp', 'drops'],
            'RAS': ['ras', 'raas', 'rass', 'juice'],
            'KWATH': ['kwath', 'kadha', 'quath', 'kvath', 'decoction'],
            'JUICE': ['juice', 'joos', 'jews'],
            'OINT': ['oint', 'ointment', 'oyntment'],
            'GEL': ['gel', 'jel'],
            'SERUM': ['serum', 'cerum', 'serom'],
            'LOTION': ['lotion', 'loshen', 'loshun'],
            'SHAMPOO': ['shampoo', 'shampu', 'shampuu', 'shampew'],
            'CONDITIONER': ['conditioner', 'condishner', 'conditoner'],
            'GRANULES': ['granules', 'granuls', 'granyules'],
            'SUSPENSION': ['suspension', 'suspenshan'],

            // --- BRANDS ---
            'ASCLEPIUS': ['asclepius', 'asclipius', 'esclepius', 'asclepios', 'asklipius'],
            'SNISS': ['sniss', 'snis', 'swiss', 'snees'],
            'SHIITAKE': ['shiitake', 'shitake', 'shiitaki', 'sheetake', 'she taki'],
            'WELLROOT': ['wellroot', 'well root', 'wellrut'],
            'EXE': ['exe', 'exee', 'exi', 'e x e'],
            'BATHVEDA': ['bathveda', 'bath veda', 'baathveda'],
            'TOSHINE': ['toshine', 'to shine', 'too shine'],
            'LIMFRESH': ['limfresh', 'lim fresh', 'lime fresh'],
            'JEEVEDA': ['jeeveda', 'jeev veda', 'jiveda'],
            'WAKECHA': ['wakecha', 'wake cha', 'wakesha'],
            'THUNDERBLAST': ['thunderblast', 'thunder blast'],
            'TESTOFAST': ['testofast', 'testo fast'],

            // --- COSMETICS ---
            'FACE': ['face', 'fays', 'fais'],
            'WASH': ['wash', 'vash'],
            'SCRUB': ['scrub', 'skrub'],
            'MOISTURISING': ['moisturising', 'moisturizing', 'moisturizer'],
            'SUNSCREEN': ['sunscreen', 'sun screen', 'sunscren'],
            'HERBAL': ['herbal', 'herbel', 'harbal'],
            'CHARCOAL': ['charcoal', 'charcol'],
            'VITAMIN': ['vitamin', 'vit', 'vitamen'],
            'HYALURONIC': ['hyaluronic', 'hyaluronik', 'high luronic'],
            'NIACINAMIDE': ['niacinamide', 'niasina mide'],
            'SALICYLIC': ['salicylic', 'salisilik'],
            'KOJIC': ['kojic', 'kojik'],
            'COLLAGEN': ['collagen', 'colagen'],
            'PEPTIDE': ['peptide', 'peptid'],

            // --- SIZES (Critical for disambiguation) ---
            'ML': ['ml', 'milliliter', 'emm ell'],
            'G': ['g', 'grams', 'gram'],
            '25ML': ['25 ml', 'twenty five ml'],
            '50ML': ['50 ml', 'fifty ml'],
            '100ML': ['100 ml', 'hundred ml'],
            '200ML': ['200 ml', 'two hundred ml'],
            '500ML': ['500 ml', 'five hundred ml'],
            '1000ML': ['1000 ml', 'thousand ml', 'one liter'],
            '25G': ['25 g', 'twenty five grams'],
            '50G': ['50 g', 'fifty grams'],
            '100G': ['100 g', 'hundred grams'],
            '200G': ['200 g', 'two hundred grams'],
            '500G': ['500 g', 'five hundred grams'],

            // --- FLAVORS (SLIMDOC disambiguation) ---
            'CHOCOLATE': ['chocolate', 'choclat', 'choklet'],
            'MANGO': ['mango', 'mangoo', 'maango'],
            'STRAWBERRY': ['strawberry', 'stawberry', 'straw berry'],
            'BANANA': ['banana', 'bananna', 'bananaa'],
            'LEMON': ['lemon', 'lemun', 'nimbu'],
            'LIME': ['lime', 'lyme'],
            'ORANGE': ['orange', 'oranj'],
            'CUCUMBER': ['cucumber', 'cucumbar', 'kheera'],
            'SAFFRON': ['saffron', 'safron', 'kesar'],

            // --- COMMON QUALIFIERS ---
            'EXTRACT': ['extract', 'extrac'],
            'RICH': ['rich', 'ritch'],
            'REAL': ['real', 'reel'],
            'JUICY': ['juicy', 'joosi'],
            'CREAMY': ['creamy', 'creemi'],
            'NATURAL': ['natural', 'nachural'],
            'PURE': ['pure', 'pyur'],
            'FRESH': ['fresh', 'frash'],
            'GOLD': ['gold', 'goald'],
            '24K': ['24 k', '24 karat', 'twenty four k'],

            // --- BODY PARTS ---
            'HAIR': ['hair', 'hare', 'her', 'baal'],
            'SKIN': ['skin', 'sken'],
            'EYE': ['eye', 'i', 'aai', 'aankh'],
            'BODY': ['body', 'bodi'],
            'LIP': ['lip', 'leeps'],
            'NAIL': ['nail', 'nayl'],

            // --- NUMBERS ---
            '30': ['30', 'thirty'],
            '60': ['60', 'sixty'],
            '100': ['100', 'hundred'],
            '200': ['200', 'two hundred'],
            '250': ['250', 'two fifty'],
            '500': ['500', 'five hundred'],
            '1000': ['1000', 'thousand'],
        };

        // 1. Billing phrases
        customDictionary.push({ content: 'make a bill' });
        customDictionary.push({ content: 'add' });
        customDictionary.push({ content: 'bill' });
        customDictionary.push({ content: 'with' });
        customDictionary.push({ content: 'and' });

        // 2. Numbers with PHONETIC HINTS to prevent mistranscription
        // Common issues: "two" -> "to", "four" -> "for", "one" -> "won", etc.
        const numberPhonetics: Array<{ content: string, sounds_like?: string[] }> = [
            { content: 'one', sounds_like: ['won', 'wan', '1'] },
            { content: 'two', sounds_like: ['to', 'too', 'tu', '2'] },
            { content: 'three', sounds_like: ['tree', 'free', '3'] },
            { content: 'four', sounds_like: ['for', 'fore', '4'] },
            { content: 'five', sounds_like: ['fiv', '5'] },
            { content: 'six', sounds_like: ['siks', '6'] },
            { content: 'seven', sounds_like: ['seva', '7'] },
            { content: 'eight', sounds_like: ['ate', 'ait', '8'] },
            { content: 'nine', sounds_like: ['nain', '9'] },
            { content: 'ten', sounds_like: ['tan', '10'] },
            { content: 'eleven', sounds_like: ['11'] },
            { content: 'twelve', sounds_like: ['12'] },
            { content: 'thirteen', sounds_like: ['13'] },
            { content: 'fourteen', sounds_like: ['14'] },
            { content: 'fifteen', sounds_like: ['15'] },
            { content: 'sixteen', sounds_like: ['16'] },
            { content: 'seventeen', sounds_like: ['17'] },
            { content: 'eighteen', sounds_like: ['18'] },
            { content: 'nineteen', sounds_like: ['19'] },
            { content: 'twenty', sounds_like: ['20', 'tweny'] },
            { content: 'twenty one', sounds_like: ['21'] },
            { content: 'twenty two', sounds_like: ['22'] },
            { content: 'twenty three', sounds_like: ['23'] },
            { content: 'twenty four', sounds_like: ['24'] },
            { content: 'twenty five', sounds_like: ['25'] },
            { content: 'thirty', sounds_like: ['30', 'thirdy'] },
            { content: 'forty', sounds_like: ['40', 'fourty'] },
            { content: 'fifty', sounds_like: ['50', 'fifti'] },
            { content: 'sixty', sounds_like: ['60', 'siksti'] },
            { content: 'seventy', sounds_like: ['70'] },
            { content: 'eighty', sounds_like: ['80', 'aity'] },
            { content: 'ninety', sounds_like: ['90', 'nainty'] },
            { content: 'hundred', sounds_like: ['100', 'hundrad'] },
        ];
        numberPhonetics.forEach(num => customDictionary.push(num));

        // 3. Process each product with COMPREHENSIVE phonetic hints
        products.forEach(p => {
            if (!p.name) return;

            const productName = p.name;
            const upperName = productName.toUpperCase();
            const allHints: string[] = [];

            // Extract ALL words from product name
            const words = upperName.replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 1);

            // Generate hints for each word
            words.forEach(word => {
                // Check master phonetics
                if (masterPhonetics[word]) {
                    allHints.push(...masterPhonetics[word]);
                }

                // Also check if it's a compound word containing a known key
                for (const [key, hints] of Object.entries(masterPhonetics)) {
                    if (word.includes(key) && word !== key) {
                        // Product like "PANCHTULSI" where we add "panch tulsi" 
                        allHints.push(...hints);
                    }
                }
            });

            // Add spaced-out version of the full name (helps recognition)
            const spacedName = productName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2');
            if (spacedName !== productName.toLowerCase()) {
                allHints.push(spacedName);
            }

            // Add simplified version without size
            const withoutSize = productName.replace(/\([^)]*\)/g, '').trim().toLowerCase();
            if (withoutSize !== productName.toLowerCase() && withoutSize.length > 3) {
                allHints.push(withoutSize);
            }

            // Dedupe and add
            const uniqueHints = [...new Set(allHints)].slice(0, 10); // Limit to 10 hints per product

            if (uniqueHints.length > 0) {
                customDictionary.push({ content: productName, sounds_like: uniqueHints });
            } else {
                customDictionary.push({ content: productName });
            }
        });

        console.log(`🎤 Custom dictionary size: ${customDictionary.length} entries`);
        console.log(`📚 Master phonetics database: ${Object.keys(masterPhonetics).length} terms`);
        return customDictionary;
    }

    private finalTranscript = '';
    private currentPartial = '';

    async startRecording(
        products: Product[],
        onTranscript: (text: string, isFinal: boolean) => void,
        onStatusChange: (status: 'connecting' | 'listening' | 'processing' | 'stopped' | 'error') => void,
        onError: (error: any) => void
    ) {
        try {
            this.finalTranscript = '';
            this.currentPartial = '';
            onStatusChange('connecting');

            // 1. Get Microphone Access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 2. Setup Audio Context for correct sampling rate if needed, 
            // but MediaRecorder is usually sufficient. 
            // Speechmatics expects raw PCM or specific formats. 
            // Let's use standard MediaRecorder with a compatible mimeType if browser supports, 
            // or we might need to send raw float32/int16 data.
            // Easiest path for direct WS is often sending raw PCM.

            // We will use AudioContext to get raw PCM data script processor (deprecated but widespread) 
            // or AudioWorklet (better but more setup). 
            // For simplicity in this environment, let's try a Blob approach if Speechmatics supports it wrapped,
            // but their RT API usually wants raw audio.

            // Let's use AudioContext to extract PCM data.
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // processor buffer size 4096
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(this.audioContext.destination);

            // 3. Connect WebSocket
            const jwt = await this.getJwtOrApiKey();
            console.log('Got Speechmatics token:', jwt ? 'YES' : 'NO', jwt?.substring(0, 20) + '...');

            // Speechmatics RT API v2 requires the jwt in the query string
            this.socket = new WebSocket(`${SPEECHMATICS_URL}?jwt=${jwt}`);

            this.socket.onopen = () => {
                console.log('Speechmatics WebSocket Connected');
                this.sessionStarted = false;

                // Configure Session
                const configMessage = {
                    message: 'StartRecognition',
                    audio_format: {
                        type: 'raw',
                        encoding: 'pcm_f32le', // AudioContext default is float 32 little endian
                        sample_rate: this.audioContext?.sampleRate || 44100
                    },
                    transcription_config: {
                        language: 'en', // Or 'hi' if Hindi is needed, defaults to 'en'
                        operating_point: 'enhanced',
                        enable_partials: true,
                        max_delay: 2,
                        additional_vocab: this.generateCustomDictionary(products)
                    }
                };

                this.socket?.send(JSON.stringify(configMessage));
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.message === 'RecognitionStarted') {
                    this.sessionStarted = true;
                    onStatusChange('listening');
                    console.log('Speechmatics Recognition Started');
                } else if (data.message === 'AddTranscript') {
                    // FINAL transcript segment - accumulate it
                    const transcript = data.metadata?.transcript || '';
                    if (transcript && transcript.trim()) {
                        const trimmedSegment = transcript.trim();

                        // DEDUPLICATION: Check if this segment is already at the end of finalTranscript
                        // This prevents the last item from being repeated
                        const currentFinal = this.finalTranscript.trim();
                        if (!currentFinal.endsWith(trimmedSegment)) {
                            this.finalTranscript += (this.finalTranscript ? ' ' : '') + trimmedSegment;
                            console.log('✅ Added final segment:', trimmedSegment);
                        } else {
                            console.log('⚠️ Skipped duplicate segment:', trimmedSegment);
                        }

                        this.currentPartial = '';
                        onTranscript(this.finalTranscript, true);
                    }
                } else if (data.message === 'AddPartialTranscript') {
                    // PARTIAL (in-progress) - show but don't accumulate
                    const partial = data.metadata?.transcript || '';
                    this.currentPartial = partial;
                    // Show final + current partial
                    const display = this.finalTranscript + (partial ? ' ' + partial : '');
                    onTranscript(display.trim(), false);
                } else if (data.message === 'EndOfTranscript') {
                    console.log('End of transcript received, final:', this.finalTranscript);
                    onStatusChange('processing');
                } else if (data.message === 'Error') {
                    console.error('Speechmatics Error:', JSON.stringify(data, null, 2));
                    console.error('Error type:', data.type, '| Reason:', data.reason);
                    onError(data);
                }
            };

            this.socket.onerror = (event) => {
                console.error('WebSocket Error:', event);
                onError(event);
            };

            this.socket.onclose = () => {
                console.log('Speechmatics WebSocket Closed');
                onStatusChange('stopped');
            };

            // 4. Send Audio Data
            processor.onaudioprocess = (e) => {
                if (this.socket?.readyState === WebSocket.OPEN && this.sessionStarted) {
                    const inputData = e.inputBuffer.getChannelData(0); // Float32Array
                    // Send raw float32 bytes
                    this.socket.send(inputData.buffer);
                }
            };

        } catch (error) {
            console.error('Failed to start recording:', error);
            onError(error);
            onStatusChange('error');
        }
    }

    stopRecording() {
        if (this.socket) {
            // Send EndOfStream message
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: 0 }));
            }
            setTimeout(() => {
                this.socket?.close();
                this.socket = null;
            }, 500);
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.sessionStarted = false;
    }

    // Helper to handle Auth. 
    // IMPORTANT: For Browser usage, you normally generate a specific JWT from your backend to avoid exposing the permanent API Key.
    // For this prototype, we will use the API Key as the JWT payload if the service accepts it, or generate a temporary token.
    // The documentation says: "Generate a JWT" 
    // Since we don't have a backend generate endpoint ready, we might be stuck if we can't use the API key directly.
    // HOWEVER, many services allow "Authorization: Bearer <API_KEY>" for raw requests, but for WS it's tricky.
    // Wait, the user provided an "API Key". 
    // Let's update this to assume the user wants to use a basic Bearer flow if possible, 
    // Check docs: https://docs.speechmatics.com/get-started/authentication
    // "You can use your API key to authenticate requests to the Batch and Real-time APIs."
    // For WebSocket: `Authorization: Bearer YOUR_API_KEY` header.
    // Browsers WebSocket API does NOT allow custom headers.
    // Solution: Speechmatics allows passing the token as a query parameter `jwt` or `auth_token` ? 
    // Actually, usually they support `?jwt=<token>`.
    // If we can't generate a JWT, we might have issues.
    // BUT the API Key itself acts as a token in many systems. 
    // Let's try using the API Key as the token first.


    private async getJwtOrApiKey(): Promise<string> {
        const apiKey = import.meta.env.VITE_SPEECHMATICS_API_KEY || "";
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname.includes('192.168');

        try {
            if (isLocalhost) {
                // LOCAL DEVELOPMENT: Use Vite proxy to bypass CORS
                console.log('Fetching Speechmatics temporary token via Vite proxy...');
                const response = await fetch('/speechmatics-auth', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ttl: 3600
                    })
                });

                console.log('Token fetch response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Token fetch failed:', errorText);
                    throw new Error(`Auth Failed: ${response.statusText}`);
                }

                const data = await response.json();
                const token = data.key_value;
                if (!token) throw new Error('Token not found in response');

                console.log('Got Speechmatics token: YES');
                return token;
            } else {
                // PRODUCTION: Use Firebase Cloud Function
                console.log('Fetching Speechmatics temporary token via Cloud Function...');
                const getSpeechmaticsToken = httpsCallable(functions, 'getSpeechmaticsToken');
                const result = await getSpeechmaticsToken();
                const data = result.data as { token?: string };

                console.log('Token fetch result:', data ? 'Success' : 'Empty');

                if (!data?.token) {
                    console.error('No token in response:', result);
                    throw new Error('Token not found in response');
                }

                console.log('Got Speechmatics token: YES');
                return data.token;
            }
        } catch (e) {
            console.error("Failed to get Speechmatics Token", e);
            throw e;
        }
    }
}

export const speechmaticsService = new SpeechmaticsService();
