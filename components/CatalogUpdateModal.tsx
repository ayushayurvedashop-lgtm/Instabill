import React, { useState, useEffect } from 'react';
import { store } from '../store';
import { RefreshCw, X, ArrowDownCircle, SkipForward } from 'lucide-react';

interface CatalogUpdateModalProps {
  onClose: () => void;
}

const CatalogUpdateModal: React.FC<CatalogUpdateModalProps> = ({ onClose }) => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number } | null>(null);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await store.importCatalogUpdate();
      setResult(res);
    } catch (e) {
      console.error('Import failed', e);
    }
    setImporting(false);
  };

  if (result) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: '20px'
      }}>
        <div style={{
          background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px',
          padding: '40px 28px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: '#DAF4D7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <RefreshCw size={28} color="#00747B" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 12px', color: '#02575c' }}>
            Catalog Updated!
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.6 }}>
            {result.updated > 0 && <><strong>{result.updated}</strong> items updated. </>}
            {result.added > 0 && <><strong>{result.added}</strong> new items added with stock set to 0. </>}
            {result.updated === 0 && result.added === 0 && 'Your catalog is already up to date.'}
          </p>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '14px', background: '#00747B', color: 'white',
              border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px',
        padding: '36px 28px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', background: '#FEF3C7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
        }}>
          <ArrowDownCircle size={28} color="#D97706" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 12px', color: '#02575c' }}>
          Stock Catalog Updated
        </h2>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 8px', lineHeight: 1.6 }}>
          The admin has updated the default stock catalog with new products or price changes.
          Would you like to import the updates?
        </p>
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px',
          padding: '12px 16px', margin: '16px 0 24px', textAlign: 'left'
        }}>
          <p style={{ 
            fontSize: '13px', color: '#166534', fontWeight: 600, margin: 0, lineHeight: 1.5 
          }}>
            ✅ Your stock quantities will remain the same
          </p>
          <p style={{ 
            fontSize: '12px', color: '#15803D', margin: '6px 0 0', lineHeight: 1.5 
          }}>
            Only product details (prices, names, categories) will be updated. Any newly added items will start with stock = 0.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              flex: 1, padding: '14px', background: '#F3F4F6', color: '#6B7280',
              border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
              cursor: importing ? 'not-allowed' : 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <SkipForward size={16} />
            Skip
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              flex: 2, padding: '14px', background: '#00747B', color: 'white',
              border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
              cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <ArrowDownCircle size={16} />
            {importing ? 'Importing...' : 'Import Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogUpdateModal;
