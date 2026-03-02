import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BillItem } from '../types';

interface ProductStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: BillItem[];
    onUpdate: (updatedItems: BillItem[]) => void;
    billId: string | number;
}

export const ProductStatusModal: React.FC<ProductStatusModalProps> = ({
    isOpen,
    onClose,
    items,
    onUpdate,
    billId,
}) => {
    // Map of itemId -> pendingQuantity
    // If an item is not in this map, it means pendingQty is 0 (Fully Given)
    const [pendingMap, setPendingMap] = useState<Record<string, number>>({});

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            const initialMap: Record<string, number> = {};
            items.forEach(item => {
                // If the item already has a pending status, use it
                // Otherwise default to 0 (Fully Given)
                initialMap[item.id] = item.pendingQuantity || 0;
            });
            setPendingMap(initialMap);
        }
    }, [isOpen, items]);

    const handleToggleStatus = (itemId: string, totalQty: number, status: 'Given' | 'Pending') => {
        setPendingMap(prev => ({
            ...prev,
            // If setting to Pending, default to full quantity being pending
            // If setting to Given, set pending to 0
            [itemId]: status === 'Pending' ? totalQty : 0
        }));
    };

    const handleUpdatePendingQty = (itemId: string, delta: number, totalQty: number) => {
        setPendingMap(prev => {
            const current = prev[itemId] || 0;
            const next = Math.max(0, Math.min(totalQty, current + delta));
            return { ...prev, [itemId]: next };
        });
    };

    const handleManualPendingQtyChange = (itemId: string, val: string, totalQty: number) => {
        setPendingMap(prev => {
            let next = val === '' ? 0 : parseInt(val);
            if (isNaN(next)) next = 0;
            // Clamp
            if (next > totalQty) next = totalQty;
            // Allow typing 0
            return { ...prev, [itemId]: next };
        });
    }

    const handleSave = () => {
        const updatedItems = items.map(item => ({
            ...item,
            // Update the pendingQty field
            pendingQuantity: pendingMap[item.id] || 0,
            // Set status based on pending qty
            status: (pendingMap[item.id] || 0) > 0 ? 'Pending' : 'Given'
        }));

        // We might need to cast to any if status type is strictly defined elsewhere and doesn't match string
        // Assuming BillItem has optional pendingQty and status fields
        onUpdate(updatedItems);
        onClose();
    };

    if (!isOpen) return null;

    // Calculate stats
    const totalItems = items.length;
    const pendingCount = (Object.values(pendingMap) as number[]).filter(q => q > 0).length;

    return (
        <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-yellow-100 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-700"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                            </div>
                            <h2 className="text-2xl font-bold text-dark">Product Delivery Status Manager</h2>
                        </div>
                        <p className="text-gray-500 pl-14">Manage pending deliveries for Current Bill #{billId}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-4">Item Name</div>
                            <div className="col-span-2 text-center">Total Qty</div>
                            <div className="col-span-3 text-center">Status</div>
                            <div className="col-span-2 text-center">Pending Qty</div>
                        </div>

                        {/* List */}
                        <div className="divide-y divide-gray-100">
                            {items.map((item, index) => {
                                const pendingQty = pendingMap[item.id] || 0;
                                const isPending = pendingQty > 0;

                                return (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors">
                                        <div className="col-span-1 text-center font-medium text-gray-400">
                                            {index + 1}
                                        </div>
                                        <div className="col-span-4 font-bold text-gray-800 line-clamp-2">
                                            {item.name}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg font-bold">
                                                {item.quantity}
                                            </span>
                                        </div>

                                        {/* Status Toggle */}
                                        <div className="col-span-3 flex justify-center">
                                            <div className="flex bg-gray-100 p-1 rounded-xl w-full max-w-[200px]">
                                                <button
                                                    onClick={() => handleToggleStatus(item.id, item.quantity, 'Given')}
                                                    className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-bold transition-all ${!isPending
                                                        ? 'bg-white text-emerald-700 shadow-sm'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Given
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(item.id, item.quantity, 'Pending')}
                                                    className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-bold transition-all ${isPending
                                                        ? 'bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Pending
                                                </button>
                                            </div>
                                        </div>

                                        {/* Pending Quantity Controls */}
                                        <div className="col-span-2 flex justify-center">
                                            <div className={`flex items-center gap-1 transition-opacity ${!isPending ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                                <button
                                                    onClick={() => handleUpdatePendingQty(item.id, -1, item.quantity)}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors bg-white border border-gray-200"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="text"
                                                    value={pendingQty}
                                                    onChange={(e) => handleManualPendingQtyChange(item.id, e.target.value, item.quantity)}
                                                    className="w-12 text-center font-bold text-gray-900 bg-transparent focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => handleUpdatePendingQty(item.id, 1, item.quantity)}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors bg-white border border-gray-200"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4 bg-yellow-50 px-4 py-3 rounded-xl border border-yellow-100">
                        <div>
                            <div className="text-xs text-yellow-800 font-bold uppercase tracking-wider mb-0.5">Pending Items</div>
                            <div className="text-2xl font-black text-yellow-900 leading-none">{pendingCount.toString().padStart(2, '0')}</div>
                        </div>
                        <div className="w-px h-8 bg-yellow-200 mx-2"></div>
                        <p className="text-sm text-yellow-700 max-w-xs leading-tight">
                            Review items that will be delivered later to the customer.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-8 py-3 rounded-xl bg-[#ccff00] text-black font-bold hover:bg-[#bbe600] shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            Update Status
                            <Check size={20} className="stroke-[3px]" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
