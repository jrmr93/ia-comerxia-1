import React, { useState, useEffect, useRef } from 'react';
import { CostOption, InventoryItem } from '../types.ts';
import {
  AlertTriangle,
  BadgePercent,
  Camera,
  Check,
  DollarSign,
  ExternalLink,
  Film,
  Flame,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Layers,
  Link as LinkIcon,
  Loader2,
  Lock,
  Package,
  PackageCheck,
  Percent,
  Play,
  Plus,
  Save,
  Scale,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UploadCloud,
  Video,
  X,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { ImageLightboxModal } from './ImageLightboxModal.tsx';
import { ProductAiVideoPickerModal } from './ProductAiVideoPickerModal.tsx';
import { parseVideoUrl } from '../utils/video-helper.ts';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingItem: InventoryItem | null;
}

const CATEGORIES = [
  'Calzado',
  'Ropa y Moda',
  'Electrónica y Celulares',
  'Computación y Accesorios',
  'Hogar y Cocina',
  'Belleza y Cuidado Personal',
  'Deportes y Fitness',
  'Juguetes y Niños',
  'Ferretería y Herramientas',
  'General',
];

const MARGIN_PRESETS = [20, 30, 40, 50, 75, 100];
const DISCOUNT_PRESETS = [0, 5, 10, 15, 20, 25, 30, 40, 50];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingItem,
}) => {
  const { authFetch } = useAuth();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('General');
  const [costPrice, setCostPrice] = useState('0.00');
  const [salePrice, setSalePrice] = useState('0.00');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [marginPercent, setMarginPercent] = useState<number>(30);
  const [costOptions, setCostOptions] = useState<CostOption[]>([]);
  const [stock, setStock] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoPickerOpen, setIsVideoPickerOpen] = useState(false);
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [supplierName, setSupplierName] = useState('Proveedor Telegram');
  const [description, setDescription] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [descSuccessMsg, setDescSuccessMsg] = useState<string | null>(null);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'available' | 'low_stock' | 'sold_out' | 'archived'>('available');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct image upload states & ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Helper to read and compress image file to high-quality Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP, GIF).');
      return;
    }
    setIsProcessingPhoto(true);
    setError(null);
    try {
      const b64 = await readFileAsBase64(file);
      setImageUrl(b64);
    } catch (err) {
      console.error('Error processing photo:', err);
      setError('Error al procesar la foto seleccionada.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || '');
      setSku(editingItem.sku || '');
      setCategory(editingItem.category || 'General');
      
      const costNum = parseFloat(editingItem.costPrice) || 0;
      const saleNum = parseFloat(editingItem.salePrice) || 0;
      setCostPrice(editingItem.costPrice || '0.00');
      setSalePrice(editingItem.salePrice || '0.00');

      let parsedAttr: Record<string, any> = {};
      if (editingItem.extractedAttributes) {
        try {
          parsedAttr =
            typeof editingItem.extractedAttributes === 'string'
              ? JSON.parse(editingItem.extractedAttributes)
              : editingItem.extractedAttributes;
        } catch {}
      }

      // Extract cost options
      if (Array.isArray(parsedAttr.costOptions) && parsedAttr.costOptions.length > 0) {
        setCostOptions(parsedAttr.costOptions);
      } else if (costNum > 0) {
        setCostOptions([{ label: `Costo Principal ($${costNum.toFixed(2)})`, price: costNum }]);
      } else {
        setCostOptions([]);
      }

      // Calculate initial margin
      if (parsedAttr.profitMarginPercent !== undefined) {
        setMarginPercent(Number(parsedAttr.profitMarginPercent));
      } else if (costNum > 0 && saleNum > costNum) {
        setMarginPercent(Math.round(((saleNum - costNum) / costNum) * 100));
      } else {
        setMarginPercent(30);
      }

      setDiscountPercent(editingItem.discountPercent || 0);
      setStock(editingItem.stock ?? 0);
      setImageUrl(editingItem.imageUrl || '');
      setVideoUrl(editingItem.videoUrl || '');
      setSupplierName(editingItem.supplierName || 'Proveedor Telegram');
      setDescription(editingItem.description || '');
      setTags(editingItem.tags || '');
      setStatus(editingItem.status || 'available');
    } else {
      setName('');
      setSku('');
      setCategory('General');
      setCostPrice('10.00');
      setMarginPercent(30);
      setSalePrice('13.00');
      setDiscountPercent(0);
      setCostOptions([
        { label: 'Costo Mayorista ($10.00)', price: 10.0 },
      ]);
      setStock(0);
      setImageUrl('');
      setVideoUrl('');
      setSupplierName('Proveedor Telegram');
      setDescription('');
      setTags('');
      setStatus('available');
    }
    setError(null);
  }, [editingItem, isOpen]);

  // Recalculate sale price when margin changes
  const handleMarginChange = (newMargin: number) => {
    setMarginPercent(newMargin);
    const cost = parseFloat(costPrice) || 0;
    if (cost > 0) {
      const calcSale = (cost * (1 + newMargin / 100)).toFixed(2);
      setSalePrice(calcSale);
    }
  };

  // Recalculate sale price when cost price changes manually
  const handleCostPriceChange = (newCostStr: string) => {
    setCostPrice(newCostStr);
    const cost = parseFloat(newCostStr) || 0;
    if (cost > 0 && marginPercent > 0) {
      const calcSale = (cost * (1 + marginPercent / 100)).toFixed(2);
      setSalePrice(calcSale);
    }
  };

  // Handle selecting a specific cost option
  const handleSelectCostOption = (opt: CostOption) => {
    const costStr = opt.price.toFixed(2);
    setCostPrice(costStr);
    if (marginPercent > 0) {
      const calcSale = (opt.price * (1 + marginPercent / 100)).toFixed(2);
      setSalePrice(calcSale);
    }
  };

  // Generate or regenerate commercial description with Gemini AI mirroring Telegram processing
  const handleGenerateAiDescription = async () => {
    if (!name.trim()) {
      setError('Por favor ingresa primero el nombre del producto para generar la descripción.');
      return;
    }
    setError(null);
    setIsGeneratingDescription(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        description,
        tags,
        rawTelegramMessage: editingItem?.rawTelegramMessage,
        attributes: editingItem?.extractedAttributes,
        imageUrl: imageUrl || editingItem?.imageUrl,
        images: editingItem?.images,
        costPrice,
        salePrice,
      };

      const res = await authFetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar la descripción');
      }

      if (data.description) {
        setDescription(data.description);
        setDescSuccessMsg('¡Descripción comercial generada con IA exitosamente!');
        setTimeout(() => setDescSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error('Error generating description:', err);
      setError(err.message || 'Error al generar la descripción comercial con IA');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del producto es obligatorio');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let existingAttr: Record<string, any> = {};
      if (editingItem?.extractedAttributes) {
        try {
          existingAttr =
            typeof editingItem.extractedAttributes === 'string'
              ? JSON.parse(editingItem.extractedAttributes)
              : editingItem.extractedAttributes;
        } catch {}
      }

      const mergedAttributes = {
        ...existingAttr,
        costOptions,
        profitMarginPercent: marginPercent,
        selectedCostPrice: parseFloat(costPrice) || 0,
      };

      const url = editingItem ? `/api/inventory/${editingItem.id}` : '/api/inventory';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          category,
          costPrice: String(parseFloat(costPrice) || 0),
          salePrice: String(parseFloat(salePrice) || 0),
          discountPercent: Math.max(0, Math.min(100, Number(discountPercent) || 0)),
          stock: Number(stock),
          imageUrl: imageUrl.trim() || null,
          videoUrl: videoUrl.trim() || null,
          supplierName: supplierName.trim(),
          description: description.trim(),
          tags: tags.trim(),
          extractedAttributes: JSON.stringify(mergedAttributes),
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el producto');
      }

      onSaved();
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const costNum = parseFloat(costPrice) || 0;
  const saleNum = parseFloat(salePrice) || 0;
  const unitProfit = saleNum - costNum;
  const discountNum = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const effectiveSalePrice = discountNum > 0 ? saleNum * (1 - discountNum / 100) : saleNum;
  const effectiveUnitProfit = effectiveSalePrice - costNum;
  const effectiveMarginPercent = costNum > 0 ? (effectiveUnitProfit / costNum) * 100 : 0;
  const isLoss = effectiveUnitProfit < -0.001;
  const isBreakEven = Math.abs(effectiveUnitProfit) <= 0.001;

  // Extract all available photos for the item
  const allAvailablePhotos: string[] = [];
  if (imageUrl && !allAvailablePhotos.includes(imageUrl)) {
    allAvailablePhotos.push(imageUrl);
  }
  if (editingItem?.images && Array.isArray(editingItem.images)) {
    editingItem.images.forEach((img) => {
      if (img && !allAvailablePhotos.includes(img)) allAvailablePhotos.push(img);
    });
  }
  if (editingItem?.extractedAttributes) {
    try {
      const parsed =
        typeof editingItem.extractedAttributes === 'string'
          ? JSON.parse(editingItem.extractedAttributes)
          : editingItem.extractedAttributes;
      if (Array.isArray(parsed.images)) {
        parsed.images.forEach((img: string) => {
          if (img && !allAvailablePhotos.includes(img)) allAvailablePhotos.push(img);
        });
      }
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Editar Producto en SQL' : 'Nuevo Producto en Inventario'}
              </h2>
              <p className="text-xs text-slate-500">
                {editingItem
                  ? 'Modifica precios, opciones de costo y margen de ganancia en PostgreSQL'
                  : 'Crea un registro con opciones de costo y margen personalizado'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Producto *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Zapatillas Nike Air Max"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código SKU (Alfanumérico)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generado ej. JUA00001 (según proveedor)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 placeholder:text-slate-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Multiple Cost Options Selector (if available) */}
            {costOptions.length > 1 && (
              <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Opciones de Precio de Costo Detectadas (Elige una para aplicar)</span>
                  </span>
                  <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 font-bold">
                    Mayor por defecto
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {costOptions.map((opt, idx) => {
                    const isSelected = Math.abs(costNum - opt.price) < 0.01;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectCostOption(opt)}
                        className={`p-2 rounded-xl text-left text-xs transition flex items-center justify-between cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-100/80 border-amber-400 text-amber-900 ring-2 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <p className="font-semibold truncate">{opt.label}</p>
                          <p className="text-[11px] text-slate-500 font-mono font-bold">${opt.price.toFixed(2)}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-700 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cost, Margin, and Sale Price Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Costo Proveedor Seleccionado ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => handleCostPriceChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500 font-mono transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                  <Percent className="w-3.5 h-3.5 text-sky-600" />
                  <span>Margen de Ganancia (%)</span>
                </label>
                <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                  {marginPercent}%
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={marginPercent}
                  onChange={(e) => handleMarginChange(Number(e.target.value))}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 font-mono transition"
                />
                <div className="flex-1 flex space-x-1 overflow-x-auto py-0.5">
                  {MARGIN_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleMarginChange(p)}
                      className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        marginPercent === p
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio de Venta Sugerido ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500 font-mono font-bold transition"
              />
            </div>

            {/* Stock Display & Protection (Exclusively entered via Purchases) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Stock en Bodega
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Control por Compras</span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    {stock > 0 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>{stock} unidades en bodega</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                        <Package className="w-3.5 h-3.5" />
                        <span>0 unidades (Bajo Pedido)</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-tight">
                  ℹ️ El stock no se puede editar manualmente. Se ingresa registrando y recibiendo órdenes en el módulo de <strong className="text-slate-700 font-semibold">Compras</strong>.
                </p>
              </div>
            </div>

            {/* Descuento por Porcentaje en Oferta (Tienda Online) */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-rose-50/80 via-rose-50/40 to-amber-50/60 border border-rose-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-rose-950 flex items-center space-x-1.5">
                  <BadgePercent className="w-4 h-4 text-rose-600" />
                  <span>Descuento Promocional en Tienda (%)</span>
                </label>
                {discountNum > 0 ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-2xs">
                    <Flame className="w-3 h-3 fill-current animate-pulse text-amber-300" />
                    <span>OFERTA -{discountNum}%</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    Sin oferta (0%)
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPercent}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setDiscountPercent(val);
                    }}
                    placeholder="0"
                    className="w-24 bg-white border border-rose-300 rounded-xl px-3 py-2 text-sm text-rose-950 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono transition shadow-2xs"
                  />
                  <span className="text-sm font-bold text-rose-800 font-mono">%</span>
                </div>

                <div className="flex-1 flex space-x-1 overflow-x-auto py-0.5 scrollbar-thin">
                  {DISCOUNT_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiscountPercent(d)}
                      className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition cursor-pointer flex-shrink-0 ${
                        discountNum === d
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:border-rose-300'
                      }`}
                    >
                      {d === 0 ? '0% (Normal)' : `-${d}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Price Preview & Profit / Loss Status */}
              {discountNum > 0 ? (
                <div className="space-y-2">
                  <div className="p-3 bg-white rounded-xl border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 font-medium">PVP Normal:</span>
                      <span className="line-through text-slate-400 font-mono font-medium">${saleNum.toFixed(2)}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-rose-950 font-bold">Precio Oferta:</span>
                      <span className="font-black text-rose-600 text-sm font-mono">${effectiveSalePrice.toFixed(2)}</span>
                    </div>

                    {isLoss ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-black text-rose-700 font-mono bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-300 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>PÉRDIDA: -${Math.abs(effectiveUnitProfit).toFixed(2)}/u</span>
                      </span>
                    ) : isBreakEven ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 font-mono bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                        <Scale className="w-3.5 h-3.5 text-amber-700" />
                        <span>EQUILIBRIO: $0.00/u</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 font-mono bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ganancia tras oferta: +${effectiveUnitProfit.toFixed(2)}/u</span>
                      </span>
                    )}
                  </div>

                  {/* Detailed Profit/Loss Banner */}
                  {isLoss ? (
                    <div className="p-3 rounded-xl bg-rose-500 text-white shadow-sm flex items-start space-x-2.5 text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300 animate-bounce" />
                      <div className="space-y-0.5">
                        <p className="font-black text-white text-[13px]">
                          ⚠️ ¡ALERTA: ESTE PRODUCTO ESTÁ EN PÉRDIDA!
                        </p>
                        <p className="text-rose-100 leading-snug">
                          El precio con descuento (<strong>${effectiveSalePrice.toFixed(2)}</strong>) es menor que el costo de adquisición (<strong>${costNum.toFixed(2)}</strong>).
                        </p>
                        <p className="font-bold text-white font-mono text-[11px] pt-1">
                          Perderás -${Math.abs(effectiveUnitProfit).toFixed(2)} por unidad vendida ({effectiveMarginPercent.toFixed(1)}% de pérdida).
                        </p>
                      </div>
                    </div>
                  ) : isBreakEven ? (
                    <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center space-x-2 text-xs">
                      <Scale className="w-4 h-4 flex-shrink-0 text-amber-700" />
                      <p>
                        <strong>Punto de equilibrio:</strong> Venderás al costo exacto ($0.00 de ganancia). No generas utilidad ni pérdida.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Margen real de ganancia con oferta:</span>
                      </div>
                      <span className="font-bold font-mono text-emerald-800">
                        +{effectiveMarginPercent.toFixed(1)}% sobre costo (+${effectiveUnitProfit.toFixed(2)} / u)
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-medium">
                  💡 Los productos con descuento ({'>'} 0%) se mostrarán <strong>primero en la tienda online</strong> con una etiqueta llamativa de <strong>OFERTA</strong>.
                </p>
              )}
            </div>

            {/* Financial Summary Preview */}
            <div className={`sm:col-span-2 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs transition ${
              isLoss
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : isBreakEven
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center space-x-2 font-medium">
                {isLoss ? (
                  <TrendingDown className="w-4 h-4 text-rose-600 flex-shrink-0" />
                ) : isBreakEven ? (
                  <Scale className="w-4 h-4 text-amber-600 flex-shrink-0" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                )}
                <span>
                  {discountNum > 0
                    ? isLoss
                      ? 'Balance financiero (Oferta activa):'
                      : 'Ganancia neta tras descuento en tienda:'
                    : 'Ganancia calculada por unidad vendida:'}
                </span>
              </div>
              <div className="font-mono font-bold text-right">
                {isLoss ? (
                  <span className="text-rose-600 text-sm font-black">
                    🔴 PÉRDIDA: -${Math.abs(effectiveUnitProfit).toFixed(2)}/u ({effectiveMarginPercent.toFixed(1)}%)
                  </span>
                ) : isBreakEven ? (
                  <span className="text-amber-700 font-bold">
                    ⚖️ $0.00/u (Punto de Equilibrio)
                  </span>
                ) : (
                  <span className="text-emerald-700 text-sm font-black">
                    +${effectiveUnitProfit.toFixed(2)}/u {discountNum > 0 ? `(Oferta -${discountNum}%)` : `(Margen: ${marginPercent}%)`}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado de Disponibilidad
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 transition"
              >
                <option value="available">Disponible</option>
                <option value="low_stock">Stock Bajo</option>
                <option value="sold_out">Agotado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proveedor
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nombre del proveedor"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 transition"
              />
            </div>

            {/* Photo / Image Upload Section */}
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                  <span>Foto del Producto</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[11px] text-sky-700 hover:text-sky-800 font-medium hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>{showUrlInput ? 'Ocultar URL' : 'O ingresar URL'}</span>
                  </button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />

              {imageUrl ? (
                /* Photo preview state with quick actions and click-to-enlarge */
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        onClick={() => {
                          const idx = allAvailablePhotos.indexOf(imageUrl);
                          setLightboxIndex(idx >= 0 ? idx : 0);
                          setIsLightboxOpen(true);
                        }}
                        className="w-16 h-16 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 flex-shrink-0 relative group cursor-zoom-in shadow-2xs hover:ring-2 hover:ring-sky-500 transition"
                        title="Haz clic para agrandar y ver foto en tamaño completo"
                      >
                        <img
                          src={imageUrl}
                          alt="Vista previa"
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                          <ZoomIn className="w-5 h-5 text-white" />
                          <span className="text-[9px] font-bold mt-0.5">Agrandar</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            Foto cargada
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const idx = allAvailablePhotos.indexOf(imageUrl);
                              setLightboxIndex(idx >= 0 ? idx : 0);
                              setIsLightboxOpen(true);
                            }}
                            className="text-[11px] font-bold text-sky-700 hover:text-sky-900 hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <ZoomIn className="w-3 h-3" />
                            <span>Ver grande</span>
                          </button>
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-1">
                          {imageUrl.startsWith('data:') ? 'Imagen desde tu dispositivo' : imageUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isProcessingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-sky-600" />
                        <span>Cambiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition cursor-pointer"
                        title="Quitar foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Gallery of extra photos if available */}
                  {allAvailablePhotos.length > 1 && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                          <ImageIcon className="w-3 h-3 text-sky-600" />
                          <span>Fotos adicionales de este producto ({allAvailablePhotos.length}):</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Clic en cualquier foto para agrandar</span>
                      </div>
                      <div className="flex items-center space-x-2 overflow-x-auto py-1 scrollbar-thin">
                        {allAvailablePhotos.map((photo, pIdx) => {
                          const isCurrent = photo === imageUrl;
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                setLightboxIndex(pIdx);
                                setIsLightboxOpen(true);
                              }}
                              className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 transition border-2 cursor-zoom-in relative group ${
                                isCurrent
                                  ? 'border-sky-500 ring-2 ring-sky-300 shadow-2xs scale-105'
                                  : 'border-slate-200 hover:border-sky-300 opacity-75 hover:opacity-100'
                              }`}
                              title="Clic para previsualizar en tamaño grande"
                            >
                              <img
                                src={photo}
                                alt={`Foto ${pIdx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-110 transition duration-150"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Dropzone / Upload button area */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50/70 text-sky-800 scale-[0.99]'
                      : 'border-slate-300 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/30 text-slate-600'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-sky-600 shadow-2xs">
                    {isProcessingPhoto ? (
                      <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                    ) : (
                      <UploadCloud className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {isProcessingPhoto
                        ? 'Procesando imagen...'
                        : 'Haz clic aquí o arrastra una foto para subir'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Soporta fotos desde tu PC, celular o cámara (JPG, PNG, WEBP)
                    </p>
                  </div>
                  <div className="pt-1">
                    <span className="inline-flex items-center px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition">
                      <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                      Seleccionar Archivo de Foto
                    </span>
                  </div>
                </div>
              )}

              {/* Optional direct URL input if toggled or if needed */}
              {showUrlInput && (
                <div className="pt-1 animate-fadeIn">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/foto-producto.jpg"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 transition"
                    />
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-2.5 py-2 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Video del Producto Section (Híbrido: Enlace YouTube/TikTok/Reels, Subir MP4 o Buscar con IA) */}
            <div className="sm:col-span-2 space-y-2 pt-1 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Film className="w-3.5 h-3.5 text-sky-600" />
                  <span>Video del Producto (Demostración, Unboxing o Review)</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Híbrido + IA
                  </span>
                </label>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowVideoUrlInput(!showVideoUrlInput)}
                    className="text-[11px] text-sky-700 hover:text-sky-800 font-medium hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>{showVideoUrlInput ? 'Ocultar Enlace' : 'Pegar Enlace'}</span>
                  </button>
                </div>
              </div>

              {videoUrl ? (
                /* Active Video Card with preview and actions */
                <div className="p-3.5 bg-slate-900 border border-slate-800 text-white rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 flex-shrink-0">
                        <Play className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-400/20 text-sky-300 border border-sky-400/30">
                            {parseVideoUrl(videoUrl).platform.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-slate-200">Video Activo</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-sm font-mono mt-0.5">
                          {videoUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {editingItem && (
                        <button
                          type="button"
                          onClick={() => setIsVideoPickerOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Buscar / Cambiar con IA</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setVideoUrl('')}
                        className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition cursor-pointer"
                        title="Quitar video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Embed Video Preview */}
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/60 border border-slate-800 flex items-center justify-center">
                    {parseVideoUrl(videoUrl).isDirect ? (
                      <video
                        src={parseVideoUrl(videoUrl).embedUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : parseVideoUrl(videoUrl).embedUrl ? (
                      <iframe
                        src={parseVideoUrl(videoUrl).embedUrl}
                        title="Product Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    ) : (
                      <div className="text-xs text-slate-400 p-4 text-center">
                        Vista previa no disponible para este formato, pero el video se mostrará a los clientes.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* No video assigned yet: show AI search button, paste link, or upload */
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 flex-shrink-0">
                      <Film className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Añade un video de YouTube, TikTok, Shorts o sube un MP4
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Los productos con video tienen hasta 4x más conversiones en la tienda.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {editingItem ? (
                      <button
                        type="button"
                        onClick={() => setIsVideoPickerOpen(true)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Buscar Video con IA</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowVideoUrlInput(true)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Pegar Enlace Directo</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Direct manual URL input if toggled */}
              {showVideoUrlInput && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fadeIn">
                  <label className="block text-[11px] font-bold text-slate-700">
                    URL de YouTube, YouTube Shorts, TikTok, Reels, Vimeo o MP4:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... o https://www.tiktok.com/@..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 transition"
                    />
                    {videoUrl && (
                      <button
                        type="button"
                        onClick={() => setVideoUrl('')}
                        className="px-2.5 py-2 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Etiquetas / Tags (separados por coma)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="zapatillas, running, deporte, negro"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <span>Descripción Comercial</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200">
                    IA Gemini
                  </span>
                </label>
                <button
                  type="button"
                  disabled={isGeneratingDescription || !name.trim()}
                  onClick={handleGenerateAiDescription}
                  className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 text-[11px] font-bold transition flex items-center space-x-1.5 border border-sky-200 disabled:opacity-50 cursor-pointer shadow-2xs"
                  title={name.trim() ? "Generar o regenerar descripción comercial atractiva con IA tal como llega por Telegram" : "Ingresa el nombre del producto primero"}
                >
                  {isGeneratingDescription ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>
                    {isGeneratingDescription
                      ? 'Generando con IA...'
                      : description
                      ? 'Regenerar con IA ✨'
                      : 'Generar con IA ✨'}
                  </span>
                </button>
              </div>

              {descSuccessMsg && (
                <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-1.5 animate-fadeIn font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{descSuccessMsg}</span>
                </div>
              )}

              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción comercial y detallada del producto (haz clic en 'Generar con IA' para redactarla automáticamente)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 resize-y transition"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition flex items-center space-x-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editingItem ? 'Guardar Cambios' : 'Crear Producto'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Full Resolution Photo Lightbox Modal */}
      {isLightboxOpen && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          images={allAvailablePhotos}
          currentIndex={lightboxIndex}
          onClose={() => setIsLightboxOpen(false)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          onSelect={(selectedUrl) => {
            setImageUrl(selectedUrl);
            setIsLightboxOpen(false);
          }}
          selectLabel="Usar como Foto del Producto"
          productName={name || editingItem?.name || 'Producto'}
          productSku={sku || editingItem?.sku || ''}
          isCover={allAvailablePhotos[lightboxIndex] === imageUrl}
        />
      )}

      {/* AI & Hybrid Video Picker Modal */}
      {isVideoPickerOpen && editingItem && (
        <ProductAiVideoPickerModal
          item={{ ...editingItem, videoUrl }}
          isOpen={isVideoPickerOpen}
          onClose={() => setIsVideoPickerOpen(false)}
          onVideoApplied={(updated) => {
            if (updated.videoUrl) {
              setVideoUrl(updated.videoUrl);
            }
          }}
        />
      )}
    </div>
  );
};
