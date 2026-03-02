/**
 * Migration Script: Copy top-level Firestore data into a shop's subcollection
 *
 * Usage:
 *   npx tsx scripts/migrateToMultitenant.ts
 *
 * What it does:
 *   1. Looks up the shop in Firestore by phone number (9423791137)
 *   2. Copies all top-level collections (bills, customers, products, settings,
 *      sp_tasks, cash_deductions, billSnapshots) into shops/{shopId}/...
 *   3. Does NOT delete original data (safe, non-destructive)
 *
 * Prerequisites:
 *   npm install firebase-admin tsx  (if not already installed)
 *   Place your Firebase service account key as `serviceAccountKey.json` in project root
 *   OR set GOOGLE_APPLICATION_CREDENTIALS env var
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ─── CONFIG ──────────────────────────────────────────────────────
const TARGET_PHONE = '9423791137';
const COLLECTIONS_TO_MIGRATE = [
    'bills',
    'customers',
    'products',
    'sp_tasks',
    'cash_deductions',
    'billSnapshots',
];
const SETTINGS_DOC_PATH = 'settings/general';
const BATCH_SIZE = 400; // Firestore batch limit is 500, leave margin
// ─────────────────────────────────────────────────────────────────

// Initialize Firebase Admin
function initAdmin() {
    const keyPath = resolve(process.cwd(), 'serviceAccountKey.json');

    if (existsSync(keyPath)) {
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Initialized with service account key');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        console.log('✅ Initialized with GOOGLE_APPLICATION_CREDENTIALS');
    } else {
        console.error('❌ No credentials found!');
        console.error('   Place serviceAccountKey.json in project root');
        console.error('   OR set GOOGLE_APPLICATION_CREDENTIALS env var');
        console.error('');
        console.error('   Download from Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
        process.exit(1);
    }
}

async function findShopByPhone(db: admin.firestore.Firestore): Promise<string | null> {
    console.log(`\n🔍 Looking for shop with phone: ${TARGET_PHONE}`);

    const shopsSnap = await db.collection('shops').get();
    for (const doc of shopsSnap.docs) {
        const data = doc.data();
        if (data.phone === TARGET_PHONE) {
            console.log(`   Found: "${data.shopName}" (ID: ${doc.id})`);
            return doc.id;
        }
    }
    return null;
}

async function migrateCollection(
    db: admin.firestore.Firestore,
    collectionName: string,
    shopId: string
) {
    const sourceRef = db.collection(collectionName);
    const targetPath = `shops/${shopId}/${collectionName}`;
    const targetRef = db.collection(targetPath);

    const snapshot = await sourceRef.get();
    if (snapshot.empty) {
        console.log(`   ⏭️  ${collectionName}: empty, skipping`);
        return 0;
    }

    // Check if target already has data
    const existingTarget = await targetRef.limit(1).get();
    if (!existingTarget.empty) {
        console.log(`   ⚠️  ${collectionName}: target already has data — skipping to avoid duplicates`);
        return 0;
    }

    let count = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const targetDoc = targetRef.doc(doc.id);
        batch.set(targetDoc, doc.data());
        count++;
        batchCount++;

        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
            process.stdout.write(`   ...committed ${count} docs\r`);
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`   ✅ ${collectionName}: migrated ${count} documents → ${targetPath}`);
    return count;
}

async function migrateSettings(db: admin.firestore.Firestore, shopId: string) {
    const sourceRef = db.doc(SETTINGS_DOC_PATH);
    const targetPath = `shops/${shopId}/settings/general`;
    const targetRef = db.doc(targetPath);

    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
        console.log(`   ⏭️  settings: no settings doc found, skipping`);
        return;
    }

    const existingTarget = await targetRef.get();
    if (existingTarget.exists) {
        console.log(`   ⚠️  settings: target already has settings — skipping`);
        return;
    }

    await targetRef.set(sourceSnap.data()!);
    console.log(`   ✅ settings/general: migrated → ${targetPath}`);
}

async function main() {
    initAdmin();
    const db = admin.firestore();

    // 1. Find the shop
    const shopId = await findShopByPhone(db);
    if (!shopId) {
        console.error(`\n❌ No shop found with phone: ${TARGET_PHONE}`);
        console.error('   Make sure you created the shop in the admin panel first.');
        process.exit(1);
    }

    console.log(`\n📦 Migrating top-level data → shops/${shopId}/...\n`);

    // 2. Migrate each collection
    let totalDocs = 0;
    for (const col of COLLECTIONS_TO_MIGRATE) {
        const count = await migrateCollection(db, col, shopId);
        totalDocs += count;
    }

    // 3. Migrate settings
    await migrateSettings(db, shopId);

    console.log(`\n🎉 Migration complete! ${totalDocs} total documents migrated.`);
    console.log(`   Shop: ${shopId}`);
    console.log(`   Phone: ${TARGET_PHONE}`);
    console.log(`\n   ℹ️  Original data was NOT deleted (safe migration).`);
    console.log(`   ℹ️  To clean up, you can manually delete top-level collections later.\n`);

    process.exit(0);
}

main().catch((err) => {
    console.error('\n💥 Migration failed:', err);
    process.exit(1);
});
