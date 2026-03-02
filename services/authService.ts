import { auth, db } from '../firebaseConfig';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    UserCredential
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';
import { ShopProfile, AppSettings } from '../types';

const SHOP_EMAIL_DOMAIN = '@veda.shop';
const SUPER_ADMIN_DOMAIN = '@veda.admin';

/**
 * Register a new shop and its owner account.
 * Creates Firebase Auth user + Firestore shop document + initial settings.
 */
export const registerShop = async (
    shopName: string,
    address: string,
    phone: string,
    password: string
): Promise<{ user: any; shopProfile: ShopProfile }> => {
    // 1. Create Firebase Auth user with phone-based email
    const email = `${phone}${SHOP_EMAIL_DOMAIN}`;
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Create shop document
    const shopId = user.uid; // Use auth UID as shopId for simplicity
    const shopProfile: ShopProfile = {
        id: shopId,
        shopName,
        address,
        phone,
        ownerUid: user.uid,
        createdAt: new Date().toISOString(),
        subscriptionStatus: 'trial',
        planId: 'basic',
    };

    await setDoc(doc(db, 'shops', shopId), shopProfile);

    // 3. Initialize shop settings
    const initialSettings: AppSettings = {
        shopName,
        shopAddress: address,
        defaultBillingMode: 'DP',
        whatsappEnabled: false,
    };
    await setDoc(doc(db, 'shops', shopId, 'settings', 'general'), initialSettings);

    // 4. Map user UID to shop (for login lookup)
    await setDoc(doc(db, 'user_shops', user.uid), {
        shopId,
        phone,
        role: 'shop_admin',
    });

    return { user, shopProfile };
};

/**
 * Login an existing shop user. Returns user + shopProfile.
 */
export const loginUser = async (
    phone: string,
    password: string
): Promise<{ user: any; shopProfile: ShopProfile | null; isSuperAdmin: boolean }> => {
    // Try shop login first (phone@veda.shop)
    let email = `${phone}${SHOP_EMAIL_DOMAIN}`;
    let isSuperAdmin = false;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const shopProfile = await getShopProfile(user.uid);
        return { user, shopProfile, isSuperAdmin: false };
    } catch (shopErr: any) {
        // If shop login fails, try legacy admin login (phone@veda.admin)
        try {
            email = `${phone}${SUPER_ADMIN_DOMAIN}`;
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check if this admin already has a shop profile
            const shopProfile = await getShopProfile(user.uid);

            // Check if super admin
            if (email.endsWith(SUPER_ADMIN_DOMAIN)) {
                isSuperAdmin = true;
            }

            return { user, shopProfile, isSuperAdmin };
        } catch (adminErr) {
            // Both failed — throw original error
            throw shopErr;
        }
    }
};

/**
 * Get the shop profile for a given user UID.
 */
export const getShopProfile = async (uid: string): Promise<ShopProfile | null> => {
    // 1. Check user_shops mapping
    const userShopDoc = await getDoc(doc(db, 'user_shops', uid));
    if (userShopDoc.exists()) {
        const { shopId } = userShopDoc.data();
        const shopDoc = await getDoc(doc(db, 'shops', shopId));
        if (shopDoc.exists()) {
            return { id: shopDoc.id, ...shopDoc.data() } as ShopProfile;
        }
    }

    // 2. Check if shop doc exists with UID directly
    const shopDoc = await getDoc(doc(db, 'shops', uid));
    if (shopDoc.exists()) {
        return { id: shopDoc.id, ...shopDoc.data() } as ShopProfile;
    }

    return null;
};

/**
 * Update shop profile fields.
 */
export const updateShopProfile = async (
    shopId: string,
    updates: Partial<ShopProfile>
): Promise<void> => {
    await setDoc(doc(db, 'shops', shopId), updates, { merge: true });
};

/**
 * Check if a user is a super admin.
 */
export const checkIsSuperAdmin = (email: string | null): boolean => {
    if (!email) return false;
    return email === 'ayushayurveda.shop@gmail.com' || email.endsWith(SUPER_ADMIN_DOMAIN);
};
