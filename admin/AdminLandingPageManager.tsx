import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, GripVertical, Image as ImageIcon, Loader2, Save } from 'lucide-react';

export interface GridFeature {
    id: string;
    title: string;
    description: string;
    linkText: string;
    iconType: string;
}

export interface WhyChooseFeature {
    id: string;
    title: string;
    description: string;
    iconType: string;
    imageUrl?: string;
}

export interface LandingPageConfig {
    heroBadge: string;
    heroTitle: string;
    heroDescription: string;
    heroVideoUrl: string;
    gridFeatures: GridFeature[];
    whyChooseTitle: string;
    whyChooseDescription: string;
    whyChooseVideoUrl: string;
    whyChooseFeatures: WhyChooseFeature[];
    ctaTitle: string;
    ctaDescription: string;
    supportPhone?: string;
    supportEmail?: string;
}

const DEFAULT_CONFIG: LandingPageConfig = {
    heroBadge: "Built For Asclepius Franchises",
    heroTitle: "Faster Billing\nSmart Management",
    heroDescription: "Generate bills, track SP, pending products and run your franchise smoothly — all in one place.",
    heroVideoUrl: "",
    gridFeatures: [
        { id: '1', title: 'Inventory Management', description: 'Track herbal stocks effortlessly across all locations with real-time updates and low-stock alerts tailored for complex Ayurvedic formulations.', linkText: 'Learn more →', iconType: 'package' },
        { id: '2', title: 'GST Ready Billing', description: 'Create compliant invoices instantly with automated tax calculations tailored for India. Generate detailed patient bills with treatment breakdowns.', linkText: 'See how it works →', iconType: 'receipt' },
        { id: '3', title: 'Franchise Analytics', description: 'Gain deep insights into sales performance and patient demographics across all your centers from a single, intuitive dashboard.', linkText: 'View reports →', iconType: 'piechart' }
    ],
    whyChooseTitle: "Why Choose Instabill?",
    whyChooseDescription: "We understand that running an Ayurveda clinic is different from a regular retail store. Our platform brings harmony to your business operations.",
    whyChooseVideoUrl: "",
    whyChooseFeatures: [
        { id: '1', title: 'Ayurveda Specific Workflows', description: 'Custom fields for Prakriti analysis, Nadi Pariksha records, and herbal treatment plans integrated directly into billing.', iconType: 'flower', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80' },
        { id: '2', title: 'Reliable & Secure', description: 'Data security you can trust with 99.9% uptime. Your patient data is encrypted and backed up automatically.', iconType: 'shield', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80' },
        { id: '3', title: 'Nature Inspired Interface', description: 'A calming, clean interface that reduces eye strain and matches the ethos of your holistic practice.', iconType: 'leaf', imageUrl: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&q=80' }
    ],
    ctaTitle: "Ready to modernize your Ayurveda clinic?",
    ctaDescription: "Join hundreds of successful franchises using Instabill to streamline their billing and inventory.",
    supportPhone: "+91 98765 43210",
    supportEmail: "support@instabill.com"
};

const AdminLandingPageManager: React.FC = () => {
    const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingFeatureId, setUploadingFeatureId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const docRef = doc(db, 'config', 'landing_page');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as LandingPageConfig;
                setConfig({ ...DEFAULT_CONFIG, ...data });
            } else {
                setConfig(DEFAULT_CONFIG);
            }
        } catch (error) {
            console.error("Error fetching landing page config:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await setDoc(doc(db, 'config', 'landing_page'), config);
            setMessage({ text: 'Landing page updated successfully!', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error("Error saving landing page config:", error);
            setMessage({ text: 'Failed to update landing page.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const addGridFeature = () => {
        setConfig(prev => ({
            ...prev,
            gridFeatures: [...prev.gridFeatures, { id: uuidv4(), title: "New Feature", description: "Desc", linkText: "Learn more", iconType: "star" }]
        }));
    };

    const addWhyChooseFeature = () => {
        setConfig(prev => ({
            ...prev,
            whyChooseFeatures: [...prev.whyChooseFeatures, { id: uuidv4(), title: "New Reason", description: "Desc", iconType: "check", imageUrl: "" }]
        }));
    };

    const handleFeatureImageUpload = async (featureId: string, file: File) => {
        try {
            setUploadingFeatureId(featureId);
            const fileRef = ref(storage, `landing_page/features/${featureId}_${file.name}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            setConfig(prev => ({
                ...prev,
                whyChooseFeatures: prev.whyChooseFeatures.map(f =>
                    f.id === featureId ? { ...f, imageUrl: url } : f
                )
            }));
            setMessage({ text: 'Image uploaded successfully!', type: 'success' });
        } catch (error) {
            console.error("Error uploading feature image:", error);
            setMessage({ text: 'Failed to upload image.', type: 'error' });
        } finally {
            setUploadingFeatureId(null);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 size={32} className="animate-spin text-[#21776a]" /></div>;

    return (
        <div className="admin-dashboard max-w-5xl mx-auto pb-20">
            <div className="admin-page-header flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm mb-6 border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-[#111617]">Landing Page Content</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage the content shown to visitors on the main website.</p>
                </div>
                <button onClick={handleSave} disabled={saving} className="bg-[#21776a] hover:bg-[#1a5f54] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl mb-6 font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-[#daf4d7] text-[#21776a]' : 'bg-red-50 text-red-600'}`}>
                    <div className="w-2 h-2 rounded-full bg-current" />{message.text}
                </div>
            )}

            {/* Hero Section */}
            <div className="admin-card mb-8 rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="admin-card__header bg-gray-50 border-b border-gray-100 px-6 py-4"><h2 className="text-lg font-bold text-[#111617]">Hero Section</h2></div>
                <div className="admin-card__body p-6 space-y-5">
                    <InputGroup label="Badge Text" value={config.heroBadge} onChange={(v) => setConfig({ ...config, heroBadge: v })} />
                    <InputGroup label="Main Title" value={config.heroTitle} onChange={(v) => setConfig({ ...config, heroTitle: v })} isTextArea />
                    <InputGroup label="Description" value={config.heroDescription} onChange={(v) => setConfig({ ...config, heroDescription: v })} isTextArea />
                    <InputGroup label="Hero Video/Image URL (Optional)" value={config.heroVideoUrl || ''} onChange={(v) => setConfig({ ...config, heroVideoUrl: v })} />
                </div>
            </div>

            {/* Grid Features */}
            <div className="admin-card mb-8 rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="admin-card__header bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[#111617]">Top Grid Features (3 columns)</h2>
                    <button onClick={addGridFeature} className="flex items-center gap-1.5 text-sm font-semibold text-[#21776a] bg-[#daf4d7] px-3 py-1.5 rounded-lg hover:bg-[#c3ecd1]">
                        <Plus size={16} /> Add Grid Feature
                    </button>
                </div>
                <div className="admin-card__body p-6 space-y-4">
                    {config.gridFeatures.map((f, i) => (
                        <div key={f.id} className="border border-gray-200 rounded-xl p-4 flex gap-4 bg-gray-50/50">
                            <div className="flex-1 space-y-3">
                                <div className="flex gap-4">
                                    <div className="flex-1"><InputGroup label="Title" value={f.title} onChange={(v) => setConfig(prev => ({ ...prev, gridFeatures: prev.gridFeatures.map(x => x.id === f.id ? { ...x, title: v } : x) }))} /></div>
                                    <div className="flex-1"><InputGroup label="Icon Name (lucide)" value={f.iconType} onChange={(v) => setConfig(prev => ({ ...prev, gridFeatures: prev.gridFeatures.map(x => x.id === f.id ? { ...x, iconType: v } : x) }))} /></div>
                                    <div className="flex-1"><InputGroup label="Link Text" value={f.linkText} onChange={(v) => setConfig(prev => ({ ...prev, gridFeatures: prev.gridFeatures.map(x => x.id === f.id ? { ...x, linkText: v } : x) }))} /></div>
                                </div>
                                <InputGroup label="Description" value={f.description} onChange={(v) => setConfig(prev => ({ ...prev, gridFeatures: prev.gridFeatures.map(x => x.id === f.id ? { ...x, description: v } : x) }))} isTextArea />
                            </div>
                            <button onClick={() => setConfig(prev => ({ ...prev, gridFeatures: prev.gridFeatures.filter(x => x.id !== f.id) }))} className="text-red-500 hover:bg-red-50 p-2 rounded h-fit"><Trash2 size={18} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Why Choose Section */}
            <div className="admin-card mb-8 rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="admin-card__header bg-gray-50 border-b border-gray-100 px-6 py-4"><h2 className="text-lg font-bold text-[#111617]">Why Choose Instabill Section</h2></div>
                <div className="admin-card__body p-6 space-y-5">
                    <InputGroup label="Section Title" value={config.whyChooseTitle} onChange={(v) => setConfig({ ...config, whyChooseTitle: v })} />
                    <InputGroup label="Section Description" value={config.whyChooseDescription} onChange={(v) => setConfig({ ...config, whyChooseDescription: v })} isTextArea />
                    <InputGroup label="Transparent Video/Image URL (Optional)" value={config.whyChooseVideoUrl || ''} onChange={(v) => setConfig({ ...config, whyChooseVideoUrl: v })} />

                    <div className="pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-[#111617]">List Features</h3>
                            <button onClick={addWhyChooseFeature} className="flex items-center gap-1.5 text-sm font-semibold text-[#21776a] bg-[#daf4d7] px-3 py-1.5 rounded-lg hover:bg-[#c3ecd1]">
                                <Plus size={16} /> Add Feature
                            </button>
                        </div>
                        <div className="space-y-4">
                            {config.whyChooseFeatures.map((f, i) => (
                                <div key={f.id} className="border border-gray-200 rounded-xl p-4 flex gap-4 bg-gray-50/50">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex gap-4">
                                            <div className="flex-[2]"><InputGroup label="Title" value={f.title} onChange={(v) => setConfig(prev => ({ ...prev, whyChooseFeatures: prev.whyChooseFeatures.map(x => x.id === f.id ? { ...x, title: v } : x) }))} /></div>
                                            <div className="flex-1"><InputGroup label="Icon Name (lucide)" value={f.iconType} onChange={(v) => setConfig(prev => ({ ...prev, whyChooseFeatures: prev.whyChooseFeatures.map(x => x.id === f.id ? { ...x, iconType: v } : x) }))} /></div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Feature Image (Transparent PNG)</label>
                                            <div className="flex items-center gap-4">
                                                {f.imageUrl && (
                                                    <div className="w-16 h-16 rounded bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                                        <img src={f.imageUrl} alt="Preview" className="w-12 h-12 object-contain" />
                                                    </div>
                                                )}
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFeatureImageUpload(f.id, file);
                                                        }}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                        disabled={uploadingFeatureId === f.id}
                                                    />
                                                    <div className={`w-full border-2 border-dashed rounded-xl px-4 py-3 flex items-center justify-center gap-2 ${uploadingFeatureId === f.id ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-[#21776a]/30 bg-[#daf4d7]/20 text-[#21776a] hover:bg-[#daf4d7]/40'} transition-colors`}>
                                                        {uploadingFeatureId === f.id ? (
                                                            <><Loader2 size={18} className="animate-spin" /> Uploading...</>
                                                        ) : (
                                                            <><ImageIcon size={18} /> {f.imageUrl ? 'Change Image' : 'Upload Image'}</>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <InputGroup label="Description" value={f.description} onChange={(v) => setConfig(prev => ({ ...prev, whyChooseFeatures: prev.whyChooseFeatures.map(x => x.id === f.id ? { ...x, description: v } : x) }))} isTextArea />
                                    </div>
                                    <button onClick={() => setConfig(prev => ({ ...prev, whyChooseFeatures: prev.whyChooseFeatures.filter(x => x.id !== f.id) }))} className="text-red-500 hover:bg-red-50 p-2 rounded h-fit"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section and Support */}
            <div className="admin-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="admin-card__header bg-gray-50 border-b border-gray-100 px-6 py-4"><h2 className="text-lg font-bold text-[#111617]">Bottom CTA & Support Section</h2></div>
                <div className="admin-card__body p-6 space-y-5">
                    <InputGroup label="CTA Title" value={config.ctaTitle} onChange={(v) => setConfig({ ...config, ctaTitle: v })} />
                    <InputGroup label="CTA Description" value={config.ctaDescription} onChange={(v) => setConfig({ ...config, ctaDescription: v })} isTextArea />

                    <div className="border-t border-gray-100 pt-5 mt-5 space-y-5">
                        <h3 className="font-bold text-[#111617] mb-2">Support Contact Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputGroup label="Support Phone Number" value={config.supportPhone || ''} onChange={(v) => setConfig({ ...config, supportPhone: v })} />
                            <InputGroup label="Support Email Address" value={config.supportEmail || ''} onChange={(v) => setConfig({ ...config, supportEmail: v })} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InputGroup = ({ label, value, onChange, isTextArea = false }: { label: string, value: string, onChange: (v: string) => void, isTextArea?: boolean }) => (
    <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
        {isTextArea ? (
            <textarea value={value} onChange={e => onChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#88de7d] text-dark shadow-sm bg-white" />
        ) : (
            <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#88de7d] text-dark shadow-sm bg-white" />
        )}
    </div>
);

export default AdminLandingPageManager;
