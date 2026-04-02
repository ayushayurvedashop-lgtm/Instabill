import React, { useState, useEffect } from 'react';
import { Bill } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { InvoiceModal } from './InvoiceModal';
import { Loader, AlertCircle } from 'lucide-react';

export const PublicInvoiceViewer: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bill, setBill] = useState<Bill | null>(null);

    useEffect(() => {
        const fetchBill = async () => {
            const params = new URLSearchParams(window.location.search);
            let billId = params.get('billId');

            const pathParts = window.location.pathname.split('/').filter(Boolean);
            if (!billId && pathParts.length >= 3 && pathParts[0] === 'instabill') {
                billId = decodeURIComponent(pathParts[2]);
            }

            // Optionally add # back if billId from path doesn't have it but is expected
            if (billId && !billId.startsWith('#') && !isNaN(Number(billId))) {
               billId = '#' + billId;
            }

            if (!billId) {
                setError('No bill ID provided.');
                setLoading(false);
                return;
            }

            try {
                // Try to find the bill in 'bills' collection
                // Since IDs might be custom (e.g. #465), we query by 'id' field, not document ID
                const billsRef = collection(db, 'bills');
                const q = query(billsRef, where('id', '==', billId));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setError('Bill not found or link expired.');
                } else {
                    const billData = snapshot.docs[0].data() as Bill;
                    setBill(billData);
                }

            } catch (err: any) {
                console.error('Error fetching bill:', err);
                setError('Failed to load bill. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchBill();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
                <Loader className="animate-spin text-primary mb-4" size={40} />
                <p className="text-gray-500 font-medium">Loading Invoice...</p>
            </div>
        );
    }

    if (error || !bill) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-dark mb-2">Unavailable</h2>
                    <p className="text-gray-500">{error || 'Invoice could not be loaded.'}</p>
                </div>
            </div>
        );
    }

    // Render the Invoice Modal in full screen/embedded mode
    // We reuse InvoiceModal but bypass the 'Modal' overlay part if possible, 
    // or just render it as is. InvoiceModal usually has a backdrop. 
    // Let's modify InvoiceModal usage slightly via props or just let it render on top of empty bg.
    return (
        <div className="h-screen w-screen bg-gray-100 overflow-auto">
            {/* Pass onClose as empty or redirect to home? For public view, maybe no close action needed */}
            <InvoiceModal
                bill={bill}
                onClose={() => { }}
                onEdit={() => { }}
                isFullScreenSlide={true} // Reusing this prop to maybe remove some modal wrapper styles?
            />
        </div>
    );
};
