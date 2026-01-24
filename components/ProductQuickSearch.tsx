import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, CornerDownLeft, Package } from 'lucide-react';
import { Product } from '../types';

interface ProductQuickSearchProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onSelectProduct: (product: Product) => void;
}

export const ProductQuickSearch: React.FC<ProductQuickSearchProps> = ({
    isOpen,
    onClose,
    products,
    onSelectProduct,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedIndex(0);
            // Small timeout to ensure focus works after mount/render
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Filter products
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredProducts([]);
            return;
        }

        const term = searchTerm.toLowerCase();
        const results = products
            .filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.code && p.code.toLowerCase().includes(term))
            )
            .slice(0, 10); // Limit results for performance/view

        setFilteredProducts(results);
        setSelectedIndex(0);
    }, [searchTerm, products]);

    // Scroll active item into view
    useEffect(() => {
        if (listRef.current && filteredProducts.length > 0) {
            const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (activeElement) {
                activeElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, filteredProducts]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredProducts.length > 0) {
                onSelectProduct(filteredProducts[selectedIndex]);
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={onClose}></div>

            <div
                className="w-full max-w-2xl bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#333] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input Header */}
                <div className="flex items-center px-4 py-4 border-b border-[#333]">
                    <Search className="text-gray-400 mr-3" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-gray-100 text-lg placeholder:text-gray-500 focus:outline-none font-medium"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                    />
                    <div className="flex gap-2 text-xs text-gray-500 font-medium">
                        <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-[#333] bg-[#2a2a2a] px-2 font-mono font-medium text-gray-400">
                            ESC
                        </kbd>
                        <span className="hidden sm:inline">to close</span>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto" ref={listRef}>
                    {filteredProducts.length > 0 ? (
                        <div className="py-2">
                            {filteredProducts.map((product, index) => (
                                <div
                                    key={product.id}
                                    onClick={() => {
                                        onSelectProduct(product);
                                        onClose();
                                    }}
                                    className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${index === selectedIndex ? 'bg-[#333]' : 'hover:bg-[#2a2a2a]'
                                        }`}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-2 rounded-lg shrink-0 ${index === selectedIndex ? 'bg-[#444] text-white' : 'bg-[#2a2a2a] text-gray-400'}`}>
                                            <Package size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className={`font-medium truncate ${index === selectedIndex ? 'text-white' : 'text-gray-300'}`}>
                                                {product.name}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                                                {product.code && <span>#{product.code}</span>}
                                                <span>•</span>
                                                <span>Stock: {product.stock}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className={`text-right ${index === selectedIndex ? 'text-white' : 'text-gray-400'}`}>
                                            <div className="font-bold">₹{product.price}</div>
                                        </div>
                                        {index === selectedIndex && (
                                            <div className="text-gray-500">
                                                <CornerDownLeft size={16} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-500">
                            {searchTerm ? (
                                <>
                                    <p className="mb-2">No products found for "{searchTerm}"</p>
                                    <p className="text-xs text-gray-600">Try searching for a different name or code</p>
                                </>
                            ) : (
                                <>
                                    <Command className="mb-4 text-[#333]" size={48} />
                                    <p>Type to search...</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {filteredProducts.length > 0 && (
                    <div className="px-4 py-2 bg-[#252525] border-t border-[#333] flex justify-between items-center text-[10px] text-gray-500">
                        <span>Use <strong className="text-gray-400">↑↓</strong> to navigate</span>
                        <span>Press <strong className="text-gray-400">Enter</strong> to select</span>
                    </div>
                )}
            </div>
        </div>
    );
};
