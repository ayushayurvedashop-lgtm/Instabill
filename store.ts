
import { Bill, Customer, Product, ProductStatus, SmartAlertItem, AppSettings, SPTracking, SPTask, CashDeduction, HandoverEvent } from './types';
import { db } from './firebaseConfig';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  increment,
  deleteDoc,
  deleteField
} from 'firebase/firestore';

// --- LOCAL STORAGE HELPERS ---
const STORAGE_KEYS = {
  BILLS: 'vedabill_bills',
  CUSTOMERS: 'vedabill_customers',
  PRODUCTS: 'vedabill_products',
  SETTINGS: 'vedabill_settings',
  SP_TASKS: 'vedabill_sp_tasks',
  CASH_DEDUCTIONS: 'vedabill_cash_deductions'
};

const loadLocal = (key: string) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error(`Error loading ${key}`, e);
    return [];
  }
};

const saveLocal = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key}`, e);
  }
};

// Initialize State from Local Storage First (Offline/Permission Backup)
let bills: Bill[] = loadLocal(STORAGE_KEYS.BILLS);
let customers: Customer[] = loadLocal(STORAGE_KEYS.CUSTOMERS);
let products: Product[] = loadLocal(STORAGE_KEYS.PRODUCTS);

const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Asclepius Wellness',
  shopAddress: 'Asclepius Wellness, Kolkata',
  defaultBillingMode: 'DP'
};
let settings: AppSettings = { ...DEFAULT_SETTINGS, ...(loadLocal(STORAGE_KEYS.SETTINGS) || {}) };
// Ensure defaultBillingMode is valid (migration for old data)
if (!settings.defaultBillingMode || !['MRP', 'DP'].includes(settings.defaultBillingMode)) {
  settings.defaultBillingMode = 'DP';
  saveLocal(STORAGE_KEYS.SETTINGS, settings); // Persist the fix
}
let spTasks: SPTask[] = loadLocal(STORAGE_KEYS.SP_TASKS);
let cashDeductions: CashDeduction[] = loadLocal(STORAGE_KEYS.CASH_DEDUCTIONS);

let listeners: (() => void)[] = [];
let isOffline = false;

// Helper to notify subscribers
const notify = () => listeners.forEach(l => l());

// Initialize Listeners
const initStore = () => {
  if (!db) {
    console.warn("Firestore database instance is not available.");
    isOffline = true;
    return;
  }

  try {
    // 1. Listen to Bills
    const billsQuery = query(collection(db, 'bills'), orderBy('date', 'desc'));
    onSnapshot(billsQuery, (snapshot) => {
      isOffline = false;
      bills = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, firestoreId: doc.id } as unknown as Bill;
      });
      saveLocal(STORAGE_KEYS.BILLS, bills); // Sync to local
      notify();
    }, (error) => {
      // Quietly handle permission errors and fall back to local mode
      if (error.code === 'permission-denied' || error.code === 'unavailable') {
        console.warn("Cloud sync disabled (Permissions). Using local storage.");
        isOffline = true;
      }
    });

    // 2. Listen to Customers
    onSnapshot(collection(db, 'customers'), (snapshot) => {
      customers = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, firestoreId: doc.id } as unknown as Customer;
      });
      saveLocal(STORAGE_KEYS.CUSTOMERS, customers);
      notify();
    }, (error) => {
      if (error.code === 'permission-denied') isOffline = true;
    });

    // 3. Listen to Products (Inventory)
    onSnapshot(collection(db, 'products'), (snapshot) => {
      products = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as unknown as Product;
      });
      saveLocal(STORAGE_KEYS.PRODUCTS, products);
      notify();
    }, (error) => {
      if (error.code === 'permission-denied') isOffline = true;
    });

    // 4. Listen to Settings
    onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        settings = { ...DEFAULT_SETTINGS, ...docSnap.data() } as AppSettings;
        saveLocal(STORAGE_KEYS.SETTINGS, settings);
        notify();
      }
    });

    // 5. Listen to SP Tasks
    const tasksQuery = query(collection(db, 'sp_tasks'), orderBy('addedAt', 'desc'));
    onSnapshot(tasksQuery, (snapshot) => {
      spTasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as unknown as SPTask;
      });
      saveLocal(STORAGE_KEYS.SP_TASKS, spTasks);
      notify();
    }, (error) => {
      console.warn("SP Tasks sync failed", error);
    });

    // 6. Listen to Cash Deductions
    const deductionsQuery = query(collection(db, 'cash_deductions'), orderBy('date', 'desc'));
    onSnapshot(deductionsQuery, (snapshot) => {
      cashDeductions = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, firestoreId: doc.id } as unknown as CashDeduction;
      });
      saveLocal(STORAGE_KEYS.CASH_DEDUCTIONS, cashDeductions);
      notify();
    }, (error) => {
      console.warn("Cash Deductions sync failed", error);
    });

  } catch (err) {
    console.error("Error initializing Firestore listeners:", err);
    isOffline = true;
  }
};

// Start listening immediately
try {
  initStore();
} catch (e) {
  console.error("Firebase initialization error.", e);
  isOffline = true;
}

export const store = {
  getBills: () => bills,
  getRecentBills: () => {
    return [...bills]
      .sort((a, b) => {
        // Robust Date Parser (Date Only)
        const getDateTimestamp = (dateStr: string) => {
          try {
            let datePart = dateStr;
            // Normalize DD-MM-YYYY to YYYY-MM-DD
            if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
              const [d, m, y] = dateStr.split(/[-/]/);
              datePart = `${y}-${m}-${d}`;
            }
            const d = new Date(datePart);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          } catch { return 0; }
        };

        const dateA = getDateTimestamp(a.date);
        const dateB = getDateTimestamp(b.date);

        // 1. Primary Sort: Date Descending
        if (dateA !== dateB) return dateB - dateA;

        // 2. Secondary Sort (Same Date Strategy)
        const isHashA = a.id.startsWith('#');
        const isHashB = b.id.startsWith('#');

        // Extract numeric ID helper
        const extractNum = (id: string) => {
          const match = id.match(/(\d+)/);
          return match ? parseInt(match[0]) : 0;
        };

        // If both are '#' IDs on the same date, Strict Numeric Sort Descending (Trust ID over Time)
        if (isHashA && isHashB) {
          return extractNum(b.id) - extractNum(a.id);
        }

        // 3. Fallback for non-hash IDs or mixed types: Sort by Time Descending
        const getTimeMinutes = (timeStr: string) => {
          try {
            let hour = 0, minute = 0;
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (timeMatch) {
              let [_, h, m, amp] = timeMatch;
              hour = parseInt(h);
              minute = parseInt(m);
              if (amp) {
                if (amp.toUpperCase() === 'PM' && hour < 12) hour += 12;
                if (amp.toUpperCase() === 'AM' && hour === 12) hour = 0;
              }
            }
            return hour * 60 + minute;
          } catch { return 0; }
        };

        const timeA = getTimeMinutes(a.time);
        const timeB = getTimeMinutes(b.time);

        if (timeA !== timeB) return timeB - timeA;

        // 4. Final Tie-breaker: ID Sort
        if (isHashA && !isHashB) return -1;
        if (!isHashA && isHashB) return 1;

        return extractNum(b.id) - extractNum(a.id);
      })
      .slice(0, 5);
  },
  getCustomers: () => customers,
  getProducts: () => products,
  getSettings: () => settings,
  getSPTasks: () => spTasks,


  getCustomerBills: (customerName: string) => {
    return bills.filter(b => b.customerName === customerName);
  },

  getPendingItems: (customerName: string) => {
    const items: any[] = [];
    bills
      .filter(b => b.customerName === customerName)
      .forEach(b => {
        b.items.forEach(i => {
          if (i.status === ProductStatus.PENDING) {
            items.push({
              ...i,
              billId: b.id,
              billDate: b.date
            });
          }
        });
      });
    return items;
  },

  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  addBill: async (bill: Bill) => {
    // Handle Snapshot Separation
    let snapshotDataToSave: string | undefined = bill.snapshotData;

    // Create a clean bill object for main storage (remove heavy base64 data)
    const billToSave = { ...bill };
    delete billToSave.snapshotData; // Don't save base64 to main bills collection

    // 1. Optimistic Update (Immediate)
    // For local state, we might want to keep the snapshotData if we want to view it immediately?
    // But store.bills usually mirrors the 'light' version.
    // Let's keep it light in memory too to avoid performance issues.
    bills = [billToSave, ...bills];
    saveLocal(STORAGE_KEYS.BILLS, bills);

    // Update local product stock immediately
    bill.items.forEach(item => {
      const pIndex = products.findIndex(p => p.id === item.id);
      if (pIndex > -1) {
        products[pIndex].stock -= item.quantity;
      }
    });
    saveLocal(STORAGE_KEYS.PRODUCTS, products);

    // Update local customer stats immediately
    const cIndex = customers.findIndex(c => c.name === bill.customerName);
    if (cIndex > -1) {
      customers[cIndex].totalSpEarned += bill.totalSp;
      customers[cIndex].lastVisit = bill.date;
      saveLocal(STORAGE_KEYS.CUSTOMERS, customers);
    }

    notify();

    // 2. Cloud Sync (Background)
    if (isOffline || !db) return;

    try {
      const batch = writeBatch(db);

      // A. Save Bill
      const billRef = doc(collection(db, 'bills')); // Auto-ID or use bill.id?
      // The bill object usually has an ID from the frontend.
      // If bill.id is set (INV-...), we should probably use that as document ID or just a field?
      // Existing code used addDoc which generates a new ID.
      // But we need the ID to link the snapshot.
      // Let's use setDoc with the bill.id if possible, OR use the generated ID.
      // Since existing code used addDoc, let's stick to that pattern BUT we need the ID for the snapshot.
      // Actually, let's use the bill.id (INV-...) as the document ID for the snapshot.
      // But wait, Firestore IDs must be unique. INV IDs are unique.

      // Let's use addDoc for the bill as before to be safe with existing logic,
      // BUT we need to link the snapshot.
      // The bill has an 'id' field (e.g. INV-2024-001). We can use that.

      await addDoc(collection(db, 'bills'), billToSave);

      // B. Save Snapshot (if exists)
      if (snapshotDataToSave) {
        // Use the Bill's visible ID (e.g. INV-2024-001) as the key for the snapshot document
        // This makes it easy to find.
        const snapshotRef = doc(db, 'bill_snapshots', bill.id);
        batch.set(snapshotRef, {
          billId: bill.id,
          image: snapshotDataToSave,
          createdAt: new Date().toISOString()
        });
      }

      // C. Update Customer Stats
      const customer = customers.find(c => c.name === bill.customerName);
      if (customer && (customer as any).firestoreId) {
        const customerRef = doc(db, 'customers', (customer as any).firestoreId);
        batch.update(customerRef, {
          totalSpEarned: (customer.totalSpEarned || 0) + bill.totalSp,
          lastVisit: bill.date
        });
      }

      // D. Deduct Stock
      bill.items.forEach(async (item) => {
        // We must fetch the latest stock from cloud before decrementing to avoid overwriting 
        // updates made by other clients or race conditions.
        // However, we are in a batch commit. We cannot read in a write batch.
        // But we can blindly decrement using 'increment(-qty)' which is safe and atomic.
        // The existing code ALREADY DOES THIS: batch.update(productRef, { stock: increment(-item.quantity) });
        // So the Cloud logic is correct.

        // The issue described by user ("resets to 50") sounds like the local state 'products' 
        // is having its stock reset or the `addBill` function is using an old product object?

        // Wait, looking at lines 172-177 (Local Update):
        // bill.items.forEach(item => {
        //   const pIndex = products.findIndex(p => p.id === item.id);
        //   if (pIndex > -1) {
        //     products[pIndex].stock -= item.quantity;
        //   }
        // });

        // If 'products' contains stale data (e.g. from local storage load that defaulted to 50),
        // then subtracting 1 from 50 gives 49, overwriting the "1" the user saw.

        // But how did the user "set stock to 1"? 
        // If they updated it via UI, it calls 'updateProduct' which updates local `products` AND cloud.
        // So `products` in memory SHOULD be correct (1).

        // Unless... `initStore` (lines 96-103) is receiving a snapshot that somehow reverts it?
        // Or if the initial load (lines 48) loaded old data?

        // Let's ensure strict atomic updates in cloud. 
        // The code below IS using atomic increment.
        const product = products.find(p => p.id === item.id);
        if (product) {
          const productRef = doc(db, 'products', product.id);
          batch.update(productRef, { stock: increment(-item.quantity) });
        }
      });

      await batch.commit();
      console.log("Bill and snapshot synced to cloud successfully");

    } catch (error) {
      console.warn("Cloud sync failed (Bill saved locally)", error);
    }
  },

  deleteBill: async (id: string) => {
    // 1. Find bill
    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    // 2. Revert Stock (Add back)
    bill.items.forEach(item => {
      const pIndex = products.findIndex(p => p.id === item.id);
      if (pIndex > -1) {
        products[pIndex].stock += item.quantity;
      }
    });
    saveLocal(STORAGE_KEYS.PRODUCTS, products);

    // 3. Revert Customer Stats
    const cIndex = customers.findIndex(c => c.name === bill.customerName);
    if (cIndex > -1) {
      customers[cIndex].totalSpEarned -= bill.totalSp;
      saveLocal(STORAGE_KEYS.CUSTOMERS, customers);
    }

    // 4. Remove Bill
    bills = bills.filter(b => b.id !== id);
    saveLocal(STORAGE_KEYS.BILLS, bills);
    notify();

    // 5. Cloud Sync
    if (isOffline || !db) return;

    try {
      const batch = writeBatch(db);

      // Delete Bill
      const firestoreId = (bill as any).firestoreId;
      if (firestoreId) {
        batch.delete(doc(db, 'bills', firestoreId));
      }

      // Delete Snapshot
      batch.delete(doc(db, 'bill_snapshots', bill.id));

      // Update Products
      bill.items.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) {
          batch.update(doc(db, 'products', product.id), { stock: product.stock });
        }
      });

      // Update Customer
      if (cIndex > -1) {
        const customer = customers[cIndex];
        const cRef = (customer as any).firestoreId ? doc(db, 'customers', (customer as any).firestoreId) : null;
        if (cRef) {
          batch.update(cRef, { totalSpEarned: customer.totalSpEarned });
        }
      }

      await batch.commit();
      console.log("Bill deleted and stock reverted");

    } catch (e) {
      console.error("Delete bill failed", e);
    }
  },

  updateBill: async (updatedBill: Bill) => {
    // 1. Find old bill to calculate stock differences
    const oldBillIndex = bills.findIndex(b => b.id === updatedBill.id);
    if (oldBillIndex === -1) {
      console.error("Bill not found for update");
      return;
    }
    const oldBill = bills[oldBillIndex];

    // 2. Revert stock for old items
    oldBill.items.forEach(item => {
      const pIndex = products.findIndex(p => p.id === item.id);
      if (pIndex > -1) {
        products[pIndex].stock += item.quantity;
      }
    });

    // 3. Deduct stock for new items
    updatedBill.items.forEach(item => {
      const pIndex = products.findIndex(p => p.id === item.id);
      if (pIndex > -1) {
        products[pIndex].stock -= item.quantity;
      }
    });
    saveLocal(STORAGE_KEYS.PRODUCTS, products);

    // 4. Update Customer Stats
    // Revert old stats
    const cIndex = customers.findIndex(c => c.name === oldBill.customerName);
    if (cIndex > -1) {
      customers[cIndex].totalSpEarned -= oldBill.totalSp;
    }
    // Apply new stats
    const newCIndex = customers.findIndex(c => c.name === updatedBill.customerName);
    if (newCIndex > -1) {
      customers[newCIndex].totalSpEarned += updatedBill.totalSp;
      customers[newCIndex].lastVisit = updatedBill.date;
    }
    saveLocal(STORAGE_KEYS.CUSTOMERS, customers);

    // 5. Update Bill in memory
    let snapshotDataToSave: string | undefined = updatedBill.snapshotData;
    const billToSave = { ...updatedBill };
    delete billToSave.snapshotData;

    // Preserve firestoreId if it exists on the old bill object in memory
    // (The updatedBill coming from UI might not have it if it was constructed from state)
    if ((oldBill as any).firestoreId) {
      (billToSave as any).firestoreId = (oldBill as any).firestoreId;
    }

    bills[oldBillIndex] = billToSave;
    saveLocal(STORAGE_KEYS.BILLS, bills);
    notify();

    // 6. Cloud Sync
    if (isOffline || !db) return;

    try {
      const batch = writeBatch(db);

      // Update Bill
      const firestoreId = (billToSave as any).firestoreId;
      if (firestoreId) {
        const billRef = doc(db, 'bills', firestoreId);
        batch.update(billRef, billToSave);
      }

      // Update Snapshot if changed
      if (snapshotDataToSave) {
        const snapshotRef = doc(db, 'bill_snapshots', updatedBill.id);
        batch.set(snapshotRef, {
          billId: updatedBill.id,
          image: snapshotDataToSave,
          createdAt: new Date().toISOString()
        });
      }

      // Update Products Stock (Cloud)
      const affectedProductIds = new Set([
        ...oldBill.items.map(i => i.id),
        ...updatedBill.items.map(i => i.id)
      ]);

      affectedProductIds.forEach(pid => {
        const product = products.find(p => p.id === pid);
        if (product) {
          const pRef = doc(db, 'products', pid);
          batch.update(pRef, { stock: product.stock });
        }
      });

      // Update Customer (Cloud)
      if (cIndex > -1 && customers[cIndex] && (customers[cIndex] as any).firestoreId) {
        const cRef = doc(db, 'customers', (customers[cIndex] as any).firestoreId);
        batch.update(cRef, { totalSpEarned: customers[cIndex].totalSpEarned });
      }
      if (newCIndex > -1 && newCIndex !== cIndex && customers[newCIndex] && (customers[newCIndex] as any).firestoreId) {
        const cRef = doc(db, 'customers', (customers[newCIndex] as any).firestoreId);
        batch.update(cRef, {
          totalSpEarned: customers[newCIndex].totalSpEarned,
          lastVisit: customers[newCIndex].lastVisit
        });
      }

      await batch.commit();
      console.log("Bill updated successfully in cloud");

    } catch (e) {
      console.error("Cloud update failed", e);
    }
  },

  updateBillItemStatus: async (billId: string, itemId: string, newStatus: string) => {
    // 1. Local Update
    const billIndex = bills.findIndex(b => b.id === billId);
    if (billIndex > -1) {
      const updatedItems = bills[billIndex].items.map(item =>
        item.id === itemId ? { ...item, status: newStatus as ProductStatus } : item
      );
      bills[billIndex] = { ...bills[billIndex], items: updatedItems };
      saveLocal(STORAGE_KEYS.BILLS, bills);
      notify();

      if (isOffline || !db) return;
      const bill = bills[billIndex];
      if ((bill as any).firestoreId) {
        const billRef = doc(db, 'bills', (bill as any).firestoreId);
        try {
          await updateDoc(billRef, { items: updatedItems });
        } catch (error) {
          console.warn("Cloud sync failed (Status update)", error);
        }
      }
    }
  },

  recordHandover: async (billId: string, itemId: string, quantityGiven: number, givenTo?: string) => {
    // 1. Local Update
    const billIndex = bills.findIndex(b => b.id === billId);
    if (billIndex > -1) {
      const bill = bills[billIndex];
      const updatedItems = bill.items.map(item => {
        if (item.id === itemId) {
          const currentPending = item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity;
          const newPending = Math.max(0, currentPending - quantityGiven);
          const newStatus = newPending === 0 ? ProductStatus.GIVEN : ProductStatus.PENDING;

          const newLogEntry: HandoverEvent = {
            date: new Date().toISOString(),
            quantity: quantityGiven,
            givenTo: givenTo
          };

          return {
            ...item,
            pendingQuantity: newPending,
            status: newStatus,
            handoverLog: [...(item.handoverLog || []), newLogEntry]
          };
        }
        return item;
      });

      bills[billIndex] = { ...bill, items: updatedItems };
      saveLocal(STORAGE_KEYS.BILLS, bills);
      notify();

      // 2. Cloud Update
      if (isOffline || !db) return;
      if ((bill as any).firestoreId) {
        const billRef = doc(db, 'bills', (bill as any).firestoreId);
        try {
          await updateDoc(billRef, { items: updatedItems });
        } catch (error) {
          console.warn("Cloud sync failed (Handover update)", error);
        }
      }
    }
  },

  revertHandover: async (billId: string, itemId: string, logIndex: number) => {
    // 1. Local Update
    const billIndex = bills.findIndex(b => b.id === billId);
    if (billIndex > -1) {
      const bill = bills[billIndex];
      const updatedItems = bill.items.map(item => {
        if (item.id === itemId && item.handoverLog && item.handoverLog[logIndex]) {
          const logEntry = item.handoverLog[logIndex];
          const restoredQty = logEntry.quantity;

          const currentPending = item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity;
          const newPending = currentPending + restoredQty;

          // If pending > 0, status is PENDING. Even if it was GIVEN.
          // Note: Ideally check if newPending == item.quantity -> but status PENDING covers both partial and full pending.
          // If we want accurate status (e.g. if we revert a partial and it becomes full pending), ProductStatus.PENDING is correct.
          const newStatus = ProductStatus.PENDING;

          const newLog = [...item.handoverLog];
          newLog.splice(logIndex, 1);

          return {
            ...item,
            pendingQuantity: newPending,
            status: newStatus,
            handoverLog: newLog
          };
        }
        return item;
      });

      bills[billIndex] = { ...bill, items: updatedItems };
      saveLocal(STORAGE_KEYS.BILLS, bills);
      notify();

      // 2. Cloud Update
      if (isOffline || !db) return;
      if ((bill as any).firestoreId) {
        const billRef = doc(db, 'bills', (bill as any).firestoreId);
        try {
          await updateDoc(billRef, { items: updatedItems });
        } catch (error) {
          console.warn("Cloud sync failed (Revert Handover)", error);
        }
      }
    }
  },

  addCustomer: async (customer: Customer) => {
    // 1. Local Update
    customers = [...customers, customer];
    saveLocal(STORAGE_KEYS.CUSTOMERS, customers);
    notify();

    if (isOffline || !db) return;
    try {
      await addDoc(collection(db, 'customers'), customer);
    } catch (error) {
      console.warn("Cloud sync failed (Customer saved locally)", error);
    }
  },

  updateCustomer: async (updatedCustomer: Customer) => {
    // 1. Local Update
    const index = customers.findIndex(c => c.id === updatedCustomer.id);
    if (index > -1) {
      customers[index] = updatedCustomer;
      saveLocal(STORAGE_KEYS.CUSTOMERS, customers);
      notify();

      if (isOffline || !db) return;

      // If it's a locally created customer without a firestoreId yet, we can't update cloud easily
      // But typically we should have firestoreId if it synced.
      // If we don't have firestoreId, we might need to find by other means or just skip.
      // Assuming 'firestoreId' is attached during load.
      const firestoreId = (updatedCustomer as any).firestoreId;
      if (firestoreId) {
        try {
          const customerRef = doc(db, 'customers', firestoreId);
          await updateDoc(customerRef, { ...updatedCustomer } as any);
        } catch (error) {
          console.warn("Cloud sync failed (Customer update)", error);
        }
      }
    }
  },

  deleteCustomer: async (id: string) => {
    // 1. Local
    // Find the customer first to get firestoreId if needed
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    customers = customers.filter(c => c.id !== id);
    saveLocal(STORAGE_KEYS.CUSTOMERS, customers);
    notify();

    // 2. Cloud
    if (isOffline || !db) return;
    const firestoreId = (customer as any).firestoreId;
    if (firestoreId) {
      try {
        await deleteDoc(doc(db, 'customers', firestoreId));
      } catch (e) {
        console.warn("Cloud delete failed", e);
      }
    }
  },

  addProduct: async (product: Omit<Product, 'id'>) => {
    // 1. Local Update
    const tempId = `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newProduct = { ...product, id: tempId };
    products = [...products, newProduct];
    saveLocal(STORAGE_KEYS.PRODUCTS, products);
    notify();

    if (isOffline || !db) return;
    try {
      await addDoc(collection(db, 'products'), product);
    } catch (error) {
      console.warn("Cloud sync failed (Product saved locally)", error);
    }
  },

  updateProduct: async (updatedProduct: Product) => {
    // 1. Local Update
    const index = products.findIndex(p => p.id === updatedProduct.id);
    if (index > -1) {
      products[index] = updatedProduct;
      saveLocal(STORAGE_KEYS.PRODUCTS, products);
      notify();

      if (isOffline || !db) return;

      // Skip cloud update for temp IDs (only 'prod-' which awaits a real Firestore ID)
      // We ALLOW 'imported-' IDs because bulkUpsert explicitly uses them as Firestore Document keys.
      if (updatedProduct.id.includes('prod-')) {
        console.warn("Skipping cloud update for locally created ID (wait for sync)");
        return;
      }

      try {
        const productRef = doc(db, 'products', updatedProduct.id);
        await updateDoc(productRef, {
          name: updatedProduct.name,
          category: updatedProduct.category,
          mrp: updatedProduct.mrp,
          dp: updatedProduct.dp,
          sp: updatedProduct.sp,
          stock: updatedProduct.stock
        });
      } catch (error) {
        console.warn("Cloud sync failed (Product update)", error);
      }
    }
  },

  deleteProduct: async (id: string) => {
    // 1. Local
    products = products.filter(p => p.id !== id);
    saveLocal(STORAGE_KEYS.PRODUCTS, products);
    notify();

    // 2. Cloud
    if (isOffline || !db) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (e) {
      console.warn("Cloud delete failed", e);
    }
  },

  clearProducts: async () => {
    // 1. Local
    products = [];
    saveLocal(STORAGE_KEYS.PRODUCTS, products);
    notify();

    // 2. Cloud
    if (isOffline || !db) return;
    try {
      const snapshot = await getDocs(collection(db, 'products'));

      // Batch delete in chunks of 400 (Firestore limit is 500)
      const chunk = 400;
      for (let i = 0; i < snapshot.docs.length; i += chunk) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + chunk).forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Failed to clear products from cloud", e);
    }
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    // 1. Local Update
    settings = { ...settings, ...newSettings };
    saveLocal(STORAGE_KEYS.SETTINGS, settings);
    notify();

    // 2. Cloud Update
    if (isOffline || !db) return;
    try {
      const settingsRef = doc(db, 'settings', 'general');
      // setDoc with merge: true handles both creation and update
      await setDoc(settingsRef, newSettings, { merge: true });
    } catch (e) {
      console.warn("Cloud sync failed (Settings)", e);
    }
  },

  // Batch import for catalog - Smart Upsert
  bulkUpsertProducts: async (newItems: Omit<Product, 'id'>[]) => {
    const batch = db && !isOffline ? writeBatch(db) : null;
    let addedCount = 0;
    let updatedCount = 0;

    newItems.forEach(item => {
      const existingProduct = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());

      if (existingProduct) {
        // UPDATE existing product prices, keep stock and id
        const updatedProduct = {
          ...existingProduct,
          mrp: item.mrp,
          dp: item.dp,
          sp: item.sp,
          category: item.category // update category if changed
        };

        // Local Update
        products = products.map(p => p.id === existingProduct.id ? updatedProduct : p);
        updatedCount++;

        // Cloud Update
        if (batch) {
          const ref = doc(db, 'products', existingProduct.id);
          batch.update(ref, { mrp: item.mrp, dp: item.dp, sp: item.sp, category: item.category });
        }
      } else {
        // ADD New Product
        const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newProduct = { ...item, id: newId };

        // Local Update
        products = [...products, newProduct];
        addedCount++;

        // Cloud Update
        if (batch) {
          const ref = doc(db, 'products', newId);
          batch.set(ref, newProduct);
        }
      }
    });

    saveLocal(STORAGE_KEYS.PRODUCTS, products);
    notify();

    if (batch) {
      try {
        await batch.commit();
      } catch (e) {
        console.error("Bulk sync failed", e);
      }
    }

    return { added: addedCount, updated: updatedCount };
  },

  getSmartStockSuggestions: (budget: number = 300000) => {
    const lowStockThreshold = 20;
    const suggestions: SmartAlertItem[] = [];
    let currentTotalCost = 0;

    // 1. Identify Candidates
    const candidates = products.filter(p => {
      const pending = 0; // TODO: We need real pending count. Store has getPendingItems but iterating potentially slow.
      // Optimizing: Let's assume for now we scan bills or just use stock/price for speed, 
      // but the requirement explicitly asked for pending.
      // Let's do a quick pass for pending if feasible, OR usage `getPendingItems` per product is too O(N^2).
      // Better: Build a map of pending items first.
      return p.stock < lowStockThreshold;
    });

    // 1b. Build Pending Map (Optimize performance)
    const pendingMap: Record<string, number> = {};
    bills.forEach(b => {
      b.items.forEach(i => {
        if (i.status === ProductStatus.PENDING) {
          pendingMap[i.name] = (pendingMap[i.name] || 0) + i.quantity;
        }
      });
    });

    // 2. Score Candidates
    // Include products that might have stock >= 20 but HAVE pending orders
    const allProductsOfInterest = products.filter(p => p.stock < lowStockThreshold || (pendingMap[p.name] || 0) > 0);

    const scoredItems = allProductsOfInterest.map(p => {
      const pending = pendingMap[p.name] || 0;
      const stockGap = Math.max(0, lowStockThreshold - p.stock);

      // Price efficiency: Lower price = Higher score.
      // Avoid division by zero. Cap at 1 if price is 0 (shouldn't happen for real products).
      const priceScore = p.dp > 0 ? (100000 / p.dp) : 0;

      // Weighting:
      // Pending is critical: 10,000 pts per pending unit
      // Stock gap is important: 100 pts per missing unit
      // Price is tie-breaker/efficiency: Variable
      const score = (pending * 10000) + (stockGap * 100) + priceScore;

      return {
        product: p,
        pending,
        score
      };
    });

    // 3. Sort by Score
    scoredItems.sort((a, b) => b.score - a.score);

    // 4. Select items within budget
    for (const item of scoredItems) {
      if (currentTotalCost >= budget) break;

      // Suggest quantity: 
      // If pending, cover pending + buffer. 
      // If just low stock, bring to threshold + buffer.
      // Let's say target is 30.
      const targetStock = 30;
      let suggestedQty = Math.max(0, targetStock - item.product.stock);

      // Adjust for pending
      if (item.pending > 0) {
        suggestedQty = Math.max(suggestedQty, item.pending + 10); // Cover pending + 10 buffer
      }

      if (suggestedQty <= 0) continue;

      const estimatedCost = suggestedQty * item.product.dp;

      // Logic for Priority Label
      let priority: 'High' | 'Medium' | 'Low' = 'Low';
      if (item.pending > 0 || item.product.stock <= 5) priority = 'High';
      else if (item.product.stock < 15) priority = 'Medium';

      // Logic for Reason
      let reason = '';
      if (item.pending > 0) reason = `${item.pending} Pending Orders`;
      else if (item.product.stock === 0) reason = 'Out of Stock';
      else if (item.product.stock < 5) reason = 'Critical Level';
      else reason = 'Restock Needed';

      if (item.product.dp < 500 && item.product.stock < 15) reason += ' (Efficient buy)';

      suggestions.push({
        product: item.product,
        priority,
        reason,
        suggestedOrder: suggestedQty,
        score: item.score
      });

      currentTotalCost += estimatedCost;
    }

    return suggestions;
  },

  resetDatabase: async (includeCloud: boolean = false) => {
    // 1. Clear Local Storage
    localStorage.removeItem(STORAGE_KEYS.BILLS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);

    // 2. Clear Memory
    bills = [];
    customers = [];
    products = [];
    notify();

    // 3. Clear Cloud (if permissions allow)
    if (includeCloud && !isOffline && db) {
      try {
        const billsSnap = await getDocs(collection(db, 'bills'));
        const custSnap = await getDocs(collection(db, 'customers'));
        const prodSnap = await getDocs(collection(db, 'products'));

        const deletePromises = [
          ...billsSnap.docs.map(d => deleteDoc(d.ref)),
          ...custSnap.docs.map(d => deleteDoc(d.ref)),
          ...prodSnap.docs.map(d => deleteDoc(d.ref))
        ];

        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
        }
        return { success: true, message: "Local and Cloud data successfully wiped." };
      } catch (error) {
        console.error("Cloud wipe failed (Permissions)", error);
        return { success: false, message: "Local data cleared. Cloud wipe failed due to permissions." };
      }
    }

    return { success: true, message: "Local data cleared successfully." };
  },

  // --- SP TASK MANAGEMENT (NEW) ---

  createSPTask: async (task: SPTask) => {
    // 1. Local Update
    spTasks = [task, ...spTasks];

    // Update linked bills locally
    bills = bills.map(b => {
      if (task.billIds.includes(b.id)) {
        return { ...b, spTracking: { taskId: task.id, status: 'Pending' } };
      }
      return b;
    });

    saveLocal(STORAGE_KEYS.SP_TASKS, spTasks);
    saveLocal(STORAGE_KEYS.BILLS, bills);
    notify();

    // 2. Cloud Update
    if (isOffline || !db) return;

    try {
      const batch = writeBatch(db);

      // A. Create Task Doc
      const taskRef = doc(db, 'sp_tasks', task.id);
      batch.set(taskRef, task);

      // B. Update Bills
      task.billIds.forEach(id => {
        const bill = bills.find(b => b.id === id);
        if (bill && (bill as any).firestoreId) {
          const billRef = doc(db, 'bills', (bill as any).firestoreId);
          batch.update(billRef, { spTracking: { taskId: task.id, status: 'Pending' } });
        }
      });

      await batch.commit();
      console.log(`SP Task ${task.id} created successfully`);
    } catch (e) {
      console.error("Failed to create SP Task in cloud", e);
    }
  },

  updateSPTask: async (taskId: string, updates: Partial<SPTask>) => {
    // 1. Local
    const taskIndex = spTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const oldTask = spTasks[taskIndex];
    const newTask = { ...oldTask, ...updates };
    spTasks[taskIndex] = newTask;

    // If status changed, update bills too
    if (updates.status) {
      bills = bills.map(b => {
        if (newTask.billIds.includes(b.id) && b.spTracking) {
          return { ...b, spTracking: { ...b.spTracking, status: updates.status! } };
        }
        return b;
      });
      saveLocal(STORAGE_KEYS.BILLS, bills);
    }

    saveLocal(STORAGE_KEYS.SP_TASKS, spTasks);
    notify();

    // 2. Cloud
    if (isOffline || !db) return;
    try {
      const batch = writeBatch(db);
      const taskRef = doc(db, 'sp_tasks', taskId);
      batch.update(taskRef, updates);

      if (updates.status) {
        newTask.billIds.forEach(id => {
          const bill = bills.find(b => b.id === id);
          if (bill && (bill as any).firestoreId) {
            const billRef = doc(db, 'bills', (bill as any).firestoreId);
            batch.update(billRef, { 'spTracking.status': updates.status });
          }
        });
      }
      await batch.commit();
    } catch (e) {
      console.error("Failed to update SP Task", e);
    }
  },

  deleteSPTask: async (taskId: string) => {
    // 1. Local
    const task = spTasks.find(t => t.id === taskId);
    if (!task) return;

    spTasks = spTasks.filter(t => t.id !== taskId);

    // Release bills
    bills = bills.map(b => {
      if (task.billIds.includes(b.id)) {
        const newBill = { ...b };
        delete newBill.spTracking;
        return newBill;
      }
      return b;
    });

    saveLocal(STORAGE_KEYS.SP_TASKS, spTasks);
    saveLocal(STORAGE_KEYS.BILLS, bills);
    notify();

    // 2. Cloud
    if (isOffline || !db) return;
    try {
      const batch = writeBatch(db);

      // Delete task doc
      batch.delete(doc(db, 'sp_tasks', taskId));

      // Update bills
      task.billIds.forEach(id => {
        const bill = bills.find(b => b.id === id);
        if (bill && (bill as any).firestoreId) {
          const billRef = doc(db, 'bills', (bill as any).firestoreId);
          batch.update(billRef, { spTracking: deleteField() });
        }
      });

      await batch.commit();
    } catch (e) {
      console.error("Failed to create SP Task", e);
    }
  },

  // --- Cash Deductions ---
  getCashDeductions: () => cashDeductions,

  getTodayCashDeductions: () => {
    const today = new Date().toISOString().split('T')[0];
    return cashDeductions.filter(d => d.date === today);
  },

  addCashDeduction: async (deduction: Omit<CashDeduction, 'id'>) => {
    const newDeduction: CashDeduction = {
      ...deduction,
      id: `ded-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };

    // Local update
    cashDeductions = [newDeduction, ...cashDeductions];
    saveLocal(STORAGE_KEYS.CASH_DEDUCTIONS, cashDeductions);
    notify();

    // Cloud sync
    if (isOffline || !db) return;
    try {
      await addDoc(collection(db, 'cash_deductions'), newDeduction);
    } catch (e) {
      console.warn('Cloud sync failed (deduction saved locally)', e);
    }
  },

  deleteCashDeduction: async (id: string) => {
    // Find deduction first
    const deduction = cashDeductions.find(d => d.id === id);
    if (!deduction) return;

    // Local update
    cashDeductions = cashDeductions.filter(d => d.id !== id);
    saveLocal(STORAGE_KEYS.CASH_DEDUCTIONS, cashDeductions);
    notify();

    // Cloud sync
    if (isOffline || !db) return;
    const firestoreId = (deduction as any).firestoreId;
    if (firestoreId) {
      try {
        await deleteDoc(doc(db, 'cash_deductions', firestoreId));
      } catch (e) {
        console.warn('Cloud delete failed', e);
      }
    }
  }
};
