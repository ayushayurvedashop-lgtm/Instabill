import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Printer, Download, Edit2, Trash2, Check, AlertCircle, ChevronDown, MessageSquare, Loader, Copy } from 'lucide-react';
import { Bill, BillItem, ProductStatus, PaymentMethod } from '../types';
import { InvoiceModal, InvoiceModalHandle } from './InvoiceModal';
import { store } from '../store';

interface BillReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    bill: Bill;
    onUpdateBill: (updates: Partial<Bill>) => void;
    onUpdateItem: (itemId: string, updates: Partial<BillItem>) => void;
    onRemoveItem: (itemId: string) => void;
    onConfirmBill: (sendWhatsApp: boolean) => void;
    onSaveDraft: () => void;
    onDeleteBill: () => void;
}

export const BillReviewModal: React.FC<BillReviewModalProps> = ({
    isOpen,
    onClose,
    bill,
    onUpdateBill,
    onUpdateItem,
    onRemoveItem,
    onConfirmBill,
    onSaveDraft,
    onDeleteBill,
}) => {
    const [sendWhatsApp, setSendWhatsApp] = useState(bill.sendWhatsapp !== false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [printMode, setPrintMode] = useState<'single' | 'double'>('single');
    const hiddenPrintRef = useRef<InvoiceModalHandle>(null);

    // Print using the hidden InvoiceModal's method
    const handlePrint = useCallback(() => {
        hiddenPrintRef.current?.handlePrint();
    }, []);

    // Download using the hidden InvoiceModal's method
    const handleDownload = useCallback(async () => {
        setIsDownloading(true);
        try {
            await hiddenPrintRef.current?.handleDownload();
        } finally {
            setIsDownloading(false);
        }
    }, []);

    if (!isOpen || !bill) return null;

    const totalPaid = (bill.cashAmount || 0) + (bill.onlineAmount || 0);
    const balanceDue = Math.max(0, bill.totalAmount - totalPaid);
    const totalItems = bill.items.reduce((sum, item) => sum + item.quantity, 0);

    const handleQuantityChange = (itemId: string, delta: number) => {
        const item = bill.items.find(i => i.id === itemId);
        if (!item) return;
        const newQty = item.quantity + delta;
        if (newQty < 1) {
            onRemoveItem(itemId);
            return;
        }
        onUpdateItem(itemId, {
            quantity: newQty,
            totalSp: parseFloat((newQty * item.sp).toFixed(2))
        });
    };

    const handleStatusToggle = (itemId: string) => {
        const item = bill.items.find(i => i.id === itemId);
        if (!item) return;
        const newStatus = item.status === ProductStatus.GIVEN ? ProductStatus.PENDING : ProductStatus.GIVEN;
        onUpdateItem(itemId, {
            status: newStatus,
            pendingQuantity: newStatus === ProductStatus.PENDING ? item.quantity : 0
        });
    };

    const handlePendingQtyChange = (itemId: string, value: string) => {
        const item = bill.items.find(i => i.id === itemId);
        if (!item) return;
        let qty = value === '' ? 0 : parseInt(value);
        if (isNaN(qty)) qty = 0;
        if (qty > item.quantity) qty = item.quantity;
        if (qty < 0) qty = 0;
        onUpdateItem(itemId, {
            pendingQuantity: qty,
            status: qty > 0 ? ProductStatus.PENDING : ProductStatus.GIVEN
        });
    };

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirmBill(sendWhatsApp);
        } finally {
            setIsConfirming(false);
        }
    };

    const handleSetCashAmount = (val: number) => {
        const cashVal = isNaN(val) ? 0 : val;
        const remaining = Math.max(0, bill.totalAmount - cashVal);
        onUpdateBill({
            cashAmount: cashVal,
            onlineAmount: remaining,
            paymentMethod: cashVal > 0 ? PaymentMethod.CASH : PaymentMethod.ONLINE
        });
    };

    const handleSetOnlineAmount = (val: number) => {
        const onlineVal = isNaN(val) ? 0 : val;
        const remaining = Math.max(0, bill.totalAmount - onlineVal);
        onUpdateBill({
            onlineAmount: onlineVal,
            cashAmount: remaining,
            paymentMethod: onlineVal > 0 && remaining === 0 ? PaymentMethod.ONLINE : PaymentMethod.CASH
        });
    };

    // Compute the correct bill number:
    // - If the bill already has a '#' prefix, it's an existing saved bill — use its ID
    // - Otherwise it's a new bill — compute the next bill number from the store
    const isExistingBill = bill.id.startsWith('#');
    const previewBillId = isExistingBill ? bill.id : (() => {
        const allBills = store.getBills();
        const maxId = allBills.reduce((max, b) => {
            if (b.id.startsWith('#')) {
                const match = b.id.match(/(\d+)/);
                const num = match ? parseInt(match[0]) : 0;
                return num > max ? num : max;
            }
            return max;
        }, 0);
        return `#${maxId + 1}`;
    })();
    const billNumber = previewBillId.replace('#', '');

    // Create a preview bill with the correct ID for the hidden InvoiceModal
    const previewBill = { ...bill, id: previewBillId };

    // Use portal to render at body level — escapes sidebar stacking context
    const modalContent = (
        <>
            <div className="fixed inset-0 z-[9999] bg-gray-100 flex flex-col overflow-hidden">
                {/* Top Header Bar */}
                <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-black text-gray-900">
                            Review Bill #{billNumber}
                        </h1>
                        <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full uppercase tracking-wider">
                            {bill.customerName}
                        </span>
                        <span className="text-sm text-gray-400 font-medium">• {bill.date}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            <Edit2 size={14} />
                            Edit Items
                        </button>

                        {/* Single/Double Toggle + Download/Print grouped together */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                            {/* Single/Double Toggle */}
                            {bill.items.length <= 14 && (
                                <>
                                    <button
                                        onClick={() => setPrintMode('single')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${printMode === 'single' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Copy size={12} /> Single
                                    </button>
                                    <button
                                        onClick={() => setPrintMode('double')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${printMode === 'double' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                        title="Two copies on one page"
                                    >
                                        <Copy size={12} className="rotate-180" /> Double
                                    </button>
                                    <div className="w-px h-5 bg-gray-300 mx-0.5"></div>
                                </>
                            )}

                            {/* Download Button */}
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
                            >
                                {isDownloading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                                {isDownloading ? 'Downloading...' : 'Download'}
                            </button>

                            {/* Print Button */}
                            <button
                                onClick={handlePrint}
                                className="px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800"
                            >
                                <Printer size={12} />
                                Print
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Bill Details */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Customer</div>
                                <div className="text-lg font-black text-gray-900">{bill.customerName}</div>
                                <div className="text-xs text-gray-400 mt-0.5">ID: {bill.id}</div>
                            </div>
                            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
                                <div className="text-xs text-yellow-600 font-bold uppercase tracking-wider mb-1">Grand Total</div>
                                <div className="text-2xl font-black text-gray-900">₹{bill.totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total SP</div>
                                <div className="text-2xl font-black text-gray-900">{bill.totalSp}</div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Items</div>
                                <div className="text-2xl font-black text-gray-900">{totalItems}</div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Section Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <span className="text-lg">🛒</span>
                                <h2 className="text-lg font-black text-gray-900">Items List</h2>
                            </div>

                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-3 px-6 py-3 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <div className="col-span-1">#</div>
                                <div className="col-span-3">Product Name</div>
                                <div className="col-span-2 text-center">Qty</div>
                                <div className="col-span-1 text-center">Price</div>
                                <div className="col-span-3 text-center">Status</div>
                                <div className="col-span-1 text-right">Total</div>
                                <div className="col-span-1"></div>
                            </div>

                            {/* Table Rows */}
                            <div className="divide-y divide-gray-50">
                                {bill.items.map((item, index) => {
                                    const isPending = item.status === ProductStatus.PENDING;
                                    const pendingQty = item.pendingQuantity || 0;

                                    return (
                                        <div key={item.id} className="grid grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors">
                                            {/* # */}
                                            <div className="col-span-1 text-sm font-medium text-gray-400">
                                                {String(index + 1).padStart(2, '0')}
                                            </div>

                                            {/* Product Name */}
                                            <div className="col-span-3">
                                                <div className="font-bold text-gray-900 text-sm leading-tight">{item.name}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">SKU: {item.id.slice(0, 6).toUpperCase()}</div>
                                            </div>

                                            {/* Qty Controls */}
                                            <div className="col-span-2 flex items-center justify-center">
                                                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 h-8">
                                                    <button
                                                        onClick={() => handleQuantityChange(item.id, -1)}
                                                        className="w-7 h-full flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-l-lg transition-colors text-sm font-bold"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-8 text-center font-bold text-gray-900 text-sm">{item.quantity}</span>
                                                    <button
                                                        onClick={() => handleQuantityChange(item.id, 1)}
                                                        className="w-7 h-full flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-r-lg transition-colors text-sm font-bold"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div className="col-span-1 text-center font-bold text-gray-700 text-sm">
                                                ₹{item.currentPrice.toLocaleString()}
                                            </div>

                                            {/* Status Toggle + Pending Qty */}
                                            <div className="col-span-3 flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleStatusToggle(item.id)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${isPending
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-success/10 text-emerald-700 border border-success/30'
                                                        }`}
                                                >
                                                    {isPending ? 'Pending' : 'Given'}
                                                    <ChevronDown size={10} />
                                                </button>

                                                {/* Pending Quantity Controls: - qty + */}
                                                {isPending && (
                                                    <div className="flex items-center gap-0.5">
                                                        <button
                                                            onClick={() => {
                                                                const newQty = Math.max(0, pendingQty - 1);
                                                                onUpdateItem(item.id, {
                                                                    pendingQuantity: newQty,
                                                                    status: newQty > 0 ? ProductStatus.PENDING : ProductStatus.GIVEN
                                                                });
                                                            }}
                                                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors bg-white border border-gray-200 text-sm font-bold"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={pendingQty}
                                                            onChange={(e) => handlePendingQtyChange(item.id, e.target.value)}
                                                            className="w-9 h-7 text-center text-xs font-bold border border-amber-300 bg-amber-50 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const newQty = Math.min(item.quantity, pendingQty + 1);
                                                                onUpdateItem(item.id, {
                                                                    pendingQuantity: newQty,
                                                                    status: newQty > 0 ? ProductStatus.PENDING : ProductStatus.GIVEN
                                                                });
                                                            }}
                                                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors bg-white border border-gray-200 text-sm font-bold"
                                                        >
                                                            +
                                                        </button>
                                                        <span className="text-[10px] text-gray-400 font-medium ml-0.5">/{item.quantity}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total */}
                                            <div className="col-span-1 text-right font-black text-gray-900 text-sm">
                                                ₹{(item.currentPrice * item.quantity).toLocaleString()}
                                            </div>

                                            {/* Delete */}
                                            <div className="col-span-1 flex justify-end">
                                                <button
                                                    onClick={() => onRemoveItem(item.id)}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer Note */}
                            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                    <AlertCircle size={12} />
                                    Kindly check the products before leaving the counter.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Payment & Actions */}
                    <div className="w-[380px] bg-white border-l border-gray-200 flex flex-col overflow-y-auto shrink-0">
                        <div className="p-6 flex-1 space-y-5">
                            {/* Payment Information Header */}
                            <div className="flex items-center gap-2">
                                <span className="text-lg">💳</span>
                                <h3 className="text-lg font-black text-gray-900">Payment Information</h3>
                            </div>

                            {/* Payment Status Toggle */}
                            <div className="flex items-center justify-between py-3">
                                <span className="text-sm font-bold text-gray-700">Payment Status</span>
                                <div className="flex bg-gray-100 rounded-lg p-0.5">
                                    <button
                                        onClick={() => onUpdateBill({ isPaid: true })}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${bill.isPaid
                                            ? 'bg-success text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        ✓ Paid
                                    </button>
                                    <button
                                        onClick={() => onUpdateBill({ isPaid: false })}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!bill.isPaid
                                            ? 'bg-red-500 text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Unpaid
                                    </button>
                                </div>
                            </div>

                            {/* Cash Amount */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cash Amount</label>
                                    <button
                                        onClick={() => onUpdateBill({ cashAmount: bill.totalAmount, onlineAmount: 0, paymentMethod: PaymentMethod.CASH })}
                                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${(bill.cashAmount || 0) === bill.totalAmount && bill.totalAmount > 0
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-red-50 text-red-500 hover:bg-red-100'
                                            }`}
                                    >
                                        All Cash
                                    </button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={bill.cashAmount === 0 ? '' : bill.cashAmount}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            handleSetCashAmount(val);
                                        }}
                                        className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 transition-all placeholder:text-gray-300"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Online / UPI */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Online / UPI</label>
                                    <button
                                        onClick={() => onUpdateBill({ onlineAmount: bill.totalAmount, cashAmount: 0, paymentMethod: PaymentMethod.ONLINE })}
                                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${(bill.onlineAmount || 0) === bill.totalAmount && bill.totalAmount > 0
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                                            }`}
                                    >
                                        All Online
                                    </button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={bill.onlineAmount === 0 ? '' : bill.onlineAmount}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            handleSetOnlineAmount(val);
                                        }}
                                        className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all placeholder:text-gray-300"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 space-y-2">
                                {bill.discountAmount! > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500 font-medium">Subtotal</span>
                                            <span className="text-sm font-bold text-gray-700">₹{bill.subTotalAmount || bill.totalAmount + bill.discountAmount!}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-yellow-600 font-medium">Discount</span>
                                            <span className="text-sm font-bold text-yellow-600">-₹{bill.discountAmount}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200">
                                    <span className="text-sm font-bold text-gray-900">Total Bill</span>
                                    <span className="text-base font-black text-gray-900">₹{bill.totalAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 font-medium">Total Paid</span>
                                    <span className="text-base font-black text-success-hover">₹{totalPaid.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 font-medium">Balance Due</span>
                                    <span className={`text-base font-black ${balanceDue > 0 ? 'text-red-600' : 'text-success-hover'}`}>
                                        ₹{balanceDue.toFixed(2)}
                                    </span>
                                </div>
                            </div>


                            {/* WhatsApp Toggle */}
                            <div className="flex items-center justify-between py-3 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={18} className="text-success" />
                                    <span className="text-sm font-bold text-gray-700">Send on WhatsApp</span>
                                </div>
                                <button
                                    onClick={() => setSendWhatsApp(!sendWhatsApp)}
                                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out flex items-center px-1 ${sendWhatsApp ? 'bg-success' : 'bg-gray-300'
                                        }`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${sendWhatsApp ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="p-6 border-t border-gray-100 space-y-3 shrink-0">
                            {/* Confirm & Generate */}
                            <button
                                onClick={handleConfirm}
                                disabled={isConfirming || bill.items.length === 0}
                                className="w-full py-3.5 bg-[#ccff00] hover:bg-[#bbe600] disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-black rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                            >
                                {isConfirming ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </span>
                                ) : (
                                    <>
                                        <Check size={18} strokeWidth={3} />
                                        {isExistingBill ? 'Confirm & Update Bill' : 'Confirm & Generate Bill'}
                                    </>
                                )}
                            </button>

                            {/* Edit Items */}
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-blue-50 border border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <Edit2 size={16} />
                                Edit Items
                            </button>

                            {/* Delete Bill */}
                            <button
                                onClick={onDeleteBill}
                                className="w-full py-3 bg-red-50 border border-red-100 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <Trash2 size={16} />
                                Delete Bill
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden InvoiceModal for print/download content rendering */}
            <div style={{ display: 'none' }}>
                <InvoiceModal
                    ref={hiddenPrintRef}
                    bill={previewBill}
                    onClose={() => { }}
                    onEdit={() => { }}
                    externalPrintMode={printMode}
                />
            </div>
        </>
    );

    // Render via portal to document.body — escapes sidebar/content overflow constraints
    return ReactDOM.createPortal(modalContent, document.body);
};
