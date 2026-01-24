import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Check, AlertCircle, ShoppingCart, Receipt, UserPlus, User, Phone, Plus, Camera, Image as ImageIcon, ChevronDown, Trash2, Mic, Edit2 } from 'lucide-react';
import { Tab, Bill, BillItem, ProductStatus, PaymentMethod, BillingType, Product } from '../types';
import { EMPTY_BILL } from '../constants';
import { store } from '../store';
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendBillSMS, sendBillWhatsapp } from '../services/smsService';
import { generateAndUploadInvoicePDF } from '../services/pdfService';
import { processVoiceInput } from '../services/voiceParsingService';

import { InvoiceModal } from './InvoiceModal';
import { ProductQuickSearch } from './ProductQuickSearch';
import { InteractiveHoverButton } from './ui/interactive-hover-button';
import { VoiceInput } from './ui/voice-input';
import { Switch } from './ui/switch';
import CustomerSearchBar from './CustomerSearchBar';

// Helper function to compress image
const compressImage = async (dataUrl: string, maxSizeKB: number = 500): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Initial resize if too large
      const MAX_DIMENSION = 1920;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;

      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Blob creation failed'));
            return;
          }

          if (blob.size <= maxSizeKB * 1024 || quality <= 0.1) {
            resolve(blob);
          } else {
            quality -= 0.1;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };

      tryCompress();
    };
    img.onerror = (err) => reject(err);
  });
};

interface BillingProps {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
}

const Billing: React.FC<BillingProps> = ({ tabs, setTabs, activeTabId, setActiveTabId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customers, setCustomers] = useState(store.getCustomers());
  const [products, setProducts] = useState<Product[]>(store.getProducts());

  // Add Customer Modal State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Add Product Modal State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // Invoice Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);
  const [sendSmsEnabled, setSendSmsEnabled] = useState(true); // Default to true as requested

  // Customer Search Dropdown State
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Camera/Snapshot State
  const [isCapturing, setIsCapturing] = useState(false);
  const [showSnapshotMenu, setShowSnapshotMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProductStatusModal, setShowProductStatusModal] = useState(false);

  // Quick Search State
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState<number>(-1); // For keyboard navigation in Add Items modal
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Voice Recognition State
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  // Keyboard shortcut for Quick Search (Ctrl + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault(); // Prevent default system behavior if any
        // If Add Items modal is open, focus the search input and select all text
        if (isAddProductOpen && productSearchRef.current) {
          productSearchRef.current.focus();
          productSearchRef.current.select(); // Select all text so new typing replaces it
          setHighlightedProductIndex(-1);
        } else {
          setIsQuickSearchOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddProductOpen]);

  // Global key listener for auto-focusing search in Add Items modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only active when Add Product modal is open
      if (!isAddProductOpen) return;

      // Ignore if modifier keys are pressed (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore if target is the search input itself
      if (e.target === productSearchRef.current) return;

      // If target is an input (like quantity)
      if (e.target instanceof HTMLInputElement) {
        // If it's a number key (0-9) or Numpad numbers, allow it for quantity
        // Also allow backspace/delete/arrows for editing
        if (/^[0-9]$/.test(e.key) ||
          e.code.startsWith('Numpad') ||
          ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          return;
        }
      }

      // Check if it's a printable character (length 1) - letters, symbols
      if (e.key.length === 1) {
        // Focus search
        productSearchRef.current?.focus();
        // Set the value to the key pressed (clearing previous)
        setSearchTerm(e.key);
        // Reset navigation
        setHighlightedProductIndex(-1);

        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAddProductOpen]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const snapshotMenuRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling

  // Pending Quantity Picker State
  const [pendingPickerItem, setPendingPickerItem] = useState<BillItem | null>(null);

  // Animation States
  const [exitingItems, setExitingItems] = useState<Set<string>>(new Set());
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [focusedQtyId, setFocusedQtyId] = useState<string | null>(null); // Track which item's qty input should be focused

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const activeBill = activeTab.bill;

  // Animation Styles

  const animationStyles = `
    /* Simple, performant animations using only opacity & transform (GPU accelerated) */
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .bill-item-enter {
      animation: fadeIn 0.2s ease-out forwards;
    }

    /* Desktop Enter Class */
    tr.bill-item-enter td .cell-content {
      animation: fadeIn 0.2s ease-out forwards;
    }
    
    /* Exit - Simple fade out */
    .bill-item-exit,
    tr.bill-item-exit {
      animation: fadeOut 0.15s ease-out forwards;
      pointer-events: none;
    }
  `;


  // Auto-scroll to bottom when item is added
  useEffect(() => {
    if (justAddedId && listContainerRef.current) {
      listContainerRef.current.scrollTo({
        top: listContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [justAddedId]);

  // Sync with store
  useEffect(() => {
    // Initial fetch
    setCustomers(store.getCustomers());
    setProducts(store.getProducts());

    // Subscribe to store updates
    const unsubscribe = store.subscribe(() => {
      setCustomers(store.getCustomers());
      setProducts(store.getProducts());
    });

    return () => unsubscribe();
  }, []);



  // Close snapshot menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setIsCustomerSearchOpen(false);
      }
      if (snapshotMenuRef.current && !snapshotMenuRef.current.contains(event.target as Node)) {
        setShowSnapshotMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchWrapperRef, snapshotMenuRef]);

  const updateActiveBill = (updates: Partial<Bill>) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const updatedBill = { ...t.bill, ...updates };
        // Update tab title if customer name changes
        let newTitle = t.title;
        if (updates.customerName !== undefined) {
          newTitle = updates.customerName.trim() ? updates.customerName : `Bill #${t.id}`;
        }
        return { ...t, bill: updatedBill, title: newTitle };
      }
      return t;
    }));
  };

  const handlePricingModeChange = (mode: BillingType) => {
    // Skip if already on this mode
    if (activeBill.billingType === mode) return;

    const newItems = activeBill.items.map(item => {
      const product = products.find(p => p.id === item.id);
      const price = product ? (mode === 'DP' ? product.dp : product.mrp) : item.currentPrice;
      return {
        ...item,
        currentPrice: price,
      };
    });

    const totalAmount = newItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
    const totalSp = parseFloat(newItems.reduce((sum, item) => sum + item.totalSp, 0).toFixed(2));

    updateActiveBill({
      billingType: mode,
      items: newItems,
      totalAmount,
      totalSp
    });
  };

  const handleAddItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItemIndex = activeBill.items.findIndex(item => item.id === productId);
    let newItems = [...activeBill.items];
    const price = activeBill.billingType === 'DP' ? product.dp : product.mrp;

    if (existingItemIndex > -1) {
      newItems[existingItemIndex].quantity += 1;
      newItems[existingItemIndex].totalSp = parseFloat((newItems[existingItemIndex].quantity * product.sp).toFixed(2));
    } else {
      newItems.push({
        ...product,
        quantity: 1,
        status: ProductStatus.GIVEN,
        pendingQuantity: 0, // Initialize as all given
        currentPrice: price,
        totalSp: parseFloat(product.sp.toFixed(2))
      });
      // Trigger enter animation for new item
      setJustAddedId(productId);
      setFocusedQtyId(productId); // Focus the quantity input for the newly added item
      setTimeout(() => setJustAddedId(null), 300);
    }
    recalculateTotals(newItems);
  };

  const handleSetQuantity = (itemId: string, newQty: number) => {
    if (newQty < 1) {
      handleRemoveItem(itemId);
      return;
    }
    const newItems = activeBill.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: newQty,
          totalSp: parseFloat((newQty * item.sp).toFixed(2))
        };
      }
      return item;
    });
    recalculateTotals(newItems);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const newItems = activeBill.items.map(item => {
      if (item.id === itemId) {
        const newQty = item.quantity + delta;
        if (newQty < 1) {
          return null; // Mark for removal
        }
        return {
          ...item,
          quantity: newQty,
          totalSp: parseFloat((newQty * item.sp).toFixed(2))
        };
      }
      return item;
    }).filter(item => item !== null) as BillItem[];
    recalculateTotals(newItems);
  };

  const handleRemoveItem = (itemId: string) => {
    // 1. Mark as exiting to trigger animation
    setExitingItems(prev => new Set(prev).add(itemId));

    // 2. Wait for animation to finish before removing from state
    setTimeout(() => {
      // Check if bill still exists/hasn't been cleared
      if (activeBill && activeBill.items) {
        const newItems = activeBill.items.filter(item => item.id !== itemId);
        recalculateTotals(newItems);
      }

      // 3. Cleanup exiting state
      setExitingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, 150); // 150ms matches CSS scaleDown animation duration
  };

  const handleStatusChange = (itemId: string) => {
    const item = activeBill.items.find(i => i.id === itemId);
    if (!item) return;

    // Open picker modal for selecting pending quantity
    setPendingPickerItem(item);
  };

  const handleSetPendingQuantity = (itemId: string, pendingQty: number) => {
    const newItems = activeBill.items.map(item => {
      if (item.id !== itemId) return item;

      const newStatus = pendingQty === 0 ? ProductStatus.GIVEN : ProductStatus.PENDING;
      return { ...item, status: newStatus, pendingQuantity: pendingQty };
    });

    updateActiveBill({ items: newItems });
    setPendingPickerItem(null);
  };

  const recalculateTotals = (items: BillItem[]) => {
    const totalAmount = items.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
    const totalSp = parseFloat(items.reduce((sum, item) => sum + item.totalSp, 0).toFixed(2));
    updateActiveBill({ items, totalAmount, totalSp });
  };

  // Check browser support for MediaDevices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsVoiceSupported(true);
    }
  }, []);

  // Full accumulated transcript for display
  const fullTranscriptRef = useRef<string>('');

  const startListening = async () => {
    const { startDeepgram } = await import('../services/deepgramService');

    if (isVoiceListening) return;
    setVoiceFeedback('Initializing...');
    fullTranscriptRef.current = '';
    setVoiceTranscript('');

    try {
      await startDeepgram(
        (transcript, isFinal) => {
          if (isFinal && transcript.trim()) {
            // Append to full transcript for display
            fullTranscriptRef.current += (fullTranscriptRef.current ? ' ' : '') + transcript.trim();
            setVoiceTranscript(fullTranscriptRef.current);

            console.log(`[Voice] Heard: "${transcript}" (Full: "${fullTranscriptRef.current}")`);

            // REAL-TIME PROCESSING: Process each final segment immediately
            processVoiceSegment(transcript);
          } else if (!isFinal && transcript.trim()) {
            // Show interim results with accumulated + current
            setVoiceTranscript(fullTranscriptRef.current + (fullTranscriptRef.current ? ' ' : '') + transcript);
          }
        },
        (state) => {
          console.log("Deepgram State:", state);
          if (state === 'listening') {
            setIsVoiceListening(true);
            setVoiceFeedback('Listening... (Speak naturally, items will be added in real-time)');
          } else if (state === 'stopped') {
            setIsVoiceListening(false);
            // Clear after a delay
            setTimeout(() => {
              setVoiceFeedback(null);
              setVoiceTranscript('');
              fullTranscriptRef.current = '';
            }, 3000);
          } else if (state === 'error') {
            setIsVoiceListening(false);
            setVoiceFeedback('Error occurred');
          }
        },
        products.map(p => p.name)
      );
    } catch (e: any) {
      console.error("Failed to start voice:", e);
      setVoiceFeedback('Failed to start');
      setIsVoiceListening(false);
    }
  };

  // Process a single voice segment in real-time
  const processVoiceSegment = (transcript: string) => {
    console.log(`[Voice] Processing segment: "${transcript}"`);

    // Split by "and", "aur", comma, or process as single item
    const segments = transcript
      .split(/\s+and\s+|\s+aur\s+|,/gi)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const segment of segments) {
      const results = processVoiceInput(segment, products);

      for (const result of results) {
        if (result.matchedProduct && result.confidence >= 0.25) {
          // Add the product with specified quantity
          for (let i = 0; i < result.quantity; i++) {
            handleAddItem(result.matchedProduct.id);
          }
          setVoiceFeedback(`✓ Added: ${result.matchedProduct.name} ×${result.quantity}`);
          console.log(`[Voice] ✓ ADDED: ${result.matchedProduct.name} ×${result.quantity}`);
        } else if (result.productName && result.productName.length > 2) {
          setVoiceFeedback(`? Could not find: "${result.productName}"`);
          console.log(`[Voice] ✗ NOT FOUND: "${result.productName}"`);
        }
      }
    }
  };

  const stopListening = async () => {
    const { stopDeepgram } = await import('../services/deepgramService');
    stopDeepgram();
    setIsVoiceListening(false);
  };


  const handleNewTab = () => {
    const newId = (Math.max(...tabs.map(t => parseInt(t.id))) + 1).toString();
    const newTab: Tab = { id: newId, title: `Bill #${newId}`, bill: { ...EMPTY_BILL, id: newId } };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleAddCustomer = async () => {
    if (newCustomerName.trim() && newCustomerPhone.trim()) {
      const newCustomer = {
        id: `c${Date.now()}`,
        name: newCustomerName,
        phone: newCustomerPhone,
        totalSpEarned: 0,
        lastVisit: new Date().toISOString().split('T')[0]
      };

      await store.addCustomer(newCustomer);
      updateActiveBill({ customerName: newCustomerName });
      setIsAddCustomerOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    }
  };

  const handleGenerateBill = async () => {
    if (!activeBill.customerName) {
      alert('Please select a customer first');
      return;
    }
    if (activeBill.items.length === 0) {
      alert('Please add items to the bill');
      return;
    }

    const isUpdate = activeBill.id.startsWith('#');

    const finalBill: Bill = {
      ...activeBill,
      id: isUpdate ? activeBill.id : (() => {
        // Generate sequential ID
        const allBills = store.getBills();
        const maxId = allBills.reduce((max, b) => {
          // Prioritize finding the max number from specifically formatted "#ID" bills (e.g. #464)
          if (b.id.startsWith('#')) {
            const match = b.id.match(/(\d+)/);
            const num = match ? parseInt(match[0]) : 0;
            return num > max ? num : max;
          }
          return max;
        }, 0);
        return `#${maxId + 1}`;
      })(),
      date: activeBill.date || new Date().toISOString().split('T')[0],
      time: activeBill.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    // Update the active bill with final details
    updateActiveBill(finalBill);

    if (isUpdate) {
      await store.updateBill(finalBill);
      alert('Bill updated successfully!');
    } else {
      // Save to store
      await store.addBill(finalBill);
    }

    // Close the current tab after generation FIRST
    const newTabs = tabs.filter(t => t.id !== activeTabId);
    if (newTabs.length === 0) {
      setTabs([{ id: '1', title: 'Bill #1', bill: { ...EMPTY_BILL, id: '1', billingType: store.getSettings().defaultBillingMode || 'DP' } }]);
      setActiveTabId('1');
    } else {
      setTabs(newTabs);
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }

    // Set the preview bill BEFORE opening the modal
    setPreviewBill(finalBill);

    // Small delay to ensure React state is fully settled before opening the modal
    // This prevents print layout issues on mobile where DOM isn't fully rendered
    setTimeout(() => {
      setShowInvoiceModal(true);
    }, 50);

    // Send SMS if enabled (async, runs in background)
    if (sendSmsEnabled) {
      // Find customer phone number
      const customer = customers.find(c => c.name === finalBill.customerName);
      if (customer && customer.phone) {
        // Generate PDF and upload to Firebase Storage, then send SMS
        (async () => {
          try {
            console.log('Generating PDF for SMS...');
            const pdfUrl = await generateAndUploadInvoicePDF(finalBill);
            console.log('PDF URL:', pdfUrl);
            console.log('PDF URL:', pdfUrl);
            const smsSuccess = await sendBillSMS(finalBill, customer.phone, pdfUrl || undefined);

            // Send WhatsApp
            if (pdfUrl) {
              const waSuccess = await sendBillWhatsapp(finalBill, customer.phone, pdfUrl);

              // Update Bill with WhatsApp Status
              const billWithStatus = {
                ...finalBill,
                whatsappStatus: waSuccess ? 'Sent' : 'Failed'
              } as Bill;

              await store.updateBill(billWithStatus);
              console.log('Bill updated with WhatsApp status:', billWithStatus.whatsappStatus);
            }

            if (smsSuccess) {
              console.log('SMS sent successfully with PDF link');
            } else {
              console.error('Failed to send SMS');
            }
          } catch (err) {
            console.error('Error in SMS/PDF flow:', err);
          }
        })();
      } else {
        console.warn('Customer phone not found for SMS');
      }
    }

    // Keep Payment Modal open but it will slide left via CSS
    // setShowPaymentModal(false); // Removed to allow transition
  };

  const handleCancel = () => {
    // Confirm before cancelling
    if (!window.confirm("Are you sure you want to cancel? This will clear all current items.")) {
      return;
    }

    // If it's an existing bill (ID starts with # or has real ID), close tab
    if (activeBill.id !== '1' && (activeBill.id.startsWith('#') || activeBill.items.length > 0)) {
      // Close the current tab
      const newTabs = tabs.filter(t => t.id !== activeTabId);
      if (newTabs.length === 0) {
        setTabs([{ id: '1', title: 'Bill #1', bill: { ...EMPTY_BILL, id: '1', billingType: store.getSettings().defaultBillingMode || 'DP' } }]);
        setActiveTabId('1');
      } else {
        setTabs(newTabs);
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
    } else {
      // If it's the initial draft, just reset it
      updateActiveBill({
        ...EMPTY_BILL,
        id: activeBill.id, // Keep the same ID
        date: new Date().toISOString().split('T')[0],
        billingType: store.getSettings().defaultBillingMode || 'DP'
      });
    }
  };

  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowSnapshotMenu(false);

    try {
      setIsCapturing(true);

      // Read file to data URL
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;

          // Compress
          const blob = await compressImage(dataUrl, 500);

          // Upload
          const timestamp = new Date().getTime();
          const billId = activeBill.id || 'draft';
          const fileName = `bill-snapshots/${billId}_${timestamp}.jpg`;

          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(storageRef);

          console.log('Snapshot uploaded successfully:', downloadURL);

          // Save to bill
          updateActiveBill({ snapshotUrl: downloadURL });

          alert('Snapshot saved successfully and attached to bill!');

          // Reset inputs
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          if (galleryInputRef.current) galleryInputRef.current.value = '';
        } catch (err: any) {
          console.error('Error processing image:', err);
          alert(`Failed to process image: ${err.message}`);
        } finally {
          setIsCapturing(false);
        }
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setIsCapturing(false);
      };
      reader.readAsDataURL(file);

    } catch (error: any) {
      console.error('Error uploading snapshot:', error);
      alert(`Failed to upload snapshot: ${error.message || 'Unknown error'}`);
      setIsCapturing(false);
    }
  };

  const handleCameraClick = () => {
    setShowSnapshotMenu(false);
    setShowCameraModal(true);
    startCamera();
  };

  const handleGalleryClick = () => {
    setShowSnapshotMenu(false);
    galleryInputRef.current?.click();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    try {
      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0);

      // Convert to data URL for preview
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(imageDataUrl);

      // Stop camera
      stopCamera();

    } catch (error: any) {
      console.error('Error capturing photo:', error);
      alert(`Failed to capture photo: ${error.message || 'Unknown error'}`);
    }
  };

  // Function to compress image
  const compressImage = (dataUrl: string, maxSizeKB: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }

        let width = img.width;
        let height = img.height;
        const maxDim = 1200; // Max dimension for image (width or height)

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        let blob = dataURLtoBlob(compressedDataUrl);

        // Iteratively reduce quality until size is below maxSizeKB
        while (blob.size > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          blob = dataURLtoBlob(compressedDataUrl);
        }

        resolve(blob);
      };
      img.onerror = (error) => reject(error);
    });
  };

  // Helper function to convert data URL to Blob
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const savePhoto = async () => {
    if (!capturedImage) return;

    try {
      setIsCapturing(true);

      // Compress image to max 300KB (smaller for Firestore)
      const blob = await compressImage(capturedImage, 300);

      // Convert blob to Base64 string
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;

        // Save Base64 to active bill (temporary)
        // It will be moved to 'bill_snapshots' collection when bill is generated
        updateActiveBill({
          snapshotData: base64data,
          hasSnapshot: true
        });

        // Close modal and reset
        setCapturedImage(null);
        setShowCameraModal(false);
        setIsCapturing(false);

        alert('Photo attached to bill! It will be saved when you generate the bill.');
      };

    } catch (error: any) {
      console.error('Error saving photo:', error);
      setIsCapturing(false);
      alert(`Failed to save photo: ${error.message || 'Unknown error'}`);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const closeCameraModal = () => {
    stopCamera();
    setShowCameraModal(false);
  };

  const filteredProducts = products.filter(p =>
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const customerSuggestions = customers.filter(c =>
    c.name.toLowerCase().includes(activeBill.customerName.toLowerCase())
  );

  const renderProductContent = (isModal: boolean) => (
    <div className={`bg-white shadow-xl flex flex-col animate-scale-in h-full ${isModal ? 'md:rounded-3xl p-4 md:p-6 w-full max-w-4xl md:h-[80vh]' : 'rounded-3xl p-4 md:p-5 w-full h-full'}`}>
      <div className={`flex justify-between items-center mb-6 shrink-0 ${isModal ? '' : 'hidden'}`}>
        <h3 className="text-xl font-bold text-dark">Add Items</h3>
        <button
          onClick={() => setIsAddProductOpen(false)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {!isModal && (
        <div className="mb-4">
          <h3 className="text-lg font-bold text-dark">Items</h3>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4 md:mb-6 shrink-0">
        <div className="relative flex-1 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              ref={productSearchRef}
              type="text"
              placeholder="Search Items (Ctrl+Space)"
              className="w-full pl-11 pr-4 py-3 bg-bg rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedProductIndex(-1); // Reset highlight when typing
              }}
              onKeyDown={(e) => {
                const productsCount = filteredProducts.length;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedProductIndex(prev =>
                    prev < productsCount - 1 ? prev + 1 : 0
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedProductIndex(prev =>
                    prev > 0 ? prev - 1 : productsCount - 1
                  );
                } else if (e.key === 'Enter' && highlightedProductIndex >= 0) {
                  e.preventDefault();
                  const selectedProduct = filteredProducts[highlightedProductIndex];
                  if (selectedProduct) {
                    handleAddItem(selectedProduct.id);
                    setHighlightedProductIndex(-1);
                  }
                } else if (e.key === 'Escape') {
                  setHighlightedProductIndex(-1);
                  e.currentTarget.blur();
                }
              }}
            />
          </div>

          {/* Voice Input Button */}
          {isVoiceSupported && (
            <VoiceInput
              listening={isVoiceListening}
              setListening={(listening) => {
                if (listening) {
                  startListening();
                } else {
                  stopListening();
                }
              }}
              onStart={() => setVoiceFeedback('Listening...')}
              onStop={() => {
                if (!voiceTranscript) {
                  setVoiceFeedback(null);
                }
              }}
            />
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 md:flex-none">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none w-full md:w-auto px-4 md:px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer pr-10"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {isModal && (
            <button className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white border border-primary text-primary-600 rounded-xl text-sm font-bold">
              + New
            </button>
          )}
        </div>
      </div>

      {/* Voice Feedback Toast */}
      {(voiceFeedback || voiceTranscript) && (
        <div className={`mb-3 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 animate-fade-in ${voiceFeedback?.startsWith('Added') ? 'bg-green-50 text-green-700 border border-green-100' :
          voiceFeedback?.startsWith('No match') ? 'bg-orange-50 text-orange-700 border border-orange-100' :
            'bg-blue-50 text-blue-700 border border-blue-100'
          }`}>
          {isVoiceListening && <Mic size={16} className="animate-pulse" />}
          <span>{voiceTranscript || voiceFeedback}</span>
        </div>
      )}

      {/* Product List Body - Modern Card Design */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 px-1">
        {filteredProducts.map((product, index) => {
          const price = activeBill.billingType === 'DP' ? product.dp : product.mrp;
          const itemInBill = activeBill.items.find(i => i.id === product.id);
          const quantity = itemInBill ? itemInBill.quantity : 0;
          const isHighlighted = index === highlightedProductIndex;
          const isLowStock = product.stock < 10;

          return (
            <div
              key={`${product.id}-${quantity}`}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group
                ${quantity > 0
                  ? 'bg-[#12332A]/5 border-[#12332A]/20 ring-1 ring-[#12332A]/10'
                  : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                } 
                ${isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''}
              `}
              onClick={() => handleAddItem(product.id)}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Product Info */}
                <div className="flex-1 min-w-0">
                  {/* Product Name */}
                  <div className={`font-semibold text-sm truncate mb-2 ${quantity > 0 ? 'text-[#12332A]' : 'text-gray-800'}`}>
                    {product.name}
                  </div>

                  {/* Pricing Row - Clean badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* DP Price - Primary */}
                    <div className="bg-[#D4F34A]/30 text-[#12332A] font-bold text-sm px-2.5 py-1 rounded-lg">
                      DP ₹{product.dp}
                    </div>

                    {/* SP Badge - Prominent */}
                    <div className="bg-amber-100 text-amber-700 font-bold text-xs px-2 py-1 rounded-lg">
                      SP {product.sp}
                    </div>

                    {/* MRP - Visible badge */}
                    <div className="bg-gray-100 text-gray-600 font-medium text-xs px-2 py-1 rounded-lg">
                      MRP ₹{product.mrp}
                    </div>

                    {/* Stock Indicator */}
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${isLowStock
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-500'
                      }`}>
                      {product.stock} pcs
                    </div>
                  </div>
                </div>

                {/* Right: Action Controls */}
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  {quantity > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm">
                        <button
                          onClick={() => quantity === 1 ? handleRemoveItem(product.id) : handleUpdateQuantity(product.id, -1)}
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-dark hover:bg-gray-50 rounded-l-xl transition-colors font-bold text-lg"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          defaultValue={quantity}
                          key={`${product.id}-${quantity}`}
                          onChange={(e) => {
                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (val >= 0 && val !== quantity) {
                              handleSetQuantity(product.id, val);
                            }
                            setFocusedQtyId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          ref={(el) => {
                            if (focusedQtyId === product.id && el) {
                              el.focus();
                              el.select();
                            }
                          }}
                          className="w-10 text-center font-bold text-dark text-sm bg-transparent outline-none border-none"
                        />
                        <button
                          onClick={() => handleAddItem(product.id)}
                          className="w-9 h-9 flex items-center justify-center text-[#12332A] hover:bg-[#D4F34A]/20 rounded-r-xl transition-colors font-bold text-lg"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(product.id)}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddItem(product.id)}
                      className="w-10 h-10 flex items-center justify-center bg-[#D4F34A] text-[#12332A] rounded-xl hover:bg-[#BCE32D] transition-colors shadow-sm"
                    >
                      <Plus size={20} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModal && (
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mt-4 md:mt-6 pt-4 border-t border-gray-100 shrink-0">
          <div className="text-primary-600 font-medium text-sm">
            <div className="text-xs md:text-sm">Show {activeBill.items.length} Items Selected</div>
            <div className="text-dark font-bold text-lg md:text-xl">Total: ₹{activeBill.totalAmount.toLocaleString()}</div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddProductOpen(false)}
              className="flex-1 md:flex-none px-6 py-3 md:py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setIsAddProductOpen(false)}
              className="flex-1 md:flex-none px-8 py-3 md:py-2.5 rounded-xl bg-dark text-white font-bold hover:bg-dark-light shadow-lg hover:shadow-xl transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )
      }
    </div >
  );

  return (
    <div className="h-full relative overflow-hidden">
      <style>{animationStyles}</style>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-dark/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl flex flex-col animate-modal-in">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-dark">{capturedImage ? 'Review Photo' : 'Take Photo'}</h3>
              <button
                onClick={closeCameraModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="relative bg-black aspect-video">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="p-4 flex gap-3">
              {capturedImage ? (
                <>
                  <button
                    onClick={retakePhoto}
                    disabled={isCapturing}
                    className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Retake
                  </button>
                  <button
                    onClick={savePhoto}
                    disabled={isCapturing}
                    className="flex-1 py-3 rounded-xl bg-primary text-dark font-bold hover:bg-primary-hover shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCapturing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={20} />
                        Done
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={closeCameraModal}
                    className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="flex-1 py-3 rounded-xl bg-primary text-dark font-bold hover:bg-primary-hover shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Camera size={20} />
                    Capture Photo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Quantity Picker Modal */}
      {pendingPickerItem && (
        <div className="fixed inset-0 bg-dark/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md flex flex-col animate-modal-in">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-dark">Set Pending Status</h3>
                <p className="text-xs text-gray-500 mt-0.5">{pendingPickerItem.name}</p>
              </div>
              <button
                onClick={() => setPendingPickerItem(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSetPendingQuantity(pendingPickerItem.id, 0)}
                  className="py-3 px-4 bg-primary text-dark font-bold rounded-xl hover:bg-primary-hover transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  All Given
                </button>
                <button
                  onClick={() => handleSetPendingQuantity(pendingPickerItem.id, pendingPickerItem.quantity)}
                  className="py-3 px-4 bg-orange-100 text-orange-600 font-bold rounded-xl hover:bg-orange-200 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <AlertCircle size={18} />
                  All Pending
                </button>
              </div>

              {/* Number Grid for Partial Pending */}
              {pendingPickerItem.quantity > 1 && (
                <>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Or select pending quantity:</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                    {Array.from({ length: pendingPickerItem.quantity }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        onClick={() => handleSetPendingQuantity(pendingPickerItem.id, num)}
                        className={`py-3 px-2 rounded-xl font-bold transition-all ${pendingPickerItem.pendingQuantity === num
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal Overlay */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md animate-modal-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-dark flex items-center gap-2">
                <UserPlus className="text-primary-600" /> Add New Customer
              </h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Enter customer name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    placeholder="Enter phone number"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomer}
                className="flex-1 py-3 rounded-xl font-bold bg-dark text-white hover:bg-dark-light shadow-lg hover:shadow-xl transition-all"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal/Drawer (Works on BOTH Mobile AND Desktop) */}
      <div className={`fixed inset-0 bg-dark/30 backdrop-blur-sm z-[150] flex items-end lg:items-center justify-center p-0 lg:p-6 transition-all duration-300 ${isAddProductOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`w-full lg:max-w-4xl h-[90vh] lg:h-[85vh] lg:rounded-3xl transform transition-transform duration-300 ease-out-expo ${isAddProductOpen ? 'translate-y-0 lg:scale-100' : 'translate-y-full lg:scale-95 lg:translate-y-0'}`}>
          {renderProductContent(true)}
        </div>
      </div>

      {/* Main Content Wrapper (Animated) */}
      <div className={`flex flex-col h-full gap-4 transform transition-transform duration-300 ease-mountain ${showPaymentModal ? '-translate-x-full' : 'translate-x-0'}`}>
        {/* Tab Navigation */}


        {/* Main Layout: Left Panel (Bill Items) + Right Panel (Controls) */}
        <div className="flex-1 flex gap-6 overflow-hidden">

          {/* Left Side Panel - Bill Items Table (Full Width on Mobile, ~70% on Desktop) */}
          <div className="flex flex-1 flex-col gap-4 md:gap-6 h-full min-w-0 animate-slide-up opacity-0 [animation-delay:100ms]">




            {/* Customer Search - Mobile Only - Separate Card */}
            <div className="lg:hidden bg-white rounded-3xl shadow-sm p-3 flex items-center gap-3" ref={searchWrapperRef}>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="text"
                  placeholder="Search Customer..."
                  className="w-full bg-transparent border-none pl-11 pr-4 py-2 text-sm font-medium text-dark placeholder:text-gray-400 focus:outline-none"
                  value={activeBill.customerName}
                  onFocus={() => setIsCustomerSearchOpen(true)}
                  onChange={(e) => {
                    updateActiveBill({ customerName: e.target.value });
                    setIsCustomerSearchOpen(true);
                    setHighlightedCustomerIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedCustomerIndex(prev =>
                        prev < customerSuggestions.length - 1 ? prev + 1 : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedCustomerIndex(prev =>
                        prev > 0 ? prev - 1 : customerSuggestions.length - 1
                      );
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (highlightedCustomerIndex >= 0 && customerSuggestions[highlightedCustomerIndex]) {
                        updateActiveBill({ customerName: customerSuggestions[highlightedCustomerIndex].name });
                        setIsCustomerSearchOpen(false);
                        setHighlightedCustomerIndex(-1);
                        (e.target as HTMLInputElement).blur();
                      }
                    } else if (e.key === 'Escape') {
                      setIsCustomerSearchOpen(false);
                      setHighlightedCustomerIndex(-1);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
                {/* Suggestions Dropdown */}
                {isCustomerSearchOpen && activeBill.customerName && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-60 overflow-y-auto">
                    {customerSuggestions.length > 0 ? (
                      customerSuggestions.slice(0, 5).map((c, index) => (
                        <div
                          key={c.id}
                          className={`px-4 py-3 cursor-pointer flex justify-between items-center ${index === highlightedCustomerIndex ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            updateActiveBill({ customerName: c.name });
                            setIsCustomerSearchOpen(false);
                          }}
                          onClick={() => {
                            updateActiveBill({ customerName: c.name });
                            setIsCustomerSearchOpen(false);
                          }}
                        >
                          <span className="font-medium text-sm text-dark">{c.name}</span>
                          <span className="text-xs text-gray-500">{c.phone}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-400">No customers found</div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsAddCustomerOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors active:scale-95"
                title="Add Customer"
              >
                <UserPlus size={20} strokeWidth={1.5} />
              </button>

              {/* DP/MRP Toggle - Mobile */}
              <Switch
                name="pricing-mode-mobile"
                size="small"
                value={activeBill.billingType}
                onChange={(value) => handlePricingModeChange(value as BillingType)}
              >
                <Switch.Control label="DP" value="DP" activeClassName="bg-[#D4F34A] text-[#12332A] shadow-[0_0_10px_rgba(212,243,74,0.4)] border border-[#BCE32D]" />
                <Switch.Control label="MRP" value="MRP" activeClassName="bg-red-50 text-red-600 shadow-[0_0_10px_rgba(239,68,68,0.2)] border border-red-100" />
              </Switch>
            </div>

            {/* Desktop Customer Search Bar - Above Items */}
            <div className="hidden lg:block mb-4">
              <CustomerSearchBar
                value={activeBill.customerName}
                onChange={(name) => updateActiveBill({ customerName: name })}
                customers={customers}
                onAddNew={() => setIsAddCustomerOpen(true)}
              />
            </div>

            {/* Table Area */}
            <div className={`bg-white rounded-3xl shadow-sm flex-1 flex flex-col overflow-hidden p-4 md:p-6 relative transition-all duration-300`}>

              <div ref={listContainerRef} className="overflow-y-auto flex-1 pb-24 md:pb-2">

                {/* Mobile Column View - Compact & Horizontal */}
                <div className="md:hidden bill-items-container">
                  {activeBill.items.map((item, index) => (
                    <div
                      key={item.id}
                      className={`relative bg-white rounded-2xl p-3 mb-2.5 border border-gray-100 shadow-sm transition-all
                        ${exitingItems.has(item.id) ? 'bill-item-exit' : ''}
                        ${justAddedId === item.id ? 'bill-item-enter ring-2 ring-primary/20' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {/* Left: Serial Number */}
                        <div className="flex-shrink-0 self-center">
                          <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center text-xs font-bold border border-gray-100">
                            {index + 1}
                          </div>
                        </div>

                        {/* Center: Product Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="font-bold text-gray-900 text-sm leading-tight mb-1 truncate pr-2">{item.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400">
                            <span className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-500 border border-gray-100">DP {item.dp}</span>
                            <span className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-500 border border-gray-100">SP {item.totalSp}</span>
                          </div>
                        </div>

                        {/* Right: Controls & Total */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {/* Price & Delete Row */}
                          <div className="flex items-center gap-2">
                            <div className="font-extrabold text-gray-900 text-base leading-none">
                              ₹{item.currentPrice * item.quantity}
                            </div>
                          </div>

                          {/* Quantity Editor - Prominent & Large */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 h-9">
                              <button
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                className="w-9 h-full flex items-center justify-center text-gray-600 hover:text-dark hover:bg-gray-50 active:bg-gray-100 rounded-l-lg transition-colors text-lg"
                              >
                                −
                              </button>
                              <span className="min-w-[1.5rem] text-center font-bold text-dark text-sm pt-0.5">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="w-9 h-full flex items-center justify-center text-gray-600 hover:text-dark hover:bg-gray-50 active:bg-gray-100 rounded-r-lg transition-colors text-lg"
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Product Button - Mobile */}
                  <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="w-full mt-2 py-4 border-2 border-dashed border-gray-400 rounded-xl text-dark hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-wide"
                  >
                    <Plus size={18} /> Add Item
                  </button>
                </div>

                {/* Desktop Table View - Clean Modern Design */}
                <div className="hidden md:block overflow-y-auto pr-2 no-scrollbar h-full">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead className="text-gray-400 text-[10px] uppercase font-bold sticky top-0 bg-white z-10">
                      <tr>
                        <th className="pb-3 pl-4 w-12 text-center tracking-widest">#</th>
                        <th className="pb-3 pl-3 text-left tracking-widest">Product</th>
                        <th className="pb-3 text-center w-32 tracking-widest">Qty</th>
                        <th className="pb-3 text-right w-24 tracking-widest">Price</th>
                        <th className="pb-3 text-center w-20 tracking-widest">SP</th>
                        <th className="pb-3 text-center w-24 tracking-widest">Status</th>
                        <th className="pb-3 text-right w-28 tracking-widest">Total</th>
                        <th className="pb-3 text-center w-14 tracking-widest"></th>
                      </tr>
                    </thead>
                    <tbody className="bill-items-container">
                      {activeBill.items.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`group text-xs transition-all duration-300 ease-spring
                            ${exitingItems.has(item.id) ? 'bill-item-exit' : ''} 
                            ${justAddedId === item.id ? 'bill-item-enter' : ''}
                          `}
                        >
                          {/* Sr No Column */}
                          <td className="p-0 rounded-l-2xl shadow-sm border border-r-0 border-gray-100 bg-white group-hover:shadow-md group-hover:border-gray-200 transition-all text-center align-middle relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="font-bold text-gray-400 text-[10px] group-hover:text-primary transition-colors">{index + 1}</span>
                          </td>

                          {/* Product Column */}
                          <td className="p-3 border-y border-gray-100 bg-white shadow-sm group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle">
                            <span className="font-bold text-dark text-xs uppercase tracking-wide block leading-snug group-hover:text-primary-700 transition-colors">{item.name}</span>
                          </td>

                          {/* Quantity Column */}
                          <td className="p-1 border-y border-gray-100 bg-white shadow-sm group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <div className="flex items-center bg-gray-50 border border-gray-100 rounded-lg h-8 px-1 group-hover:border-gray-200 transition-colors">
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, -1)}
                                  className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-dark hover:bg-white rounded transition-all active:scale-90"
                                >
                                  <span className="text-base font-bold">−</span>
                                </button>
                                <span className="w-8 text-center font-bold text-dark text-xs">{item.quantity}</span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, 1)}
                                  className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-dark hover:bg-white rounded transition-all active:scale-90"
                                >
                                  <span className="text-base font-bold">+</span>
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Price Column */}
                          <td className="p-3 text-right border-y border-gray-100 bg-white shadow-sm group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle">
                            <span className="text-gray-500 text-xs font-semibold tracking-tight">₹{item.currentPrice}</span>
                          </td>

                          {/* SP Column */}
                          <td className="p-3 text-center border-y border-gray-100 bg-white shadow-sm group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle">
                            <span className="text-primary-600 font-bold text-xs bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 group-hover:bg-primary/10 transition-colors">{item.totalSp}</span>
                          </td>

                          {/* Status Column */}
                          <td className="p-3 text-center border-y border-gray-100 bg-white shadow-sm group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle">
                            <button
                              onClick={() => handleStatusChange(item.id)}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 mx-auto w-full ${item.status === ProductStatus.GIVEN
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'
                                }`}
                            >
                              {item.status === ProductStatus.GIVEN ? (
                                <>
                                  <Check size={12} strokeWidth={3} />
                                  Given
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={12} strokeWidth={3} />
                                  {item.pendingQuantity ? `${item.pendingQuantity} Pending` : 'Pending'}
                                </>
                              )}
                            </button>
                          </td>

                          {/* Total Column */}
                          <td className="p-3 text-right border-y border-gray-100 bg-white shadow-sm group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle">
                            <span className="font-extrabold text-dark text-sm tracking-tight">₹{item.currentPrice * item.quantity}</span>
                          </td>

                          {/* Delete Action Column */}
                          <td className="p-2 rounded-r-2xl shadow-sm border border-l-0 border-gray-100 bg-white group-hover:shadow-md group-hover:border-gray-200 transition-all align-middle text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="w-8 h-8 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all active:scale-90 mx-auto"
                              title="Remove Item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}

                    </tbody>
                  </table>

                  {/* Add Products Buttons - Desktop */}
                  <div className="flex gap-3 mt-6">
                    {/* Regular Add Button */}
                    <button
                      onClick={() => setIsAddProductOpen(true)}
                      className="flex-1 py-5 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3 font-bold text-sm uppercase tracking-wider group"
                    >
                      <div className="p-2 bg-gray-50 rounded-full group-hover:bg-primary/10 transition-colors text-inherit">
                        <Plus size={18} />
                      </div>
                      Add Items
                    </button>


                  </div>
                  {/* Bottom spacer for scroll */}
                  <div className="h-6"></div>

                </div>
              </div>
            </div>

            {/* Footer Summary - Tablet Only (Hidden on Mobile and Large Desktop) */}
            <div className="hidden md:block lg:hidden mt-auto border-t border-gray-100 bg-white z-20 sticky bottom-0 md:relative">
              <div className="p-4 md:p-6 space-y-4 md:space-y-6">

                {/* Top Row: Payment & Stats */}
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">

                  {/* Payment Controls Group */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateActiveBill({ isPaid: !activeBill.isPaid })}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeBill.isPaid
                        ? 'bg-dark text-white shadow-md shadow-dark/20'
                        : 'bg-red-50 text-red-500 border border-red-100'
                        }`}
                    >
                      {activeBill.isPaid ? <Check size={14} /> : <AlertCircle size={14} />}
                      {activeBill.isPaid ? 'Paid' : 'Unpaid'}
                    </button>

                    <div className="relative flex-1 md:flex-none">
                      <select
                        value={activeBill.paymentMethod}
                        onChange={(e) => updateActiveBill({ paymentMethod: e.target.value as PaymentMethod })}
                        className="w-full appearance-none pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold uppercase tracking-wide text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                      >
                        {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Summary Stats Group */}
                  <div className="flex items-center justify-between md:justify-end gap-6 md:gap-8 border-t md:border-t-0 border-dashed border-gray-200 pt-3 md:pt-0">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Total SP</span>
                      <span className="text-sm font-bold text-primary-600 bg-primary/10 px-2 py-0.5 rounded-lg">
                        {activeBill.totalSp}
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Total Items</span>
                      <span className="text-sm font-bold text-gray-700">
                        {activeBill.items.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    </div>

                    <div className="flex flex-col items-end pl-6 border-l border-gray-100">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Net Total</span>
                      <span className="text-2xl font-bold text-dark leading-none">
                        ₹{activeBill.totalAmount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex gap-3">
                  {/* Snapshot Button */}
                  <div className="relative" ref={snapshotMenuRef}>
                    <button
                      onClick={() => setShowSnapshotMenu(!showSnapshotMenu)}
                      disabled={isCapturing}
                      className="w-14 h-14 bg-white border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-dark rounded-2xl transition-all flex items-center justify-center disabled:opacity-50"
                      title="Attach Snapshot"
                    >
                      {isCapturing ? (
                        <div className="w-5 h-5 border-2 border-dark border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera size={22} />
                      )}
                    </button>

                    {/* Dropdown Menu */}
                    {showSnapshotMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[180px] animate-scale-in">
                        <button
                          onClick={handleCameraClick}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm font-bold text-gray-700"
                        >
                          <Camera size={18} className="text-primary-600" />
                          Camera
                        </button>
                        <button
                          onClick={handleGalleryClick}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm font-bold text-gray-700 border-t border-gray-50"
                        >
                          <ImageIcon size={18} className="text-primary-600" />
                          Gallery
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to cancel? This will clear the current bill.')) {
                        setTabs(prev => {
                          if (prev.length === 1) {
                            // Reset the single tab
                            return [{
                              id: '1',
                              title: 'Bill #1',
                              bill: {
                                id: '#1',
                                customerName: '',
                                customerPhone: '',
                                items: [],
                                totalAmount: 0,
                                totalSp: 0,
                                billingType: store.getSettings().defaultBillingMode || 'DP',
                                date: new Date().toISOString().split('T')[0],
                                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                                isPaid: false,
                                paymentMethod: PaymentMethod.CASH,
                                hasSnapshot: false
                              }
                            }];
                          }
                          // Remove current tab
                          const newTabs = prev.filter(t => t.id !== activeTabId);
                          // Select the last remaining tab
                          setActiveTabId(newTabs[newTabs.length - 1].id);
                          return newTabs;
                        });
                      }
                    }}
                    className="w-14 h-14 md:w-auto md:h-auto md:px-6 md:py-3 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border border-red-100"
                    title="Cancel Bill"
                  >
                    <X size={22} />
                    <span className="hidden md:inline">Cancel</span>
                  </button>

                  {/* Generate Bill Button */}
                  <InteractiveHoverButton
                    onClick={handleGenerateBill}
                    text={activeBill.id.startsWith('#') ? 'Update Bill' : 'Generate Bill'}
                    className="flex-1 w-full bg-primary hover:bg-primary-hover text-dark border-primary py-3 rounded-2xl md:text-lg"
                  />
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture
                  onChange={handleImageCapture}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageCapture}
                  className="hidden"
                />
              </div>
            </div>

            {/* Footer Summary - Mobile View Only - Redesigned */}
            <div className="md:hidden mt-auto z-20 sticky bottom-0 pb-4 pt-3 px-4">
              {/* Stats Row - Inline */}
              <div className="flex items-center justify-center gap-6 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium">Total SP:</span>
                  <span className="text-xl font-bold text-dark">{activeBill.totalSp}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium">Grand Total:</span>
                  <span className="text-xl font-bold text-dark">₹{activeBill.totalAmount}</span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="w-[56px] h-[56px] bg-red-50 hover:bg-red-100 text-red-500 rounded-2xl transition-all active:scale-[0.95] flex items-center justify-center border border-red-100"
                >
                  <Trash2 size={24} />
                </button>
                <button
                  onClick={() => setShowProductStatusModal(true)}
                  className="flex-1 h-[56px] bg-primary hover:bg-primary-hover text-dark font-bold rounded-2xl shadow-md shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                >
                  Check Product Status
                  <span className="text-xl">→</span>
                </button>
              </div>
            </div>

          </div>

          {/* Right Side Panel - Control Panel (Large Desktop Only) */}
          <div className="hidden lg:flex w-[300px] xl:w-[340px] flex-col h-full bg-white rounded-2xl shadow-sm p-5 animate-slide-up opacity-0 [animation-delay:200ms] overflow-y-auto shrink-0">

            {/* Pricing Mode Section */}
            <div className="py-5 space-y-3 border-b border-gray-100 shrink-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pricing Mode</label>
              <Switch
                name="pricing-mode-desktop"
                size="medium"
                style={{ width: '100%' }}
                value={activeBill.billingType}
                onChange={(value) => handlePricingModeChange(value as BillingType)}
              >
                <Switch.Control label="DP (Distributor)" value="DP" activeClassName="bg-[#D4F34A] text-[#12332A] shadow-[0_0_15px_rgba(212,243,74,0.5)] border border-[#BCE32D]" />
                <Switch.Control label="MRP (Retail)" value="MRP" activeClassName="bg-red-50 text-red-600 shadow-[0_0_15px_rgba(239,68,68,0.25)] border border-red-100" />
              </Switch>
            </div>

            {/* Payment Controls - Clean Modern Design */}
            <div className="py-5 space-y-4 border-b border-gray-100 shrink-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment</label>

              {/* Status Toggle - Modern pill design */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => updateActiveBill({ isPaid: false })}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${!activeBill.isPaid
                    ? 'bg-white text-red-500 shadow-sm ring-1 ring-red-100'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <AlertCircle size={13} />
                  Unpaid
                </button>
                <button
                  onClick={() => updateActiveBill({ isPaid: true })}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeBill.isPaid
                    ? 'bg-[#12332A] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <Check size={13} />
                  Paid
                </button>
              </div>

              {/* Split Payment Inputs - Cash & Online */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Cash</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                      <input
                        type="number"
                        value={activeBill.cashAmount || 0}
                        onChange={(e) => {
                          const cashVal = Math.max(0, parseFloat(e.target.value) || 0);
                          const remaining = Math.max(0, activeBill.totalAmount - cashVal);
                          updateActiveBill({
                            cashAmount: cashVal,
                            onlineAmount: remaining,
                            paymentMethod: cashVal > 0 ? PaymentMethod.CASH : PaymentMethod.ONLINE
                          });
                        }}
                        className="w-full pl-7 pr-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Online</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                      <input
                        type="number"
                        value={activeBill.onlineAmount || 0}
                        onChange={(e) => {
                          const onlineVal = Math.max(0, parseFloat(e.target.value) || 0);
                          const remaining = Math.max(0, activeBill.totalAmount - onlineVal);
                          updateActiveBill({
                            onlineAmount: onlineVal,
                            cashAmount: remaining,
                            paymentMethod: onlineVal > 0 && remaining === 0 ? PaymentMethod.ONLINE : PaymentMethod.CASH
                          });
                        }}
                        className="w-full pl-7 pr-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Fill Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => updateActiveBill({ cashAmount: activeBill.totalAmount, onlineAmount: 0, paymentMethod: PaymentMethod.CASH })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${(activeBill.cashAmount || 0) === activeBill.totalAmount && activeBill.totalAmount > 0
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                  >
                    All Cash
                  </button>
                  <button
                    onClick={() => updateActiveBill({ cashAmount: 0, onlineAmount: activeBill.totalAmount, paymentMethod: PaymentMethod.ONLINE })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${(activeBill.onlineAmount || 0) === activeBill.totalAmount && activeBill.totalAmount > 0
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                  >
                    All Online
                  </button>
                </div>

                {/* Validation Message */}
                {activeBill.totalAmount > 0 && (activeBill.cashAmount || 0) + (activeBill.onlineAmount || 0) !== activeBill.totalAmount && (
                  <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertCircle size={14} />
                    Split amounts don't match total (₹{activeBill.totalAmount})
                  </div>
                )}
              </div>
            </div>

            {/* Summary Section - Modern Finance Style */}
            <div className="mt-auto pt-5 space-y-5 shrink-0">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Items</span>
                  <span className="text-lg font-bold text-gray-800">{activeBill.items.reduce((a, b) => a + b.quantity, 0)}</span>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total SP</span>
                  <span className="text-lg font-bold text-primary-700">{activeBill.totalSp}</span>
                </div>
              </div>

              {/* Net Total - Hero Display */}
              <div className="bg-[#12332A] rounded-2xl p-5 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Net Amount</span>
                <span className="text-4xl font-black text-white tracking-tight">₹{activeBill.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions Section */}
            <div className="pt-5 flex flex-col gap-3 shrink-0">
              {/* Generate Bill Button - Primary */}
              <button
                onClick={handleGenerateBill}
                className="w-full bg-[#D4F34A] hover:bg-[#BCE32D] text-[#12332A] font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-[0_0_25px_rgba(212,243,74,0.4)] transition-all flex justify-center items-center gap-2.5 text-base transform active:scale-[0.98]"
              >
                <Receipt size={20} />
                {activeBill.id.startsWith('#') ? 'Update Bill' : 'Generate Bill'}
              </button>

              {/* Cancel Button - Subtle Link */}
              <button
                onClick={handleCancel}
                className="w-full py-2.5 text-gray-400 hover:text-red-500 font-medium text-sm transition-colors"
              >
                Clear & Start Over
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture onChange={handleImageCapture} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageCapture} className="hidden" />
          </div>

        </div>

      </div>
      {/* Product Status Check Modal (New Mobile Flow) */}
      <div className={`fixed inset-0 pb-[80px] bg-white z-[50] flex flex-col md:hidden transform transition-transform duration-300 ease-out-expo ${showProductStatusModal ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-5 py-4 flex items-center gap-4 bg-white border-b border-gray-100">
          <button
            onClick={() => setShowProductStatusModal(false)}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
          >
            <ChevronDown className="rotate-90" size={24} strokeWidth={2} />
          </button>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Check Product Status</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 space-y-4">
          <div className="text-sm text-gray-500 font-medium mb-2">
            Verify items before payment.
          </div>

          {activeBill.items.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex-1">
                <div className="font-bold text-dark text-sm mb-1">{item.name}</div>
                <div className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded-md inline-block border border-gray-200">
                  Qty: {item.quantity}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Partial/Edit Button for Multi-Qty Items */}
                {item.quantity > 1 && (
                  <button
                    onClick={() => handleStatusChange(item.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
                    title="Edit Pending Quantity"
                  >
                    <Edit2 size={16} />
                  </button>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <span className={`text-xs font-bold uppercase tracking-wider ${item.status === ProductStatus.GIVEN ? 'text-emerald-600' : 'text-orange-500'}`}>
                    {item.status === ProductStatus.GIVEN ? 'Given' : `${item.pendingQuantity || item.quantity} Pending`}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={item.status === ProductStatus.GIVEN}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        // Toggle between Given (0 pending) and Pending (Full pending)
                        if (isChecked) {
                          handleSetPendingQuantity(item.id, 0);
                        } else {
                          // Default to full pending when unchecking
                          handleSetPendingQuantity(item.id, item.quantity);
                        }
                      }}
                    />
                    <div className={`w-12 h-7 rounded-full transition-colors duration-200 ease-in-out flex items-center px-1 ${item.status === ProductStatus.GIVEN ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${item.status === ProductStatus.GIVEN ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-gray-100 bg-white flex gap-3 z-10 safe-area-bottom">
          <button
            onClick={() => {
              setShowProductStatusModal(false);
              setShowPaymentModal(true);
            }}
            className="flex-1 bg-primary hover:bg-primary-hover text-dark font-bold py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg tracking-wide"
          >
            Add Payment Info
            <span className="text-xl">→</span>
          </button>
        </div>
      </div>

      {/* Payment Modal Window (Mobile Only) */}
      <div className={`fixed inset-0 pb-[80px] bg-white z-[50] flex flex-col md:hidden transform transition-transform duration-300 ease-out-expo ${showPaymentModal ? (showInvoiceModal ? '-translate-x-full' : 'translate-x-0') : 'translate-x-full'}`}>
        {/* Header - Clean & Minimal */}
        <div className="px-5 py-4 flex items-center gap-4 bg-white">
          <button
            onClick={() => setShowPaymentModal(false)}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
          >
            <ChevronDown className="rotate-90" size={24} strokeWidth={2} />
          </button>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Payment Details</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-8">
          {/* Bill Summary - Business Grade Typography */}
          <div className="mt-2">
            <div className="text-center mb-6">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Net Payable Amount</span>
              <div className="text-[2.75rem] font-bold text-gray-900 mt-1 tracking-tight">₹{activeBill.totalAmount.toLocaleString()}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex flex-col items-center justify-center border-r border-gray-200 border-dashed">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Items</span>
                <span className="text-lg font-bold text-gray-700">{activeBill.items.reduce((a, b) => a + b.quantity, 0)}</span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total SP</span>
                <span className="text-lg font-bold text-primary-700">{activeBill.totalSp}</span>
              </div>
            </div>
          </div>

          {/* Payment Status - Modern Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 block">Payment Status</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateActiveBill({ isPaid: false })}
                className={`py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 border flex items-center justify-center gap-2 ${!activeBill.isPaid
                  ? 'border-red-200 bg-red-50 text-red-700 ring-1 ring-red-200 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
              >
                {!activeBill.isPaid && <div className="w-2 h-2 rounded-full bg-red-500" />}
                Unpaid
              </button>
              <button
                onClick={() => updateActiveBill({ isPaid: true })}
                className={`py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 border flex items-center justify-center gap-2 ${activeBill.isPaid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
              >
                {activeBill.isPaid && <Check size={16} strokeWidth={3} />}
                Paid
              </button>
            </div>
          </div>

          {/* Split Payment - Cash & Online Inputs */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 block">Payment Split</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Cash</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={activeBill.cashAmount || 0}
                    onChange={(e) => {
                      const cashVal = Math.max(0, parseFloat(e.target.value) || 0);
                      const remaining = Math.max(0, activeBill.totalAmount - cashVal);
                      updateActiveBill({
                        cashAmount: cashVal,
                        onlineAmount: remaining,
                        paymentMethod: cashVal > 0 ? PaymentMethod.CASH : PaymentMethod.ONLINE
                      });
                    }}
                    className="w-full pl-8 pr-3 py-3.5 bg-green-50 border border-green-200 rounded-xl text-base font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Online</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={activeBill.onlineAmount || 0}
                    onChange={(e) => {
                      const onlineVal = Math.max(0, parseFloat(e.target.value) || 0);
                      const remaining = Math.max(0, activeBill.totalAmount - onlineVal);
                      updateActiveBill({
                        onlineAmount: onlineVal,
                        cashAmount: remaining,
                        paymentMethod: onlineVal > 0 && remaining === 0 ? PaymentMethod.ONLINE : PaymentMethod.CASH
                      });
                    }}
                    className="w-full pl-8 pr-3 py-3.5 bg-blue-50 border border-blue-200 rounded-xl text-base font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Quick Fill Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateActiveBill({ cashAmount: activeBill.totalAmount, onlineAmount: 0, paymentMethod: PaymentMethod.CASH })}
                className={`py-3 rounded-xl font-bold text-sm transition-all duration-200 border ${(activeBill.cashAmount || 0) === activeBill.totalAmount && activeBill.totalAmount > 0
                  ? 'bg-green-100 border-green-300 text-green-700 ring-1 ring-green-200'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
              >
                All Cash
              </button>
              <button
                onClick={() => updateActiveBill({ cashAmount: 0, onlineAmount: activeBill.totalAmount, paymentMethod: PaymentMethod.ONLINE })}
                className={`py-3 rounded-xl font-bold text-sm transition-all duration-200 border ${(activeBill.onlineAmount || 0) === activeBill.totalAmount && activeBill.totalAmount > 0
                  ? 'bg-blue-100 border-blue-300 text-blue-700 ring-1 ring-blue-200'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
              >
                All Online
              </button>
            </div>

            {/* Validation Message */}
            {activeBill.totalAmount > 0 && (activeBill.cashAmount || 0) + (activeBill.onlineAmount || 0) !== activeBill.totalAmount && (
              <div className="text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertCircle size={16} />
                Split amounts don't match total (₹{activeBill.totalAmount})
              </div>
            )}
          </div>

          {/* Attachments - Clean Minimal */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-700 block">Attachments</label>
              {activeBill.hasSnapshot && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                  <Check size={12} /> Attached
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCameraClick}
                className="py-6 border border-gray-200 border-dashed rounded-xl group hover:border-gray-300 hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-2"
              >
                <Camera size={24} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide group-hover:text-gray-700">Camera</span>
              </button>
              <button
                onClick={handleGalleryClick}
                className="py-6 border border-gray-200 border-dashed rounded-xl group hover:border-gray-300 hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-2"
              >
                <ImageIcon size={24} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide group-hover:text-gray-700">Gallery</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action - High Contrast, Prominent */}
        <div className="p-4 border-t border-gray-100 bg-white flex gap-3 z-10 safe-area-bottom">
          {/* SMS Toggle - Clean */}
          <div
            className={`flex flex-col items-center justify-center gap-1.5 px-4 rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${sendSmsEnabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}
            onClick={() => setSendSmsEnabled(!sendSmsEnabled)}
            style={{ minWidth: '84px' }}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${sendSmsEnabled
              ? 'border-emerald-500 bg-emerald-500 scale-110'
              : 'border-gray-300'}`}>
              {sendSmsEnabled && <Check size={12} className="text-white" strokeWidth={3} />}
            </div>
            <span className="font-bold text-[10px] tracking-wider uppercase">SMS</span>
          </div>

          <button
            onClick={handleGenerateBill}
            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg tracking-wide"
          >
            <Receipt size={22} className="text-white/80" />
            {activeBill.id.startsWith('#') ? 'Update Bill' : 'Generate Bill'}
          </button>
        </div>
      </div>


      {/* Invoice Modal */}
      {
        showInvoiceModal && (
          <InvoiceModal
            bill={previewBill || activeBill}
            onClose={() => {
              setShowInvoiceModal(false);
              setShowPaymentModal(false);
            }}
            onEdit={() => {
              if (previewBill) {
                const restoredTab = {
                  id: previewBill.id,
                  title: previewBill.customerName || `Bill ${previewBill.id}`,
                  bill: previewBill
                };

                setTabs(prev => {
                  // If the only tab is the default empty one (Bill #1), replace it
                  if (prev.length === 1 && prev[0].id === '1' && prev[0].bill.items.length === 0 && !prev[0].bill.customerName) {
                    return [restoredTab];
                  }
                  // Prevent duplicate tabs
                  if (prev.some(t => t.id === restoredTab.id)) {
                    return prev.map(t => t.id === restoredTab.id ? restoredTab : t);
                  }
                  return [...prev, restoredTab];
                });
                setActiveTabId(previewBill.id);
              }
              setShowInvoiceModal(false);
              setShowInvoiceModal(false);
              setShowPaymentModal(false);
            }}
            /* Pass a prop to indicate it should act as a full page slide */
            isFullScreenSlide={true}
          />
        )
      }
      {/* Quick Search Modal */}
      <ProductQuickSearch
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        products={products}
        onSelectProduct={(product) => handleAddItem(product.id)}
      />
    </div>
  );
};

export default Billing;