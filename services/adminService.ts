import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export const checkIsAdmin = async (uid: string, email: string | null, phoneNumber: string | null): Promise<boolean> => {
    try {
        // 0. Hardcoded Super Admin Safety Net & Domain Check
        // Allow the owner OR anyone with the custom admin domain
        if (email === 'ayushayurveda.shop@gmail.com' || email?.endsWith('@veda.admin')) {
            return true;
        }

        // 1. Check if user exists in authorized_admins by UID
        const adminDoc = await getDoc(doc(db, 'authorized_admins', uid));
        if (adminDoc.exists()) return true;

        // 2. Strict Access Control
        return false;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
};
