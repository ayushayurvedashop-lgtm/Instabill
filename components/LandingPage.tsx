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
    { id: '1', title: 'Ayurveda Specific Workflows', description: 'Custom fields for Prakriti analysis, Nadi Pariksha records, and herbal treatment plans integrated directly into billing.', iconType: 'flower' },
    { id: '2', title: 'Reliable & Secure', description: 'Data security you can trust with 99.9% uptime. Your patient data is encrypted and backed up automatically.', iconType: 'shield' },
    { id: '3', title: 'Nature Inspired Interface', description: 'A calming, clean interface that reduces eye strain and matches the ethos of your holistic practice.', iconType: 'leaf' }
  ],
  ctaTitle: "Ready to modernize your Ayurveda clinic?",
  ctaDescription: "Join hundreds of successful franchises using instabill to streamline their billing and inventory."
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  // Try to find the icon, fallback to Check icon if not found
  const formatName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  const IconComponent = (LucideIcons as any)[formatName] || LucideIcons.CheckCircle2;
  return <IconComponent className={className} />;
};

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [activeModal, setActiveModal] = useState<'none' | 'login' | 'register'>('none');
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
    <div className="min-h-screen font-sans text-[#111617] bg-[#f9fbf8] selection:bg-[#daf4d7]">

      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f9fbf8]/90 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <img src="/Logo-Icon.png" alt="Instabill" className="h-8 object-contain" />
            <span className="text-xl font-heading font-bold text-[#111617] tracking-tight">Instabill</span>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#111617] transition-colors">Features</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#111617] transition-colors">Why Us</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#111617] transition-colors">Pricing</a>
            <a href="#" className="text-sm font-medium text-gray-500 hover:text-[#111617] transition-colors">Contact</a>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <button onClick={() => setActiveModal('login')} className="text-sm font-semibold text-[#111617] hover:text-[#21776a] transition-colors px-4 py-2">
              Login
            </button>
            <button onClick={() => setActiveModal('register')} className="bg-[#21776a] hover:bg-[#1a5f54] text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-all shadow-[0_2px_10px_rgba(33,119,106,0.2)]">
              Get Started
            </button>
          </motion.div>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20">

        {/* Hero Section */}
        <section className="container mx-auto px-6 text-center mb-24">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#daf4d7] text-[#21776a] rounded-full text-xs font-bold tracking-wide mb-8 shadow-sm">
            <Store size={14} /> {config.heroBadge}
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-[1.1] max-w-4xl mx-auto mb-6 tracking-tight">
            {config.heroTitle.split('\n').map((line, i) => (
              <span key={i} className={i === 0 ? "block text-transparent bg-clip-text bg-gradient-to-r from-[#21776a] to-[#88de7d]" : "block text-[#111617]"}>
                {line}
              </span>
            ))}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto font-medium mb-10">
            {config.heroDescription}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button onClick={() => setActiveModal('register')} className="w-full sm:w-auto bg-[#21776a] hover:bg-[#1a5f54] text-white px-8 py-3.5 rounded-md font-bold text-base transition-all shadow-[0_4px_14px_rgba(33,119,106,0.3)] hover:-translate-y-0.5">
              Get Started
            </button>
            <button onClick={() => { }} className="w-full sm:w-auto bg-transparent border border-[#21776a] text-[#21776a] hover:bg-[#21776a]/5 px-8 py-3.5 rounded-md font-bold text-base transition-all">
              Watch Demo
            </button>
          </motion.div>

          {/* Hero Video / Transparent Media Box */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="max-w-4xl mx-auto relative z-10 w-full px-4">
            {config.heroVideoUrl ? (
              <div className="w-full mx-auto">
                {config.heroVideoUrl.includes('youtube') || config.heroVideoUrl.includes('vimeo') ? (
                  <iframe src={config.heroVideoUrl} allow="autoplay; fullscreen; picture-in-picture" className="w-full aspect-video bg-transparent border-none outline-none" />
                ) : (
                  <video src={config.heroVideoUrl} autoPlay loop muted playsInline className="w-full h-auto max-h-[600px] object-contain bg-transparent border-none outline-none" />
                )}
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
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl bg-gradient-to-br ${idx === 0 ? 'from-[#daf4d7]/40 to-transparent' : idx === 1 ? 'from-green-50 to-transparent' : 'from-emerald-50 to-transparent'}`}></div>

                <div className="relative z-10 flex-1">
                  <div className="w-12 h-12 bg-[#daf4d7] rounded-xl flex items-center justify-center text-[#21776a] mb-6 shadow-sm">
                    <DynamicIcon name={feature.iconType} className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#111617] mb-3">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium">{feature.description}</p>
                </div>
                <a href="#" className="relative z-10 text-[#21776a] text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
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
            <div className="flex flex-col lg:flex-row gap-16 items-center">
              {/* Left Content */}
              <div className="flex-1 space-y-10">
                <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-4">
                  <h2 className="text-3xl lg:text-4xl font-heading font-bold text-[#111617] leading-tight">
                    {config.whyChooseTitle}
                  </h2>
                  <p className="text-gray-500 text-lg">
                    {config.whyChooseDescription}
                  </p>
                </motion.div>

                <div className="space-y-6">
                  {config.whyChooseFeatures.map((feat, idx) => (
                    <motion.div
                      key={feat.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex gap-4"
                    >
                      <div className="mt-1 w-8 h-8 rounded-full bg-[#daf4d7] flex items-center justify-center shrink-0 text-[#21776a]">
                        <DynamicIcon name={feat.iconType} className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#111617] mb-1">{feat.title}</h4>
                        <p className="text-sm text-gray-500 leading-relaxed">{feat.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <motion.button initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="bg-[#21776a] hover:bg-[#1a5f54] text-white px-6 py-3 rounded-md font-bold text-sm transition-colors shadow-md shadow-[#21776a]/20">
                  Learn More About Us
                </motion.button>
              </div>

              {/* Right Media / Video Container (No Border, Transparent) */}
              <div className="flex-1 w-full flex justify-center lg:justify-end relative min-h-[400px]">
                {config.whyChooseVideoUrl ? (
                  // User provided a transparent video
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="w-full max-w-[500px]">
                    {config.whyChooseVideoUrl.includes('youtube') || config.whyChooseVideoUrl.includes('vimeo') ? (
                      <iframe src={config.whyChooseVideoUrl} className="w-full aspect-square bg-transparent outline-none border-none" />
                    ) : (
                      <video src={config.whyChooseVideoUrl} autoPlay loop muted playsInline className="w-full object-contain bg-transparent outline-none border-none" />
                    )}
                  </motion.div>
                ) : (
                  // Mockup placeholder replicating the reference image's layout cards (a visual placeholder if no video)
                  <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative w-full max-w-[500px] h-[450px]">
                    <div className="absolute top-0 left-0 w-[240px] h-[240px] bg-[#111617] rounded-3xl shadow-xl overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80" className="w-full h-full object-cover opacity-80" alt="Herbs" />
                    </div>

                    <div className="absolute top-4 right-0 w-[220px] bg-[#daf4d7] rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center aspect-square transform translate-x-4">
                      <span className="text-4xl font-heading font-black text-[#21776a]">99%</span>
                      <span className="text-xs text-[#21776a] font-medium mt-1">Customer Satisfaction</span>
                    </div>

                    <div className="absolute bottom-4 left-0 w-[250px] bg-[#daf4d7]/70 backdrop-blur-md rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center transform -translate-y-4">
                      <span className="text-4xl font-heading font-black text-[#21776a]">500+</span>
                      <span className="text-xs text-[#21776a] font-medium mt-1">Clinics Onboarded</span>
                    </div>

                    <div className="absolute bottom-10 right-0 w-[260px] h-[180px] bg-white rounded-3xl shadow-2xl overflow-hidden translate-x-4">
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm z-10">
                        <CheckCircle2 size={14} className="text-[#88de7d]" />
                        <div>
                          <p className="text-[8px] font-bold text-gray-400 leading-none">STATUS</p>
                          <p className="text-[10px] font-bold text-[#111617] leading-none mt-0.5">GST Compliant</p>
                        </div>
                      </div>
                      <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80" className="w-full h-full object-cover" alt="Analytics" />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-[#f9fbf8] border-t border-gray-100">
          <div className="container mx-auto px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-[#111617] mb-4 tracking-tight">
                {config.ctaTitle}
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto mb-10">
                {config.ctaDescription}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => setActiveModal('register')} className="w-full sm:w-auto bg-[#21776a] hover:bg-[#1a5f54] text-white px-8 py-3.5 rounded-md font-bold text-sm transition-all shadow-md shadow-[#21776a]/20">
                  Get Started for Free
                </button>
                <button className="w-full sm:w-auto bg-transparent border border-gray-300 text-gray-700 hover:border-gray-400 px-8 py-3.5 rounded-md font-bold text-sm transition-all">
                  Watch Demo
                </button>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/Logo-Icon.png" alt="Instabill" className="h-5 object-contain grayscale" />
            <span className="font-heading font-bold text-[#111617] text-sm">Instabill</span>
          </div>
          <div className="text-xs text-gray-400 font-medium">
            © {new Date().getFullYear()} Instabill. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Modals from original */}
      <AnimatePresence>
        {/* Same login/register modals, unchanged logic, just matching new aesthetic mostly intact. */}
        {activeModal === 'login' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#111617]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            {/* Same login body as before, simplified slightly */}
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 p-8 relative">
              <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 text-gray-400 hover:text-[#111617] p-2 hover:bg-gray-50 rounded-full"><X size={20} /></button>
              <h3 className="text-2xl font-bold font-heading text-center mb-6">Login</h3>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label>
                  <input type="text" value={adminPhone} onChange={e => setAdminPhone(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" placeholder="Enter phone" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" placeholder="••••••••" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-[#21776a] text-white py-3 rounded-lg font-bold mt-2 disabled:opacity-50">
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Login'}
                </button>
                {error && <p className="text-red-500 text-xs text-center font-medium mt-2">{error}</p>}
              </form>
            </motion.div>
          </motion.div>
        )}

        {activeModal === 'register' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#111617]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 p-8 relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setActiveModal('none')} className="absolute top-4 right-4 text-gray-400 hover:text-[#111617] p-2 hover:bg-gray-50 rounded-full"><X size={20} /></button>
              <h3 className="text-2xl font-bold font-heading text-center mb-6">Register Shop</h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Shop Name</label><input type="text" value={regShopName} onChange={e => setRegShopName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Address</label><input type="text" value={regAddress} onChange={e => setRegAddress(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone</label><input type="text" value={regPhone} onChange={e => setRegPhone(e.target.value.replace(/\D/g, ''))} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Confirm Password</label><input type="password" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[#21776a] outline-none" /></div>
                <button type="submit" disabled={regLoading} className="w-full bg-[#21776a] text-white py-3 rounded-lg font-bold mt-4 disabled:opacity-50">
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