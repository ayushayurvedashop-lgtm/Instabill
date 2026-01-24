import React, { useState, useEffect } from 'react';
import { Customer, Bill } from '../types';
import { User, Phone, Calendar, Award, Search, MoreHorizontal, Clock, ArrowRight, CheckCircle, Wallet, FileText, X, ArrowLeft, Pencil, Trash2, Save } from 'lucide-react';
import { store } from '../store';
import BillDetailModal from './BillDetailModal';

type CustomerViewMode = 'history' | 'pending';

interface CustomersProps {
  onEditBill?: (bill: Bill) => void;
}

const Customers: React.FC<CustomersProps> = ({ onEditBill }) => {
  const [customers, setCustomers] = useState(store.getCustomers());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<CustomerViewMode>('history');

  // Data for selected customer
  const [history, setHistory] = useState<Bill[]>([]);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [totalPurchaseAmount, setTotalPurchaseAmount] = useState(0);

  // Bill View Modal State
  const [viewBill, setViewBill] = useState<Bill | null>(null);

  // Confirmation Modal State
  const [confirmItem, setConfirmItem] = useState<any | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', phone: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState<Customer | null>(null);

  useEffect(() => {
    // Initial fetch
    setCustomers(store.getCustomers());

    // Subscribe
    const unsubscribe = store.subscribe(() => {
      setCustomers(store.getCustomers());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      // Find the latest version of the customer from the store
      const updatedCustomer = customers.find(c => c.id === selectedCustomer.id || c.name === selectedCustomer.name);
      if (updatedCustomer && updatedCustomer !== selectedCustomer) {
        setSelectedCustomer(updatedCustomer);
      }

      const bills = store.getCustomerBills(selectedCustomer.name);
      setHistory(bills);
      setPendingItems(store.getPendingItems(selectedCustomer.name));

      const total = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      setTotalPurchaseAmount(total);
    }
  }, [customers, selectedCustomer, viewMode, viewBill, confirmItem]);

  const handleMarkAsGiven = (item: any) => {
    setConfirmItem(item);
  };

  const proceedMarkAsGiven = async () => {
    if (confirmItem) {
      await store.updateBillItemStatus(confirmItem.billId, confirmItem.id, 'Given');
      // Local state update happens via subscription
      setConfirmItem(null);
    }
  };

  const handleViewBill = (billId: string) => {
    const bill = history.find(b => b.id === billId);
    if (bill) {
      setViewBill(bill);
    }
  };

  const handleOpenEdit = () => {
    if (selectedCustomer) {
      setEditFormData({ name: selectedCustomer.name, phone: selectedCustomer.phone });
      setIsEditModalOpen(true);
      setShowMenu(false);
    }
  };

  const handleUpdateCustomer = async () => {
    if (selectedCustomer && editFormData.name && editFormData.phone) {
      await store.updateCustomer({
        ...selectedCustomer,
        name: editFormData.name,
        phone: editFormData.phone
      });
      setIsEditModalOpen(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (deleteConfirmation) {
      await store.deleteCustomer(deleteConfirmation.id);
      setDeleteConfirmation(null);
      setSelectedCustomer(null);
      // View mode resets automatically via effect if needed, or stays
    }
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex h-full gap-6 relative overflow-hidden">
      {/* Confirmation Modal */}
      {confirmItem && (
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm animate-modal-in">
            <h3 className="text-xl font-bold text-dark mb-2">Mark as Given?</h3>
            <p className="text-gray-500 text-sm mb-6">
              Are you sure you want to mark <span className="font-bold text-dark">{confirmItem.name}</span> as given to the customer?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={proceedMarkAsGiven}
                className="flex-1 py-2.5 rounded-xl font-bold bg-primary text-dark hover:bg-primary-hover shadow-sm transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm animate-modal-in">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-dark text-center mb-2">Delete Customer?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Are you sure you want to delete <span className="font-bold text-dark">{deleteConfirmation.name}</span>?
              <br />
              <span className="text-xs text-gray-400 block mt-2">Their billing history will be preserved.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCustomer}
                className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md animate-modal-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-dark">Edit Customer</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Customer Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Phone Number</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCustomer}
                className="flex-1 py-3 rounded-xl font-bold bg-dark text-white hover:bg-dark-light shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Details Modal */}
      <BillDetailModal bill={viewBill} onClose={() => setViewBill(null)} onEdit={onEditBill} />

      {/* List Panel - Hidden on mobile if customer is selected (Using LG breakpoint) */}
      <div className={`${selectedCustomer ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/3 bg-white rounded-3xl shadow-sm flex flex-col p-6 h-full overflow-hidden animate-slide-up`}>
        <div className="mb-6 shrink-0">
          <h2 className="text-xl font-bold text-dark mb-4">Customers</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search customers..."
              className="w-full pl-11 pr-4 py-3 bg-bg rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar space-y-2 pb-24 md:pb-2">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => setSelectedCustomer(c)}
              className={`p-4 rounded-2xl cursor-pointer transition-all flex items-center gap-3 touch-manipulation ${selectedCustomer?.id === c.id || selectedCustomer?.name === c.name
                ? 'bg-dark text-white shadow-md'
                : 'bg-bg hover:bg-gray-100 text-dark'
                }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${selectedCustomer?.id === c.id || selectedCustomer?.name === c.name ? 'bg-primary text-dark' : 'bg-white text-gray-400'
                }`}>
                {c.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-bold text-sm truncate">{c.name}</h3>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs opacity-70">
                    +91 {c.phone.slice(0, 5)}...
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details Panel - Hidden on mobile if NO customer selected (Using LG breakpoint) */}
      <div className={`${selectedCustomer ? 'flex' : 'hidden'} lg:flex w-full lg:w-2/3 flex-col h-full overflow-hidden`}>
        {selectedCustomer ? (
          <div className="bg-white rounded-3xl shadow-sm p-4 md:p-8 flex-1 flex flex-col h-full overflow-y-auto pb-24 md:pb-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 md:mb-8 pb-6 md:pb-8 border-b border-gray-100 shrink-0">
              <div className="flex items-center md:items-start gap-3 md:gap-4">
                {/* Back button for mobile/tablet */}
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="lg:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors"
                >
                  <ArrowLeft size={24} />
                </button>

                <div className="flex gap-4 items-center md:items-start">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-primary flex items-center justify-center text-dark text-xl md:text-2xl font-bold shadow-sm shrink-0">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-xl md:text-3xl font-bold text-dark mb-1 md:mb-2">{selectedCustomer.name}</h1>
                    <div className="flex flex-col md:flex-row gap-1 md:gap-4 text-gray-500 text-xs md:text-sm">
                      <span className="flex items-center gap-1 bg-bg px-2 py-1 rounded-lg w-fit"><Phone size={14} /> {selectedCustomer.phone}</span>
                      <span className="flex items-center gap-1 bg-bg px-2 py-1 rounded-lg w-fit hidden md:flex"><Calendar size={14} /> Since: {selectedCustomer.lastVisit}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 bg-bg rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <MoreHorizontal size={20} className="text-dark" />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-20 animate-scale-in origin-top-right">
                      <button
                        onClick={handleOpenEdit}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 text-dark transition-colors flex items-center gap-3 text-sm font-medium border-b border-gray-100"
                      >
                        <Pencil size={16} className="text-primary-600" />
                        <span>Edit Details</span>
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmation(selectedCustomer);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-red-50 text-red-600 transition-colors flex items-center gap-3 text-sm font-medium"
                      >
                        <Trash2 size={16} />
                        <span>Delete Customer</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8 shrink-0">
              <div className="bg-bg p-4 md:p-6 rounded-2xl md:rounded-3xl flex flex-col items-center md:block text-center md:text-left">
                <p className="text-gray-500 text-xs md:text-sm md:mb-1">Total SP</p>
                <div className="flex items-center gap-1 md:gap-2 justify-center md:justify-start">
                  <Award className="text-primary-600 w-4 h-4 md:w-6 md:h-6" />
                  <span className="text-xl md:text-3xl font-bold text-dark">{selectedCustomer.totalSpEarned}</span>
                </div>
              </div>
              <div className="bg-bg p-4 md:p-6 rounded-2xl md:rounded-3xl flex flex-col items-center md:block text-center md:text-left">
                <p className="text-gray-500 text-xs md:text-sm md:mb-1">Spent</p>
                <div className="flex items-center gap-1 md:gap-2 justify-center md:justify-start">
                  <Wallet className="text-green-600 w-4 h-4 md:w-6 md:h-6" />
                  <span className="text-xl md:text-3xl font-bold text-dark">₹{totalPurchaseAmount}</span>
                </div>
              </div>
              <div className="bg-bg p-4 md:p-6 rounded-2xl md:rounded-3xl flex flex-col items-center md:block col-span-2 md:col-span-1 text-center md:text-left">
                <p className="text-gray-500 text-xs md:text-sm md:mb-1">Last Visit</p>
                <div className="flex items-center gap-1 md:gap-2 justify-center md:justify-start">
                  <Calendar className="text-gray-400 w-4 h-4 md:w-6 md:h-6" />
                  <span className="text-lg md:text-xl font-bold text-dark">{selectedCustomer.lastVisit}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-gray-100 pb-4 shrink-0">
                <h3 className="text-lg font-bold text-dark">Activity</h3>
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('history')}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all ${viewMode === 'history' ? 'bg-white shadow-sm text-dark' : 'text-gray-500 hover:text-dark'}`}
                  >
                    History
                  </button>
                  <button
                    onClick={() => setViewMode('pending')}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all ${viewMode === 'pending' ? 'bg-white shadow-sm text-dark' : 'text-gray-500 hover:text-dark'}`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
                {viewMode === 'history' ? (
                  <div className="space-y-3 animate-fade-in pb-2">
                    {history.length > 0 ? history.map((bill) => {
                      const pendingCount = bill.items.filter((i: any) => i.status === 'Pending').length;
                      const isFullyDelivered = pendingCount === 0;

                      return (
                        <div
                          key={bill.id}
                          onClick={() => setViewBill(bill)}
                          className="border border-gray-100 rounded-2xl p-4 md:p-5 hover:shadow-md transition-shadow bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-3 group cursor-pointer"
                        >
                          <div className="flex items-start gap-4 w-full md:w-auto">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isFullyDelivered ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              <FileText size={20} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 md:gap-3 mb-1 flex-wrap">
                                <span className="font-bold text-dark text-sm md:text-base">Bill #{bill.id}</span>
                                <div className="flex gap-2">
                                  <span className="text-[10px] md:text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{bill.date}</span>
                                </div>
                              </div>
                              <p className="text-xs md:text-sm text-gray-500 line-clamp-1">
                                {bill.items.length} Items
                              </p>
                            </div>
                            <div className="md:hidden text-right">
                              <div className="font-bold text-dark text-base">₹{bill.totalAmount}</div>
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 md:gap-1 pl-0 md:pl-0 mt-2 md:mt-0 border-t md:border-t-0 border-dashed border-gray-100 pt-2 md:pt-0">
                            <div className="font-bold text-dark text-lg hidden md:block">₹{bill.totalAmount}</div>
                            <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide w-full md:w-auto text-center ${isFullyDelivered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                              }`}>
                              {isFullyDelivered ? 'DELIVERED' : `${pendingCount} PENDING`}
                            </span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-10 text-gray-400">No purchase history found.</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 animate-fade-in pb-2">
                    {pendingItems.length > 0 ? pendingItems.map((item, idx) => (
                      <div key={`${item.billId}-${item.id}-${idx}`} className="border border-orange-100 bg-white rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-3">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                            <Clock size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-dark text-sm md:text-base">{item.name}</p>
                            <div className="flex gap-2 text-xs text-gray-500 mt-1 font-medium">
                              <span>Qty: {item.quantity}</span>
                              <span className="text-gray-300">•</span>
                              <span>{item.billDate}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                          <button
                            className="text-xs font-bold flex items-center justify-center gap-1 bg-white border border-gray-200 px-3 py-2.5 md:py-2 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors text-gray-600 flex-1 md:flex-none"
                            onClick={() => handleViewBill(item.billId)}
                          >
                            View <ArrowRight size={12} />
                          </button>
                          <button
                            className="text-xs font-bold flex items-center justify-center gap-1 bg-white border border-primary text-primary-700 px-3 py-2.5 md:py-2 rounded-xl hover:bg-primary hover:text-dark transition-colors flex-1 md:flex-none"
                            onClick={() => handleMarkAsGiven(item)}
                          >
                            <CheckCircle size={14} /> Given
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-12 text-gray-400 flex flex-col items-center">
                        <CheckCircle size={48} className="mb-2 opacity-20" />
                        No pending products found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center h-full">
            <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center mb-4">
              <User size={32} className="opacity-50" />
            </div>
            <p className="font-medium">Select a customer to view details</p>
          </div>
        )}
      </div>
    </div >
  );
};

export default Customers;