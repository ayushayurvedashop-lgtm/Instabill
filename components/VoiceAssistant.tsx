
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, X, CheckCircle } from 'lucide-react';
import { speechmaticsService } from '../services/speechmaticsService';
import { geminiService } from '../services/geminiService';
import MorphPanel from './ui/ai-input';
import { store } from '../store';
import { Product, BillItem, ProductStatus } from '../types';
import { findMatchingProduct } from '../services/voiceParsingService';

/**
 * Levenshtein Distance Algorithm
 * Calculates the minimum number of single-character edits needed to change one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                );
            }
        }
    }

    return dp[m][n];
}

interface VoiceAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onAddItems: (items: BillItem[]) => void;
    trigger?: React.ReactNode;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, onClose, onAddItems, trigger }) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'processing' | 'success' | 'error'>('idle');
    const [transcript, setTranscript] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-listen only if opened via default method OR if manually triggered start
    useEffect(() => {
        // If trigger is provided, we don't auto-start on mount usually, logic is handled by local state in MorphPanel + onStart
        // But if isOpen is passed as true from Parent, we might want to start.
        // However, with the new UI pattern, the 'onStart' provided to MorphPanel handles opening.

        // Cleanup on unmount
        return () => stopListening();
    }, []);

    // ... existing auto-stop effect ...

    // ... existing start/stop/process functions ...


    // Auto-stop on silence (2 seconds)
    useEffect(() => {
        if (status === 'listening') {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (transcript.length > 2) { // Only stop if we have some text
                    handleStopAndProcess();
                }
            }, 2000); // 2 seconds silence
        }
    }, [transcript, status]);

    const startListening = async () => {
        setTranscript('');
        setErrorMsg('');
        setStatus('connecting');
        const products = store.getProducts();

        try {
            await speechmaticsService.startRecording(
                products,
                (text, isFinal) => {
                    // Simply replace the display text - service handles accumulation
                    setTranscript(text);
                },
                (newStatus) => {
                    if (newStatus === 'stopped' && status !== 'success' && status !== 'processing') {
                        // Determine if we should close or show error
                    }
                    if (newStatus === 'listening') setStatus('listening');
                },
                (error) => {
                    console.error("Speechmatics Error", error);
                    setErrorMsg("Failed to connect to voice service.");
                    setStatus('error');
                }
            );
        } catch (e) {
            console.error(e);
            setErrorMsg("Could not access microphone.");
            setStatus('error');
        }
    };

    const stopListening = () => {
        speechmaticsService.stopRecording();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    const handleStopAndProcess = async () => {
        if (status === 'processing') return; // Already processing
        stopListening();

        if (!transcript.trim()) {
            setStatus('idle');
            return;
        }

        setStatus('processing');

        try {
            const products = store.getProducts();
            // 1. Parse intent with Gemini
            const parsedItems = await geminiService.parseTranscript(transcript, products);

            if (parsedItems.length === 0) {
                setErrorMsg("No products identified.");
                setStatus('error');
                return;
            }

            // 2. Match to actual products
            const billItems: BillItem[] = [];
            const billingType = store.getSettings().defaultBillingMode;

            parsedItems.forEach(item => {
                console.log('🔍 Trying to match:', item.productName, 'qty:', item.quantity);

                // Skip very short or gibberish-looking names (less than 3 chars)
                if (!item.productName || item.productName.length < 3) {
                    console.warn('⚠️ Skipping invalid product name:', item.productName);
                    return;
                }

                // BLOCK GENERIC TERMS
                // Prevent matches if the search term is ONLY a generic pharmaceutical type
                const GENERIC_TERMS = [
                    'tablet', 'capsule', 'syrup', 'oil', 'cream', 'powder', 'drop', 'drops',
                    'ras', 'vati', 'churna', 'kwath', 'extract', 'juice', 'gel', 'soap',
                    'shampoo', 'conditioner', 'lotion', 'wash', 'scrub', 'mask', 'pack',
                    'tea', 'coffee', 'mix', 'shake', 'drink', 'food', 'balm', 'ointment'
                ];

                const lowerName = item.productName.toLowerCase().trim();
                // Check if the name corresponds exactly to a generic term (or plural)
                if (GENERIC_TERMS.includes(lowerName) || GENERIC_TERMS.includes(lowerName.replace(/s$/, ''))) {
                    console.warn('⚠️ Skipping generic term match:', item.productName);
                    return;
                }

                let match: Product | undefined;
                const searchTerm = item.productName.toLowerCase().trim();
                const searchWords = searchTerm.split(/\s+/);

                // === TIER 1: Exact Match ===
                match = products.find(p => p.name.toLowerCase() === searchTerm);
                if (match) {
                    console.log('✅ EXACT match:', match.name);
                }

                // === TIER 2: Product starts with search term ===
                if (!match && searchTerm.length >= 5) {
                    match = products.find(p => p.name.toLowerCase().startsWith(searchTerm));
                    if (match) console.log('✅ STARTS WITH match:', match.name);
                }

                // === TIER 3: Smart Word Overlap Matching ===
                // This handles cases like "immuno doc ras" -> "IMMUNODOC RAS (1000ml)"
                if (!match && searchWords.length >= 1) {
                    let bestScore = 0;
                    let bestCandidate: Product | undefined;

                    products.forEach(p => {
                        const productName = p.name.toLowerCase();
                        const productWords = productName.replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 1);

                        let score = 0;
                        const matchedWords: string[] = [];

                        searchWords.forEach(sw => {
                            // Direct word match
                            if (productWords.some(pw => pw === sw)) {
                                score += 3;
                                matchedWords.push(sw);
                            }
                            // Partial word match (e.g., "immuno" in "immunodoc")
                            else if (productWords.some(pw => pw.includes(sw) && sw.length >= 4)) {
                                score += 2;
                                matchedWords.push(sw);
                            }
                            // Product contains the search word
                            else if (productName.includes(sw) && sw.length >= 4) {
                                score += 1;
                                matchedWords.push(sw);
                            }
                        });

                        // Bonus for matching first/main word (the DOC name)
                        if (searchWords[0] && productName.includes(searchWords[0])) {
                            score += 2;
                        }

                        // Normalize by search length to prefer matches that cover more search terms
                        const normalizedScore = score / searchWords.length;

                        if (normalizedScore > bestScore && matchedWords.length >= Math.min(2, searchWords.length)) {
                            bestScore = normalizedScore;
                            bestCandidate = p;
                        }
                    });

                    if (bestCandidate && bestScore >= 2) {
                        match = bestCandidate;
                        console.log('✅ WORD OVERLAP match:', match.name, `(score: ${bestScore.toFixed(2)})`);
                    }
                }

                // === TIER 4: Levenshtein Distance (High Threshold) ===
                if (!match && searchTerm.length >= 6) {
                    let bestDistance = Infinity;
                    let bestCandidate: Product | undefined;

                    products.forEach(p => {
                        // Compare against product name without size
                        const productBase = p.name.replace(/\([^)]*\)/g, '').trim().toLowerCase();
                        const distance = levenshteinDistance(searchTerm, productBase);
                        const maxLen = Math.max(searchTerm.length, productBase.length);
                        const similarity = 1 - (distance / maxLen);

                        if (similarity > 0.7 && distance < bestDistance) { // 70% similarity threshold
                            bestDistance = distance;
                            bestCandidate = p;
                        }
                    });

                    if (bestCandidate) {
                        match = bestCandidate;
                        console.log('✅ LEVENSHTEIN match:', match.name, `(distance: ${bestDistance})`);
                    }
                }

                if (match) {
                    console.log('🎉 Final match:', item.productName, '=>', match.name);
                    billItems.push({
                        ...match,
                        quantity: item.quantity,
                        status: ProductStatus.PENDING,
                        currentPrice: billingType === 'MRP' ? match.mrp : match.dp,
                        totalSp: match.sp * item.quantity
                    });
                } else {
                    console.warn('❌ No match found for:', item.productName);
                }
            });

            if (billItems.length > 0) {
                onAddItems(billItems);
                setStatus('success');
                setTimeout(onClose, 1500); // Close after success
            } else {
                setErrorMsg("Couldn't match any products.");
                setStatus('error');
            }

        } catch (e) {
            console.error(e);
            setErrorMsg("Error processing request.");
            setStatus('error');
        }
    };

    // We don't use the isOpen prop anymore as the component is always mounted (floating orb)
    // But we keep the signature compatible for now, or we can update App.tsx later.
    // Actually, we'll ignore isOpen from props and manage local open state.
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const handleStart = () => {
        setIsPanelOpen(true);
        startListening();
    };

    const handleStop = () => {
        handleStopAndProcess();
        // Don't close immediately, let the user see the result or "Processing"
        // The success handling logic in handleStopAndProcess closes it after a delay
    };

    // Override the onClose passed from parent (which just sets parent state)
    // to distinct locally closing the panel vs parent unmounting it.
    const handleClose = () => {
        stopListening();
        setIsPanelOpen(false);
        onClose(); // Notify parent if needed, though with floating UI it might stay mounted
    };

    // Update internal state when status changes
    useEffect(() => {
        if (status === 'listening' || status === 'processing') {
            setIsPanelOpen(true);
        }
    }, [status]);

    return (
        <MorphPanel
            isOpen={isPanelOpen}
            transcript={transcript}
            status={status}
            onStart={handleStart}
            onStop={handleStop}
            onClose={handleClose}
            trigger={trigger}
        />
    );
};

export default VoiceAssistant;
