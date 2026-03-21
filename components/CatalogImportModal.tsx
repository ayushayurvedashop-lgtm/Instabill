import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, ArrowRight, Loader2, PackagePlus, RefreshCw, ScanSearch, Globe, Link, Upload } from 'lucide-react';
import { Product } from '../types';
import { store } from '../store';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';


interface CatalogImportModalProps {
  onClose: () => void;
}

type ImportStatus = 'scanning' | 'review' | 'importing' | 'complete';

interface ScannedItem extends Omit<Product, 'id'> {
  status: 'new' | 'update' | 'same';
  oldData?: Partial<Product>;
  selected: boolean;
}

export const CatalogImportModal: React.FC<CatalogImportModalProps> = ({ onClose }) => {
  const [status, setStatus] = useState<ImportStatus>('scanning');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [stats, setStats] = useState({ new: 0, update: 0, same: 0 });
  const [sources, setSources] = useState<string[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);

  // CSV Upload Handler
  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      const csvProducts: Omit<Product, 'id'>[] = dataLines.map(line => {
        const [name, category, mrp, dp, sp] = line.split(',').map(s => s.trim());
        return {
          name: name || 'Unknown',
          category: category || 'General',
          mrp: Number(mrp) || 0,
          dp: Number(dp) || Number(mrp) * 0.8 || 0,
          sp: Number(sp) || Math.round(Number(mrp) * 0.1) || 0,
          stock: 50
        };
      }).filter(p => p.mrp > 0 && p.name !== 'Unknown');

      // Process the CSV data same as AI data
      const currentInventory = store.getProducts();

      const analyzedItems: ScannedItem[] = csvProducts.map(catalogItem => {
        const existing = currentInventory.find(
          p => p.name.toLowerCase() === catalogItem.name.toLowerCase()
        );

        if (!existing) {
          return { ...catalogItem, status: 'new', selected: true };
        }

        if (existing.mrp !== catalogItem.mrp || existing.dp !== catalogItem.dp || existing.sp !== catalogItem.sp) {
          return {
            ...catalogItem,
            status: 'update',
            selected: true,
            oldData: { mrp: existing.mrp, dp: existing.dp, sp: existing.sp }
          };
        }

        return { ...catalogItem, status: 'same', selected: false };
      });

      const changesOnly = analyzedItems.filter(i => i.status !== 'same');

      setStats({
        new: analyzedItems.filter(i => i.status === 'new').length,
        update: analyzedItems.filter(i => i.status === 'update').length,
        same: analyzedItems.filter(i => i.status === 'same').length
      });

      setScannedItems(changesOnly);
      setSources([`CSV File: ${file.name}`]);
      setIsFallback(false);
      setStatus('review');
    };

    reader.readAsText(file);
  };

  // Scanning Logic — fetches from Firestore default_catalog
  useEffect(() => {
    const scan = async () => {
      try {
        // Fetch default catalog from Firestore
        const snap = await getDocs(collection(db, 'default_catalog'));
        const catalogData: Omit<Product, 'id'>[] = snap.docs.map(d => {
          const data = d.data();
          return {
            name: data.name || '',
            category: data.category || '',
            mrp: data.mrp || 0,
            dp: data.dp || 0,
            sp: data.sp || 0,
            stock: 0,
          };
        });

        setIsFallback(false);

        const currentInventory = store.getProducts();

        const analyzedItems: ScannedItem[] = catalogData.map(catalogItem => {
          const existing = currentInventory.find(
            p => p.name.toLowerCase() === catalogItem.name.toLowerCase()
          );

          if (!existing) {
            return { ...catalogItem, status: 'new', selected: true };
          }

          // Check for price changes
          if (existing.mrp !== catalogItem.mrp || existing.dp !== catalogItem.dp || existing.sp !== catalogItem.sp) {
            return {
              ...catalogItem,
              status: 'update',
              selected: true,
              oldData: { mrp: existing.mrp, dp: existing.dp, sp: existing.sp }
            };
          }

          return { ...catalogItem, status: 'same', selected: false };
        });

        // Filter to show only relevant changes or new items
        const changesOnly = analyzedItems.filter(i => i.status !== 'same');

        setStats({
          new: analyzedItems.filter(i => i.status === 'new').length,
          update: analyzedItems.filter(i => i.status === 'update').length,
          same: analyzedItems.filter(i => i.status === 'same').length
        });

        setScannedItems(changesOnly);
        setStatus('review');
      } catch (e) {
        console.error('Failed to fetch default catalog', e);
        setIsFallback(true);
        setStatus('review');
      }
    };

    scan();
  }, []);

  const handleToggleSelect = (index: number) => {
    const newItems = [...scannedItems];
    newItems[index].selected = !newItems[index].selected;
    setScannedItems(newItems);
  };

  const handleImport = async () => {
    setStatus('importing');
    const toImport = scannedItems.filter(i => i.selected);

    // Convert ScannedItem back to Omit<Product, 'id'> for the store
    const payload = toImport.map(({ status, oldData, selected, ...rest }) => rest);

    await store.bulkUpsertProducts(payload);

    await new Promise(resolve => setTimeout(resolve, 1000)); // Visual delay
    setStatus('complete');
  };

  if (status === 'scanning') {
    return (
      <div className="fixed inset-0 bg-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center shadow-xl animate-modal-in">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ScanSearch size={40} className="text-dark animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">Scanning Full Catalog</h3>
          <p className="text-gray-500 mb-6">Searching asclepiuswellness.com for comprehensive product lists (Wellness, Agriculture, Cosmetics, etc)...</p>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full w-2/3 animate-[progress_2s_ease-in-out_infinite]"></div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Powered by Google Search Grounding</p>

          {showCsvUpload && (
            <div className="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
              <p className="text-sm text-orange-700 mb-3 font-medium">⚠️ Gemini API quota exceeded. Please upload a CSV file instead:</p>
              <label className="cursor-pointer inline-block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-dark text-white rounded-lg font-bold text-sm hover:bg-dark-light transition flex items-center gap-2 justify-center">
                  <Upload size={16} />
                  Upload CSV File
                </div>
              </label>
              <p className="text-xs text-gray-500 mt-2">Format: name,category,mrp,dp,sp</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="fixed inset-0 bg-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center shadow-xl animate-modal-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">Import Successful!</h3>
          <p className="text-gray-500 mb-6">Your inventory has been updated with the latest products and prices.</p>
          <button onClick={onClose} className="w-full py-3 bg-dark text-white rounded-xl font-bold hover:bg-dark-light transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl animate-modal-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gray-50 rounded-t-3xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-dark flex items-center gap-2">
                <PackagePlus className="text-primary-600" /> Catalog Import Manager
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Found <span className="font-bold text-green-600">{stats.new} New</span> and <span className="font-bold text-orange-500">{stats.update} Updates</span>.
                <span className="text-gray-400 ml-1">({stats.same} items up to date)</span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
              <X size={20} />
            </button>
          </div>

          {/* Grounding Sources / Alert */}
          {isFallback ? (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center gap-3 text-sm text-orange-700">
              <AlertTriangle size={16} />
              <span>AI scan was unable to retrieve the live catalog. Using offline backup data.</span>
            </div>
          ) : (
            sources.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
                <div className="flex items-center gap-2 mb-1 font-bold">
                  <Globe size={14} /> Verified Sources:
                </div>
                <div className="flex flex-wrap gap-2">
                  {sources.slice(0, 4).map((src, idx) => (
                    <a key={idx} href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-blue-200 hover:text-blue-600 hover:underline text-xs truncate max-w-[200px]">
                      <Link size={10} /> {new URL(src).hostname}
                    </a>
                  ))}
                  {sources.length > 4 && <span className="text-xs text-blue-400 self-center">+{sources.length - 4} more</span>}
                </div>
              </div>
            )
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-bg">
          {scannedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Check size={48} className="mb-4 opacity-20" />
              <p>Your inventory is fully up to date!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scannedItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${item.selected ? 'bg-white border-primary shadow-sm' : 'bg-gray-50 border-transparent opacity-60'
                    }`}
                  onClick={() => handleToggleSelect(idx)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center ${item.selected ? 'bg-primary border-primary text-dark' : 'bg-white border-gray-300'
                      }`}>
                      {item.selected && <Check size={14} strokeWidth={4} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-dark">{item.name}</h4>
                        {item.status === 'new' ? (
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">NEW</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">UPDATE</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                  </div>

                  {/* Price Diff */}
                  <div className="text-right text-sm">
                    {item.status === 'new' ? (
                      <div className="space-y-1">
                        <div className="text-dark font-medium">MRP: ₹{item.mrp}</div>
                        <div className="text-gray-500 text-xs">DP: ₹{item.dp} • SP: {item.sp}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="text-gray-400 text-xs text-right">
                          <div className="line-through">₹{item.oldData?.mrp}</div>
                          <div>₹{item.oldData?.dp}</div>
                        </div>
                        <ArrowRight size={14} className="text-gray-300" />
                        <div className="text-dark font-bold text-right">
                          <div className={item.mrp !== item.oldData?.mrp ? 'text-orange-600' : ''}>₹{item.mrp}</div>
                          <div className={item.dp !== item.oldData?.dp ? 'text-orange-600 text-xs' : 'text-xs text-gray-500'}>₹{item.dp}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white rounded-b-3xl flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {scannedItems.filter(i => i.selected).length} items selected
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={status === 'importing' || scannedItems.filter(i => i.selected).length === 0}
              className="px-6 py-3 bg-dark text-white rounded-xl font-bold hover:bg-dark-light transition shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {status === 'importing' ? (
                <><Loader2 size={18} className="animate-spin" /> Updating...</>
              ) : (
                <><RefreshCw size={18} /> Update Inventory</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};