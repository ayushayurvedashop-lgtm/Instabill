import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Loader2, Phone, Lock, Flower, Smartphone, User, Play, X, KeyRound, Volume2, VolumeX, Maximize2, ChevronRight, Grid, Search, Package, Download } from 'lucide-react';
// import { usePWAInstall } from '../hooks/usePWAInstall';
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { checkIsAdmin } from '../services/adminService';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { store } from '../store';
import { Product } from '../types';

interface LandingPageProps {
  onLogin: (user: any) => void;
}

interface ResultVideo {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'uploaded';
  isShowcase?: boolean;
}

const getYoutubeId = (url: string) => {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url.split('/').pop() || '';
};

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isProductCheckerOpen, setIsProductCheckerOpen] = useState(false);
  // const { isInstallable, installApp } = usePWAInstall();
  // const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // const handleInstallClick = () => {
  //   if (isInstallable) {
  //     installApp();
  //   } else {
  //     setIsInstallModalOpen(true);
  //   }
  // };

  // Auth State
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Video State
  const [videos, setVideos] = useState<ResultVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<ResultVideo | null>(null);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Product Checker State
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    fetchVideos();
    fetchProducts();
  }, []);

  // Auto-scroll effect for video carousel
  useEffect(() => {
    if (showAllVideos || videos.length === 0) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let scrollAmount = 0;
    const speed = 0.5; // Pixels per frame
    let animationId: number;

    const scroll = () => {
      scrollAmount += speed;
      if (scrollAmount >= scrollContainer.scrollWidth / 2) {
        scrollAmount = 0;
        scrollContainer.scrollLeft = 0;
      } else {
        scrollContainer.scrollLeft = scrollAmount;
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(animationId);
  }, [videos, showAllVideos]);

  const fetchVideos = async () => {
    try {
      const q = query(collection(db, 'result_videos'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const videoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResultVideo));
      setVideos(videoData);
    } catch (err) {
      console.error("Error fetching videos:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const allProducts = store.getProducts();
      setProducts(allProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPhone || !password) {
      setError("Please enter both phone and password");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Construct the pseudo-email for admin login
      // Format: [PhoneNumber]@veda.admin
      const email = `${adminPhone}@veda.admin`;

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Double check admin status (though domain check is implicit in adminService, it's good to check DB too)
      const isAdmin = await checkIsAdmin(user.uid, user.email, null);

      if (isAdmin) {
        onLogin(user);
      } else {
        await signOut(auth);
        setError("Access Denied: You are not authorized.");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Invalid Phone Number or Password.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Invalid Phone Number format.");
      } else {
        setError("Login failed. Please try again.");
      }
      setIsLoading(false);
    }
  };

  // Filter videos for the carousel
  const showcaseVideos = videos.filter(v => v.isShowcase);
  const displayVideos = showcaseVideos.length > 0 ? showcaseVideos : videos.slice(0, 5);

  // Duplicate videos for infinite scroll effect - Ensure enough copies for smooth looping
  // If we have 5 videos, 4x = 20 videos. At 400px each, that's 8000px, plenty for 1080p/4k screens.
  const carouselVideos = [...displayVideos, ...displayVideos, ...displayVideos, ...displayVideos];

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black flex flex-col overflow-y-auto overflow-x-hidden overscroll-none text-dark font-sans">
      <div className="flex flex-col min-h-full w-full">
        {/* Full Screen Hero Section */}
        <div className="relative min-h-[100dvh] w-full flex flex-col overflow-hidden">
          {/* Background Video - Fixed to Viewport to prevent white bars */}
          <div className="fixed inset-0 h-[100dvh] w-full z-0 pointer-events-none bg-black">
            <iframe
              src="https://player.vimeo.com/video/1144159371?background=1&autoplay=1&muted=1&loop=1&controls=0&title=0&byline=0&portrait=0&autopause=0"
              className="absolute top-1/2 left-1/2 w-[350%] h-[350%] -translate-x-1/2 -translate-y-1/2 object-cover pointer-events-none lg:w-[150%] lg:h-[150%]"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            ></iframe>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          </div>

          {/* Header & Hero Content Wrapper */}
          <div className="relative z-10 container mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col h-full flex-1">
            {/* Header - Modern & Clean */}
            <div className="flex justify-between items-center mb-12 md:mb-20 shrink-0 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary rounded-xl flex items-center justify-center text-dark font-bold text-xl shadow-lg shadow-black/20">
                  <Flower size={24} />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">Ayush<br />Ayurveda</h1>
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                <button
                  onClick={() => setIsProductCheckerOpen(true)}
                  className="text-sm font-bold text-white/80 hover:text-white transition-colors px-2 py-1"
                >
                  Check Stock
                </button>

                {/* Install Button Removed as per request */}

                <button
                  onClick={() => setIsAdminLoginOpen(true)}
                  className="px-5 py-2.5 bg-white text-dark text-sm font-bold rounded-full hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                >
                  <ShieldCheck size={16} />
                  Admin Login
                </button>
              </div>
            </div>

            {/* Hero Text Content - Centered */}
            <div className="flex-1 flex flex-col items-center justify-center text-center pb-20">
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-bold uppercase tracking-wider mb-2 border border-white/20 animate-slide-up mx-auto backdrop-blur-md">
                  <Flower size={14} />
                  An Asclepius Franchise
                </div>

                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white leading-[0.95] tracking-tighter animate-slide-up [animation-delay:200ms] opacity-0">
                  Welcome To <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">Ayush Ayurveda</span>
                </h1>

                <p className="text-gray-200 text-lg md:text-2xl max-w-2xl leading-relaxed mx-auto font-medium animate-slide-up [animation-delay:400ms] opacity-0 drop-shadow-sm">
                  Embrace the ancient wisdom of natural healing. We provide authentic, certified ayurvedic remedies for a balanced and healthy life.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 animate-slide-up [animation-delay:600ms] opacity-0">
                  <button onClick={() => setIsProductCheckerOpen(true)} className="px-8 py-4 bg-primary hover:bg-primary-hover text-dark font-bold rounded-2xl transition-all shadow-lg shadow-black/20 hover:shadow-black/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                    Check Stock <ChevronRight size={20} />
                  </button>
                  <button onClick={() => document.getElementById('success-stories')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold rounded-2xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md">
                    <Play size={20} className="fill-current" /> Success Stories
                  </button>
                </div>
              </div>
            </div>

            {/* Scroll Indicator Option */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block text-white/50">
              <ChevronRight size={24} className="rotate-90" />
            </div>
          </div>
        </div>


        {/* Below Fold Content */}
        <div className="w-full relative z-10 bg-[#fdfdfc]">
          {/* Result Videos Section */}
          {videos.length > 0 && (
            <div id="success-stories" className="py-12 md:py-20 animate-slide-up">
              <div className="container mx-auto px-4 md:px-6 flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-black text-dark mb-2">Success Stories</h2>
                  <p className="text-gray-500">Real results from real people</p>
                </div>
                <button
                  onClick={() => setShowAllVideos(!showAllVideos)}
                  className="flex items-center gap-2 text-sm font-bold text-primary-700 hover:text-primary-800 transition-colors bg-primary/10 px-4 py-2 rounded-full"
                >
                  {showAllVideos ? <><X size={16} /> Show Less</> : <><Grid size={16} /> Show All</>}
                </button>
              </div>

              {showAllVideos ? (
                /* Grid View */
                <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.map(video => (
                    <div key={video.id} className="bg-white rounded-2xl overflow-hidden shadow-md group hover:shadow-xl transition-all cursor-pointer border border-gray-100" onClick={() => setActiveVideo(video)}>
                      <div className="aspect-video bg-gray-900 relative">
                        {video.type === 'uploaded' ? (
                          <video src={video.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <img src={`https://img.youtube.com/vi/${getYoutubeId(video.url)}/hqdefault.jpg`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Video thumbnail" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play size={20} className="text-white fill-white" />
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-dark line-clamp-2">{video.title}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Scrolling Carousel View */
                /* Scrolling Carousel View */
                <div className="w-full overflow-hidden">
                  <div
                    ref={scrollContainerRef}
                    className="flex gap-6 overflow-x-hidden pb-8 pt-2 select-none px-4 md:px-0"
                    onMouseEnter={() => { if (scrollContainerRef.current) scrollContainerRef.current.style.scrollBehavior = 'auto'; }}
                  >
                    {carouselVideos.map((video, index) => (
                      <div
                        key={`${video.id}-${index}`}
                        className="min-w-[300px] md:min-w-[400px] bg-white rounded-3xl overflow-hidden shadow-lg transform hover:-translate-y-2 transition-all duration-300 border border-gray-100 group shrink-0"
                      >
                        <div className="aspect-video bg-black relative overflow-hidden">
                          {video.type === 'uploaded' ? (
                            <video
                              src={video.url}
                              muted={isMuted}
                              loop
                              autoPlay
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <iframe
                              src={`https://www.youtube.com/embed/${getYoutubeId(video.url)}?controls=0&autoplay=1&mute=1&playlist=${getYoutubeId(video.url)}&loop=1`}
                              className="w-full h-full pointer-events-none"
                              title={video.title}
                            />
                          )}
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>

                          {/* Overlay Controls */}
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                              className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
                            >
                              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                            <button
                              onClick={() => setActiveVideo(video)}
                              className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
                            >
                              <Maximize2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="font-bold text-dark line-clamp-1 mb-1">{video.title}</h3>
                          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Success Story</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Footer */}
          <div className="container mx-auto px-4 md:px-6 mt-auto flex flex-col md:flex-row justify-between items-center gap-4 border-t border-gray-100 pt-8 pb-12">
            <p className="text-gray-400 text-sm font-medium">
              © 2025 Ayush Ayurveda. All rights reserved.
            </p>
            <div className="flex gap-6 text-gray-400 text-sm font-medium">
              <a href="#" className="hover:text-dark transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-dark transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-dark transition-colors">Contact</a>
            </div>
          </div>
        </div>

      </div>

      {/* Video Modal */}
      {activeVideo && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
          <button onClick={() => setActiveVideo(null)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
            <X size={32} />
          </button>
          <div className="w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 animate-modal-in">
            {activeVideo.type === 'uploaded' ? (
              <video src={activeVideo.url} controls autoPlay className="w-full h-full" />
            ) : (
              <iframe
                src={`https://www.youtube.com/embed/${getYoutubeId(activeVideo.url)}?autoplay=1`}
                title={activeVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}

      {/* Product Availability Checker Modal */}
      {isProductCheckerOpen && (
        <div className="fixed inset-0 bg-dark/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-modal-in shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Package size={24} className="text-dark" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-dark">Check Stock</h3>
                  <p className="text-sm text-gray-500">Search our inventory in real-time</p>
                </div>
              </div>
              <button
                onClick={() => setIsProductCheckerOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Search and Filter */}
            <div className="p-6 border-b border-gray-100 space-y-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products by name..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark font-medium"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['All', ...Array.from(new Set(products.map(p => p.category)))].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat
                      ? 'bg-dark text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products
                  .filter(p =>
                    (selectedCategory === 'All' || p.category === selectedCategory) &&
                    p.name.toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .map(product => (
                    <div
                      key={product.id}
                      className="bg-gray-50 rounded-2xl p-4 border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-dark text-sm mb-2">{product.name}</h4>
                          <span className="inline-block bg-white px-2 py-1 rounded text-xs text-gray-600 border shadow-sm">
                            {product.category}
                          </span>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${product.stock > 15
                          ? 'bg-green-100 text-green-700'
                          : product.stock > 0
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {products.filter(p =>
                (selectedCategory === 'All' || p.category === selectedCategory) &&
                p.name.toLowerCase().includes(productSearch.toLowerCase())
              ).length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Package size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No products found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {isAdminLoginOpen && (
        <div className="fixed inset-0 bg-dark/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-modal-in border border-gray-100">
            <div className="p-6 md:p-10 relative">
              <button
                onClick={() => {
                  setIsAdminLoginOpen(false);
                  setAdminPhone('');
                  setPassword('');
                  setError('');
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-dark p-2 rounded-full hover:bg-gray-50 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-dark rounded-2xl flex items-center justify-center mb-4 shadow-xl text-white mx-auto rotate-3">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-3xl font-black text-dark">Admin Access</h3>
                <p className="text-gray-500 font-medium">Secure Store Management</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Phone Number</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Smartphone className="text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                    </div>
                    <input
                      type="text"
                      className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-primary/20 rounded-xl py-3.5 pl-11 pr-4 text-lg font-bold text-dark outline-none transition-all placeholder:text-gray-300"
                      placeholder="9876543210"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <KeyRound className="text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                    </div>
                    <input
                      type="password"
                      className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-primary/20 rounded-xl py-3.5 pl-11 pr-4 text-lg font-bold text-dark outline-none transition-all placeholder:text-gray-300"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !adminPhone || !password}
                  className="w-full bg-dark text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-xl shadow-dark/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4 active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 size={24} className="animate-spin" /> : 'Login to Dashboard'}
                </button>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-center gap-3 animate-pulse border border-red-100">
                    <div className="w-2 h-2 rounded-full bg-red-600 shrink-0"></div>
                    {error}
                  </div>
                )}
              </form>
            </div>
            <div className="bg-gray-50 p-4 text-center text-[10px] text-gray-400 font-bold tracking-widest border-t border-gray-100">
              SECURED BY FIREBASE AUTH
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPage;