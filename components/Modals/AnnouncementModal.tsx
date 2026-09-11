'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  link_url?: string;
  link_text?: string;
  is_active: boolean;
}

interface AnnouncementModalProps {
  userId?: string | null;
}

export default function AnnouncementModal({ userId }: AnnouncementModalProps) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      checkActiveAnnouncement();
    }
  }, [userId]);

  const checkActiveAnnouncement = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    const dismissedKey = `announcement_dismissed_${data.id}`;
    const isDismissed = localStorage.getItem(dismissedKey);

    if (!isDismissed) {
      setAnnouncement(data);
      setIsOpen(true);
    }
  };

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem(`announcement_dismissed_${announcement.id}`, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || !announcement) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-emerald-500/50 shadow-2xl shadow-emerald-500/10 rounded-2xl w-full max-w-sm p-5 relative flex flex-col gap-4 text-white">
        {/* Close X Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-sm z-10"
        >
          ✕
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg flex-shrink-0">
            📢
          </div>
          <div>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block">
              League Announcement
            </span>
            <h3 className="font-extrabold text-base text-white mt-0.5">
              {announcement.title}
            </h3>
          </div>
        </div>

        {/* Optional Announcement Image */}
        {announcement.image_url && (
          <div className="w-full rounded-xl overflow-hidden border border-gray-800 max-h-48 bg-gray-950 flex items-center justify-center">
            <img
              src={announcement.image_url}
              alt="Announcement banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Body Content */}
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
          {announcement.content}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-1">
          {/* Optional Hyperlink / CTA Button */}
          {announcement.link_url && (
            <a
              href={announcement.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDismiss}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors text-center shadow-lg flex items-center justify-center gap-1.5"
            >
              <span>{announcement.link_text || 'Learn More'}</span>
              <span className="text-[10px]">↗</span>
            </a>
          )}

          <button
            onClick={handleDismiss}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
