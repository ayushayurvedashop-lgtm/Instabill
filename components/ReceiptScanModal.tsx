import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';

import { DetectedProduct, Product } from '../types';
import { store } from '../store';

interface ReceiptScanModalProps {
    onClose: () => void;
    products: Product[];
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({ onClose, products }) => {
    const [step, setStep] = useState<'select' | 'processing' | 'review'>('select');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [detectedProducts, setDetectedProducts] = useState<DetectedProduct[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Fuzzy match product names
    const findMatchingProduct = (detectedName: string): Product | undefined => {
        const lowerName = detectedName.toLowerCase();

        // Try exact match first
        let match = products.find(p => p.name.toLowerCase() === lowerName);
        if (match) return match;

        // Try partial match
        match = products.find(p =>
            p.name.toLowerCase().includes(lowerName) ||
            lowerName.includes(p.name.toLowerCase())
        );
        if (match) return match;

        // Try word-by-word match
        const words = lowerName.split(/\s+/);
        match = products.find(p => {
            const productWords = p.name.toLowerCase().split(/\s+/);
            return words.some(w => productWords.some(pw => pw.includes(w) || w.includes(pw)));
        });

        return match;
    };

    const handleImageSelect = async (file: File) => {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Process image
        setStep('processing');
        setIsProcessing(true);
        setError(null);

        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            const productNames = products.map(p => p.name);
            // const detected = await analyzeReceipt(base64, productNames);
            const detected: any[] = [];
            throw new Error("AI Service Removed");

            if (detected.length === 0) {
                setError('No products detected in the receipt. Please try another image.');
                setStep('select');
                setIsProcessing(false);
                return;
            }

            // Match detected products with inventory
            const matchedProducts: DetectedProduct[] = detected.map(d => {
                let match: Product | undefined;

                // 1. Try AI-suggested match first
                if (d.matchedInventoryName) {
                    match = products.find(p => p.name === d.matchedInventoryName);
                }

                // 2. Fallback to local fuzzy match if AI didn't provide a valid match
                if (!match) {
                    match = findMatchingProduct(d.name);
                }

                return {
                    name: d.name,
                    quantity: d.quantity,
                    matchedProductId: match?.id,
                    matchedProduct: match
                };
            });

            setDetectedProducts(matchedProducts);

            // Auto-select matched products
            const autoSelected = new Set<number>();
            matchedProducts.forEach((p, idx) => {
                if (p.matchedProduct) {
                    autoSelected.add(idx);
                }
            });
            setSelectedItems(autoSelected);

            setStep('review');
        } catch (err: any) {
            setError(err.message || 'Failed to analyze receipt');
            setStep('select');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGalleryClick = () => {
        fileInputRef.current?.click();
    };

    const handleCameraClick = () => {
        cameraInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageSelect(file);
    };

    const toggleSelection = (index: number) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedItems(newSelected);
    };

    const handleQuantityChange = (index: number, newQuantity: number) => {
        const updated = [...detectedProducts];
        updated[index].quantity = Math.max(0, newQuantity);
        setDetectedProducts(updated);
    };

    const handleApplyUpdates = async () => {
        setIsProcessing(true);
        try {
            const updates = Array.from(selectedItems)
                .map(idx => detectedProducts[idx])
                .filter(p => p.matchedProduct);

            for (const item of updates) {
                if (item.matchedProduct) {
                    // Fetch latest state from store to ensure we're adding to the current stock
                    // (item.matchedProduct might be slightly stale if store updated in background)
                    const currentProduct = store.getProducts().find(p => p.id === item.matchedProduct!.id);

                    if (currentProduct) {
                        await store.updateProduct({
                            ...currentProduct,
                            stock: currentProduct.stock + item.quantity
                        });
                    }
                }
            }

            onClose();
        } catch (err) {
            setError('Failed to update stock');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRetry = () => {
        setStep('select');
        setImagePreview(null);
        setDetectedProducts([]);
        setSelectedItems(new Set());
        setError(null);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-modal-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-dark">Scan Receipt</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {step === 'select' && 'Upload or capture a receipt to update stock'}
                            {step === 'processing' && 'Analyzing receipt...'}
                            {step === 'review' && 'Review and confirm stock updates'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Select Image Source */}
                    {step === 'select' && (
                        <div className="space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-red-900 text-sm">Error</p>
                                        <p className="text-red-700 text-sm">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Camera Option */}
                                <button
                                    onClick={handleCameraClick}
                                    className="bg-gradient-to-br from-primary to-primary-hover p-8 rounded-2xl hover:shadow-xl transition-all group"
                                >
                                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Camera size={32} className="text-dark" />
                                    </div>
                                    <h3 className="font-bold text-dark text-lg mb-2">Take Photo</h3>
                                    <p className="text-dark/70 text-sm">Use your camera to capture receipt</p>
                                </button>

                                {/* Gallery Option */}
                                <button
                                    onClick={handleGalleryClick}
                                    className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 rounded-2xl hover:shadow-xl transition-all group border-2 border-gray-300"
                                >
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Upload size={32} className="text-dark" />
                                    </div>
                                    <h3 className="font-bold text-dark text-lg mb-2">Upload Image</h3>
                                    <p className="text-gray-600 text-sm">Choose from your gallery</p>
                                </button>
                            </div>

                            {/* Hidden file inputs */}
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {imagePreview && (
                                <div className="mt-6">
                                    <p className="text-sm font-bold text-gray-700 mb-2">Preview:</p>
                                    <img
                                        src={imagePreview}
                                        alt="Receipt preview"
                                        className="w-full max-h-64 object-contain rounded-xl border border-gray-200"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Processing */}
                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                                <Loader2 size={40} className="text-primary animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold text-dark mb-2">Analyzing Receipt</h3>
                            <p className="text-gray-500 text-center max-w-md">
                                Our AI is scanning the receipt and extracting product information...
                            </p>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-blue-900 text-sm">Review Detected Products</p>
                                    <p className="text-blue-700 text-sm">
                                        {detectedProducts.filter(p => p.matchedProduct).length} of {detectedProducts.length} products matched.
                                        Select items to update stock.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {detectedProducts.map((item, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-xl border-2 transition-all ${selectedItems.has(index)
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-200 bg-white'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Checkbox */}
                                            <button
                                                onClick={() => toggleSelection(index)}
                                                disabled={!item.matchedProduct}
                                                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${selectedItems.has(index)
                                                    ? 'bg-primary border-primary'
                                                    : 'border-gray-300 hover:border-primary'
                                                    } ${!item.matchedProduct && 'opacity-50 cursor-not-allowed'}`}
                                            >
                                                {selectedItems.has(index) && <Check size={16} className="text-dark" />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                {/* Product Info */}
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-dark text-sm">{item.name}</p>
                                                        {item.matchedProduct ? (
                                                            <p className="text-xs text-green-600 font-medium">
                                                                ✓ Matched: {item.matchedProduct.name}
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs text-orange-600 font-medium">
                                                                ⚠ Not found in inventory
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Quantity Input */}
                                                    {item.matchedProduct && (
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-xs text-gray-500 font-bold">Qty:</label>
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                                                className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                                min="0"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Current Stock Info */}
                                                {item.matchedProduct && (
                                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                                        <span>Current: <strong>{item.matchedProduct.stock}</strong></span>
                                                        <span>→</span>
                                                        <span className="text-primary font-bold">
                                                            New: {item.matchedProduct.stock + item.quantity}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 flex gap-3 shrink-0">
                    {step === 'review' && (
                        <>
                            <button
                                onClick={handleRetry}
                                className="flex-1 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={18} /> Scan Another
                            </button>
                            <button
                                onClick={handleApplyUpdates}
                                disabled={selectedItems.size === 0 || isProcessing}
                                className="flex-1 py-3 rounded-xl font-bold bg-primary text-dark hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" /> Updating...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} /> Update Stock ({selectedItems.size})
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
