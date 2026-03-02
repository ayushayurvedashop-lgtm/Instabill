import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function initAdmin() {
    const keyPath = resolve(process.cwd(), 'serviceAccountKey.json');
    if (existsSync(keyPath)) {
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Initialized with service account key');
    } else {
        console.error('❌ serviceAccountKey.json not found');
        process.exit(1);
    }
}

initAdmin();
const db = admin.firestore();

async function migrateCatalog() {
    console.log('Starting catalog migration...');

    // 1. Fetch all existing shops
    const shopsSnapshot = await db.collection('shops').get();
    console.log(`Found ${shopsSnapshot.docs.length} shops.`);

    // 2. Global Catalog tracking (deduplicate by name)
    const globalCatalog = new Map(); // name -> productData

    for (const shopDoc of shopsSnapshot.docs) {
        const shopId = shopDoc.id;
        const productsSnapshot = await db.collection(`shops/${shopId}/products`).get();

        if (productsSnapshot.empty) {
            continue;
        }

        console.log(`Processing ${productsSnapshot.docs.length} products for shop: ${shopId}`);

        const batch = db.batch();

        for (const productDoc of productsSnapshot.docs) {
            const data = productDoc.data();
            const stock = data.stock !== undefined ? data.stock : 50;

            // Remove stock and ID from global catalog data
            const { stock: _, id: __, ...catalogData } = data as any;

            let globalId = productDoc.id;

            // Deduplicate in global catalog by lowercase name
            const nameKey = (data.name || '').toLowerCase().trim();
            if (!globalCatalog.has(nameKey)) {
                globalCatalog.set(nameKey, { id: globalId, ...catalogData });
            } else {
                // Use existing global ID for this product
                globalId = globalCatalog.get(nameKey).id;
            }

            // Write local inventory override for this shop
            const inventoryRef = db.doc(`shops/${shopId}/inventory/${globalId}`);
            batch.set(inventoryRef, { stock }, { merge: true });
        }

        await batch.commit();
        console.log(`Saved inventory for shop ${shopId}.`);
    }

    // 3. Write deduplicated global catalog
    console.log(`Found ${globalCatalog.size} unique products for the global catalog.`);
    const catalogBatch = db.batch();

    for (const [_, product] of globalCatalog.entries()) {
        const { id, ...data } = product;
        const globalRef = db.doc(`products/${id}`);
        catalogBatch.set(globalRef, data, { merge: true });
    }

    await catalogBatch.commit();
    console.log('Global catalog populated successfully.');

    console.log('Migration completed successfully!');
}

migrateCatalog()
    .then(() => process.exit(0))
    .catch(console.error);
