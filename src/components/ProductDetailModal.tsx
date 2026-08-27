import React, { useState } from 'react';
import {
  AlertTriangle,
  BadgePercent,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  DollarSign,
  Download,
  Edit2,
  ExternalLink,
  Film,
  Flame,
  Images,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Package,
  PackageCheck,
  Percent,
  Play,
  Scale,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UploadCloud,
  User,
  Video,
  X,
  ZoomIn,
} from 'lucide-react';
import { CostOption, InventoryItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ProductMarketingCopyModal } from './ProductMarketingCopyModal.tsx';
import { ProductWebImagePicker } from './ProductWebImagePicker.tsx';
import { ProductAiVideoPickerModal } from './ProductAiVideoPickerModal.tsx';
import { ProductBarcodeModal } from './ProductBarcodeModal.tsx';
import { downloadImage, downloadMultipleImages, copyImageToClipboard } from '../utils/image-drag-copy.ts';
import { ImageLightboxModal } from './ImageLightboxModal.tsx';
import { parseVideoUrl } from '../utils/video-helper.ts';
import { Barcode, Printer } from 'lucide-react';

interface ProductDetailModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: number) => void;
  onItemUpdated?: (item: InventoryItem) => void;
  currency?: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item: initialItem,
  onClose,
  onEdit,
  onDelete,
  onItemUpdated,
  currency = 'USD',
}) => {
  const { authFetch } = useAuth();
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [currentItem, setCurrentItem] = useState<InventoryItem | null>(initialItem);
  const [updatingCost, setUpdatingCost] = useState(false);
  const [customMargin, setCustomMargin] = useState<number | ''>('');
  const [isEditingMargin, setIsEditingMargin] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showMarketingModal, setShowMarketingModal] = useState<boolean>(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState<boolean>(false);
  const [showWebImagePicker, setShowWebImagePicker] = useState<boolean>(false);
  const [isDownloadingPhoto, setIsDownloadingPhoto] = useState<boolean>(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState<boolean>(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [showVideoPicker, setShowVideoPicker] = useState<boolean>(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState<boolean>(false);
  const [descSavedToast, setDescSavedToast] = useState<string | null>(null);
  const hasInitialImages = Boolean(
    (initialItem?.imageUrl && initialItem.imageUrl.trim() !== '') ||
    (initialItem?.images && initialItem.images.length > 0)
  );
  const [mediaMode, setMediaMode] = useState<'photo' | 'video'>(
    hasInitialImages
      ? 'photo'
      : initialItem?.videoUrl
      ? 'video'
      : 'photo'
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Helper to read and compress image files to base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          } else {
            resolve(reader.result as string);
          }
        };
        img.onerror = () => resolve(reader.result as string);
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Direct upload photo(s) directly to database
  const handleDirectUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentItem) return;

    setIsUploadingPhotos(true);
    setSaveSuccessMsg(`📤 Subiendo ${files.length} foto(s) directamente a la base de datos...`);
    try {
      const base64List: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const b64 = await readFileAsBase64(files[i]);
        if (b64) base64List.push(b64);
      }

      if (base64List.length === 0) {
        setSaveSuccessMsg('⚠️ No se pudieron procesar las imágenes seleccionadas');
        return;
      }

      const res = await authFetch(`/api/inventory/${currentItem.id}/add-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: base64List,
          setAsCover: !currentItem.imageUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setCurrentItem(data.item);
          if (onItemUpdated) onItemUpdated(data.item);
          setSaveSuccessMsg(`✅ ${base64List.length} foto(s) guardada(s) directamente en la base de datos`);
          setActivePhotoIndex(productPhotos.length);
        }
      } else {
        const err = await res.json();
        setSaveSuccessMsg(`⚠️ Error al guardar en base de datos: ${err.error || 'Fallo en la subida'}`);
      }
    } catch (err) {
      console.error('Upload to database failed:', err);
      setSaveSuccessMsg('⚠️ Error al subir fotos a la base de datos');
    } finally {
      setIsUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  // Single button handler to delete image directly from database
  const handleDeleteCurrentImage = async () => {
    if (!currentPhoto || !currentItem || isDeletingPhoto) return;

    setIsDeletingPhoto(true);
    setSaveSuccessMsg('🗑️ Eliminando foto de la base de datos...');
    try {
      const res = await authFetch(`/api/inventory/${currentItem.id}/delete-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: currentPhoto,
          photoIndex: activePhotoIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setCurrentItem(data.item);
          if (onItemUpdated) onItemUpdated(data.item);
          setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : 0));
          setSaveSuccessMsg('✅ Foto eliminada de la base de datos con éxito');
        }
      } else {
        const err = await res.json();
        setSaveSuccessMsg(`⚠️ Error al eliminar foto: ${err.error || 'Fallo en el servidor'}`);
      }
    } catch (err) {
      console.error('Delete image failed:', err);
      setSaveSuccessMsg('⚠️ Error al eliminar la foto');
    } finally {
      setIsDeletingPhoto(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  const handleDownloadSinglePhoto = async (photoUrl: string, photoNum: number) => {
    if (isDownloadingPhoto) return;
    setIsDownloadingPhoto(true);
    setSaveSuccessMsg(`📥 Descargando foto #${photoNum}...`);
    try {
      const ok = await downloadImage(
        photoUrl,
        `${currentItem?.sku || 'producto'}-foto-${photoNum}.jpg`
      );
      if (ok) {
        setSaveSuccessMsg(`✅ Foto #${photoNum} descargada correctamente`);
      } else {
        setSaveSuccessMsg(`ℹ️ Si no inició la descarga automática, usa "Copiar Foto"`);
      }
    } catch {
      setSaveSuccessMsg(`⚠️ Error al descargar foto #${photoNum}`);
    } finally {
      setIsDownloadingPhoto(false);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }
  };

  const [isCopyingPhoto, setIsCopyingPhoto] = useState(false);
  const handleCopyPhoto = async (photoUrl: string) => {
    if (isCopyingPhoto) return;
    setIsCopyingPhoto(true);
    setSaveSuccessMsg('📋 Copiando foto al portapapeles...');
    try {
      const res = await copyImageToClipboard(photoUrl);
      setSaveSuccessMsg(res.message);
    } catch {
      setSaveSuccessMsg('⚠️ No se pudo copiar. Usa el botón Descargar.');
    } finally {
      setIsCopyingPhoto(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  const handleDownloadAllPhotos = async (photosList: string[]) => {
    if (isDownloadingPhoto || photosList.length === 0) return;
    setIsDownloadingPhoto(true);
    setSaveSuccessMsg(`📥 Descargando ${photosList.length} fotos...`);
    try {
      await downloadMultipleImages(
        photosList,
        currentItem?.sku || 'producto',
        (curr, total) => {
          setSaveSuccessMsg(`📥 Descargando foto ${curr} de ${total}...`);
        }
      );
      setSaveSuccessMsg(`✅ ${photosList.length} fotos descargadas`);
    } catch {
      setSaveSuccessMsg(`⚠️ Descarga finalizada`);
    } finally {
      setIsDownloadingPhoto(false);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!currentItem) return;
    setIsGeneratingDesc(true);
    try {
      const res = await authFetch(`/api/inventory/${currentItem.id}/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveToDatabase: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar la descripción');
      if (data.item) {
        setCurrentItem(data.item);
        onItemUpdated?.(data.item);
        setDescSavedToast('¡Descripción comercial regenerada y guardada exitosamente!');
        setTimeout(() => setDescSavedToast(null), 3500);
      }
    } catch (err: any) {
      console.error('Error regenerating description:', err);
      alert(err.message || 'Error al generar la descripción comercial con IA');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  React.useEffect(() => {
    if (!initialItem) {
      setCurrentItem(null);
      setShowMarketingModal(false);
      return;
    }
    // Only reset state if switching to a different product ID
    if (currentItem?.id !== initialItem.id) {
      setCurrentItem(initialItem);
      setSaveSuccessMsg(null);
      setIsEditingMargin(false);
      setShowMarketingModal(false);
      const hasImages = Boolean(
        (initialItem.imageUrl && initialItem.imageUrl.trim() !== '') ||
        (initialItem.images && initialItem.images.length > 0)
      );
      setMediaMode(hasImages ? 'photo' : initialItem.videoUrl ? 'video' : 'photo');
    } else {
      // Keep modal open while updating product data
      setCurrentItem(initialItem);
    }
  }, [initialItem]);

  if (!currentItem) return null;

  let parsedAttributes: Record<string, any> = {};
  if (currentItem.extractedAttributes) {
    try {
      parsedAttributes =
        typeof currentItem.extractedAttributes === 'string'
          ? JSON.parse(currentItem.extractedAttributes)
          : currentItem.extractedAttributes;
    } catch (e) {
      console.warn('Could not parse attributes json:', e);
    }
  }

  // Extract cost options
  const costOptions: CostOption[] = Array.isArray(parsedAttributes.costOptions)
    ? parsedAttributes.costOptions
    : [];

  // Extract all photos of this product
  let productPhotos: string[] = [];
  if (currentItem.images && Array.isArray(currentItem.images) && currentItem.images.length > 0) {
    productPhotos = currentItem.images;
  } else if (parsedAttributes.images && Array.isArray(parsedAttributes.images)) {
    productPhotos = parsedAttributes.images;
  } else if (currentItem.imageUrl) {
    productPhotos = [currentItem.imageUrl];
  }

  const currentPhoto = productPhotos[activePhotoIndex] || currentItem.imageUrl || null;

  const cost = parseFloat(currentItem.costPrice) || 0;
  const sale = parseFloat(currentItem.salePrice) || 0;
  const profitPerUnit = sale - cost;
  const storedMargin = Number(parsedAttributes.profitMarginPercent);
  const currentMarginPercent = !isNaN(storedMargin) && storedMargin > 0
    ? storedMargin
    : cost > 0
    ? Math.round((profitPerUnit / cost) * 100)
    : 30;

  const totalValuation = sale * (currentItem.stock || 0);

  const tagsList = currentItem.tags
    ? currentItem.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Quick switch cost option
  const handleSelectCostOption = async (opt: CostOption) => {
    setUpdatingCost(true);
    setSaveSuccessMsg(null);
    try {
      const res = await authFetch(`/api/inventory/${currentItem.id}/select-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costPrice: opt.price,
          profitMarginPercent: currentMarginPercent,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrentItem(updated);
        if (onItemUpdated) onItemUpdated(updated);
        setSaveSuccessMsg(`Costo actualizado a $${opt.price.toFixed(2)} (${opt.label})`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Failed to select cost option:', err);
    } finally {
      setUpdatingCost(false);
    }
  };

  // Quick update profit margin
  const handleSaveMargin = async (newMargin: number) => {
    if (newMargin <= 0) return;
    setUpdatingCost(true);
    setSaveSuccessMsg(null);
    try {
      const res = await authFetch(`/api/inventory/${currentItem.id}/select-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costPrice: cost,
          profitMarginPercent: newMargin,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrentItem(updated);
        if (onItemUpdated) onItemUpdated(updated);
        setIsEditingMargin(false);
        setSaveSuccessMsg(`Margen de ganancia actualizado a ${newMargin}% (Nuevo PVP: $${Number(updated.salePrice).toFixed(2)})`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Failed to update margin:', err);
    } finally {
      setUpdatingCost(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col text-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-2xs">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  {currentItem.sku}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {currentItem.category}
                </span>
                {productPhotos.length > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center space-x-1">
                    <Images className="w-3 h-3 text-purple-600" />
                    <span>{productPhotos.length} fotos</span>
                  </span>
                )}
                {currentItem.videoUrl && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
                    <Film className="w-3 h-3 text-indigo-600" />
                    <span>Video {parseVideoUrl(currentItem.videoUrl).platform.toUpperCase()}</span>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{currentItem.name}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowBarcodeModal(true)}
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Generar e imprimir etiqueta de código de barras para este producto"
            >
              <Barcode className="w-4 h-4 text-sky-600" />
              <span>Etiqueta Código de Barras</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 py-4 space-y-5">
          {saveSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-fadeIn font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Main Visual and Financial Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Multi-Photo Image Preview & Gallery or Video */}
            <div className="md:col-span-1 flex flex-col space-y-2">
              {/* Media Switcher Tab (Photos vs Video) */}
              {currentItem.videoUrl && (
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMediaMode('photo')}
                    className={`flex-1 py-1 rounded-lg text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      mediaMode === 'photo'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Images className="w-3.5 h-3.5" />
                    <span>Fotos ({productPhotos.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('video')}
                    className={`flex-1 py-1 rounded-lg text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      mediaMode === 'video'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Ver Video</span>
                  </button>
                </div>
              )}

              {mediaMode === 'video' && currentItem.videoUrl ? (
                /* Video Player Container */
                <div className="aspect-square rounded-2xl overflow-hidden bg-black border border-slate-800 relative flex items-center justify-center shadow-2xs">
                  {parseVideoUrl(currentItem.videoUrl).isDirect ? (
                    <video
                      src={parseVideoUrl(currentItem.videoUrl).embedUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  ) : parseVideoUrl(currentItem.videoUrl).embedUrl ? (
                    <iframe
                      src={parseVideoUrl(currentItem.videoUrl).embedUrl}
                      title={currentItem.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="text-center p-4 text-slate-400 text-xs">
                      <Film className="w-8 h-8 mx-auto mb-2 text-sky-400 opacity-80" />
                      <p className="font-bold text-slate-200">Enlace de video</p>
                      <a
                        href={currentItem.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 underline text-[11px] mt-1 block truncate max-w-[200px]"
                      >
                        Abrir video en nueva pestaña
                      </a>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 backdrop-blur-xs text-sky-300 border border-white/20">
                    {parseVideoUrl(currentItem.videoUrl).platform.toUpperCase()}
                  </div>
                </div>
              ) : (
                /* Photo Container */
                <div
                  onClick={() => {
                    if (currentPhoto) setIsLightboxOpen(true);
                  }}
                  className={`aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center relative group shadow-2xs ${
                    currentPhoto ? 'cursor-zoom-in hover:ring-2 hover:ring-sky-500 transition' : ''
                  }`}
                  title={currentPhoto ? 'Haz clic para agrandar la foto con zoom HD' : ''}
                >
                  {currentPhoto ? (
                    <>
                      <img
                        src={currentPhoto}
                        alt={currentItem.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        referrerPolicy="no-referrer"
                      />

                      {/* Hover Zoom Badge */}
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white pointer-events-none">
                        <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-lg">
                          <ZoomIn className="w-4 h-4 text-sky-400" />
                          <span className="text-xs font-bold">Clic para agrandar</span>
                        </div>
                      </div>

                      {/* Left/Right Controls if multi photo */}
                      {productPhotos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePhotoIndex((prev) =>
                                prev > 0 ? prev - 1 : productPhotos.length - 1
                              );
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition border border-white/20 cursor-pointer shadow-md opacity-90 hover:opacity-100 z-10"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePhotoIndex((prev) =>
                                prev < productPhotos.length - 1 ? prev + 1 : 0
                              );
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center transition border border-white/20 cursor-pointer shadow-md opacity-90 hover:opacity-100 z-10"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          {/* Photo counter badge */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold text-white border border-white/10 shadow-sm z-10">
                            {activePhotoIndex + 1} / {productPhotos.length}
                          </div>
                        </>
                      )}
                    </>
                  ) : currentItem.videoUrl ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setMediaMode('video');
                      }}
                      className="flex flex-col items-center justify-center p-4 text-center cursor-pointer group/vid"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 mb-2 group-hover/vid:scale-110 transition-transform shadow-xs">
                        <Play className="w-6 h-6 text-sky-600 fill-sky-600 ml-0.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Producto con Video</span>
                      <span className="text-[10px] text-sky-600 font-semibold mt-0.5 underline">
                        Haz clic para reproducir video
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 text-xs">
                      <Package className="w-12 h-12 mb-2 stroke-1" />
                      <span>Sin foto adjunta</span>
                    </div>
                  )}
                </div>
              )}

              {/* Primary Direct Media Actions: Upload to DB, AI Web Images, AI Video, Delete photo */}
              <div className="pt-1">
                <div className="grid grid-cols-3 gap-1.5">
                  {/* 1. Subir fotos directamente a la Base de Datos */}
                  <button
                    type="button"
                    disabled={isUploadingPhotos}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1.5 px-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap min-w-0"
                    title="Subir fotos del producto desde tu dispositivo directamente a la base de datos PostgreSQL"
                  >
                    {isUploadingPhotos ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <span className="truncate">{isUploadingPhotos ? 'Subiendo...' : 'Subir Fotos'}</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    multiple
                    onChange={handleDirectUploadPhotos}
                    className="hidden"
                  />

                  {/* 2. Buscar fotos en la Web con IA Gemini */}
                  <button
                    type="button"
                    onClick={() => setShowWebImagePicker(true)}
                    className="w-full py-1.5 px-1.5 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-indigo-500 text-white text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-2xs whitespace-nowrap min-w-0"
                    title="Buscar fotos idénticas y oficiales en la web con IA"
                  >
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                    <span className="truncate">Fotos IA</span>
                  </button>

                  {/* 3. Buscar o Vincular Video Híbrido con IA */}
                  <button
                    type="button"
                    onClick={() => setShowVideoPicker(true)}
                    className="w-full py-1.5 px-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-2xs whitespace-nowrap min-w-0"
                    title="Buscar videos oficiales en YouTube/TikTok o subir MP4"
                  >
                    <Film className="w-3.5 h-3.5 flex-shrink-0 text-sky-400" />
                    <span className="truncate">{currentItem.videoUrl ? 'Video IA' : '+ Video IA'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Download, Copy Photo & Todas Actions */}
              {currentPhoto && (
                <div className="pt-0.5">
                  <div className={`grid ${productPhotos.length > 1 ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
                    {/* Botón Descargar foto activa */}
                    <button
                      type="button"
                      disabled={isDownloadingPhoto || isCopyingPhoto}
                      onClick={() => handleDownloadSinglePhoto(currentPhoto, activePhotoIndex + 1)}
                      className="w-full py-1.5 px-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-2xs disabled:opacity-60 whitespace-nowrap min-w-0"
                      title={
                        productPhotos.length > 1
                          ? `Descargar foto #${activePhotoIndex + 1} a tu dispositivo`
                          : 'Descargar foto a tu dispositivo'
                      }
                    >
                      {isDownloadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin flex-shrink-0" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                      )}
                      <span className="truncate">Descargar</span>
                    </button>

                    {/* Botón Copiar foto */}
                    <button
                      type="button"
                      disabled={isCopyingPhoto || isDownloadingPhoto}
                      onClick={() => handleCopyPhoto(currentPhoto)}
                      className="w-full py-1.5 px-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-2xs disabled:opacity-60 whitespace-nowrap min-w-0"
                      title="Copiar imagen al portapapeles para pegar con Ctrl+V"
                    >
                      {isCopyingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin flex-shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      )}
                      <span className="truncate">Copiar foto</span>
                    </button>

                    {/* Botón Descargar Todas las fotos */}
                    {productPhotos.length > 1 && (
                      <button
                        type="button"
                        disabled={isDownloadingPhoto || isCopyingPhoto}
                        onClick={() => handleDownloadAllPhotos(productPhotos)}
                        className="w-full py-1.5 px-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-2xs disabled:opacity-60 whitespace-nowrap min-w-0"
                        title={`Descargar todas las ${productPhotos.length} fotos`}
                      >
                        <Images className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                        <span className="truncate">Todas ({productPhotos.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Thumbnails Row if multiple photos */}
              {productPhotos.length > 1 && (
                <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-thin">
                  {productPhotos.map((photo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border transition cursor-pointer ${
                        activePhotoIndex === idx
                          ? 'border-sky-500 ring-2 ring-sky-400 scale-105'
                          : 'border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                      title={`Foto #${idx + 1} - Haz clic para ver`}
                    >
                      <img
                        src={photo}
                        alt={`Miniatura ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Unidades en stock:</span>
                  {currentItem.stock > 0 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>{currentItem.stock} u. en bodega</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                      <Package className="w-3.5 h-3.5" />
                      <span>0 u. (Bajo Pedido)</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-1.5">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Control de stock:</span>
                  </span>
                  <span className="font-semibold text-slate-700">Exclusivo vía Compras</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor de inventario:</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    ${totalValuation.toFixed(2)} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proveedor:</span>
                  <span className="font-medium text-slate-700 truncate max-w-[120px]" title={currentItem.supplierName || 'Telegram'}>
                    👤 {currentItem.supplierName || 'Telegram'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial and Detail Info */}
            <div className="md:col-span-2 space-y-4">
              {/* Financial Box */}
              {(() => {
                const discountPercent = Math.max(0, Math.min(100, Number(currentItem.discountPercent) || 0));
                const hasDiscount = discountPercent > 0;
                const effectiveSale = hasDiscount ? sale * (1 - discountPercent / 100) : sale;
                const effectiveProfitPerUnit = effectiveSale - cost;
                const effectiveMarginPercent = cost > 0 ? (effectiveProfitPerUnit / cost) * 100 : 0;
                const isLoss = effectiveProfitPerUnit < -0.001;
                const isBreakEven = Math.abs(effectiveProfitPerUnit) <= 0.001;

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-[11px] text-slate-500 block font-medium">Costo de Adquisición</span>
                        <span className="text-base font-bold text-amber-700 font-mono">
                          ${cost.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block font-medium">
                          {hasDiscount ? 'PVP vs Oferta' : 'Precio de Venta (PVP)'}
                        </span>
                        {hasDiscount ? (
                          <div>
                            <div className="flex items-baseline space-x-1.5">
                              <span className="text-base font-black text-rose-600 font-mono">
                                ${effectiveSale.toFixed(2)}
                              </span>
                              <span className="text-xs line-through text-slate-400 font-mono">
                                ${sale.toFixed(2)}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">
                              -{discountPercent}% OFF
                            </span>
                          </div>
                        ) : (
                          <span className="text-base font-bold text-emerald-700 font-mono">
                            ${sale.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block font-medium">
                          {hasDiscount ? 'Ganancia con Oferta' : 'Margen de Ganancia'}
                        </span>
                        {hasDiscount ? (
                          <div>
                            <div className="flex items-center space-x-1 mt-0.5">
                              {isLoss ? (
                                <span className="text-sm font-black text-rose-600 font-mono flex items-center space-x-0.5">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>-${Math.abs(effectiveProfitPerUnit).toFixed(2)}/u</span>
                                </span>
                              ) : isBreakEven ? (
                                <span className="text-sm font-bold text-amber-700 font-mono">
                                  $0.00/u (Equilibrio)
                                </span>
                              ) : (
                                <span className="text-sm font-black text-emerald-700 font-mono">
                                  +${effectiveProfitPerUnit.toFixed(2)}/u
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold font-mono ${
                              isLoss ? 'text-rose-600' : isBreakEven ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {isLoss ? `(${effectiveMarginPercent.toFixed(1)}% pérdida)` : `(+${effectiveMarginPercent.toFixed(1)}% margen)`}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-base font-bold text-sky-700 font-mono">
                                +{currentMarginPercent}%
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingMargin(!isEditingMargin);
                                  setCustomMargin(currentMarginPercent);
                                }}
                                className="text-[10px] text-sky-600 hover:text-sky-700 font-bold underline cursor-pointer"
                              >
                                {isEditingMargin ? 'Cerrar' : 'Ajustar'}
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              (+${profitPerUnit.toFixed(2)}/u)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prominent Profit / Loss Status Card for Products with Discounts */}
                    {hasDiscount && (
                      <div className={`p-3 rounded-2xl border flex items-start space-x-2.5 text-xs transition ${
                        isLoss
                          ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-2xs'
                          : isBreakEven
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                      }`}>
                        {isLoss ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5 animate-bounce" />
                        ) : isBreakEven ? (
                          <Scale className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[12px]">
                              {isLoss
                                ? '⚠️ ESTE PRODUCTO ESTÁ EN PÉRDIDA'
                                : isBreakEven
                                ? '⚖️ PRODUCTO EN PUNTO DE EQUILIBRIO'
                                : '✨ PRODUCTO RENTABLE TRAS DESCUENTO'}
                            </span>
                            <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                              isLoss
                                ? 'bg-rose-600 text-white'
                                : isBreakEven
                                ? 'bg-amber-600 text-white'
                                : 'bg-emerald-700 text-white'
                            }`}>
                              {isLoss
                                ? `-${Math.abs(effectiveProfitPerUnit).toFixed(2)} USD / u`
                                : isBreakEven
                                ? '$0.00 USD / u'
                                : `+${effectiveProfitPerUnit.toFixed(2)} USD / u`}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-700">
                            {isLoss ? (
                              <>
                                El precio de oferta de <strong>${effectiveSale.toFixed(2)}</strong> está por debajo del costo de <strong>${cost.toFixed(2)}</strong>. Por cada venta se generará una pérdida de <strong>${Math.abs(effectiveProfitPerUnit).toFixed(2)}</strong> ({effectiveMarginPercent.toFixed(1)}%).
                              </>
                            ) : isBreakEven ? (
                              <>
                                El precio de oferta de <strong>${effectiveSale.toFixed(2)}</strong> cubre exactamente el costo de adquisición (sin ganancia ni pérdida neta).
                              </>
                            ) : (
                              <>
                                El PVP normal es <strong>${sale.toFixed(2)}</strong>. Con el descuento del <strong>-{discountPercent}%</strong>, el precio final de venta es <strong>${effectiveSale.toFixed(2)}</strong>, generando una ganancia neta de <strong>+${effectiveProfitPerUnit.toFixed(2)}</strong> por unidad vendida (<strong>+{effectiveMarginPercent.toFixed(1)}%</strong> de margen real sobre costo).
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Interactive Quick Margin Adjuster */}
              {isEditingMargin && (
                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-sky-900 font-semibold">
                    <span className="flex items-center space-x-1">
                      <Percent className="w-3.5 h-3.5 text-sky-600" />
                      <span>Modificar Porcentaje de Margen de Ganancia:</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Recalcula el PVP sobre el costo activo (${cost.toFixed(2)})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={customMargin}
                      onChange={(e) => setCustomMargin(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="30"
                      className="w-20 bg-white border border-sky-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                    <div className="flex space-x-1">
                      {[20, 30, 40, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCustomMargin(p)}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border cursor-pointer ${
                            customMargin === p
                              ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={updatingCost || customMargin === ''}
                      onClick={() => handleSaveMargin(Number(customMargin))}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      {updatingCost ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Aplicar</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Multiple Cost Prices Selector */}
              {costOptions.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center space-x-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      <span>Precios de Costo Detectados en Mensaje de Telegram</span>
                    </span>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 font-bold">
                      Mayor seleccionado por defecto
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {costOptions.map((opt, idx) => {
                      const isSelected = Math.abs(cost - opt.price) < 0.01;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={updatingCost}
                          onClick={() => handleSelectCostOption(opt)}
                          className={`p-2.5 rounded-xl text-left text-xs transition flex items-center justify-between cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-100/80 border-amber-400 text-amber-900 ring-2 ring-amber-300 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50/30'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <p className="font-bold truncate text-slate-900">{opt.label}</p>
                            <p className="text-xs font-mono font-bold text-amber-700 mt-0.5">
                              ${opt.price.toFixed(2)} {currency}
                            </p>
                          </div>
                          {isSelected ? (
                            <span className="flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex-shrink-0">
                              <Check className="w-3 h-3" />
                              <span>Activo</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 hover:text-amber-700 font-semibold underline flex-shrink-0">
                              Elegir este
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Descripción Comercial</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200">
                      IA Gemini
                    </span>
                  </h4>
                  <button
                    type="button"
                    disabled={isGeneratingDesc}
                    onClick={handleRegenerateDescription}
                    className="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 text-[11px] font-bold transition flex items-center space-x-1 border border-sky-200 disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Regenerar descripción comercial estructurada y atractiva con IA tal como llega por Telegram"
                  >
                    {isGeneratingDesc ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>
                      {isGeneratingDesc
                        ? 'Generando...'
                        : currentItem.description
                        ? 'Regenerar con IA ✨'
                        : 'Generar con IA ✨'}
                    </span>
                  </button>
                </div>

                {descSavedToast && (
                  <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-1.5 animate-fadeIn font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>{descSavedToast}</span>
                  </div>
                )}

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                  {currentItem.description || 'Sin descripción detallada.'}
                </div>
              </div>

              {/* AI Extracted Attributes */}
              {Object.keys(parsedAttributes).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-sky-600" />
                    Atributos y Especificaciones Extraídas por Gemini
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(parsedAttributes)
                      .filter(([key]) => key !== 'images' && key !== 'totalPhotos' && key !== 'costOptions')
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center"
                        >
                          <span className="text-slate-500 capitalize text-[11px] font-medium">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="font-semibold text-slate-800 truncate ml-2">
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {tagsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Etiquetas de búsqueda
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Multiplatform Marketing / Marketplace Generator Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/50 to-purple-50 border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-sky-600 text-white shadow-xs shrink-0 mt-0.5 sm:mt-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Publicar en Marketplace, WhatsApp & Redes con IA</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">1 Clic</span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      Genera títulos, fichas de producto, hashtags y copys persuasivos listos para copiar con 1 solo clic.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMarketingModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 flex items-center space-x-1.5 transition cursor-pointer shrink-0 w-full sm:w-auto justify-center"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Abrir Generador IA ✨</span>
                </button>
              </div>
            </div>
          </div>

          {/* Original Telegram Message Section */}
          {currentItem.rawTelegramMessage && (
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-sky-800 font-bold">
                <span className="flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 text-sky-600" />
                  Mensaje Original Recibido en Telegram:
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {new Date(currentItem.createdAt).toLocaleString('es-ES')}
                </span>
              </div>
              <p className="text-slate-700 italic bg-white p-3 rounded-xl border border-slate-200">
                "{currentItem.rawTelegramMessage}"
              </p>
            </div>
          )}

          {/* SQL Record Info */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center font-mono">
              <Database className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              PostgreSQL ID: {currentItem.id} | User ID: {currentItem.userId}
            </span>
            <span>Creado: {new Date(currentItem.createdAt).toLocaleDateString('es-ES')}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => onDelete(currentItem.id)}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowBarcodeModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Imprimir etiqueta de código de barras para pegar en el producto"
            >
              <Barcode className="w-3.5 h-3.5 text-slate-700" />
              <span>Imprimir Código de Barras</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={() => onEdit(currentItem)}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar Producto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Label Printing Modal */}
      {showBarcodeModal && currentItem && (
        <ProductBarcodeModal
          isOpen={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
          items={[currentItem]}
          currency={currency}
        />
      )}

      {/* Multiplatform AI Marketing Copy Modal */}
      {showMarketingModal && (
        <ProductMarketingCopyModal
          item={currentItem}
          onClose={() => setShowMarketingModal(false)}
          onItemUpdated={(updated) => {
            setCurrentItem(updated);
            onItemUpdated?.(updated);
          }}
          currency={currency}
        />
      )}

      {/* AI Web Image Search & Picker Modal */}
      {showWebImagePicker && (
        <ProductWebImagePicker
          item={currentItem}
          isOpen={showWebImagePicker}
          onClose={() => setShowWebImagePicker(false)}
          onImagesAdded={(updated) => {
            setCurrentItem(updated);
            onItemUpdated?.(updated);
          }}
        />
      )}

      {/* Full Resolution Photo Lightbox Modal */}
      {isLightboxOpen && productPhotos.length > 0 && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          images={productPhotos}
          currentIndex={activePhotoIndex}
          onClose={() => setIsLightboxOpen(false)}
          onNavigate={(newIdx) => setActivePhotoIndex(newIdx)}
          onSetAsCover={async (coverUrl) => {
            try {
              const res = await authFetch(`/api/inventory/${currentItem.id}/set-cover-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: coverUrl }),
              });
              if (res.ok) {
                const updated = await res.json();
                setCurrentItem(updated);
                onItemUpdated?.(updated);
              }
            } catch (err) {
              console.error('Failed to set cover photo:', err);
            }
          }}
          productName={currentItem.name}
          productSku={currentItem.sku}
          isCover={productPhotos[activePhotoIndex] === currentItem.imageUrl}
        />
      )}

      {/* AI & Hybrid Video Picker Modal */}
      {showVideoPicker && (
        <ProductAiVideoPickerModal
          item={currentItem}
          isOpen={showVideoPicker}
          onClose={() => setShowVideoPicker(false)}
          onVideoApplied={(updated) => {
            setCurrentItem(updated);
            onItemUpdated?.(updated);
            if (updated.videoUrl) {
              setMediaMode('video');
            }
          }}
        />
      )}
    </div>
  );
};
