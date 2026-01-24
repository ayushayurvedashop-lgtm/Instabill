import React, { useState } from 'react';
import { Bill } from '../types';
import { ChevronRight, CheckCircle2, Package, History } from 'lucide-react';
import ProductHandoverModal from './ProductHandoverModal'; // Reuse modal for viewing history

interface ProductCompletedProps {
    bills: Bill[];
    searchTerm: string;
}

const ProductCompleted: React.FC<ProductCompletedProps> = ({ bills, searchTerm }) => {
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

    const selectedBill = selectedBillId ? bills.find(b => b.id === selectedBillId) : null;

    if (bills.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-fade-in">
                <CheckCircle2 size={48} className="mb-4 text-green-300" />
                <p className="text-lg font-medium">No completed deliveries yet</p>
                <p className="text-sm">Completed orders will appear here</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-4">
            {bills.map((bill) => {
                const totalQty = bill.items.reduce((sum, item) => sum + item.quantity, 0);

                return (
                    <div
                        key={bill.id}
                        onClick={() => setSelectedBillId(bill.id)}
                        className="group bg-white hover:bg-gray-50 transition-colors cursor-pointer border-b md:border-b-0 md:rounded-none"
                    >
                        {/* Mobile View Card */}
                        <div className="md:hidden p-4 space-y-3 relative overflow-hidden">
                            {/* Green strip */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />

                            <div className="flex justify-between items-start pl-2">
                                <div>
                                    <h3 className="font-bold text-gray-900">{bill.customerName}</h3>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">#{bill.id} • {bill.date}</p>
                                </div>
                                <div className="text-right">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                        <CheckCircle2 size={12} strokeWidth={2.5} />
                                        Completed
                                    </span>
                                </div>
                            </div>

                            <div className="pl-2 text-xs text-gray-500">
                                All <b>{totalQty}</b> items delivered
                            </div>
                        </div>

                        {/* Desktop Table Row */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                            {/* Checkbox Col */}
                            <div className="col-span-1 text-center" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300" />
                            </div>

                            {/* Client Details */}
                            <div className="col-span-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        {bill.customerName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm truncate">{bill.customerName}</h4>
                                        <p className="text-xs text-gray-500 font-medium">Bill #{bill.id} • {bill.date}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="col-span-4 pr-8">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-green-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 w-full" />
                                    </div>
                                    <span className="text-xs font-bold text-green-700 whitespace-nowrap">100% Done</span>
                                </div>
                                <div className="mt-1 text-[10px] text-gray-400">
                                    All {totalQty} items delivered successfully
                                </div>
                            </div>

                            {/* Action */}
                            <div className="col-span-3 text-right">
                                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl transition-all text-xs font-bold shadow-sm">
                                    <History size={14} /> View History
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Handover Modal (View Only Mode mostly, but logic is same) */}
            {selectedBill && (
                <ProductHandoverModal
                    bill={selectedBill}
                    onClose={() => setSelectedBillId(null)}
                    onUpdate={() => { }}
                />
            )}
        </div>
    );
};

export default ProductCompleted;
