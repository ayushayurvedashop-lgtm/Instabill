
export enum ProductStatus {
  GIVEN = 'Given',
  PENDING = 'Pending'
}

export enum PaymentMethod {
  CASH = 'Cash',
  ONLINE = 'Online',
  CREDIT = 'Credit'
}

export type BillingType = 'MRP' | 'DP';

export interface Product {
  id: string;
  name: string;
  category: string;
  mrp: number; // Maximum Retail Price
  dp: number;  // Distributor Price
  sp: number;  // Sales Point
  stock: number;
  imageUrl?: string; // Optional product image URL
}

export interface HandoverEvent {
  date: string;
  quantity: number;
  givenTo?: string; // Optional receiver name
}

export interface BillItem extends Product {
  quantity: number;
  status: ProductStatus;
  pendingQuantity?: number; // Number of items pending (0 = all given, undefined/quantity = all pending)
  handoverLog?: HandoverEvent[];
  currentPrice: number; // calculated based on billing mode
  totalSp: number;
}



export interface SPTracking {
  taskId: string;
  status: 'Pending' | 'Done';
  // We keep this to easily check bill availability
}

export interface SPTask {
  id: string;
  externalId: string;
  status: 'Pending' | 'Done';
  saoSgoStatus: 'SAO' | 'SGO' | '';
  note: string;
  addedAt: string;
  completedAt?: string;
  billIds: string[];
  billSnapshots?: { id: string, customerName: string, totalSp: number, date: string }[]; // Lightweight bill info for display
  totalSp: number;
}

export interface Bill {
  id: string;
  customerName: string;
  date: string;
  time?: string; // Added time field
  items: BillItem[];
  isPaid: boolean;
  paymentMethod: PaymentMethod;
  cashAmount?: number; // Amount paid in cash
  onlineAmount?: number; // Amount paid online
  subTotalAmount?: number; // Amount before discount
  totalAmount: number; // Final amount
  totalSp: number;
  discountType?: 'percentage' | 'amount';
  discountValue?: number;
  discountAmount?: number;
  showSpOnBill?: boolean;
  sendWhatsapp?: boolean;
  billingType: BillingType;
  snapshotUrl?: string; // Kept for backward compatibility
  snapshotData?: string; // Base64 string for temporary storage
  hasSnapshot?: boolean; // Flag to indicate if snapshot exists in Firestore
  spTracking?: SPTracking;
  spUpdatedAmount?: number; // Amount of SP already updated on official site
  spStatus?: 'Pending' | 'Completed'; // Explicit status for SP Manager
  spHistory?: { date: string; amount: number; total: number }[]; // History of updates
  whatsappStatus?: 'Sent' | 'Failed'; // Status of WhatsApp notification
  firestoreId?: string; // Auto-generated ID from Firestore
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalSpEarned: number;
  lastVisit: string;
}

export interface Tab {
  id: string;
  title: string;
  bill: Bill;
}

export interface DetectedProduct {
  name: string;
  quantity: number;
  confidence?: number;
  matchedProductId?: string;
  matchedProduct?: Product;
}

export interface SmartAlertItem {
  product: Product;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  suggestedOrder: number;
  score: number;
}

export interface AppSettings {
  shopName: string;
  shopAddress: string;
  defaultBillingMode: BillingType;
  whatsappEnabled?: boolean; // Toggle to enable/disable all WhatsApp notifications
}

// Cash deductions/withdrawals from the shop
export interface CashDeduction {
  id: string;
  name: string; // Who took the money (e.g., "Wife", "Son", etc.)
  amount: number;
  date: string; // YYYY-MM-DD format
  time: string;
  note?: string;
}

// --- Multi-tenant SaaS Types ---
export interface ShopProfile {
  id: string; // Firestore doc ID (same as shopId)
  shopName: string;
  address: string;
  phone: string;
  ownerUid: string; // Firebase Auth UID
  createdAt: string;
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'suspended';
  planId?: string; // 'basic', 'pro', 'enterprise'
  currentPeriodEnd?: string; // ISO date string
  subscriptionStart?: string; // ISO date string
  subscriptionEnd?: string; // ISO date string
  planDurationMonths?: number; // For enterprise custom duration
}

export interface PlanConfig {
  basicPrice: number;          // e.g. 499 (1 month)
  proPrice: number;            // e.g. 3999 (12 months)
  enterpriseMonthlyPrice: number; // e.g. 399 per month
}
