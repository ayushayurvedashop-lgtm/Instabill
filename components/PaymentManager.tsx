import React, { useState, useEffect } from 'react';
import { Bill, PaymentMethod } from '../types';
import { store } from '../store';
import { X, CheckCircle2, DollarSign, CreditCard, Save, AlertCircle } from 'lucide-react';

interface PaymentManagerProps {
    bill: Bill;
    onClose: () => void;
    onUpdate: () => void;
}

const PaymentManager: React.FC<PaymentManagerProps> = ({ bill, onClose, onUpdate }) => {
    const [isPaid, setIsPaid] = useState<boolean>(bill.isPaid);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(bill.paymentMethod || PaymentMethod.CASH);

    // Split Amounts
    const [cashAmount, setCashAmount] = useState<number>(bill.cashAmount || 0);
    const [onlineAmount, setOnlineAmount] = useState<number>(bill.onlineAmount || 0);

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial Sync
    useEffect(() => {
        if (bill.isPaid) {
            // If already paid, rely on stored values
            // If stored values are missing (legacy data), infer from method
            if ((bill.cashAmount === undefined && bill.onlineAmount === undefined)) {
                if (bill.paymentMethod === PaymentMethod.CASH) {
                    setCashAmount(bill.totalAmount);
                    setOnlineAmount(0);
                } else if (bill.paymentMethod === PaymentMethod.ONLINE) {
                    setCashAmount(0);
                    setOnlineAmount(bill.totalAmount);
                } else {
                    // Credit/Other - Default to zero or mixed? Let's assume cash for safety or 0
                    setCashAmount(bill.totalAmount);
                }
            }
        } else {
            // If unpaid, default to 0
            setCashAmount(0);
            setOnlineAmount(0);
        }
    }, [bill]);

    // Auto-calculate split when one changes? 
    // Let's simple validation instead of auto-magic which can be annoying.

    const handleSave = async () => {
        setError(null);
        setIsSubmitting(true);

        try {
            let finalMethod = paymentMethod;
            let finalCash = 0;
            let finalOnline = 0;

            if (isPaid) {
                finalCash = Number(cashAmount);
                finalOnline = Number(onlineAmount);
                const totalEntered = finalCash + finalOnline;

                // Validation: Precision tolerance
                if (Math.abs(totalEntered - bill.totalAmount) > 1) {
                    throw new Error(`Total payment (₹${totalEntered}) must match Bill Amount (₹${bill.totalAmount})`);
                }

                // Determine Method String based on split
                if (finalCash > 0 && finalOnline > 0) {
                    // Hybrid - we don't have a specific enum for "Split", 
                    // maybe we should add one or just pick the dominant one?
                    // Or keep the user selected one.
                    // Let's stick to user prompt, but typically this is "Split" or just "Cash/Online".
                    // For now, we trust the dropdown if it was manual, OR we infer.
                    // If we strictly follow types, PaymentMethod is CASH/ONLINE/CREDIT.
                    // Let's assume if split, we might default to Online or keep as is.
                }
            }

            await store.updateBill({
                ...bill,
                isPaid,
                paymentMethod: finalMethod,
                cashAmount: finalCash,
                onlineAmount: finalOnline
            });

            onUpdate();
            onClose();

        } catch (err: any) {
            setError(err.message || "Failed to update payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const setFullCash = () => {
        setCashAmount(bill.totalAmount);
        setOnlineAmount(0);
        setPaymentMethod(PaymentMethod.CASH);
        setIsPaid(true);
    };

    const setFullOnline = () => {
        setCashAmount(0);
        setOnlineAmount(bill.totalAmount);
        setPaymentMethod(PaymentMethod.ONLINE);
        setIsPaid(true);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Manage Payment</h2>
                        <p className="text-xs text-gray-500 font-medium">Bill #{bill.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Toggle */}
                    <div className="flex bg-gray-100 rounded-xl p-1 relative">
                        <div className={`absolute inset-y-1 w-1/2 bg-white rounded-lg shadow-sm transition-all duration-200 ease-out ${isPaid ? 'translate-x-full left-auto right-1' : 'left-1'}`} />
                        <button
                            onClick={() => setIsPaid(false)}
                            className={`flex-1 py-3 text-sm font-bold relative z-10 transition-colors ${!isPaid ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Unpaid
                        </button>
                        <button
                            onClick={() => setIsPaid(true)}
                            className={`flex-1 py-3 text-sm font-bold relative z-10 transition-colors ${isPaid ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Paid
                        </button>
                    </div>

                    {/* Amount Split Inputs (Only if Paid) */}
                    {isPaid && (
                        <div className="space-y-4 animate-slide-down">
                            <div className="flex gap-2 mb-2">
                                <button onClick={setFullCash} className="flex-1 py-2 bg-success/10 text-emerald-700 border border-success/20 rounded-lg text-xs font-bold hover:bg-success/20 transition-colors">
                                    Full Cash
                                </button>
                                <button onClick={setFullOnline} className="flex-1 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                                    Full Online
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Cash Amount</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-success" size={16} />
                                        <input
                                            type="number"
                                            value={cashAmount}
                                            onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-success/20 focus:border-success outline-none font-bold text-gray-900"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Online Amount</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                        <input
                                            type="number"
                                            value={onlineAmount}
                                            onChange={(e) => setOnlineAmount(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-gray-900"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Summary / Validation Display */}
                            <div className={`p-3 rounded-lg text-xs font-medium flex justify-between items-center ${(cashAmount + onlineAmount) === bill.totalAmount
                                ? 'bg-green-50 text-green-700 border border-green-100'
                                : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                <span>Total Entered: ₹{cashAmount + onlineAmount}</span>
                                <span>Bill Total: ₹{bill.totalAmount}</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <span className="animate-pulse">Saving...</span> : (
                            <>
                                <Save size={18} /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentManager;
