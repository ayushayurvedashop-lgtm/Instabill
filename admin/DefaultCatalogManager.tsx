import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';

interface CatalogItem {
    id: string;
    name: string;
    category: string;
    mrp: number;
    dp: number;
    sp: number;
}

type ChangeType = 'added' | 'modified' | 'deleted';

interface StagedChange {
    item: CatalogItem;
    type: ChangeType;
    original?: CatalogItem;
}

const DefaultCatalogManager: React.FC = () => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [currentVersion, setCurrentVersion] = useState(0);

    // Staged changes (not yet saved)
    const [stagedChanges, setStagedChanges] = useState<Map<string, StagedChange>>(new Map());
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<string>('');

    // Edit modal
    const [editItem, setEditItem] = useState<CatalogItem | null>(null);
    const [editForm, setEditForm] = useState({ name: '', category: '', mrp: 0, dp: 0, sp: 0 });
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', category: '', mrp: 0, dp: 0, sp: 0 });

    // Confirm save modal
    const [showConfirmSave, setShowConfirmSave] = useState(false);

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'default_catalog'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CatalogItem[];
            setItems(data.sort((a, b) => a.name.localeCompare(b.name)));

            const metaDoc = await getDoc(doc(db, 'default_catalog_meta', 'current'));
            if (metaDoc.exists()) {
                setCurrentVersion(metaDoc.data().version || 0);
            }
        } catch (e) {
            console.error('Failed to load catalog', e);
        }
        setLoading(false);
    };

    // Get effective items (original + staged changes)
    const effectiveItems = useMemo(() => {
        let result = [...items];

        stagedChanges.forEach((change, id) => {
            if (change.type === 'added') {
                result.push(change.item);
            } else if (change.type === 'modified') {
                result = result.map(item => item.id === id ? change.item : item);
            } else if (change.type === 'deleted') {
                result = result.filter(item => item.id !== id);
            }
        });

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [items, stagedChanges]);

    const categories = useMemo(() => {
        const cats = new Set(effectiveItems.map(i => i.category));
        return Array.from(cats).sort();
    }, [effectiveItems]);

    const filteredItems = useMemo(() => {
        return effectiveItems.filter(item => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
            const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [effectiveItems, searchQuery, categoryFilter]);

    const hasChanges = stagedChanges.size > 0;

    const handleEditItem = (item: CatalogItem) => {
        setEditItem(item);
        setEditForm({ name: item.name, category: item.category, mrp: item.mrp, dp: item.dp, sp: item.sp });
    };

    const handleSaveEdit = () => {
        if (!editItem) return;
        const updated: CatalogItem = { ...editItem, ...editForm };
        const newChanges = new Map(stagedChanges);
        const original = items.find(i => i.id === editItem.id);

        if (original) {
            // Check if it actually changed
            if (original.name === updated.name && original.category === updated.category &&
                original.mrp === updated.mrp && original.dp === updated.dp && original.sp === updated.sp) {
                newChanges.delete(editItem.id);
            } else {
                newChanges.set(editItem.id, { item: updated, type: 'modified', original });
            }
        } else {
            // Was a staged addition — update the staged item
            newChanges.set(editItem.id, { item: updated, type: 'added' });
        }

        setStagedChanges(newChanges);
        setEditItem(null);
    };

    const handleDeleteItem = (id: string) => {
        const newChanges = new Map(stagedChanges);
        const existing = stagedChanges.get(id);

        if (existing?.type === 'added') {
            // Was never saved — just remove from staged
            newChanges.delete(id);
        } else {
            const original = items.find(i => i.id === id);
            if (original) {
                newChanges.set(id, { item: original, type: 'deleted' });
            }
        }
        setStagedChanges(newChanges);
    };

    const handleUndoChange = (id: string) => {
        const newChanges = new Map(stagedChanges);
        newChanges.delete(id);
        setStagedChanges(newChanges);
    };

    const handleAddItem = () => {
        if (!addForm.name.trim()) return;
        const newId = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newItem: CatalogItem = { id: newId, ...addForm };
        const newChanges = new Map(stagedChanges);
        newChanges.set(newId, { item: newItem, type: 'added' });
        setStagedChanges(newChanges);
        setAddForm({ name: '', category: '', mrp: 0, dp: 0, sp: 0 });
        setShowAddForm(false);
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        setSaveResult('');

        try {
            const batch = writeBatch(db);

            stagedChanges.forEach((change, id) => {
                const ref = doc(db, 'default_catalog', id);
                if (change.type === 'added' || change.type === 'modified') {
                    const { id: _, ...data } = change.item;
                    batch.set(ref, data);
                } else if (change.type === 'deleted') {
                    batch.delete(ref);
                }
            });

            // Increment version
            const newVersion = currentVersion + 1;
            batch.set(doc(db, 'default_catalog_meta', 'current'), {
                version: newVersion,
                updatedAt: new Date().toISOString(),
            });

            await batch.commit();

            setCurrentVersion(newVersion);
            setStagedChanges(new Map());
            setShowConfirmSave(false);
            setSaveResult(`Saved successfully! Catalog version updated to v${newVersion}. Shops will be notified.`);
            setTimeout(() => setSaveResult(''), 5000);

            // Reload to get fresh data
            await loadCatalog();
        } catch (e) {
            console.error('Failed to save catalog', e);
            setSaveResult('Failed to save. Please try again.');
        }
        setSaving(false);
    };

    const changeSummary = useMemo(() => {
        let added = 0, modified = 0, deleted = 0;
        stagedChanges.forEach(c => {
            if (c.type === 'added') added++;
            else if (c.type === 'modified') modified++;
            else if (c.type === 'deleted') deleted++;
        });
        return { added, modified, deleted };
    }, [stagedChanges]);

    const getItemChangeType = (id: string): ChangeType | null => {
        return stagedChanges.get(id)?.type || null;
    };

    return (
        <div className="admin-dashboard">
            <div className="admin-page-header">
                <div>
                    <h1>Default Stock Catalog</h1>
                    <p>Manage the master product catalog. Changes will be offered to all shops. <strong>Version: {currentVersion}</strong></p>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '400px' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 40px', border: '1px solid var(--admin-border)',
                            borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--admin-surface)',
                            color: 'var(--admin-text)'
                        }}
                    />
                </div>

                <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    style={{
                        padding: '10px 14px', border: '1px solid var(--admin-border)', borderRadius: '10px',
                        fontSize: '13px', fontFamily: 'inherit', background: 'var(--admin-surface)',
                        color: 'var(--admin-text)', cursor: 'pointer'
                    }}
                >
                    <option value="all">All Categories</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>

                <button
                    onClick={() => setShowAddForm(true)}
                    style={{
                        padding: '10px 18px', background: 'var(--admin-primary)', color: 'white',
                        border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Item
                </button>

                <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                    {filteredItems.length} items
                </span>
            </div>

            {/* Changes banner */}
            {hasChanges && (
                <div style={{
                    padding: '14px 20px', borderRadius: '12px', background: '#FFFBEB',
                    border: '1px solid #FDE68A', marginBottom: '16px', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
                }}>
                    <div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400E' }}>
                            Unsaved Changes:
                        </span>
                        <span style={{ fontSize: '13px', color: '#A16207', marginLeft: '8px' }}>
                            {changeSummary.added > 0 && `${changeSummary.added} added `}
                            {changeSummary.modified > 0 && `${changeSummary.modified} modified `}
                            {changeSummary.deleted > 0 && `${changeSummary.deleted} deleted`}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setStagedChanges(new Map())}
                            style={{
                                padding: '8px 16px', background: 'white', color: '#92400E',
                                border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '13px',
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                            }}
                        >
                            Discard All
                        </button>
                        <button
                            onClick={() => setShowConfirmSave(true)}
                            style={{
                                padding: '8px 20px', background: 'var(--admin-primary)', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit'
                            }}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            )}

            {/* Success message */}
            {saveResult && (
                <div style={{
                    padding: '12px 20px', borderRadius: '10px', marginBottom: '16px',
                    background: saveResult.includes('Failed') ? '#FEF2F2' : '#F0FDF4',
                    color: saveResult.includes('Failed') ? '#DC2626' : '#16A34A',
                    fontSize: '13px', fontWeight: 600
                }}>
                    {saveResult}
                </div>
            )}

            {/* Table */}
            <div className="admin-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    {loading ? (
                        <div className="admin-spinner" style={{ padding: '40px' }}>
                            <div className="admin-spinner__circle" />
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
                                    <th style={thStyle}>Product Name</th>
                                    <th style={thStyle}>Category</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>MRP</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>DP</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>SP</th>
                                    <th style={{ ...thStyle, textAlign: 'center', width: '120px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map(item => {
                                    const changeType = getItemChangeType(item.id);
                                    const rowBg = changeType === 'added' ? '#F0FDF4'
                                        : changeType === 'modified' ? '#FFFBEB'
                                        : changeType === 'deleted' ? '#FEF2F2'
                                        : 'transparent';

                                    return (
                                        <tr key={item.id} style={{
                                            borderBottom: '1px solid var(--admin-border-light)',
                                            background: rowBg,
                                            opacity: changeType === 'deleted' ? 0.5 : 1,
                                            textDecoration: changeType === 'deleted' ? 'line-through' : 'none'
                                        }}>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {item.name}
                                                    {changeType && (
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                                                            borderRadius: '6px', textTransform: 'uppercase',
                                                            background: changeType === 'added' ? '#DCFCE7' : changeType === 'modified' ? '#FEF3C7' : '#FEE2E2',
                                                            color: changeType === 'added' ? '#166534' : changeType === 'modified' ? '#92400E' : '#991B1B',
                                                            textDecoration: 'none'
                                                        }}>
                                                            {changeType}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, color: 'var(--admin-text-secondary)' }}>{item.category}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>₹{item.mrp.toFixed(0)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>₹{item.dp.toFixed(0)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{item.sp}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {changeType ? (
                                                    <button
                                                        onClick={() => handleUndoChange(item.id)}
                                                        style={{ ...actionBtnStyle, color: '#6B7280' }}
                                                        title="Undo change"
                                                    >
                                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                                            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditItem(item)}
                                                            style={{ ...actionBtnStyle, color: 'var(--admin-primary)' }}
                                                            title="Edit"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            style={{ ...actionBtnStyle, color: '#EF4444' }}
                                                            title="Delete"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editItem && (
                <div className="admin-modal-overlay" onClick={() => setEditItem(null)}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <div className="admin-modal__header">
                            <h2 className="admin-modal__title">Edit Product</h2>
                            <button className="admin-modal__close" onClick={() => setEditItem(null)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="admin-modal__body">
                            <div className="admin-modal__field">
                                <label className="admin-modal__label">Product Name</label>
                                <input className="admin-modal__input" style={{ width: '100%' }} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="admin-modal__field">
                                <label className="admin-modal__label">Category</label>
                                <input className="admin-modal__input" style={{ width: '100%' }} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div className="admin-modal__field" style={{ flex: 1, minWidth: 0 }}>
                                    <label className="admin-modal__label">MRP (Rs)</label>
                                    <input className="admin-modal__input" style={{ width: '100%' }} type="number" value={editForm.mrp} onChange={e => setEditForm(f => ({ ...f, mrp: parseFloat(e.target.value) || 0 }))} />
                                </div>
                                <div className="admin-modal__field" style={{ flex: 1, minWidth: 0 }}>
                                    <label className="admin-modal__label">DP (Rs)</label>
                                    <input className="admin-modal__input" style={{ width: '100%' }} type="number" value={editForm.dp} onChange={e => setEditForm(f => ({ ...f, dp: parseFloat(e.target.value) || 0 }))} />
                                </div>
                                <div className="admin-modal__field" style={{ flex: 1, minWidth: 0 }}>
                                    <label className="admin-modal__label">SP Points</label>
                                    <input className="admin-modal__input" style={{ width: '100%' }} type="number" step="0.01" value={editForm.sp} onChange={e => setEditForm(f => ({ ...f, sp: parseFloat(e.target.value) || 0 }))} />
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px 24px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setEditItem(null)}
                                style={{
                                    flex: 1, padding: '12px', background: '#F3F4F6', color: '#6B7280',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit'
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleSaveEdit}
                                style={{
                                    flex: 2, padding: '12px', background: 'var(--admin-primary)', color: 'white',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                                    cursor: 'pointer', fontFamily: 'inherit'
                                }}
                            >Update</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Item Modal */}
            {showAddForm && (
                <div className="admin-modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <div className="admin-modal__header">
                            <h2 className="admin-modal__title">Add New Product</h2>
                            <button className="admin-modal__close" onClick={() => setShowAddForm(false)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="admin-modal__body">
                            <div className="admin-modal__field">
                                <label className="admin-modal__label">Product Name</label>
                                <input className="admin-modal__input" style={{ width: '100%' }} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. VITAMIN C TABLET (60)" />
                            </div>
                            <div className="admin-modal__field">
                                <label className="admin-modal__label">Category</label>
                                <input className="admin-modal__input" style={{ width: '100%' }} value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Wellroot" list="catalog-categories" />
                                <datalist id="catalog-categories">
                                    {categories.map(cat => <option key={cat} value={cat} />)}
                                </datalist>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div className="admin-modal__field" style={{ flex: 1, minWidth: 0 }}>
                                    <label className="admin-modal__label">MRP (Rs)</label>
                                    <input className="admin-modal__input" style={{ width: '100%' }} type="number" value={addForm.mrp || ''} onChange={e => setAddForm(f => ({ ...f, mrp: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                                </div>
                                <div className="admin-modal__field" style={{ flex: 1, minWidth: 0 }}>
                                    <label className="admin-modal__label">DP (Rs)</label>
                                    <input className="admin-modal__input" style={{ width: '100%' }} type="number" value={addForm.dp || ''} onChange={e => setAddForm(f => ({ ...f, dp: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                                </div>
                                <div className="admin-modal__field" style={{ flex: 1, minWidth: 0 }}>
                                    <label className="admin-modal__label">SP Points</label>
                                    <input className="admin-modal__input" style={{ width: '100%' }} type="number" step="0.01" value={addForm.sp || ''} onChange={e => setAddForm(f => ({ ...f, sp: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px 24px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowAddForm(false)}
                                style={{
                                    flex: 1, padding: '12px', background: '#F3F4F6', color: '#6B7280',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit'
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleAddItem}
                                disabled={!addForm.name.trim()}
                                style={{
                                    flex: 2, padding: '12px', background: 'var(--admin-primary)', color: 'white',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    opacity: addForm.name.trim() ? 1 : 0.5
                                }}
                            >Add to Catalog</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Save Modal */}
            {showConfirmSave && (
                <div className="admin-modal-overlay" onClick={() => setShowConfirmSave(false)}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="admin-modal__header">
                            <h2 className="admin-modal__title">Confirm Save Changes</h2>
                            <button className="admin-modal__close" onClick={() => setShowConfirmSave(false)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div style={{ padding: '0 24px 16px' }}>
                            <p style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
                                This will update the default catalog to <strong>v{currentVersion + 1}</strong>.
                                All existing shops will receive a notification to import the changes.
                            </p>
                            <div style={{ background: 'var(--admin-bg)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                {changeSummary.added > 0 && (
                                    <div style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600, marginBottom: '4px' }}>
                                        + {changeSummary.added} new item{changeSummary.added > 1 ? 's' : ''}
                                    </div>
                                )}
                                {changeSummary.modified > 0 && (
                                    <div style={{ fontSize: '13px', color: '#D97706', fontWeight: 600, marginBottom: '4px' }}>
                                        ~ {changeSummary.modified} modified item{changeSummary.modified > 1 ? 's' : ''}
                                    </div>
                                )}
                                {changeSummary.deleted > 0 && (
                                    <div style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>
                                        - {changeSummary.deleted} removed item{changeSummary.deleted > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                            <div style={{
                                background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
                                padding: '12px', fontSize: '12px', color: '#166534', lineHeight: 1.5
                            }}>
                                <strong>Note:</strong> Existing shops' stock quantities will NOT be affected. Only product details (names, prices) will be updated when they choose to import.
                            </div>
                        </div>
                        <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowConfirmSave(false)}
                                disabled={saving}
                                style={{
                                    flex: 1, padding: '12px', background: '#F3F4F6', color: '#6B7280',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit'
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleSaveChanges}
                                disabled={saving}
                                style={{
                                    flex: 2, padding: '12px', background: 'var(--admin-primary)', color: 'white',
                                    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                    opacity: saving ? 0.7 : 1
                                }}
                            >{saving ? 'Saving...' : 'Save & Publish'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Inline styles for table
const thStyle: React.CSSProperties = {
    padding: '12px 16px', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--admin-text-muted)', textAlign: 'left', whiteSpace: 'nowrap'
};

const tdStyle: React.CSSProperties = {
    padding: '12px 16px', fontSize: '13px', color: 'var(--admin-text)',
    fontFamily: 'inherit'
};

const actionBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
    borderRadius: '6px', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', transition: 'background 0.15s'
};

export default DefaultCatalogManager;
