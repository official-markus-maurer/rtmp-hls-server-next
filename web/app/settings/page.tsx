
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Copy, Eye, EyeOff, Upload, Camera, X, Check } from 'lucide-react';
import Image from 'next/image';
import Cropper from 'react-easy-crop';

interface Point {
  x: number;
  y: number;
}

interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  
  const [streamKey, setStreamKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
    if (session?.user) {
      fetchStreamKey();
      setAvatarUrl(session.user.image || null);
    }
  }, [session, status, router]);

  const fetchStreamKey = async () => {
    try {
      const res = await fetch('/api/settings/stream-key');
      if (res.ok) {
        const data = await res.json();
        setStreamKey(data.streamKey);
      }
    } catch (error) {
      console.error('Failed to fetch stream key', error);
    }
  };

  const generateNewKey = async () => {
    if (!confirm('Are you sure? This will invalidate your current stream key and stop any active streams.')) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/settings/stream-key', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStreamKey(data.streamKey);
        setMessage('New stream key generated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Failed to generate key', error);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setIsCropModalOpen(true);
        // Reset file input so the same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg');
    });
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new window.Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const handleUploadCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setUploadingAvatar(true);
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels);
      
      const formData = new FormData();
      formData.append('file', croppedBlob, 'avatar.jpg');

      const res = await fetch('/api/settings/avatar', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const newAvatarUrl = `${data.avatar}?t=${Date.now()}`; // Add timestamp for cache busting
        setAvatarUrl(newAvatarUrl);
        // Update session to reflect new avatar immediately
        await update({ ...session, user: { ...session?.user, image: newAvatarUrl } });
        setMessage('Avatar updated successfully!');
        setIsCropModalOpen(false);
      } else {
        const error = await res.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Avatar upload failed', error);
      setMessage('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(streamKey);
    setMessage('Copied to clipboard!');
    setTimeout(() => setMessage(''), 3000);
  };

  if (status === 'loading') return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 relative">
      <h1 className="text-2xl font-bold mb-8">Channel Settings</h1>
      
      {/* Crop Modal */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-secondary border border-white/10 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                 <h3 className="font-semibold text-lg">Edit Profile Picture</h3>
                 <button onClick={() => setIsCropModalOpen(false)} className="text-zinc-400 hover:text-white">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="relative h-[300px] w-full bg-black">
                 <Cropper
                    image={imageSrc || undefined}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                 />
              </div>

              <div className="p-4 space-y-4">
                 <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Zoom</span>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                 </div>
                 
                 <div className="flex gap-2 justify-end">
                    <button 
                       onClick={() => setIsCropModalOpen(false)}
                       className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                    >
                       Cancel
                    </button>
                    <button 
                       onClick={handleUploadCroppedImage}
                       disabled={uploadingAvatar}
                       className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors text-sm font-medium flex items-center gap-2"
                    >
                       {uploadingAvatar ? (
                          <RefreshCw size={16} className="animate-spin" />
                       ) : (
                          <Check size={16} />
                       )}
                       Save Picture
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-secondary/50 border border-white/5 rounded-xl p-6 mb-8">
         <h2 className="text-lg font-semibold mb-4">Profile</h2>
         <div className="flex items-start gap-6">
            <div className="relative group">
               <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 border-2 border-white/10 relative">
                  {avatarUrl ? (
                    <Image 
                      src={avatarUrl} 
                      alt="Avatar" 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <Camera size={32} />
                    </div>
                  )}
               </div>
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 disabled={uploadingAvatar}
                 className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full"
               >
                 <Upload size={20} className="text-white" />
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*"
                 onChange={onFileChange}
               />
            </div>
            
            <div className="flex-1 space-y-4">
               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Username</label>
                  <input 
                    type="text" 
                    readOnly
                    value={session?.user?.name || ''}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-zinc-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Username cannot be changed.</p>
               </div>
               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
                  <input 
                    type="email" 
                    readOnly
                    value={session?.user?.email || ''}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-zinc-500 cursor-not-allowed"
                  />
               </div>
            </div>
         </div>
      </div>

      <div className="bg-secondary/50 border border-white/5 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Stream Configuration</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Stream URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value="rtmp://streams.ryuum3gum1n.de:1935/live"
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-zinc-300 font-mono text-sm"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText("rtmp://streams.ryuum3gum1n.de:1935/live");
                  setMessage('URL Copied!');
                  setTimeout(() => setMessage(''), 3000);
                }}
                className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-colors"
              >
                <Copy size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Stream Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type={showKey ? "text" : "password"} 
                  readOnly 
                  value={streamKey}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-zinc-300 font-mono text-sm pr-10"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                onClick={copyToClipboard}
                className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-colors"
                title="Copy Key"
              >
                <Copy size={20} />
              </button>
              <button 
                onClick={generateNewKey}
                disabled={loading}
                className="bg-accent/10 hover:bg-accent/20 text-accent p-2 rounded-lg transition-colors"
                title="Generate New Key"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Keep this key secret! Anyone with this key can stream to your channel.
            </p>
          </div>
        </div>

        {message && (
          <div className="mt-4 p-3 bg-green-500/10 text-green-500 rounded-lg text-sm">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
