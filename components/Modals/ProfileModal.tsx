'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onProfileUpdated: () => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  userId,
  onProfileUpdated,
}: ProfileModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);

  const [rawImage, setRawImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, team_name, avatar_url, email_notifications')
      .eq('id', userId)
      .single();

    if (data) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setTeamName(data.team_name || '');
      setAvatarUrl(data.avatar_url || null);
      setEmailNotifications(data.email_notifications !== false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawImage(e.target?.result as string);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const generateCroppedBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!rawImage) return resolve(null);
      const img = new Image();
      img.src = rawImage;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 400;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        const containerSize = 192;
        const scaleRatio = size / containerSize;

        const coverScale = Math.max(containerSize / img.width, containerSize / img.height);
        const drawW = img.width * coverScale * zoom * scaleRatio;
        const drawH = img.height * coverScale * zoom * scaleRatio;

        const drawX = (size - drawW) / 2 + pan.x * scaleRatio;
        const drawY = (size - drawH) / 2 + pan.y * scaleRatio;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
      };
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      let finalAvatarUrl = avatarUrl;

      if (rawImage) {
        setUploading(true);
        const croppedBlob = await generateCroppedBlob();
        if (croppedBlob) {
          const filePath = `${userId}/${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          finalAvatarUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          team_name: teamName.trim(),
          avatar_url: finalAvatarUrl,
          email_notifications: emailNotifications,
        })
        .eq('id', userId);

      if (error) throw error;

      setAvatarUrl(finalAvatarUrl);
      setRawImage(null);
      setMessage({ type: 'success', text: 'Profile updated!' });
      onProfileUpdated();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || 'PS';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <h2 className="text-base font-bold text-white mb-4">Edit Profile</h2>

        {message && (
          <div
            className={`p-2.5 rounded-lg text-xs mb-3 border ${
              message.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-500/50'
                : 'bg-red-950 text-red-200 border-red-500/50'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-48 h-48 rounded-full bg-gray-800 border-2 border-emerald-500 overflow-hidden relative cursor-grab active:cursor-grabbing shadow-xl select-none"
            >
              {rawImage ? (
                <img
                  src={rawImage}
                  alt="Crop Preview"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                  }}
                  className="w-full h-full object-cover pointer-events-none transition-transform duration-75"
                />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-white">
                  {initials}
                </div>
              )}
            </div>

            {rawImage && (
              <div className="flex flex-col items-center gap-1.5 w-full">
                <p className="text-[10px] text-emerald-400 font-semibold">
                  👈 Drag image to position, use slider to zoom
                </p>
                <div className="flex items-center gap-2 w-full max-w-xs px-4">
                  <span className="text-xs text-gray-400">Zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            )}

            <label className="cursor-pointer text-xs bg-gray-800 hover:bg-gray-700 text-emerald-400 px-3 py-1.5 rounded-lg border border-gray-700 font-semibold transition-colors">
              {rawImage ? 'Choose Different Photo' : 'Upload New Photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-2 border-t border-gray-800">
            <input
              type="checkbox"
              id="emailNotifications"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <label htmlFor="emailNotifications" className="text-xs text-gray-300 cursor-pointer select-none font-medium">
              Receive weekly pick reminder emails
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm mt-1 transition-colors"
          >
            {saving || uploading ? 'Saving & Uploading...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
