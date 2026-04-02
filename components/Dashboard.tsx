import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, PieChart, ShoppingCart, Users, Calendar, MoreHorizontal, ChevronLeft, ChevronRight, Printer, Banknote, Smartphone, Crown, Package, AlertTriangle } from 'lucide-react';
import { store } from '../store';
import { Product, Bill, ShopProfile, ProductStatus } from '../types';
import { getLocalDateString } from '../lib/utils';
import BillDetailModal from './BillDetailModal';
import DailyStatsModal from './DailyStatsModal';
import TodayOverview from './TodayOverview';

interface AggregatedPendingProduct {
  productId: string;
  name: string;
  totalPendingQty: number;
  price: number; // MRP
  totalValue: number; // price × totalPendingQty
  priority: 'High' | 'Medium' | 'Low';
  billCount: number; // how many bills reference this product as pending
}

interface DashboardProps {
  setActiveView?: (view: string) => void;
  onEditBill?: (bill: Bill) => void;
  searchQuery?: string;
  shopProfile?: ShopProfile | null;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveView, onEditBill, searchQuery = '', shopProfile }) => {
  const [timeRange, setTimeRange] = useState<'Week' | 'Month' | 'Year' | 'Custom'>('Month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<'All' | 'Pending' | 'Paid'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Responsive chart height - 200px on mobile, 250px on desktop
  const [chartHeight, setChartHeight] = useState(typeof window !== 'undefined' && window.innerWidth >= 768 ? 250 : 200);

  // Subscription Warning State
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setChartHeight(window.innerWidth >= 768 ? 250 : 200);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial value
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check Subscription Expiry
  useEffect(() => {
    if (shopProfile?.subscriptionEnd) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const end = new Date(shopProfile.subscriptionEnd);
      const now = new Date();
      const remaining = Math.ceil((end.getTime() - now.getTime()) / msPerDay);

      if (remaining <= 20 && remaining > 0) {
        setDaysRemaining(remaining);
        
        // Show the banner persistently if within 20 days
        setShowExpiryWarning(true);
        
        // Check if user dismissed it *just for this session*
        // We removed localStorage here as requested, so it shows on refresh.
        // It will only hide if the user clicks X during the *current* session/page load.
      }
    }
  }, [shopProfile]);

  const dismissWarning = () => {
      setShowExpiryWarning(false);
  };

  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>(store.getProducts());
  const [stats, setStats] = useState({
    revenue: 0,
    sp: 0,
    sold: 0,
  });
  const [todayStats, setTodayStats] = useState({
    revenue: 0,
    cashTotal: 0,
    onlineTotal: 0,
    totalSp: 0,
    billCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    activeClients: 0,
    newClients: 0,
  });
  const [showDailyStats, setShowDailyStats] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billDates, setBillDates] = useState<Set<string>>(new Set());
  const [pendingProducts, setPendingProducts] = useState<AggregatedPendingProduct[]>([]);
  const [showAllPending, setShowAllPending] = useState(false);

  useEffect(() => {
    const updateState = () => {
      const allBills = store.getBills();
      const currentProducts = store.getProducts();
      const now = new Date();

      // Helper functions
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

      // Normalize date to YYYY-MM-DD format for consistent comparison
      const normalizeDateStr = (dateStr: string): string => {
        try {
          // Handle DD-MM-YYYY or DD/MM/YYYY format
          if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
            const [d, m, y] = dateStr.split(/[-/]/);
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          // Already in YYYY-MM-DD format
          return dateStr;
        } catch { return dateStr; }
      };

      const getDateTimestamp = (dateStr: string) => {
        try {
          const normalized = normalizeDateStr(dateStr);
          const date = new Date(normalized);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        } catch { return 0; }
      };

      // Track which dates have bill data
      const datesWithData = new Set<string>();
      allBills.forEach(b => {
        const normalized = normalizeDateStr(b.date);
        datesWithData.add(normalized);
      });
      setBillDates(datesWithData);

      // Calculate Time Range Bills
      let chartSourceBills = [...allBills];
      let chartDataPoints: any[] = [];

      switch (timeRange) {
        case 'Week': {
          const start = new Date(now);
          start.setDate(now.getDate() - 6);
          start.setHours(0, 0, 0, 0);
          chartSourceBills = allBills.filter(b => new Date(b.date) >= start);

          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dateStr = getLocalDateString(d);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayBills = chartSourceBills.filter(b => b.date === dateStr);
            const total = dayBills.reduce((acc, b) => acc + b.totalAmount, 0);
            chartDataPoints.push({ day: dayName, amount: total });
          }
          break;
        }
        case 'Month': {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          chartSourceBills = allBills.filter(b => new Date(b.date) >= start);

          const daysInMonth = now.getDate();
          for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), i);
            const dateStr = getLocalDateString(d);
            const dayLabel = `${d.getDate()}`;
            const dayBills = chartSourceBills.filter(b => b.date === dateStr);
            const total = dayBills.reduce((acc, b) => acc + b.totalAmount, 0);
            chartDataPoints.push({ day: dayLabel, amount: total });
          }
          break;
        }
        case 'Year': {
          const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
          chartSourceBills = allBills.filter(b => new Date(b.date) >= start);

          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = d.toLocaleDateString('en-US', { month: 'short' });
            const monthIndex = d.getMonth();
            const year = d.getFullYear();
            const monthBills = chartSourceBills.filter(b => {
              const bDate = new Date(b.date);
              return bDate.getMonth() === monthIndex && bDate.getFullYear() === year;
            });
            const total = monthBills.reduce((acc, b) => acc + b.totalAmount, 0);
            chartDataPoints.push({ day: monthName, amount: total });
          }
          break;
        }
        case 'Custom': {
          if (selectedDate) {
            // Format selected date as YYYY-MM-DD
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const selectedDateStr = `${year}-${month}-${day}`;

            // Filter bills for this exact date
            chartSourceBills = allBills.filter(b => {
              const normalizedBillDate = normalizeDateStr(b.date);
              return normalizedBillDate === selectedDateStr;
            });

            // Show hourly data for single day
            for (let i = 9; i <= 21; i++) {
              const hourLabel = `${i > 12 ? i - 12 : i} ${i >= 12 ? 'PM' : 'AM'}`;
              const hourBills = chartSourceBills.filter(b => {
                if (!b.time) return false;
                const hour = parseInt(b.time.split(':')[0]);
                const isPM = b.time.toLowerCase().includes('pm');
                const normalizedHour = (isPM && hour !== 12) ? hour + 12 : (hour === 12 && !isPM ? 0 : hour);
                return normalizedHour === i;
              });
              const total = hourBills.reduce((acc, b) => acc + b.totalAmount, 0);
              chartDataPoints.push({ day: hourLabel, amount: total });
            }
          }
          break;
        }
      }

      setChartData(chartDataPoints);

      // Stats from time range
      const totalRevenue = chartSourceBills.reduce((acc, b) => acc + b.totalAmount, 0);
      const totalSp = chartSourceBills.reduce((acc, b) => acc + b.totalSp, 0);
      const totalSold = chartSourceBills.reduce((acc, b) => acc + b.items.reduce((sum, i) => sum + i.quantity, 0), 0);
      setStats({ revenue: totalRevenue, sp: totalSp, sold: totalSold });

      // Today's stats
      const today = startOfDay(now);
      const todayBills = allBills.filter(b => new Date(b.date) >= today);
      const todayRevenue = todayBills.reduce((acc, b) => acc + b.totalAmount, 0);

      // Calculate cash/online with backward compatibility for old bills
      const todayCash = todayBills.reduce((acc, b) => {
        if (b.cashAmount !== undefined && b.cashAmount !== null) {
          return acc + b.cashAmount;
        }
        if (b.paymentMethod === 'Cash') {
          return acc + b.totalAmount;
        }
        return acc;
      }, 0);

      const todayOnline = todayBills.reduce((acc, b) => {
        if (b.onlineAmount !== undefined && b.onlineAmount !== null) {
          return acc + b.onlineAmount;
        }
        if (b.paymentMethod === 'Online') {
          return acc + b.totalAmount;
        }
        return acc;
      }, 0);

      const todaySp = todayBills.reduce((acc, b) => acc + b.totalSp, 0);

      // Pending bills (all time)
      const pendingBills = allBills.filter(b => !b.isPaid);
      const pendingAmount = pendingBills.reduce((acc, b) => acc + b.totalAmount, 0);

      // Active clients (unique customers in time range)
      const uniqueClients = new Set(chartSourceBills.map(b => b.customerName));

      // New clients today
      const allCustomerNames = allBills.filter(b => new Date(b.date) < today).map(b => b.customerName);
      const previousCustomers = new Set(allCustomerNames);
      const newClients = todayBills.filter(b => !previousCustomers.has(b.customerName)).length;

      setTodayStats({
        revenue: todayRevenue,
        cashTotal: todayCash,
        onlineTotal: todayOnline,
        totalSp: todaySp,
        billCount: todayBills.length,
        pendingAmount,
        pendingCount: pendingBills.length,
        activeClients: uniqueClients.size,
        newClients,
      });

      // Recent Bills (sorted and filtered)
      let listBills = [...allBills];
      if (searchQuery.trim()) {
        const lowerQ = searchQuery.toLowerCase();
        listBills = listBills.filter(b =>
          b.id.toLowerCase().includes(lowerQ) ||
          b.customerName.toLowerCase().includes(lowerQ)
        );
      }

      // Sort by date and ID
      listBills.sort((a, b) => {
        const dateA = getDateTimestamp(a.date);
        const dateB = getDateTimestamp(b.date);
        if (dateA !== dateB) return dateB - dateA;

        const extractNum = (id: string) => {
          const match = id.match(/(\d+)/);
          return match ? parseInt(match[0]) : 0;
        };
        return extractNum(b.id) - extractNum(a.id);
      });

      setRecentBills(listBills);
      setProducts(currentProducts);

      // Aggregate pending products across all bills
      const pendingMap = new Map<string, { name: string; qty: number; price: number; billIds: Set<string> }>();
      allBills.forEach(bill => {
        bill.items.forEach(item => {
          if (item.status === ProductStatus.PENDING) {
            const pqty = item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity;
            if (pqty > 0) {
              const existing = pendingMap.get(item.id);
              if (existing) {
                existing.qty += pqty;
                existing.billIds.add(bill.id);
              } else {
                pendingMap.set(item.id, {
                  name: item.name,
                  qty: pqty,
                  price: item.mrp || item.currentPrice,
                  billIds: new Set([bill.id]),
                });
              }
            }
          }
        });
      });

      const aggregated: AggregatedPendingProduct[] = Array.from(pendingMap.entries()).map(([id, data]) => {
        const totalValue = data.price * data.qty;
        return {
          productId: id,
          name: data.name,
          totalPendingQty: data.qty,
          price: data.price,
          totalValue,
          priority: totalValue >= 2000 ? 'High' : totalValue >= 500 ? 'Medium' : 'Low',
          billCount: data.billIds.size,
        };
      });

      // Sort by priority score descending (totalValue)
      aggregated.sort((a, b) => b.totalValue - a.totalValue);
      setPendingProducts(aggregated);
    };

    updateState();
    const unsubscribe = store.subscribe(updateState);
    return () => unsubscribe();
  }, [timeRange, searchQuery, selectedDate]);

  // Filter bills for transaction history
  const filteredBills = recentBills.filter(bill => {
    if (transactionFilter === 'Pending') return !bill.isPaid;
    if (transactionFilter === 'Paid') return bill.isPaid;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-purple-100 text-purple-600',
      'bg-blue-100 text-blue-600',
      'bg-green-100 text-green-600',
      'bg-orange-100 text-orange-600',
      'bg-pink-100 text-pink-600',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      {/* Greeting Section */}
      <div className="px-1 md:px-2 pt-6 md:pt-8 mb-2">
        <h1 className="text-4xl md:text-[2rem] md:leading-[2.2rem] font-extrabold text-[#02575c] tracking-tight">
          {getGreeting()},<br className="md:hidden" />
          <span className="md:ml-2 text-transparent bg-clip-text bg-gradient-to-r from-[#5abc8b] to-[#02575c]">Welcome back!</span>
        </h1>
      </div>

      {/* Subscription Expiry Warning Banner */}
      {showExpiryWarning && daysRemaining !== null && (
        <div className="mx-1 md:mx-2 mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
            {/* Absolute accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
            
            <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                    <Crown size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-[#12332A] font-bold text-sm md:text-base">Your subscription is expiring soon!</h3>
                    <p className="text-orange-700/80 text-xs md:text-sm font-medium mt-0.5">
                        Only <span className="font-extrabold text-orange-600">{daysRemaining} days</span> remaining. Renew now to avoid interruption.
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto z-10">
                <button 
                  onClick={() => {
                      dismissWarning();
                      if (setActiveView) setActiveView('subscription-manager');
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-orange-500/20 whitespace-nowrap"
                >
                    View Plan Options
                </button>
                <button 
                  onClick={dismissWarning}
                  className="p-2.5 text-orange-400 hover:bg-orange-100 hover:text-orange-600 rounded-xl transition-colors"
                  title="Dismiss for today"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
      )}

      {/* Hero Section - Sales Trends */}
      <section className="bg-white rounded-[2rem] p-6 px-4 md:px-8 md:p-8 shadow-sm border border-gray-100 mb-8 relative overflow-hidden">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4 relative z-10 w-full overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E2F5F6] text-[#00747B] text-xs md:text-sm font-bold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00747B] animate-pulse"></span>
            Live Analytics
          </div>

          {/* Time Period Buttons */}
          <div className="flex items-center justify-start gap-1.5 md:gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(['Week', 'Month', 'Year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => { setTimeRange(period); setSelectedDate(null); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap ${timeRange === period && !selectedDate
                  ? 'bg-[#02575c] text-white border-[#02575c] shadow-lg shadow-[#02575c]/20'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {period}
              </button>
            ))}
            <div className="hidden md:block w-px h-5 bg-gray-200 mx-0.5" />
            <div className="relative shrink-0">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap ${timeRange === 'Custom' && selectedDate
                  ? 'bg-[#02575c] text-white border-[#02575c]'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                <Calendar size={14} />
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Select Date'
                }
              </button>

              {/* Date Picker Modal */}
              {showDatePicker && (
                <div className="absolute top-full right-0 mt-2 z-50 bg-white border border-gray-100 rounded-[1.5rem] p-4 shadow-xl min-w-[300px]">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => {
                        if (calendarMonth === 0) {
                          setCalendarMonth(11);
                          setCalendarYear(calendarYear - 1);
                        } else {
                          setCalendarMonth(calendarMonth - 1);
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[#02575c] font-bold">
                      {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => {
                        if (calendarMonth === 11) {
                          setCalendarMonth(0);
                          setCalendarYear(calendarYear + 1);
                        } else {
                          setCalendarMonth(calendarMonth + 1);
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="text-center text-xs font-bold text-gray-400 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                      const days = [];

                      // Empty cells
                      for (let i = 0; i < firstDay; i++) {
                        days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
                      }

                      // Actual days
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(calendarYear, calendarMonth, day);
                        const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                        const isToday = date.toDateString() === new Date().toDateString();
                        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const hasData = billDates.has(dateStr);
                        const isFutureDate = date > new Date();

                        days.push(
                          <button
                            key={day}
                            onClick={() => {
                              if (hasData) {
                                setSelectedDate(date);
                                setTimeRange('Custom');
                                setShowDatePicker(false);
                              }
                            }}
                            disabled={!hasData || isFutureDate}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${isSelected
                              ? 'bg-[#02575c] text-white font-bold'
                              : isToday && hasData
                                ? 'bg-[#5abc8b]/20 text-[#5abc8b]'
                                : hasData
                                  ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                                  : 'text-gray-300 cursor-not-allowed opacity-40'
                              }`}
                          >
                            {day}
                          </button>
                        );
                      }
                      return days;
                    })()}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedDate(new Date());
                        setTimeRange('Custom');
                        setShowDatePicker(false);
                      }}
                      className="flex-1 py-2 text-xs font-bold bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-all border border-gray-100"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setSelectedDate(yesterday);
                        setTimeRange('Custom');
                        setShowDatePicker(false);
                      }}
                      className="flex-1 py-2 text-xs font-bold bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-all border border-gray-100"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 relative z-10">
          {/* Left Side - Stats */}
          <div className="lg:w-1/3 flex flex-col justify-start space-y-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#02575c] leading-tight tracking-tight mb-2 whitespace-nowrap">
                Sales Trend <span className="text-[#5abc8b]">Overview</span>
              </h2>
            </div>

            <div className="space-y-3">
              {/* Revenue Card */}
              <div className="bg-[#e4f595] p-3 px-4 md:p-4 md:px-5 rounded-3xl flex items-center justify-between transform transition-all hover:scale-[1.02]">
                <div>
                  <div className="flex items-center gap-1 mb-0.5 bg-[#12332A]/5 inline-flex px-1.5 py-0.5 rounded">
                    <Banknote size={12} strokeWidth={2.5} className="text-[#02575c]" />
                    <p className="text-[#02575c] text-[10px] font-bold uppercase tracking-wider">Revenue</p>
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold text-[#02575c]">₹{stats.revenue.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-[0.85rem] bg-white flex items-center justify-center text-[#02575c] shadow-sm">
                  <TrendingUp size={20} strokeWidth={2.5} />
                </div>
              </div>

              {/* SP Generated Card */}
              <div className="bg-[#5abc8b] p-3 px-4 md:p-4 md:px-5 rounded-3xl flex items-center justify-between transform transition-all hover:scale-[1.02]">
                <div>
                  <div className="flex items-center gap-1 mb-0.5 bg-white/10 inline-flex px-1.5 py-0.5 rounded">
                    <PieChart size={12} strokeWidth={2.5} className="text-white" />
                    <p className="text-white text-[10px] font-bold uppercase tracking-wider">SP Generated</p>
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold text-white">{Math.round(stats.sp).toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-[0.85rem] bg-white/30 flex items-center justify-center text-[#02575c]">
                  <TrendingUp size={20} strokeWidth={2.5} />
                </div>
              </div>

              {/* Total Sales Card */}
              <div className="bg-[#02575c] p-3 px-4 md:p-4 md:px-5 rounded-3xl flex items-center justify-between transform transition-all hover:scale-[1.02]">
                <div>
                  <div className="flex items-center gap-1 mb-0.5 bg-white/10 inline-flex px-1.5 py-0.5 rounded">
                    <ShoppingCart size={12} strokeWidth={2.5} className="text-white" />
                    <p className="text-white text-[10px] font-bold uppercase tracking-wider">Total Sales</p>
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold text-white">{stats.sold.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-[0.85rem] bg-white/20 flex items-center justify-center text-white">
                  <TrendingUp size={20} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Chart (Hidden on Mobile) */}
          <div className="hidden lg:flex lg:w-2/3 relative min-h-[350px] flex-col mt-4 lg:mt-0">
            <div className="flex-1 relative rounded-[2rem] border border-gray-100 p-6 overflow-hidden min-h-[350px]" style={{
              backgroundImage: 'linear-gradient(to right, rgba(2, 87, 92, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(2, 87, 92, 0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}>
              <ResponsiveContainer width="100%" height={Math.max(350, chartHeight)}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5abc8b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5abc8b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                    dy={12}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '16px',
                      border: '1px solid #f3f4f6',
                      boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    labelStyle={{ color: '#9ca3af', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
                    formatter={(value: any) => [`₹${value.toLocaleString()}`, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#5abc8b"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#chartGradient)"
                    activeDot={{ r: 8, strokeWidth: 0, fill: '#02575c' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Today's Overview - Separate Panel */}
      <TodayOverview />

      {/* Recent Transaction History */}
      <section className="bg-white rounded-[2rem] shadow-sm p-6 md:p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-xl font-bold text-[#02575c]">Recent Transaction History</h3>

          {/* Filter Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {(['All', 'Pending', 'Paid'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => { setTransactionFilter(filter); setCurrentPage(1); }}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${transactionFilter === filter
                  ? 'bg-white text-[#02575c] shadow-sm'
                  : 'text-gray-500 hover:text-[#02575c]'
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-3 max-h-[400px] overflow-y-auto">
          {filteredBills.length > 0 ? (
            filteredBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => setSelectedBill(bill)}
                className="bg-gray-50 rounded-2xl p-4 cursor-pointer active:bg-gray-100 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getAvatarColor(bill.customerName)}`}>
                      {getInitials(bill.customerName)}
                    </div>
                    <div>
                      <p className="font-bold text-[#02575c] text-sm">{bill.customerName}</p>
                      <p className="text-xs text-gray-500">{bill.date}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bill.isPaid
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                    }`}>
                    {bill.isPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Invoice #{bill.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#02575c]">₹{bill.totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">SP: {Math.round(bill.totalSp)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-gray-400">
              No transactions found.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-y-auto max-h-[400px] scrollbar-thin">
          <table className="w-full table-fixed">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-4 pl-4 w-[12%]">Invoice ID</th>
                <th className="pb-4 w-[28%]">Client</th>
                <th className="pb-4 w-[14%]">Date</th>
                <th className="pb-4 w-[16%]">Amount</th>
                <th className="pb-4 w-[14%]">SP Earned</th>
                <th className="pb-4 text-right pr-4 w-[16%]">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredBills.length > 0 ? (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className="group hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50"
                  >
                    <td className="py-4 pl-4 font-mono text-[#02575c] font-bold">{bill.id}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(bill.customerName)}`}>
                          {getInitials(bill.customerName)}
                        </div>
                        <span className="font-bold text-[#02575c] truncate">{bill.customerName}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-500">{bill.date}</td>
                    <td className="py-4 font-extrabold text-[#02575c]">₹{bill.totalAmount.toLocaleString()}</td>
                    <td className="py-4 font-bold text-[#02575c]">{Math.round(bill.totalSp).toLocaleString()}</td>
                    <td className="py-4 text-right pr-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${bill.isPaid
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-orange-100 text-orange-800 border-orange-200'
                        }`}>
                        {bill.isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Results Count */}
        {filteredBills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-500 font-medium">
              Showing {filteredBills.length} transactions
            </span>
          </div>
        )}
      </section>

      {/* Pending Products — Reorder Priority */}
      {pendingProducts.length > 0 && (
        <section className="bg-white rounded-[2rem] shadow-sm p-6 md:p-8 border border-gray-100 mt-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Package size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#02575c]">Pending Products</h3>
              <p className="text-xs text-gray-400 font-medium">{pendingProducts.length} product{pendingProducts.length !== 1 ? 's' : ''} need reordering</p>
            </div>
          </div>

          {/* Summary Stats Bar */}
          <div className="flex items-center gap-3 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(['High', 'Medium', 'Low'] as const).map(level => {
              const count = pendingProducts.filter(p => p.priority === level).length;
              if (count === 0) return null;
              const colors = {
                High: 'bg-red-50 text-red-700 border-red-100',
                Medium: 'bg-amber-50 text-amber-700 border-amber-100',
                Low: 'bg-blue-50 text-blue-700 border-blue-100',
              };
              return (
                <span key={level} className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${colors[level]}`}>
                  {count} {level} Priority
                </span>
              );
            })}
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-100 whitespace-nowrap">
              Total: ₹{pendingProducts.reduce((s, p) => s + p.totalValue, 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Product List — Fixed height, scrollable */}
          <div className="max-h-[400px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {pendingProducts.map((p, idx) => {
              const priorityStyles = {
                High: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
                Medium: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
                Low: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
              }[p.priority];

              return (
                <div
                  key={p.productId}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50/70 hover:bg-gray-100/80 transition-all group"
                >
                  {/* Rank */}
                  <span className="text-xs font-bold text-gray-300 w-5 text-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Priority Dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityStyles.dot}`} />

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#02575c] truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 font-medium">
                      ₹{p.price.toLocaleString('en-IN')} × {p.totalPendingQty} pending
                      {p.billCount > 1 ? ` · ${p.billCount} bills` : ''}
                    </p>
                  </div>

                  {/* Qty Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-center">
                      <p className="text-sm font-extrabold text-[#02575c]">{p.totalPendingQty}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase -mt-0.5">Qty</p>
                    </div>

                    {/* Value */}
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-[#02575c]">₹{p.totalValue.toLocaleString('en-IN')}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityStyles.bg} ${priorityStyles.text}`}>
                        {p.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <p className="text-xs text-gray-400 font-medium">
              Priority is based on total pending value (price × quantity). Consider reordering high-priority items first.
            </p>
          </div>
        </section>
      )}

      {/* Bill Detail Modal */}
      <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} onEdit={onEditBill} />

      {/* Daily Stats Modal */}
      <DailyStatsModal
        isOpen={showDailyStats}
        onClose={() => setShowDailyStats(false)}
        stats={{
          revenue: todayStats.revenue,
          cashTotal: todayStats.cashTotal,
          onlineTotal: todayStats.onlineTotal,
          totalSp: todayStats.totalSp,
          billCount: todayStats.billCount,
          activeClients: todayStats.activeClients,
        }}
      />
    </div>
  );
};

export default Dashboard;