/**
 * One-time migration script: Global Products → Per-Shop Products + Default Catalog
 * 
 * This script:
 * 1. Copies all docs from global `products/` into `default_catalog/`
 * 2. Sets `default_catalog_meta/current` with version: 1
 * 3. For each existing shop:
 *    - Merges global product data with the shop's inventory stock counts
 *    - Writes to `shops/{shopId}/products/`
 *    - Sets `shops/{shopId}/catalog_version/current` to version: 1
 * 
 * Run once via: npx tsx scripts/migrateCatalog.ts
 * (Requires firebase-admin or similar setup; alternatively, paste into a browser console with Firebase initialized)
 */

import { db } from '../firebaseConfig';
import { collection, getDocs, doc, setDoc, writeBatch, getDoc } from 'firebase/firestore';

async function migrate() {
    console.log('=== Starting Catalog Migration ===\n');

    // 1. Read all global products
    console.log('1. Reading global products...');
    const productsSnap = await getDocs(collection(db, 'products'));
    const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`   Found ${products.length} products`);

    // 2. Copy to default_catalog
    console.log('2. Writing to default_catalog...');
    const chunk = 400;
    for (let i = 0; i < products.length; i += chunk) {
        const batch = writeBatch(db);
        products.slice(i, i + chunk).forEach((product: any) => {
            const { id, stock, ...data } = product;
            batch.set(doc(db, 'default_catalog', id), data);
        });
        await batch.commit();
        console.log(`   Wrote ${Math.min(i + chunk, products.length)}/${products.length}`);
    }

    // 3. Set catalog meta
    console.log('3. Setting default_catalog_meta...');
    await setDoc(doc(db, 'default_catalog_meta', 'current'), {
        version: 1,
        updatedAt: new Date().toISOString()
    });

    // 4. Migrate each shop
    console.log('4. Migrating shops...');
    const shopsSnap = await getDocs(collection(db, 'shops'));
    
    for (const shopDoc of shopsSnap.docs) {
        const shopId = shopDoc.id;
        console.log(`\n   Shop: ${shopId} (${shopDoc.data().shopName || 'unnamed'})`);

        // Read shop's inventory overrides
        const inventorySnap = await getDocs(collection(db, 'shops', shopId, 'inventory'));
        const inventory: Record<string, number> = {};
        inventorySnap.docs.forEach(d => {
            inventory[d.id] = d.data().stock;
        });
        console.log(`   Found ${inventorySnap.size} inventory entries`);

        // Write per-shop products
        for (let i = 0; i < products.length; i += chunk) {
            const batch = writeBatch(db);
            products.slice(i, i + chunk).forEach((product: any) => {
                const { id, ...data } = product;
                const stock = inventory[id] !== undefined ? inventory[id] : 0;
                batch.set(doc(db, 'shops', shopId, 'products', id), { ...data, stock });
            });
            await batch.commit();
        }
        console.log(`   Wrote ${products.length} products to shops/${shopId}/products/`);

        // Set catalog version
        await setDoc(doc(db, 'shops', shopId, 'catalog_version', 'current'), { version: 1 });
        console.log(`   Set catalog_version = 1`);
    }

    console.log('\n=== Migration Complete! ===');
    console.log(`   ${products.length} products → default_catalog`);
    console.log(`   ${shopsSnap.size} shops migrated with per-shop products`);
    console.log('\nYou can now safely remove the global "products" collection when ready.');
}

migrate().catch(console.error);
