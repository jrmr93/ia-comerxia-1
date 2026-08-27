import React, { useState } from 'react';
import { Film, Play, Package, Image as ImageIcon } from 'lucide-react';
import { parseVideoUrl } from '../utils/video-helper.ts';

interface ProductMediaDisplayProps {
  imageUrl?: string | null;
  videoUrl?: string | null;
  name: string;
  className?: string;
  imageClassName?: string;
  videoClassName?: string;
  autoPlayVideo?: boolean;
  showPlayBadge?: boolean;
  placeholderText?: string;
  fallbackIcon?: 'package' | 'image';
  onClick?: (e: React.MouseEvent) => void;
}

export const ProductMediaDisplay: React.FC<ProductMediaDisplayProps> = ({
  imageUrl,
  videoUrl,
  name,
  className = 'w-full h-full relative overflow-hidden',
  imageClassName = 'w-full h-full object-cover',
  videoClassName = 'w-full h-full object-cover',
  autoPlayVideo = true,
  showPlayBadge = true,
  placeholderText = 'Sin imagen',
  fallbackIcon = 'package',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const cleanImageUrl =
    imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '' && imageUrl.trim() !== 'null' && imageUrl.trim() !== 'undefined'
      ? imageUrl.trim()
      : null;

  const cleanVideoUrl =
    videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '' && videoUrl.trim() !== 'null' && videoUrl.trim() !== 'undefined'
      ? videoUrl.trim()
      : null;

  // 1. If has valid imageUrl and hasn't failed to load
  if (cleanImageUrl && !imageError) {
    return (
      <div className={className} onClick={onClick}>
        <img
          src={cleanImageUrl}
          alt={name}
          className={imageClassName}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
        {cleanVideoUrl && showPlayBadge && (
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center space-x-1 shadow-md bg-slate-950/90 text-sky-300 border border-sky-400/40 backdrop-blur-xs">
            <Play className="w-2.5 h-2.5 text-sky-400 fill-current" />
            <span>Video</span>
          </div>
        )}
      </div>
    );
  }

  // 2. If NO image (or image failed to load), but has valid videoUrl
  if (cleanVideoUrl && !videoError) {
    const videoInfo = parseVideoUrl(cleanVideoUrl);

    if (videoInfo) {
      // Direct video file (/uploads/..., .mp4, .webm, data:video/..., blob:...)
      if (videoInfo.isDirect) {
        return (
          <div className={className} onClick={onClick}>
            <video
              src={videoInfo.embedUrl}
              muted
              autoPlay={autoPlayVideo}
              loop
              playsInline
              className={videoClassName}
              onError={() => setVideoError(true)}
            />
            {showPlayBadge && (
              <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center space-x-1 shadow-md bg-slate-950/90 text-emerald-300 border border-emerald-400/40 backdrop-blur-xs">
                <Play className="w-2.5 h-2.5 text-emerald-400 fill-current" />
                <span>Video Clip</span>
              </div>
            )}
          </div>
        );
      }

      // YouTube / YouTube Shorts with thumbnail available
      if (videoInfo.thumbnailUrl) {
        return (
          <div className={className} onClick={onClick}>
            <img
              src={videoInfo.thumbnailUrl}
              alt={name}
              className={imageClassName}
              referrerPolicy="no-referrer"
              onError={() => setVideoError(true)}
            />
            {/* Center Play Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-950/80 text-white border border-white/30 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                <Play className="w-4 h-4 text-sky-400 fill-sky-400 ml-0.5" />
              </div>
            </div>
            {showPlayBadge && (
              <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center space-x-1 shadow-md bg-slate-950/90 text-sky-300 border border-sky-400/40 backdrop-blur-xs">
                <Play className="w-2.5 h-2.5 text-sky-400 fill-current" />
                <span>{videoInfo.platform.toUpperCase()}</span>
              </div>
            )}
          </div>
        );
      }

      // Video platform without static thumbnail (Vimeo, TikTok, Instagram, generic)
      return (
        <div
          className={`${className} bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col items-center justify-center p-3`}
          onClick={onClick}
        >
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-md group-hover:scale-110 transition-transform mb-1.5">
            <Film className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-sky-400/20 text-sky-300 border border-sky-400/30">
            {videoInfo.platform.toUpperCase()} VIDEO
          </span>
          <span className="text-[9px] text-slate-400 mt-1 font-mono text-center truncate max-w-full px-2">
            Clic para reproducir
          </span>
        </div>
      );
    }
  }

  // 3. Fallback: No image and no video (or both failed to load)
  return (
    <div
      className={`${className} flex flex-col items-center justify-center text-slate-400 bg-slate-100`}
      onClick={onClick}
    >
      {fallbackIcon === 'package' ? (
        <Package className="w-10 h-10 mb-1 stroke-1 text-slate-400" />
      ) : (
        <ImageIcon className="w-10 h-10 mb-1 stroke-1 text-slate-400" />
      )}
      {placeholderText && (
        <span className="text-[10px] font-bold text-slate-500">{placeholderText}</span>
      )}
    </div>
  );
};
