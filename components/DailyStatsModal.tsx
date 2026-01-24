import React, { useRef } from 'react';
import { X, Printer, Banknote, Smartphone, TrendingUp, ShoppingCart, Users, PieChart, MinusCircle, Wallet } from 'lucide-react';
import { store } from '../store';

interface DailyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    revenue: number;
    cashTotal: number;
    onlineTotal: number;
    totalSp: number;
    billCount: number;
    activeClients: number;
    totalDeductions?: number;
    netCash?: number;
  };
}

const DailyStatsModal: React.FC<DailyStatsModalProps> = ({ isOpen, onClose, stats }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const settings = store.getSettings();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    // Generate static HTML for print to ensure consistent styling regardless of modal state
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Stats - ${dateStr}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            
            body {
              padding: 24px;
              color: #1f2937;
              max-width: 500px;
              margin: 0 auto;
              background: #f9fafb;
            }
            
            .report-card {
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 16px;
              padding: 24px;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 16px;
              border-bottom: 2px dashed #e5e7eb;
              margin-bottom: 20px;
            }
            
            .shop-info h1 {
              font-size: 20px;
              font-weight: 800;
              color: #111827;
              margin-bottom: 2px;
            }
            
            .shop-info p {
              font-size: 12px;
              color: #6b7280;
            }

            .report-badge {
              background: #12332A;
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .stats-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            
            .stats-table td {
              padding: 10px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            
            .stats-table .label {
              font-size: 14px;
              color: #6b7280;
              font-weight: 500;
            }
            
            .stats-table .value {
              text-align: right;
              font-size: 16px;
              font-weight: 700;
              color: #111827;
            }
            
            .stats-table .value.revenue {
              font-size: 28px;
              color: #12332A;
            }
            
            .stats-table .value.sp { color: #7e22ce; }
            .stats-table .value.deduction { color: #dc2626; }
            
            .stats-table.secondary td {
              padding: 8px 0;
            }

            .collections-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 16px;
            }

            .collection-box {
              padding: 14px;
              border-radius: 10px;
              text-align: center;
            }
            
            .cash-box {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
            }
            
            .online-box {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
            }

            .collection-label {
              font-size: 12px;
              font-weight: 600;
              color: #6b7280;
              margin-bottom: 4px;
            }

            .collection-value {
              font-size: 20px;
              font-weight: 700;
            }
            
            .collection-value.cash { color: #16a34a; }
            .collection-value.online { color: #2563eb; }

            .deductions-section {
              margin-top: 8px;
              padding-top: 12px;
              border-top: 2px dashed #e5e7eb;
            }

            .deduction-label { color: #991b1b !important; font-weight: 600 !important; }

            .net-cash-box {
              background: linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%);
              border: 2px solid #a3e635;
              border-radius: 12px;
              padding: 16px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 12px;
            }

            .net-label {
              font-size: 12px;
              font-weight: 700;
              color: #365314;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .net-value {
              font-size: 28px;
              font-weight: 800;
              color: #1a2e05;
            }

            .footer {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px solid #f3f4f6;
              text-align: center;
              font-size: 11px;
              color: #9ca3af;
            }

            @media print {
              body { 
                padding: 0; 
                background: white;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
              }
              .report-card { border: 1px solid #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="report-card">
            <!-- Header -->
            <div class="header">
              <div class="shop-info">
                <h1>${settings.shopName}</h1>
                <p>${dateStr}</p>
              </div>
              <div class="report-badge">Daily Report</div>
            </div>

            <!-- Main Stats Table -->
            <table class="stats-table">
              <tr class="revenue-row">
                <td class="label">Total Revenue</td>
                <td class="value revenue">₹${stats.revenue.toLocaleString()}</td>
              </tr>
            </table>

            <!-- Collections Row -->
            <div class="collections-grid">
              <div class="collection-box cash-box">
                <div class="collection-label">💵 Cash</div>
                <div class="collection-value cash">₹${stats.cashTotal.toLocaleString()}</div>
              </div>
              <div class="collection-box online-box">
                <div class="collection-label">📱 Online</div>
                <div class="collection-value online">₹${stats.onlineTotal.toLocaleString()}</div>
              </div>
            </div>

            <!-- Secondary Stats -->
            <table class="stats-table secondary">
              <tr>
                <td class="label">SP Generated</td>
                <td class="value sp">${Math.round(stats.totalSp).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="label">Total Bills</td>
                <td class="value">${stats.billCount}</td>
              </tr>
              <tr>
                <td class="label">Customers</td>
                <td class="value">${stats.activeClients}</td>
              </tr>
            </table>

            ${(stats.totalDeductions !== undefined && stats.totalDeductions > 0) ? `
              <!-- Deductions Section -->
              <div class="deductions-section">
                <table class="stats-table">
                  <tr>
                    <td class="label deduction-label">Deductions</td>
                    <td class="value deduction">-₹${stats.totalDeductions.toLocaleString()}</td>
                  </tr>
                </table>
                <div class="net-cash-box">
                  <span class="net-label">NET CASH IN HAND</span>
                  <span class="net-value">₹${(stats.netCash ?? 0).toLocaleString()}</span>
                </div>
              </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
              Generated at ${today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-scale-in flex flex-col m-4">
        {/* Header - Compact */}
        <div className="flex-none flex items-center justify-between p-4 py-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#12332A]">Daily Stats Summary</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Printable Content - Compact */}
        <div className="flex-1 p-4">
          <div ref={printRef}>
            <div className="print-container">
              {/* Receipt Header */}
              <div className="header text-center pb-2 border-b border-dashed border-gray-300 mb-2">
                <div className="shop-name text-base font-extrabold uppercase tracking-wider">{settings.shopName}</div>
                <div className="date text-[10px] text-gray-500 mt-0.5">{dateStr}</div>
              </div>

              {/* Stats Grid - Compact */}
              <div className="stats-grid space-y-1.5">
                {/* Revenue - Key Metric */}
                <div className="stat-row flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="stat-label text-xs text-gray-600 font-bold uppercase tracking-wide">Total Revenue</span>
                  <span className="stat-value highlight text-lg font-bold text-[#12332A]">₹{stats.revenue.toLocaleString()}</span>
                </div>

                {/* Collections Group */}
                <div className="bg-gray-50 rounded-lg p-2 flex gap-4 my-1">
                  <div className="flex-1">
                    <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase font-bold mb-0.5">
                      <Banknote size={12} className="text-green-600" /> Cash
                    </span>
                    <div className="text-sm font-bold text-green-700">₹{stats.cashTotal.toLocaleString()}</div>
                  </div>
                  <div className="w-px bg-gray-200"></div>
                  <div className="flex-1">
                    <span className="flex items-center gap-1 text-[10px] text-gray-500 uppercase font-bold mb-0.5">
                      <Smartphone size={12} className="text-blue-600" /> Online
                    </span>
                    <div className="text-sm font-bold text-blue-700">₹{stats.onlineTotal.toLocaleString()}</div>
                  </div>
                </div>

                {/* Secondary Stats Group */}
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="text-center p-1.5 bg-purple-50 rounded border border-purple-100">
                    <div className="text-[10px] text-purple-600 font-medium mb-0.5">SP</div>
                    <div className="text-sm font-bold text-purple-700">{Math.round(stats.totalSp).toLocaleString()}</div>
                  </div>
                  <div className="text-center p-1.5 bg-orange-50 rounded border border-orange-100">
                    <div className="text-[10px] text-orange-600 font-medium mb-0.5">Bills</div>
                    <div className="text-sm font-bold text-orange-700">{stats.billCount}</div>
                  </div>
                  <div className="text-center p-1.5 bg-cyan-50 rounded border border-cyan-100">
                    <div className="text-[10px] text-cyan-600 font-medium mb-0.5">Clients</div>
                    <div className="text-sm font-bold text-cyan-700">{stats.activeClients}</div>
                  </div>
                </div>

                {(stats.totalDeductions !== undefined && stats.totalDeductions > 0) && (
                  <>
                    <div className="stat-row flex justify-between items-center py-1 mt-1">
                      <span className="stat-label text-xs text-gray-600 font-medium flex items-center gap-1.5">
                        <MinusCircle size={14} className="text-red-600" />
                        Deductions
                      </span>
                      <span className="stat-value deduction text-sm font-bold text-red-600">-₹{stats.totalDeductions.toLocaleString()}</span>
                    </div>

                    <div className="stat-row flex justify-between items-center py-2 bg-[#BCE32D]/20 rounded-lg px-3 -mx-2 mt-1">
                      <span className="stat-label text-xs font-bold text-[#12332A] flex items-center gap-1.5">
                        <Wallet size={14} className="text-[#12332A]" />
                        Net Cash in Hand
                      </span>
                      <span className="stat-value netcash text-lg font-bold text-[#12332A]">₹{(stats.netCash ?? 0).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="footer text-center text-[9px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
                Generated at {today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex-none p-4 pt-0">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 bg-[#12332A] hover:bg-[#1a4438] text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-[0.98] text-sm"
          >
            <Printer size={18} />
            Print Stats
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyStatsModal;
