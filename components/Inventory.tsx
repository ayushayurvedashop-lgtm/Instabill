import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, BrainCircuit, AlertTriangle, MoreHorizontal, Package, Pencil, Trash2, X, Save, Download, ChevronDown, Camera, Upload, Filter, Sparkles, TrendingUp, AlertCircle, ShoppingCart, Image as ImageIcon, Check, RotateCcw } from 'lucide-react';
import { store } from '../store';
import { Product, SmartAlertItem } from '../types';
import { ReceiptScanModal } from './ReceiptScanModal';
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useBackButton } from '../hooks/useBackButton';

const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  // Initialize with empty array to prevent crash if store is not ready
  const [products, setProducts] = useState<Product[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartAlertItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiptScanOpen, setIsReceiptScanOpen] = useState(false);

  // Back button: close modals
  useBackButton(isModalOpen, () => { setIsModalOpen(false); setEditingProduct(null); });
  useBackButton(isReceiptScanOpen, () => setIsReceiptScanOpen(false));

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    mrp: '',
    dp: '',
    sp: '',
    stock: '',
    imageUrl: ''
  });

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Mobile Stats Toggle
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Inline Stock Edit
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editStockValue, setEditStockValue] = useState<string>('');



  useEffect(() => {
    try {
      // Load existing products
      const currentProducts = store.getProducts();
      setProducts(currentProducts);
      setSmartSuggestions(store.getSmartStockSuggestions());

      // Auto-import removed. User must manually "Reset to Default" if they want the catalog back.
    } catch (error) {
      console.error("Error loading inventory:", error);
    }

    const unsubscribe = store.subscribe(() => {
      setProducts(store.getProducts());
      setSmartSuggestions(store.getSmartStockSuggestions());
    });
    return () => unsubscribe();
  }, []);

  const filtered = products.filter(p =>
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Calculate Totals
  const totalMrp = products.reduce((sum, p) => sum + (p.mrp * p.stock), 0);
  const totalDp = products.reduce((sum, p) => sum + (p.dp * p.stock), 0);
  const totalSp = products.reduce((sum, p) => sum + (p.sp * p.stock), 0);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({ name: '', category: '', mrp: '', dp: '', sp: '', stock: '', imageUrl: '' });
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      mrp: product.mrp.toString(),
      dp: product.dp.toString(),
      sp: product.sp.toString(),
      stock: product.stock.toString(),
      imageUrl: product.imageUrl || ''
    });
    setImagePreview(product.imageUrl || null);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await store.deleteProduct(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };



  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `product-images/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.mrp) {
      alert("Name and MRP are required");
      return;
    }

    const payload = {
      name: formData.name,
      category: formData.category || 'General',
      mrp: Number(formData.mrp),
      dp: Number(formData.dp),
      sp: Number(formData.sp),
      stock: Number(formData.stock),
      imageUrl: formData.imageUrl || undefined
    };

    if (editingProduct) {
      await store.updateProduct({
        ...editingProduct,
        ...payload
      });
    } else {
      await store.addProduct(payload);
    }
    setIsModalOpen(false);
  };

  const startEditingStock = (product: Product) => {
    setEditingStockId(product.id);
    setEditStockValue(product.stock.toString());
  };

  const saveStock = async (e: React.FormEvent | React.FocusEvent) => {
    if (!editingStockId) return;

    // Prevent double submission if blur fires after keydown
    const prodId = editingStockId;
    const newStock = parseInt(editStockValue);

    // Reset immediately to avoid UI lag/glitches
    setEditingStockId(null);

    if (!isNaN(newStock) && newStock >= 0) {
      const product = products.find(p => p.id === prodId);
      if (product && product.stock !== newStock) {
        await store.updateProduct({ ...product, stock: newStock });
      }
    }
  };

  const handleStockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveStock(e);
    } else if (e.key === 'Escape') {
      setEditingStockId(null);
    }
  };

  // Zero out all stock
  const [showZeroOutConfirm, setShowZeroOutConfirm] = useState(false);

  const handleZeroOutStock = async () => {
    setShowZeroOutConfirm(false);
    for (const product of products) {
      if (product.stock !== 0) {
        await store.updateProduct({ ...product, stock: 0 });
      }
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 md:gap-4 relative overflow-hidden w-full">

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm animate-modal-in">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-[#02575c] text-center mb-2">Delete Product?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 w-full max-w-lg animate-modal-in overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-[#02575c]">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F3F5F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 font-medium text-[#02575c]"
                  placeholder="e.g. ImmunoDoc Ras"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F3F5F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 font-medium text-[#02575c]"
                  placeholder="e.g. Wellness"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">MRP</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={e => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full px-3 py-3 bg-[#F3F5F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 font-medium text-[#02575c]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">DP</label>
                  <input
                    type="number"
                    value={formData.dp}
                    onChange={e => setFormData({ ...formData, dp: e.target.value })}
                    className="w-full px-3 py-3 bg-[#F3F5F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 font-medium text-[#02575c]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">SP</label>
                  <input
                    type="number"
                    value={formData.sp}
                    onChange={e => setFormData({ ...formData, sp: e.target.value })}
                    className="w-full px-3 py-3 bg-[#F3F5F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 font-medium text-[#02575c]"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">Stock Quantity</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F3F5F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 font-medium text-[#02575c]"
                  placeholder="0"
                />
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1 ml-1">Product Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#F3F5F2] rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={28} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-full px-4 py-2.5 bg-[#F3F5F2] rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                      {isUploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          {imagePreview ? 'Change Image' : 'Upload Image'}
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">JPG, PNG up to 5MB</p>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl font-bold bg-[#02575c] text-white hover:bg-[#02575c]/90 shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2"
              >
                <Save size={18} /> {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls - Search + Filters in one card */}
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100/60 p-3 md:p-4 shrink-0 w-full">
        {/* Search Row */}
        <div className="relative w-full mb-2.5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#02575c]/35" size={17} />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#F3F5F2] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/40 text-[#02575c] placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Actions Row */}
        <div className="flex items-center gap-2">
          {/* Category Dropdown */}
          <div className="relative flex-1 min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none w-full bg-[#e7faff] text-[#02575c] px-3 py-2.5 pr-8 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/40 cursor-pointer text-sm border-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#02575c]/50 pointer-events-none" />
          </div>

          {/* Add Item Button */}
          <button
            onClick={handleOpenAdd}
            className="bg-[#02575c] text-white w-[40px] h-[40px] rounded-xl font-bold flex items-center justify-center hover:bg-[#02575c]/90 transition shadow-sm shrink-0"
            title="Add Product"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>

          {/* Receipt Scan Button */}
          <button
            onClick={() => setIsReceiptScanOpen(true)}
            className="bg-[#5abc8b] text-white px-4 h-[40px] rounded-xl font-bold flex items-center justify-center gap-1.5 hover:bg-[#4da87a] transition shadow-sm text-sm whitespace-nowrap shrink-0"
          >
            <Camera size={15} /> Scan
          </button>

          {/* Receipt Scan Modal */}
          {isReceiptScanOpen && (
            <ReceiptScanModal
              onClose={() => setIsReceiptScanOpen(false)}
              products={products}
            />
          )}
        </div>
      </div>

      {/* Mobile Stats Toggle */}
      <div className="md:hidden w-full shrink-0">
        <button
          onClick={() => setIsStatsOpen(!isStatsOpen)}
          className="w-full flex items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm text-[#02575c] font-bold text-sm border border-gray-100/60"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#e7faff] flex items-center justify-center">
              <Package size={13} className="text-[#02575c]" />
            </div>
            <span>Inventory Snapshot</span>
          </div>
          <ChevronDown className={`transition-transform duration-200 text-[#5abc8b] ${isStatsOpen ? 'rotate-180' : ''}`} size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3 md:gap-4 overflow-hidden w-full">

        {/* Inventory Stats */}
        <div className={`w-full shrink-0 ${isStatsOpen ? 'block' : 'hidden md:block'}`}>
          {/* Mobile: horizontal scroll compact stats */}
          <div className="md:hidden flex overflow-x-auto gap-2.5 pb-1 no-scrollbar snap-x">
            {[
              { label: 'Items', value: products.length.toString(), icon: <Package size={13} />, bg: '#e7faff' },
              { label: 'MRP Value', value: `₹${totalMrp.toLocaleString()}`, icon: <TrendingUp size={13} />, bg: '#e4f595' },
              { label: 'DP Value', value: `₹${totalDp.toLocaleString()}`, icon: <Sparkles size={13} />, bg: '#e7faff' },
              { label: 'SP Total', value: totalSp.toLocaleString(), icon: <ShoppingCart size={13} />, bg: '#e4f595' },
            ].map((stat, i) => (
              <div key={i} className="min-w-[130px] snap-center bg-white rounded-2xl p-3 shadow-sm border border-gray-100/60 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stat.label}</p>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[#02575c]" style={{ backgroundColor: stat.bg }}>
                    {stat.icon}
                  </div>
                </div>
                <p className="text-[15px] font-extrabold text-[#02575c] leading-tight">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Desktop: single card with dividers */}
          <div className="hidden md:block bg-white shadow-sm p-5 rounded-3xl border border-gray-100/60">
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {[
                { label: 'Total Items', value: products.length.toString(), sub: 'In Stock', icon: <Package size={14} />, bg: '#e7faff' },
                { label: 'Stock Cost (MRP)', value: `₹${totalMrp.toLocaleString()}`, sub: 'Market Price', icon: <TrendingUp size={14} />, bg: '#e4f595' },
                { label: 'Stock Cost (DP)', value: `₹${totalDp.toLocaleString()}`, sub: 'Distributor Price', icon: <Sparkles size={14} />, bg: '#e7faff' },
                { label: 'Total SP Value', value: totalSp.toLocaleString(), sub: 'Sales Points', icon: <ShoppingCart size={14} />, bg: '#e4f595' },
              ].map((stat, i) => (
                <div key={i} className="px-6 first:pl-0">
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-extrabold text-[#02575c]">{stat.value}</h3>
                  <div className="mt-2 flex items-center gap-2 px-2 py-1 rounded-lg w-fit text-[#02575c]" style={{ backgroundColor: stat.bg }}>
                    {stat.icon}
                    <span className="text-xs font-bold">{stat.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zero Out Confirmation Modal */}
        {showZeroOutConfirm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm animate-modal-in">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <RotateCcw size={24} className="text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-[#02575c] text-center mb-2">Zero Out All Stock?</h3>
              <p className="text-gray-500 text-center text-sm mb-6">
                This will set the stock quantity of all <strong>{products.length}</strong> products to <strong>0</strong>. You can then update each product's stock individually.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowZeroOutConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleZeroOutStock}
                  className="flex-1 py-3 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-sm transition-all"
                >
                  Zero Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inventory List */}
        <div className="flex-1 bg-white rounded-2xl md:rounded-3xl shadow-sm flex flex-col overflow-hidden border border-gray-100/60 w-full">
          {/* List Header */}
          <div className="flex justify-between items-center px-4 md:px-6 pt-3.5 md:pt-5 pb-2.5 md:pb-3 shrink-0 border-b border-gray-100/80">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#02575c] text-[15px] md:text-lg">Products</h3>
              <span className="text-[11px] font-semibold text-[#02575c]/60 bg-[#e7faff] px-2 py-0.5 rounded-full">{filtered.length}</span>
            </div>
            <button
              onClick={() => setShowZeroOutConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-orange-500 bg-orange-50 hover:bg-orange-100 active:scale-95 transition-all"
            >
              <RotateCcw size={13} />
              Zero Stock
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pb-24 md:pb-2 custom-scrollbar w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block px-6 pt-2">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead className="text-gray-400 text-[11px] uppercase font-semibold sticky top-0 bg-white z-10">
                  <tr>
                    <th className="pb-3 pl-3">Product Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3 text-right">MRP</th>
                    <th className="pb-3 text-right">DP</th>
                    <th className="pb-3 text-center">SP</th>
                    <th className="pb-3 text-center">Stock</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filtered.map(product => (
                    <tr key={product.id} className="group hover:bg-[#e7faff]/30 transition-colors">
                      <td className="p-3.5 font-bold text-[#02575c] bg-[#F8F9F7] rounded-l-xl group-hover:bg-[#e7faff]/50 min-w-[150px]">{product.name}</td>
                      <td className="p-3.5 bg-[#F8F9F7] group-hover:bg-[#e7faff]/50">
                        <span className="bg-white px-2 py-0.5 rounded-md text-[11px] text-gray-500 font-medium border border-gray-100 whitespace-nowrap">{product.category}</span>
                      </td>
                      <td className="p-3.5 text-right text-gray-400 font-medium bg-[#F8F9F7] group-hover:bg-[#e7faff]/50">₹{product.mrp}</td>
                      <td className="p-3.5 text-right font-bold text-[#02575c] bg-[#F8F9F7] group-hover:bg-[#e7faff]/50">₹{product.dp}</td>
                      <td className="p-3.5 text-center font-bold text-[#5abc8b] bg-[#F8F9F7] group-hover:bg-[#e7faff]/50">{product.sp}</td>
                      <td
                        className="p-3.5 text-center font-semibold bg-[#F8F9F7] group-hover:bg-[#e7faff]/50 cursor-pointer"
                        onDoubleClick={() => startEditingStock(product)}
                        title="Double click to edit stock"
                      >
                        {editingStockId === product.id ? (
                          <input
                            type="number"
                            value={editStockValue}
                            onChange={(e) => setEditStockValue(e.target.value)}
                            onBlur={saveStock}
                            onKeyDown={handleStockKeyDown}
                            className="w-16 px-2 py-1 rounded-lg border border-[#5abc8b] focus:outline-none focus:ring-2 focus:ring-[#5abc8b]/50 text-center text-[#02575c] text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="text-[#02575c]">{product.stock}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center bg-[#F8F9F7] group-hover:bg-[#e7faff]/50">
                        {product.stock < 15 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg whitespace-nowrap">
                            <AlertTriangle size={10} /> Low
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#02575c] bg-[#e4f595] px-2 py-0.5 rounded-lg">
                            Good
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center bg-[#F8F9F7] rounded-r-xl group-hover:bg-[#e7faff]/50 w-24">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => handleOpenEdit(product)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-[#02575c] transition-colors" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteConfirmId(product.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List View - Inspired by Billing Added Items */}
            <div className="md:hidden py-1">
              {filtered.map((product, index) => {
                const isLow = product.stock < 15;
                return (
                  <div key={product.id} className="relative">
                    {/* Divider */}
                    {index > 0 && (
                      <div className="ml-[60px] mr-4 h-[1px] bg-[#EFEFEF]" />
                    )}
                    <div className="px-4 py-3 flex items-center gap-3 active:bg-[#e7faff]/20 transition-colors">
                      {/* Left: Stock Status Circle / Inline Editor */}
                      {editingStockId === product.id ? (
                        <div className="shrink-0 flex items-center gap-1 animate-fade-in">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={editStockValue}
                            onChange={(e) => setEditStockValue(e.target.value)}
                            onKeyDown={handleStockKeyDown}
                            onBlur={saveStock}
                            autoFocus
                            className="w-[52px] h-[40px] rounded-xl bg-[#e7faff] border-2 border-[#02575c] text-center text-[#02575c] font-bold text-[14px] focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            onMouseDown={(e) => { e.preventDefault(); saveStock(e); }}
                            className="w-[32px] h-[32px] rounded-full bg-[#02575c] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                          >
                            <Check size={16} className="text-white" strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => startEditingStock(product)}
                          className={`shrink-0 w-[40px] h-[40px] rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
                            isLow ? 'bg-[#FFC7C7]' : 'bg-[#E4F595]'
                          }`}
                        >
                          {isLow ? (
                            <span className="text-[#F22] font-bold text-[11px] leading-none">{product.stock}</span>
                          ) : (
                            <span className="text-[#02575c] font-bold text-[12px] leading-none">{product.stock}</span>
                          )}
                        </div>
                      )}

                      {/* Center: Product Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <h4 className="font-semibold text-[#02575c] text-[13px] leading-tight truncate">{product.name}</h4>
                        <div className="flex items-center gap-2">
                          {/* SP Pill */}
                          <div className={`px-2 py-[2px] rounded-full flex items-center justify-center shrink-0 ${isLow ? 'bg-[#FFE7E7]' : 'bg-[#E7FAFF]'}`}>
                            <span className={`text-[10px] font-medium whitespace-nowrap ${isLow ? 'text-[#353535]' : 'text-[#00747B]'}`}>SP {product.sp}</span>
                          </div>
                          {/* DP Pill */}
                          <div className="bg-[#F0F0F0] px-2 py-[2px] rounded-full flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-medium text-[#02575c] whitespace-nowrap">DP ₹{product.dp}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: MRP Price + Edit/Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[15px] font-extrabold text-[#02575c]">₹{product.mrp}</span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 rounded-lg text-gray-300 active:text-[#02575c] active:bg-[#e7faff] transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(product.id)}
                            className="p-1.5 rounded-lg text-gray-300 active:text-red-500 active:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <Package size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 font-medium">No products found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;