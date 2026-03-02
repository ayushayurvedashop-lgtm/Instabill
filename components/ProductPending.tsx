import React, { useState } from 'react';
import { Bill, ProductStatus } from '../types';
import { ChevronRight, Clock, CheckCircle2, Package, User } from 'lucide-react';
import ProductHandoverModal from './ProductHandoverModal';
import { store } from '../store';

interface ProductPendingProps {
    bills: Bill[];
    searchTerm: string;
}

const ProductPending: React.FC<ProductPendingProps> = ({ bills, searchTerm }) => {
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

    // Derive the active bill from the latest bills prop to ensure data is fresh
    const selectedBill = selectedBillId ? bills.find(b => b.id === selectedBillId) : null;

    // Calculate Progress for a bill
    const getProgress = (bill: Bill) => {
        let totalQty = 0;
        let pendingQty = 0;

        bill.items.forEach(item => {
            totalQty += item.quantity;
            if (item.status === ProductStatus.PENDING) {
                pendingQty += (item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity);
            }
        });

        const completedQty = totalQty - pendingQty;
        const percentage = totalQty > 0 ? (completedQty / totalQty) * 100 : 0;

        return { totalQty, pendingQty, completedQty, percentage };
    };

    if (bills.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-fade-in">
                <Package size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-medium">No pending deliveries found</p>
                <p className="text-sm">All products have been delivered!</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-4">
            {bills.map((bill) => {
                const { totalQty, pendingQty, completedQty, percentage } = getProgress(bill);

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
                                    <p className="text-xs text-gray-500 font-medium mt-1.5">##{bill.id} • {bill.date}</p>
                                </div>
                                <div className="text-right shrink-0 mt-0.5">
                                    <span className="inline-flex flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-500 text-[11px] font-bold border border-orange-100/50">
                                        <Clock size={11} strokeWidth={2.5} />
                                        {pendingQty} Pending
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar (Mobile) */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[13px] font-semibold">
                                    <span className="text-gray-500 font-medium">Progress</span>
                                    <span>
                                        <span className="text-[#00d084]">{Math.round(percentage)}%</span> <span className="text-gray-400 font-medium">({completedQty}/{totalQty})</span>
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${percentage}%` }}
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
                                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        {bill.customerName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm truncate">{bill.customerName}</h4>
                                        <p className="text-xs text-gray-500 font-medium">Bill #{bill.id} • {bill.date}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Progress */}
                            <div className="col-span-4 pr-8">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-medium text-gray-500">
                                        <span>Delivery Progress</span>
                                        <span className="font-bold text-gray-900">{Math.round(percentage)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full shadow-sm transition-all duration-1000 ease-out"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {completedQty} delivered, <span className="text-orange-600 font-bold">{pendingQty} pending</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="col-span-3 text-right">
                                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 text-gray-600 rounded-xl transition-all text-xs font-bold shadow-sm group-hover:shadow-md">
                                    Manage Delivery
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Handover Modal */}
            {
                selectedBill && (
                    <ProductHandoverModal
                        bill={selectedBill}
                        onClose={() => setSelectedBillId(null)}
                        onUpdate={() => {
                            // Store updates propagate automatically via bills prop
                        }}
                    />
                )
            }
        </div >
    );
};

export default ProductPending;
