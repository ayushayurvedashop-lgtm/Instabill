import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

async function diagnose() {
    const snapshot = await getDocs(collection(db, 'shops'));
    const shops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log('--- Shop Subscription Audit ---');
    shops.forEach((s: any) => {
        console.log(`Shop: ${s.shopName} (${s.id})`);
        console.log(`  Status: ${s.subscriptionStatus}`);
        console.log(`  TrialStatus: ${s.trialStatus}`);
        console.log(`  SubEnd: ${s.subscriptionEnd}`);
        console.log(`  PlanId: ${s.planId}`);
        const isActive = (s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trial') &&
                        s.subscriptionEnd &&
                        new Date(s.subscriptionEnd) > new Date();
        console.log(`  IsActive (Computed): ${isActive}`);
        console.log('---');
    });
}

diagnose();
