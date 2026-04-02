import React, { useState, useMemo } from 'react';
import { Bill, ProductStatus, HandoverEvent } from '../types';
import { X, Package, ArrowRight, User, CheckCircle2, History, Truck, Plus, Minus, Trash2, ChevronDown, CheckSquare, Square, Undo2 } from 'lucide-react';
import { store } from '../store';
import { sendProductUpdateWhatsapp } from '../services/smsService';

interface ProductHandoverModalProps {
    bill: Bill;
    onClose: () => void;
    onUpdate: () => void;
}

const ProductHandoverModal: React.FC<ProductHandoverModalProps> = ({ bill, onClose, onUpdate }) => {
    // Selection state
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    // Form State
    const [giveQty, setGiveQty] = useState<number>(0);
    const [givenToName, setGivenToName] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mobile Detail Panel State
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    // Initial load: Select first pending item
    React.useEffect(() => {
        const firstPending = bill.items.find(i => i.status === ProductStatus.PENDING) || bill.items[0];
        if (firstPending) {
            setSelectedItemId(firstPending.id);
            // Don't auto-check it, let user choose to check for bulk
        }
    }, [bill]);

    // Derived State
    const items = bill.items;
    const isBulkMode = checkedItems.size > 0;

    // Single Item Focus
    const activeItem = items.find(i => i.id === selectedItemId);
    const activePendingQty = activeItem
        ? (activeItem.pendingQuantity !== undefined ? activeItem.pendingQuantity : activeItem.quantity)
        : 0;

    // Reset form when active item changes (only in single mode)
    React.useEffect(() => {
        if (!isBulkMode && activeItem) {
            const currentPending = activeItem.pendingQuantity !== undefined ? activeItem.pendingQuantity : activeItem.quantity;
            setGiveQty(currentPending > 0 ? currentPending : 0);
            setGivenToName('');
        }
    }, [selectedItemId, isBulkMode, activeItem]);

    // Checkbox Handler
    const toggleCheck = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent row click
        const newChecked = new Set(checkedItems);
        if (newChecked.has(id)) {
            newChecked.delete(id);
        } else {
            newChecked.add(id);
        }
        setCheckedItems(newChecked);
    };

    const handleItemClick = (id: string) => {
        setSelectedItemId(id);
        setIsMobileDetailOpen(true);
    };

    const handleConfirmHandover = async () => {
        setIsSubmitting(true);
        try {
            // Collect products being given for notification
            const productsBeingGiven: { name: string; qty: number }[] = [];

            if (isBulkMode) {
                const promises = Array.from(checkedItems).map(id => {
                    const item = items.find(i => i.id === id);
                    if (!item) return Promise.resolve();
                    const qty = item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity;
                    if (qty <= 0) return Promise.resolve();
                    productsBeingGiven.push({ name: item.name, qty });
                    return store.recordHandover(bill.id, id, qty, givenToName);
                });

                await Promise.all(promises);
                setCheckedItems(new Set());
                setIsMobileDetailOpen(false); // Close on success
            } else {
                if (!selectedItemId || giveQty <= 0) return;
                const item = items.find(i => i.id === selectedItemId);
                if (item) {
                    productsBeingGiven.push({ name: item.name, qty: giveQty });
                }
                await store.recordHandover(bill.id, selectedItemId, giveQty, givenToName);
                // Maybe keep open or close? User usually wants to do next item.
                // Let's close on mobile to show updated list
                if (window.innerWidth < 768) setIsMobileDetailOpen(false);
            }

            // Send WhatsApp notification
            if (productsBeingGiven.length > 0) {
                console.log('[ProductHandover] Products being given:', productsBeingGiven);

                // Look up customer phone from store
                const customers = store.getCustomers();
                console.log('[ProductHandover] Total customers in store:', customers.length);
                console.log('[ProductHandover] Looking for customer:', bill.customerName);

                const customer = customers.find(c => c.name.toLowerCase() === bill.customerName.toLowerCase());
                console.log('[ProductHandover] Customer found:', customer);
                console.log('[ProductHandover] Bill snapshotUrl:', bill.snapshotUrl);

                // Use snapshotUrl or fallback to public invoice URL
                const billUrl = bill.snapshotUrl || `${window.location.origin}/?billId=${encodeURIComponent(bill.id)}`;
                console.log('[ProductHandover] Using billUrl:', billUrl);

                if (customer && customer.phone) {
                    // Format products list: "ProductA (1), ProductB (2)" matching template format
                    const productsGivenList = productsBeingGiven
                        .map(p => `${p.name} (${p.qty})`)
                        .join(', ');

                    console.log('[ProductHandover] Sending WhatsApp notification...');
                    console.log('[ProductHandover] Phone:', customer.phone);
                    console.log('[ProductHandover] Bill ID:', bill.id);
                    console.log('[ProductHandover] Products List:', productsGivenList);

                    // Send notification (fire and forget, don't block UI)
                    sendProductUpdateWhatsapp(
                        customer.phone,
                        bill.id,
                        productsGivenList,
                        billUrl
                    ).then(success => {
                        if (success) {
                            console.log('[ProductHandover] Product update WhatsApp sent successfully');
                        } else {
                            console.log('[ProductHandover] Product update WhatsApp returned false');
                        }
                    }).catch(err => {
                        console.error('[ProductHandover] Failed to send product update WhatsApp:', err);
                    });
                } else {
                    console.log('[ProductHandover] Missing required data for notification:');
                    console.log('  - Customer found:', !!customer);
                    console.log('  - Customer phone:', customer?.phone);
                }
            } else {
                console.log('[ProductHandover] No products being given, skipping notification');
            }

            onUpdate();
        } catch (error) {
            console.error("Failed to record handover", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevert = async (itemId: string, logIndex: number) => {
        if (confirm("Are you sure you want to undo this delivery?")) {
            await store.revertHandover(bill.id, itemId, logIndex);
            onUpdate();
        }
    };

    // Calculate Global History
    const history = useMemo(() => {
        const events: Array<{ item: typeof items[0], log: HandoverEvent, logIndex: number, dateObj: Date }> = [];
        items.forEach(item => {
            if (item.handoverLog) {
                item.handoverLog.forEach((log, idx) => {
                    events.push({ item, log, logIndex: idx, dateObj: new Date(log.date) });
                });
            }
        });
        return events.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [items]);

    // Bulk Mode Calculations
    const bulkSelectedItems = items.filter(i => checkedItems.has(i.id));
    const bulkTotalUnits = bulkSelectedItems.reduce((sum, item) => {
        const p = item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity;
        return sum + p;
    }, 0);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in font-sans">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh] md:h-[600px] border border-gray-100 relative">

                {/* Left Sidebar: Item List (Always Visible, Full Width on Mobile) */}
                <div className="w-full md:w-[300px] flex flex-col border-r border-gray-100 bg-white h-full relative">
                    <div className="p-5 border-b border-gray-50 flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">Delivery Management</h1>
                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-tight">
                                Bill <span className="font-semibold text-slate-700">#{bill.id}</span> • {bill.customerName}
                            </p>
                        </div>
                        {/* Mobile Close Button for Main Modal */}
                        <button
                            onClick={onClose}
                            className="md:hidden p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50 custom-scrollbar pb-24 md:pb-3">
                        {items.map(item => {
                            const pQty = item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity;
                            const isFullyGiven = pQty === 0;
                            const isChecked = checkedItems.has(item.id);
                            const isSelected = selectedItemId === item.id;
                            const progress = ((item.quantity - pQty) / item.quantity) * 100;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item.id)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden group flex gap-3 ${(isSelected || isChecked)
                                        ? 'bg-white border-2 border-orange-400 shadow-sm'
                                        : 'bg-white border-transparent hover:border-slate-200 shadow-sm'
                                        }`}
                                >
                                    {/* Checkbox */}
                                    {!isFullyGiven && (
                                        <div
                                            onClick={(e) => toggleCheck(item.id, e)}
                                            className="flex-shrink-0 pt-0.5 text-orange-500 cursor-pointer hover:scale-110 transition-transform"
                                        >
                                            {isChecked
                                                ? <CheckSquare size={18} fill="currentColor" className="text-orange-500 text-white" />
                                                : <Square size={18} className="text-slate-300 hover:text-orange-400" />}
                                        </div>
                                    )}
                                    {isFullyGiven && <div className="w-[18px]" />}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-slate-800 uppercase text-[10px] tracking-wide leading-tight truncate pr-2">
                                                {item.name}
                                            </h3>
                                            {isFullyGiven ? (
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-[#5abc8b] bg-green-50 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                                                    <CheckCircle2 size={10} strokeWidth={3} /> Done
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded-full uppercase shadow-sm shadow-orange-200 shrink-0">
                                                    <Package size={10} strokeWidth={2} /> Pending
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                Qty: {item.quantity}
                                            </span>
                                            <div className="h-1 w-16 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${isFullyGiven ? 'bg-green-500' : 'bg-slate-300'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Mobile Bulk Selection Sticky Footer */}
                    {isBulkMode && !isMobileDetailOpen && (
                        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] flex items-center gap-3 z-10 animate-fade-in-up">
                            <button
                                onClick={() => setCheckedItems(new Set())}
                                className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-red-50 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <button
                                onClick={() => setIsMobileDetailOpen(true)}
                                className="flex-1 bg-orange-500 hover:bg-[#e9914b] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                            >
                                Continue ({checkedItems.size})
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Backdrop for Detail Panel */}
                {isMobileDetailOpen && (
                    <div
                        className="md:hidden absolute inset-0 bg-black/20 z-10 backdrop-blur-[1px]"
                        onClick={() => setIsMobileDetailOpen(false)}
                    />
                )}

                {/* Right Content Area (Detail Panel / Bottom Sheet) */}
                <div className={`
                    bg-white 
                    /* Mobile Styles: Fixed Bottom Sheet */
                    absolute md:static 
                    inset-x-0 bottom-0 
                    h-[70vh] md:h-auto 
                    z-20 
                    rounded-t-2xl md:rounded-none 
                    shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] md:shadow-none
                    transition-transform duration-300 ease-out
                    ${isMobileDetailOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
                    flex flex-col flex-1 overflow-hidden
                `}>
                    {/* Desktop Close Button */}
                    <button
                        onClick={onClose}
                        className="hidden md:block absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors z-20 rounded-full hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>

                    {/* Mobile Sheet Handle / Header */}
                    <div className="md:hidden p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3"></div>
                        <span className="font-bold text-slate-700 text-sm pt-2">
                            {isBulkMode ? `Bulk Delivery (${bulkTotalUnits})` : 'Delivery Details'}
                        </span>
                        <button
                            onClick={() => setIsMobileDetailOpen(false)}
                            className="p-1 -mr-1 text-slate-400 hover:text-slate-600 pt-2"
                        >
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">

                        <div className="p-8 border-b border-gray-100 min-h-[350px] flex items-center justify-center">
                            {/* BULK MODE UI */}
                            {isBulkMode ? (
                                <div className="max-w-md mx-auto w-full animate-fade-in-up">
                                    <div className="mb-6 text-center hidden md:block">
                                        <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-600">
                                            <Truck size={24} />
                                        </div>
                                        <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider rounded-full mb-2">
                                            Bulk Delivery
                                        </span>
                                        <h3 className="text-2xl font-bold text-slate-900">Confirm Delivery</h3>
                                        <p className="text-sm text-slate-400 mt-1 font-medium">{checkedItems.size} Items Selected</p>
                                    </div>

                                    {/* Summary Card */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Selected Items Summary</h4>
                                        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                            {bulkSelectedItems.map(item => (
                                                <div key={item.id} className="flex justify-between text-xs">
                                                    <span className="text-slate-700 font-medium truncate pr-4">{item.name}</span>
                                                    <span className="font-bold text-slate-900 shrink-0">Qty: {item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="h-px bg-slate-200 my-3" />
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-700 text-sm">Total Units</span>
                                            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm shadow-orange-200">
                                                {bulkTotalUnits} Units
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Given To (Receiver Name)</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input
                                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                                    placeholder="e.g. Wife, Brother, Self"
                                                    type="text"
                                                    value={givenToName}
                                                    onChange={(e) => setGivenToName(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleConfirmHandover}
                                            disabled={isSubmitting}
                                            className="w-full bg-orange-500 hover:bg-[#e9914b] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 group transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait text-sm"
                                        >
                                            {isSubmitting ? 'Processing...' : `Confirm Bulk Delivery (${bulkTotalUnits} Units)`}
                                            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* SINGLE ITEM MODE UI */
                                activeItem && activePendingQty > 0 ? (
                                    <div className="max-w-md mx-auto w-full animate-fade-in-up">
                                        <div className="mb-8 text-center hidden md:block">
                                            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600">
                                                <Truck size={24} />
                                            </div>
                                            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">New Entry</h2>
                                            <h3 className="text-2xl font-bold text-slate-900">Confirm Delivery</h3>
                                            <p className="text-sm text-slate-400 mt-2 font-medium">{activeItem.name}</p>
                                        </div>

                                        {/* Mobile Title Replacement */}
                                        <div className="md:hidden mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">{activeItem.name}</h3>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Confirm Item Delivery</p>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Quantity Stepper */}
                                            <div>
                                                <div className="flex justify-between items-end mb-3">
                                                    <label className="text-sm font-semibold text-slate-700">Quantity to Give</label>
                                                    <button
                                                        onClick={() => setGiveQty(activePendingQty)}
                                                        className="text-[11px] font-bold text-orange-500 hover:underline uppercase tracking-tight"
                                                    >
                                                        Give All ({activePendingQty})
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => setGiveQty(Math.max(1, giveQty - 1))}
                                                        className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200"
                                                    >
                                                        <Minus size={18} />
                                                    </button>
                                                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl h-12 flex items-center justify-center text-xl font-bold text-slate-900">
                                                        {giveQty}
                                                    </div>
                                                    <button
                                                        onClick={() => setGiveQty(Math.min(activePendingQty, giveQty + 1))}
                                                        className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200"
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Receiver Name */}
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-3">Given To (Receiver Name)</label>
                                                <div className="relative">
                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input
                                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                                        placeholder="e.g. Wife, Brother, Self"
                                                        type="text"
                                                        value={givenToName}
                                                        onChange={(e) => setGivenToName(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Submit Button */}
                                            <button
                                                onClick={handleConfirmHandover}
                                                disabled={isSubmitting}
                                                className="w-full bg-orange-500 hover:bg-[#e9914b] text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 group transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait"
                                            >
                                                {isSubmitting ? 'Saving...' : 'Confirm Delivery'}
                                                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-300">
                                        <Package size={64} className="mx-auto mb-4 opacity-30" />
                                        <p className="font-semibold text-slate-400">
                                            {activeItem && activePendingQty === 0
                                                ? "This item is fully delivered."
                                                : "Select an item to manage delivery"}
                                        </p>
                                    </div>
                                )
                            )}
                        </div>

                        {/* History Section - Only show in Single Mode */}
                        {!isBulkMode && (
                            <div className="p-8 bg-slate-50/50">
                                <div className="max-w-md mx-auto w-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <History size={18} className="text-slate-400" />
                                            Delivery History
                                        </h3>
                                    </div>

                                    <div className="space-y-8 relative">
                                        {history.length > 0 ? history.map((event, idx) => {
                                            const isFirst = idx === 0;
                                            return (
                                                <div key={`${event.item.id}-${event.logIndex}`} className="relative pl-8 border-l-2 border-slate-200 group">
                                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${isFirst ? 'bg-white border-orange-500' : 'bg-slate-200 border-transparent'}`}></div>

                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${isFirst ? 'text-orange-500' : 'text-slate-400'}`}>
                                                                {event.dateObj.toLocaleString()}
                                                            </span>
                                                            <button
                                                                onClick={() => handleRevert(event.item.id, event.logIndex)}
                                                                className="text-orange-500 hover:text-orange-600 transition-colors"
                                                                title="Undo Delivery"
                                                            >
                                                                <Undo2 size={16} />
                                                            </button>
                                                        </div>

                                                        <h4 className="text-sm font-semibold text-slate-800 leading-snug">{event.item.name}</h4>

                                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Quantity</p>
                                                                <p className="text-xs font-bold text-slate-700">{event.log.quantity} Units</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Received By</p>
                                                                <p className="text-xs font-bold text-slate-700">{event.log.givenTo || 'Unknown'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="text-center text-xs text-slate-400 py-4">No delivery history yet.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductHandoverModal;
