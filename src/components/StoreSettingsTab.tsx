import React, { useState, useEffect } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  DollarSign,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Landmark,
  Layers,
  MapPin,
  MessageCircle,
  Package,
  Palette,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  UploadCloud,
  X,
  Zap,
  Sparkles,
  Gift,
  Tag,
  Flame,
  Eye,
  Wand2,
  ExternalLink,
} from 'lucide-react';
import { StoreConfig, StoreTheme, CourierPartner, PaymentMethodPartner, StorePromoPopupConfig } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DEFAULT_THEME_COLORS,
  COLOR_ROLE_NAMES,
  THEME_PRESETS,
  parseThemePalettes,
} from './OnlineStoreView.tsx';
import { StorePromoModal } from './store/StorePromoModal.tsx';

interface StoreSettingsTabProps {
  initialConfig?: StoreConfig | null;
  onSaved?: () => void;
}

const DEFAULT_COURIERS: CourierPartner[] = [
  {
    id: 'servientrega',
    name: 'Servientrega',
    logoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=160&auto=format&fit=crop&q=80',
    quoteUrl: 'https://www.servientrega.com.ec/',
    active: true,
  },
  {
    id: 'laarcourier',
    name: 'LaarCourier',
    logoUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=160&auto=format&fit=crop&q=80',
    quoteUrl: 'https://laarcourier.com/',
    active: true,
  },
  {
    id: 'urbano',
    name: 'Urbano Express',
    logoUrl: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=160&auto=format&fit=crop&q=80',
    quoteUrl: 'https://www.urbano.com.ec/',
    active: true,
  },
  {
    id: 'tramaco',
    name: 'Tramaco Express',
    logoUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=160&auto=format&fit=crop&q=80',
    quoteUrl: 'https://www.tramaco.com.ec/',
    active: true,
  },
  {
    id: 'motorizado',
    name: 'Delivery Motorizado / Express',
    logoUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
];

const DEFAULT_PAYMENTS: PaymentMethodPartner[] = [
  {
    id: 'banco-pichincha',
    name: 'Banco Pichincha / Mi Vecino',
    details: 'Transferencia directa o depósito a Cta. de Ahorros',
    logoUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'banco-guayaquil',
    name: 'Banco Guayaquil / Banco del Barrio',
    details: 'Transferencia nacional o depósito',
    logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'deuna',
    name: 'Deuna / Pago Móvil QR',
    details: 'Cobro rápido e inmediato escaneando QR o con celular',
    logoUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'zelle',
    name: 'Zelle (USD)',
    details: 'Pagos directos en dólares',
    logoUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'tarjeta',
    name: 'Tarjetas Visa & Mastercard',
    details: 'Débito o crédito con link de pago seguro',
    logoUrl: 'https://images.unsplash.com/photo-1556742049-0a67c557689c?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
  {
    id: 'efectivo',
    name: 'Efectivo / Contraentrega',
    details: 'Paga al momento de recibir tu paquete en tu domicilio',
    logoUrl: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=160&auto=format&fit=crop&q=80',
    active: true,
  },
];

const processLogoImageFile = (file: File, maxDim = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png', 0.9));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Error al decodificar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
};

export const StoreSettingsTab: React.FC<StoreSettingsTabProps> = ({
  initialConfig,
  onSaved,
}) => {
  const { authFetch } = useAuth();

  const [storeName, setStoreName] = useState('Comerxia Store');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [description, setDescription] = useState('Catálogo digital con envíos y pedidos directos');
  const [bannerText, setBannerText] = useState('🔥 ¡Catálogo actualizado con las últimas novedades en stock!');
  const [deliveryFee, setDeliveryFee] = useState('0.00');
  const [minOrderAmount, setMinOrderAmount] = useState('0.00');
  const [currency, setCurrency] = useState('USD');
  const [showStock, setShowStock] = useState(true);
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [theme, setTheme] = useState<StoreTheme>('classic');
  const [themePalettes, setThemePalettes] = useState<Record<string, string[]>>({
    classic: [...DEFAULT_THEME_COLORS.classic],
    boutique: [...DEFAULT_THEME_COLORS.boutique],
    fresh: [...DEFAULT_THEME_COLORS.fresh],
    brutalist: [...DEFAULT_THEME_COLORS.brutalist],
    cyber: [...DEFAULT_THEME_COLORS.cyber],
    minimal: [...DEFAULT_THEME_COLORS.minimal],
  });

  const [couriers, setCouriers] = useState<CourierPartner[]>(DEFAULT_COURIERS);
  const [payments, setPayments] = useState<PaymentMethodPartner[]>(DEFAULT_PAYMENTS);

  // Promotional Popup / Billboard AI Configuration
  const [promoActive, setPromoActive] = useState(true);
  const [promoTheme, setPromoTheme] = useState<'christmas' | 'black_friday' | 'super_deals' | 'new_year' | 'clearance' | 'custom' | string>('christmas');
  const [promoBadge, setPromoBadge] = useState('🎄 OFERTA NAVIDEÑA');
  const [promoTitle, setPromoTitle] = useState('¡Gran Venta Especial de Navidad!');
  const [promoDescription, setPromoDescription] = useState('Aprovecha hasta un 30% de descuento en regalos seleccionados, stock limitado y envíos rápidos a todo el país.');
  const [promoImageUrl, setPromoImageUrl] = useState<string | null>('https://images.unsplash.com/photo-1543258103-a62bd96b300b?auto=format&fit=crop&w=900&q=85');
  const [promoCouponCode, setPromoCouponCode] = useState('NAVIDAD2026');
  const [promoButtonText, setPromoButtonText] = useState('¡Pedir con Descuento por WhatsApp!');
  const [promoActionType, setPromoActionType] = useState<'whatsapp' | 'catalog' | 'url'>('whatsapp');
  const [promoActionUrl, setPromoActionUrl] = useState('');

  // AI Generation controls
  const [isGeneratingPromoAi, setIsGeneratingPromoAi] = useState(false);
  const [promoDiscountInput, setPromoDiscountInput] = useState('30% OFF');
  const [promoCustomPromptInput, setPromoCustomPromptInput] = useState('');
  const [showPromoTestModal, setShowPromoTestModal] = useState(false);

  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierQuoteUrl, setNewCourierQuoteUrl] = useState('');
  const [newCourierLogo, setNewCourierLogo] = useState<string | null>(null);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentDetails, setNewPaymentDetails] = useState('');
  const [newPaymentLogo, setNewPaymentLogo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchStoreConfig();
  }, []);

  const fetchStoreConfig = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/store/config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.storeName) setStoreName(data.storeName);
          if (data.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
          if (data.description) setDescription(data.description);
          if (data.bannerText) setBannerText(data.bannerText);
          if (data.deliveryFee !== undefined) setDeliveryFee(String(data.deliveryFee));
          if (data.minOrderAmount !== undefined) setMinOrderAmount(String(data.minOrderAmount));
          if (data.currency) setCurrency(data.currency);
          if (data.showStock !== undefined) setShowStock(Boolean(data.showStock));
          if (data.showOutOfStock !== undefined) setShowOutOfStock(Boolean(data.showOutOfStock));
          if (data.instagramUrl) setInstagramUrl(data.instagramUrl);
          if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
          if (data.address) setAddress(data.address);
          if (data.logoUrl) setLogoUrl(data.logoUrl);
          if (data.theme) setTheme(data.theme);
          if (data.themeColors) setThemePalettes(parseThemePalettes(data.themeColors));

          if (data.promoPopup) {
            try {
              const parsedPromo = typeof data.promoPopup === 'string' ? JSON.parse(data.promoPopup) : data.promoPopup;
              if (parsedPromo && typeof parsedPromo === 'object') {
                if (parsedPromo.active !== undefined) setPromoActive(Boolean(parsedPromo.active));
                if (parsedPromo.theme) setPromoTheme(parsedPromo.theme);
                if (parsedPromo.badge) setPromoBadge(parsedPromo.badge);
                if (parsedPromo.title) setPromoTitle(parsedPromo.title);
                if (parsedPromo.description) setPromoDescription(parsedPromo.description);
                if (parsedPromo.imageUrl !== undefined) setPromoImageUrl(parsedPromo.imageUrl);
                if (parsedPromo.couponCode !== undefined) setPromoCouponCode(parsedPromo.couponCode);
                if (parsedPromo.buttonText) setPromoButtonText(parsedPromo.buttonText);
                if (parsedPromo.actionType) setPromoActionType(parsedPromo.actionType);
                if (parsedPromo.actionUrl !== undefined) setPromoActionUrl(parsedPromo.actionUrl);
              }
            } catch {}
          }

          if (data.courierLogos) {
            try {
              const parsedCouriers = typeof data.courierLogos === 'string' ? JSON.parse(data.courierLogos) : data.courierLogos;
              if (Array.isArray(parsedCouriers) && parsedCouriers.length > 0) {
                setCouriers(parsedCouriers);
              }
            } catch {}
          }

          if (data.paymentLogos) {
            try {
              const parsedPayments = typeof data.paymentLogos === 'string' ? JSON.parse(data.paymentLogos) : data.paymentLogos;
              if (Array.isArray(parsedPayments) && parsedPayments.length > 0) {
                setPayments(parsedPayments);
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('Error fetching store config:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPromoPreset = (presetKey: string) => {
    setPromoTheme(presetKey);
    if (presetKey === 'christmas') {
      setPromoBadge('🎄 OFERTA NAVIDEÑA');
      setPromoTitle(promoDiscountInput ? `¡Especial Navideño: ${promoDiscountInput}!` : '¡Gran Venta Especial de Navidad!');
      setPromoDescription('Celebra las fiestas con los mejores regalos, descuentos especiales y envíos directos a todo el país.');
      setPromoCouponCode('NAVIDAD2026');
      setPromoImageUrl('https://images.unsplash.com/photo-1543258103-a62bd96b300b?auto=format&fit=crop&w=900&q=85');
      setPromoButtonText('¡Comprar por WhatsApp con Descuento!');
    } else if (presetKey === 'black_friday') {
      setPromoBadge('🖤 BLACK FRIDAY');
      setPromoTitle(promoDiscountInput ? `¡Black Friday: ${promoDiscountInput}!` : '¡Mega Ofertas Black Friday!');
      setPromoDescription('Los precios más bajos del año por tiempo limitado. Aprovecha antes de que se agoten las unidades en stock.');
      setPromoCouponCode('BLACKFRIDAY');
      setPromoImageUrl('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=900&q=85');
      setPromoButtonText('¡Aprovechar Black Friday por WhatsApp!');
    } else if (presetKey === 'super_deals') {
      setPromoBadge('🔥 SÚPER OFERTAS');
      setPromoTitle(promoDiscountInput ? `¡Super Descuentos: ${promoDiscountInput}!` : '¡Semana de Super Descuentos!');
      setPromoDescription('Precios rebajados en productos seleccionados. Haz tu pedido hoy mismo con atención personalizada.');
      setPromoCouponCode('OFERTAS2026');
      setPromoImageUrl('https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=900&q=85');
      setPromoButtonText('¡Ver Ofertas y Comprar!');
    } else if (presetKey === 'new_year') {
      setPromoBadge('🎆 AÑO NUEVO 2026');
      setPromoTitle('¡Celebra el Nuevo Año con Grandes Ofertas!');
      setPromoDescription('Inicia este nuevo ciclo estrenando lo mejor. Promociones exclusivas para nuestros clientes.');
      setPromoCouponCode('ANONUEVO2026');
      setPromoImageUrl('https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=900&q=85');
      setPromoButtonText('¡Aprovechar Promo de Año Nuevo!');
    } else if (presetKey === 'clearance') {
      setPromoBadge('⚡ LIQUIDACIÓN TOTAL');
      setPromoTitle('¡Liquidación de Stock por Temporada!');
      setPromoDescription('¡Últimas unidades disponibles a precio de liquidación! No dejes pasar esta oportunidad.');
      setPromoCouponCode('LIQUIDA2026');
      setPromoImageUrl('https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=85');
      setPromoButtonText('¡Comprar Liquidación por WhatsApp!');
    }
  };

  const handleGeneratePromoWithAI = async () => {
    setIsGeneratingPromoAi(true);
    try {
      const res = await authFetch('/api/store/promo-image/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: promoTheme,
          storeName: storeName.trim(),
          discountText: promoDiscountInput.trim(),
          customPrompt: promoCustomPromptInput.trim(),
          badge: promoBadge.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.image) {
          if (data.image.imageUrl) setPromoImageUrl(data.image.imageUrl);
          if (data.image.suggestedBadge) setPromoBadge(data.image.suggestedBadge);
          if (data.image.suggestedTitle) setPromoTitle(data.image.suggestedTitle);
          if (data.image.suggestedDescription) setPromoDescription(data.image.suggestedDescription);
          if (data.image.suggestedCoupon) setPromoCouponCode(data.image.suggestedCoupon);
          
          setFeedback({
            type: 'success',
            message: `✨ ¡Afiche publicitario generado con Inteligencia Artificial (${data.image.tag})!`,
          });
        }
      } else {
        const err = await res.json();
        setFeedback({
          type: 'error',
          message: err.error || 'No se pudo generar el afiche con IA',
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: e.message || 'Error de conexión al generar con IA',
      });
    } finally {
      setIsGeneratingPromoAi(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleUpdateThemeColor = (presetId: string, colorIndex: number, newHex: string) => {
    setThemePalettes((prev) => {
      const currentList = prev[presetId] || DEFAULT_THEME_COLORS[presetId as StoreTheme] || DEFAULT_THEME_COLORS.classic;
      const nextList = [...currentList];
      nextList[colorIndex] = newHex;
      return {
        ...prev,
        [presetId]: nextList,
      };
    });
  };

  const handleToggleCourier = (id: string) => {
    setCouriers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  const handleAddCustomCourier = () => {
    if (!newCourierName.trim()) return;
    const newId = `custom-courier-${Date.now()}`;
    setCouriers((prev) => [
      ...prev,
      {
        id: newId,
        name: newCourierName.trim(),
        quoteUrl: newCourierQuoteUrl.trim() || undefined,
        logoUrl: newCourierLogo || undefined,
        active: true,
      },
    ]);
    setNewCourierName('');
    setNewCourierQuoteUrl('');
    setNewCourierLogo(null);
  };

  const handleRemoveCourier = (id: string) => {
    setCouriers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleTogglePayment = (id: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const handleAddCustomPayment = () => {
    if (!newPaymentName.trim()) return;
    const newId = `custom-payment-${Date.now()}`;
    setPayments((prev) => [
      ...prev,
      {
        id: newId,
        name: newPaymentName.trim(),
        details: newPaymentDetails.trim() || undefined,
        logoUrl: newPaymentLogo || undefined,
        active: true,
      },
    ]);
    setNewPaymentName('');
    setNewPaymentDetails('');
    setNewPaymentLogo(null);
  };

  const handleRemovePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        storeName: storeName.trim(),
        whatsappNumber: whatsappNumber.trim(),
        description: description.trim(),
        bannerText: bannerText.trim(),
        deliveryFee: Number(deliveryFee) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        currency: currency.trim() || 'USD',
        showStock,
        showOutOfStock,
        instagramUrl: instagramUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        address: address.trim(),
        logoUrl: logoUrl || null,
        theme,
        themeColors: JSON.stringify(themePalettes),
        courierLogos: JSON.stringify(couriers),
        paymentLogos: JSON.stringify(payments),
        promoPopup: JSON.stringify({
          active: promoActive,
          theme: promoTheme,
          badge: promoBadge.trim(),
          title: promoTitle.trim(),
          description: promoDescription.trim(),
          imageUrl: promoImageUrl || null,
          couponCode: promoCouponCode.trim(),
          buttonText: promoButtonText.trim(),
          actionType: promoActionType,
          actionUrl: promoActionUrl.trim(),
        }),
      };

      const res = await authFetch('/api/store/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: '¡Ajustes de tienda guardados con éxito en la base de datos!',
        });
        if (onSaved) onSaved();
      } else {
        const data = await res.json();
        setFeedback({
          type: 'error',
          message: data.error || 'Error al guardar la configuración de la tienda',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error de conexión con el servidor',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar with Save Button & Status */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Ajustes Generales de la Tienda Online</h3>
          </div>
          <p className="text-xs text-slate-500">
            Personaliza el catálogo, marca, medios de pago de Ecuador, logística de envío y temas visuales.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 flex-shrink-0 active:scale-95"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Guardando...' : 'Guardar Ajustes de Tienda'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center space-x-2 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <X className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 1. INFORMACIÓN PRINCIPAL & LOGO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Form Fields */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store className="w-4 h-4 text-sky-600" />
            Datos Básicos del Comercio
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Tienda *</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ej. Mi Tienda Express"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp de Pedidos *</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Ej. 0991234567 o +593991234567"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">Recibirá los pedidos automáticos del carrito.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Slogan / Descripción del Catálogo</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catálogo digital con envíos y pedidos directos"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Cinta de Anuncios / Promociones</label>
            <input
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              placeholder="🔥 ¡Envíos gratis en compras mayores a $50!"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Costo de Envío Base ($)</label>
              <input
                type="number"
                step="0.50"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pedido Mínimo ($)</label>
              <input
                type="number"
                step="1.00"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Moneda</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Instagram (@usuario o URL)</label>
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/tutienda"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dirección / Ubicación Física</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Principal y Secundaria, Local #4"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Col: Logo Uploader */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Camera className="w-4 h-4 text-sky-600" />
              Logo de la Tienda
            </h4>
            <p className="text-xs text-slate-500 mt-2">
              Se mostrará en la cabecera del catálogo, WhatsApp y comprobantes de compra.
            </p>

            <div className="mt-4 flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-28 h-28 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden p-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400">
                    <Store className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <span className="text-[10px] font-bold">Sin Logo</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col w-full gap-2">
                <label className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs active:scale-95">
                  <UploadCloud className="w-4 h-4" />
                  <span>{logoUrl ? 'Cambiar Logo' : 'Subir Logo PNG'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const b64 = await processLogoImageFile(file, 500);
                          setLogoUrl(b64);
                        } catch (err: any) {
                          alert(err.message || 'Error al procesar imagen');
                        }
                      }
                    }}
                  />
                </label>

                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="w-full py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar Logo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
              <label className="flex items-start space-x-2.5 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => setShowStock(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                />
                <div className="space-y-0.5">
                  <span>Mostrar cantidad de existencias / stock disponible</span>
                  <p className="text-[11px] font-normal text-slate-500">Muestra la etiqueta con el número exacto de unidades disponibles a los clientes.</p>
                </div>
              </label>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-100/80 rounded-xl">
              <label className="flex items-start space-x-2.5 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  id="switch-show-out-of-stock"
                  checked={showOutOfStock}
                  onChange={(e) => setShowOutOfStock(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span>Mostrar productos agotados en la tienda</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${showOutOfStock ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {showOutOfStock ? 'Visibles' : 'Ocultos'}
                    </span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500">
                    {showOutOfStock
                      ? 'Los productos con stock en 0 se mostrarán marcados con la etiqueta "Agotado".'
                      : 'Los productos con stock en 0 se ocultarán automáticamente del catálogo para los clientes.'}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TEMAS Y ESTILOS VISUALES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-600" />
            Temas y Estilos Visuales del Catálogo
          </h4>
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
            6 Diseños Interactivos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {THEME_PRESETS.map((preset) => {
            const isSelected = theme === preset.id;
            const paletteForTheme = themePalettes[preset.id] || DEFAULT_THEME_COLORS[preset.id] || DEFAULT_THEME_COLORS.classic;

            return (
              <div
                key={preset.id}
                onClick={() => setTheme(preset.id)}
                className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer relative flex flex-col justify-between border-2 ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50/40 shadow-md ring-2 ring-sky-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {preset.tag}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  </div>

                  <h5 className="font-bold text-slate-900 text-sm">{preset.name}</h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{preset.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1.5">Paleta de Colores:</span>
                  <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    {paletteForTheme.map((c, idx) => (
                      <label
                        key={idx}
                        className="relative w-5 h-5 rounded-full border border-black/20 shadow-xs cursor-pointer inline-flex items-center justify-center hover:scale-125 transition-transform"
                        style={{ backgroundColor: c }}
                        title={`${COLOR_ROLE_NAMES[idx] || 'Color'}: ${c}`}
                      >
                        <input
                          type="color"
                          value={c.startsWith('#') && c.length === 7 ? c : '#000000'}
                          onChange={(e) => handleUpdateThemeColor(preset.id, idx, e.target.value)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </label>
                    ))}
                    <span className="text-[10px] text-slate-400 ml-1">Toca para editar</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MÉTODOS DE PAGO Y LOGÍSTICA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Métodos de Pago */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              Formas y Métodos de Pago Aceptados
            </h4>
            <span className="text-[10px] text-slate-500 font-bold">
              {payments.filter((p) => p.active !== false).length} Activos
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {payments.map((pm, idx) => (
              <div
                key={pm.id || idx}
                className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition ${
                  pm.active !== false
                    ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                    : 'bg-slate-100/60 border-slate-200/60 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {/* Logo con botón para cambiar imagen */}
                    <div className="relative group shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-300 shadow-2xs flex items-center justify-center overflow-hidden p-1">
                        {pm.logoUrl ? (
                          <img src={pm.logoUrl} alt={pm.name} className="w-full h-full object-contain" />
                        ) : (
                          <Landmark className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <label
                        className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white"
                        title="Cambiar logo del método de pago"
                      >
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              try {
                                const b64 = await processLogoImageFile(f, 300);
                                setPayments((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, logoUrl: b64 } : p))
                                );
                              } catch (err: any) {
                                alert(err.message || 'Error al procesar imagen');
                              }
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Nombre del método editable */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Nombre del Método / Banco:
                      </label>
                      <input
                        type="text"
                        value={pm.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPayments((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, name: val } : p))
                          );
                        }}
                        placeholder="Ej. Banco Pichincha, Zelle, Deuna..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <label className="flex items-center space-x-1.5 text-[11px] cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <input
                        type="checkbox"
                        checked={pm.active !== false}
                        onChange={() => handleTogglePayment(pm.id)}
                        className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className={`text-[11px] font-bold ${pm.active !== false ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {pm.active !== false ? 'Activo' : 'Oculto'}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemovePayment(pm.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Eliminar método"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Detalles / Datos de cuenta editables */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Datos de Cuenta / Instrucciones para el Cliente:
                  </label>
                  <input
                    type="text"
                    value={pm.details || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPayments((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, details: val } : p))
                      );
                    }}
                    placeholder="Ej. Cta. Ahorros #2200123456 | Titular: Mi Comercio | CI: 1712345678"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add custom payment method */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-emerald-200/80 space-y-2.5">
            <span className="text-[11px] font-bold text-emerald-900 block flex items-center gap-1">
              <Plus className="w-3 h-3 text-emerald-600" />
              Agregar Nuevo Método de Pago:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newPaymentName}
                onChange={(e) => setNewPaymentName(e.target.value)}
                placeholder="Nombre (ej. Banco Bolivariano)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={newPaymentDetails}
                onChange={(e) => setNewPaymentDetails(e.target.value)}
                placeholder="Datos de cuenta o instrucción"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-2">
                {newPaymentLogo && (
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-300 overflow-hidden p-0.5 flex items-center justify-center">
                    <img src={newPaymentLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
                <label className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{newPaymentLogo ? 'Cambiar Logo' : 'Subir Logo PNG/JPG'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          const b64 = await processLogoImageFile(f, 300);
                          setNewPaymentLogo(b64);
                        } catch (err: any) {
                          alert(err.message || 'Error al procesar imagen');
                        }
                      }
                    }}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddCustomPayment}
                disabled={!newPaymentName.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Empresas de Transporte / Courier */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-600" />
              Empresas de Envíos y Logística
            </h4>
            <span className="text-[10px] text-slate-500 font-bold">
              {couriers.filter((c) => c.active !== false).length} Activos
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {couriers.map((courier, idx) => (
              <div
                key={courier.id || idx}
                className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition ${
                  courier.active !== false
                    ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                    : 'bg-slate-100/60 border-slate-200/60 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {/* Logo con botón para cambiar imagen */}
                    <div className="relative group shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-300 shadow-2xs flex items-center justify-center overflow-hidden p-1">
                        {courier.logoUrl ? (
                          <img src={courier.logoUrl} alt={courier.name} className="w-full h-full object-contain" />
                        ) : (
                          <Truck className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <label
                        className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white"
                        title="Cambiar logo del courier"
                      >
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              try {
                                const b64 = await processLogoImageFile(f, 300);
                                setCouriers((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, logoUrl: b64 } : c))
                                );
                              } catch (err: any) {
                                alert(err.message || 'Error al procesar imagen');
                              }
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Nombre editable del courier */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Nombre de la Empresa de Envío:
                      </label>
                      <input
                        type="text"
                        value={courier.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCouriers((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, name: val } : c))
                          );
                        }}
                        placeholder="Ej. Servientrega, LaarCourier, Motorizado..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <label className="flex items-center space-x-1.5 text-[11px] cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <input
                        type="checkbox"
                        checked={courier.active !== false}
                        onChange={() => handleToggleCourier(courier.id)}
                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span className={`text-[11px] font-bold ${courier.active !== false ? 'text-sky-700' : 'text-slate-400'}`}>
                        {courier.active !== false ? 'Activo' : 'Oculto'}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveCourier(courier.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Eliminar courier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* URL de Cotizador Online Editable */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-bold text-slate-600">
                      🔗 URL / Enlace del Cotizador o Tarifario Web (Para calcular envíos):
                    </label>
                    {courier.quoteUrl?.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = courier.quoteUrl?.trim() || '';
                          const target = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
                          window.open(target, '_blank');
                        }}
                        className="text-[10px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 hover:underline cursor-pointer"
                        title="Probar abrir cotizador en nueva pestaña"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Probar enlace</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={courier.quoteUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCouriers((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, quoteUrl: val } : c))
                        );
                      }}
                      placeholder="Ej. https://www.servientrega.com.ec/ o portal de cotizaciones"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add custom courier */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-sky-200/80 space-y-2.5">
            <span className="text-[11px] font-bold text-sky-900 block flex items-center gap-1">
              <Plus className="w-3 h-3 text-sky-600" />
              Agregar Empresa de Envío / Courier:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newCourierName}
                onChange={(e) => setNewCourierName(e.target.value)}
                placeholder="Nombre (ej. Envíos Panamericana)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
              />
              <input
                type="url"
                value={newCourierQuoteUrl}
                onChange={(e) => setNewCourierQuoteUrl(e.target.value)}
                placeholder="URL de cotizador web (Opcional)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-2">
                {newCourierLogo && (
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-300 overflow-hidden p-0.5 flex items-center justify-center">
                    <img src={newCourierLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
                <label className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
                  <span>{newCourierLogo ? 'Cambiar Logo' : 'Subir Logo PNG/JPG'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          const b64 = await processLogoImageFile(f, 300);
                          setNewCourierLogo(b64);
                        } catch (err: any) {
                          alert(err.message || 'Error al procesar imagen');
                        }
                      }
                    }}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddCustomCourier}
                disabled={!newCourierName.trim()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CARTEL PUBLICITARIO Y VENTANA EMERGENTE DE OFERTAS (POPUP IA) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Cartel Publicitario y Ventana Emergente de Ofertas (Popup IA)
                </h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  IA Generativa
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Muestra un afiche publicitario interactivo al ingresar al catálogo con cupones, descuentos y pedidos directos a WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 transition">
              <input
                type="checkbox"
                checked={promoActive}
                onChange={(e) => setPromoActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className={`text-xs font-bold ${promoActive ? 'text-amber-800' : 'text-slate-500'}`}>
                {promoActive ? 'Cartel Activo en Tienda' : 'Cartel Desactivado'}
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowPromoTestModal(true)}
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-2xs active:scale-95"
              title="Probar cómo ve el cliente la ventana emergente"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Probar Popup</span>
            </button>
          </div>
        </div>

        {/* Generador Rápido con IA */}
        <div className="p-4 bg-gradient-to-br from-amber-50/70 via-rose-50/40 to-indigo-50/50 rounded-2xl border border-amber-200/80 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Wand2 className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-900">
                Generador de Afiches y Campañas con Inteligencia Artificial
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Crea automáticamente la imagen HD, títulos de impacto, cupón y textos persuasivos
            </span>
          </div>

          {/* Plantillas / Temas de Campaña */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              1. Selecciona la Campaña o Temporada:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { id: 'christmas', label: 'Navidad / Reyes', icon: '🎄', color: 'border-red-300 bg-red-50 text-red-900' },
                { id: 'black_friday', label: 'Black Friday', icon: '🖤', color: 'border-zinc-400 bg-zinc-100 text-zinc-900' },
                { id: 'super_deals', label: 'Súper Ofertas', icon: '🔥', color: 'border-amber-300 bg-amber-50 text-amber-900' },
                { id: 'new_year', label: 'Año Nuevo', icon: '🎆', color: 'border-indigo-300 bg-indigo-50 text-indigo-900' },
                { id: 'clearance', label: 'Liquidación Total', icon: '⚡', color: 'border-rose-300 bg-rose-50 text-rose-900' },
                { id: 'custom', label: 'Personalizado', icon: '⭐', color: 'border-sky-300 bg-sky-50 text-sky-900' },
              ].map((p) => {
                const isSelected = promoTheme === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPromoPreset(p.id)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer border ${
                      isSelected
                        ? 'ring-2 ring-amber-500 shadow-xs ' + p.color
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parámetros para la IA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                2. Descuento o Gancho Comercial:
              </label>
              <input
                type="text"
                value={promoDiscountInput}
                onChange={(e) => setPromoDiscountInput(e.target.value)}
                placeholder="Ej. 30% OFF, Envío Gratis en todo, 2x1..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                3. Instrucción visual adicional para la IA (Opcional):
              </label>
              <input
                type="text"
                value={promoCustomPromptInput}
                onChange={(e) => setPromoCustomPromptInput(e.target.value)}
                placeholder="Ej. fondo dorado con regalos de lujo, luces navideñas cálidas..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Botón Acción Generar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2 text-[11px] text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>La IA creará la imagen publicitaria en alta definición y los textos de venta</span>
            </div>

            <button
              type="button"
              onClick={handleGeneratePromoWithAI}
              disabled={isGeneratingPromoAi}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:via-rose-400 hover:to-indigo-500 text-white text-xs font-black transition cursor-pointer shadow-md shadow-rose-500/20 flex items-center space-x-2 disabled:opacity-50 active:scale-95"
            >
              {isGeneratingPromoAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando Afiche & Textos con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>✨ Generar Afiche Completo e Imagen con IA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Vista Previa Visual del Cartel y Campos Editables */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Left Column: Visual Poster Card & Image Uploader */}
          <div className="lg:col-span-5 space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Afiche / Imagen del Cartel Publicitario:
            </label>

            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm aspect-video sm:aspect-[16/10] flex items-center justify-center group">
              {promoImageUrl ? (
                <img
                  src={promoImageUrl}
                  alt="Afiche Promocional"
                  className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="text-center p-4 text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                  <span className="text-xs font-bold">Sin imagen asignada</span>
                </div>
              )}

              {/* Badges preview overlay */}
              <div className="absolute top-3 left-3 z-10">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-md">
                  {promoBadge || 'OFERTA'}
                </span>
              </div>

              {/* Title preview overlay */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <span className="text-[10px] font-bold text-amber-300 block uppercase tracking-wider">
                  {storeName}
                </span>
                <h5 className="text-xs sm:text-sm font-black text-white line-clamp-1">
                  {promoTitle}
                </h5>
              </div>
            </div>

            {/* Image Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <label className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95 text-center">
                <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
                <span className="truncate">Subir Foto (PNG/JPG)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        const b64 = await processLogoImageFile(f, 1000);
                        setPromoImageUrl(b64);
                      } catch (err: any) {
                        alert(err.message || 'Error al procesar imagen');
                      }
                    }
                  }}
                />
              </label>

              <button
                type="button"
                onClick={handleGeneratePromoWithAI}
                disabled={isGeneratingPromoAi}
                className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95 text-center"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="truncate">Re-generar con IA</span>
              </button>
            </div>
          </div>

          {/* Right Column: Detailed Editable Form Fields */}
          <div className="lg:col-span-7 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Etiqueta / Insignia Superior:
                </label>
                <input
                  type="text"
                  value={promoBadge}
                  onChange={(e) => setPromoBadge(e.target.value)}
                  placeholder="Ej. 🎄 OFERTA NAVIDEÑA"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Código de Cupón (Opcional):
                </label>
                <input
                  type="text"
                  value={promoCouponCode}
                  onChange={(e) => setPromoCouponCode(e.target.value.toUpperCase())}
                  placeholder="Ej. NAVIDAD2026"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Título Principal del Cartel:
              </label>
              <input
                type="text"
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                placeholder="Ej. ¡Gran Venta Especial de Navidad!"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Descripción / Texto Persuasivo:
              </label>
              <textarea
                rows={2}
                value={promoDescription}
                onChange={(e) => setPromoDescription(e.target.value)}
                placeholder="Aprovecha hasta un 30% de descuento en regalos seleccionados..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Acción al Hacer Clic en el Botón:
                </label>
                <select
                  value={promoActionType}
                  onChange={(e) => setPromoActionType(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-sky-500 focus:bg-white cursor-pointer"
                >
                  <option value="whatsapp">Enviar Mensaje Directo a WhatsApp</option>
                  <option value="catalog">Filtrar Productos con Descuento en Catálogo</option>
                  <option value="url">Abrir Enlace Externo Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Texto del Botón Principal:
                </label>
                <input
                  type="text"
                  value={promoButtonText}
                  onChange={(e) => setPromoButtonText(e.target.value)}
                  placeholder="Ej. ¡Pedir con Descuento por WhatsApp!"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>

            {promoActionType === 'url' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Enlace URL de Destino:
                </label>
                <input
                  type="url"
                  value={promoActionUrl}
                  onChange={(e) => setPromoActionUrl(e.target.value)}
                  placeholder="https://tutienda.com/ofertas"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de prueba del Popup Promocional */}
      {showPromoTestModal && (
        <StorePromoModal
          forceOpen={true}
          storeName={storeName}
          whatsappNumber={whatsappNumber}
          currency={currency}
          config={{
            active: true,
            theme: promoTheme as any,
            badge: promoBadge,
            title: promoTitle,
            description: promoDescription,
            imageUrl: promoImageUrl,
            couponCode: promoCouponCode,
            buttonText: promoButtonText,
            actionType: promoActionType,
            actionUrl: promoActionUrl,
          }}
          onClose={() => setShowPromoTestModal(false)}
        />
      )}
    </div>
  );
};
