
import { Product, Customer, PaymentMethod, Bill } from './types';

export const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'ImmunoDoc Ras', category: 'Wellness', mrp: 1500, dp: 1200, sp: 10, stock: 45 },
  { id: '2', name: 'Thunderblast Ras', category: 'Energy', mrp: 2100, dp: 1750, sp: 15, stock: 8 },
  { id: '3', name: 'OrthoDoc Oil', category: 'Pain Relief', mrp: 450, dp: 380, sp: 3, stock: 120 },
  { id: '4', name: 'DiaboDoc Ras', category: 'Wellness', mrp: 1400, dp: 1150, sp: 9, stock: 5 },
  { id: '5', name: 'Hair Doc Oil', category: 'Personal Care', mrp: 350, dp: 290, sp: 2, stock: 60 },
  { id: '6', name: 'Dentodoc Cream', category: 'Personal Care', mrp: 180, dp: 150, sp: 1, stock: 200 },
  { id: '7', name: 'CardioDoc Ras', category: 'Heart Care', mrp: 1800, dp: 1450, sp: 12, stock: 2 },
  { id: '8', name: 'GyneDoc Ras', category: 'Women Wellness', mrp: 1600, dp: 1300, sp: 11, stock: 30 },
  { id: '9', name: 'StoneDoc Ras', category: 'Wellness', mrp: 1300, dp: 1100, sp: 8, stock: 12 },
  { id: '10', name: 'LiverDoc Ras', category: 'Wellness', mrp: 1350, dp: 1150, sp: 9, stock: 4 },
  { id: '11', name: 'Herbal Tea', category: 'Beverage', mrp: 250, dp: 200, sp: 1, stock: 150 },
  { id: '12', name: 'Aloe Vera Juice', category: 'Wellness', mrp: 800, dp: 650, sp: 5, stock: 10 },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Rajesh Kumar', phone: '9876543210', totalSpEarned: 150, lastVisit: '2023-10-25' },
  { id: 'c2', name: 'Sita Devi', phone: '9123456789', totalSpEarned: 0, lastVisit: '2023-10-26' },
  { id: 'c3', name: 'Amit Singh', phone: '8888888888', totalSpEarned: 500, lastVisit: '2023-10-20' },
  { id: 'c4', name: 'Sagar Rathod', phone: '9198765432', totalSpEarned: 120, lastVisit: '2023-10-22' },
];

export const EMPTY_BILL: Bill = {
  id: '',
  customerName: '',
  date: new Date().toISOString().split('T')[0],
  time: '',
  items: [],
  isPaid: false,
  paymentMethod: PaymentMethod.CASH,
  cashAmount: 0,
  onlineAmount: 0,
  totalAmount: 0,
  totalSp: 0,
  billingType: 'DP',
};
