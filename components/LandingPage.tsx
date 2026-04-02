import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, Smartphone, Store, MapPin, X, KeyRound, ArrowRight, Package, Receipt, PieChart, Flower, Shield, Leaf, CheckCircle2, Star, Check } from 'lucide-react';
import { db } from '../firebaseConfig';
import { loginUser, registerShop } from '../services/authService';
import { doc, getDoc } from 'firebase/firestore';
import { ShopProfile } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';

interface LandingPageProps {
  onLogin: (user: any, profile?: ShopProfile) => void;
}

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
    { id: '3', title: 'Franchise Analytics', description: 'Gain deep insights into sales performance and patient demographics across all your centers from a single, intuitive dashboard.', linkText: 'View reports →', iconType: 'pie-chart' }
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
  ctaDescription: "Join hundreds of successful franchises using instabill to streamline their billing and inventory.",
  supportPhone: "+91 98765 43210",
  supportEmail: "support@instabill.com"
};

const getEmbedUrl = (url: string) => {
  if (!url) return '';

  if (url.includes('vimeo.com') && !url.includes('player.vimeo.com')) {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (match) {
      return `https://player.vimeo.com/video/${match[1]}?autoplay=1&loop=1&muted=1`;
    }
  }

  if ((url.includes('youtube.com') || url.includes('youtu.be')) && !url.includes('/embed/')) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}`;
    }
  }

  return url;
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  // Try to find the icon, fallback to Check icon if not found
  const formatName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  const IconComponent = (LucideIcons as any)[formatName] || LucideIcons.CheckCircle2;
  return <IconComponent className={className} />;
};

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [activeModal, setActiveModal] = useState<'none' | 'login' | 'register' | 'video'>('none');
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);

  // Auth States
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Register State
  const [regShopName, setRegShopName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regAcceptedTerms, setRegAcceptedTerms] = useState(false);

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
      }
    } catch (error) {
      console.error("Error fetching landing page config:", error);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPhone || !password) { setError("Please enter both phone and password"); return; }
    setIsLoading(true); setError('');
    try {
      const result = await loginUser(adminPhone, password);
      onLogin(result.user, result.shopProfile || undefined);
    } catch (err: any) {
      setError("Login failed. Please check your credentials.");
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regShopName || !regAddress || !regPhone || !regPassword) { setRegError("Please fill in all fields"); return; }
    if (regPassword !== regConfirmPassword) { setRegError("Passwords do not match"); return; }
    if (regPassword.length < 6) { setRegError("Password must be at least 6 characters"); return; }
    if (!regAcceptedTerms) { setRegError("Please accept the Terms and Conditions, Privacy Policy, and Refund Policy"); return; }
    setRegLoading(true); setRegError('');
    try {
      const result = await registerShop(regShopName, regAddress, regPhone, regPassword);
      onLogin(result.user, result.shopProfile);
    } catch (err: any) {
      setRegError(err.message || "Registration failed. Please try again.");
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans text-[#02575c] bg-[#f9fbf8] selection:bg-[#daf4d7]">

      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f9fbf8]/90 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <img src="/Logo-Icon.png" alt="Instabill" className="h-8 object-contain" />
            <span className="text-xl font-heading font-bold text-[#02575c] tracking-tight">Instabill</span>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#02575c] transition-colors">Features</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#02575c] transition-colors">Why Us</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#02575c] transition-colors">Pricing</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#02575c] transition-colors">Contact</a>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <button onClick={() => setActiveModal('login')} className="text-sm font-semibold text-[#02575c] hover:text-[#00747B] transition-colors px-4 py-2">
              Login
            </button>
            <button onClick={() => setActiveModal('register')} className="bg-[#00747B] hover:bg-[#1a5f54] text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-all shadow-[0_2px_10px_rgba(33,119,106,0.2)]">
              Get Started
            </button>
          </motion.div>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20">

        {/* Hero Section */}
        <section className="container mx-auto px-6 text-center mb-24">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#daf4d7] text-[#00747B] rounded-full text-xs font-bold tracking-wide mb-8 shadow-sm">
            <Store size={14} /> {config.heroBadge}
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-[1.1] max-w-4xl mx-auto mb-6 tracking-tight">
            {config.heroTitle.split('\n').map((line, i) => (
              <span key={i} className={i === 0 ? "block text-transparent bg-clip-text bg-gradient-to-r from-[#00747B] to-[#88de7d]" : "block text-[#02575c]"}>
                {line}
              </span>
            ))}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto font-medium mb-10">
            {config.heroDescription}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button onClick={() => setActiveModal('register')} className="w-full sm:w-auto bg-[#00747B] hover:bg-[#1a5f54] text-white px-8 py-3.5 rounded-md font-bold text-base transition-all shadow-[0_4px_14px_rgba(33,119,106,0.3)] hover:-translate-y-0.5">
              Get Started
            </button>
            <button onClick={() => { if (config.heroVideoUrl) setActiveModal('video'); }} className="w-full sm:w-auto bg-transparent border border-[#00747B] text-[#00747B] hover:bg-[#00747B]/5 px-8 py-3.5 rounded-md font-bold text-base transition-all">
              Watch Demo
            </button>
          </motion.div>

          {/* Hero Video / Mockup Box */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="max-w-5xl mx-auto relative z-10 w-full px-4 sm:px-6">
            {config.heroVideoUrl ? (
              <div className="w-full mx-auto sm:px-6">
                <div className="relative rounded-2xl sm:rounded-[2rem] border-[6px] sm:border-8 border-white bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] mx-auto overflow-hidden ring-1 ring-gray-900/5">
                  {/* Browser-like header */}
                  <div className="h-8 sm:h-10 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400"></div>
                  </div>
                  {/* Media Container */}
                  <div className="relative w-full aspect-[4/3] md:aspect-video bg-[#02575c] flex items-center justify-center cursor-pointer group" onClick={() => setActiveModal('video')}>
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                        <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1"></div>
                      </div>
                    </div>
                    {/* Video Player */}
                    {config.heroVideoUrl.includes('youtube') || config.heroVideoUrl.includes('vimeo') ? (
                      <iframe src={getEmbedUrl(config.heroVideoUrl)} allow="autoplay; fullscreen; picture-in-picture" className="w-full h-full bg-transparent border-none outline-none relative z-10 pointer-events-none" />
                    ) : (
                      <video src={config.heroVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-contain bg-[#02575c] border-none outline-none relative z-10" />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Blank empty container
              <div className="w-full h-12 bg-transparent pointer-events-none"></div>
            )}
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-6 mb-32 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {config.gridFeatures.map((feature, idx) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex flex-col relative overflow-hidden group"
              >
                {/* Subtle gradient background based on index */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl bg-gradient-to-br ${idx === 0 ? 'from-[#daf4d7]/40 to-transparent' : idx === 1 ? 'from-green-50 to-transparent' : 'from-[#e7faff] to-transparent'}`}></div>

                <div className="relative z-10 flex-1">
                  <div className="w-12 h-12 bg-[#daf4d7] rounded-xl flex items-center justify-center text-[#00747B] mb-6 shadow-sm">
                    <DynamicIcon name={feature.iconType} className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#02575c] mb-3">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium">{feature.description}</p>
                </div>
                <a href="#" className="relative z-10 text-[#00747B] text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  {feature.linkText}
                </a>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Choose Instabill Section */}
        <section className="bg-white py-24 mb-0 relative overflow-hidden">
          {/* Sliced background design */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-[#f6fbf5] transform skew-x-12 translate-x-32 hidden lg:block border-l border-[#daf4d7]/50"></div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl lg:text-5xl font-heading font-bold text-[#02575c] leading-tight mb-4">
                {config.whyChooseTitle}
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-500 text-lg md:text-xl max-w-3xl mx-auto font-medium">
                {config.whyChooseDescription}
              </motion.p>
            </div>

            <div className="space-y-32">
              {config.whyChooseFeatures.map((feat, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <div key={feat.id} className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 lg:gap-20 items-center`}>
                    {/* Content */}
                    <div className="flex-1 space-y-6">
                      <motion.div
                        initial={{ opacity: 0, x: isEven ? -40 : 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                      >
                        <div className="w-14 h-14 rounded-2xl bg-[#daf4d7] flex items-center justify-center text-[#00747B] mb-8 shadow-sm">
                          <DynamicIcon name={feat.iconType} className="w-7 h-7" />
                        </div>
                        <h3 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[#00747B] to-[#88de7d]">
                          {feat.title}
                        </h3>
                        <p className="text-gray-500 text-lg leading-relaxed font-medium">
                          {feat.description}
                        </p>
                      </motion.div>
                    </div>

                    {/* Image */}
                    <div className="flex-1 w-full flex justify-center items-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: isEven ? 40 : -40 }}
                        whileInView={{ opacity: 1, scale: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="w-full max-w-[500px]"
                      >
                        {feat.imageUrl ? (
                          <img src={feat.imageUrl} alt={feat.title} className="w-full h-auto object-contain animate-float" />
                        ) : (
                          <div className="w-full aspect-square bg-transparent flex items-center justify-center text-gray-400">
                            <DynamicIcon name="image" className="w-12 h-12 mb-2 text-gray-300 block animate-float" />
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-[#f9fbf8] border-t border-gray-100">
          <div className="container mx-auto px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-[#02575c] mb-4 tracking-tight">
                {config.ctaTitle}
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto mb-10">
                {config.ctaDescription}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => setActiveModal('register')} className="w-full sm:w-auto bg-[#00747B] hover:bg-[#1a5f54] text-white px-8 py-3.5 rounded-md font-bold text-sm transition-all shadow-md shadow-[#00747B]/20">
                  Get Started for Free
                </button>
                <button onClick={() => { if (config.heroVideoUrl) setActiveModal('video'); }} className="w-full sm:w-auto bg-transparent border border-gray-300 text-gray-700 hover:border-gray-400 px-8 py-3.5 rounded-md font-bold text-sm transition-all">
                  Watch Demo
                </button>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* Footer / Support */}
      <footer className="bg-white border-t border-gray-100 py-12 md:py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <img src="/Logo-Icon.png" alt="Instabill" className="h-6 object-contain grayscale opacity-80" />
                <span className="font-heading font-bold text-[#02575c] text-lg">Instabill</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">Modern billing and management platform for Ayurveda franchises.</p>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-[#02575c] uppercase tracking-wider mb-1">Support</h4>
              {config.supportPhone && (
                <a href={`tel:${config.supportPhone.replace(/\s+/g, '')}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#00747B] transition-colors font-medium">
                  <Smartphone size={16} className="text-[#88de7d]" />
                  {config.supportPhone}
                </a>
              )}
              {config.supportEmail && (
                <a href={`mailto:${config.supportEmail}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#00747B] transition-colors font-medium">
                  <DynamicIcon name="mail" className="w-4 h-4 text-[#88de7d]" />
                  {config.supportEmail}
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Modals from original */}
      <AnimatePresence>
        {activeModal === 'video' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#02575c]/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-8">
            <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/50 hover:text-white p-3 hover:bg-white/10 rounded-full transition-colors z-[110]">
              <X size={32} />
            </button>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="w-full max-w-6xl rounded-2xl relative shadow-2xl overflow-hidden bg-black ring-1 ring-white/10 aspect-[4/3] sm:aspect-video z-[105]">
              {config.heroVideoUrl.includes('youtube') || config.heroVideoUrl.includes('vimeo') ? (
                <iframe src={getEmbedUrl(config.heroVideoUrl)} allow="autoplay; fullscreen; picture-in-picture" className="w-full h-full bg-transparent border-none outline-none" />
              ) : (
                <video src={config.heroVideoUrl} controls autoPlay className="w-full h-full object-contain bg-black border-none outline-none" />
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Same login/register modals, unchanged logic, just matching new aesthetic mostly intact. */}
        {activeModal === 'login' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#02575c]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            {/* Same login body as before, simplified slightly */}
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 p-8 relative">
              <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 text-gray-400 hover:text-[#02575c] p-2 hover:bg-gray-50 rounded-full"><X size={20} /></button>
              <h3 className="text-2xl font-bold font-heading text-center mb-6">Login</h3>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label>
                  <input type="text" value={adminPhone} onChange={e => setAdminPhone(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" placeholder="Enter phone" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" placeholder="••••••••" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-[#00747B] text-white py-3 rounded-lg font-bold mt-2 disabled:opacity-50">
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Login'}
                </button>
                {error && <p className="text-red-500 text-xs text-center font-medium mt-2">{error}</p>}
              </form>
            </motion.div>
          </motion.div>
        )}

        {activeModal === 'register' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#02575c]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 p-8 relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 text-gray-400 hover:text-[#02575c] p-2 hover:bg-gray-50 rounded-full"><X size={20} /></button>
              <h3 className="text-2xl font-bold font-heading text-center mb-6">Register Shop</h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Shop Name</label><input type="text" value={regShopName} onChange={e => setRegShopName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Address</label><input type="text" value={regAddress} onChange={e => setRegAddress(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone</label><input type="text" value={regPhone} onChange={e => setRegPhone(e.target.value.replace(/\D/g, ''))} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Confirm Password</label><input type="password" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#00747B] outline-none" /></div>
                <div className="flex items-start gap-2 mt-2">
                  <input type="checkbox" id="regTerms" checked={regAcceptedTerms} onChange={e => setRegAcceptedTerms(e.target.checked)} className="mt-1 accent-[#00747B]" />
                  <label htmlFor="regTerms" className="text-xs text-gray-500 leading-tight">
                    I accept the <a href="/?terms=true" target="_blank" className="text-[#00747B] hover:underline">Terms and Conditions</a>, <a href="/?privacy=true" target="_blank" className="text-[#00747B] hover:underline">Privacy Policy</a>, and <a href="/?refund=true" target="_blank" className="text-[#00747B] hover:underline">Refund Policy</a>.
                  </label>
                </div>
                <button type="submit" disabled={regLoading || !regAcceptedTerms} className="w-full bg-[#00747B] text-white py-3 rounded-lg font-bold mt-4 disabled:opacity-50 transition-opacity">
                  {regLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Register'}
                </button>
                {regError && <p className="text-red-500 text-xs text-center font-medium mt-2">{regError}</p>}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}