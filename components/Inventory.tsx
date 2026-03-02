import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, BrainCircuit, AlertTriangle, MoreHorizontal, Package, Pencil, Trash2, X, Save, Download, ChevronDown, Camera, Upload, Filter, Sparkles, TrendingUp, AlertCircle, ShoppingCart, Image as ImageIcon } from 'lucide-react';
import { store } from '../store';
import { Product, SmartAlertItem } from '../types';
import { ReceiptScanModal } from './ReceiptScanModal';
import { ASCLEPIUS_CATALOG } from '../asclepiusData';
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  // Initialize with empty array to prevent crash if store is not ready
  const [products, setProducts] = useState<Product[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartAlertItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiptScanOpen, setIsReceiptScanOpen] = useState(false);

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

  return (
    <div className="h-full flex flex-col gap-6 relative overflow-hidden w-full">


      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm animate-modal-in">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-dark text-center mb-2">Delete Product?</h3>
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
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-lg animate-modal-in overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-dark">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                  placeholder="e.g. ImmunoDoc Ras"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                  placeholder="e.g. Wellness"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">MRP</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={e => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">DP</label>
                  <input
                    type="number"
                    value={formData.dp}
                    onChange={e => setFormData({ ...formData, dp: e.target.value })}
                    className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">SP</label>
                  <input
                    type="number"
                    value={formData.sp}
                    onChange={e => setFormData({ ...formData, sp: e.target.value })}
                    className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Stock Quantity</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                  placeholder="0"
                />
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Product Image</label>
                <div className="flex items-center gap-4">
                  {/* Image Preview */}
                  <div className="w-24 h-24 bg-bg rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} className="text-gray-400" />
                    )}
                  </div>

                  {/* Upload Button */}
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-full px-4 py-3 bg-bg rounded-xl font-medium text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          {imagePreview ? 'Change Image' : 'Upload Image'}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 mt-1 ml-1">JPG, PNG up to 5MB</p>
                  </div>

                  {/* Hidden File Input */}
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

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl font-bold bg-dark text-white hover:bg-dark-light shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2"
              >
                <Save size={18} /> {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-3xl shadow-sm gap-4 shrink-0 w-full">
        <div className="relative w-full md:flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-11 pr-4 py-3 bg-bg rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex w-full md:w-auto items-center gap-2 md:gap-3">
          {/* Category Dropdown */}
          <div className="relative">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-gray-700 px-4 py-3 pr-10 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer text-sm"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Add Item Button */}
          <button
            onClick={handleOpenAdd}
            className="bg-dark text-white px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-dark-light transition shadow-sm text-sm whitespace-nowrap"
          >
            <Plus size={18} /> <span className="hidden sm:inline">Add Item</span>
          </button>

          {/* Receipt Scan Button */}
          <button
            onClick={() => setIsReceiptScanOpen(true)}
            className="flex-1 md:flex-none bg-primary text-dark px-3 md:px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition shadow-sm text-sm whitespace-nowrap"
          >
            <Camera size={18} /> <span className="hidden sm:inline">Scan Receipt</span><span className="sm:hidden">Scan</span>
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

      {/* Mobile Stats Toggle Button */}
      <div className="md:hidden w-full px-1">
        <button
          onClick={() => setIsStatsOpen(!isStatsOpen)}
          className="w-full flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm text-dark font-bold"
        >
          <span>Inventory Snapshot</span>
          <div className="flex items-center gap-2 text-primary-600 text-sm">
            {isStatsOpen ? 'Hide Stats' : 'Show Stats'}
            {isStatsOpen ? <ChevronDown className="rotate-180 transition-transform" size={20} /> : <ChevronDown className="transition-transform" size={20} />}
          </div>
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-hidden w-full">

        {/* Inventory Stats Grid */}
        {/* Inventory Stats - Desktop Unified Card / Mobile Collapsible */}
        <div className={`w-full shrink-0 ${isStatsOpen ? 'block' : 'hidden md:block'}`}>
          <div className={`
             ${isStatsOpen ? 'bg-transparent shadow-none p-0' : 'bg-white shadow-sm p-5 border border-transparent'} 
             md:bg-white md:shadow-sm md:p-5 md:rounded-3xl transition-all
           `}>
            <div className="flex overflow-x-auto pb-4 md:pb-0 gap-4 md:gap-0 md:grid md:grid-cols-4 md:divide-x md:divide-gray-100 no-scrollbar snap-x">

              {/* Total Items */}
              <div className="min-w-[260px] md:min-w-0 snap-center bg-white p-5 md:p-0 rounded-3xl md:rounded-none shadow-sm md:shadow-none flex flex-col md:flex-col justify-between items-start md:px-6 md:first:pl-0 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 md:hidden"></div>
                <div className="relative z-10">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Items</p>
                  <h3 className="text-2xl font-black text-dark">{products.length}</h3>
                </div>
                <div className="relative z-10 mt-4 md:mt-2 flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg self-start">
                  <Package size={14} />
                  <span className="text-xs font-bold">In Stock</span>
                </div>
              </div>

              {/* MRP */}
              <div className="min-w-[260px] md:min-w-0 snap-center bg-white p-5 md:p-0 rounded-3xl md:rounded-none shadow-sm md:shadow-none flex flex-col md:flex-col justify-between items-start md:px-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 md:hidden"></div>
                <div className="relative z-10">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Stock Cost (MRP)</p>
                  <h3 className="text-2xl font-black text-dark">₹{totalMrp.toLocaleString()}</h3>
                </div>
                <div className="relative z-10 mt-4 md:mt-2 flex items-center gap-2 text-orange-600 bg-orange-50 px-2 py-1 rounded-lg self-start">
                  <TrendingUp size={14} />
                  <span className="text-xs font-bold">Market Price</span>
                </div>
              </div>

              {/* DP */}
              <div className="min-w-[260px] md:min-w-0 snap-center bg-white p-5 md:p-0 rounded-3xl md:rounded-none shadow-sm md:shadow-none flex flex-col md:flex-col justify-between items-start md:px-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 md:hidden"></div>
                <div className="relative z-10">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Stock Cost</p>
                  <h3 className="text-2xl font-black text-dark">₹{totalDp.toLocaleString()}</h3>
                </div>
                <div className="relative z-10 mt-4 md:mt-2 flex items-center gap-2 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg self-start">
                  <Sparkles size={14} />
                  <span className="text-xs font-bold">Distributor Price</span>
                </div>
              </div>

              {/* SP (No Prefix) */}
              <div className="min-w-[260px] md:min-w-0 snap-center bg-white p-5 md:p-0 rounded-3xl md:rounded-none shadow-sm md:shadow-none flex flex-col md:flex-col justify-between items-start md:px-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 md:hidden"></div>
                <div className="relative z-10">
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total SP Value</p>
                  <h3 className="text-2xl font-black text-dark">{totalSp.toLocaleString()}</h3>
                </div>
                <div className="relative z-10 mt-4 md:mt-2 flex items-center gap-2 text-green-600 bg-green-50 px-2 py-1 rounded-lg self-start">
                  <ShoppingCart size={14} />
                  <span className="text-xs font-bold">Sales Point</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Inventory List */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm flex flex-col overflow-hidden p-4 md:p-6 w-full">
          <div className="flex justify-between items-center mb-4 shrink-0 relative z-30">
            <h3 className="font-bold text-dark text-lg">Product List</h3>

          </div>

          <div className="overflow-y-auto flex-1 pb-24 md:pb-2 custom-scrollbar w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead className="text-gray-400 text-xs uppercase font-semibold sticky top-0 bg-white z-10">
                  <tr>
                    <th className="pb-3 pl-2">Product Name</th>
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
                    <tr key={product.id} className="group hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-dark bg-bg rounded-l-2xl group-hover:bg-white border border-transparent group-hover:border-gray-100 min-w-[150px]">{product.name}</td>
                      <td className="p-4 bg-bg group-hover:bg-white border border-transparent group-hover:border-gray-100">
                        <span className="bg-white px-2 py-1 rounded text-xs text-gray-600 border shadow-sm whitespace-nowrap">{product.category}</span>
                      </td>
                      <td className="p-4 text-right text-gray-600 bg-bg group-hover:bg-white border border-transparent group-hover:border-gray-100">₹{product.mrp}</td>
                      <td className="p-4 text-right font-bold text-dark bg-bg group-hover:bg-white border border-transparent group-hover:border-gray-100">₹{product.dp}</td>
                      <td className="p-4 text-center font-bold text-primary-600 bg-bg group-hover:bg-white border border-transparent group-hover:border-gray-100">{product.sp}</td>
                      <td
                        className="p-4 text-center font-medium bg-bg group-hover:bg-white border border-transparent group-hover:border-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
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
                            className="w-20 px-2 py-1 rounded border border-primary focus:outline-none focus:ring-2 focus:ring-primary text-center"
                            autoFocus
                          />
                        ) : (
                          product.stock
                        )}
                      </td>
                      <td className="p-4 text-center bg-bg group-hover:bg-white border border-transparent group-hover:border-gray-100">
                        {product.stock < 15 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-lg whitespace-nowrap">
                            <AlertTriangle size={10} /> Low
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-dark bg-primary px-2 py-1 rounded-lg">
                            Good
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center bg-bg rounded-r-2xl group-hover:bg-white border border-transparent group-hover:border-gray-100 w-24">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleOpenEdit(product)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors" title="Edit">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setDeleteConfirmId(product.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filtered.map(product => (
                <div key={product.id} className="bg-bg rounded-2xl p-4 border border-transparent hover:border-gray-200 transition-all">
                  {/* Product Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-dark text-sm truncate">{product.name}</h4>
                      <span className="inline-block bg-white px-2 py-0.5 rounded text-[10px] text-gray-600 border shadow-sm mt-1">
                        {product.category}
                      </span>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => handleOpenEdit(product)} className="p-2 rounded-lg hover:bg-white text-gray-500 hover:text-primary-600 transition-colors" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeleteConfirmId(product.id)} className="p-2 rounded-lg hover:bg-white text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Product Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">MRP</p>
                      <p className="text-sm font-semibold text-gray-700">₹{product.mrp}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">DP</p>
                      <p className="text-sm font-bold text-dark">₹{product.dp}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">SP</p>
                      <p className="text-sm font-bold text-primary-600">{product.sp}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Stock</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-dark">{product.stock}</p>
                        {product.stock < 15 ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={9} /> Low
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-dark bg-primary px-1.5 py-0.5 rounded">
                            Good
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;