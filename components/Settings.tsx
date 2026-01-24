import React, { useState, useEffect } from 'react';
import { Database, Trash2, AlertTriangle, Loader2, CloudOff, Video, Plus, X, Link as LinkIcon, Upload } from 'lucide-react';
import { store } from '../store';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

interface ResultVideo {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'uploaded';
  isShowcase?: boolean;
}

const Settings: React.FC = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeCloud, setWipeCloud] = useState(false);

  // Video Management State
  const [videos, setVideos] = useState<ResultVideo[]>([]);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoType, setVideoType] = useState<'youtube' | 'uploaded'>('youtube');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Shop Info State
  const [shopName, setShopName] = useState(store.getSettings().shopName);
  const [shopAddress, setShopAddress] = useState(store.getSettings().shopAddress);
  const [isSavingShopInfo, setIsSavingShopInfo] = useState(false);

  // Preferences State
  const [defaultBillingMode, setDefaultBillingMode] = useState(store.getSettings().defaultBillingMode || 'DP');

  useEffect(() => {
    const q = query(collection(db, 'result_videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResultVideo));
      setVideos(videoData);
    });

    const unsubscribeStore = store.subscribe(() => {
      const s = store.getSettings();
      // Only update if not currently editing (optional, but good for UX? 
      // Actually simple sync is fine, maybe check if equal)
      // If user is typing, we might overwrite. 
      // But typically settings don't change often by others while one is typing.
      // Let's just sync for now, assuming conflict is rare with single admin likely.
      // Actually, if I update state here, user input might get clobbered if typing.
      // Better to only sync if we are NOT editing? 
      // Or just let it be. 'setShopName' will re-render.
      // If I am typing 'A', 'B', 'C', and store sends update... it might be annoying.
      // However, store only updates if `updateSettings` is called or cloud updates.
      // Cloud update should reflect.
      // Let's check keys.
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        // crude check to avoid overwriting while typing
        setShopName(s.shopName);
        setShopAddress(s.shopAddress);
      }
      // Always sync defaultBillingMode as it's not a text input
      setDefaultBillingMode(s.defaultBillingMode || 'DP');
    });

    return () => {
      unsubscribe();
      unsubscribeStore();
    };
  }, []);

  const handleReset = async () => {
    setIsResetting(true);
    setTimeout(async () => {
      try {
        const result = await store.resetDatabase(wipeCloud);
        alert(result.message);
        setShowWipeConfirm(false);
      } catch (e) {
        console.error(e);
        alert("Failed to reset database.");
      } finally {
        setIsResetting(false);
      }
    }, 100);
  };

  const handleSaveShopInfo = async () => {
    setIsSavingShopInfo(true);
    await store.updateSettings({ shopName, shopAddress });
    setIsSavingShopInfo(false);
    alert('Shop information saved successfully!');
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle) return alert("Please enter a title");

    setIsUploading(true);
    try {
      let finalUrl = '';

      if (videoType === 'youtube') {
        // Extract ID from URL if needed, or just save clean URL
        // Simple regex for ID extraction could be added, but for now trusting input or generic embed logic
        finalUrl = youtubeLink;
      } else {
        if (!videoFile) return alert("Please select a file");
        const storageRef = ref(storage, `result_videos/${Date.now()}_${videoFile.name}`);
        const snapshot = await uploadBytes(storageRef, videoFile);
        finalUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'result_videos'), {
        title: videoTitle,
        url: finalUrl,
        type: videoType,
        isShowcase: false,
        createdAt: new Date().toISOString()
      });

      setIsAddingVideo(false);
      setVideoTitle('');
      setYoutubeLink('');
      setVideoFile(null);
    } catch (error) {
      console.error("Error adding video:", error);
      alert("Failed to upload/add video.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVideo = async (video: ResultVideo) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await deleteDoc(doc(db, 'result_videos', video.id));
      if (video.type === 'uploaded') {
        const videoRef = ref(storage, video.url);
        await deleteObject(videoRef).catch(err => console.log("Storage delete skipped or failed:", err));
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      alert("Failed to delete video.");
    }
  };

  const toggleShowcase = async (video: ResultVideo) => {
    try {
      await updateDoc(doc(db, 'result_videos', video.id), {
        isShowcase: !video.isShowcase
      });
    } catch (error) {
      console.error("Error toggling showcase:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full overflow-y-auto pr-2 custom-scrollbar relative pb-24 md:pb-2">

      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 bg-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md animate-modal-in">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-dark text-center mb-2">Delete All Data?</h3>
            <p className="text-gray-500 text-center mb-6">
              This action will <strong>permanently delete</strong> all Bills, Customers, and Products. This cannot be undone.
            </p>

            <div className="bg-red-50 p-4 rounded-xl mb-6 flex items-start gap-3">
              <input
                type="checkbox"
                id="wipeCloud"
                checked={wipeCloud}
                onChange={(e) => setWipeCloud(e.target.checked)}
                className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <label htmlFor="wipeCloud" className="text-sm text-red-800 cursor-pointer select-none">
                <strong>Also wipe Cloud Database?</strong>
                <br />
                <span className="text-xs opacity-80">Uncheck to only clear data from this device (Local Storage).</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWipeConfirm(false)}
                disabled={isResetting}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isResetting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {isResetting ? "Wiping..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-dark mb-6">Settings</h2>

      {/* Shop Information Section */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-dark mb-6">Shop Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              placeholder="Enter shop name"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Shop Address</label>
            <textarea
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium resize-none"
              placeholder="Enter shop address"
            />
          </div>

          <button
            onClick={handleSaveShopInfo}
            disabled={isSavingShopInfo}
            className="bg-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-dark-light transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingShopInfo ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Database size={18} />
                Save Shop Info
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-dark mb-6 flex items-center gap-2">
          Preferences
        </h3>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <div>
            <h4 className="font-bold text-dark text-sm mb-1">Default Billing Price Mode</h4>
            <p className="text-xs text-gray-500">Choose the default price type for new bills.</p>
          </div>

          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => store.updateSettings({ defaultBillingMode: 'MRP' })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${defaultBillingMode === 'MRP'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-dark'
                }`}
            >
              MRP
            </button>
            <button
              onClick={() => store.updateSettings({ defaultBillingMode: 'DP' })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${defaultBillingMode === 'DP'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-dark'
                }`}
            >
              DP
            </button>
          </div>
        </div>
      </div>

      {/* Video Management Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-dark flex items-center gap-2">
            <Video size={20} /> Result Gallery Manager
          </h3>
          <button
            onClick={() => setIsAddingVideo(!isAddingVideo)}
            className="bg-primary text-dark px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors flex items-center gap-2"
          >
            {isAddingVideo ? <X size={18} /> : <Plus size={18} />}
            {isAddingVideo ? 'Cancel' : 'Add Video'}
          </button>
        </div>

        {isAddingVideo && (
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 animate-in slide-in-from-top duration-300">
            <form onSubmit={handleAddVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">VIDEO TITLE</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Patient Success Story - Diabetes"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setVideoType('youtube')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${videoType === 'youtube' ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                >
                  <LinkIcon size={16} /> YouTube Link
                </button>
                <button
                  type="button"
                  onClick={() => setVideoType('uploaded')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${videoType === 'uploaded' ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                >
                  <Upload size={16} /> Upload File
                </button>
              </div>

              {videoType === 'youtube' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">YOUTUBE VIDEO ID / LINK</label>
                  <input
                    type="text"
                    value={youtubeLink}
                    onChange={e => setYoutubeLink(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. dQw4w9WgXcQ"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">SELECT VIDEO FILE</label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={e => setVideoFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maximum size 50MB suggested.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3 bg-dark text-white rounded-xl font-bold hover:bg-dark-light transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {isUploading ? 'Uploading...' : 'Add Video to Gallery'}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {videos.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-400">
              <Video size={32} className="mx-auto mb-2 opacity-50" />
              <p>No videos added yet.</p>
            </div>
          ) : (
            videos.map(video => (
              <div key={video.id} className="relative group rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="aspect-video bg-gray-900">
                  {video.type === 'uploaded' ? (
                    <video src={video.url} className="w-full h-full object-cover" />
                  ) : (
                    <img
                      src={`https://img.youtube.com/vi/${(() => {
                        const url = video.url;
                        if (!url) return '';
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                        const match = url.match(regExp);
                        return (match && match[2].length === 11) ? match[2] : url.split('/').pop() || '';
                      })()}/hqdefault.jpg`}
                      className="w-full h-full object-cover"
                      alt="Thumbnail"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => toggleShowcase(video)}
                      className={`p-2 rounded-full transition-colors ${video.isShowcase ? 'bg-yellow-400 text-white hover:bg-yellow-500' : 'bg-gray-200 text-gray-400 hover:bg-white'}`}
                      title={video.isShowcase ? "Remove from Showcase" : "Add to Showcase"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={video.isShowcase ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video)}
                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      title="Delete Video"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <h4 className="font-bold text-dark text-sm truncate" title={video.title}>{video.title}</h4>
                  <span className="text-xs text-gray-400 uppercase font-medium">{video.type}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <Database size={20} /> Database Management
        </h3>

        <div className="space-y-6">
          {/* RESET DATABASE */}
          <div className="p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-red-900 mb-1 flex items-center gap-2">
                <AlertTriangle size={18} /> Danger Zone: Reset Database
              </h4>
              <p className="text-sm text-red-700 max-w-md">
                Clear all application data including sales history, customer records, and inventory.
              </p>
            </div>
            <button
              onClick={() => setShowWipeConfirm(true)}
              className="px-6 py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Trash2 size={18} /> Wipe All Data
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h3 className="text-lg font-bold text-dark mb-4">App Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">App Name</label>
            <p className="font-bold text-dark">Ayush Ayurveda Manager</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Version</label>
            <p className="font-bold text-dark">v1.1.0</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <p className="font-bold text-dark">System Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;