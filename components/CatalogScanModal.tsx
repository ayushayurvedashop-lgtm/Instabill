import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { store } from '../store';
import { Product } from '../types';

interface CatalogScanModalProps {
    onClose: () => void;
}

export const CatalogScanModal: React.FC<CatalogScanModalProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Mock implementation since Service is removed
                await new Promise(r => setTimeout(r, 500));
                // const { products: fetched } = await fetchCatalogFromAI();
                const fetched: Product[] = [];
                // Assign temporary ids for UI selection
                const withIds = fetched.map((p, idx) => ({ ...p, id: `tmp-${idx}` }));
                setProducts(withIds as Product[]);
            } catch (e) {
                console.error(e);
                setError('Failed to fetch catalog.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const applyChanges = async () => {
        const toApply = products.filter(p => selectedIds.has(p.id as string));
        await store.bulkUpsertProducts(toApply);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6 relative animate-modal-in">
                <button onClick={onClose} className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} />
                </button>
                <h2 className="text-xl font-bold mb-4">Scan Catalog (Gemini AI)</h2>
                {loading && <p className="text-gray-500">Loading catalog...</p>}
                {error && <p className="text-red-600">{error}</p>}
                {!loading && !error && (
                    <>
                        <div className="grid gap-2 max-h-96 overflow-y-auto mb-4">
                            {products.map(p => (
                                <label key={p.id} className="flex items-center space-x-2 p-2 border rounded">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(p.id as string)}
                                        onChange={() => toggleSelect(p.id as string)}
                                        className="form-checkbox h-4 w-4"
                                    />
                                    <span className="font-medium">{p.name}</span>
                                    <span className="ml-auto text-sm text-gray-600">MRP: ₹{p.mrp}</span>
                                    <span className="ml-2 text-sm text-gray-600">DP: ₹{p.dp}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyChanges}
                                disabled={selectedIds.size === 0}
                                className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-light disabled:opacity-50"
                            >
                                Apply Selected ({selectedIds.size})
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
