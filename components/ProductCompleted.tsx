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

                // Calculate completion date (latest handover date)
                let latestDate = new Date(bill.date).getTime();
                let completionDateStr = bill.date;
                bill.items.forEach(item => {
                    if (item.handoverLog) {
                        item.handoverLog.forEach(log => {
                            const logTime = new Date(log.date).getTime();
                            if (logTime > latestDate) {
                                latestDate = logTime;
                                completionDateStr = log.date;
                            }
                        });
                    }
                });

                // Format the completion date
                const formatCompletionDate = (dateString: string) => {
                    const d = new Date(dateString);
                    // Standardizing the output format
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                };

                const formattedCompletionDate = formatCompletionDate(completionDateStr);

                return (
                    <div
                        key={bill.id}
                        onClick={() => setSelectedBillId(bill.id)}
                        className="group bg-white hover:bg-gray-50 transition-all cursor-pointer mb-3 md:mb-0 rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-gray-100 md:border-none"
                    >
                        {/* Mobile View Card */}
                        <div className="md:hidden p-4 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className="pr-2">
                                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight">{bill.customerName}</h3>
                                    <p className="text-xs text-gray-500 font-medium mt-1.5 flex items-center gap-1.5">
                                        <span>##{bill.id}</span>
                                        <span>•</span>
                                        <span className="inline-flex items-center gap-1 bg-[#00d084]/10 text-[#00d084] px-1.5 py-0.5 rounded font-bold">
                                            ✔ {formattedCompletionDate}
                                        </span>
                                    </p>
                                </div>
                                <div className="text-right shrink-0 mt-0.5">
                                    <span className="inline-flex flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-[#5abc8b] text-[11px] font-bold border border-green-100/50">
                                        <CheckCircle2 size={11} strokeWidth={2.5} />
                                        Completed
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[13px] font-semibold">
                                    <span className="text-gray-500 font-medium">Progress</span>
                                    <span>
                                        <span className="text-[#00d084]">100%</span> <span className="text-gray-400 font-medium">({totalQty}/{totalQty})</span>
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-[#00d084] rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `100%` }}
                                    />
                                </div>
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
                                    <div className="w-10 h-10 rounded-full bg-green-50 text-[#5abc8b] flex items-center justify-center font-bold text-sm shrink-0">
                                        {bill.customerName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm truncate">{bill.customerName}</h4>
                                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                                            <span>Bill #{bill.id}</span>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1 bg-[#00d084]/10 text-[#00d084] px-1.5 py-0.5 rounded font-bold">
                                                Completed: {formattedCompletionDate}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="col-span-4 pr-8">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-green-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 w-full" />
                                    </div>
                                    <span className="text-xs font-bold text-[#5abc8b] whitespace-nowrap">100% Done</span>
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
            {
                selectedBill && (
                    <ProductHandoverModal
                        bill={selectedBill}
                        onClose={() => setSelectedBillId(null)}
                        onUpdate={() => { }}
                    />
                )
            }
        </div >
    );
};

export default ProductCompleted;
