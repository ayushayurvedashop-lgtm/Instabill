import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, AlertCircle, ShoppingCart, Receipt, UserPlus, User, Phone, Plus, Camera, Image as ImageIcon, ChevronDown, ChevronUp, Trash2, Mic, Edit2, Package, ArrowRight, CheckCircle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tab, Bill, BillItem, ProductStatus, PaymentMethod, BillingType, Product } from '../types';
import { EMPTY_BILL } from '../constants';
import { store } from '../store';
import { storage } from '../firebaseConfig';
import { getLocalDateString } from '../lib/utils';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendBillSMS, sendBillWhatsapp } from '../services/smsService';
import { generateAndUploadInvoicePDF } from '../services/pdfService';
import { processVoiceInput } from '../services/voiceParsingService';

import { InvoiceModal } from './InvoiceModal';
import { ProductQuickSearch } from './ProductQuickSearch';

import { InteractiveHoverButton } from './ui/interactive-hover-button';
import { VoiceInput } from './ui/voice-input';
import { Switch } from './ui/multi-switch';
import CustomerSearchBar from './CustomerSearchBar';
import { ProductStatusModal } from './ProductStatusModal';
import { BillReviewModal } from './BillReviewModal';

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
  // Payment Modal Closing State
  const [isPaymentModalClosing, setIsPaymentModalClosing] = useState(false);
  const [showProductStatusModal, setShowProductStatusModal] = useState(false);
  const [showBillReviewModal, setShowBillReviewModal] = useState(false);

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

  // Quantity Input Refs for auto-focus
  const productQtyRefs = useRef<{ [key: string]: HTMLInputElement }>({});

  // Category Scroll Logic
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState({ showLeft: false, showRight: true });

  // Mobile Product Status Drawer State
  const [statusDrawerItemId, setStatusDrawerItemId] = useState<string | null>(null);

  // Mobile Customer Search UI State
  const [isMobileCustomerSearchOpen, setIsMobileCustomerSearchOpen] = useState(false);

  const handleCategoryScrollProgress = useCallback(() => {
    if (!categoryScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
    setScrollPosition({
      showLeft: scrollLeft > 10,
      showRight: scrollLeft + clientWidth < scrollWidth - 10
    });
  }, []);

  const handleCategoryScroll = (direction: 'left' | 'right') => {
    if (!categoryScrollRef.current) return;
    const scrollAmount = direction === 'left' ? -200 : 200;
    categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const closePaymentModal = () => {
    setIsPaymentModalClosing(true);
    setTimeout(() => {
      setShowPaymentModal(false);
      setIsPaymentModalClosing(false);
    }, 200); // Duration matches CSS animation
  };

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

  // Initial scroll check
  useEffect(() => {
    if (isAddProductOpen) {
      setTimeout(handleCategoryScrollProgress, 100);
    }
  }, [isAddProductOpen, handleCategoryScrollProgress]);

  // Global key listener for auto-focusing search in Add Items modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if we should allow shortcuts:
      // 1. Add Product Modal is open OR
      // 2. We are on Desktop (side panel visible) AND no other blocking modals are open
      const isDesktop = window.innerWidth >= 1024;
      const isBlockingModalOpen = isAddCustomerOpen || showPaymentModal || showInvoiceModal || showCameraModal || showProductStatusModal;

      const shouldAllowShortcuts = isAddProductOpen || (isDesktop && !isBlockingModalOpen && !isBlockingModalOpen); // Double check not needed but for clarity

      if (!shouldAllowShortcuts) return;

      // Ignore if modifier keys are pressed (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore if target is the search input itself
      if (e.target === productSearchRef.current) return;

      // If target is an input (like quantity or customer search)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // If it's a number key (0-9) or Numpad numbers, allow it for quantity
        // Also allow backspace/delete/arrows for editing
        if (/^[0-9]$/.test(e.key) ||
          e.code.startsWith('Numpad') ||
          ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
          // If Enter is pressed in another input (like quantity), we might want to keep default behavior (submitting form or moving focus)
          // But our logic below handles Enter for adding items from list. 
          // If we are in a quantity input, we probably want to let the user finish typing.
          return;
        }

        // If typing in a text-based input (Customer Search, Notes, etc.), DO NOT hijack for product search
        if (e.target instanceof HTMLTextAreaElement) return;

        if (e.target instanceof HTMLInputElement) {
          const textInputTypes = ['text', 'tel', 'email', 'search', 'password'];
          if (textInputTypes.includes(e.target.type)) {
            return;
          }
          // Note: If we are in 'number' (quantity) or other types, we allow the A-Z hijack
        }
      }

      // Check if it's a click to search (A-Z)
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
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
  }, [isAddProductOpen, isAddCustomerOpen, showPaymentModal, showInvoiceModal, showCameraModal, showProductStatusModal]);

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

  // Auto-focus quantity input whenever an item is added
  useEffect(() => {
    if (focusedQtyId) {
      // 1. Try immediate focus (better for some browsers' user-gesture requirements)
      const input = productQtyRefs.current[focusedQtyId];
      if (input) {
        input.focus();
        input.select();
      }

      // 2. Fallback with slight delay to ensure React state has rendered the input
      const timer = setTimeout(() => {
        const inputLater = productQtyRefs.current[focusedQtyId];
        if (inputLater) {
          inputLater.focus();
          inputLater.select();
        }
        setFocusedQtyId(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [focusedQtyId, activeBill.items]);

  // Animation Styles

  const animationStyles = `
                          /* Simple, performant animations using only opacity & transform (GPU accelerated) */

                          @keyframes fadeIn {
                            from {opacity: 0; }
                          to {opacity: 1; }
    }

                          @keyframes fadeOut {
                            from {opacity: 1; }
                          to {opacity: 0; }
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



  // Scroll to bottom whenever items change (if auto-scroll is enabled or user is at bottom)
  useEffect(() => {
    if (listContainerRef.current) {
      const { scrollHeight, clientHeight } = listContainerRef.current;
      // Scroll to bottom logic - checking if user was already near bottom is good UX
      // But for "Chat-like" or "Bill item list", auto-scroll on add is standard.
      // We'll just scroll to bottom when justAddedId changes.
      if (justAddedId) {
        listContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
    }
  }, [activeBill.items.length, justAddedId]);

  const [isMobilePaymentDrawerOpen, setIsMobilePaymentDrawerOpen] = useState(false);
  const [isDiscountPanelOpen, setIsDiscountPanelOpen] = useState(false);

  const handleQuickPayment = (type: 'CASH' | 'ONLINE') => {
    if (!activeBill) return;
    const total = activeBill.totalAmount;
    if (type === 'CASH') {
      updateActiveBill({
        cashAmount: total,
        onlineAmount: 0,
        paymentMethod: PaymentMethod.CASH,
        isPaid: true
      });
    } else {
      updateActiveBill({
        onlineAmount: total,
        cashAmount: 0,
        paymentMethod: PaymentMethod.ONLINE,
        isPaid: true
      });
    }
  };

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

    if (!window.confirm(`Are you sure you want to switch to ${mode} pricing? This will recalculate all item prices.`)) {
      return;
    }

    const newItems = activeBill.items.map(item => {
      const product = products.find(p => p.id === item.id);
      const price = product ? (mode === 'DP' ? product.dp : product.mrp) : item.currentPrice;
      return {
        ...item,
        currentPrice: price,
      };
    });

    const subTotalAmount = newItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
    const totalSp = parseFloat(newItems.reduce((sum, item) => sum + item.totalSp, 0).toFixed(2));

    let discountAmount = 0;
    if (activeBill.discountType === 'percentage' && activeBill.discountValue) {
      discountAmount = (subTotalAmount * activeBill.discountValue) / 100;
    } else if (activeBill.discountType === 'amount' && activeBill.discountValue) {
      discountAmount = activeBill.discountValue;
    }
    const totalAmount = Math.max(0, Math.round(subTotalAmount - discountAmount));

    updateActiveBill({
      billingType: mode,
      items: newItems,
      subTotalAmount,
      totalAmount,
      totalSp,
      onlineAmount: totalAmount, cashAmount: 0, paymentMethod: PaymentMethod.ONLINE, isPaid: true
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
      setFocusedQtyId(productId);
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

  const handleUpdateItemPendingStatus = (itemId: string, pendingQty: number) => {
    const newItems = activeBill.items.map(item => {
      if (item.id === itemId) {
        // Ensure pending doesn't exceed total quantity
        const safePending = Math.min(Math.max(0, pendingQty), item.quantity);
        let newStatus = ProductStatus.GIVEN;
        if (safePending === item.quantity) newStatus = ProductStatus.PENDING;
        else if (safePending > 0) newStatus = ProductStatus.PENDING; // Fallback to PENDING logic if PARTIAL doesn't exist

        return {
          ...item,
          pendingQuantity: safePending,
          status: newStatus
        };
      }
      return item;
    });
    recalculateTotals(newItems);
  };

  const handleMarkAllBillItemsPending = () => {
    const newItems = activeBill.items.map(item => ({
      ...item,
      pendingQuantity: item.quantity,
      status: ProductStatus.PENDING
    }));
    recalculateTotals(newItems);
  };

  const handleMarkAllBillItemsGiven = () => {
    const newItems = activeBill.items.map(item => ({
      ...item,
      pendingQuantity: 0,
      status: ProductStatus.GIVEN
    }));
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

  const handleMarkBillReady = (isReady: boolean) => {
    const newItems = activeBill.items.map(item => ({
      ...item,
      status: isReady ? ProductStatus.GIVEN : ProductStatus.PENDING,
      pendingQuantity: isReady ? 0 : item.quantity
    }));
    updateActiveBill({ items: newItems });
  };

  // Handle updating product status (Given/Pending)
  const handleUpdateProductStatus = (updatedItems: BillItem[]) => {
    updateActiveBill({ items: updatedItems });
  };

  const recalculateTotals = (items: BillItem[]) => {
    const subTotalAmount = items.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
    const totalSp = parseFloat(items.reduce((sum, item) => sum + item.totalSp, 0).toFixed(2));

    let discountAmount = 0;
    if (activeBill.discountType === 'percentage' && activeBill.discountValue) {
      discountAmount = (subTotalAmount * activeBill.discountValue) / 100;
    } else if (activeBill.discountType === 'amount' && activeBill.discountValue) {
      discountAmount = activeBill.discountValue;
    }
    const totalAmount = Math.max(0, Math.round(subTotalAmount - discountAmount));

    updateActiveBill({
      items,
      subTotalAmount,
      discountAmount,
      totalAmount,
      totalSp,
      onlineAmount: totalAmount,
      cashAmount: 0,
      paymentMethod: PaymentMethod.ONLINE,
      isPaid: true
    });
  };

  // Helper logic for applying discount immediately
  const applyDiscount = (type: 'percentage' | 'amount' | undefined, value: number | undefined) => {
    const subTotalAmount = activeBill.subTotalAmount || activeBill.items.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);

    let discountAmount = 0;
    if (type === 'percentage' && value) {
      discountAmount = (subTotalAmount * value) / 100;
    } else if (type === 'amount' && value) {
      discountAmount = value;
    }
    const totalAmount = Math.max(0, Math.round(subTotalAmount - discountAmount));

    updateActiveBill({
      discountType: type,
      discountValue: value,
      discountAmount,
      totalAmount,
      onlineAmount: totalAmount,
      cashAmount: 0,
      paymentMethod: PaymentMethod.ONLINE,
      isPaid: true
    });
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
    const maxId = tabs.reduce((max, t) => {
      // Only consider purely numeric IDs for the sequence of new tabs
      if (/^\d+$/.test(t.id)) {
        const num = parseInt(t.id);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const newId = (maxId + 1).toString();
    const newTab: Tab = { id: newId, title: `Bill #${newId}`, bill: { ...EMPTY_BILL, id: newId, billingType: store.getSettings().defaultBillingMode || 'DP' } };
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

  const handleCancelCurrentBill = () => {
    if (window.confirm('Are you sure you want to revert all changes and start a new bill from scratch?')) {
      const maxId = tabs.reduce((max, t) => {
        if (/^\d+$/.test(t.id)) {
          const num = parseInt(t.id);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      const newId = (maxId + 1).toString();

      const newTab: Tab = {
        id: newId,
        title: `Bill #${newId}`,
        bill: {
          ...EMPTY_BILL,
          id: newId,
          billingType: store.getSettings().defaultBillingMode || 'DP',
          items: [],
          totalAmount: 0,
          totalSp: 0,
          cashAmount: 0,
          onlineAmount: 0,
          discountAmount: 0,
          discountType: undefined,
          discountValue: undefined,
          date: getLocalDateString(),
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          isPaid: false,
          paymentMethod: PaymentMethod.ONLINE,
          hasSnapshot: false,
          customerName: '',
          showSpOnBill: true
        }
      };

      setTabs(prev => prev.map(t => t.id === activeTabId ? newTab : t));
      setActiveTabId(newId);
      setIsMobilePaymentDrawerOpen(false);
    }
  };

  const handleAddCustomer = async () => {
    if (newCustomerName.trim() && newCustomerPhone.trim()) {
      const newCustomer = {
        id: `c${Date.now()}`,
        name: newCustomerName,
        phone: newCustomerPhone,
        totalSpEarned: 0,
        lastVisit: getLocalDateString()
      };

      await store.addCustomer(newCustomer);
      updateActiveBill({ customerName: newCustomerName });
      setIsAddCustomerOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    }
  };

  // Opens the review modal (pre-step before final generation)
  const handleGenerateBill = () => {
    if (!activeBill.customerName) {
      alert('Please select a customer first');
      return;
    }
    if (activeBill.items.length === 0) {
      alert('Please add items to the bill');
      return;
    }
    // Bypass the review modal entirely and directly confirm the bill
    handleConfirmBillFromReview(activeBill.sendWhatsapp !== false);
  };

  // Called from BillReviewModal when user confirms
  const handleConfirmBillFromReview = async (sendWhatsAppMsg: boolean) => {
    const isUpdate = activeBill.id.startsWith('#');

    const finalBill: Bill = {
      ...activeBill,
      id: isUpdate ? activeBill.id : (() => {
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
      })(),
      date: activeBill.date || getLocalDateString(),
      time: activeBill.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    updateActiveBill(finalBill);

    if (isUpdate) {
      await store.updateBill(finalBill);
    } else {
      await store.addBill(finalBill);
    }

    // Close review modal
    setShowBillReviewModal(false);

    // Close the current tab
    const newTabs = tabs.filter(t => t.id !== activeTabId);
    if (newTabs.length === 0) {
      setTabs([{ id: '1', title: 'Bill #1', bill: { ...EMPTY_BILL, id: '1', billingType: store.getSettings().defaultBillingMode || 'DP' } }]);
      setActiveTabId('1');
    } else {
      setTabs(newTabs);
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }

    setPreviewBill(finalBill);
    setTimeout(() => {
      setShowInvoiceModal(true);
    }, 50);

    // Send SMS/WhatsApp if enabled
    if (sendWhatsAppMsg) {
      const customer = customers.find(c => c.name === finalBill.customerName);
      if (customer && customer.phone) {
        (async () => {
          try {
            const pdfUrl = await generateAndUploadInvoicePDF(finalBill);
            const smsSuccess = await sendBillSMS(finalBill, customer.phone, pdfUrl || undefined);

            if (pdfUrl) {
              const waSuccess = await sendBillWhatsapp(finalBill, customer.phone, pdfUrl, isUpdate);
              const billWithStatus = {
                ...finalBill,
                whatsappStatus: waSuccess ? 'Sent' : 'Failed'
              } as Bill;
              await store.updateBill(billWithStatus);
            }

            if (smsSuccess) {
              console.log('SMS sent successfully');
            }
          } catch (err) {
            console.error('Error in SMS/PDF flow:', err);
          }
        })();
      }
    }
  };

  // Save as draft without sending messages
  const handleSaveDraft = async () => {
    const isUpdate = activeBill.id.startsWith('#');
    const draftBill: Bill = {
      ...activeBill,
      id: isUpdate ? activeBill.id : (() => {
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
      })(),
      date: activeBill.date || getLocalDateString(),
      time: activeBill.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    if (isUpdate) {
      await store.updateBill(draftBill);
    } else {
      await store.addBill(draftBill);
    }

    setShowBillReviewModal(false);
    alert('Bill saved as draft successfully!');

    const newTabs = tabs.filter(t => t.id !== activeTabId);
    if (newTabs.length === 0) {
      setTabs([{ id: '1', title: 'Bill #1', bill: { ...EMPTY_BILL, id: '1', billingType: store.getSettings().defaultBillingMode || 'DP' } }]);
      setActiveTabId('1');
    } else {
      setTabs(newTabs);
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  // Delete bill from review modal
  const handleDeleteFromReview = () => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    setShowBillReviewModal(false);
    handleCancel();
  };

  // Update a single item from review modal
  const handleUpdateItemFromReview = (itemId: string, updates: Partial<BillItem>) => {
    const newItems = activeBill.items.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, ...updates };
      // Recalculate total if quantity changed
      if (updates.quantity !== undefined) {
        updated.totalSp = parseFloat((updated.quantity * updated.sp).toFixed(2));
      }
      return updated;
    });
    recalculateTotals(newItems);
  };

  // Remove an item from review modal
  const handleRemoveItemFromReview = (itemId: string) => {
    const newItems = activeBill.items.filter(item => item.id !== itemId);
    recalculateTotals(newItems);
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
        date: getLocalDateString(),
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

  // Category color map for subtle background tints
  const getCategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      'Tablets': '#e8f4fc',      // soft blue
      'Tablet': '#e8f4fc',       // soft blue
      'Powder': '#e8fcee',       // soft green
      'Powders': '#e8fcee',      // soft green
      'Liquid': '#f0e8fc',       // soft purple
      'Liquids': '#f0e8fc',      // soft purple
      'Juice': '#f0e8fc',        // soft purple
      'Cream': '#fcf0e8',        // soft peach
      'Creams': '#fcf0e8',       // soft peach
      'Oil': '#fff8e1',          // soft amber
      'Oils': '#fff8e1',         // soft amber
      'Devices': '#fce8f4',      // soft pink
      'Device': '#fce8f4',       // soft pink
      'Capsules': '#e8fcf8',     // soft teal
      'Capsule': '#e8fcf8',      // soft teal
      'Suits': '#f5e8fc',        // soft lavender
      'Suit': '#f5e8fc',         // soft lavender
    };
    return colorMap[category] || '#f8f9fa'; // default light gray
  };

  // Smart search function with fuzzy matching and priority scoring
  const smartSearchProducts = (products: Product[], query: string, category: string): Product[] => {
    // First filter by category if not 'All'
    let filtered = category === 'All' ? products : products.filter(p => p.category === category);

    if (!query.trim()) return filtered;

    const term = query.toLowerCase().trim();

    // Common abbreviations mapping
    const abbreviations: Record<string, string[]> = {
      'tab': ['tablet', 'tablets'],
      'pow': ['powder', 'powders'],
      'cap': ['capsule', 'capsules'],
      'liq': ['liquid', 'liquids'],
      'jui': ['juice'],
      'cre': ['cream', 'creams'],
      'dev': ['device', 'devices'],
      'pro': ['protein', 'proteindoc'],
      'gin': ['ginseng'],
      'mor': ['moridoc'],
      'non': ['nonidoc'],
      'cow': ['cow c doc'],
      'asc': ['asclepius'],
      'sni': ['sniss'],
      'lon': ['london'],
    };

    // Score each product
    const scored = filtered.map(product => {
      const name = product.name.toLowerCase();
      const words = name.split(/[\s\(\)]+/).filter(w => w.length > 0);
      let score = 0;

      // 1. Exact match (highest priority)
      if (name === term) {
        score = 1000;
      }
      // 2. Name starts with query
      else if (name.startsWith(term)) {
        score = 500;
      }
      // 3. Any word starts with query
      else if (words.some(w => w.startsWith(term))) {
        score = 300;
      }
      // 4. Name contains query
      else if (name.includes(term)) {
        score = 200;
      }
      // 5. Check abbreviations
      else {
        for (const [abbr, expansions] of Object.entries(abbreviations)) {
          if (term.startsWith(abbr)) {
            for (const expansion of expansions) {
              if (name.includes(expansion)) {
                score = Math.max(score, 150);
                break;
              }
            }
          }
        }
      }

      // 6. Multi-word matching: each word in query matches something
      if (score === 0 && term.includes(' ')) {
        const queryWords = term.split(' ').filter(w => w.length > 0);
        const matchCount = queryWords.filter(qw =>
          words.some(w => w.startsWith(qw) || w.includes(qw))
        ).length;
        if (matchCount === queryWords.length) {
          score = 100 * matchCount;
        } else if (matchCount > 0) {
          score = 50 * matchCount;
        }
      }

      // 7. Partial character sequence matching (for typos/partial words)
      if (score === 0) {
        // Check if query chars appear in order in word
        for (const word of words) {
          let qi = 0;
          for (let i = 0; i < word.length && qi < term.length; i++) {
            if (word[i] === term[qi]) qi++;
          }
          if (qi >= term.length * 0.7) {
            score = Math.max(score, 25);
          }
        }
      }

      return { product, score };
    });

    // Filter and sort by score
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.product);
  };

  const filteredProducts = smartSearchProducts(products, searchTerm, selectedCategory);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Fuzzy customer search with proper ranking
  const fuzzyCustomerSearch = (query: string, customerList: typeof customers) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const qWords = q.split(/\s+/);

    const scored = customerList.map(c => {
      const name = c.name.toLowerCase();
      const phone = c.phone || '';
      let score = 0;

      // Split name into primary part and secondary part (inside brackets/parens)
      const primaryMatch = name.match(/^([^[\](]+)/);
      const primaryName = primaryMatch ? primaryMatch[1].trim() : name;
      const secondaryPart = name.slice(primaryName.length);

      // Tier 1: Full name starts with the query (highest priority)
      if (name.startsWith(q)) score += 200;
      // Tier 2: Primary name contains query as substring
      else if (primaryName.includes(q)) score += 150;
      // Tier 3: Secondary part (brackets/parens) contains the query
      else if (secondaryPart.includes(q)) score += 60;
      // Tier 4: Full name contains query somewhere
      else if (name.includes(q)) score += 80;

      // Phone match
      if (phone.startsWith(q)) score += 120;
      else if (phone.includes(q)) score += 70;

      // Word-level matching for multi-word queries and fuzzy
      const primaryWords = primaryName.split(/\s+/).filter(Boolean);
      const secondaryWords = secondaryPart.split(/[\s\[\]\(\),]+/).filter(Boolean);

      for (const qw of qWords) {
        // Check primary name words (higher score)
        for (const nw of primaryWords) {
          if (nw === qw) score += 50;
          else if (nw.startsWith(qw)) score += 35;
          else if (nw.includes(qw)) score += 15;
          else {
            // Fuzzy character matching
            const maxLen = Math.max(qw.length, nw.length);
            if (maxLen <= 1) continue;
            let matches = 0;
            const shorter = qw.length <= nw.length ? qw : nw;
            const longer = qw.length <= nw.length ? nw : qw;
            let lastIdx = -1;
            for (const ch of shorter) {
              const idx = longer.indexOf(ch, lastIdx + 1);
              if (idx !== -1) { matches++; lastIdx = idx; }
            }
            const similarity = matches / maxLen;
            if (similarity >= 0.6) score += Math.round(similarity * 15);
          }
        }
        // Check secondary name words (lower score)
        for (const nw of secondaryWords) {
          if (nw === qw) score += 25;
          else if (nw.startsWith(qw)) score += 15;
          else if (nw.includes(qw)) score += 8;
        }
      }

      return { customer: c, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.customer);
  };

  const customerSuggestions = fuzzyCustomerSearch(activeBill.customerName, customers);

  // Sort customers by most recent bill date (source of truth for recency)
  const recentCustomers = (() => {
    const allBills = store.getBills();
    // Build a map: customer name -> most recent bill timestamp
    const customerLastBill = new Map<string, number>();

    const parseDateStr = (dateStr: string): number => {
      if (!dateStr) return 0;
      try {
        // Handle DD-MM-YYYY format
        if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
          const [d, m, y] = dateStr.split(/[-/]/);
          return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).getTime() || 0;
        }
        // Handle YYYY-MM-DD or ISO
        return new Date(dateStr).getTime() || 0;
      } catch { return 0; }
    };

    allBills.forEach(bill => {
      if (!bill.customerName) return;
      const ts = parseDateStr(bill.date);
      const existing = customerLastBill.get(bill.customerName) || 0;
      if (ts > existing) customerLastBill.set(bill.customerName, ts);
    });

    return [...customers].sort((a, b) => {
      const tsA = customerLastBill.get(a.name) || parseDateStr(a.lastVisit);
      const tsB = customerLastBill.get(b.name) || parseDateStr(b.lastVisit);
      return tsB - tsA;
    });
  })();

  const renderProductContent = (isModal: boolean) => (
    <div className={`flex flex-col h-full ${isModal ? 'bg-white lg:rounded-3xl p-3 pt-[max(env(safe-area-inset-top,12px),12px)] lg:p-6 w-full max-w-4xl lg:h-[80vh] shadow-xl animate-scale-in' : 'w-full h-full'}`}>
      {/* Modal Header - Only for modal */}
      {isModal && (
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="text-xl font-bold text-dark">Add Items</h3>
          <button
            onClick={() => setIsAddProductOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
      )}

      {/* Search Bar - Full Width */}
      <div className="relative mb-4 shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={productSearchRef}
          type="text"
          placeholder="Search by product name or SKU..."
          className="w-full pl-11 pr-4 py-3 bg-white border-2 border-primary/30 rounded-xl text-sm focus:outline-none focus:border-primary text-dark placeholder:text-gray-400"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setHighlightedProductIndex(-1);
          }}
          onKeyDown={(e) => {
            const productsCount = filteredProducts.length;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedProductIndex(prev =>
                prev < productsCount - 1 ? prev + 1 : 0
              );
              // Auto-scroll logic could be added here if needed
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedProductIndex(prev =>
                prev > 0 ? prev - 1 : productsCount - 1
              );
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (highlightedProductIndex >= 0) {
                const selectedProduct = filteredProducts[highlightedProductIndex];
                if (selectedProduct) {
                  handleAddItem(selectedProduct.id);
                }
              }
            } else if (e.key === 'Escape') {
              setHighlightedProductIndex(-1);
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      {/* Category Filter Tabs - Horizontal Pills with Scroll */}
      <div className="relative mb-4 shrink-0 overflow-hidden">
        {scrollPosition.showLeft && (
          <button
            onClick={() => handleCategoryScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full p-1.5 shadow-md transition-all hover:bg-white active:scale-95"
          >
            <ChevronDown className="rotate-90 text-gray-600" size={18} />
          </button>
        )}

        <div
          ref={categoryScrollRef}
          onScroll={handleCategoryScrollProgress}
          className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth px-1"
        >
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${selectedCategory === cat
                ? 'bg-primary text-dark border-2 border-primary shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
              {cat === 'All' ? 'All Items' : cat}
            </button>
          ))}
        </div>

        {scrollPosition.showRight && (
          <button
            onClick={() => handleCategoryScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full p-1.5 shadow-md transition-all hover:bg-white active:scale-95"
          >
            <ChevronDown className="-rotate-90 text-gray-600" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        {/* ========= MOBILE: Compact List View (No Images) ========= */}
        <div className="flex flex-col gap-0 lg:hidden pb-4">
          {filteredProducts.map((product, index) => {
            const itemInBill = activeBill.items.find(i => i.id === product.id);
            const quantity = itemInBill ? itemInBill.quantity : 0;
            const isHighlighted = index === highlightedProductIndex;
            const isLowStock = product.stock < 15;
            const isSelected = quantity > 0;

            return (
              <div
                key={product.id}
                className={`mobile-product-item border-b border-gray-100 last:border-b-0 transition-all duration-200 active:bg-gray-50
                  ${isSelected ? 'bg-[#DAF4D7]/30' : ''}
                  ${isHighlighted ? 'bg-blue-50' : ''}`}
                style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
                onClick={() => {
                  handleAddItem(product.id);
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Left: Product Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-[13px] leading-tight truncate ${isSelected ? 'text-[#21776A]' : 'text-[#111617]'}`}>
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {/* DP Price Pill */}
                      <div className={`px-2 py-[2px] rounded-md text-[10px] font-bold ${isSelected ? 'bg-[#88DE7D] text-[#111617]' : 'bg-[#DAF4D7] text-[#111617]'}`}>
                        DP ₹{product.dp}
                      </div>
                      {/* SP Pill */}
                      <div className="bg-[#F3F5F2] px-1.5 py-[2px] rounded-md">
                        <span className="text-[10px] font-semibold text-[#21776A]">SP {product.sp}</span>
                      </div>
                      {/* MRP */}
                      <span className="text-[10px] text-gray-400 font-medium">MRP ₹{product.mrp}</span>
                      {/* Stock */}
                      <span className={`text-[10px] font-semibold ${isLowStock ? 'text-red-500' : 'text-[#21776A]'}`}>
                        {isLowStock ? (product.stock <= 0 ? `${product.stock} pcs` : `${product.stock} pcs`) : `${product.stock} pcs`}
                      </span>
                    </div>
                  </div>

                  {/* Right: Add Button or Quantity Controls */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isSelected ? (
                      <div className="flex items-center bg-[#F3F5F2] rounded-xl h-[36px] overflow-hidden">
                        <button
                          onClick={() => handleUpdateQuantity(product.id, -1)}
                          className="w-9 h-full flex items-center justify-center text-[#111617]/60 active:bg-[#DAF4D7] transition-colors text-[18px] font-medium"
                        >
                          −
                        </button>
                        <input
                          ref={el => {
                            if (el) productQtyRefs.current[product.id] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantity || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              const numVal = val === '' ? 0 : parseInt(val);
                              handleSetQuantity(product.id, numVal);
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 text-center font-bold text-[#111617] text-[14px] bg-transparent focus:outline-none focus:bg-[#DAF4D7] rounded-sm z-10 p-0"
                        />
                        <button
                          onClick={() => handleUpdateQuantity(product.id, 1)}
                          className="w-9 h-full flex items-center justify-center text-[#111617]/60 active:bg-[#DAF4D7] transition-colors text-[18px] font-medium"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleRemoveItem(product.id)}
                          className="w-9 h-full flex items-center justify-center text-red-400 active:bg-red-50 transition-colors border-l border-gray-200"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(product.id);
                        }}
                        className="w-[38px] h-[38px] bg-[#DAF4D7] text-[#21776A] rounded-xl flex items-center justify-center active:scale-90 active:bg-[#88DE7D] transition-all duration-150"
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

        {/* ========= DESKTOP: Grid View with Images (Unchanged) ========= */}
        <div className="hidden lg:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
          {filteredProducts.map((product, index) => {
            const itemInBill = activeBill.items.find(i => i.id === product.id);
            const quantity = itemInBill ? itemInBill.quantity : 0;
            const isHighlighted = index === highlightedProductIndex;
            const isLowStock = product.stock < 15;
            const isSelected = quantity > 0;

            return (
              <div
                key={product.id}
                className={`rounded-2xl border transition-shadow duration-200 group relative flex flex-col overflow-hidden transform-none hover:transform-none ${isSelected
                  ? 'bg-emerald-50/50 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                  : 'bg-white border-gray-100 hover:border-emerald-200 hover:shadow-lg'
                  } ${isHighlighted ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => {
                  handleAddItem(product.id);
                }}
              >
                {/* Product Image Container */}
                <div className="relative aspect-square p-1.5 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain rounded-xl group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg">
                      <Package size={26} className="text-gray-300" />
                    </div>
                  )}

                  {/* Stock Pill */}
                  <div className={`absolute top-3 right-3 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm z-10 tracking-wide opacity-75 ${isLowStock ? 'bg-red-500' : 'bg-gray-900'
                    }`}>
                    {isLowStock ? 'Low' : product.stock}
                  </div>
                </div>

                {/* Product Info */}
                <div className="px-1.5 pb-1.5 flex flex-col flex-1">
                  <h4 className={`font-bold text-[13px] leading-tight mb-1 line-clamp-2 min-h-[1.75rem] ${isSelected ? 'text-emerald-900' : 'text-gray-800'}`}>
                    {product.name}
                  </h4>

                  {/* Price Row: MRP & SP */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[11px] text-gray-500 font-medium">
                      MRP: <span className="font-semibold">₹{product.mrp}</span>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 font-bold px-1 py-0.5 rounded text-[9px] uppercase tracking-wider">
                      SP: {product.sp}
                    </div>
                  </div>

                  {/* Bottom Row: DP & Action */}
                  <div className="mt-auto flex items-end justify-between gap-1">
                    <div className="flex flex-col -mb-0.5">
                      <span className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider">DP Price</span>
                      <span className={`text-base font-black ${isSelected ? 'text-emerald-700' : 'text-gray-900'}`}>
                        ₹{product.dp}
                      </span>
                    </div>

                    {/* Quantity Controls or Add Button */}
                    {isSelected ? (
                      <div
                        className="flex items-center bg-white rounded-lg shadow-sm border border-emerald-100 h-7"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleUpdateQuantity(product.id, -1)}
                          className="w-6 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-l-lg transition-colors text-base font-bold pb-1"
                          tabIndex={-1}
                        >
                          −
                        </button>
                        <input
                          ref={el => {
                            if (el) productQtyRefs.current[product.id] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty string or numbers only
                            if (val === '' || /^\d+$/.test(val)) {
                              const numVal = val === '' ? 0 : parseInt(val);
                              const diff = numVal - quantity;
                              handleUpdateQuantity(product.id, diff);
                            }
                          }}
                          onKeyDown={(e) => {
                            // Enter to confirm (blur)
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                              setHighlightedProductIndex(-1);
                            }
                            // A-Z to jump to search
                            else if (/^[a-zA-Z]$/.test(e.key)) {
                              e.preventDefault();
                              productSearchRef.current?.focus();
                              setSearchTerm(e.key);
                              setHighlightedProductIndex(-1);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.target.select()}
                          className="w-8 text-center font-bold text-gray-900 text-[13px] h-full focus:outline-none focus:bg-emerald-50 rounded-none z-10 p-0"
                        />
                        <button
                          onClick={() => handleUpdateQuantity(product.id, 1)}
                          className="w-6 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-r-lg transition-colors text-base font-bold pb-1"
                          tabIndex={-1}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(product.id);
                        }}
                        className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all duration-300 shadow-sm"
                      >
                        <Plus size={16} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Footer */}
      {isModal && (
        <div className="shrink-0 border-t border-gray-100 pt-3 pb-[max(env(safe-area-inset-bottom,8px),8px)] lg:pt-4 lg:pb-0">
          {/* Mobile Footer - Compact */}
          <div className="lg:hidden flex items-center gap-3 px-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-400">{activeBill.items.length} items</span>
                <div className="bg-[#DAF4D7] text-[#21776A] font-bold text-[10px] px-1.5 py-0.5 rounded-md">SP {Math.round(activeBill.totalSp * 100) / 100}</div>
              </div>
              <div className="text-[#111617] font-black text-lg leading-tight">₹{activeBill.totalAmount.toLocaleString()}</div>
            </div>
            <button
              onClick={() => setIsAddProductOpen(false)}
              className="px-8 py-3 rounded-xl bg-[#88DE7D] text-[#111617] font-bold text-[15px] active:scale-[0.97] transition-all shadow-sm"
            >
              Done
            </button>
          </div>
          {/* Desktop Footer */}
          <div className="hidden lg:flex lg:justify-between lg:items-center gap-4">
            <div className="text-primary-600 font-medium text-sm">
              <div className="text-sm">{activeBill.items.length} Items Selected</div>
              <div className="flex items-center gap-4">
                <div className="text-dark font-bold text-xl">Total: ₹{activeBill.totalAmount.toLocaleString()}</div>
                <div className="bg-amber-100 text-amber-700 font-bold text-sm px-2.5 py-1 rounded-lg">SP: {Math.round(activeBill.totalSp * 100) / 100}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="px-8 py-2.5 rounded-xl bg-dark text-white font-bold hover:bg-dark-light shadow-lg hover:shadow-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full relative overflow-hidden bg-[#F3F5F2]">
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
      {/* Add Customer Modal Overlay */}
      <AnimatePresence>
        {isAddCustomerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-dark/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0, ease: "easeOut" }}
              className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md"
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Product Modal/Drawer (Works on BOTH Mobile AND Desktop) - Portaled to body for z-index */}
      {createPortal(
        <div className={`fixed inset-0 bg-dark/30 backdrop-blur-sm z-[150] flex items-end lg:items-center justify-center p-0 lg:p-6 transition-all duration-300 ${isAddProductOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className={`w-full lg:max-w-4xl h-[100dvh] lg:h-[85vh] lg:rounded-3xl transform transition-transform duration-300 ease-out-expo ${isAddProductOpen ? 'translate-y-0 lg:scale-100' : 'translate-y-full lg:scale-95 lg:translate-y-0'}`}>
            {renderProductContent(true)}
          </div>
        </div>,
        document.body
      )}

      {/* Main Content Wrapper */}
      <div className="flex flex-col h-full gap-[6px]">
        {/* Tab Navigation */}
        <div className="mx-5 flex items-center gap-2.5 overflow-x-auto px-1 pb-1 no-scrollbar shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`
                  relative flex items-center gap-2 px-5 py-2.5 rounded-full cursor-pointer transition-all select-none
                  ${isActive
                    ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-[#111617] font-bold'
                    : 'text-gray-400 font-medium hover:text-gray-600'
                  }
                `}
              >
                <span className="truncate max-w-[120px] text-sm whitespace-nowrap">{tab.title}</span>

                {/* Close Button */}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    className={`
                      p-0.5 rounded-full transition-colors ml-0.5
                      ${isActive
                        ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        : 'text-gray-300 hover:text-red-400 hover:bg-gray-100'
                      }
                    `}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            onClick={handleNewTab}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#88DE7D] text-[#111617] hover:bg-[#7cd472] transition-all shrink-0"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>


        {/* Main Layout: Left Panel (Products) + Right Panel (Bill) - Desktop View Redesigned */}
        <div className="flex-1 flex gap-6 overflow-hidden">

          {/* Left Side Panel - Products (Hidden on Mobile, flexible on Desktop) */}
          <div className="hidden lg:flex flex-col h-full flex-1 min-w-0 animate-slide-up opacity-0 [animation-delay:100ms] bg-white rounded-3xl shadow-[4px_4px_26.8px_-11px_rgba(33,119,106,0.15)] p-4">
            {renderProductContent(false)}
          </div>

          {/* Right Side Panel - Bill Items & Controls (Mobile Only - Hidden on Desktop) */}
          <div className="flex lg:hidden flex-1 flex-col gap-2.5 md:gap-6 h-full min-w-0 animate-slide-up opacity-0 [animation-delay:100ms]">




            {/* Customer Search - Mobile Only - Separate Card */}
            <div className="mx-4 lg:hidden bg-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.04)] pl-5 pr-2 py-2 flex items-center gap-3 relative" ref={searchWrapperRef}>
              {/* Mobile Customer Search Trigger */}
              <div
                className="flex-1 min-w-0 flex items-center cursor-pointer active:opacity-70 transition-opacity h-[40px]"
                onClick={() => setIsMobileCustomerSearchOpen(true)}
              >
                <Search size={18} strokeWidth={2} className="text-[#a0a5b1] shrink-0 mr-3" />
                <div className="text-[15px] font-medium text-[#848c9e] truncate select-none">
                  {activeBill.customerName || "Search Customer"}
                </div>
              </div>

              {/* DP/MRP Toggle - Mobile */}
              <div className="flex bg-[#F5F7F5] rounded-full p-1 shrink-0 relative z-10 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                <button
                  onClick={() => handlePricingModeChange('DP')}
                  className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all relative z-10 ${activeBill.billingType === 'DP'
                    ? 'bg-[#21776A] text-white shadow-md'
                    : 'text-[#848c9e] hover:text-[#111617]/80'
                    }`}
                >
                  DP
                </button>
                <button
                  onClick={() => handlePricingModeChange('MRP')}
                  className={`px-3.5 py-2 rounded-full text-[13px] font-bold transition-all relative z-10 ${activeBill.billingType === 'MRP'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'text-[#848c9e] hover:text-[#111617]/80'
                    }`}
                >
                  MRP
                </button>
              </div>
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

            {/* Table Area - Transparent Container */}
            <div className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-300`}>

              <div className="flex-1 flex flex-col overflow-hidden pt-0 pb-2 px-4 md:px-0 relative">

                {/* Mobile Column View - Compact & Horizontal */}
                <div ref={listContainerRef} className="md:hidden bill-items-container bg-white rounded-[20px] shadow-[4px_4px_26.8px_-11px_rgba(33,119,106,0.15)] flex-1 overflow-y-auto mb-[180px] py-1.5 overflow-x-hidden">
                  <AnimatePresence>
                    {activeBill.items.map((item, index) => {
                      // Logic to determine pending status
                      const pendingQty = item.pendingQuantity || 0;
                      const isPending = pendingQty > 0;

                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 100, scale: 0.95, transition: { duration: 0.2 } }}
                          key={`mobile-${item.id}`}
                          className="relative"
                        >
                          {/* Delete Background (Revealed on Drag) */}
                          <div className="absolute inset-0 bg-red-50 flex items-center px-6 text-red-500 z-0">
                            <Trash2 size={22} className="opacity-80" />
                          </div>

                          <motion.div
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={{ left: 0, right: 0.7 }}
                            whileDrag={{ zIndex: 10, scale: 1.02 }}
                            onDragEnd={(e, { offset, velocity }) => {
                              if (offset.x > 80 || velocity.x > 400) {
                                // Immediate remove for framer-motion exit animation
                                const newItems = activeBill.items.filter(i => i.id !== item.id);
                                recalculateTotals(newItems);
                              }
                            }}
                            className={`
                              bg-white relative z-10
                              transition-all duration-300 ease-spring
                              ${exitingItems.has(item.id) ? 'bill-item-exit' : ''}
                              ${justAddedId === item.id ? 'bill-item-enter bubble-pulse' : ''}
                            `}
                          >
                            {/* Divider */}
                            {index > 0 && (
                              <div className="mx-3.5 h-[1px] bg-[#F0F0F0]" />
                            )}
                            <div className="px-3.5 py-2.5 flex items-center gap-2.5 relative">
                              {/* Left: Green Checkbox */}
                              <div
                                className={`shrink-0 w-[34px] h-[34px] rounded-[8px] flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${isPending ? 'bg-red-100' : 'bg-[#88DE7D]'}`}
                                onClick={() => setStatusDrawerItemId(item.id)}
                              >
                                {isPending ? (
                                  <span className="text-red-600 font-bold text-[10px]">{pendingQty}P</span>
                                ) : (
                                  <Check size={16} className="text-[#111617] stroke-[3]" />
                                )}
                              </div>

                              {/* Center: Product Details */}
                              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                <h4 className="font-bold text-[#111617] text-[13px] leading-tight truncate uppercase pr-1">{item.name}</h4>
                                <div className="flex items-center gap-1.5">
                                  {/* SP Pill */}
                                  <div className="bg-[#21776A] px-2 py-[2px] rounded flex items-center justify-center shrink-0">
                                    <span className="text-[9px] font-bold text-[#ffffff] whitespace-nowrap">SP {item.sp}</span>
                                  </div>
                                  {/* DP/MRP Pill */}
                                  <div className="bg-[#DAF4D7] px-2 py-[2px] rounded flex items-center justify-center shrink-0">
                                    <span className="text-[9px] font-bold text-[#21776A] whitespace-nowrap">
                                      {activeBill.billingType === 'MRP' ? 'MRP ' : 'DP '}
                                      {activeBill.billingType === 'MRP' ? item.mrp : item.dp}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Quantity & Price */}
                              <div className="flex items-center gap-2.5 shrink-0">
                                {/* Quantity Stepper */}
                                <div className="flex items-center bg-[#F2F7F2] rounded-[8px] h-[30px] w-[68px]">
                                  <button
                                    onClick={() => handleUpdateQuantity(item.id, -1)}
                                    className="flex-1 h-full flex items-center justify-center text-[#111617] active:bg-black/5 transition-colors text-[16px] font-bold leading-none"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={item.quantity || ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^\d+$/.test(val)) {
                                        const numVal = val === '' ? 0 : parseInt(val);
                                        handleSetQuantity(item.id, numVal);
                                      }
                                    }}
                                    className="w-[28px] text-center font-bold text-[#111617] text-[13px] leading-none bg-transparent focus:outline-none focus:bg-white rounded-sm p-0 mx-0.5"
                                  />
                                  <button
                                    onClick={() => handleUpdateQuantity(item.id, 1)}
                                    className="flex-1 h-full flex items-center justify-center text-[#111617] active:bg-black/5 transition-colors text-[16px] font-bold leading-none"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Total Price */}
                                <div className="text-right min-w-[3rem]">
                                  <span className="font-bold text-[#111617] text-[14px]">
                                    ₹{item.currentPrice * item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Add Product Button - Mobile */}
                  <div className="px-5 py-4 pb-6">
                    <button
                      onClick={() => setIsAddProductOpen(true)}
                      className="w-full py-3.5 border-[2px] border-dashed border-[#DBDBDB] rounded-[16px] text-[#111617] hover:border-[#88DE7D] hover:bg-[#DAF4D7]/30 transition-all flex items-center justify-center gap-2 font-bold text-[13px] uppercase tracking-wider"
                    >
                      <Plus size={18} strokeWidth={2.5} /> ADD ITEM
                    </button>
                  </div>
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
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity || ''}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val)) {
                                      const numVal = val === '' ? 0 : parseInt(val);
                                      handleSetQuantity(item.id, numVal);
                                    }
                                  }}
                                  className="w-[32px] text-center font-bold text-dark text-xs bg-transparent focus:outline-none focus:bg-white rounded-sm p-0 mx-1"
                                />
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
                    onClick={handleCancelCurrentBill}
                    className="w-14 h-14 md:w-auto md:h-auto md:px-6 md:py-3 bg-[#daf4d7] hover:bg-[#c8e6c4] text-red-500 hover:text-red-700 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border border-[#daf4d7]"
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

            {/* Backdrop for Mobile Drawer */}
            {isMobilePaymentDrawerOpen && (
              <div
                className="md:hidden fixed inset-0 z-[59] bg-black/[0.01]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobilePaymentDrawerOpen(false);
                }}
              />
            )}

            {/* Backdrop overlay when drawer is expanded */}
            {createPortal(
              <AnimatePresence>
                {isMobilePaymentDrawerOpen && !showInvoiceModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-[6px]"
                    onClick={() => setIsMobilePaymentDrawerOpen(false)}
                  />
                )}
              </AnimatePresence>,
              document.body
            )}

            {/* Mobile Bottom Payment Drawer Container */}
            {createPortal(
              <div className={`md:hidden fixed bottom-4 left-4 right-4 z-[60] flex flex-col justify-end pointer-events-none ${showInvoiceModal ? 'hidden' : ''}`}>
                <motion.div
                  initial={false}
                  animate={{ height: 'auto' }}
                  className="bg-white rounded-[20px] shadow-[0px_-2px_30px_-8px_rgba(33,119,106,0.2)] flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 relative"
                >
                  {/* Drag handle */}
                  <div className="flex justify-center pt-2.5 pb-1">
                    <div className="w-10 h-1 rounded-full bg-[#111617]/10" />
                  </div>

                  {/* Collapsed Header Content */}
                  <div className="shrink-0 flex flex-col">
                    {/* Stats Row */}
                    <div className={`flex gap-3 px-4 transition-all duration-300 ${isMobilePaymentDrawerOpen ? 'mb-3' : 'mb-3'}`}>
                      {/* Net Amount Box */}
                      <div className="flex-1 bg-[#F3F5F2] rounded-[12px] py-3.5 px-2 flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[10px] font-bold text-[#111617]/40 uppercase tracking-widest">Net Amount</span>
                        <span className="text-[24px] leading-none font-black text-[#111617] tracking-tight text-center">
                          <span className="text-[15px] mr-0.5">₹</span>{activeBill.totalAmount.toLocaleString()}
                        </span>
                      </div>

                      {/* Total SP Box */}
                      <div className="flex-1 bg-[#F3F5F2] rounded-[12px] py-3.5 px-2 flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[10px] font-bold text-[#111617]/40 uppercase tracking-widest">Total SP</span>
                        <span className="text-[24px] leading-none font-black text-[#111617] tracking-tight text-center">
                          {activeBill.totalSp}
                        </span>
                      </div>
                    </div>

                    {/* Action Area: Continue Button or Payment Status Toggle */}
                    <div className="px-4 pb-4 shrink-0 transition-all relative">
                      <AnimatePresence mode="wait">
                        {!isMobilePaymentDrawerOpen ? (
                          <motion.div
                            key="continue-btn-group"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="flex gap-2 w-full"
                          >
                            <button
                              onClick={handleCancelCurrentBill}
                              className="w-[60px] shrink-0 bg-[#daf4d7] hover:bg-[#c8e6c4] active:scale-[0.98] transition-all rounded-[12px] flex items-center justify-center text-[#111617]/60 border border-gray-200/50"
                              title="Cancel Bill"
                            >
                              <X size={26} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => setIsMobilePaymentDrawerOpen(true)}
                              className="flex-1 py-3 bg-[#88DE7D] hover:bg-[#7cd472] active:scale-[0.98] transition-all rounded-[12px] flex items-center justify-center gap-2 text-[#111617] font-semibold text-[16px] shadow-sm"
                            >
                              Continue
                              <ChevronDown size={20} strokeWidth={2.5} className="text-[#111617] mt-0.5" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="payment-toggle"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="bg-[#F3F5F2] p-1 rounded-[12px] flex"
                          >
                            <button
                              onClick={() => updateActiveBill({ isPaid: true })}
                              className={`flex-1 py-2.5 rounded-[8px] text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeBill.isPaid
                                ? 'bg-[#21776A] text-white shadow-sm'
                                : 'text-[#111617]/40 hover:text-[#111617]/60'
                                }`}
                            >
                              <Check size={14} strokeWidth={3} />
                              Paid
                            </button>
                            <button
                              onClick={() => updateActiveBill({ isPaid: false })}
                              className={`flex-1 py-2.5 rounded-[8px] text-sm font-bold transition-all flex items-center justify-center gap-2 ${!activeBill.isPaid
                                ? 'bg-[#21776A] text-white shadow-sm'
                                : 'text-[#111617]/40 hover:text-[#111617]/60'
                                }`}
                            >
                              <div className="flex gap-1"><div className="w-1 h-1 bg-current rounded-full"></div><div className="w-1 h-1 bg-current rounded-full"></div><div className="w-1 h-1 bg-current rounded-full"></div></div>
                              Unpaid
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Expanded Content (Scrollable) */}
                  <AnimatePresence>
                    {isMobilePaymentDrawerOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="px-4 pb-4 overflow-y-auto no-scrollbar pointer-events-auto max-h-[60vh] flex flex-col"
                      >
                        <div className="space-y-3 pt-1">

                          {/* Payment Fields */}
                          {activeBill.isPaid && (
                            <div className="grid grid-cols-2 gap-3 animate-scale-in">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#111617]/40 uppercase tracking-widest pl-1">CASH PAYMENT</label>
                                <div className="bg-[#F3F5F2] rounded-[12px] p-3.5 flex flex-col gap-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[#111617]/30 font-bold text-base">₹</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      value={activeBill.cashAmount === 0 ? '' : activeBill.cashAmount}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        const cashVal = isNaN(val) ? 0 : val;
                                        const remaining = Math.max(0, activeBill.totalAmount - cashVal);
                                        updateActiveBill({
                                          cashAmount: cashVal,
                                          onlineAmount: remaining,
                                          paymentMethod: cashVal > 0 && remaining === 0 ? PaymentMethod.CASH : PaymentMethod.ONLINE
                                        });
                                      }}
                                      className="w-full bg-transparent font-black text-lg text-[#111617] focus:outline-none focus:ring-0 placeholder:text-[#111617]/20"
                                      placeholder="0"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleQuickPayment('CASH')}
                                    className="w-full py-1.5 bg-white hover:bg-gray-50 rounded-[8px] text-[10px] font-bold text-[#111617]/60 uppercase tracking-widest transition-colors"
                                  >
                                    ALL CASH
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#111617]/40 uppercase tracking-widest pl-1">ONLINE PAYMENT</label>
                                <div className="bg-[#F3F5F2] rounded-[12px] p-3.5 flex flex-col gap-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[#111617]/30 font-bold text-base">₹</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      value={activeBill.onlineAmount === 0 ? '' : activeBill.onlineAmount}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        const onlineVal = isNaN(val) ? 0 : val;
                                        const remaining = Math.max(0, activeBill.totalAmount - onlineVal);
                                        updateActiveBill({
                                          onlineAmount: onlineVal,
                                          cashAmount: remaining,
                                          paymentMethod: onlineVal > 0 && remaining === 0 ? PaymentMethod.ONLINE : PaymentMethod.CASH
                                        });
                                      }}
                                      className="w-full bg-transparent font-black text-lg text-[#111617] focus:outline-none focus:ring-0 placeholder:text-[#111617]/20"
                                      placeholder="0"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleQuickPayment('ONLINE')}
                                    className="w-full py-1.5 bg-[#DAF4D7] hover:bg-[#c8edc3] rounded-[8px] text-[10px] font-bold text-[#21776A] uppercase tracking-widest transition-colors"
                                  >
                                    ALL ONLINE
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Apply Discount */}
                          <div>
                            <motion.div
                              layout
                              className={`bg-[#DAF4D7] overflow-hidden transition-colors ${isDiscountPanelOpen ? 'rounded-[16px]' : 'rounded-[12px] hover:bg-[#c8edc3]'}`}
                            >
                              <button
                                onClick={() => setIsDiscountPanelOpen(!isDiscountPanelOpen)}
                                className={`w-full flex items-center justify-between ${isDiscountPanelOpen ? 'p-3.5 pb-2 cursor-pointer' : 'p-3.5 cursor-pointer'}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 bg-[#21776A] rounded-[6px] flex items-center justify-center font-bold text-white text-sm shrink-0">%</div>
                                  <span className="font-semibold text-[#21776A] text-[14px]">Apply Discount</span>
                                </div>
                                <motion.div
                                  animate={{ rotate: isDiscountPanelOpen ? 0 : 90 }}
                                  transition={{ duration: 0.2 }}
                                  className="text-[#21776A]/50 pr-1"
                                >
                                  <ChevronUp size={18} />
                                </motion.div>
                              </button>

                              <AnimatePresence>
                                {isDiscountPanelOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                  >
                                    <div className="p-3.5 pt-1.5 space-y-3 flex flex-col justify-center">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className="text-[9px] font-bold text-[#21776A]/60 uppercase tracking-widest text-center block">% DISCOUNT</label>
                                          <div className="bg-white rounded-[8px] p-2.5 flex justify-center">
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              value={activeBill.discountType === 'percentage' ? activeBill.discountValue || '' : ''}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                applyDiscount('percentage', isNaN(val) ? 0 : val);
                                              }}
                                              className="w-16 text-center text-lg font-black text-[#111617] focus:outline-none bg-transparent placeholder:text-[#111617]/20"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="text-[9px] font-bold text-[#21776A]/60 uppercase tracking-widest text-center block">AMOUNT</label>
                                          <div className="bg-white rounded-[8px] p-2.5 flex justify-center items-center gap-1">
                                            <span className="text-[#111617]/30 font-bold text-sm">₹</span>
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              value={activeBill.discountType === 'amount' ? activeBill.discountValue || '' : ''}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                applyDiscount('amount', isNaN(val) ? 0 : val);
                                              }}
                                              className="w-16 text-left text-lg font-black text-[#111617] focus:outline-none bg-transparent placeholder:text-[#111617]/20"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <div className="border-t border-[#21776A]/15 pt-3 flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center px-0.5">
                                          <span className="text-xs font-semibold text-[#21776A]/70">Discounted Amount</span>
                                          <span className="text-[13px] font-bold text-[#21776A] tracking-tight">- ₹{activeBill.discountAmount || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center px-0.5">
                                          <span className="text-sm font-bold text-[#111617]">Final Net Amount</span>
                                          <span className="text-lg font-black text-[#111617] tracking-tight">₹{activeBill.totalAmount}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </div>

                          {/* Show SP Toggle */}
                          <div className="space-y-2">
                            <div className="w-full bg-[#F3F5F2] rounded-[12px] p-3.5 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="text-[#111617]/30">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                </div>
                                <span className="font-semibold text-[#111617] text-[13px]">Show SP on bill</span>
                              </div>

                              <div
                                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors flex items-center ${activeBill.showSpOnBill !== false ? 'bg-[#21776A]' : 'bg-[#111617]/15'}`}
                                onClick={() => updateActiveBill({ showSpOnBill: activeBill.showSpOnBill === false ? true : false })}
                              >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${activeBill.showSpOnBill !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                            </div>

                            {/* Send on WhatsApp Toggle */}
                            <div className="w-full bg-[#F3F5F2] rounded-[12px] p-3.5 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="text-[#111617]/30">
                                  <MessageSquare size={20} className="text-[#111617]/50" />
                                </div>
                                <span className="font-semibold text-[#111617] text-[13px]">Send on WhatsApp</span>
                              </div>

                              <div
                                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors flex items-center ${activeBill.sendWhatsapp !== false ? 'bg-[#21776A]' : 'bg-[#111617]/15'}`}
                                onClick={() => updateActiveBill({ sendWhatsapp: activeBill.sendWhatsapp === false ? true : false })}
                              >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${activeBill.sendWhatsapp !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-3 pt-2 pb-1">
                            <button
                              onClick={handleCancelCurrentBill}
                              className="w-1/2 py-3.5 bg-[#daf4d7] text-[#111617]/60 font-bold text-[14px] tracking-wide rounded-[12px] hover:bg-[#c8e6c4] transition-colors text-center cursor-pointer">
                              Cancel Bill
                            </button>
                            <button
                              onClick={() => {
                                setIsMobilePaymentDrawerOpen(false);
                                handleGenerateBill();
                              }}
                              className="w-1/2 py-3.5 bg-[#88DE7D] hover:bg-[#7cd472] active:scale-[0.98] transition-all rounded-[12px] text-[#111617] font-bold text-[14px] tracking-wide shadow-sm text-center cursor-pointer"
                            >
                              {activeBill.id.startsWith('#') ? 'Update Bill' : 'Generate Bill'}
                            </button>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>,
              document.body
            )}

          </div >

          {/* Right Side Panel - Current Bill Panel (Desktop Only) */}
          < div className="hidden lg:flex flex-1 max-w-[500px] flex-col h-full bg-white rounded-3xl shadow-[4px_4px_26.8px_-11px_rgba(33,119,106,0.15)] animate-slide-up opacity-0 [animation-delay:200ms]" >

            {/* Header - Current Bill with MRP/DP Toggle */}
            < div className="p-4 border-b border-gray-100 shrink-0" >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={20} className="text-dark" />
                  <span className="font-bold text-dark text-lg">Current Bill</span>
                  <span className="text-sm text-gray-500">{activeBill.items.length} items</span>
                </div>

                {/* MRP/DP Toggle */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => handlePricingModeChange('MRP')}
                    className={`px-3 py-1.5 text-xs font-black rounded-md transition-all ${activeBill.billingType === 'MRP'
                      ? 'bg-red-500 text-white shadow-md shadow-red-200'
                      : 'text-gray-500 hover:text-dark hover:bg-gray-200'
                      }`}
                  >
                    MRP
                  </button>
                  <button
                    onClick={() => handlePricingModeChange('DP')}
                    className={`px-3 py-1.5 text-xs font-black rounded-md transition-all ${activeBill.billingType === 'DP'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                      : 'text-gray-500 hover:text-dark hover:bg-gray-200'
                      }`}
                  >
                    DP
                  </button>
                </div>
              </div>

              {/* Customer Search + Add Button */}
              <div className="relative z-50">
                <CustomerSearchBar
                  value={activeBill.customerName}
                  onChange={(name) => updateActiveBill({ customerName: name })}
                  customers={customers}
                  onAddNew={() => setIsAddCustomerOpen(true)}
                  className="w-full"
                />
              </div>
            </div >

            {/* Bill Items List - Compact Tabular View */}
            < div className="flex-1 overflow-y-auto" >
              {
                activeBill.items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
                    <ShoppingCart size={32} className="opacity-40 mb-2" />
                    <p className="text-sm text-gray-500">No items yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Table Header */}
                    <div className="px-3 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2 sticky top-0 z-10 text-[10px] font-black uppercase tracking-wider text-gray-400">
                      <div className="w-8 text-center">#</div>
                      <div className="flex-1 text-left pl-1">Item Name</div>
                      <div className="w-20 text-center">Qty</div>
                      <div className="w-16 text-center">Total SP</div>
                      <div className="w-20 text-right">Amount</div>
                      <div className="w-6 shrink-0"></div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {activeBill.items.map((item, index) => (
                        <div key={item.id} className="px-3 py-3 hover:bg-gray-50/50 transition-colors flex items-center gap-2 group">
                          {/* Sr. No. */}
                          <div className="w-8 flex justify-center shrink-0">
                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 font-bold text-[10px] flex items-center justify-center">
                              {index + 1}
                            </div>
                          </div>

                          {/* Item Info */}
                          <div className="flex-1 min-w-0 pl-1">
                            <div className="font-bold text-dark text-[13px] leading-tight line-clamp-2 group-hover:text-primary-700 transition-colors">{item.name}</div>
                          </div>

                          {/* Quantity Controls - Compact */}
                          <div className="w-20 flex justify-center shrink-0">
                            <div className="flex items-center bg-gray-100 rounded-lg scale-90 origin-center">
                              <button
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-l-lg transition-colors font-bold"
                              >
                                −
                              </button>
                              <span className="w-8 text-center font-bold text-dark text-xs">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-r-lg transition-colors font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Total SP Column */}
                          <div className="w-16 flex justify-center shrink-0">
                            <span className="text-emerald-700 font-black text-xs bg-emerald-50 px-2.0 py-0.5 rounded border border-emerald-100/50">
                              {(item.sp * item.quantity).toFixed(1)}
                            </span>
                          </div>

                          {/* Total Amount */}
                          <div className="w-20 text-right shrink-0">
                            <span className="font-black text-dark text-sm">
                              ₹{(item.currentPrice * item.quantity).toLocaleString()}
                            </span>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-6 flex justify-center text-gray-300 hover:text-red-500 transition-all active:scale-90 shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
            </div >

            {/* Summary Bar - Compact Inline */}
            < div className="px-5 py-3 border-t border-gray-100 shrink-0 bg-white shadow-sm z-20" >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100/50">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total SP:</span>
                  <span className="text-lg font-black text-emerald-700">{activeBill.totalSp.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-500">Grand Total:</span>
                  <span className="text-2xl font-black text-dark">₹{activeBill.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div >

            {/* Action Buttons */}
            < div className="p-3 border-t border-gray-100 shrink-0 space-y-2" >
              {/* Top Row: Product Status Button */}
              < button
                onClick={() => setShowProductStatusModal(true)}
                disabled={activeBill.items.length === 0}
                className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Package size={16} />
                Check Product Status
              </button >

              {/* Bottom Row: Payment + Generate */}
              < div className="flex gap-2" >
                <button
                  onClick={() => {
                    setShowPaymentModal(true);
                  }}
                  className="flex-1 py-2.5 px-3 border border-gray-200 rounded-xl font-bold text-dark hover:bg-gray-50 transition-colors text-sm"
                >
                  Add Payment
                </button>
                <button
                  onClick={handleGenerateBill}
                  disabled={activeBill.items.length === 0}
                  className="flex-1 py-2.5 px-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-dark font-bold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-1.5 text-sm"
                >
                  {activeBill.id.startsWith('#') ? 'Update Bill' : 'Generate Bill'}
                  <ArrowRight size={16} />
                </button>
              </div >
            </div >

            {/* Hidden file inputs */}
            < input ref={cameraInputRef} type="file" accept="image/*" capture onChange={handleImageCapture} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageCapture} className="hidden" />

          </div >
        </div >
      </div >

      {/* Product Status Check Modal (New Mobile Flow) */}
      < div className={`fixed inset-0 pb-[80px] bg-white z-[50] flex flex-col md:hidden transform transition-transform duration-300 ease-out-expo ${showProductStatusModal ? 'translate-x-0' : 'translate-x-full'}`}>
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
          <div className="space-y-4 mb-2">
            <div className="text-sm text-gray-400 font-medium">
              Verify items before payment.
            </div>

            {activeBill.items.length > 0 && (
              <div
                onClick={() => {
                  // If NOT all are pending, mark all as pending (uncheck the box)
                  // If all ARE pending, mark all as given (check the box)
                  const allPending = activeBill.items.every(item => item.status === ProductStatus.PENDING);
                  handleMarkBillReady(allPending); // isReady will be true if all were pending
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${!activeBill.items.every(item => item.status === ProductStatus.PENDING)
                  ? 'bg-emerald-50 border-emerald-100 ring-1 ring-emerald-100'
                  : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${!activeBill.items.every(item => item.status === ProductStatus.PENDING)
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-gray-300 bg-white'
                    }`}>
                    {!activeBill.items.every(item => item.status === ProductStatus.PENDING) && <Check size={14} strokeWidth={4} />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${!activeBill.items.every(item => item.status === ProductStatus.PENDING) ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {activeBill.items.every(item => item.status === ProductStatus.PENDING) ? 'Mark All Handed Over' : 'Mark All as Pending'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                      {activeBill.items.every(item => item.status === ProductStatus.PENDING) ? 'Current Status: All Pending' : 'Current Status: Handed Over'}
                    </span>
                  </div>
                </div>
                {!activeBill.items.every(item => item.status === ProductStatus.PENDING) && (
                  <div className="text-emerald-600 bg-emerald-100/50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                    Handover in Progress
                  </div>
                )}
              </div>
            )}
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
          </button>
        </div>
      </div >

      {/* Payment Modal Window - Responsive Popup */}
      {
        showPaymentModal && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-200"
            style={{ opacity: isPaymentModalClosing ? 0 : 1 }}
            onClick={(e) => { if (e.target === e.currentTarget) closePaymentModal(); }}
          >
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] ${isPaymentModalClosing ? 'animate-zoom-out' : 'animate-zoom-in'}`}>
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Add Payment Info</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Transaction ID: {activeBill.id}</p>
                </div>
                <button
                  onClick={closePaymentModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-6 overflow-y-auto custom-scrollbar">
                {/* Total Balance Due - Red highlight when unpaid */}
                <div className={`rounded-xl p-5 border transition-all ${!activeBill.isPaid
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-emerald-50/50 border-emerald-200'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-600">Total Balance Due</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${!activeBill.isPaid
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                      }`}>
                      {activeBill.isPaid ? 'PAID' : 'PENDING'}
                    </span>
                  </div>
                  <div className={`text-3xl font-black ${!activeBill.isPaid ? 'text-red-700' : 'text-gray-900'
                    }`}>
                    ₹{activeBill.totalAmount.toLocaleString()}
                  </div>
                </div>

                {/* Payment Status Toggle */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-600 block">Payment Status</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateActiveBill({ isPaid: true })}
                      className={`py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 border flex items-center justify-center gap-2 ${activeBill.isPaid
                        ? 'border-primary bg-primary/20 text-dark ring-1 ring-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      {activeBill.isPaid && <Check size={16} strokeWidth={3} />}
                      Paid
                    </button>
                    <button
                      onClick={() => updateActiveBill({ isPaid: false })}
                      className={`py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 border flex items-center justify-center gap-2 ${!activeBill.isPaid
                        ? 'border-red-200 bg-red-50 text-red-700 ring-1 ring-red-200 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      {!activeBill.isPaid && <AlertCircle size={16} />}
                      Unpaid
                    </button>
                  </div>
                </div>

                {/* Online Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center"><span className="text-blue-600 text-[10px]">₹</span></span>
                      Online Amount
                    </label>
                    <button
                      onClick={() => updateActiveBill({ onlineAmount: activeBill.totalAmount, cashAmount: 0, paymentMethod: PaymentMethod.ONLINE })}
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${(activeBill.onlineAmount || 0) === activeBill.totalAmount && activeBill.totalAmount > 0
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
                      value={activeBill.onlineAmount === 0 ? '' : activeBill.onlineAmount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        const onlineVal = isNaN(val) ? 0 : val;
                        const remaining = Math.max(0, activeBill.totalAmount - onlineVal);
                        updateActiveBill({
                          onlineAmount: onlineVal,
                          cashAmount: remaining,
                          paymentMethod: onlineVal > 0 && remaining === 0 ? PaymentMethod.ONLINE : PaymentMethod.CASH
                        });
                      }}
                      className="w-full pl-9 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all placeholder:text-gray-300"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Cash Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-600 flex items-center gap-2">
                      <span className="w-5 h-5 bg-green-100 rounded flex items-center justify-center"><span className="text-green-600 text-[10px]">₹</span></span>
                      Cash Amount
                    </label>
                    <button
                      onClick={() => updateActiveBill({ cashAmount: activeBill.totalAmount, onlineAmount: 0, paymentMethod: PaymentMethod.CASH })}
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${(activeBill.cashAmount || 0) === activeBill.totalAmount && activeBill.totalAmount > 0
                        ? 'bg-green-100 text-green-700'
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
                      value={activeBill.cashAmount === 0 ? '' : activeBill.cashAmount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        const cashVal = isNaN(val) ? 0 : val;
                        const remaining = Math.max(0, activeBill.totalAmount - cashVal);
                        updateActiveBill({
                          cashAmount: cashVal,
                          onlineAmount: remaining,
                          paymentMethod: cashVal > 0 ? PaymentMethod.CASH : PaymentMethod.ONLINE
                        });
                      }}
                      className="w-full pl-9 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 transition-all placeholder:text-gray-300"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Remaining to be paid */}
                {activeBill.totalAmount > 0 && Math.abs((activeBill.cashAmount || 0) + (activeBill.onlineAmount || 0) - activeBill.totalAmount) > 1 && (
                  <div className="flex items-center justify-between py-3 border-t border-dashed border-orange-200">
                    <span className="text-sm italic text-orange-500">Remaining to be paid:</span>
                    <span className="text-lg font-black text-orange-600">
                      ₹{Math.abs(activeBill.totalAmount - (activeBill.cashAmount || 0) - (activeBill.onlineAmount || 0)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-100 space-y-3 bg-gray-50 shrink-0">
                <button
                  onClick={closePaymentModal}
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-dark font-bold rounded-xl shadow-md shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                >
                  <Check size={18} strokeWidth={3} />
                  Save Payment
                </button>
              </div>
            </div>
          </div>
        )
      }




      {/* Bill Review Modal */}
      {
        showBillReviewModal && (
          <BillReviewModal
            isOpen={showBillReviewModal}
            onClose={() => setShowBillReviewModal(false)}
            bill={activeBill}
            onUpdateBill={updateActiveBill}
            onUpdateItem={handleUpdateItemFromReview}
            onRemoveItem={handleRemoveItemFromReview}
            onConfirmBill={handleConfirmBillFromReview}
            onSaveDraft={handleSaveDraft}
            onDeleteBill={handleDeleteFromReview}
          />
        )
      }

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
              setShowPaymentModal(false);
            }}
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
      {/* Product Status Modal */}
      <AnimatePresence>
        {showProductStatusModal && (
          <ProductStatusModal
            isOpen={showProductStatusModal}
            onClose={() => setShowProductStatusModal(false)}
            items={activeBill.items}
            onUpdate={handleUpdateProductStatus}
            billId={activeBill.billNo}
          />
        )}
      </AnimatePresence>

      {/* Mobile Product Status Drawer */}
      {createPortal(
        <AnimatePresence>
          {statusDrawerItemId && (() => {
            const item = activeBill.items.find(i => i.id === statusDrawerItemId);
            if (!item) return null;

            return (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setStatusDrawerItemId(null)}
                  className="fixed inset-0 bg-black/40 z-[120] backdrop-blur-sm md:hidden"
                />

                {/* Drawer */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100) setStatusDrawerItemId(null);
                  }}
                  className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2rem] z-[130] md:hidden overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
                >
                  {/* Drag Handle */}
                  <div className="w-full flex justify-center pt-3 pb-2" onClick={() => setStatusDrawerItemId(null)}>
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                  </div>

                  <div className="p-6 pt-2 pb-8 flex-1 overflow-y-auto">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Update Product Status</h3>

                    <div className="space-y-4">
                      {/* All Given Option */}
                      <div
                        onClick={() => handleUpdateItemPendingStatus(item.id, 0)}
                        className={`p-4 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${(item.pendingQuantity || 0) === 0
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-100 hover:border-gray-50'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${(item.pendingQuantity || 0) === 0 ? 'border-emerald-500' : 'border-gray-300'
                            }`}>
                            {(item.pendingQuantity || 0) === 0 && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                          </div>
                          <span className={`font-bold ${(item.pendingQuantity || 0) === 0 ? 'text-emerald-700' : 'text-gray-700'}`}>Given</span>
                        </div>
                      </div>

                      {/* All Pending Option */}
                      <div
                        onClick={() => handleUpdateItemPendingStatus(item.id, item.quantity)}
                        className={`p-4 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${(item.pendingQuantity || 0) === item.quantity
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-100 hover:border-gray-50'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${(item.pendingQuantity || 0) === item.quantity ? 'border-red-500' : 'border-gray-300'
                            }`}>
                            {(item.pendingQuantity || 0) === item.quantity && <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
                          </div>
                          <span className={`font-bold ${(item.pendingQuantity || 0) === item.quantity ? 'text-red-700' : 'text-gray-700'}`}>Pending</span>
                        </div>
                      </div>

                      {/* Number Grid for Custom Pending Quantity */}
                      {item.quantity > 0 && (
                        <div className="pt-2">
                          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar px-1">
                            {Array.from({ length: item.quantity }, (_, i) => i + 1).map(num => (
                              <button
                                key={num}
                                onClick={() => handleUpdateItemPendingStatus(item.id, num)}
                                className={`min-w-[3.5rem] h-14 rounded-xl font-bold text-lg border-2 shrink-0 transition-all ${(item.pendingQuantity || 0) === num
                                  ? 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-200'
                                  : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                                  }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mark All Pending Button */}
                      {/* Global Actions Row */}
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => {
                            handleMarkAllBillItemsGiven();
                            setStatusDrawerItemId(null);
                          }}
                          className="flex-1 py-3.5 bg-[#0DA665] text-white rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200"
                        >
                          <CheckCircle size={18} strokeWidth={2.5} />
                          Mark All Given
                        </button>

                        <button
                          onClick={() => {
                            handleMarkAllBillItemsPending();
                            setStatusDrawerItemId(null);
                          }}
                          className="flex-1 py-3.5 bg-[#DC2626] text-white rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-red-200"
                        >
                          <AlertCircle size={18} strokeWidth={2.5} />
                          Mark All Pending
                        </button>
                      </div>

                    </div>
                  </div>
                </motion.div>
              </>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Mobile Customer Search Modal */}
      {createPortal(
        <AnimatePresence>
          {isMobileCustomerSearchOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:hidden">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileCustomerSearchOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
              />

              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="relative w-full max-w-sm bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col h-[75vh]"
              >
                {/* Header */}
                <div className="p-4 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#111617]">
                    <UserPlus size={20} strokeWidth={2} className="text-[#21776A]" />
                    <h3 className="font-bold text-[16px]">Search/Add Customer</h3>
                  </div>
                  <button
                    onClick={() => setIsMobileCustomerSearchOpen(false)}
                    className="p-1.5 text-[#111617]/30 hover:text-[#111617]/60 rounded-full hover:bg-[#F3F5F2] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="px-4 pb-4 overflow-y-auto custom-scrollbar flex-1">
                  {/* Search Input */}
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#111617]/30" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search or add customer..."
                      className="w-full pl-10 pr-4 py-3 bg-[#F3F5F2] rounded-[12px] text-[#111617] text-[14px] font-medium placeholder:text-[#111617]/30 focus:bg-white focus:ring-2 focus:ring-[#21776A]/20 focus:border focus:border-[#21776A]/30 outline-none transition-all"
                      value={activeBill.customerName}
                      onChange={(e) => updateActiveBill({ customerName: e.target.value })}
                    />
                  </div>

                  {/* Customer List */}
                  <div>
                    <h4 className="text-[9px] font-bold text-[#111617]/30 uppercase tracking-widest mb-2 pl-1">
                      {activeBill.customerName ? 'Search Results' : 'Recent Customers'}
                    </h4>
                    <div className="space-y-0.5">
                      {activeBill.customerName
                        ? customerSuggestions.length > 0
                          ? customerSuggestions.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                updateActiveBill({ customerName: c.name });
                                setIsMobileCustomerSearchOpen(false);
                              }}
                              className="flex items-center justify-between p-2.5 hover:bg-[#F3F5F2] rounded-[12px] cursor-pointer group transition-colors active:scale-[0.98]"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#DAF4D7] text-[#21776A] flex items-center justify-center font-bold text-[11px] tracking-wide">
                                  {c.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-[#111617] text-[13px]">{c.name}</p>
                                  <p className="text-[11px] text-[#111617]/40">{c.phone}</p>
                                </div>
                              </div>
                              <ChevronDown size={14} className="-rotate-90 text-[#111617]/15 group-hover:text-[#111617]/30 transition-colors" />
                            </div>
                          ))
                          : <div className="text-center py-6 text-[#111617]/30 text-sm">No customers found</div>
                        : recentCustomers.slice(0, 8).map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              updateActiveBill({ customerName: c.name });
                              setIsMobileCustomerSearchOpen(false);
                            }}
                            className="flex items-center justify-between p-2.5 hover:bg-[#F3F5F2] rounded-[12px] cursor-pointer group transition-colors active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#F3F5F2] text-[#111617]/50 flex items-center justify-center font-bold text-[11px] tracking-wide">
                                {c.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-[#111617] text-[13px]">{c.name}</p>
                                <p className="text-[11px] text-[#111617]/40">{c.phone}</p>
                              </div>
                            </div>
                            <ChevronDown size={14} className="-rotate-90 text-[#111617]/15 group-hover:text-[#111617]/30 transition-colors" />
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 pt-3 border-t border-[#F3F5F2] flex items-center justify-between gap-3 bg-white">
                  <button
                    onClick={() => setIsMobileCustomerSearchOpen(false)}
                    className="font-bold text-[#111617]/40 hover:text-[#111617]/60 px-4 py-2.5 transition-colors text-[13px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileCustomerSearchOpen(false);
                      setIsAddCustomerOpen(true);
                    }}
                    className="flex-1 bg-[#88DE7D] hover:bg-[#7cd472] text-[#111617] font-bold py-3 px-5 rounded-[12px] shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-[13px]"
                  >
                    <UserPlus size={16} strokeWidth={2.5} />
                    Add New Customer
                  </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div >
  );
};

export default Billing;