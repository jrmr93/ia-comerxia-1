import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { safeLocalStorage } from '../utils/safeStorage.ts';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  Calendar,
  CalendarRange,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Database,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  FileUp,
  Film,
  Filter,
  Globe,
  Headphones,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Landmark,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  PackageCheck,
  Palette,
  Phone,
  Play,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Table,
  Tag,
  Trash,
  Trash2,
  TrendingUp,
  Truck,
  UploadCloud,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { CartItem, CustomerOrder, InventoryItem, StoreConfig, StoreTheme, CourierPartner, PaymentMethodPartner } from '../types.ts';
import { OrdersTableView } from './OrdersTableView.tsx';
import { ShippingTicketModal } from './ShippingTicketModal.tsx';
import { RequestShippingDataModal } from './RequestShippingDataModal.tsx';
import { ManageShippingGuideModal } from './ManageShippingGuideModal.tsx';
import { ManagePendingShippingModal } from './ManagePendingShippingModal.tsx';
import { StorePromoModal } from './store/StorePromoModal.tsx';
import { StoreThemedCatalog, StoreLayoutProps } from './store/StoreThemeLayouts.tsx';
import { ProductMediaDisplay } from './ProductMediaDisplay.tsx';
import { ShareStoreModal } from './ShareStoreModal.tsx';
import { parseVideoUrl } from '../utils/video-helper.ts';
import { getPublicStoreUrl, getPublicProductUrl } from '../utils/storeUrls.ts';
import {
  normalizeEcuadorPhone,
  formatEcuadorLocalDisplay,
  buildWhatsAppLink,
  toEcuadorLocalPhone,
  toEcuadorInternationalPhone,
  isCashPayment,
} from '../utils/phone.ts';
import {
  trackStoreVisit,
  trackProductView,
  trackAddToCart,
  trackWhatsAppClick,
} from '../services/analytics.ts';
import { getThemeColors, ThemeColorPalette } from '../utils/themeColors.ts';
import { getCustomerCi, stripCiFromAddress, getCleanAddress } from '../utils/orderUtils.ts';

// Visual Style / Theme Presets and Default Color Palettes
export const DEFAULT_THEME_COLORS: Record<StoreTheme, string[]> = {
  classic: ['#0284c7', '#2563eb', '#10b981', '#f8fafc'],
  boutique: ['#f59e0b', '#eab308', '#27272a', '#09090b'],
  fresh: ['#059669', '#0d9488', '#06b6d4', '#ecfdf5'],
  brutalist: ['#fde047', '#fb7185', '#34d399', '#000000'],
  cyber: ['#06b6d4', '#d946ef', '#0b1528', '#070d18'],
  minimal: ['#1c1917', '#78716c', '#e7e5e4', '#faf8f5'],
};

export const COLOR_ROLE_NAMES = [
  'Color Primario / Botones',
  'Color Secundario / Acentos',
  'Superficie / Contrastes',
  'Fondo Base / Tienda',
];

export const parseThemePalettes = (raw: any): Record<string, string[]> => {
  const result: Record<string, string[]> = {
    classic: [...DEFAULT_THEME_COLORS.classic],
    boutique: [...DEFAULT_THEME_COLORS.boutique],
    fresh: [...DEFAULT_THEME_COLORS.fresh],
    brutalist: [...DEFAULT_THEME_COLORS.brutalist],
    cyber: [...DEFAULT_THEME_COLORS.cyber],
    minimal: [...DEFAULT_THEME_COLORS.minimal],
  };

  if (!raw) return result;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return result;
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    Object.keys(result).forEach((key) => {
      if (Array.isArray(parsed[key]) && parsed[key].length >= 4) {
        result[key] = [...parsed[key]];
      }
    });
  }

  return result;
};

export const THEME_PRESETS: Array<{
  id: StoreTheme;
  name: string;
  subtitle: string;
  tag: string;
  description: string;
  layoutDescription: string;
  colors: string[];
  previewBg: string;
  previewCard: string;
  previewAccent: string;
}> = [
  {
    id: 'classic',
    name: 'Clásico Moderno',
    subtitle: 'Azul & Esmeralda Profesional',
    tag: 'Recomendado General',
    description: 'Estilo limpio, profesional y altamente confiable con esquinas suaves y sombras equilibradas. Ideal para comercio general.',
    layoutDescription: 'Distribución vertical fluida: Barra de filtros y búsqueda horizontal superior, galería de 4 columnas y paneles de logística apilados.',
    colors: ['#0284c7', '#2563eb', '#10b981', '#f8fafc'],
    previewBg: 'bg-slate-100',
    previewCard: 'bg-white border-slate-300 text-slate-900',
    previewAccent: 'from-sky-500 to-blue-600',
  },
  {
    id: 'boutique',
    name: 'Boutique Elegante',
    subtitle: 'Negro Obsidiana & Oro Luxury',
    tag: 'Alta Gama & Lujo',
    description: 'Atmósfera sofisticada con contrastes oscuros profundos, líneas nítidas y detalles dorados para marcas exclusivas.',
    layoutDescription: 'Estructura editorial de 2 columnas: Barra lateral izquierda con navegación Atelier, concierge VIP y certificados; galería espaciosa a la derecha.',
    colors: ['#f59e0b', '#eab308', '#27272a', '#09090b'],
    previewBg: 'bg-zinc-950',
    previewCard: 'bg-zinc-900 border-amber-500/30 text-zinc-100',
    previewAccent: 'from-amber-500 via-amber-600 to-yellow-600',
  },
  {
    id: 'fresh',
    name: 'Fresco & Dinámico',
    subtitle: 'Menta, Teal & Verde Esmeralda',
    tag: 'Vitalidad & Tendencia',
    description: 'Estilo revitalizante, moderno y enérgico con tonos menta y teal para belleza, salud y vida activa.',
    layoutDescription: 'Diseño Bento interactivo: Cinta superior de avisos, cinturón de categorías vivas, banner Bento con búsqueda rápida y paneles dobles de logística.',
    colors: ['#059669', '#0d9488', '#06b6d4', '#ecfdf5'],
    previewBg: 'bg-teal-50/50',
    previewCard: 'bg-white border-teal-300 text-slate-900',
    previewAccent: 'from-emerald-500 via-teal-500 to-cyan-600',
  },
  {
    id: 'brutalist',
    name: 'Neo-Brutalismo Pop',
    subtitle: 'Bordes Negros & Sombras Duras',
    tag: 'Impacto Visual & Retro',
    description: 'Estilo gráfico de alto impacto con bordes negros gruesos, sombras de bloque duras y botones con pulsación táctil.',
    layoutDescription: 'Estructura Zine en bloques divididos: Columna izquierda de control con stickers de búsqueda, categorías y garantías; galería de impacto a la derecha.',
    colors: ['#fde047', '#fb7185', '#34d399', '#000000'],
    previewBg: 'bg-amber-100',
    previewCard: 'bg-white border-3 border-black text-black shadow-[3px_3px_0px_#000]',
    previewAccent: 'from-yellow-400 to-amber-500 text-black',
  },
  {
    id: 'cyber',
    name: 'Cyberpunk HUD',
    subtitle: 'Neón Cyan & Terminal Sci-Fi',
    tag: 'Tecnología & Gamer',
    description: 'Cabina futurista de control con fondos espaciales oscuros, resplandor neón cyan y magenta y tipografía monospace HUD.',
    layoutDescription: 'Centro de comando Sci-Fi: Barra de telemetría superior, terminal lateral de protocolos y seguridad, y matriz holográfica de productos.',
    colors: ['#06b6d4', '#d946ef', '#0b1528', '#070d18'],
    previewBg: 'bg-[#070d18]',
    previewCard: 'bg-[#0b1528] border border-cyan-500/70 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    previewAccent: 'from-cyan-500 to-fuchsia-600',
  },
  {
    id: 'minimal',
    name: 'Minimalista Nórdico',
    subtitle: 'Zen & Arena Cálida',
    tag: 'Elegancia Silenciosa',
    description: 'Estética escandinava pura con lienzo arena cálida, tarjetas flotantes sin bordes rígidos y formas de píldora redondeadas.',
    layoutDescription: 'Distribución Zen centrada: Navegación de categorías en píldoras centradas, galería limpia de 4 columnas y paneles de logística en tarjetas suaves.',
    colors: ['#1c1917', '#78716c', '#e7e5e4', '#faf8f5'],
    previewBg: 'bg-[#FAF8F5]',
    previewCard: 'bg-white border-0 shadow-sm text-stone-900',
    previewAccent: 'from-stone-800 to-stone-950',
  },
];

export const getThemeStyles = (theme: StoreTheme = 'classic', customPalette?: string[], isCustomerView: boolean = true) => {
  const colors = getThemeColors(customPalette, theme);

  if (!isCustomerView) {
    return {
      colors,
      pageBg: 'text-slate-900',
      panelBg: 'bg-white border-slate-300 text-slate-900 shadow-sm',
      cardBg: 'bg-white border-slate-300 text-slate-900 shadow-sm',
      cardHover: 'hover:border-sky-400 hover:shadow-md',
      headerBg: 'bg-white border-slate-300 text-slate-900 shadow-sm',
      headerText: 'text-slate-900',
      headerSubtext: 'text-slate-500',
      bannerTickerBg: 'bg-amber-50 text-amber-900 border-amber-200',
      bannerIconColor: 'text-amber-500',
      trustCardBg: 'bg-white border-slate-200 text-slate-800 shadow-xs',
      trustIconBg: 'bg-sky-50 text-sky-600 border border-sky-200',
      trustTitle: 'text-slate-800',
      trustSubtitle: 'text-slate-500',
      filterBarBg: 'bg-white border-slate-300 shadow-sm',
      searchInputBg: 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500',
      pillActive: 'bg-slate-900 text-white font-bold shadow-xs',
      pillInactive: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200',
      productCardBg: 'bg-white border-slate-200 hover:border-sky-400 hover:shadow-md text-slate-900',
      productImageBg: 'bg-slate-50 border-b border-slate-100',
      productTitle: 'text-slate-900 hover:text-sky-600',
      productCategory: 'text-slate-400',
      productDescription: 'text-slate-500',
      productPrice: 'text-slate-900 font-bold',
      productCategoryBadge: 'bg-white text-slate-800 border-slate-200',
      primaryBtn: 'bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs',
      secondaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-bold',
      cartBadge: 'bg-sky-600 text-white',
      cartHeaderBg: 'bg-white border-b border-slate-200 text-slate-900',
      cartDrawerBg: 'bg-white border-l border-slate-200 text-slate-900',
      cartItemBg: 'bg-slate-50 border-slate-200 text-slate-900',
      cartCheckoutBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md',
      officialBadgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
      themeAccentName: 'Panel Administrativo Comerxia',
    };
  }

  switch (theme) {
    case 'boutique':
      return {
        colors,
        // Container & Backgrounds
        pageBg: 'text-zinc-100',
        panelBg: 'bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-md',
        cardBg: 'bg-zinc-900 border-zinc-800/90 text-zinc-100 shadow-lg shadow-black/40',
        cardHover: 'hover:border-amber-500/60 hover:shadow-2xl hover:shadow-black/70',
        headerBg: 'bg-gradient-to-br from-zinc-900 via-neutral-900 to-zinc-950 border-amber-500/30 text-white shadow-xl ring-1 ring-amber-500/20',
        headerText: 'text-amber-100',
        headerSubtext: 'text-zinc-400',
        bannerTickerBg: 'bg-zinc-900/90 text-amber-200 border-amber-500/40 shadow-inner',
        bannerIconColor: 'text-amber-400',
        // Trust badges
        trustCardBg: 'bg-zinc-900/90 border-zinc-800/90 text-zinc-100 shadow-md hover:border-amber-500/30',
        trustIconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        trustTitle: 'text-zinc-100',
        trustSubtitle: 'text-zinc-400',
        // Search & Filters
        filterBarBg: 'bg-zinc-900 border-zinc-800 shadow-lg',
        searchInputBg: 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-zinc-950',
        pillActive: 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-zinc-950 font-black shadow-md shadow-amber-500/20',
        pillInactive: 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-700/80',
        // Product cards
        productCardBg: 'bg-zinc-900/95 border-zinc-800 text-zinc-100 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-black/70',
        productImageBg: 'bg-zinc-950 border-b border-zinc-800',
        productTitle: 'text-zinc-100 hover:text-amber-400',
        productCategory: 'text-zinc-400',
        productDescription: 'text-zinc-400',
        productPrice: 'text-amber-400 font-black',
        productCategoryBadge: 'bg-zinc-950/90 text-amber-300 border-zinc-800',
        primaryBtn: 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-black shadow-md shadow-amber-500/20',
        secondaryBtn: 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 font-bold',
        cartBadge: 'bg-amber-500 text-zinc-950 font-black',
        // Cart drawer
        cartHeaderBg: 'bg-zinc-900/95 border-b border-zinc-800 text-zinc-100',
        cartDrawerBg: 'bg-zinc-950 border-l border-zinc-800 text-zinc-100',
        cartItemBg: 'bg-zinc-900/90 border-zinc-800 text-zinc-100',
        cartCheckoutBtn: 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-black shadow-lg shadow-amber-500/25',
        // Badges
        officialBadgeBg: 'bg-amber-950/90 text-amber-300 border-amber-500/40 shadow-xs',
        themeAccentName: 'Boutique Elegante (Oro & Carbón)',
      };
    case 'fresh':
      return {
        colors,
        // Container & Backgrounds
        pageBg: 'text-slate-900',
        panelBg: 'bg-white border-teal-200 text-slate-900 shadow-sm',
        cardBg: 'bg-white border-teal-200/80 text-slate-900 shadow-sm',
        cardHover: 'hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/10',
        headerBg: 'bg-gradient-to-br from-white via-teal-50/30 to-emerald-50/40 border-teal-300 text-slate-900 shadow-md ring-1 ring-teal-400/20',
        headerText: 'text-slate-900',
        headerSubtext: 'text-teal-800/80',
        bannerTickerBg: 'bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 text-emerald-950 border-emerald-200/90 shadow-xs',
        bannerIconColor: 'text-emerald-600',
        // Trust badges
        trustCardBg: 'bg-white border-teal-200/80 text-slate-800 shadow-xs hover:border-teal-300',
        trustIconBg: 'bg-teal-50 text-teal-700 border border-teal-200',
        trustTitle: 'text-slate-800',
        trustSubtitle: 'text-slate-500',
        // Search & Filters
        filterBarBg: 'bg-white border-teal-300/90 shadow-sm',
        searchInputBg: 'bg-teal-50/30 border-teal-200 text-slate-900 placeholder:text-teal-700/60 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100',
        pillActive: 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-xs',
        pillInactive: 'bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200',
        // Product cards
        productCardBg: 'bg-white border-teal-100 hover:border-emerald-400 hover:shadow-xl hover:shadow-teal-500/10 text-slate-900',
        productImageBg: 'bg-teal-50/20 border-b border-teal-100',
        productTitle: 'text-slate-900 hover:text-teal-700',
        productCategory: 'text-slate-400',
        productDescription: 'text-slate-500',
        productPrice: 'text-emerald-700 font-black',
        productCategoryBadge: 'bg-white/95 text-teal-900 border-teal-200',
        primaryBtn: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold shadow-md shadow-teal-500/20',
        secondaryBtn: 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs font-bold',
        cartBadge: 'bg-teal-600 text-white',
        // Cart drawer
        cartHeaderBg: 'bg-teal-50/80 border-b border-teal-200 text-slate-900',
        cartDrawerBg: 'bg-white border-l border-teal-200 text-slate-900',
        cartItemBg: 'bg-teal-50/30 border-teal-200 text-slate-900',
        cartCheckoutBtn: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black shadow-lg shadow-teal-500/25',
        // Badges
        officialBadgeBg: 'bg-teal-100 text-teal-950 border-teal-300 shadow-2xs',
        themeAccentName: 'Fresco & Dinámico (Menta & Teal)',
      };
    case 'brutalist':
      return {
        colors,
        // Container & Backgrounds
        pageBg: 'text-black',
        panelBg: 'bg-white border-3 border-black shadow-[5px_5px_0px_0px_#000] text-black',
        cardBg: 'bg-white border-3 border-black shadow-[5px_5px_0px_0px_#000] text-black',
        cardHover: 'hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[7px_7px_0px_0px_#000]',
        headerBg: 'bg-yellow-300 border-3 border-black text-black shadow-[6px_6px_0px_0px_#000]',
        headerText: 'text-black font-black uppercase tracking-tight',
        headerSubtext: 'text-black font-bold',
        bannerTickerBg: 'bg-rose-400 text-black border-2 border-black font-black shadow-[3px_3px_0px_0px_#000]',
        bannerIconColor: 'text-black',
        // Trust badges
        trustCardBg: 'bg-white border-2 border-black text-black shadow-[3px_3px_0px_0px_#000] hover:bg-yellow-100',
        trustIconBg: 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]',
        trustTitle: 'text-black font-black uppercase text-[11px]',
        trustSubtitle: 'text-black/80 font-bold',
        // Search & Filters
        filterBarBg: 'bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000]',
        searchInputBg: 'bg-yellow-50/60 border-2 border-black text-black placeholder:text-black/60 focus:bg-white focus:shadow-[3px_3px_0px_0px_#000]',
        pillActive: 'bg-black text-yellow-300 font-black border-2 border-black shadow-[2px_2px_0px_0px_#000]',
        pillInactive: 'bg-white text-black font-bold hover:bg-yellow-200 border-2 border-black shadow-[2px_2px_0px_0px_#000]',
        // Product cards
        productCardBg: 'bg-white border-3 border-black shadow-[5px_5px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_#000] text-black',
        productImageBg: 'bg-yellow-100/60 border-b-3 border-black',
        productTitle: 'text-black font-black hover:text-rose-600 uppercase tracking-tight',
        productCategory: 'text-black/70 font-mono font-bold',
        productDescription: 'text-black/80 font-semibold',
        productPrice: 'text-black font-black bg-yellow-300 px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] inline-block',
        productCategoryBadge: 'bg-rose-400 text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_#000]',
        primaryBtn: 'bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        secondaryBtn: 'bg-emerald-400 hover:bg-emerald-300 text-black font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        cartBadge: 'bg-rose-500 text-white font-black border-2 border-black shadow-[1px_1px_0px_0px_#000]',
        // Cart drawer
        cartHeaderBg: 'bg-yellow-300 border-b-3 border-black text-black font-black',
        cartDrawerBg: 'bg-white border-l-3 border-black text-black',
        cartItemBg: 'bg-yellow-50/60 border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black',
        cartCheckoutBtn: 'bg-emerald-400 hover:bg-emerald-300 text-black font-black uppercase border-3 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        // Badges
        officialBadgeBg: 'bg-white text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_#000]',
        themeAccentName: 'Neo-Brutalismo Pop (Stickers & Sombras Duras)',
      };
    case 'cyber':
      return {
        colors,
        // Container & Backgrounds
        pageBg: 'text-cyan-100',
        panelBg: 'bg-[#0b1528]/90 border border-cyan-500/40 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-md',
        cardBg: 'bg-[#091322] border border-cyan-500/50 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
        cardHover: 'hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]',
        headerBg: 'bg-gradient-to-r from-[#070e1c] via-[#0d1c38] to-[#120f2e] border-b-2 border-cyan-500 text-white shadow-[0_4px_25px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30',
        headerText: 'text-cyan-300 font-mono tracking-wider drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]',
        headerSubtext: 'text-cyan-200/70 font-mono',
        bannerTickerBg: 'bg-[#081224] text-cyan-300 border border-cyan-500/60 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]',
        bannerIconColor: 'text-cyan-400',
        // Trust badges
        trustCardBg: 'bg-[#091322] border border-cyan-500/40 text-cyan-200 hover:border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]',
        trustIconBg: 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
        trustTitle: 'text-cyan-100 font-mono',
        trustSubtitle: 'text-cyan-400/70 font-mono text-[10px]',
        // Search & Filters
        filterBarBg: 'bg-[#0a1529] border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
        searchInputBg: 'bg-[#060e1c] border border-cyan-500/60 text-cyan-200 placeholder:text-cyan-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/40 focus:bg-[#060e1c] font-mono',
        pillActive: 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-mono font-black shadow-[0_0_12px_rgba(6,182,212,0.6)] border border-cyan-300',
        pillInactive: 'bg-[#0b1930] text-cyan-300 hover:bg-[#122648] hover:text-white border border-cyan-800/80 font-mono',
        // Product cards
        productCardBg: 'bg-[#081220] border border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] text-cyan-100',
        productImageBg: 'bg-[#040810] border-b border-cyan-500/30',
        productTitle: 'text-cyan-100 hover:text-cyan-300 font-mono tracking-tight',
        productCategory: 'text-cyan-400/60 font-mono',
        productDescription: 'text-cyan-300/70 font-mono text-xs',
        productPrice: 'text-cyan-300 font-mono font-black drop-shadow-[0_0_6px_rgba(6,182,212,0.7)]',
        productCategoryBadge: 'bg-[#040914]/90 text-cyan-300 border border-cyan-500/50 font-mono',
        primaryBtn: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-black shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-300',
        secondaryBtn: 'bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-mono font-black shadow-[0_0_15px_rgba(217,70,239,0.4)] border border-fuchsia-400',
        cartBadge: 'bg-cyan-400 text-slate-950 font-mono font-black shadow-[0_0_10px_rgba(6,182,212,0.8)]',
        // Cart drawer
        cartHeaderBg: 'bg-[#081224] border-b border-cyan-500/50 text-cyan-100 font-mono',
        cartDrawerBg: 'bg-[#050b14] border-l-2 border-cyan-500 text-cyan-100',
        cartItemBg: 'bg-[#09152a] border border-cyan-500/30 text-cyan-100',
        cartCheckoutBtn: 'bg-gradient-to-r from-cyan-400 via-teal-400 to-fuchsia-500 hover:from-cyan-300 hover:to-fuchsia-400 text-slate-950 font-mono font-black shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-200',
        // Badges
        officialBadgeBg: 'bg-cyan-950/90 text-cyan-300 border border-cyan-400/60 font-mono shadow-[0_0_8px_rgba(6,182,212,0.3)]',
        themeAccentName: 'Cyberpunk HUD (Neón Cyan & Violeta)',
      };
    case 'minimal':
      return {
        colors,
        // Container & Backgrounds
        pageBg: 'text-stone-900',
        panelBg: 'bg-white border-0 text-stone-900 shadow-sm rounded-3xl',
        cardBg: 'bg-white border-0 text-stone-900 shadow-sm hover:shadow-md transition-shadow',
        cardHover: 'hover:shadow-xl hover:shadow-stone-200/60',
        headerBg: 'bg-white/90 backdrop-blur-md border border-stone-200/80 text-stone-900 shadow-xs rounded-3xl',
        headerText: 'text-stone-900 font-medium tracking-tight',
        headerSubtext: 'text-stone-500 font-normal',
        bannerTickerBg: 'bg-stone-100 text-stone-700 border-0 rounded-full shadow-none',
        bannerIconColor: 'text-stone-600',
        // Trust badges
        trustCardBg: 'bg-white border border-stone-200/70 text-stone-800 shadow-2xs hover:shadow-sm rounded-2xl',
        trustIconBg: 'bg-stone-100 text-stone-800 border-0 rounded-full',
        trustTitle: 'text-stone-800 font-semibold',
        trustSubtitle: 'text-stone-500 font-normal',
        // Search & Filters
        filterBarBg: 'bg-white border border-stone-200/80 shadow-xs rounded-2xl',
        searchInputBg: 'bg-stone-50 border-0 text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-1 focus:ring-stone-400 rounded-full',
        pillActive: 'bg-stone-900 text-white font-medium shadow-none rounded-full',
        pillInactive: 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-0 rounded-full',
        // Product cards
        productCardBg: 'bg-white border-0 hover:shadow-xl hover:shadow-stone-200/70 text-stone-900 rounded-3xl',
        productImageBg: 'bg-[#f4f2ee] rounded-t-3xl',
        productTitle: 'text-stone-900 hover:text-stone-600 font-semibold tracking-tight',
        productCategory: 'text-stone-400 font-normal',
        productDescription: 'text-stone-500 font-normal',
        productPrice: 'text-stone-900 font-bold',
        productCategoryBadge: 'bg-white/95 text-stone-700 border border-stone-200/70 rounded-full',
        primaryBtn: 'bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-full shadow-none',
        secondaryBtn: 'bg-stone-200 hover:bg-stone-300 text-stone-900 font-medium rounded-full shadow-none',
        cartBadge: 'bg-stone-900 text-white font-semibold rounded-full',
        // Cart drawer
        cartHeaderBg: 'bg-white border-b border-stone-100 text-stone-900',
        cartDrawerBg: 'bg-[#FAF8F5] border-l border-stone-200 text-stone-900',
        cartItemBg: 'bg-white border border-stone-100 text-stone-900 rounded-2xl',
        cartCheckoutBtn: 'bg-stone-900 hover:bg-black text-white font-semibold rounded-full shadow-md',
        // Badges
        officialBadgeBg: 'bg-stone-100 text-stone-800 border border-stone-200 rounded-full',
        themeAccentName: 'Minimalista Nórdico (Zen & Arena Cálida)',
      };
    case 'classic':
    default:
      return {
        colors,
        // Container & Backgrounds
        pageBg: 'text-slate-900',
        panelBg: 'bg-white border-slate-300 text-slate-900 shadow-sm',
        cardBg: 'bg-white border-slate-300 text-slate-900 shadow-sm',
        cardHover: 'hover:border-sky-400/80 hover:shadow-lg hover:shadow-slate-200/60',
        headerBg: 'bg-white border border-slate-300 shadow-sm text-slate-900',
        headerText: 'text-slate-900',
        headerSubtext: 'text-slate-600',
        bannerTickerBg: 'bg-amber-50/70 text-amber-800 border-amber-200/80',
        bannerIconColor: 'text-amber-500',
        // Trust badges
        trustCardBg: 'bg-white border-slate-200/80 text-slate-800 shadow-xs',
        trustIconBg: 'bg-sky-50 text-sky-600 border border-sky-200',
        trustTitle: 'text-slate-800',
        trustSubtitle: 'text-slate-500',
        // Search & Filters
        filterBarBg: 'bg-white border-slate-300 shadow-sm',
        searchInputBg: 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100',
        pillActive: 'bg-slate-900 text-white shadow-xs',
        pillInactive: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300',
        // Product cards
        productCardBg: 'bg-white border-slate-200/90 hover:border-sky-400/80 hover:shadow-lg hover:shadow-slate-200/60 text-slate-900',
        productImageBg: 'bg-slate-50 border-b border-slate-100',
        productTitle: 'text-slate-900 hover:text-sky-600',
        productCategory: 'text-slate-400',
        productDescription: 'text-slate-500',
        productPrice: 'text-emerald-600 font-black',
        productCategoryBadge: 'bg-white/95 text-slate-800 border-slate-200/80',
        primaryBtn: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold shadow-xs',
        secondaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 font-bold',
        cartBadge: 'bg-emerald-900 text-white',
        // Cart drawer
        cartHeaderBg: 'bg-slate-50/80 border-b border-slate-200 text-slate-900',
        cartDrawerBg: 'bg-white border-l border-slate-200 text-slate-900',
        cartItemBg: 'bg-slate-50 border-slate-200/90 text-slate-900',
        cartCheckoutBtn: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-lg shadow-emerald-500/25',
        // Badges
        officialBadgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs',
        themeAccentName: 'Clásico Moderno (Azul & Esmeralda)',
      };
  }
};

// Default delivery partners for Ecuador / Latin America
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

// Default payment methods for Ecuador
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

const parseCouriers = (raw: any): CourierPartner[] => {
  if (!raw) return DEFAULT_COURIERS;
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return DEFAULT_COURIERS;
};

const parsePayments = (raw: any): PaymentMethodPartner[] => {
  if (!raw) return DEFAULT_PAYMENTS;
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return DEFAULT_PAYMENTS;
};

// Process and optimize uploaded image files for crispness and speed
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

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png', 0.92);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

interface OnlineStoreViewProps {
  products: InventoryItem[];
  orders: CustomerOrder[];
  storeConfig: StoreConfig;
  currentSubTab?: 'catalog' | 'orders' | 'settings';
  onSubTabChange?: (subTab: 'catalog' | 'orders' | 'settings') => void;
  onRefreshProducts: () => void;
  onUpdateStoreConfig: (config: Partial<StoreConfig>) => Promise<boolean>;
  onCreateOrder: (orderData: any) => Promise<{ success: boolean; order?: CustomerOrder; orderNumber?: string }>;
  onUpdateOrder?: (orderId: number, orderData: Partial<CustomerOrder>) => Promise<boolean>;
  onUpdateOrderStatus: (
    orderId: number,
    status: string,
    paymentVoucher?: string,
    notes?: string,
    trackingNumber?: string,
    trackingCarrier?: string,
    trackingNotes?: string
  ) => Promise<boolean>;
  onDeleteOrder: (orderId: number) => Promise<boolean>;
  onOpenConfig?: () => void;
  isSyncing?: boolean;
  currency?: string;
  isCustomerOnly?: boolean;
  onExitCustomerMode?: () => void;
  onGenerateSupplierPurchase?: (order: CustomerOrder) => Promise<void> | void;
  onViewLinkedPurchase?: (purchaseId: number) => void;
}

export const OnlineStoreView: React.FC<OnlineStoreViewProps> = ({
  products,
  orders,
  storeConfig,
  currentSubTab,
  onSubTabChange,
  onRefreshProducts,
  onUpdateStoreConfig,
  onCreateOrder,
  onUpdateOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onOpenConfig,
  isSyncing = false,
  currency = 'USD',
  isCustomerOnly = false,
  onExitCustomerMode,
  onGenerateSupplierPurchase,
  onViewLinkedPurchase,
}) => {
  const { isAdmin, authFetch } = useAuth();

  // Store navigation sub-views (persisted across sessions)
  const [storeTab, setStoreTab] = useState<'catalog' | 'orders' | 'settings'>(() => {
    if (isCustomerOnly) return 'catalog';
    if (currentSubTab) return currentSubTab;
    if (typeof window !== 'undefined') {
      try {
        const saved = safeLocalStorage.getItem('comerxia_store_subtab');
        if (saved === 'catalog' || saved === 'orders' || (saved === 'settings' && isAdmin)) {
          return saved;
        }
      } catch {}
    }
    return 'catalog';
  });

  // Force catalog in customer view
  useEffect(() => {
    if (isCustomerOnly && storeTab !== 'catalog') {
      setStoreTab('catalog');
    }
  }, [isCustomerOnly, storeTab]);

  // Sync with currentSubTab prop if provided
  useEffect(() => {
    if (currentSubTab && currentSubTab !== storeTab && !isCustomerOnly) {
      setStoreTab(currentSubTab);
    }
  }, [currentSubTab, isCustomerOnly]);

  // Handler to switch subtab and notify parent
  const handleSwitchTab = (tab: 'catalog' | 'orders' | 'settings') => {
    setStoreTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
    if (typeof window !== 'undefined' && !isCustomerOnly) {
      try {
        safeLocalStorage.setItem('comerxia_store_subtab', tab);
      } catch {}
    }
  };

  // If user is not admin and tries to view settings, force catalog
  useEffect(() => {
    if (!isAdmin && storeTab === 'settings') {
      handleSwitchTab('catalog');
    }
  }, [isAdmin, storeTab]);

  // Persist storeTab changes in localStorage (unless in forced customer-only mode)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isCustomerOnly) {
      try {
        safeLocalStorage.setItem('comerxia_store_subtab', storeTab);
      } catch {}
    }
  }, [storeTab, isCustomerOnly]);
  const [isCustomerMode, setIsCustomerMode] = useState<boolean>(isCustomerOnly);

  // Sync if isCustomerOnly changes
  React.useEffect(() => {
    if (isCustomerOnly) {
      setIsCustomerMode(true);
      setStoreTab('catalog');
    }
  }, [isCustomerOnly]);

  const isCustomerView = isCustomerOnly || isCustomerMode;

  // Dynamic browser window title:
  // - Customer view (public or preview) -> storeConfig.storeName (from settings)
  // - Administration area -> "Comerxia System"
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCustomerView) {
        document.title = storeConfig?.storeName?.trim() || 'Comerxia Store';
      } else {
        document.title = 'Comerxia System';
      }
    }
  }, [isCustomerView, storeConfig?.storeName]);

  // Track store visit when customer opens the store
  useEffect(() => {
    if (isCustomerView) {
      trackStoreVisit();
    }
  }, [isCustomerView]);

  // Search & Filter state for catalog
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [showOffersOnly, setShowOffersOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');

  // Search & Filter state for orders
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderViewMode, setOrderViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeLocalStorage.getItem('comerxia_orders_view_mode');
        if (saved === 'cards' || saved === 'table') {
          return saved;
        }
      } catch {}
    }
    return 'table';
  });

  // Keep orderViewMode persisted whenever it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        safeLocalStorage.setItem('comerxia_orders_view_mode', orderViewMode);
      } catch {}
    }
  }, [orderViewMode]);

  const [orderDateRangeFilter, setOrderDateRangeFilter] = useState<'all' | 'today' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Delete Order Confirmation Modal state
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState<boolean>(false);

  // Order Confirmation with Payment Voucher Modal state
  const [orderToConfirm, setOrderToConfirm] = useState<CustomerOrder | null>(null);
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [voucherNotesInput, setVoucherNotesInput] = useState<string>('');
  const [isConfirmingOrder, setIsConfirmingOrder] = useState<boolean>(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // ORDER SHIPPING & TRACKING MODAL STATE (Unified with ManageShippingGuideModal)
  const [orderToShip, setOrderToShip] = useState<CustomerOrder | null>(null);
  const [shipTrackingCarrier, setShipTrackingCarrier] = useState<string>('Servientrega');
  const [shipTrackingNumber, setShipTrackingNumber] = useState<string>('');
  const [shipTrackingNotes, setShipTrackingNotes] = useState<string>('');
  const [shipNotifyWhatsApp, setShipNotifyWhatsApp] = useState<boolean>(true);
  const [isShippingOrder, setIsShippingOrder] = useState<boolean>(false);
  const [shipError, setShipError] = useState<string | null>(null);

  // Unified save handler for Shipping Guide, Tracking, CI & Address data
  const handleSaveShippingGuideData = async (
    orderId: number | string,
    data: {
      customerAddress: string;
      customerName?: string;
      customerCi?: string;
      trackingCarrier?: string;
      trackingNumber?: string;
      trackingNotes?: string;
      status?: CustomerOrder['status'];
    }
  ) => {
    if (onUpdateOrder) {
      return await onUpdateOrder(Number(orderId), data);
    } else {
      const target = orders.find((o) => String(o.id) === String(orderId));
      if (!target) return;
      return await onUpdateOrderStatus(
        Number(orderId),
        data.status || target.status,
        target.paymentVoucher || undefined,
        target.notes || undefined,
        data.trackingNumber || undefined,
        data.trackingCarrier || undefined,
        data.trackingNotes || undefined
      );
    }
  };

  // EDIT ORDER MODAL STATE
  const [orderToEdit, setOrderToEdit] = useState<CustomerOrder | null>(null);
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerCi, setEditCustomerCi] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');
  const [editCustomerAddress, setEditCustomerAddress] = useState<string>('');
  const [editDeliveryType, setEditDeliveryType] = useState<'shipping' | 'pickup'>('shipping');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('whatsapp');
  const [editStatus, setEditStatus] = useState<CustomerOrder['status']>('pending');
  const [editPaymentVoucher, setEditPaymentVoucher] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editShippingCost, setEditShippingCost] = useState<string>('0');
  const [editTrackingCarrier, setEditTrackingCarrier] = useState<string>('');
  const [editTrackingNumber, setEditTrackingNumber] = useState<string>('');
  const [editTrackingNotes, setEditTrackingNotes] = useState<string>('');
  const [editItems, setEditItems] = useState<Array<{
    id?: number;
    name: string;
    sku?: string;
    salePrice: number;
    quantity: number;
    imageUrl?: string | null;
  }>>([]);
  const [editProductSearch, setEditProductSearch] = useState<string>('');
  const [isSavingEditOrder, setIsSavingEditOrder] = useState<boolean>(false);
  const [editCustomItemName, setEditCustomItemName] = useState<string>('');
  const [editCustomItemPrice, setEditCustomItemPrice] = useState<string>('');
  const [isAddingCustomEditItem, setIsAddingCustomEditItem] = useState<boolean>(false);

  // QUICK SHIPPING COST & PAYMENT DETAILS MODAL STATE
  const [orderToSetShipping, setOrderToSetShipping] = useState<CustomerOrder | null>(null);
  const [orderForPendingShipping, setOrderForPendingShipping] = useState<CustomerOrder | null>(null);
  const [quickShippingCostInput, setQuickShippingCostInput] = useState<string>('0');
  const [quickShippingCarrierInput, setQuickShippingCarrierInput] = useState<string>('');
  const [selectedQuickPaymentPartnerId, setSelectedQuickPaymentPartnerId] = useState<string>('');
  const [quickShippingPaymentNote, setQuickShippingPaymentNote] = useState<string>('');
  const [isSavingQuickShipping, setIsSavingQuickShipping] = useState<boolean>(false);

  // SHIPPING TICKET PRINT MODAL STATE
  const [orderToPrintShipping, setOrderToPrintShipping] = useState<CustomerOrder | null>(null);

  // REQUEST EXACT SHIPPING DATA VIA WHATSAPP & UPDATE ADDRESS MODAL STATE
  const [orderToRequestShippingData, setOrderToRequestShippingData] = useState<CustomerOrder | null>(null);

  const handleSaveUpdatedShippingAddress = async (
    orderId: number | string,
    updatedData: { customerAddress: string; customerName?: string }
  ) => {
    if (onUpdateOrder) {
      return await onUpdateOrder(Number(orderId), updatedData);
    } else {
      const target = orders.find((o) => String(o.id) === String(orderId));
      if (!target) return false;
      return await onUpdateOrderStatus(
        Number(orderId),
        target.status,
        target.paymentVoucher || undefined,
        target.notes || undefined,
        target.trackingNumber || undefined,
        target.trackingCarrier || undefined,
        target.trackingNotes || undefined
      );
    }
  };

  // MANUAL ORDER CREATION MODAL STATE
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState<boolean>(false);
  const [manualCustomerPhone, setManualCustomerPhone] = useState<string>('');
  const [manualCustomerName, setManualCustomerName] = useState<string>('');
  const [manualCustomerCi, setManualCustomerCi] = useState<string>('');
  const [manualCustomerAddress, setManualCustomerAddress] = useState<string>('');
  const [manualDeliveryType, setManualDeliveryType] = useState<'shipping' | 'pickup'>('shipping');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<string>('whatsapp');
  const [manualPaymentVoucher, setManualPaymentVoucher] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<CustomerOrder['status']>('pending');
  const [manualItems, setManualItems] = useState<Array<{
    id?: number;
    name: string;
    sku?: string;
    salePrice: number;
    quantity: number;
    imageUrl?: string | null;
  }>>([]);
  const [manualProductSearch, setManualProductSearch] = useState<string>('');
  const [isSubmittingManualOrder, setIsSubmittingManualOrder] = useState<boolean>(false);
  const [manualCustomItemName, setManualCustomItemName] = useState<string>('');
  const [manualCustomItemPrice, setManualCustomItemPrice] = useState<string>('');
  const [isAddingCustomManualItem, setIsAddingCustomManualItem] = useState<boolean>(false);

  // CRM Customers list for real-time autocomplete & fast auto-fill
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [matchedCustomerInfo, setMatchedCustomerInfo] = useState<{
    ci: string;
    name: string;
    phone: string;
    address: string;
    source?: string;
  } | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);

  // Fetch CRM customers whenever manual order modal is active
  useEffect(() => {
    if (isManualOrderModalOpen) {
      let isMounted = true;
      const loadCustomers = async () => {
        try {
          const res = await authFetch('/api/customers');
          if (res.ok) {
            const data = await res.json();
            if (isMounted && Array.isArray(data)) {
              setDbCustomers(data);
            }
          }
        } catch (err) {
          console.warn('Error loading customers for autocomplete:', err);
        }
      };
      loadCustomers();
      return () => {
        isMounted = false;
      };
    }
  }, [isManualOrderModalOpen, authFetch]);

  // Combined customer database from CRM and historical orders
  const allKnownCustomers = useMemo(() => {
    const map = new Map<string, { ci: string; name: string; phone: string; address: string; source?: string }>();

    // 1. From database customers table
    if (Array.isArray(dbCustomers)) {
      dbCustomers.forEach((c) => {
        const ciClean = (c.ci || '').trim();
        if (ciClean) {
          map.set(ciClean.toLowerCase(), {
            ci: ciClean,
            name: c.fullName || c.name || '',
            phone: c.phone || '',
            address: c.fullAddress || c.address || '',
            source: 'CRM de Clientes',
          });
        }
      });
    }

    // 2. From historical orders in memory
    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        const ci = getCustomerCi(o);
        if (ci && ci.trim()) {
          const ciKey = ci.trim().toLowerCase();
          const existing = map.get(ciKey);
          if (!existing) {
            map.set(ciKey, {
              ci: ci.trim(),
              name: o.customerName || '',
              phone: o.customerPhone || '',
              address: stripCiFromAddress(o.customerAddress) || o.customerAddress || '',
              source: `Pedido previo #${o.orderNumber || ''}`,
            });
          } else {
            if (!existing.name && o.customerName) existing.name = o.customerName;
            if (!existing.phone && o.customerPhone) existing.phone = o.customerPhone;
            if (!existing.address && o.customerAddress) existing.address = stripCiFromAddress(o.customerAddress);
          }
        }
      });
    }

    return Array.from(map.values());
  }, [dbCustomers, orders]);

  // Matching customer suggestions as user types in CI field
  const matchingCustomerSuggestions = useMemo(() => {
    const clean = manualCustomerCi.trim().toLowerCase();
    const cleanDigits = clean.replace(/\D/g, '');
    if (!clean || clean.length < 2) return [];

    return allKnownCustomers.filter((c) => {
      const cCi = (c.ci || '').toLowerCase();
      const cDigits = cCi.replace(/\D/g, '');
      const cName = (c.name || '').toLowerCase();
      return (
        cCi.includes(clean) ||
        (cleanDigits.length >= 2 && cDigits.includes(cleanDigits)) ||
        cName.includes(clean)
      );
    }).slice(0, 5);
  }, [allKnownCustomers, manualCustomerCi]);

  // Handler for typing Cédula / CI in manual order creation modal
  const handleManualCustomerCiChange = (inputVal: string) => {
    setManualCustomerCi(inputVal);
    const cleanVal = inputVal.trim().toLowerCase();
    const cleanDigits = cleanVal.replace(/\D/g, '');

    if (!cleanVal) {
      setMatchedCustomerInfo(null);
      setShowCustomerSuggestions(false);
      return;
    }

    // Check exact or high-confidence match
    const exactMatch = allKnownCustomers.find((c) => {
      const cCi = (c.ci || '').toLowerCase();
      const cDigits = cCi.replace(/\D/g, '');
      return (
        cCi === cleanVal ||
        (cleanDigits.length >= 8 && cDigits === cleanDigits)
      );
    });

    if (exactMatch && (cleanVal.length >= 8 || cleanDigits.length >= 8)) {
      if (exactMatch.name) setManualCustomerName(exactMatch.name);
      if (exactMatch.phone) setManualCustomerPhone(exactMatch.phone);
      if (exactMatch.address) {
        const addr = exactMatch.address;
        setManualCustomerAddress(addr);
        if (addr.toLowerCase().includes('retiro') || addr.toLowerCase().includes('local')) {
          setManualDeliveryType('pickup');
        } else {
          setManualDeliveryType('shipping');
        }
      }
      setMatchedCustomerInfo(exactMatch);
      setShowCustomerSuggestions(false);
    } else {
      setMatchedCustomerInfo(null);
      if (cleanVal.length >= 2) {
        setShowCustomerSuggestions(true);
      } else {
        setShowCustomerSuggestions(false);
      }
    }
  };

  // Helper when clicking a customer from autocomplete suggestions
  const handleSelectCustomerForManualOrder = (cust: { ci: string; name: string; phone: string; address: string; source?: string }) => {
    setManualCustomerCi(cust.ci);
    if (cust.name) setManualCustomerName(cust.name);
    if (cust.phone) setManualCustomerPhone(cust.phone);
    if (cust.address) {
      setManualCustomerAddress(cust.address);
      if (cust.address.toLowerCase().includes('retiro') || cust.address.toLowerCase().includes('local')) {
        setManualDeliveryType('pickup');
      } else {
        setManualDeliveryType('shipping');
      }
    }
    setMatchedCustomerInfo(cust);
    setShowCustomerSuggestions(false);
    showToast(`✓ Datos del cliente ${cust.name || cust.ci} colocados automáticamente`);
  };

  // Share Store Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Shopping Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cartStep, setCartStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [lastPlacedOrder, setLastPlacedOrder] = useState<any | null>(null);

  // Customer Checkout Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'shipping' | 'pickup'>('shipping');
  const [paymentMethod, setPaymentMethod] = useState<string>('whatsapp');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Helper to open direct WhatsApp chat with customer without pre-filled message
  const handleOpenDirectCustomerWhatsApp = (ord: any) => {
    const norm = normalizeEcuadorPhone(ord.customerPhone);
    if (!norm.whatsappDigits || !norm.isValid) {
      showToast('⚠️ Este pedido no tiene registrado un número de WhatsApp válido del cliente. Puedes ingresarlo editando el pedido.');
      handleOpenEditOrder(ord);
      return;
    }
    const url = buildWhatsAppLink(norm.whatsappDigits);
    window.open(url, '_blank');
  };

  // Helper to open direct WhatsApp with customer with validation & full payment details
  const handleOpenCustomerWhatsApp = (ord: any) => {
    const norm = normalizeEcuadorPhone(ord.customerPhone);
    if (!norm.whatsappDigits || !norm.isValid) {
      showToast('⚠️ Este pedido no tiene registrado un número de WhatsApp válido del cliente. Puedes ingresarlo editando el pedido.');
      handleOpenEditOrder(ord);
      return;
    }
    const activePartners = paymentPartners.filter((p) => p.active !== false);
    const matchedPartner = activePartners.find(
      (p) =>
        p.id === ord.paymentMethod ||
        p.name.toLowerCase() === (ord.paymentMethod || '').toLowerCase() ||
        (ord.paymentMethod && p.name.toLowerCase().includes(ord.paymentMethod.toLowerCase())) ||
        (ord.paymentMethod && ord.paymentMethod.toLowerCase().includes(p.name.toLowerCase()))
    );
    const partnerName = matchedPartner ? matchedPartner.name : (ord.paymentMethod || 'Coordinar con la tienda');
    const isPickup = (ord.customerAddress || '').toLowerCase().includes('retiro');

    let msg = `¡Hola *${ord.customerName || 'estimado cliente'}*! 👋 Me contacto de *${storeConfig.storeName || 'la tienda'}* con respecto a tu *Pedido #${ord.orderNumber}*:\n\n`;
    msg += `💰 *Total del Pedido:* $${Number(ord.totalAmount || 0).toFixed(2)} ${currency}\n`;
    msg += `📍 *Modalidad:* ${isPickup ? 'Retiro en Local' : `Envío: ${ord.customerAddress || 'A convenir'}`}\n`;
    msg += `💳 *Método de Pago:* ${partnerName}\n`;
    if (matchedPartner?.details) {
      msg += `📝 *Datos de la Cuenta / Pago:*\n${matchedPartner.details}\n`;
    }
    if (ord.paymentVoucher) {
      msg += `🧾 *Comprobante Registrado:* ${ord.paymentVoucher}\n`;
    }
    if (ord.trackingNumber || ord.trackingCarrier) {
      msg += `🚚 *Guía de Envío (${ord.trackingCarrier || 'Courier'}):* #${ord.trackingNumber || 'N/A'}\n`;
    }
    msg += `\n¿En qué podemos ayudarte o coordinar el despacho de tu orden? Quedamos atentos. ¡Muchas gracias!`;

    const url = buildWhatsAppLink(norm.whatsappDigits, msg);
    window.open(url, '_blank');
  };

  // Product Quick Detail Modal
  const [quickViewProduct, setQuickViewProduct] = useState<InventoryItem | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [activeMediaMode, setActiveMediaMode] = useState<'photo' | 'video'>('photo');

  // Share Notification Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Store Settings Form State
  const [storeNameInput, setStoreNameInput] = useState(storeConfig.storeName || 'Comerxia Store');
  const [whatsappInput, setWhatsappInput] = useState(storeConfig.whatsappNumber || '');
  const [addressInput, setAddressInput] = useState(storeConfig.address || '');
  const [descriptionInput, setDescriptionInput] = useState(storeConfig.description || '');
  const [bannerTextInput, setBannerTextInput] = useState(storeConfig.bannerText || '');
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(String(storeConfig.deliveryFee ?? '0'));
  const [showStockInput, setShowStockInput] = useState<boolean>(storeConfig.showStock !== false);
  
  // Store Logo, Delivery Partners, and Payment Logos State
  const [storeLogoInput, setStoreLogoInput] = useState<string | null>(storeConfig.logoUrl || null);
  const [courierPartners, setCourierPartners] = useState<CourierPartner[]>(() => parseCouriers(storeConfig.courierLogos));
  const [paymentPartners, setPaymentPartners] = useState<PaymentMethodPartner[]>(() => parsePayments(storeConfig.paymentLogos));
  const [themeInput, setThemeInput] = useState<StoreTheme>(() => (storeConfig.theme as StoreTheme) || 'classic');
  const [themePalettes, setThemePalettes] = useState<Record<string, string[]>>(() => parseThemePalettes(storeConfig.themeColors));

  // Update a specific color in a theme's palette
  const handleUpdateThemeColor = (themeId: StoreTheme, colorIdx: number, newColor: string) => {
    setThemePalettes((prev) => {
      const current = prev[themeId] ? [...prev[themeId]] : [...(DEFAULT_THEME_COLORS[themeId] || DEFAULT_THEME_COLORS.classic)];
      current[colorIdx] = newColor;
      return {
        ...prev,
        [themeId]: current,
      };
    });
    setIsFormDirty(true);
  };

  // Reset a theme's colors to factory defaults
  const handleResetThemeColors = (themeId: StoreTheme) => {
    setThemePalettes((prev) => ({
      ...prev,
      [themeId]: [...(DEFAULT_THEME_COLORS[themeId] || DEFAULT_THEME_COLORS.classic)],
    }));
    setIsFormDirty(true);
    showToast(`✓ Colores de "${THEME_PRESETS.find((p) => p.id === themeId)?.name || themeId}" restaurados por defecto`);
  };

  // Logo Click Animation State (2 seconds duration)
  const [isLogoAnimating, setIsLogoAnimating] = useState<boolean>(false);
  const logoTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    if (logoTimeoutRef.current) {
      clearTimeout(logoTimeoutRef.current);
    }
    setIsLogoAnimating(false);
    // Restart animation cycle
    requestAnimationFrame(() => {
      setIsLogoAnimating(true);
      logoTimeoutRef.current = setTimeout(() => {
        setIsLogoAnimating(false);
      }, 2000);
    });
  };

  // Cleanup logo timeout on unmount
  React.useEffect(() => {
    return () => {
      if (logoTimeoutRef.current) clearTimeout(logoTimeoutRef.current);
    };
  }, []);

  // State for creating new courier partner
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierLogo, setNewCourierLogo] = useState<string | null>(null);
  const [isAddingCourier, setIsAddingCourier] = useState(false);

  // State for creating new payment partner
  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentDetails, setNewPaymentDetails] = useState('');
  const [newPaymentLogo, setNewPaymentLogo] = useState<string | null>(null);
  const [isAddingPayment, setIsAddingPayment] = useState(false);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Sync inputs when storeConfig updates from backend ONLY IF the user hasn't edited the form locally
  React.useEffect(() => {
    if (storeConfig && !isFormDirty) {
      if (storeConfig.storeName !== undefined) setStoreNameInput(storeConfig.storeName || 'Comerxia Store');
      if (storeConfig.whatsappNumber !== undefined) setWhatsappInput(storeConfig.whatsappNumber || '');
      if (storeConfig.address !== undefined) setAddressInput(storeConfig.address || '');
      if (storeConfig.description !== undefined) setDescriptionInput(storeConfig.description || '');
      if (storeConfig.bannerText !== undefined) setBannerTextInput(storeConfig.bannerText || '');
      if (storeConfig.deliveryFee !== undefined) setDeliveryFeeInput(String(storeConfig.deliveryFee ?? '0'));
      if (storeConfig.showStock !== undefined) setShowStockInput(storeConfig.showStock !== false);
      if (storeConfig.logoUrl !== undefined) setStoreLogoInput(storeConfig.logoUrl || null);
      if (storeConfig.courierLogos !== undefined) setCourierPartners(parseCouriers(storeConfig.courierLogos));
      if (storeConfig.paymentLogos !== undefined) setPaymentPartners(parsePayments(storeConfig.paymentLogos));
      if (storeConfig.theme !== undefined) setThemeInput((storeConfig.theme as StoreTheme) || 'classic');
      if (storeConfig.themeColors !== undefined) setThemePalettes(parseThemePalettes(storeConfig.themeColors));
    }
  }, [storeConfig, isFormDirty]);

  // Derived effective theme & active customized color palette
  const activeTheme: StoreTheme = (isFormDirty ? themeInput : (storeConfig.theme as StoreTheme)) || 'classic';
  const activePalette = themePalettes[activeTheme] || DEFAULT_THEME_COLORS[activeTheme] || DEFAULT_THEME_COLORS.classic;
  const themeStyles = useMemo(() => getThemeStyles(activeTheme, activePalette, isCustomerView), [activeTheme, activePalette, isCustomerView]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Safe Clipboard Copy Helper with Fallback for iframes
  const copyTextToClipboard = async (text: string, successMessage = '✓ Enlace copiado al portapapeles') => {
    let copied = false;
    if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText blocked or failed, using fallback', err);
      }
    }
    if (!copied && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.error('execCommand copy failed', e);
      }
    }
    showToast(copied ? successMessage : '✓ Enlace listo para compartir');
  };

  // Build clean customer shareable URL (resolves public ais-pre- domain and custom domains)
  const customerStoreUrl = useMemo(() => {
    return getPublicStoreUrl(storeConfig.domain);
  }, [storeConfig.domain]);

  // Helper to build direct customer product URL
  const getProductShareUrl = (item: InventoryItem) => {
    return getPublicProductUrl(item.id, storeConfig.domain);
  };

  // Helper to share product directly via WhatsApp
  const handleShareProductWhatsApp = (item: InventoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getProductShareUrl(item);
    const storeName = storeConfig.storeName || 'Nuestra Tienda Online';
    const text = `🛍️ ¡Hola! Te comparto este producto de *${storeName}*:\n\n✨ *${item.name}*\n🏷️ SKU: ${item.sku}\n💰 Precio: $${Number(item.salePrice).toFixed(2)} ${currency}\n${item.description ? `📝 ${item.description.slice(0, 90)}${item.description.length > 90 ? '...' : ''}\n` : ''}\n👉 Ver detalles y comprar aquí:\n${url}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // Helper to copy direct product link
  const handleCopyProductLink = (item: InventoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getProductShareUrl(item);
    copyTextToClipboard(url, `✓ Enlace de "${item.name}" copiado`);
  };

  // Auto-detect and open product from URL param (?producto=... or ?product=... or ?sku=...)
  React.useEffect(() => {
    if (typeof window === 'undefined' || !products || products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('producto') || params.get('product') || params.get('p');
    const targetSku = params.get('sku');
    if (targetId) {
      const found = products.find((p) => String(p.id) === String(targetId));
      if (found) {
        setQuickViewProduct(found);
        setActiveImageIdx(0);
      }
    } else if (targetSku) {
      const found = products.find((p) => String(p.sku).toLowerCase() === String(targetSku).toLowerCase());
      if (found) {
        setQuickViewProduct(found);
        setActiveImageIdx(0);
      }
    }
  }, [products]);

  // Track product view when quick view modal or detail opens
  useEffect(() => {
    if (quickViewProduct) {
      trackProductView(quickViewProduct.id, quickViewProduct.name, {
        sku: quickViewProduct.sku,
        category: quickViewProduct.category,
        price: getItemEffectivePrice(quickViewProduct),
      });
    }
  }, [quickViewProduct]);

  // Categories list derived from products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Product counts per category for rich sidebar panels
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.filter((p) => p.status !== 'archived').length };
    products.forEach((p) => {
      if (p.status !== 'archived' && p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered and sorted products (Ofertas / Descuentos first)
  const filteredProducts = useMemo(() => {
    const getEffectivePrice = (p: InventoryItem) => {
      const regular = Number(p.salePrice) || 0;
      const disc = Math.max(0, Math.min(100, Number(p.discountPercent) || 0));
      return disc > 0 ? regular * (1 - disc / 100) : regular;
    };

    const hideOutOfStock = storeConfig && storeConfig.showOutOfStock === false;

    return products
      .filter((p) => {
        // Exclude archived products
        if (p.status === 'archived') return false;

        // In-stock filter (or if store config hides out of stock products)
        if ((inStockOnly || hideOutOfStock) && (p.stock <= 0 || p.status === 'sold_out')) return false;

        // Offers-only filter (active discount > 0)
        if (showOffersOnly) {
          const disc = Math.max(0, Math.min(100, Number(p.discountPercent) || 0));
          if (disc <= 0) return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q) || false;
        const matchTags = p.tags?.toLowerCase().includes(q) || false;
        return matchName || matchSku || matchDesc || matchTags;
      })
      .sort((a, b) => {
        const discA = Math.max(0, Math.min(100, Number(a.discountPercent) || 0));
        const discB = Math.max(0, Math.min(100, Number(b.discountPercent) || 0));
        const hasDiscA = discA > 0;
        const hasDiscB = discB > 0;

        // Prioritize products with active discount percentage
        if (hasDiscA !== hasDiscB) {
          return hasDiscB ? 1 : -1;
        }

        // If both have discounts and sorting is default/featured, sort by highest discount first
        if (hasDiscA && hasDiscB && (!sortBy || sortBy === 'featured')) {
          if (discB !== discA) return discB - discA;
        }

        const priceA = getEffectivePrice(a);
        const priceB = getEffectivePrice(b);

        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'price_desc') return priceB - priceA;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0; // featured default
      });
  }, [products, searchQuery, selectedCategory, inStockOnly, showOffersOnly, sortBy, storeConfig?.showOutOfStock]);

  // Active payment methods configured in store settings
  const activeConfiguredPayments = useMemo(() => {
    const active = paymentPartners.filter((p) => p.active);
    return active.length > 0 ? active : paymentPartners;
  }, [paymentPartners]);

  // Check if an order belongs to the selected date range
  const isOrderInDateRange = (
    orderDateStr: string,
    range: 'all' | 'today' | 'month' | 'custom',
    startStr: string,
    endStr: string
  ) => {
    if (range === 'all') return true;
    if (!orderDateStr) return true;
    const d = new Date(orderDateStr);
    if (isNaN(d.getTime())) return true;

    const now = new Date();

    if (range === 'today') {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }

    if (range === 'month') {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }

    if (range === 'custom') {
      if (startStr) {
        const s = new Date(startStr + 'T00:00:00');
        if (!isNaN(s.getTime()) && d < s) return false;
      }
      if (endStr) {
        const e = new Date(endStr + 'T23:59:59.999');
        if (!isNaN(e.getTime()) && d > e) return false;
      }
      return true;
    }

    return true;
  };

  // Orders filtered by the selected date period
  const periodOrders = useMemo(() => {
    return orders.filter((ord) =>
      isOrderInDateRange(ord.createdAt, orderDateRangeFilter, customStartDate, customEndDate)
    );
  }, [orders, orderDateRangeFilter, customStartDate, customEndDate]);

  // Filtered Orders (Period + Status Filter + Search Filter)
  const filteredOrders = useMemo(() => {
    return periodOrders.filter((ord) => {
      // Status Filter
      if (orderStatusFilter !== 'all' && ord.status !== orderStatusFilter) {
        return false;
      }
      // Search Filter
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const matchNum = (ord.orderNumber || '').toLowerCase().includes(q);
        const matchName = (ord.customerName || '').toLowerCase().includes(q);
        const matchPhone = (ord.customerPhone || '').toLowerCase().includes(q);
        const matchAddress = (ord.customerAddress || '').toLowerCase().includes(q);
        const matchCi = getCustomerCi(ord).toLowerCase().includes(q);
        let matchItem = false;
        if (Array.isArray(ord.items)) {
          matchItem = ord.items.some(
            (it: any) =>
              (it.name || it.item?.name || '').toLowerCase().includes(q) ||
              (it.sku || it.item?.sku || '').toLowerCase().includes(q)
          );
        }
        return matchNum || matchName || matchPhone || matchAddress || matchCi || matchItem;
      }
      return true;
    });
  }, [periodOrders, orderStatusFilter, orderSearchQuery]);

  // Order Counts within selected period
  const orderCounts = useMemo(() => {
    const counts = {
      all: periodOrders.length,
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    periodOrders.forEach((o) => {
      if (o.status in counts) {
        counts[o.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [periodOrders]);

  // Comprehensive Sales & Financial Metrics for selected period
  const orderMetrics = useMemo(() => {
    let totalSalesVolume = 0;
    let pendingSalesVolume = 0;
    let confirmedSalesVolume = 0;
    let shippedSalesVolume = 0;
    let deliveredSalesVolume = 0;
    let cancelledSalesVolume = 0;
    let nonCancelledCount = 0;

    const paymentMap: Record<string, { name: string; count: number; total: number }> = {};

    periodOrders.forEach((o) => {
      const amt = Number(o.totalAmount) || 0;
      if (o.status !== 'cancelled') {
        totalSalesVolume += amt;
        nonCancelledCount++;

        const rawMethod = (o.paymentMethod || 'Otros').trim();
        if (!paymentMap[rawMethod]) {
          paymentMap[rawMethod] = { name: rawMethod, count: 0, total: 0 };
        }
        paymentMap[rawMethod].count += 1;
        paymentMap[rawMethod].total += amt;
      }

      if (o.status === 'pending') pendingSalesVolume += amt;
      if (o.status === 'confirmed') confirmedSalesVolume += amt;
      if (o.status === 'shipped') shippedSalesVolume += amt;
      if (o.status === 'delivered') deliveredSalesVolume += amt;
      if (o.status === 'cancelled') cancelledSalesVolume += amt;
    });

    const averageTicket = nonCancelledCount > 0 ? totalSalesVolume / nonCancelledCount : 0;
    const paymentBreakdown = Object.values(paymentMap).sort((a, b) => b.total - a.total);

    return {
      totalSalesVolume,
      pendingSalesVolume,
      confirmedSalesVolume,
      shippedSalesVolume,
      deliveredSalesVolume,
      cancelledSalesVolume,
      totalOrdersCount: periodOrders.length,
      nonCancelledCount,
      averageTicket,
      paymentBreakdown,
    };
  }, [periodOrders]);

  // Visual Payment Method Badge with dedicated Icons & Logos
  const renderPaymentBadge = (methodStr: string, partners: PaymentMethodPartner[]) => {
    const rawMethod = (methodStr || '').trim();
    const norm = rawMethod.toLowerCase();

    // Look for matching partner in paymentPartners
    const matchedPartner = partners.find(
      (p) =>
        p.name.toLowerCase() === norm ||
        p.id.toLowerCase() === norm ||
        norm.includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(norm)
    );

    let iconElement = <CreditCard className="w-3.5 h-3.5" />;
    let badgeClasses = 'bg-sky-950/70 text-sky-300 border-sky-800/60';
    let label = rawMethod || 'No especificado';
    let logoImg = matchedPartner?.logoUrl;

    if (norm.includes('whatsapp') || norm.includes('wsp') || norm === 'whatsapp') {
      iconElement = <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
      badgeClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70';
      label = 'WhatsApp / Acuerdo';
    } else if (norm.includes('contraentrega') || norm.includes('efectivo') || norm.includes('cash') || norm === 'contraentrega') {
      iconElement = <Banknote className="w-3.5 h-3.5 text-amber-400" />;
      badgeClasses = 'bg-amber-950/80 text-amber-300 border-amber-700/70';
      label = 'Efectivo / Contraentrega';
    } else if (norm.includes('pichincha') || norm.includes('vecino')) {
      iconElement = <Building2 className="w-3.5 h-3.5 text-yellow-400" />;
      badgeClasses = 'bg-yellow-950/80 text-yellow-300 border-yellow-700/70';
      label = 'Banco Pichincha';
    } else if (norm.includes('guayaquil') || norm.includes('barrio')) {
      iconElement = <Landmark className="w-3.5 h-3.5 text-pink-400" />;
      badgeClasses = 'bg-pink-950/80 text-pink-300 border-pink-700/70';
      label = 'Banco Guayaquil';
    } else if (norm.includes('deuna') || norm.includes('qr')) {
      iconElement = <QrCode className="w-3.5 h-3.5 text-teal-300" />;
      badgeClasses = 'bg-teal-950/80 text-teal-200 border-teal-700/70';
      label = 'Deuna / Pago QR';
    } else if (norm.includes('zelle')) {
      iconElement = <Wallet className="w-3.5 h-3.5 text-purple-300" />;
      badgeClasses = 'bg-purple-950/80 text-purple-200 border-purple-700/70';
      label = 'Zelle USD';
    } else if (norm.includes('tarjeta') || norm.includes('visa') || norm.includes('mastercard') || norm.includes('credito') || norm.includes('debito')) {
      iconElement = <CreditCard className="w-3.5 h-3.5 text-indigo-300" />;
      badgeClasses = 'bg-indigo-950/80 text-indigo-200 border-indigo-700/70';
      label = 'Tarjeta Débito/Crédito';
    } else if (norm.includes('transferencia') || norm.includes('deposito') || norm.includes('banco') || norm.includes('produbanco') || norm.includes('pacifico')) {
      iconElement = <Landmark className="w-3.5 h-3.5 text-sky-400" />;
      badgeClasses = 'bg-sky-950/80 text-sky-300 border-sky-700/70';
      label = rawMethod;
    }

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold shadow-xs ${badgeClasses}`}>
        {logoImg ? (
          <div className="w-5 h-5 rounded-md bg-white border border-slate-300 p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={logoImg} alt={label} className="w-full h-full object-contain" />
          </div>
        ) : (
          <span className="flex-shrink-0">{iconElement}</span>
        )}
        <span className="truncate max-w-[190px] font-medium">{label}</span>
      </div>
    );
  };

  // Confirm delete order handler
  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      const ok = await onDeleteOrder(orderToDelete.id);
      if (ok) {
        showToast(`✓ Pedido #${orderToDelete.orderNumber} eliminado correctamente`);
        setOrderToDelete(null);
      } else {
        showToast('No se pudo eliminar el pedido');
      }
    } catch (err) {
      showToast('Error al eliminar el pedido');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Confirm order with payment voucher (mandatory for non-cash, optional for cash)
  const handleConfirmOrderWithVoucher = async (sendWhatsApp: boolean = false) => {
    if (!orderToConfirm) return;
    const isCash = isCashPayment(orderToConfirm.paymentMethod);
    if (!isCash && !voucherInput.trim()) {
      setVoucherError('Debes ingresar el número de comprobante de pago o transferencia antes de confirmar el pedido.');
      return;
    }
    setIsConfirmingOrder(true);
    setVoucherError(null);
    try {
      const voucherToSave = voucherInput.trim() || (isCash ? 'EFECTIVO - PAGO CONTRAENTREGA' : 'CONFIRMADO');
      const ok = await onUpdateOrderStatus(
        orderToConfirm.id,
        'confirmed',
        voucherToSave,
        voucherNotesInput.trim() || (isCash ? 'Pago en efectivo verificado/acordado' : undefined)
      );
      if (ok) {
        showToast(`✓ Pedido #${orderToConfirm.orderNumber} confirmado ${isCash ? 'con pago en efectivo' : `con comprobante: ${voucherInput.trim()}`}`);

        if (sendWhatsApp) {
          const norm = normalizeEcuadorPhone(orderToConfirm.customerPhone);
          if (norm.whatsappDigits && norm.isValid) {
            const activePartners = paymentPartners.filter((p) => p.active !== false);
            const matchedPartner = activePartners.find(
              (p) =>
                p.id === orderToConfirm.paymentMethod ||
                p.name.toLowerCase() === (orderToConfirm.paymentMethod || '').toLowerCase() ||
                (orderToConfirm.paymentMethod && p.name.toLowerCase().includes(orderToConfirm.paymentMethod.toLowerCase())) ||
                (orderToConfirm.paymentMethod && orderToConfirm.paymentMethod.toLowerCase().includes(p.name.toLowerCase()))
            );
            const partnerName = matchedPartner ? matchedPartner.name : (orderToConfirm.paymentMethod || 'Coordinar');
            const partnerDetails = matchedPartner?.details?.trim();
            const isPickup = (orderToConfirm.customerAddress || '').toLowerCase().includes('retiro');

            let msg = `¡Hola *${orderToConfirm.customerName || 'estimado cliente'}*! 👋\n\n`;
            msg += `¡Excelente noticia! Tu *Pedido #${orderToConfirm.orderNumber}* en *${storeConfig.storeName || 'nuestra tienda'}* ha sido *CONFIRMADO* con éxito.\n\n`;
            msg += `💰 *Total del Pedido:* $${Number(orderToConfirm.totalAmount).toFixed(2)} ${currency}\n`;
            msg += `📍 *Modalidad:* ${isPickup ? 'Retiro en Local' : `Envío: ${orderToConfirm.customerAddress || 'A convenir'}`}\n`;
            msg += `💳 *Método de Pago:* ${partnerName}\n`;
            if (partnerDetails) {
              msg += `📝 *Datos de la Cuenta:* \n${partnerDetails}\n`;
            }
            if (voucherToSave) {
              msg += `🧾 *Comprobante Registrado:* ${voucherToSave}\n`;
            }
            if (voucherNotesInput.trim()) {
              msg += `📌 *Nota:* ${voucherNotesInput.trim()}\n`;
            }
            msg += `\nEstamos preparando tu pedido para despacharlo. ¡Muchas gracias por tu compra!`;

            const link = buildWhatsAppLink(norm.whatsappDigits, msg);
            window.open(link, '_blank');
          }
        }

        setOrderToConfirm(null);
      } else {
        setVoucherError('No se pudo confirmar el pedido. Verifique los datos e intente nuevamente.');
      }
    } catch (err: any) {
      setVoucherError(err.message || 'Error al confirmar el pedido');
    } finally {
      setIsConfirmingOrder(false);
    }
  };

  // Open Order Shipping Modal
  const handleOpenShipOrder = (ord: CustomerOrder) => {
    setOrderToShip(ord);
    const activeCarrier = courierPartners.find((c) => c.active !== false);
    setShipTrackingCarrier(ord.trackingCarrier || activeCarrier?.name || 'Servientrega');
    setShipTrackingNumber(ord.trackingNumber || '');
    setShipTrackingNotes(ord.trackingNotes || '');
    setShipNotifyWhatsApp(true);
    setShipError(null);
  };

  // Confirm shipping transition with tracking info
  const handleConfirmOrderToShip = async (sendWhatsApp = true) => {
    if (!orderToShip) return;
    if (!shipTrackingCarrier.trim()) {
      setShipError('Debes seleccionar o ingresar la empresa de transporte / courier.');
      return;
    }
    if (!shipTrackingNumber.trim()) {
      setShipError('Debes ingresar el número de seguimiento / guía de la empresa seleccionada para marcar como enviado.');
      return;
    }

    setIsShippingOrder(true);
    setShipError(null);
    try {
      const ok = await onUpdateOrderStatus(
        orderToShip.id,
        'shipped',
        orderToShip.paymentVoucher || undefined,
        orderToShip.notes || undefined,
        shipTrackingNumber.trim(),
        shipTrackingCarrier.trim(),
        shipTrackingNotes.trim() || undefined
      );

      if (ok) {
        showToast(`✓ Pedido #${orderToShip.orderNumber} marcado como ENVIADO por ${shipTrackingCarrier.trim()}`);

        // Send tracking info via WhatsApp if requested
        if (sendWhatsApp) {
          const norm = normalizeEcuadorPhone(orderToShip.customerPhone);
          if (norm.whatsappDigits && norm.isValid) {
            const isPickup = (orderToShip.customerAddress || '').toLowerCase().includes('retiro');
            const activePartners = paymentPartners.filter((p) => p.active !== false);
            const matchedPartner = activePartners.find(
              (p) =>
                p.id === orderToShip.paymentMethod ||
                p.name.toLowerCase() === (orderToShip.paymentMethod || '').toLowerCase() ||
                (orderToShip.paymentMethod && p.name.toLowerCase().includes(orderToShip.paymentMethod.toLowerCase())) ||
                (orderToShip.paymentMethod && orderToShip.paymentMethod.toLowerCase().includes(p.name.toLowerCase()))
            );
            const partnerName = matchedPartner ? matchedPartner.name : (orderToShip.paymentMethod || 'Coordinar con la tienda');

            let shipMsg = `¡Hola *${orderToShip.customerName || 'Cliente'}*! 🚚\n\n`;
            shipMsg += `Te informamos que tu pedido *#${orderToShip.orderNumber}* en *${storeConfig.storeName || 'nuestra tienda'}* ha sido *ENVIADO / DESPACHADO* con éxito.\n\n`;
            shipMsg += `📦 *Empresa de Transporte / Courier:* ${shipTrackingCarrier.trim()}\n`;
            shipMsg += `🔍 *N° de Guía / Tracking:* ${shipTrackingNumber.trim()}\n`;
            if (shipTrackingNotes.trim()) {
              shipMsg += `📝 *Detalle de Entrega / Seguimiento:* ${shipTrackingNotes.trim()}\n`;
            }
            if (orderToShip.customerAddress && !isPickup) {
              shipMsg += `📍 *Dirección de Destino:* ${orderToShip.customerAddress}\n`;
            }
            shipMsg += `💰 *Total del Pedido:* $${Number(orderToShip.totalAmount).toFixed(2)} ${currency}\n`;
            shipMsg += `💳 *Método de Pago:* ${partnerName}\n`;
            if (orderToShip.paymentVoucher) {
              shipMsg += `🧾 *Comprobante Registrado:* ${orderToShip.paymentVoucher}\n`;
            }
            shipMsg += `\n¡Muchas gracias por tu compra! Quedamos a tu disposición para cualquier consulta.`;

            const link = buildWhatsAppLink(norm.whatsappDigits, shipMsg);
            window.open(link, '_blank');
          }
        }

        setOrderToShip(null);
      } else {
        setShipError('No se pudo actualizar el estado a enviado. Intenta nuevamente.');
      }
    } catch (err: any) {
      setShipError(err.message || 'Error al actualizar el estado de envío');
    } finally {
      setIsShippingOrder(false);
    }
  };

  // Open Edit Order Modal
  const handleOpenEditOrder = (ord: CustomerOrder) => {
    setOrderToEdit(ord);
    setEditCustomerName(ord.customerName || '');
    setEditCustomerPhone(ord.customerPhone || '');
    setEditCustomerCi(getCustomerCi(ord) || '');
    setEditCustomerAddress(stripCiFromAddress(ord.customerAddress) || '');
    const isPickup = (ord.customerAddress || '').toLowerCase().includes('retiro') || (ord.customerAddress || '').toLowerCase().includes('local');
    setEditDeliveryType(isPickup ? 'pickup' : 'shipping');
    setEditPaymentMethod(ord.paymentMethod || 'whatsapp');
    setEditStatus(ord.status || 'pending');
    setEditPaymentVoucher(ord.paymentVoucher || '');
    setEditNotes(ord.notes || '');
    setEditTrackingCarrier(isPickup ? '' : (ord.trackingCarrier || ''));
    setEditTrackingNumber(isPickup ? '' : (ord.trackingNumber || ''));
    setEditTrackingNotes(isPickup ? '' : (ord.trackingNotes || ''));

    // Parse items into array
    const parsed = Array.isArray(ord.items)
      ? ord.items.map((it: any) => ({
          id: it.id || it.item?.id,
          name: it.name || it.item?.name || 'Producto',
          sku: it.sku || it.item?.sku || '',
          salePrice: Number(it.salePrice || it.item?.salePrice || 0),
          quantity: Number(it.quantity || 1),
          imageUrl: it.imageUrl || it.item?.imageUrl || null,
        }))
      : [];
    setEditItems(parsed);

    // Calculate initial shipping fee from order total - items subtotal
    const sub = parsed.reduce((acc, it) => acc + (Number(it.salePrice) * Number(it.quantity)), 0);
    const tot = Number(ord.totalAmount) || 0;
    const diff = tot - sub;
    setEditShippingCost(isPickup ? '0' : (diff > 0.01 ? diff.toFixed(2) : '0'));

    setEditProductSearch('');
    setIsAddingCustomEditItem(false);
  };

  // Open Quick Shipping Cost Modal
  const handleOpenShippingCost = (ord: CustomerOrder) => {
    setOrderToSetShipping(ord);
    const items = Array.isArray(ord.items) ? ord.items : [];
    const itemsSub = items.reduce((acc: number, it: any) => acc + (Number(it.salePrice || it.item?.salePrice || 0) * (Number(it.quantity) || 1)), 0);
    const currentTot = Number(ord.totalAmount) || 0;
    const currentShip = currentTot - itemsSub;
    setQuickShippingCostInput(currentShip > 0.01 ? currentShip.toFixed(2) : String(storeConfig.deliveryFee || '0'));
    setQuickShippingCarrierInput(ord.trackingCarrier || courierPartners.find((c) => c.active !== false)?.name || 'Servientrega');

    // Automatically match the order's payment method with configured payment partners
    const activePartners = paymentPartners.filter((p) => p.active !== false);
    const matched = activePartners.find(
      (p) =>
        p.name.toLowerCase() === (ord.paymentMethod || '').toLowerCase() ||
        p.id.toLowerCase() === (ord.paymentMethod || '').toLowerCase() ||
        (ord.paymentMethod || '').toLowerCase().includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes((ord.paymentMethod || '').toLowerCase())
    );
    setSelectedQuickPaymentPartnerId(matched ? matched.id : (activePartners[0]?.id || ''));
    setQuickShippingPaymentNote('');
  };

  // Save Quick Shipping Cost and Send to WhatsApp with complete Payment Method details
  const handleSaveQuickShipping = async (sendWhatsApp = true) => {
    if (!orderToSetShipping) return;
    setIsSavingQuickShipping(true);
    try {
      const items = Array.isArray(orderToSetShipping.items) ? orderToSetShipping.items : [];
      const itemsSub = items.reduce((acc: number, it: any) => acc + (Number(it.salePrice || it.item?.salePrice || 0) * (Number(it.quantity) || 1)), 0);
      const shipCost = Math.max(0, Number(quickShippingCostInput) || 0);
      const newTotal = itemsSub + shipCost;
      const carrierName = quickShippingCarrierInput.trim() || orderToSetShipping.trackingCarrier || 'Courier';

      const payload: Partial<CustomerOrder> = {
        totalAmount: String(newTotal.toFixed(2)),
        trackingCarrier: carrierName,
      };

      if (onUpdateOrder) {
        await onUpdateOrder(orderToSetShipping.id, payload);
      } else {
        await onUpdateOrderStatus(
          orderToSetShipping.id,
          orderToSetShipping.status,
          orderToSetShipping.paymentVoucher || undefined,
          orderToSetShipping.notes || undefined,
          orderToSetShipping.trackingNumber || undefined,
          carrierName
        );
      }

      showToast(`✓ Valor de envío ($${shipCost.toFixed(2)}) asignado al pedido #${orderToSetShipping.orderNumber}`);

      if (sendWhatsApp) {
        const norm = normalizeEcuadorPhone(orderToSetShipping.customerPhone);
        if (norm.whatsappDigits && norm.isValid) {
          const activePartners = paymentPartners.filter((p) => p.active !== false);
          const currentPartner = activePartners.find((p) => p.id === selectedQuickPaymentPartnerId) || activePartners[0];
          const isCash = isCashPayment(orderToSetShipping.paymentMethod) || (currentPartner && isCashPayment(currentPartner.name));

          const itemsBreakdown = items.map((it: any) => `• ${it.quantity || 1}x ${it.name || it.item?.name} ($${it.salePrice || it.item?.salePrice})`).join('\n');

          let msg = `¡Hola *${orderToSetShipping.customerName || 'estimado cliente'}*! 👋\n\n`;
          msg += `Te compartimos el valor de envío y los datos para tu *Pedido #${orderToSetShipping.orderNumber}* en *${storeConfig.storeName || 'nuestra tienda'}*:\n\n`;
          msg += `📦 *Detalle de Productos:*\n${itemsBreakdown || '• Productos varios'}\n`;
          msg += `💵 *Subtotal:* $${itemsSub.toFixed(2)} ${currency}\n`;
          msg += `🚚 *Valor de Envío (${carrierName}):* $${shipCost.toFixed(2)} ${currency}\n`;
          msg += `💰 *TOTAL A PAGAR:* $${newTotal.toFixed(2)} ${currency}\n\n`;
          if (orderToSetShipping.customerAddress) {
            msg += `📍 *Dirección de Entrega:* ${orderToSetShipping.customerAddress}\n\n`;
          }

          msg += `💳 *Método de Pago Seleccionado:* ${currentPartner ? currentPartner.name : orderToSetShipping.paymentMethod}\n`;
          if (currentPartner?.details) {
            msg += `📝 *Datos de la Cuenta / Pago:* \n${currentPartner.details}\n\n`;
          }
          if (quickShippingPaymentNote.trim()) {
            msg += `📌 *Nota adicional:* ${quickShippingPaymentNote.trim()}\n\n`;
          }

          if (isCash) {
            msg += `💵 *Modalidad:* Pago en efectivo / contraentrega acordado al recibir tu paquete.`;
          } else {
            msg += `📲 *Importante:* Una vez realizada la transferencia o depósito, por favor envíanos la foto o captura del comprobante por aquí para confirmar tu pedido y procesar el despacho de inmediato. ¡Muchas gracias!`;
          }

          const link = buildWhatsAppLink(norm.whatsappDigits, msg);
          window.open(link, '_blank');
        }
      }

      setOrderToSetShipping(null);
    } catch (err: any) {
      showToast('❌ Error al guardar valor de envío: ' + (err.message || 'Error'));
    } finally {
      setIsSavingQuickShipping(false);
    }
  };

  // Filter products for adding in Edit Modal
  const filteredProductsForEdit = useMemo(() => {
    if (!editProductSearch.trim()) return products.slice(0, 8);
    const q = editProductSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [products, editProductSearch]);

  // Filter products for adding in Manual Order Modal
  const filteredProductsForManual = useMemo(() => {
    if (!manualProductSearch.trim()) return products.slice(0, 8);
    const q = manualProductSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [products, manualProductSearch]);

  // Edit subtotal
  const editSubtotal = useMemo(() => {
    return editItems.reduce((acc, it) => acc + (Number(it.salePrice) * Number(it.quantity)), 0);
  }, [editItems]);

  // Edit total including shipping cost
  const editTotal = useMemo(() => {
    const ship = editDeliveryType === 'shipping' ? Math.max(0, Number(editShippingCost) || 0) : 0;
    return editSubtotal + ship;
  }, [editSubtotal, editShippingCost, editDeliveryType]);

  // Manual order subtotal
  const manualSubtotal = useMemo(() => {
    return manualItems.reduce((acc, it) => acc + (Number(it.salePrice) * Number(it.quantity)), 0);
  }, [manualItems]);

  // Save Edit Order
  const handleSaveEditOrder = async (notifyViaWhatsApp = false) => {
    if (!orderToEdit) return;
    if (!editCustomerPhone.trim()) {
      showToast('⚠️ Ingresa el número de WhatsApp o teléfono del cliente');
      return;
    }
    if (editItems.length === 0) {
      showToast('⚠️ El pedido debe incluir al menos 1 producto');
      return;
    }

    setIsSavingEditOrder(true);
    try {
      const isPickup = editDeliveryType === 'pickup';
      const cleanedInputAddress = stripCiFromAddress(editCustomerAddress).trim();
      const finalAddress = isPickup
        ? (cleanedInputAddress || 'Retiro en Local')
        : (cleanedInputAddress || 'Envío a Domicilio');
      const totalAmount = editTotal;
      const normPhone = normalizeEcuadorPhone(editCustomerPhone);
      const cleanPhone = normPhone.formattedLocal || normPhone.local || editCustomerPhone.trim();

      const updatePayload: Partial<CustomerOrder> = {
        customerName: editCustomerName.trim() || 'Cliente WhatsApp',
        customerPhone: cleanPhone,
        customerCi: editCustomerCi.trim() || null,
        ci: editCustomerCi.trim() || null,
        customerAddress: finalAddress,
        paymentMethod: editPaymentMethod || 'whatsapp',
        status: editStatus,
        paymentVoucher: editPaymentVoucher.trim() || null,
        notes: editNotes.trim() || null,
        trackingCarrier: isPickup ? null : (editTrackingCarrier.trim() || null),
        trackingNumber: isPickup ? null : (editTrackingNumber.trim() || null),
        trackingNotes: isPickup ? null : (editTrackingNotes.trim() || null),
        items: editItems as any,
        totalAmount: String(totalAmount.toFixed(2)),
      };

      if (onUpdateOrder) {
        const ok = await onUpdateOrder(orderToEdit.id, updatePayload);
        if (!ok) throw new Error('No se pudo actualizar en el servidor');
      } else {
        await onUpdateOrderStatus(
          orderToEdit.id,
          editStatus,
          editPaymentVoucher || undefined,
          editNotes || undefined,
          isPickup ? undefined : (editTrackingNumber.trim() || undefined),
          isPickup ? undefined : (editTrackingCarrier.trim() || undefined),
          isPickup ? undefined : (editTrackingNotes.trim() || undefined)
        );
      }

      showToast(`✓ Pedido #${orderToEdit.orderNumber} actualizado exitosamente`);

      if (notifyViaWhatsApp) {
        if (!normPhone.whatsappDigits || !normPhone.isValid) {
          showToast('⚠️ No se abrió WhatsApp porque el número registrado no es válido.');
        } else {
          const activePartners = paymentPartners.filter((p) => p.active !== false);
          const matchedPartner = activePartners.find(
            (p) =>
              p.id === editPaymentMethod ||
              p.name.toLowerCase() === (editPaymentMethod || '').toLowerCase() ||
              (editPaymentMethod && p.name.toLowerCase().includes(editPaymentMethod.toLowerCase())) ||
              (editPaymentMethod && editPaymentMethod.toLowerCase().includes(p.name.toLowerCase()))
          );
          const partnerName = matchedPartner ? matchedPartner.name : (editPaymentMethod || 'Coordinar con la tienda');
          const partnerDetails = matchedPartner?.details?.trim();
          const isCash = isCashPayment(editPaymentMethod) || (matchedPartner && isCashPayment(matchedPartner.name));

          let msg = `¡Hola *${editCustomerName.trim() || 'estimado cliente'}*! 👋\n\n`;
          msg += `Te compartimos la actualización de tu *Pedido #${orderToEdit.orderNumber}* en *${storeConfig.storeName || 'nuestra tienda'}*:\n\n`;
          msg += `📦 *Detalle Actualizado de Productos:*\n`;
          editItems.forEach((it) => {
            msg += `• ${it.quantity}x ${it.name} ($${(Number(it.salePrice) * Number(it.quantity)).toFixed(2)})\n`;
          });
          msg += `\n`;

          if (isPickup) {
            msg += `🏢 *Modalidad de Entrega:* Retiro en Local / Tienda (${finalAddress})\n`;
            msg += `💰 *TOTAL A PAGAR:* $${totalAmount.toFixed(2)} ${currency}\n`;
          } else {
            msg += `💵 *Subtotal:* $${editSubtotal.toFixed(2)} ${currency}\n`;
            if (Number(editShippingCost) > 0) {
              msg += `🚚 *Valor de Envío:* $${Number(editShippingCost).toFixed(2)} ${currency}\n`;
            }
            msg += `💰 *TOTAL A PAGAR:* $${totalAmount.toFixed(2)} ${currency}\n`;
            msg += `📍 *Dirección de Entrega:* ${finalAddress}\n`;
            if (editTrackingCarrier.trim() || editTrackingNumber.trim()) {
              msg += `🚚 *Seguimiento Envío:* ${editTrackingCarrier.trim() || 'Courier'} - Guía #${editTrackingNumber.trim() || 'N/A'}\n`;
            }
          }

          msg += `\n💳 *Método de Pago:* ${partnerName}\n`;
          if (partnerDetails) {
            msg += `📝 *Datos para el Pago / Transferencia:*\n${partnerDetails}\n\n`;
          }
          if (editPaymentVoucher.trim()) {
            msg += `🧾 *N° Comprobante Registrado:* ${editPaymentVoucher.trim()}\n`;
          }
          if (editNotes.trim()) {
            msg += `📌 *Observaciones:* ${editNotes.trim()}\n`;
          }

          if (isCash) {
            msg += `\n💵 *Modalidad:* Pago en efectivo acordado al recibir o retirar tu pedido.`;
          } else if (editStatus === 'confirmed' && editPaymentVoucher.trim()) {
            msg += `\n✅ *Estado del Pago:* Comprobante verificado y registrado. Procederemos con la preparación y despacho.`;
          } else {
            msg += `\n📲 *Instrucción de Pago:* Por favor realiza el pago o transferencia con los datos indicados y envíanos la foto o captura del comprobante por aquí para despachar tu pedido. ¡Muchas gracias!`;
          }

          const waLink = buildWhatsAppLink(normPhone.whatsappDigits, msg);
          window.open(waLink, '_blank');
        }
      }

      setOrderToEdit(null);
    } catch (err: any) {
      console.error('Error saving edited order:', err);
      showToast('❌ Error al actualizar el pedido: ' + (err.message || 'Error'));
    } finally {
      setIsSavingEditOrder(false);
    }
  };

  // Save Manual Order
  const handleSaveManualOrder = async (notifyViaWhatsApp = false) => {
    if (!manualCustomerPhone.trim()) {
      showToast('⚠️ Ingresa el número de WhatsApp o teléfono del cliente');
      return;
    }
    if (manualItems.length === 0) {
      showToast('⚠️ Agrega al menos 1 producto al detalle del pedido');
      return;
    }

    setIsSubmittingManualOrder(true);
    try {
      const finalAddress = manualDeliveryType === 'pickup' ? 'Retiro en Local' : (manualCustomerAddress.trim() || 'Envío a Domicilio');
      const totalAmount = manualSubtotal;
      const normPhone = normalizeEcuadorPhone(manualCustomerPhone);
      const cleanPhone = normPhone.formattedLocal || normPhone.local || manualCustomerPhone.trim();

      const orderPayload = {
        customerName: manualCustomerName.trim() || 'Cliente WhatsApp',
        customerPhone: cleanPhone,
        customerCi: manualCustomerCi.trim() || undefined,
        ci: manualCustomerCi.trim() || undefined,
        customerAddress: finalAddress,
        paymentMethod: manualPaymentMethod || 'whatsapp',
        status: manualStatus,
        paymentVoucher: manualPaymentVoucher.trim() || undefined,
        notes: manualNotes.trim() || undefined,
        items: manualItems,
        totalAmount,
        decrementStock: true,
      };

      const result = await onCreateOrder(orderPayload);

      if (result.success) {
        const orderNum = result.orderNumber || result.order?.orderNumber || 'PED-REC';
        
        // If status or voucher were not handled in createOrder, update it as fallback
        if (result.order?.id && (manualStatus !== 'pending' || manualPaymentVoucher.trim()) && result.order?.status !== manualStatus) {
          await onUpdateOrderStatus(
            result.order.id,
            manualStatus,
            manualPaymentVoucher.trim() || undefined,
            manualNotes.trim() || undefined
          );
        }

        showToast(`✓ Pedido manual #${orderNum} creado exitosamente`);

        if (notifyViaWhatsApp) {
          if (!normPhone.whatsappDigits || !normPhone.isValid) {
            showToast('⚠️ No se abrió WhatsApp porque el número registrado no es válido.');
          } else {
            const activePartners = paymentPartners.filter((p) => p.active !== false);
            const matchedPartner = activePartners.find(
              (p) =>
                p.id === manualPaymentMethod ||
                p.name.toLowerCase() === (manualPaymentMethod || '').toLowerCase() ||
                (manualPaymentMethod && p.name.toLowerCase().includes(manualPaymentMethod.toLowerCase())) ||
                (manualPaymentMethod && manualPaymentMethod.toLowerCase().includes(p.name.toLowerCase()))
            );
            const partnerName = matchedPartner ? matchedPartner.name : (manualPaymentMethod || 'Coordinar con la tienda');
            const partnerDetails = matchedPartner?.details?.trim();
            const isPickup = (finalAddress || '').toLowerCase().includes('retiro');
            const isCash = isCashPayment(manualPaymentMethod) || (matchedPartner && isCashPayment(matchedPartner.name));

            let msg = `¡Hola *${manualCustomerName.trim() || 'estimado cliente'}*! 👋 Tu pedido ha sido registrado con éxito en *${storeConfig.storeName}*:\n\n`;
            msg += `📋 *N° Pedido:* #${orderNum}\n`;
            msg += `📦 *Detalle de Productos:*\n`;
            manualItems.forEach((it) => {
              msg += `• ${it.quantity}x ${it.name} - $${(it.salePrice * it.quantity).toFixed(2)}\n`;
            });
            msg += `\n💰 *Total:* $${totalAmount.toFixed(2)} ${currency}\n`;
            msg += `📍 *Modalidad:* ${isPickup ? 'Retiro en Local' : `Envío: ${finalAddress}`}\n`;
            msg += `💳 *Método de Pago:* ${partnerName}\n`;
            if (partnerDetails) {
              msg += `📝 *Datos para el Pago / Transferencia:*\n${partnerDetails}\n\n`;
            }
            if (manualPaymentVoucher.trim()) {
              msg += `🧾 *Comprobante:* ${manualPaymentVoucher.trim()}\n`;
            }
            if (manualNotes.trim()) {
              msg += `📌 *Nota:* ${manualNotes.trim()}\n`;
            }

            if (isCash) {
              msg += `\n💵 *Modalidad:* Pago en efectivo acordado al recibir o retirar tu pedido.`;
            } else if (manualStatus === 'confirmed' && manualPaymentVoucher.trim()) {
              msg += `\n✅ *Estado del Pago:* Comprobante verificado y registrado.`;
            } else {
              msg += `\n📲 *Instrucción de Pago:* Por favor realiza el pago o transferencia con los datos indicados y envíanos la foto o captura del comprobante por aquí para despachar tu pedido. ¡Muchas gracias!`;
            }

            const waLink = buildWhatsAppLink(normPhone.whatsappDigits, msg);
            window.open(waLink, '_blank');
          }
        }

        // Reset manual order form
        setManualCustomerPhone('');
        setManualCustomerName('');
        setManualCustomerAddress('');
        setManualDeliveryType('shipping');
        setManualPaymentMethod('whatsapp');
        setManualPaymentVoucher('');
        setManualNotes('');
        setManualStatus('pending');
        setManualItems([]);
        setManualProductSearch('');
        setIsManualOrderModalOpen(false);
      } else {
        showToast('❌ No se pudo crear el pedido');
      }
    } catch (err: any) {
      console.error('Error creating manual order:', err);
      showToast('❌ Error al crear el pedido manual: ' + (err.message || 'Error'));
    } finally {
      setIsSubmittingManualOrder(false);
    }
  };

  // Helper to compute effective item sale price factoring discountPercent
  const getItemEffectivePrice = (item: InventoryItem): number => {
    const regular = Number(item.salePrice) || 0;
    const disc = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
    return disc > 0 ? regular * (1 - disc / 100) : regular;
  };

  // Cart operations
  const cartTotalItems = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + getItemEffectivePrice(it.item) * it.quantity, 0);
  }, [cart]);

  const deliveryFee = deliveryType === 'shipping' ? Number(storeConfig.deliveryFee || 0) : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  const handleAddToCart = (item: InventoryItem, qty: number = 1) => {
    const isOutOfStock = item.stock <= 0 || item.status === 'sold_out';
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        const newQty = isOutOfStock
          ? existing.quantity + qty
          : Math.min(item.stock, existing.quantity + qty);
        return prev.map((ci) => (ci.item.id === item.id ? { ...ci, quantity: newQty } : ci));
      } else {
        const initialQty = isOutOfStock ? Math.max(1, qty) : Math.min(item.stock, Math.max(1, qty));
        return [...prev, { item, quantity: initialQty }];
      }
    });
    trackAddToCart(item.id, item.name, qty, getItemEffectivePrice(item));
    if (isOutOfStock) {
      showToast(`✓ Agregado bajo pedido: ${item.name}`);
    } else {
      showToast(`✓ Agregado al carrito: ${item.name}`);
    }
  };

  const handleUpdateCartQty = (itemId: number, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
    } else {
      setCart((prev) =>
        prev.map((ci) => {
          if (ci.item.id === itemId) {
            const isOutOfStock = ci.item.stock <= 0 || ci.item.status === 'sold_out';
            const capped = isOutOfStock ? newQty : Math.min(ci.item.stock, newQty);
            return { ...ci, quantity: capped };
          }
          return ci;
        })
      );
    }
  };

  const handleRemoveFromCart = (itemId: number) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  // WhatsApp Order Text Formatter (using 100% compatible WhatsApp characters)
  const generateWhatsAppOrderText = (orderNum?: string) => {
    const store = storeConfig.storeName || 'Comerxia Store';
    const num = orderNum || `PED-${Date.now().toString().slice(-6)}`;
    const phoneNorm = normalizeEcuadorPhone(customerPhone);
    const displayPhone = phoneNorm.local
      ? `${phoneNorm.local} (${phoneNorm.international})`
      : customerPhone;

    const activePartners = paymentPartners.filter((p) => p.active !== false);
    const matchedPartner = activePartners.find(
      (p) =>
        p.id === paymentMethod ||
        p.name.toLowerCase() === paymentMethod.toLowerCase() ||
        (paymentMethod && p.name.toLowerCase().includes(paymentMethod.toLowerCase())) ||
        (paymentMethod && paymentMethod.toLowerCase().includes(p.name.toLowerCase()))
    );
    const partnerName = matchedPartner ? matchedPartner.name : paymentMethod.toUpperCase();

    const hasOutOfStockItems = cart.some(
      (ci) => ci.item.stock <= 0 || ci.item.status === 'sold_out'
    );

    let text = `🛒 *NUEVO PEDIDO - ${store.toUpperCase()}*\n`;
    text += `*Pedido:* #${num}\n`;
    if (hasOutOfStockItems) {
      text += `🟣 *ESTADO:* 🔍 Consultando al proveedor la disponibilidad (Bajo Pedido)\n`;
    }
    text += `--------------------------------\n`;
    text += `👤 *Cliente:* ${customerName.trim() || 'Cliente'}\n`;
    text += `📱 *Teléfono:* ${displayPhone}\n`;
    text += `📍 *Entrega:* ${deliveryType === 'shipping' ? `Envío a domicilio (${customerAddress.trim()})` : 'Retiro en local'}\n`;
    text += `💳 *Método de Pago:* ${partnerName}\n`;
    if (matchedPartner?.details) {
      text += `📝 *Datos de Pago:* ${matchedPartner.details}\n`;
    }
    text += `--------------------------------\n`;
    text += `📦 *PRODUCTOS:*\n`;

    cart.forEach((ci) => {
      const isOut = ci.item.stock <= 0 || ci.item.status === 'sold_out';
      const regular = Number(ci.item.salePrice) || 0;
      const disc = Math.max(0, Math.min(100, Number(ci.item.discountPercent) || 0));
      const effective = disc > 0 ? regular * (1 - disc / 100) : regular;
      const itemSub = (effective * ci.quantity).toFixed(2);
      const stockBadge = isOut ? ' 🟣 [Bajo Pedido]' : ' 🟢 [En Bodega]';

      if (disc > 0) {
        text += `- *${ci.quantity}x* ${ci.item.name}${stockBadge} (SKU: ${ci.item.sku})\n  🔥 *OFERTA -${disc}%*: $${effective.toFixed(2)} ${currency} (Antes ~$${regular.toFixed(2)}~) | Subtotal: $${itemSub}\n`;
      } else {
        text += `- *${ci.quantity}x* ${ci.item.name}${stockBadge} (SKU: ${ci.item.sku})\n  Precio: $${effective.toFixed(2)} ${currency} | Subtotal: $${itemSub}\n`;
      }
    });

    text += `--------------------------------\n`;
    text += `Subtotal: $${cartSubtotal.toFixed(2)} ${currency}\n`;
    if (deliveryFee > 0) {
      text += `Costo de Envio: $${deliveryFee.toFixed(2)} ${currency}\n`;
    }
    text += `💰 *TOTAL A PAGAR: $${cartTotal.toFixed(2)} ${currency}*\n`;

    if (orderNotes.trim()) {
      text += `--------------------------------\n`;
      text += `📝 *Notas:* ${orderNotes.trim()}\n`;
    }
    text += `--------------------------------\n`;
    if (hasOutOfStockItems) {
      text += `¡Hola! Acabo de registrar este pedido en su tienda online. Contiene artículos bajo encargo / pedido. ¿Podrían confirmarme la disponibilidad con el proveedor para coordinar la entrega? Muchas gracias.`;
    } else {
      text += `¡Hola! Acabo de armar este pedido en su tienda online. ¿Podrían confirmarme la disponibilidad para coordinar la entrega? Muchas gracias.`;
    }

    return text;
  };

  // Send Order via WhatsApp Direct
  const handleSendViaWhatsApp = async () => {
    setCheckoutError(null);

    if (!customerName.trim()) {
      setCheckoutError('Por favor ingresa tu Nombre y Apellido para identificarte en el pedido.');
      showToast('⚠️ Completa tu Nombre y Apellido');
      return;
    }

    if (!customerPhone.trim()) {
      setCheckoutError('Por favor ingresa tu número de WhatsApp para poder coordinar la entrega y confirmación.');
      showToast('⚠️ Ingresa tu número de WhatsApp');
      return;
    }

    const phoneNorm = normalizeEcuadorPhone(customerPhone);
    if (!phoneNorm.isValid && phoneNorm.whatsappDigits.length < 8) {
      setCheckoutError('El número de WhatsApp ingresado parece inválido. Ingresa un número de celular de Ecuador (ej. 0983302390 o +593983302390).');
      showToast('⚠️ Número de WhatsApp no válido');
      return;
    }

    const normalizedLocal = phoneNorm.formattedLocal || phoneNorm.local || customerPhone.trim();

    setIsSubmittingOrder(true);
    try {
      // 1. Register order in database with normalized phone
      const result = await onCreateOrder({
        customerName: customerName.trim(),
        customerPhone: normalizedLocal,
        customerAddress: deliveryType === 'shipping' ? customerAddress.trim() : 'Retiro en Local',
        items: cart.map((ci) => {
          const effectivePrice = getItemEffectivePrice(ci.item);
          return {
            id: ci.item.id,
            name: ci.item.name,
            sku: ci.item.sku,
            salePrice: effectivePrice,
            quantity: ci.quantity,
            imageUrl: ci.item.imageUrl,
          };
        }),
        totalAmount: cartTotal,
        paymentMethod,
        notes: orderNotes.trim(),
      });

      const orderNumber = result.orderNumber || result.order?.orderNumber || `PED-${Date.now().toString().slice(-6)}`;
      setLastPlacedOrder({
        orderNumber,
        customerName,
        customerPhone: normalizedLocal,
        customerAddress,
        items: cart,
        totalAmount: cartTotal,
        date: new Date().toLocaleString('es-ES'),
      });

      // 2. Format message and open direct WhatsApp to store
      const rawText = generateWhatsAppOrderText(orderNumber);
      const waUrl = buildWhatsAppLink(storeConfig.whatsappNumber, rawText);

      trackWhatsAppClick(cartTotal, cartTotalItems, orderNumber);

      window.open(waUrl, '_blank');

      // 3. Clear cart and show confirmation screen
      setCart([]);
      setCheckoutError(null);
      setCartStep('success');
      onRefreshProducts();
    } catch (err: any) {
      console.error('Error sending order:', err);
      setCheckoutError('Hubo un error al procesar el pedido. Intenta nuevamente.');
      showToast('❌ Error al procesar pedido: ' + (err.message || 'Error'));
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Direct buy product (adds to cart & opens cart drawer directly to purchase like the cart buy button)
  const handleDirectBuyProduct = (item: InventoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isOutOfStock = item.stock <= 0 || item.status === 'sold_out';
    // Add item to cart if not already present, or increment
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (!existing) {
        return [...prev, { item, quantity: 1 }];
      }
      return prev;
    });
    trackAddToCart(item.id, item.name, 1, getItemEffectivePrice(item));
    setCartStep('cart');
    setIsCartOpen(true);
    if (quickViewProduct) {
      setQuickViewProduct(null);
    }
    if (isOutOfStock) {
      showToast(`✓ Agregado bajo pedido. Verificando con proveedor.`);
    } else {
      showToast(`✓ ${item.name} agregado. Listo para comprar`);
    }
  };

  // Save Store Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    try {
      const normStore = normalizeEcuadorPhone(whatsappInput);
      const formattedStorePhone = normStore.international || whatsappInput.trim();

      const ok = await onUpdateStoreConfig({
        storeName: storeNameInput.trim() || 'Comerxia Store',
        whatsappNumber: formattedStorePhone,
        address: addressInput.trim(),
        description: descriptionInput.trim(),
        bannerText: bannerTextInput.trim(),
        deliveryFee: Number(deliveryFeeInput) || 0,
        showStock: showStockInput,
        logoUrl: storeLogoInput,
        courierLogos: courierPartners,
        paymentLogos: paymentPartners,
        theme: themeInput,
        themeColors: themePalettes,
      });
      if (ok) {
        setIsFormDirty(false);
        showToast('✓ Configuración, estilo visual, logos, envíos y pagos guardados correctamente');
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Parse photos for product
  const getProductPhotos = (item: InventoryItem): string[] => {
    const list: string[] = [];
    if (item.imageUrl) list.push(item.imageUrl);
    if (item.extractedAttributes) {
      try {
        const parsed = JSON.parse(item.extractedAttributes);
        if (Array.isArray(parsed.images)) {
          parsed.images.forEach((img: string) => {
            if (img && !list.includes(img)) list.push(img);
          });
        }
      } catch {}
    }
    return list;
  };

  return (
    <div className={`space-y-6 animate-fadeIn pb-16 ${isCustomerView && activeTheme === 'boutique' ? 'text-zinc-100' : ''}`}>
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Customer Preview Notification (Only shown when merchant toggles preview inside admin) */}
      {!isCustomerOnly && isCustomerMode && (
        <div className="bg-amber-950/80 border border-amber-500/50 rounded-2xl p-3 sm:p-4 text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-2 text-xs">
            <Eye className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Modo Vista Previa de Cliente:</strong> Así es como tus compradores experimentan la tienda. Los clientes <strong>no ven</strong> opciones ni datos de administración.
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => {
                copyTextToClipboard(customerStoreUrl, '✓ Enlace de clientes copiado');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Enlace Clientes</span>
            </button>
            <button
              onClick={() => {
                if (onExitCustomerMode) onExitCustomerMode();
                setIsCustomerMode(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs"
            >
              Salir de Vista Previa
            </button>
          </div>
        </div>
      )}

      {/* VIEW: 1. CATALOG OF PRODUCTS (Dynamic Themed Layouts per Theme) */}
      {storeTab === 'catalog' && (
        <StoreThemedCatalog
          props={{
            products,
            filteredProducts,
            categories,
            categoryCounts,
            selectedCategory,
            setSelectedCategory,
            searchQuery,
            setSearchQuery,
            inStockOnly,
            setInStockOnly,
            showOffersOnly,
            setShowOffersOnly,
            sortBy,
            setSortBy,
            cart,
            cartTotalItems,
            onAddToCart: handleAddToCart,
            onUpdateCartQty: handleUpdateCartQty,
            onDirectBuyProduct: handleDirectBuyProduct,
            onShareProductWhatsApp: handleShareProductWhatsApp,
            onCopyProductLink: handleCopyProductLink,
            onQuickViewProduct: (item) => {
              setQuickViewProduct(item);
              setActiveImageIdx(0);
              const photos = getProductPhotos(item);
              if (photos.length === 0 && item.videoUrl) {
                setActiveMediaMode('video');
              } else {
                setActiveMediaMode('photo');
              }
            },
            storeConfig: {
              ...storeConfig,
              theme: activeTheme,
              themeColors: themePalettes,
            },
            courierPartners,
            paymentPartners,
            activeTheme,
            activePalette,
            themeColors: themePalettes,
            themeStyles,
            currency,
            isCustomerView,
            isCustomerOnly,
            isCustomerMode,
            storeTab,
            setStoreTab,
            orders,
            isLogoAnimating,
            onLogoClick: handleLogoClick,
            onOpenCart: () => {
              setCartStep('cart');
              setIsCartOpen(true);
            },
            onOpenShareModal: () => setIsShareModalOpen(true),
          }}
        />
      )}

      {/* VIEW: 2. ORDERS MANAGEMENT (Orders Dashboard) */}
      {storeTab === 'orders' && !isCustomerOnly && !isCustomerMode && (
        <div className="space-y-5">
          {/* DATE RANGE FILTER & FINANCIAL SALES SUMMARY BAR */}
          <div className="bg-white border border-slate-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs font-black text-slate-900">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Filtrar Ventas por Fecha / Período:</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  Consulta las métricas y balance de ingresos según el día, mes o rango personalizado.
                </p>
              </div>

              {/* Date Filter Buttons */}
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5 text-xs">
                <button
                  onClick={() => setOrderDateRangeFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer ${
                    orderDateRangeFilter === 'all'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-800 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  Todo el Historial
                </button>

                <button
                  onClick={() => setOrderDateRangeFilter('today')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center space-x-1 ${
                    orderDateRangeFilter === 'today'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-800 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Hoy (Día)</span>
                </button>

                <button
                  onClick={() => setOrderDateRangeFilter('month')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center space-x-1 ${
                    orderDateRangeFilter === 'month'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-800 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Este Mes</span>
                </button>

                <button
                  onClick={() => setOrderDateRangeFilter('custom')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center space-x-1 ${
                    orderDateRangeFilter === 'custom'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-800 hover:text-slate-950 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Personalizada</span>
                </button>
              </div>
            </div>

            {/* Custom Date Inputs if Custom is selected */}
            {orderDateRangeFilter === 'custom' && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-700 font-bold">Desde:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-sky-500 shadow-xs font-bold"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-700 font-bold">Hasta:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-sky-500 shadow-xs font-bold"
                  />
                </div>

                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold transition cursor-pointer"
                  >
                    Limpiar Rango
                  </button>
                )}
              </div>
            )}

            {/* Financial Summary Highlight Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Total Sales */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                    Ventas Totales ({orderDateRangeFilter === 'today' ? 'Hoy' : orderDateRangeFilter === 'month' ? 'Este Mes' : orderDateRangeFilter === 'custom' ? 'Rango' : 'Historial'})
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-emerald-800 font-mono">
                    ${orderMetrics.totalSalesVolume.toFixed(2)}
                  </span>
                  <span className="text-xs text-emerald-700 font-bold">{currency}</span>
                </div>
                <p className="text-[10px] text-slate-600 font-medium">
                  Total de {orderMetrics.nonCancelledCount} pedido(s) activos
                </p>
              </div>

              {/* Card 2: Confirmed Orders Metric & Value */}
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-300 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider">
                    Pedidos Confirmados
                  </span>
                  <Receipt className="w-4 h-4 text-purple-700" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-purple-800 font-mono">
                    ${orderMetrics.confirmedSalesVolume.toFixed(2)}
                  </span>
                  <span className="text-xs text-purple-700 font-bold">
                    ({orderCounts.confirmed} confirmados)
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 font-medium">
                  Con comprobante de pago verificado
                </p>
              </div>

              {/* Card 3: Delivered Orders Metric & Value */}
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-300 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-teal-900 uppercase tracking-wider">
                    Pedidos Entregados
                  </span>
                  <BadgeCheck className="w-4 h-4 text-teal-700" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-teal-800 font-mono">
                    ${orderMetrics.deliveredSalesVolume.toFixed(2)}
                  </span>
                  <span className="text-xs text-teal-700 font-bold">
                    ({orderCounts.delivered} entregados)
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 font-medium">
                  Cobrados y completados satisfactoriamente
                </p>
              </div>

              {/* Card 4: Ticket Promedio & Envíos */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
                    Ticket Promedio
                  </span>
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    ${orderMetrics.averageTicket.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-600 font-bold">{currency} / pedido</span>
                </div>
                <p className="text-[10px] text-slate-600 font-medium">
                  {orderCounts.shipped > 0 ? `${orderCounts.shipped} pedido(s) en tránsito / despacho` : 'Promedio general por orden'}
                </p>
              </div>
            </div>

            {/* Breakdown of Sales by Payment Method in selected period */}
            {orderMetrics.paymentBreakdown.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Desglose de Ingresos por Método de Pago en el Período:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
                  {orderMetrics.paymentBreakdown.map((pm, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-xs"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-semibold text-slate-700">{pm.name}:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ${pm.total.toFixed(2)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-medium">
                        {pm.count} {pm.count === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics KPI Cards (5-Status Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Orders Card */}
            <div
              onClick={() => setOrderStatusFilter('all')}
              className={`p-3.5 rounded-2xl border space-y-1 cursor-pointer transition relative overflow-hidden ${
                orderStatusFilter === 'all'
                  ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-400'
                  : 'bg-white border-slate-200 hover:border-sky-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Total Período</span>
                <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Package className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-slate-900 font-mono">{orderCounts.all}</span>
                <span className="text-xs text-slate-500 font-mono">
                  ${orderMetrics.totalSalesVolume.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Pending Orders Card */}
            <div
              onClick={() => setOrderStatusFilter('pending')}
              className={`p-3.5 rounded-2xl border space-y-1 cursor-pointer transition relative overflow-hidden ${
                orderStatusFilter === 'pending'
                  ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-400'
                  : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  {orderCounts.pending > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  Pendientes
                </span>
                <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-amber-700 font-mono">{orderCounts.pending}</span>
                <span className="text-xs text-amber-600 font-mono">
                  ${orderMetrics.pendingSalesVolume.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Confirmed Orders Card */}
            <div
              onClick={() => setOrderStatusFilter('confirmed')}
              className={`p-3.5 rounded-2xl border space-y-1 cursor-pointer transition relative overflow-hidden ${
                orderStatusFilter === 'confirmed'
                  ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-400'
                  : 'bg-white border-slate-200 hover:border-purple-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider">Confirmados</span>
                <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-purple-700 font-mono">{orderCounts.confirmed}</span>
                <span className="text-xs text-purple-600 font-mono">
                  ${orderMetrics.confirmedSalesVolume.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Shipped Orders Card */}
            <div
              onClick={() => setOrderStatusFilter('shipped')}
              className={`p-3.5 rounded-2xl border space-y-1 cursor-pointer transition relative overflow-hidden ${
                orderStatusFilter === 'shipped'
                  ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
                  : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Enviados</span>
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Truck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-blue-700 font-mono">{orderCounts.shipped}</span>
                <span className="text-xs text-blue-600 font-mono">
                  ${orderMetrics.shippedSalesVolume.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Delivered Orders Card */}
            <div
              onClick={() => setOrderStatusFilter('delivered')}
              className={`p-3.5 rounded-2xl border space-y-1 cursor-pointer transition relative overflow-hidden ${
                orderStatusFilter === 'delivered'
                  ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-400'
                  : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Entregados</span>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <BadgeCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-emerald-700 font-mono">{orderCounts.delivered}</span>
                <span className="text-xs text-emerald-600 font-mono">
                  ${orderMetrics.deliveredSalesVolume.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Header & Quick Action Buttons (Repositioned above search & filter panel) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Gestión de Pedidos Recibidos
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    {orders.length} pedidos
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Monitorea tus ventas por fecha, confirma comprobantes de pago y coordina el despacho de compras.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <button
                onClick={() => {
                  setManualCustomerCi('');
                  setManualCustomerPhone('');
                  setManualCustomerName('');
                  setManualCustomerAddress('');
                  setMatchedCustomerInfo(null);
                  setShowCustomerSuggestions(false);
                  setManualDeliveryType('shipping');
                  setManualPaymentMethod(activeConfiguredPayments[0]?.name || 'whatsapp');
                  setManualPaymentVoucher('');
                  setManualNotes('');
                  setManualStatus('pending');
                  setManualItems([]);
                  setManualProductSearch('');
                  setIsManualOrderModalOpen(true);
                }}
                className="inline-flex items-center px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span>+ Crear Pedido Manual</span>
              </button>

              <button
                onClick={() => onRefreshProducts()}
                className="inline-flex items-center px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:text-slate-900 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Orders Filter, Search Bar & View Mode Switcher */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setOrderStatusFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ${
                    orderStatusFilter === 'all'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${orderStatusFilter === 'all' ? 'bg-white text-sky-900 font-bold' : 'bg-slate-200 text-slate-700'}`}>
                    {orderCounts.all}
                  </span>
                </button>

                <button
                  onClick={() => setOrderStatusFilter('pending')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ${
                    orderStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : orderCounts.pending > 0
                      ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 ring-2 ring-amber-400/40 shadow-2xs'
                      : 'bg-slate-50 text-amber-700 hover:text-amber-900 hover:bg-amber-50/50 border border-slate-200'
                  }`}
                >
                  <Clock className={`w-3 h-3 ${orderCounts.pending > 0 ? 'text-amber-600 animate-pulse' : ''}`} />
                  <span>Pendientes</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${orderStatusFilter === 'pending' ? 'bg-white text-amber-900' : 'bg-amber-200/90 text-amber-950'}`}>
                    {orderCounts.pending}
                  </span>
                </button>

                <button
                  onClick={() => setOrderStatusFilter('confirmed')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ${
                    orderStatusFilter === 'confirmed'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-50 text-purple-700 hover:text-purple-900 hover:bg-purple-50/50 border border-slate-200'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  <span>Confirmados</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${orderStatusFilter === 'confirmed' ? 'bg-white text-purple-900 font-bold' : 'bg-purple-100 text-purple-800'}`}>
                    {orderCounts.confirmed}
                  </span>
                </button>

                <button
                  onClick={() => setOrderStatusFilter('shipped')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ${
                    orderStatusFilter === 'shipped'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-blue-700 hover:text-blue-900 hover:bg-blue-50/50 border border-slate-200'
                  }`}
                >
                  <Truck className="w-3 h-3" />
                  <span>Enviados</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${orderStatusFilter === 'shipped' ? 'bg-white text-blue-900 font-bold' : 'bg-blue-100 text-blue-800'}`}>
                    {orderCounts.shipped}
                  </span>
                </button>

                <button
                  onClick={() => setOrderStatusFilter('delivered')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ${
                    orderStatusFilter === 'delivered'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-50 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50/50 border border-slate-200'
                  }`}
                >
                  <BadgeCheck className="w-3 h-3" />
                  <span>Entregados</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${orderStatusFilter === 'delivered' ? 'bg-white text-emerald-900 font-bold' : 'bg-emerald-100 text-emerald-800'}`}>
                    {orderCounts.delivered}
                  </span>
                </button>

                <button
                  onClick={() => setOrderStatusFilter('cancelled')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ${
                    orderStatusFilter === 'cancelled'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-50 text-rose-700 hover:text-rose-900 hover:bg-rose-50/50 border border-slate-200'
                  }`}
                >
                  <X className="w-3 h-3" />
                  <span>Cancelados</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${orderStatusFilter === 'cancelled' ? 'bg-white text-rose-900 font-bold' : 'bg-rose-100 text-rose-800'}`}>
                    {orderCounts.cancelled}
                  </span>
                </button>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 p-1 rounded-xl flex-shrink-0">
                <button
                  onClick={() => setOrderViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    orderViewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vista en Tarjetas"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Tarjetas</span>
                </button>

                <button
                  onClick={() => setOrderViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    orderViewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vista en Lista / Tabla"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>
            </div>

            {/* Search Input for Orders */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Buscar pedido por # orden, cédula de cliente, nombre, teléfono o producto..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition"
              />
              {orderSearchQuery && (
                <button
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Orders List / Table Container */}
          {periodOrders.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center space-y-3 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center mx-auto">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No hay pedidos en el período seleccionado</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No se encontraron ventas para este filtro de fecha. Puedes seleccionar "Todo el Historial" para consultar todos los pedidos recibidos.
              </p>
              <button
                onClick={() => {
                  setOrderDateRangeFilter('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sky-700 text-xs font-bold border border-slate-200 transition cursor-pointer"
              >
                Ver Todo el Historial
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-2 shadow-xs">
              <Filter className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No hay pedidos que coincidan con los filtros</h3>
              <p className="text-xs text-slate-500">
                Prueba cambiando el estado seleccionado o borrando el término de búsqueda.
              </p>
              <button
                onClick={() => {
                  setOrderStatusFilter('all');
                  setOrderSearchQuery('');
                }}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sky-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
              >
                Restablecer filtros
              </button>
            </div>
          ) : orderViewMode === 'table' ? (
            <OrdersTableView
              orders={filteredOrders}
              storeConfig={storeConfig}
              paymentPartners={paymentPartners}
              currency={currency}
              onOpenEditOrder={handleOpenEditOrder}
              onOpenConfirmVoucher={(ord) => {
                setOrderToConfirm(ord);
                setVoucherInput(ord.paymentVoucher || '');
                setVoucherNotesInput(ord.notes || '');
                setVoucherError(null);
              }}
              onOpenShipOrder={handleOpenShipOrder}
              onOpenShippingCost={handleOpenShippingCost}
              onOpenPendingShipping={(ord) => setOrderForPendingShipping(ord)}
              onOpenPrintShippingTicket={(ord) => setOrderToPrintShipping(ord)}
              onOpenRequestShippingData={(ord) => setOrderToRequestShippingData(ord)}
              onUpdateStatus={async (orderId, status, voucher, notes, trackingNumber, trackingCarrier, trackingNotes) => {
                await onUpdateOrderStatus(orderId, status, voucher, notes, trackingNumber, trackingCarrier, trackingNotes);
              }}
              onDeleteOrder={(ord) => setOrderToDelete(ord)}
              showToast={showToast}
              buildWhatsAppLink={buildWhatsAppLink}
              renderPaymentBadge={renderPaymentBadge}
              onGenerateSupplierPurchase={onGenerateSupplierPurchase}
              onViewLinkedPurchase={onViewLinkedPurchase}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((ord) => {
                const itemsCount = Array.isArray(ord.items)
                  ? ord.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0)
                  : 0;

                const statusBadgeConfig = (() => {
                  switch (ord.status) {
                    case 'delivered':
                      return {
                        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        icon: <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />,
                        label: 'Entregado',
                      };
                    case 'shipped':
                      return {
                        bg: 'bg-blue-50 text-blue-800 border-blue-200',
                        icon: <Truck className="w-3.5 h-3.5 text-blue-600" />,
                        label: 'Enviado',
                      };
                    case 'confirmed':
                      return {
                        bg: 'bg-purple-50 text-purple-800 border-purple-200',
                        icon: <Receipt className="w-3.5 h-3.5 text-purple-600" />,
                        label: 'Confirmado',
                      };
                    case 'cancelled':
                      return {
                        bg: 'bg-rose-50 text-rose-800 border-rose-200',
                        icon: <X className="w-3.5 h-3.5 text-rose-600" />,
                        label: 'Cancelado',
                      };
                    default:
                      return {
                        bg: 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white border-amber-300 font-black shadow-md halo-badge-beacon tracking-wide',
                        icon: <Clock className="w-3.5 h-3.5 text-white animate-pulse" />,
                        label: '⚡ PENDIENTE DE ATENCIÓN',
                      };
                  }
                })();

                const isPickup = (ord.customerAddress || '').toLowerCase().includes('retiro');
                const isPending = ord.status === 'pending';

                return (
                  <div
                    key={ord.id}
                    className={`rounded-2xl p-4 sm:p-5 transition space-y-4 relative ${
                      isPending
                        ? 'bg-amber-50/40 border-2 border-amber-500 halo-pending-card'
                        : 'bg-white border border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {isPending && (
                      <div className="absolute -top-3.5 right-4 z-20 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 text-white font-black text-[10px] sm:text-[11px] tracking-wider uppercase shadow-lg halo-badge-beacon flex items-center gap-1.5 border-2 border-white">
                        <span className="w-2 h-2 rounded-full bg-white halo-dot-pulse flex-shrink-0" />
                        <span>🔔 NUEVO PEDIDO POR ATENDER</span>
                      </div>
                    )}
                    {/* Top Header: Order Number & Status & Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <div className={`flex items-center space-x-1.5 border px-2.5 py-1 rounded-xl ${
                          isPending
                            ? 'bg-amber-100/80 border-amber-300 ring-1 ring-amber-400/40'
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          {isPending && (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-amber-500 halo-dot-pulse flex-shrink-0"
                              title="Pedido pendiente de atención"
                            />
                          )}
                          <span className={`font-mono font-black text-xs sm:text-sm ${
                            isPending ? 'text-amber-950' : 'text-sky-700'
                          }`}>
                            #{ord.orderNumber}
                          </span>
                          <button
                            onClick={() => {
                              copyTextToClipboard(ord.orderNumber || '', '✓ Número de orden copiado');
                            }}
                            className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-0.5"
                            title="Copiar número de orden"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase flex items-center space-x-1.5 ${statusBadgeConfig.bg}`}>
                          {statusBadgeConfig.icon}
                          <span>{statusBadgeConfig.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500">
                        <span className="flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {new Date(ord.createdAt).toLocaleString('es-ES')}
                        </span>
                      </div>
                    </div>

                    {/* BARRA DE ACCIONES DEL PEDIDO (LIMPIA Y OPTIMIZADA POR ESTADO) */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                      {ord.status === 'pending' ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <button
                            onClick={() => setOrderForPendingShipping(ord)}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs active:scale-95"
                            title="Gestionar servicio de envío, cotizaciones, plantillas de WhatsApp y comprobante"
                          >
                            <Truck className="w-4 h-4 text-sky-200" />
                            <span>Gestionar Servicio de Envío</span>
                          </button>
                        </div>
                      ) : ord.status === 'confirmed' ? (
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                          {/* 1° BOTÓN DIRECTO DE WHATSAPP */}
                          <button
                            onClick={() => handleOpenDirectCustomerWhatsApp(ord)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                              normalizeEcuadorPhone(ord.customerPhone).isValid
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                            title={
                              normalizeEcuadorPhone(ord.customerPhone).isValid
                                ? 'Abrir chat de WhatsApp directamente con el cliente (sin mensaje)'
                                : 'Sin WhatsApp registrado - Clic para registrar número'
                            }
                          >
                            <MessageCircle className={`w-3.5 h-3.5 ${normalizeEcuadorPhone(ord.customerPhone).isValid ? 'text-white' : 'text-amber-600'}`} />
                            <span>
                              {normalizeEcuadorPhone(ord.customerPhone).isValid
                                ? 'WhatsApp'
                                : 'Añadir Tel.'}
                            </span>
                          </button>

                          {isPickup ? (
                            <button
                              onClick={async () => {
                                await onUpdateOrderStatus(
                                  ord.id,
                                  'delivered',
                                  ord.paymentVoucher || undefined,
                                  ord.notes || undefined
                                );
                                showToast(`✓ Pedido #${ord.orderNumber} marcado como ENTREGADO en local`);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                              title="Marcar como Entregado en Local"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Entregar en Local</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenShipOrder(ord)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                              title="Gestionar Guía de Envío, Dirección, Cédula y Tracking"
                            >
                              <Truck className="w-3.5 h-3.5 text-blue-100" />
                              <span>Gestionar Guía</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                          {/* 1° BOTÓN DIRECTO DE WHATSAPP */}
                          <button
                            onClick={() => handleOpenDirectCustomerWhatsApp(ord)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                              normalizeEcuadorPhone(ord.customerPhone).isValid
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-200'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                            title={
                              normalizeEcuadorPhone(ord.customerPhone).isValid
                                ? 'Abrir chat de WhatsApp directamente con el cliente (sin mensaje)'
                                : 'Sin WhatsApp registrado - Clic para registrar número'
                            }
                          >
                            <MessageCircle className={`w-3.5 h-3.5 ${normalizeEcuadorPhone(ord.customerPhone).isValid ? 'text-white' : 'text-amber-600'}`} />
                            <span>
                              {normalizeEcuadorPhone(ord.customerPhone).isValid
                                ? 'WhatsApp'
                                : 'Añadir Tel.'}
                            </span>
                          </button>

                          {ord.status === 'shipped' && !isPickup && (
                            <>
                              <button
                                onClick={() => handleOpenShipOrder(ord)}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                title="Ver o editar datos de guía y tracking"
                              >
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                <span>{ord.trackingNumber ? `Guía: #${ord.trackingNumber}` : 'Gestionar Guía'}</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await onUpdateOrderStatus(
                                    ord.id,
                                    'delivered',
                                    ord.paymentVoucher || undefined,
                                    ord.notes || undefined,
                                    ord.trackingNumber || undefined,
                                    ord.trackingCarrier || undefined,
                                    ord.trackingNotes || undefined
                                  );
                                  showToast(`✓ Pedido #${ord.orderNumber} marcado como ENTREGADO`);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                title="Marcar como Entregado"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Entregado</span>
                              </button>
                            </>
                          )}

                          {ord.status === 'delivered' && (
                            <>
                              {!isPickup && (
                                <button
                                  onClick={() => setOrderToPrintShipping(ord)}
                                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                  title="Imprimir etiqueta de envío"
                                >
                                  <Printer className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Etiqueta</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditOrder(ord)}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                title="Modificar pedido"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Modificar</span>
                              </button>
                            </>
                          )}

                          {ord.status === 'cancelled' && (
                            <>
                              <button
                                onClick={() => handleOpenEditOrder(ord)}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                title="Modificar o reactivar pedido"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Modificar</span>
                              </button>
                              <button
                                onClick={() => setOrderToDelete(ord)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                title="Eliminar pedido"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Eliminar</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* 4° SELECTOR DE ESTADO */}
                      <div className="flex items-center space-x-1.5 ml-auto">
                        <select
                          value={ord.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            if (newStatus === 'confirmed') {
                              setOrderToConfirm(ord);
                              setVoucherInput(ord.paymentVoucher || '');
                              setVoucherNotesInput(ord.notes || '');
                              setVoucherError(null);
                            } else if (newStatus === 'shipped') {
                              if (ord.status === 'pending' && !ord.paymentVoucher) {
                                showToast('⚠️ Para enviar el pedido, primero debes confirmarlo con su comprobante de pago');
                                setOrderToConfirm(ord);
                                setVoucherInput(ord.paymentVoucher || '');
                                setVoucherNotesInput(ord.notes || '');
                                setVoucherError(null);
                              } else {
                                handleOpenShipOrder(ord);
                              }
                            } else if (newStatus === 'delivered') {
                              if (ord.status === 'pending' && !ord.paymentVoucher) {
                                showToast('⚠️ Para entregar el pedido, primero debes confirmarlo con su comprobante de pago');
                                setOrderToConfirm(ord);
                                setVoucherInput(ord.paymentVoucher || '');
                                setVoucherNotesInput(ord.notes || '');
                                setVoucherError(null);
                              } else {
                                await onUpdateOrderStatus(
                                  ord.id,
                                  'delivered',
                                  ord.paymentVoucher || undefined,
                                  ord.notes || undefined,
                                  ord.trackingNumber || undefined,
                                  ord.trackingCarrier || undefined,
                                  ord.trackingNotes || undefined
                                );
                                showToast(isPickup ? '✓ Pedido marcado como ENTREGADO en local' : '✓ Pedido marcado como ENTREGADO');
                              }
                            } else {
                              await onUpdateOrderStatus(
                                ord.id,
                                newStatus,
                                ord.paymentVoucher || undefined,
                                ord.notes || undefined,
                                ord.trackingNumber || undefined,
                                ord.trackingCarrier || undefined,
                                ord.trackingNotes || undefined
                              );
                              showToast('✓ Estado del pedido actualizado');
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs transition ${
                            ord.status === 'pending'
                              ? 'bg-amber-100 text-amber-950 border border-amber-300 ring-2 ring-amber-400/50'
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="pending">🕒 Pendiente</option>
                          <option value="confirmed">🟣 Confirmado {isPickup ? '(Listo en Local)' : ''}</option>
                          {!isPickup && (
                            <option value="shipped" disabled={ord.status === 'pending' && !ord.paymentVoucher}>
                              🚚 Enviado (Requiere Guía)
                            </option>
                          )}
                          <option value="delivered" disabled={ord.status === 'pending' && !ord.paymentVoucher}>
                            ✅ {isPickup ? 'Entregado en Local' : 'Entregado'} {ord.status === 'pending' && !ord.paymentVoucher ? '(Requiere Confirmación)' : ''}
                          </option>
                          <option value="cancelled">❌ Cancelado</option>
                        </select>
                      </div>
                    </div>

                    {/* Customer, Delivery & Payment 3-Block Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Block 1: Cliente */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3 text-sky-600" />
                          Cliente
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{ord.customerName}</p>

                          {/* Cédula del Cliente */}
                          {(() => {
                            const ci = getCustomerCi(ord);
                            if (ci) {
                              return (
                                <div className="flex items-center space-x-1.5 mt-1">
                                  <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500 flex items-center gap-1">
                                    <CreditCard className="w-3 h-3 text-sky-600" />
                                    CI / Cédula:
                                  </span>
                                  <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.2 rounded font-mono font-bold text-[11px]">
                                    {ci}
                                    <button
                                      onClick={() => {
                                        copyTextToClipboard(ci, '✓ Cédula copiada');
                                      }}
                                      className="text-sky-500 hover:text-sky-800 p-0.5 cursor-pointer"
                                      title="Copiar cédula"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="flex items-center flex-wrap gap-1.5 text-slate-600 mt-1">
                            {(() => {
                              const norm = normalizeEcuadorPhone(ord.customerPhone);
                              if (norm.whatsappDigits && norm.isValid) {
                                return (
                                  <>
                                    <span className="text-[10px]">🇪🇨</span>
                                    <span className="font-mono font-bold text-emerald-700">
                                      {norm.formattedLocal || ord.customerPhone}
                                    </span>
                                    <button
                                      onClick={() => handleOpenDirectCustomerWhatsApp(ord)}
                                      className="text-emerald-600 hover:text-emerald-800 p-0.5 cursor-pointer hover:scale-110 transition"
                                      title="Abrir chat de WhatsApp (directo sin mensaje)"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenCustomerWhatsApp(ord)}
                                      className="text-emerald-500 hover:text-emerald-700 p-0.5 cursor-pointer hover:scale-110 transition"
                                      title="Enviar plantilla estructurada por WhatsApp"
                                    >
                                      <Send className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        copyTextToClipboard(norm.formattedLocal || ord.customerPhone, '✓ Teléfono copiado');
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiar teléfono"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </>
                                );
                              }
                              return (
                                <button
                                  onClick={() => {
                                    showToast('ℹ️ Ingresa el número de WhatsApp del cliente para contactarlo');
                                    handleOpenEditOrder(ord);
                                  }}
                                  className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition flex items-center gap-1 cursor-pointer"
                                  title="Hacer clic para registrar el WhatsApp del cliente"
                                >
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>Sin WhatsApp (Añadir)</span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Block 2: Entrega & Dirección */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            {isPickup ? (
                              <Store className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Truck className="w-3 h-3 text-blue-600" />
                            )}
                            Modalidad de Entrega
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isPickup
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            {isPickup ? 'Retiro en Local' : 'Envío a Domicilio'}
                          </span>
                        </div>
                        <p className="text-slate-800 flex items-start leading-snug">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{ord.customerAddress || 'Retiro en Local acordado'}</span>
                        </p>
                      </div>

                      {/* Block 3: Cobro y Método de Pago con Icono */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total a Cobrar</span>
                          <span className="text-base font-black text-emerald-700 font-mono">
                            ${Number(ord.totalAmount).toFixed(2)} {currency}
                          </span>
                        </div>

                        <div className="pt-1 border-t border-slate-200">
                          <span className="text-[10px] text-slate-500 block mb-1">Método de Pago:</span>
                          {renderPaymentBadge(ord.paymentMethod, paymentPartners)}
                        </div>
                      </div>
                    </div>

                    {/* Products in the order */}
                    {Array.isArray(ord.items) && ord.items.length > 0 && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-200">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-sky-600" />
                            Productos Solicitados ({itemsCount} unidades):
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">{ord.items.length} ítems</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ord.items.map((it: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 shadow-2xs"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold text-[10px]">
                                  {it.quantity || 1}x
                                </span>
                                <span className="truncate font-medium text-xs">
                                  {it.name || it.item?.name}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-900 text-xs ml-2 flex-shrink-0">
                                ${(Number(it.salePrice || it.item?.salePrice || 0) * (it.quantity || 1)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Estado de Abastecimiento & Botón a Proveedor */}
                        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {ord.fulfillmentStatus === 'supplier_pending' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Bajo Pedido (Falta pedir a proveedor)
                              </span>
                            ) : ord.fulfillmentStatus === 'supplier_ordered' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Pedido a Proveedor (En camino)
                              </span>
                            ) : ord.fulfillmentStatus === 'supplier_received' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Mercancía Recibida (Listo para entrega)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <Check className="w-3 h-3 text-slate-500" />
                                Stock Inmediato
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {(ord.linkedPurchaseId || ord.purchaseId) && onViewLinkedPurchase && (
                              <button
                                onClick={() => onViewLinkedPurchase((ord.linkedPurchaseId || ord.purchaseId)!)}
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Ver Compra #{ord.linkedPurchaseNumber || ord.purchaseNumber || ord.linkedPurchaseId || ord.purchaseId}</span>
                              </button>
                            )}

                            {ord.fulfillmentStatus === 'supplier_pending' && onGenerateSupplierPurchase && (
                              <button
                                onClick={() => onGenerateSupplierPurchase(ord)}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[11px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                                title="Generar orden de compra automática al proveedor para surtir este pedido"
                              >
                                <Building2 className="w-3 h-3" />
                                <span>Pedir a Proveedor (1-clic)</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {ord.notes && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start space-x-1.5">
                            <span className="font-bold text-amber-700 flex-shrink-0">Nota:</span>
                            <span className="italic">"{ord.notes}"</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Receipt / Voucher Display */}
                    {ord.paymentVoucher ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/80 border border-purple-200 text-xs shadow-2xs">
                        <div className="flex items-center space-x-2.5 truncate">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center flex-shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider block">
                              Comprobante de Pago Registrado:
                            </span>
                            <span className="font-mono font-black text-purple-900 text-sm tracking-wider">
                              {ord.paymentVoucher}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              copyTextToClipboard(ord.paymentVoucher || '', '✓ Comprobante copiado');
                            }}
                            className="p-1.5 rounded-lg text-purple-700 hover:text-purple-900 hover:bg-purple-100 transition cursor-pointer"
                            title="Copiar número de comprobante"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setOrderToConfirm(ord);
                              setVoucherInput(ord.paymentVoucher || '');
                              setVoucherNotesInput(ord.notes || '');
                              setVoucherError(null);
                            }}
                            className="p-1.5 rounded-lg text-purple-700 hover:text-purple-900 hover:bg-purple-100 transition cursor-pointer"
                            title="Editar comprobante"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : ord.status === 'pending' ? (
                      <button
                        onClick={() => {
                          setOrderToConfirm(ord);
                          setVoucherInput('');
                          setVoucherNotesInput(ord.notes || '');
                          setVoucherError(null);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Receipt className="w-4 h-4 text-purple-200" />
                        <span>Ingresar Comprobante de Pago y Confirmar Pedido</span>
                      </button>
                    ) : null}

                    {/* Shipping & Tracking Display Box OR Local Pickup Confirmation / Delivery */}
                    {isPickup ? (
                      ord.status === 'confirmed' ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs gap-2.5 shadow-2xs">
                          <div className="flex items-center space-x-2.5 truncate">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                                Listo para Retiro en Local / Tienda
                              </span>
                              <span className="text-amber-900 text-xs font-medium">
                                Comprobante confirmado. El cliente puede retirar su pedido.
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              await onUpdateOrderStatus(
                                ord.id,
                                'delivered',
                                ord.paymentVoucher || undefined,
                                ord.notes || undefined
                              );
                              showToast(`✓ Pedido #${ord.orderNumber} marcado como ENTREGADO en local`);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer flex-shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Marcar como Entregado en Local</span>
                          </button>
                        </div>
                      ) : null
                    ) : ord.trackingNumber || ord.trackingCarrier || ord.trackingNotes ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs shadow-2xs">
                        <div className="flex items-center space-x-2.5 truncate">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">
                                {ord.trackingCarrier || 'Guía de Envío'}:
                              </span>
                              <span className="font-mono font-black text-blue-900 text-sm tracking-wider">
                                {ord.trackingNumber || 'En preparación'}
                              </span>
                            </div>
                            {ord.trackingNotes && (
                              <p className="text-[11px] text-blue-700 truncate mt-0.5">
                                {ord.trackingNotes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {ord.trackingNumber && (
                            <button
                              onClick={() => {
                                copyTextToClipboard(ord.trackingNumber || '', '✓ Número de guía copiado');
                              }}
                              className="p-1.5 rounded-lg text-blue-700 hover:text-blue-900 hover:bg-blue-100 transition cursor-pointer"
                              title="Copiar número de guía"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenShipOrder(ord)}
                            className="p-1.5 rounded-lg text-blue-700 hover:text-blue-900 hover:bg-blue-100 transition cursor-pointer"
                            title="Editar datos de guía / tracking"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : ord.status === 'confirmed' ? (
                      <button
                        onClick={() => handleOpenShipOrder(ord)}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Truck className="w-4 h-4 text-blue-100" />
                        <span>🚚 Ingresar Guía / Tracking y Marcar como Enviado</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: 3. STORE SETTINGS & SHARE (Admin Only) */}
      {isAdmin && storeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header with Save Button */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-sky-600" />
                  Configuración de la Tienda Online
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personaliza el logo oficial, datos de contacto, empresas de envío y métodos de pago aceptados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={isSavingConfig}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition cursor-pointer flex items-center justify-center space-x-2 flex-shrink-0 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingConfig ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
              </button>
            </div>

            {/* SECTION 1: LOGO DE LA TIENDA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Logo Oficial de la Tienda</h3>
                    <p className="text-xs text-slate-500">
                      Sube el logo de tu marca para mostrarlo en el encabezado, catálogo y pie de página de los clientes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Logo Preview Container */}
                <div className="relative group flex-shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden p-2">
                    {storeLogoInput ? (
                      <img
                        src={storeLogoInput}
                        alt="Logo de la tienda"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <Store className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 block">Sin Logo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload & Actions */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-xs active:scale-95">
                      <UploadCloud className="w-4 h-4" />
                      <span>{storeLogoInput ? 'Cambiar Logo de la Tienda' : 'Subir Logo de la Tienda'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const b64 = await processLogoImageFile(file, 500);
                              setStoreLogoInput(b64);
                              setIsFormDirty(true);
                              showToast('✓ Logo cargado. Recuerda guardar cambios.');
                            } catch (err: any) {
                              alert(err.message || 'Error al procesar la imagen');
                            }
                          }
                        }}
                      />
                    </label>

                    {storeLogoInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setStoreLogoInput(null);
                          setIsFormDirty(true);
                          showToast('Logo eliminado. Recuerda guardar cambios.');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 active:scale-95"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>Quitar Logo</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    💡 Formatos sugeridos: <strong className="text-slate-700">PNG con fondo transparente</strong> o JPG cuadrado (mínimo 200x200px). Se adaptará automáticamente a la vista web y móvil.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 2: ESTILO Y TEMA VISUAL DE LA TIENDA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Estilo y Tema Visual de la Tienda</h3>
                    <p className="text-xs text-slate-500">
                      Personaliza la interfaz gráfica, esquinas, sombras, tipografía y paleta del catálogo con 6 estilos visuales únicos.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  6 Estilos Disponibles
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = themeInput === preset.id;
                  const paletteForTheme = themePalettes[preset.id] || DEFAULT_THEME_COLORS[preset.id] || DEFAULT_THEME_COLORS.classic;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setThemeInput(preset.id);
                        setIsFormDirty(true);
                        showToast(`✓ Estilo cambiado a "${preset.name}". Recuerda guardar los cambios.`);
                      }}
                      className={`group rounded-2xl p-4 transition-all duration-200 cursor-pointer relative flex flex-col justify-between border-2 ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/40 shadow-md ring-2 ring-sky-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60 shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Top preset badge & checkmark */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              preset.id === 'boutique'
                                ? 'bg-zinc-900 text-amber-300 border border-amber-500/40'
                                : preset.id === 'fresh'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : preset.id === 'brutalist'
                                ? 'bg-yellow-300 text-black border-2 border-black font-black'
                                : preset.id === 'cyber'
                                ? 'bg-[#070d18] text-cyan-300 border border-cyan-400 font-mono shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                                : preset.id === 'minimal'
                                ? 'bg-stone-100 text-stone-800 border border-stone-300 rounded-full'
                                : 'bg-sky-100 text-sky-900 border border-sky-300'
                            }`}
                          >
                            {preset.tag}
                          </span>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                              isSelected
                                ? 'bg-sky-600 border-sky-600 text-white'
                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                        </div>

                        {/* Interactive Color Palette Dots (Clickable to change colors) */}
                        <div className="flex items-center space-x-1.5 mb-3" onClick={(e) => e.stopPropagation()}>
                          {paletteForTheme.map((c, idx) => (
                            <label
                              key={idx}
                              className="relative w-5 h-5 rounded-full border border-black/20 shadow-xs cursor-pointer inline-flex items-center justify-center transition-transform hover:scale-125"
                              style={{ backgroundColor: c }}
                              title={`Modificar color ${idx + 1}: ${COLOR_ROLE_NAMES[idx] || 'Color'} (${c})`}
                            >
                              <input
                                type="color"
                                value={c.startsWith('#') && c.length === 7 ? c : '#000000'}
                                onChange={(e) => {
                                  handleUpdateThemeColor(preset.id, idx, e.target.value);
                                }}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                              />
                            </label>
                          ))}
                          <span className="text-[10px] text-slate-400 font-semibold ml-1">Toca círculos para editar</span>
                        </div>

                        {/* Title & Subtitle */}
                        <h4 className="text-sm font-black text-slate-900 leading-tight">
                          {preset.name}
                        </h4>
                        <p className="text-[11px] font-bold text-slate-600 mt-0.5">
                          {preset.subtitle}
                        </p>

                        {/* Mini preview card representation */}
                        <div className={`mt-3 p-2.5 rounded-xl border text-[10px] space-y-1.5 ${preset.previewCard}`}>
                          <div className="flex items-center justify-between border-b border-black/10 pb-1">
                            <span className="font-bold truncate">Catálogo Digital</span>
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: paletteForTheme[2] || paletteForTheme[0] }}
                            />
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="font-mono font-bold">$24.99</span>
                            <span
                              className="px-2 py-0.5 rounded text-[9px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: paletteForTheme[0] }}
                            >
                              Comprar
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                          {preset.description}
                        </p>

                        <div className="mt-2.5 p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 text-[10px] text-slate-700 leading-tight">
                          <span className="font-bold text-slate-900 block mb-0.5">📐 Distribución de Paneles:</span>
                          <span>{preset.layoutDescription}</span>
                        </div>
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-slate-100/80 flex items-center justify-between">
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-sky-700' : 'text-slate-500'}`}>
                          {isSelected ? '✓ Seleccionado' : 'Elegir estilo'}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-sky-600 animate-pulse">
                            Vista Previa Activa
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dedicated Theme Palette Customizer */}
              <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Personalizar Colores del Estilo:{' '}
                        <span className="text-sky-700 font-extrabold">
                          {THEME_PRESETS.find((p) => p.id === themeInput)?.name || themeInput}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Ajusta cada color específico de la paleta. Los cambios se aplicarán en la tienda modo cliente.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResetThemeColors(themeInput)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto shadow-2xs active:scale-95"
                    title="Restaurar paleta original de este estilo"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Restaurar por Defecto</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(themePalettes[themeInput] || DEFAULT_THEME_COLORS[themeInput] || DEFAULT_THEME_COLORS.classic).map(
                    (colorVal, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 leading-tight">
                            {COLOR_ROLE_NAMES[idx] || `Color ${idx + 1}`}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            #{idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <label
                            className="w-8 h-8 rounded-lg border border-black/20 shadow-xs cursor-pointer flex-shrink-0 relative overflow-hidden flex items-center justify-center transition-transform hover:scale-105"
                            style={{ backgroundColor: colorVal }}
                          >
                            <input
                              type="color"
                              value={colorVal.startsWith('#') && colorVal.length === 7 ? colorVal : '#000000'}
                              onChange={(e) => handleUpdateThemeColor(themeInput, idx, e.target.value)}
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            />
                          </label>

                          <input
                            type="text"
                            value={colorVal}
                            onChange={(e) => handleUpdateThemeColor(themeInput, idx, e.target.value)}
                            placeholder="#000000"
                            className="w-full text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:bg-white focus:border-sky-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="text-[11px] text-slate-500 bg-sky-50/60 border border-sky-100 rounded-xl p-2.5 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                  <span>
                    <strong>Nota:</strong> Los estilos y colores personalizados cambian la tienda exclusivamente en <strong>Modo Vista Cliente</strong> (para tus compradores), manteniendo el panel de administración ordenado y accesible.
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 3: DATOS COMERCIALES & WHATSAPP */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Datos Comerciales y WhatsApp</h3>
                  <p className="text-xs text-slate-500">
                    Información visible en el catálogo y número para recibir pedidos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Comercial de la Tienda:
                  </label>
                  <input
                    type="text"
                    required
                    value={storeNameInput}
                    onChange={(e) => {
                      setStoreNameInput(e.target.value);
                      setIsFormDirty(true);
                    }}
                    placeholder="Ej. Mi Tienda Express"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      WhatsApp para Pedidos:
                    </label>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span>🇪🇨</span> Ecuador (+593 / 09)
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={whatsappInput}
                    onChange={(e) => {
                      setWhatsappInput(e.target.value);
                      setIsFormDirty(true);
                    }}
                    placeholder="Ej. 0983302390 o +593983302390"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white font-mono transition"
                  />
                  {whatsappInput.trim() && (
                    <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                      <span className="text-slate-500">Guardará:</span>
                      <div className="flex items-center space-x-2 font-mono">
                        <span className="text-sky-700 font-bold">
                          {normalizeEcuadorPhone(whatsappInput).international || whatsappInput}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-emerald-700 font-bold">
                          {normalizeEcuadorPhone(whatsappInput).local || whatsappInput}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>Dirección Física / Ubicación de la Tienda (Local / Ciudad / Referencia):</span>
                  </span>
                  <span className="text-[10px] text-sky-600 font-normal">
                    Se añade al final de las publicaciones universales IA
                  </span>
                </label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => {
                    setAddressInput(e.target.value);
                    setIsFormDirty(true);
                  }}
                  placeholder="Ej. Av. Amazonas y República, Local #12, Quito - Ecuador"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  📍 Esta dirección se incluirá automáticamente al final de las publicaciones y textos promocionales generados con IA para que tus clientes sepan dónde encontrarte o retirar pedidos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción o Eslogan del Catálogo:
                </label>
                <input
                  type="text"
                  value={descriptionInput}
                  onChange={(e) => {
                    setDescriptionInput(e.target.value);
                    setIsFormDirty(true);
                  }}
                  placeholder="Ej. Envíos garantizados a todo el país y entregas en el día"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Texto del Banner de Novedades:
                </label>
                <input
                  type="text"
                  value={bannerTextInput}
                  onChange={(e) => {
                    setBannerTextInput(e.target.value);
                    setIsFormDirty(true);
                  }}
                  placeholder="Ej. 🔥 ¡Novedades de la semana con precios especiales y envíos directos!"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Costo de Envío por Defecto ($):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={deliveryFeeInput}
                    onChange={(e) => {
                      setDeliveryFeeInput(e.target.value);
                      setIsFormDirty(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Moneda:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currency}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 cursor-not-allowed font-semibold"
                  />
                </div>
              </div>

              {/* Stock Visibility Toggle in Customer Store */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-sky-600" />
                      <label htmlFor="show-stock-toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                        Mostrar Existencias / Stock en Tienda Online (Vista Cliente)
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
                      {showStockInput
                        ? '✓ Habilitado: Los clientes verán la cantidad exacta de stock disponible en cada producto (ej. "Stock: 12" o "¡Últimas 2 u.!").'
                        : '✗ Deshabilitado: Los clientes solo verán "Disponible" o "Agotado", ocultando la cantidad numérica exacta de inventario.'}
                    </p>
                  </div>

                  <label htmlFor="show-stock-toggle" className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                    <input
                      id="show-stock-toggle"
                      type="checkbox"
                      checked={showStockInput}
                      onChange={(e) => {
                        setShowStockInput(e.target.checked);
                        setIsFormDirty(true);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 3: LOGOS DE EMPRESAS DE ENTREGA Y PAQUETERÍA */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Logos de Empresas de Entrega y Paquetería</h3>
                    <p className="text-xs text-slate-500">
                      Sube y gestiona los logos de las empresas de transporte con las que trabajas (Servientrega, Urbano, Tramaco, etc.).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingCourier(!isAddingCourier)}
                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition flex items-center space-x-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Empresa</span>
                </button>
              </div>

              {/* Form to add new courier */}
              {isAddingCourier && (
                <div className="p-4 rounded-xl bg-slate-50 border border-sky-200 space-y-3 animate-fadeIn">
                  <h4 className="text-xs font-bold text-sky-800 flex items-center space-x-1.5">
                    <ImagePlus className="w-4 h-4 text-sky-600" />
                    <span>Nueva Empresa de Entrega / Envíos</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-700 font-semibold mb-1">
                        Nombre de la Empresa:
                      </label>
                      <input
                        type="text"
                        value={newCourierName}
                        onChange={(e) => setNewCourierName(e.target.value)}
                        placeholder="Ej. Servientrega, Envíos Express..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-700 font-semibold mb-1">
                        Logo de la Empresa:
                      </label>
                      <div className="flex items-center space-x-2">
                        {newCourierLogo ? (
                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-300 overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                            <img src={newCourierLogo} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        ) : null}
                        <label className="flex-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-medium transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs">
                          <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
                          <span>{newCourierLogo ? 'Cambiar Imagen' : 'Seleccionar Logo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                try {
                                  const img = await processLogoImageFile(f, 300);
                                  setNewCourierLogo(img);
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCourier(false);
                        setNewCourierName('');
                        setNewCourierLogo(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white text-slate-600 hover:text-slate-800 border border-slate-200 text-xs transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!newCourierName.trim()}
                      onClick={() => {
                        if (!newCourierName.trim()) return;
                        const newPartner: CourierPartner = {
                          id: 'courier_' + Date.now(),
                          name: newCourierName.trim(),
                          logoUrl: newCourierLogo || undefined,
                          active: true,
                        };
                        setCourierPartners((prev) => [...prev, newPartner]);
                        setNewCourierName('');
                        setNewCourierLogo(null);
                        setIsAddingCourier(false);
                        setIsFormDirty(true);
                        showToast('✓ Empresa agregada. Recuerda guardar cambios.');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                    >
                      Agregar a la Lista
                    </button>
                  </div>
                </div>
              )}

              {/* Courier Partners List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {courierPartners.map((courier, idx) => (
                  <div
                    key={courier.id || idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                      courier.active
                        ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                        : 'bg-slate-50/40 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Logo Preview with Upload trigger */}
                      <div className="relative group flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-300 shadow-2xs flex items-center justify-center overflow-hidden p-1">
                          {courier.logoUrl ? (
                            <img
                              src={courier.logoUrl}
                              alt={courier.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Truck className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        {/* Hover Overlay to change logo */}
                        <label
                          className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white"
                          title="Cambiar logo"
                        >
                          <Camera className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const b64 = await processLogoImageFile(file, 300);
                                  setCourierPartners((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, logoUrl: b64 } : c))
                                  );
                                  setIsFormDirty(true);
                                  showToast(`✓ Logo de ${courier.name} actualizado.`);
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="min-w-0 flex-1">
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                          Empresa de Envío:
                        </label>
                        <input
                          type="text"
                          value={courier.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCourierPartners((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, name: val } : c))
                            );
                            setIsFormDirty(true);
                          }}
                          placeholder="Nombre de la empresa de transporte"
                          className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none w-full"
                        />
                        <label className="flex items-center space-x-1.5 text-[11px] text-slate-600 cursor-pointer mt-1.5 select-none">
                          <input
                            type="checkbox"
                            checked={courier.active}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCourierPartners((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, active: checked } : c))
                              );
                              setIsFormDirty(true);
                            }}
                            className="rounded text-sky-600 focus:ring-0 cursor-pointer"
                          />
                          <span className={courier.active ? 'text-sky-700 font-bold' : 'text-slate-400'}>
                            {courier.active ? 'Visible en tienda' : 'Oculto'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Delete Courier */}
                    <button
                      type="button"
                      onClick={() => {
                        setCourierPartners((prev) => prev.filter((_, i) => i !== idx));
                        setIsFormDirty(true);
                        showToast(`Empresa eliminada. Recuerda guardar cambios.`);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer shrink-0"
                      title="Eliminar empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: LOGOS DE MÉTODOS DE PAGO */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Logos de Métodos de Pago y Bancos</h3>
                    <p className="text-xs text-slate-500">
                      Sube y gestiona los logos de las formas de pago aceptadas (Pichincha, Guayaquil, Deuna, Zelle, Tarjetas, etc.).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingPayment(!isAddingPayment)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center space-x-1 cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Método</span>
                </button>
              </div>

              {/* Form to add new payment method */}
              {isAddingPayment && (
                <div className="p-4 rounded-xl bg-slate-50 border border-emerald-200 space-y-3 animate-fadeIn">
                  <h4 className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5">
                    <ImagePlus className="w-4 h-4 text-emerald-600" />
                    <span>Nuevo Método de Pago</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-700 font-semibold mb-1">
                        Nombre del Método / Banco:
                      </label>
                      <input
                        type="text"
                        value={newPaymentName}
                        onChange={(e) => setNewPaymentName(e.target.value)}
                        placeholder="Ej. Banco Internacional, Binance Pay..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-700 font-semibold mb-1">
                        Logo del Método de Pago:
                      </label>
                      <div className="flex items-center space-x-2">
                        {newPaymentLogo ? (
                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-300 overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                            <img src={newPaymentLogo} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        ) : null}
                        <label className="flex-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-medium transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs">
                          <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{newPaymentLogo ? 'Cambiar Imagen' : 'Seleccionar Logo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                try {
                                  const img = await processLogoImageFile(f, 300);
                                  setNewPaymentLogo(img);
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-700 font-semibold mb-1">
                      Instrucciones o Detalles (opcional):
                    </label>
                    <input
                      type="text"
                      value={newPaymentDetails}
                      onChange={(e) => setNewPaymentDetails(e.target.value)}
                      placeholder="Ej. Cta. Ahorros #123456789 a nombre de..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingPayment(false);
                        setNewPaymentName('');
                        setNewPaymentDetails('');
                        setNewPaymentLogo(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white text-slate-600 hover:text-slate-800 border border-slate-200 text-xs transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!newPaymentName.trim()}
                      onClick={() => {
                        if (!newPaymentName.trim()) return;
                        const newPartner: PaymentMethodPartner = {
                          id: 'payment_' + Date.now(),
                          name: newPaymentName.trim(),
                          details: newPaymentDetails.trim() || undefined,
                          logoUrl: newPaymentLogo || undefined,
                          active: true,
                        };
                        setPaymentPartners((prev) => [...prev, newPartner]);
                        setNewPaymentName('');
                        setNewPaymentDetails('');
                        setNewPaymentLogo(null);
                        setIsAddingPayment(false);
                        setIsFormDirty(true);
                        showToast('✓ Método de pago agregado. Recuerda guardar cambios.');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                    >
                      Agregar a la Lista
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Partners List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentPartners.map((payment, idx) => (
                  <div
                    key={payment.id || idx}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition ${
                      payment.active
                        ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                        : 'bg-slate-50/40 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {/* Logo Preview with Upload trigger */}
                        <div className="relative group flex-shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-300 shadow-2xs flex items-center justify-center overflow-hidden p-1">
                            {payment.logoUrl ? (
                              <img
                                src={payment.logoUrl}
                                alt={payment.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <CreditCard className="w-5 h-5 text-slate-400" />
                            )}
                          </div>

                          {/* Hover Overlay to change logo */}
                          <label
                            className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white"
                            title="Cambiar logo"
                          >
                            <Camera className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const b64 = await processLogoImageFile(file, 300);
                                    setPaymentPartners((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, logoUrl: b64 } : p))
                                    );
                                    setIsFormDirty(true);
                                    showToast(`✓ Logo de ${payment.name} actualizado.`);
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>

                        <div className="min-w-0 flex-1">
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Nombre del Método / Banco:
                          </label>
                          <input
                            type="text"
                            value={payment.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPaymentPartners((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, name: val } : p))
                              );
                              setIsFormDirty(true);
                            }}
                            placeholder="Nombre del banco o método"
                            className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none w-full"
                          />
                          <label className="flex items-center space-x-1.5 text-[11px] text-slate-600 cursor-pointer mt-1.5 select-none">
                            <input
                              type="checkbox"
                              checked={payment.active}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPaymentPartners((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, active: checked } : p))
                                );
                                setIsFormDirty(true);
                              }}
                              className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                            />
                            <span className={payment.active ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                              {payment.active ? 'Visible en tienda' : 'Oculto'}
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Delete Payment */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentPartners((prev) => prev.filter((_, i) => i !== idx));
                          setIsFormDirty(true);
                          showToast(`Método de pago eliminado. Recuerda guardar cambios.`);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer flex-shrink-0"
                        title="Eliminar método"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Details input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Datos de Cuenta / Instrucciones:
                      </label>
                      <input
                        type="text"
                        value={payment.details || ''}
                        placeholder="Ej. Cta. Ahorros #123456789 | Titular: Nombre | CI: 17..."
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentPartners((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, details: val } : p))
                          );
                          setIsFormDirty(true);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Save Bar */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">
                {isFormDirty ? '⚠️ Tienes cambios pendientes por guardar' : '✓ Toda la información está actualizada'}
              </span>
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                disabled={isSavingConfig}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition cursor-pointer flex items-center space-x-2 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingConfig ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
              </button>
            </div>
          </div>

          {/* Right Share Box */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between h-fit lg:sticky lg:top-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Enlace Exclusivo para Clientes</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Comparte este enlace con tus compradores. Entrarán directamente al catálogo de compra y carrito, <strong>sin ver ninguna opción de administración ni tus pedidos</strong>.
              </p>

              <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 text-xs font-mono text-sky-900 break-all select-all font-semibold">
                {customerStoreUrl}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  copyTextToClipboard(customerStoreUrl, '✓ Enlace para clientes copiado al portapapeles');
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar Enlace para Clientes</span>
              </button>

              <button
                onClick={() => {
                  const text = `🛍️ ¡Hola! Te invito a ver nuestro catálogo online y hacer tu pedido en: ${customerStoreUrl}`;
                  const encoded = encodeURIComponent(text);
                  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
                }}
                className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs active:scale-95"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Difundir por WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK PRODUCT DETAIL & MULTI-PHOTO GALLERY */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-0 animate-fadeIn relative bg-white border border-slate-200/90 text-slate-900">
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full transition cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {/* Media Showcase (Photo Gallery or Video Player) */}
              <div className="p-4 flex flex-col items-center justify-center relative border-b sm:border-b-0 sm:border-r bg-slate-50 border-slate-100">
                {(() => {
                  const photos = getProductPhotos(quickViewProduct);
                  const currentPhoto = photos[activeImageIdx] || quickViewProduct.imageUrl;
                  const parsedVideo = quickViewProduct.videoUrl ? parseVideoUrl(quickViewProduct.videoUrl) : null;
                  const effectiveMediaMode = (photos.length === 0 && quickViewProduct.videoUrl) ? 'video' : activeMediaMode;

                  return (
                    <div className="w-full space-y-2.5">
                      {/* Media switcher if video exists */}
                      {quickViewProduct.videoUrl && (
                        <div className="flex rounded-xl bg-slate-200/80 p-1 border border-slate-200 text-xs font-bold shadow-inner">
                          <button
                            type="button"
                            onClick={() => setActiveMediaMode('photo')}
                            className={`flex-1 py-1.5 rounded-lg text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                              effectiveMediaMode === 'photo'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Fotos ({photos.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveMediaMode('video')}
                            className={`flex-1 py-1.5 rounded-lg text-center transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                              effectiveMediaMode === 'video'
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Ver Video</span>
                          </button>
                        </div>
                      )}

                      {/* Video Player */}
                      {effectiveMediaMode === 'video' && parsedVideo ? (
                        <div className="aspect-square rounded-2xl overflow-hidden bg-black border border-slate-800 relative flex items-center justify-center shadow-xs">
                          {parsedVideo.isDirect ? (
                            <video
                              src={parsedVideo.embedUrl}
                              controls
                              autoPlay
                              className="w-full h-full object-contain"
                            />
                          ) : parsedVideo.embedUrl ? (
                            <iframe
                              src={parsedVideo.embedUrl}
                              title={quickViewProduct.name}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          ) : (
                            <div className="text-center p-4 text-slate-400 text-xs">
                              <Film className="w-10 h-10 mx-auto mb-2 text-sky-400 opacity-80" />
                              <p className="font-bold text-slate-200">Video del Producto</p>
                              <a
                                href={quickViewProduct.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 underline text-xs mt-2 inline-flex items-center space-x-1"
                              >
                                <span>Abrir video en reproductor</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/80 text-sky-300 border border-white/20 backdrop-blur-xs">
                            {parsedVideo.platform.toUpperCase()}
                          </div>
                        </div>
                      ) : (
                        /* Photo Container */
                        <div className="aspect-square rounded-2xl overflow-hidden relative flex items-center justify-center bg-white border border-slate-200/80 shadow-xs">
                          {currentPhoto ? (
                            <img
                              src={currentPhoto}
                              alt={quickViewProduct.name}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : quickViewProduct.videoUrl ? (
                            <ProductMediaDisplay
                              imageUrl={null}
                              videoUrl={quickViewProduct.videoUrl}
                              name={quickViewProduct.name}
                              className="w-full h-full relative"
                              imageClassName="w-full h-full object-contain"
                              videoClassName="w-full h-full object-contain"
                              autoPlayVideo={true}
                              showPlayBadge={true}
                              placeholderText="Sin imagen"
                            />
                          ) : (
                            <ImageIcon className="w-12 h-12 text-slate-300" />
                          )}

                          {photos.length > 1 && (
                            <>
                              <button
                                onClick={() =>
                                  setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
                                }
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/70 text-white border border-white/20 hover:bg-black transition cursor-pointer"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setActiveImageIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
                                }
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/70 text-white border border-white/20 hover:bg-black transition cursor-pointer"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {quickViewProduct.videoUrl && (
                            <button
                              type="button"
                              onClick={() => setActiveMediaMode('video')}
                              className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-900/90 hover:bg-black text-sky-300 border border-sky-400/40 shadow-xs flex items-center space-x-1 cursor-pointer transition active:scale-95 backdrop-blur-xs"
                            >
                              <Play className="w-3 h-3 text-sky-400 fill-current" />
                              <span>Ver Video</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Thumbnail dots / row */}
                      {activeMediaMode === 'photo' && photos.length > 1 && (
                        <div className="flex items-center justify-center space-x-2 overflow-x-auto py-1">
                          {photos.map((ph, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveImageIdx(idx)}
                              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                                activeImageIdx === idx
                                  ? 'border-sky-500 scale-105 shadow-xs'
                                  : 'border-transparent opacity-60 hover:opacity-100'
                              }`}
                            >
                              <img src={ph} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Product Info & Fast Add to Cart */}
              <div className="p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                      {quickViewProduct.category}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      SKU: {quickViewProduct.sku}
                    </span>
                    {quickViewProduct.videoUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveMediaMode('video')}
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center space-x-1 cursor-pointer transition"
                      >
                        <Film className="w-3 h-3 text-indigo-600" />
                        <span>Video Incluido</span>
                      </button>
                    )}
                    {Math.max(0, Math.min(100, Number(quickViewProduct.discountPercent) || 0)) > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-xs animate-pulse">
                        🔥 OFERTA -{Math.max(0, Math.min(100, Number(quickViewProduct.discountPercent) || 0))}%
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black leading-snug text-slate-900">
                    {quickViewProduct.name}
                  </h3>

                  {(() => {
                    const disc = Math.max(0, Math.min(100, Number(quickViewProduct.discountPercent) || 0));
                    const regular = Number(quickViewProduct.salePrice) || 0;
                    const effective = disc > 0 ? regular * (1 - disc / 100) : regular;

                    if (disc > 0) {
                      return (
                        <div className="pt-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs line-through text-slate-400 font-semibold">
                              ${regular.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                              -{disc}% OFF
                            </span>
                          </div>
                          <div className="flex items-baseline space-x-2 mt-0.5">
                            <span className="text-2xl font-black text-rose-600">
                              ${effective.toFixed(2)}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                              {currency}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-baseline space-x-2 pt-1">
                        <span className="text-2xl font-black text-emerald-600">
                          ${regular.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {currency}
                        </span>
                      </div>
                    );
                  })()}

                  {quickViewProduct.description && (
                    <p className="text-xs leading-relaxed p-3 rounded-xl border bg-slate-50 text-slate-600 border-slate-200">
                      {quickViewProduct.description}
                    </p>
                  )}

                  {/* Stock status indicator */}
                  {quickViewProduct.stock <= 0 ? (
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-1.5 font-bold text-purple-700">
                        <PackageCheck className="w-4 h-4 text-purple-600" />
                        <span>🟣 Bajo Pedido / Por Encargo</span>
                      </div>
                      <p className="text-[11px] text-purple-800 leading-relaxed">
                        ℹ️ Este producto se gestiona bajo encargo. Al realizar tu pedido, verificamos disponibilidad inmediata con nuestro proveedor.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>🟢 En Bodega (Despacho Inmediato)</span>
                      </div>
                      {storeConfig.showStock !== false && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700 font-bold">
                          {quickViewProduct.stock} u. disponibles
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-xs space-y-1 pt-1 text-slate-500">
                    <p className="flex items-center">
                      <Tag className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Categoría:{' '}
                      <span className="ml-1 font-semibold text-slate-700">
                        {quickViewProduct.category || 'General'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  {isCustomerView && (
                    <>
                      <button
                        onClick={() => {
                          handleAddToCart(quickViewProduct, 1);
                          setQuickViewProduct(null);
                        }}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95 ${
                          quickViewProduct.stock <= 0
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                            : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white'
                        }`}
                      >
                        {quickViewProduct.stock <= 0 ? (
                          <PackageCheck className="w-4 h-4" />
                        ) : (
                          <ShoppingCart className="w-4 h-4" />
                        )}
                        <span>
                          {quickViewProduct.stock <= 0
                            ? 'Encargar / Solicitar Bajo Pedido'
                            : 'Agregar al Carrito'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleDirectBuyProduct(quickViewProduct)}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95 shadow-md ${
                          quickViewProduct.stock <= 0
                            ? 'bg-purple-700 hover:bg-purple-800 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>
                          {quickViewProduct.stock <= 0
                            ? 'Encargar ahora por WhatsApp'
                            : 'Comprar ahora / Pedir por WhatsApp'}
                        </span>
                      </button>
                    </>
                  )}

                  {/* Share product options */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Compartir este producto con amigos o clientes:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleShareProductWhatsApp(quickViewProduct)}
                        className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>Enviar por WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyProductLink(quickViewProduct)}
                        className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Copy className="w-4 h-4 text-sky-600" />
                        <span>Copiar Enlace</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLIDING SHOPPING CART & CHECKOUT DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="max-w-md w-full h-full flex flex-col justify-between shadow-2xl animate-fadeIn bg-white border-l border-slate-200 text-slate-900">
            {/* Cart Header */}
            <div className="p-4 border-b flex items-center justify-between bg-slate-50/80 border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {cartStep === 'cart'
                      ? 'Carrito de Compras'
                      : cartStep === 'checkout'
                      ? 'Completar y Enviar Pedido'
                      : '¡Pedido Confirmado!'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {cartTotalItems} {cartTotalItems === 1 ? 'artículo' : 'artículos'} seleccionados
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-xl border transition cursor-pointer bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP 1: CART ITEMS LIST */}
            {cartStep === 'cart' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.some((ci) => ci.item.stock <= 0 || ci.item.status === 'sold_out') && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2 shadow-2xs">
                    <PackageCheck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-purple-800">Pedido con productos bajo encargo</p>
                      <p className="text-[11px] text-purple-700 leading-snug">
                        Tu carrito incluye productos que se gestionan bajo encargo. Al procesar tu pedido, verificamos de inmediato la disponibilidad con el proveedor.
                      </p>
                    </div>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <ShoppingBag
                      className={`w-16 h-16 mb-3 opacity-30 ${
                        isCustomerView ? 'text-slate-400' : 'text-sky-400'
                      }`}
                    />
                    <h4
                      className={`text-sm font-bold ${
                        isCustomerView ? 'text-slate-800' : 'text-slate-300'
                      }`}
                    >
                      Tu carrito está vacío
                    </h4>
                    <p
                      className={`text-xs mt-1 max-w-xs ${
                        isCustomerView ? 'text-slate-500' : 'text-slate-500'
                      }`}
                    >
                      Explora el catálogo y agrega los productos que deseas adquirir.
                    </p>
                  </div>
                ) : (
                  cart.map((ci) => {
                    const isOutOfStock = ci.item.stock <= 0 || ci.item.status === 'sold_out';
                    return (
                      <div
                        key={ci.item.id}
                        className="rounded-2xl p-3 flex items-center space-x-3 transition bg-slate-50 border border-slate-200/90 shadow-xs"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border bg-white border-slate-200">
                          <ProductMediaDisplay
                            imageUrl={ci.item.imageUrl}
                            videoUrl={ci.item.videoUrl}
                            name={ci.item.name}
                            className="w-full h-full relative"
                            imageClassName="w-full h-full object-cover"
                            videoClassName="w-full h-full object-cover"
                            autoPlayVideo={true}
                            showPlayBadge={false}
                            placeholderText=""
                            fallbackIcon="image"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5 mb-0.5">
                            <h4 className="text-xs font-bold truncate text-slate-900">
                              {ci.item.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono text-slate-500">
                              SKU: {ci.item.sku}
                            </span>
                            {isOutOfStock ? (
                              <span className="inline-flex items-center text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.2 rounded">
                                🟣 Bajo Pedido
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                🟢 En Bodega
                              </span>
                            )}
                          </div>

                          {(() => {
                            const disc = Math.max(0, Math.min(100, Number(ci.item.discountPercent) || 0));
                            const regular = Number(ci.item.salePrice) || 0;
                            const effective = disc > 0 ? regular * (1 - disc / 100) : regular;

                            if (disc > 0) {
                              return (
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  <span className="text-xs font-black text-rose-600">
                                    ${effective.toFixed(2)} {currency}
                                  </span>
                                  <span className="text-[10px] line-through text-slate-400 font-semibold">
                                    ${regular.toFixed(2)}
                                  </span>
                                  <span className="text-[9px] font-black px-1 rounded bg-rose-50 text-rose-600 border border-rose-200">
                                    -{disc}%
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div className="text-xs font-black mt-0.5 text-emerald-600">
                                ${regular.toFixed(2)} {currency}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Quantity buttons */}
                        <div className="flex items-center space-x-1.5 p-1 rounded-xl border bg-white border-slate-200">
                          <button
                            onClick={() => handleUpdateCartQty(ci.item.id, ci.quantity - 1)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black px-1 font-mono text-slate-900">
                            {ci.quantity}
                          </span>
                          <button
                            disabled={!isOutOfStock && ci.quantity >= ci.item.stock}
                            onClick={() => handleUpdateCartQty(ci.item.id, ci.quantity + 1)}
                            className="w-6 h-6 rounded-lg disabled:opacity-30 flex items-center justify-center transition cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-800"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => handleRemoveFromCart(ci.item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 transition cursor-pointer"
                          title="Eliminar del carrito"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* STEP 2: CHECKOUT & SHIPPING FORM */}
            {cartStep === 'checkout' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <button
                  onClick={() => setCartStep('cart')}
                  className={`text-xs hover:underline flex items-center space-x-1 cursor-pointer mb-2 font-bold ${
                    isCustomerView ? 'text-sky-600' : 'text-sky-400'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Volver al carrito</span>
                </button>

                {cart.some((ci) => ci.item.stock <= 0 || ci.item.status === 'sold_out') && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2 shadow-2xs">
                    <PackageCheck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-purple-800">Estado: 🔍 Consultando al proveedor</p>
                      <p className="text-[11px] text-purple-700 leading-snug">
                        Se enviará la solicitud al proveedor automáticamente para confirmar stock y entrega inmediata.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 p-4 rounded-2xl border bg-slate-50 border-slate-200/90">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-800">
                    <User className="w-3.5 h-3.5 text-sky-500" />
                    Datos del Comprador
                  </h4>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-start gap-2 animate-shake">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-700">
                      Nombre y Apellido: *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (checkoutError) setCheckoutError(null);
                      }}
                      placeholder="Ej. Juan Pérez"
                      className="w-full px-3 py-2 rounded-xl text-xs transition focus:outline-none bg-white border border-slate-200 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Teléfono / WhatsApp: *
                      </label>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span>🇪🇨</span> Ecuador (+593 / 09)
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (checkoutError) setCheckoutError(null);
                      }}
                      placeholder="Ej. 0983302390 o +593983302390"
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono transition focus:outline-none bg-white border border-slate-200 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    {customerPhone.trim() ? (
                      (() => {
                        const norm = normalizeEcuadorPhone(customerPhone);
                        if (norm.isValid) {
                          return (
                            <div className="mt-1.5 px-2.5 py-1 rounded-lg text-[11px] flex items-center justify-between border bg-emerald-50 border-emerald-200 text-emerald-800">
                              <span className="font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>WhatsApp Válido:</span>
                              </span>
                              <div className="flex items-center space-x-2 font-mono font-bold">
                                <span>{norm.formattedLocal}</span>
                                <span className="opacity-50">|</span>
                                <span className="text-[10px]">{norm.international}</span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="mt-1.5 px-2.5 py-1 rounded-lg text-[11px] flex items-center justify-between border bg-amber-50 border-amber-200 text-amber-800">
                            <span className="flex items-center gap-1 font-semibold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                              <span>Completa tu número (10 dígitos):</span>
                            </span>
                            <span className="font-mono text-[10px] opacity-80">{norm.local || customerPhone}</span>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[10px] mt-1 text-slate-500">
                        Ingresa tu celular con <span className="font-mono font-bold">09...</span> o <span className="font-mono font-bold">+593...</span> para enviarte el estado de tu pedido.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-2xl border bg-slate-50 border-slate-200/90">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-800">
                    <Truck className="w-3.5 h-3.5 text-emerald-500" />
                    Modalidad de Entrega
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('shipping')}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex flex-col items-center justify-center ${
                        deliveryType === 'shipping'
                          ? 'bg-sky-50 border-sky-400 text-sky-900 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <Truck className="w-4 h-4 mb-1" />
                      <span>Envío a Domicilio</span>
                      {Number(storeConfig.deliveryFee) > 0 && (
                        <span className="text-[10px] text-slate-500">
                          +${storeConfig.deliveryFee}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex flex-col items-center justify-center ${
                        deliveryType === 'pickup'
                          ? 'bg-sky-50 border-sky-400 text-sky-900 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <Store className="w-4 h-4 mb-1" />
                      <span>Retiro en Local</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Gratis</span>
                    </button>
                  </div>

                  {deliveryType === 'shipping' && (
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-slate-700">
                        Dirección de Envío Completa:
                      </label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Calle, número, depto, ciudad"
                        className="w-full px-3 py-2 rounded-xl text-xs transition focus:outline-none bg-white border border-slate-200 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4 rounded-2xl border bg-slate-50 border-slate-200/90">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center justify-between text-slate-800">
                    <span>Método de Pago</span>
                    <span className="text-[10px] font-normal text-emerald-600 font-sans">
                      100% Seguro
                    </span>
                  </h4>

                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs cursor-pointer transition focus:outline-none bg-white border border-slate-200 text-slate-900 focus:border-sky-500 font-medium"
                  >
                    <option value="whatsapp">💬 Coordinar por WhatsApp (Recomendado)</option>
                    {paymentPartners
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.name}>
                          💳 {p.name} {p.details ? `(${p.details})` : ''}
                        </option>
                      ))}
                    <option value="contraentrega">💵 Pago Contra Entrega / Efectivo</option>
                  </select>

                  {/* Selected Payment details preview */}
                  {(() => {
                    const selected = paymentPartners.find(
                      (p) => p.name === paymentMethod && p.active
                    );
                    if (selected && (selected.details || selected.logoUrl)) {
                      return (
                        <div className="p-2.5 rounded-xl border text-xs flex items-center space-x-2.5 bg-white border-slate-200 text-slate-700">
                          {selected.logoUrl && (
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <img
                                src={selected.logoUrl}
                                alt={selected.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-[11px] block">{selected.name}</span>
                            {selected.details && (
                              <span className="text-[10px] text-slate-500 block">
                                {selected.details}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-700">
                      Instrucciones o Notas adicionales:
                    </label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ej. Entregar después de las 15hs..."
                      className="w-full px-3 py-2 rounded-xl text-xs resize-none transition focus:outline-none bg-white border border-slate-200 text-slate-900 focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: ORDER CONFIRMED / SUCCESS RECEIPT */}
            {cartStep === 'success' && lastPlacedOrder && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center animate-bounce shadow-sm bg-emerald-100 text-emerald-700 border border-emerald-300">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">
                    ¡Pedido Enviado con Éxito!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tu orden ha sido registrada en el sistema con el número:
                  </p>
                  <span className="inline-block px-3 py-1 rounded-lg font-mono font-bold text-sm border shadow-xs bg-sky-50 text-sky-800 border-sky-200">
                    #{lastPlacedOrder.orderNumber}
                  </span>
                </div>

                {/* Status indicator */}
                {lastPlacedOrder.items.some(
                  (ci) => ci.item.stock <= 0 || ci.item.status === 'sold_out'
                ) ? (
                  <div className="w-full p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-left text-xs space-y-1.5 text-purple-900 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-purple-800">
                      <PackageCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span>🔍 Estado: Consultando al proveedor la disponibilidad</span>
                    </div>
                    <p className="text-[11px] text-purple-700 leading-relaxed">
                      Tu pedido ha sido clasificado bajo encargo. Hemos generado la consulta de disponibilidad inmediata con el proveedor y te contactaremos enseguida por WhatsApp.
                    </p>
                  </div>
                ) : (
                  <div className="w-full p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>🟢 Productos en bodega listos para despacho inmediato.</span>
                  </div>
                )}

                <div className="w-full p-4 rounded-2xl border text-left text-xs space-y-2 font-mono bg-slate-50 border-slate-200 text-slate-700">
                  <div className="flex justify-between border-b pb-2 border-slate-200">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-bold text-slate-900">
                      {lastPlacedOrder.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2 border-slate-200">
                    <span className="text-slate-500">Teléfono:</span>
                    <span>{lastPlacedOrder.customerPhone}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 text-emerald-700">
                    <span>Total:</span>
                    <span>${Number(lastPlacedOrder.totalAmount).toFixed(2)} {currency}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCartStep('cart');
                    setIsCartOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-md active:scale-95"
                >
                  Continuar en la Tienda
                </button>
              </div>
            )}

            {/* Cart Footer Summary & Action */}
            {cart.length > 0 && cartStep !== 'success' && (
              <div className="p-4 border-t space-y-3 bg-slate-50/90 border-slate-200">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ${cartSubtotal.toFixed(2)} {currency}
                    </span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Envío:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ${deliveryFee.toFixed(2)} {currency}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200 text-slate-900">
                    <span>Total:</span>
                    <span className="font-mono text-emerald-700">
                      ${cartTotal.toFixed(2)} {currency}
                    </span>
                  </div>
                </div>

                {cartStep === 'cart' ? (
                  <button
                    onClick={() => setCartStep('checkout')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <span>Continuar y Datos de Envío</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled={isSubmittingOrder}
                    onClick={handleSendViaWhatsApp}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>{isSubmittingOrder ? 'Enviando Pedido...' : '📲 Enviar Pedido por WhatsApp'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SHARE STORE FOR CLIENTS ONLY */}
      <ShareStoreModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        storeConfig={storeConfig}
        onShowToast={showToast}
      />

      {/* MODAL: DELETE ORDER CONFIRMATION */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">¿Eliminar este pedido?</h3>
                <p className="text-xs text-rose-600 font-medium">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Orden:</span>
                <span className="font-mono font-bold text-sky-700">#{orderToDelete.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-900">{orderToDelete.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Teléfono:</span>
                <span className="font-mono text-slate-800">{orderToDelete.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto Total:</span>
                <span className="font-mono font-bold text-emerald-700">
                  ${Number(orderToDelete.totalAmount).toFixed(2)} {currency}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={isDeletingOrder}
                onClick={handleConfirmDeleteOrder}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingOrder ? 'Eliminando...' : 'Sí, Eliminar Pedido'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM ORDER WITH MANDATORY PAYMENT VOUCHER (EXCEPT CASH) */}
      {orderToConfirm && (() => {
        const isCash = isCashPayment(orderToConfirm.paymentMethod);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-purple-200 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3 text-purple-700">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Confirmar Pedido Recibido</h3>
                    <p className="text-xs text-purple-700 font-medium">
                      {isCash
                        ? 'Pago en Efectivo / Contraentrega (Comprobante no requerido)'
                        : 'Ingreso obligatorio del Comprobante de Pago'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOrderToConfirm(null);
                    setVoucherError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order summary recap */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Orden a Confirmar:</span>
                  <span className="font-mono font-black text-sky-700 text-sm">#{orderToConfirm.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Cliente:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{orderToConfirm.customerName} ({orderToConfirm.customerPhone})</span>
                    {orderToConfirm.customerPhone && (
                      <button
                        type="button"
                        onClick={() => handleOpenDirectCustomerWhatsApp(orderToConfirm)}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                        title="Abrir chat de WhatsApp directamente con el cliente (sin mensaje)"
                      >
                        <MessageCircle className="w-3 h-3 fill-current" />
                        <span>WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Monto Total:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    ${Number(orderToConfirm.totalAmount).toFixed(2)} {currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Método de Pago:</span>
                  <span className={`font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                    isCash ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-purple-50 text-purple-800 border border-purple-200'
                  }`}>
                    {orderToConfirm.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Payment Type Notice */}
              {isCash ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2.5">
                  <Banknote className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-900">Pago en Efectivo / Contraentrega</p>
                    <p className="text-[11px] text-emerald-700">No es necesario ingresar comprobante de pago. Puedes confirmar directamente el pedido.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center space-x-2.5">
                  <Receipt className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-purple-900">Pago por Transferencia / Depósito</p>
                    <p className="text-[11px] text-purple-700">Debes ingresar el número de comprobante o transacción verificado para confirmar el pedido.</p>
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Número de Comprobante / Transacción / Depósito {!isCash && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <Receipt className="w-4 h-4 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required={!isCash}
                      autoFocus
                      placeholder={isCash ? 'Opcional (Ej. Pago en efectivo verificado)' : 'Ej. TRANSF-9823441 / DEP-002193'}
                      value={voucherInput}
                      onChange={(e) => {
                        setVoucherInput(e.target.value);
                        if (voucherError) setVoucherError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (isCash || voucherInput.trim())) {
                          handleConfirmOrderWithVoucher();
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 font-mono text-sm focus:outline-none focus:border-purple-500 focus:bg-white transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isCash
                      ? 'Opcional: Si el cliente entregó un recibo o billetes específicos, puedes anotarlo aquí.'
                      : 'Ingresa el código o número de transferencia bancaria verificado antes de pasar al estado confirmado.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notas de Confirmación (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder={isCash ? 'Ej. Efectivo cobrado en local / contraentrega' : 'Ej. Transferencia Banco Pichincha verificada'}
                    value={voucherNotesInput}
                    onChange={(e) => setVoucherNotesInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-purple-500 focus:bg-white"
                  />
                </div>

                {voucherError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <span>{voucherError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 flex-wrap gap-y-2">
                <button
                  disabled={isConfirmingOrder}
                  onClick={() => {
                    setOrderToConfirm(null);
                    setVoucherError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  disabled={isConfirmingOrder || (!isCash && !voucherInput.trim())}
                  onClick={() => handleConfirmOrderWithVoucher(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <BadgeCheck className="w-4 h-4" />
                  <span>{isConfirmingOrder ? 'Confirmando...' : 'Confirmar'}</span>
                </button>
                <button
                  disabled={isConfirmingOrder || (!isCash && !voucherInput.trim())}
                  onClick={() => handleConfirmOrderWithVoucher(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Confirmar y Enviar a WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: MANAGE SHIPPING GUIDE, TRACKING & CI / ADDRESS DATA (INTEGRATED) */}
      {orderToShip && (
        <ManageShippingGuideModal
          order={orderToShip}
          storeConfig={storeConfig}
          courierPartners={courierPartners}
          currency={currency}
          onClose={() => setOrderToShip(null)}
          onSaveShippingData={handleSaveShippingGuideData}
          onPrintShippingTicket={(ord) => setOrderToPrintShipping(ord)}
          onOpenEditOrder={handleOpenEditOrder}
          onOpenDeleteOrder={(ord) => setOrderToDelete(ord)}
          showToast={showToast}
        />
      )}

      {/* MODAL: GESTIONAR SERVICIO DE ENVÍO PARA PEDIDOS PENDIENTES (3 PASOS EN ORDEN + MODIFICAR/ELIMINAR) */}
      {orderForPendingShipping && (
        <ManagePendingShippingModal
          order={orderForPendingShipping}
          storeConfig={storeConfig}
          courierPartners={courierPartners}
          paymentPartners={paymentPartners}
          currency={currency}
          onClose={() => setOrderForPendingShipping(null)}
          onUpdateOrder={onUpdateOrder}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onOpenEditOrder={handleOpenEditOrder}
          onOpenDeleteOrder={(ord) => setOrderToDelete(ord)}
          onPrintShippingTicket={(ord) => setOrderToPrintShipping(ord)}
          showToast={showToast}
        />
      )}

      {/* MODAL: EDIT ORDER DETAILS & INCREASE/MODIFY PRODUCTS */}
      {orderToEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-sky-200 rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-xl space-y-4 my-auto animate-scaleUp max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center space-x-3 text-sky-700">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Modificar Detalle del Pedido</h3>
                    <span className="font-mono font-black text-sky-700 text-xs px-2 py-0.5 bg-sky-50 rounded-md border border-sky-200">
                      #{orderToEdit.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Aumenta productos, ajusta cantidades o cambia el método de pago</p>
                </div>
              </div>
              <button
                onClick={() => setOrderToEdit(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Section 1: Customer & Delivery Info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  Datos del Cliente & Modalidad de Entrega
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nombre del Cliente:</label>
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      placeholder="Ej. Carlos Andrade"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                      <span>Cédula / C.I. / RUC:</span>
                      <span className="text-[10px] text-sky-600 font-medium font-mono">Facturación / Guía</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="w-3.5 h-3.5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={editCustomerCi}
                        onChange={(e) => setEditCustomerCi(e.target.value)}
                        placeholder="Ej. 0912345678"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    {editCustomerCi.trim() ? (
                      <p className="text-[10px] text-emerald-700 font-mono mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                        <span>Identificación: {editCustomerCi.trim().length} dígitos</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">
                        C.I. para guía o comprobante
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 font-semibold">Teléfono / WhatsApp:</label>
                      {editCustomerPhone.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const norm = normalizeEcuadorPhone(editCustomerPhone);
                            if (norm.whatsappDigits && norm.isValid) {
                              window.open(buildWhatsAppLink(norm.whatsappDigits), '_blank');
                            } else {
                              showToast('⚠️ Ingresa un número válido para abrir WhatsApp');
                            }
                          }}
                          className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                          title="Abrir chat de WhatsApp directamente"
                        >
                          <MessageCircle className="w-3 h-3 fill-current" />
                          <span>Abrir WhatsApp</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="Ej. 0983302390 o +593983302390"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-sky-500"
                    />
                    {editCustomerPhone.trim() ? (
                      (() => {
                        const norm = normalizeEcuadorPhone(editCustomerPhone);
                        if (norm.isValid) {
                          return (
                            <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1.5 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Válido: {norm.formattedLocal} ({norm.international})</span>
                            </div>
                          );
                        }
                        return (
                          <div className="mt-1 text-[11px] text-amber-700 flex items-center gap-1.5 font-mono">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Incompleto (10 dígitos Ecuador)</span>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[10px] text-amber-700 mt-1">
                        ⚠️ Sin número de WhatsApp. Agrégalo para poder contactar al cliente por chat.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tipo de Entrega:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditDeliveryType('shipping');
                          if (editCustomerAddress.trim().toLowerCase().includes('retiro') || editCustomerAddress.trim().toLowerCase().includes('local')) {
                            setEditCustomerAddress('');
                          }
                        }}
                        className={`py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                          editDeliveryType === 'shipping'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>A Domicilio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditDeliveryType('pickup');
                          setEditShippingCost('0');
                          setEditTrackingCarrier('');
                          setEditTrackingNumber('');
                          setEditTrackingNotes('');
                          if (!editCustomerAddress.trim() || editCustomerAddress.trim() === 'Envío a Domicilio') {
                            setEditCustomerAddress('Retiro en Local');
                          }
                        }}
                        className={`py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                          editDeliveryType === 'pickup'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>Retiro en Local</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      {editDeliveryType === 'pickup' ? 'Lugar de Retiro:' : 'Dirección de Entrega:'}
                    </label>
                    <input
                      type="text"
                      value={editCustomerAddress}
                      onChange={(e) => setEditCustomerAddress(e.target.value)}
                      placeholder={editDeliveryType === 'pickup' ? 'Local Principal / Bodega' : 'Ej. Av. 9 de Octubre y Malecón'}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Valor de Envío field */}
                  {editDeliveryType === 'shipping' && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sky-800 font-bold text-xs flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-sky-600" />
                          Valor del Envío / Flete ($):
                        </label>
                        <span className="text-[10px] text-slate-500">Ingresa el valor acordado tras chatear con el cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editShippingCost}
                            onChange={(e) => setEditShippingCost(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-sky-300 text-emerald-700 font-mono font-bold focus:outline-none focus:border-sky-500 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['0.00', '3.50', '5.00', '7.00'].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setEditShippingCost(val)}
                              className={`px-2.5 py-2 rounded-xl text-[11px] font-mono font-bold border transition cursor-pointer ${
                                Number(editShippingCost) === Number(val)
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                              }`}
                            >
                              {val === '0.00' ? 'Gratis ($0)' : `$${val}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Payment Method, Status & Voucher */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                  Método de Pago, Estado & Comprobante
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Método de Pago (Configurados en Tienda):</label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {/* Preserve previous value if configured methods changed */}
                      {editPaymentMethod && !activeConfiguredPayments.some((p) => p.name.toLowerCase() === editPaymentMethod.toLowerCase()) && (
                        <option value={editPaymentMethod}>
                          💳 {editPaymentMethod} (Guardado en pedido)
                        </option>
                      )}
                      {activeConfiguredPayments.map((partner) => (
                        <option key={partner.id} value={partner.name}>
                          💳 {partner.name} {partner.details ? `(${partner.details})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Estado del Pedido:</label>
                    <select
                      value={editStatus}
                      onChange={(e) => {
                        const newSt = e.target.value as any;
                        if ((newSt === 'shipped' || newSt === 'delivered') && !editPaymentVoucher.trim() && orderToEdit?.status === 'pending') {
                          showToast('ℹ️ Recuerda ingresar el N° de comprobante para registrar la confirmación del pago');
                        }
                        setEditStatus(newSt);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="pending">🕒 Pendiente</option>
                      <option value="confirmed">🟣 Confirmado</option>
                      <option value="shipped">🚚 Enviado (Requiere Confirmación previa)</option>
                      <option value="delivered">✅ Entregado (Requiere Confirmación previa)</option>
                      <option value="cancelled">❌ Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">N° Comprobante / Transf.:</label>
                    <input
                      type="text"
                      value={editPaymentVoucher}
                      onChange={(e) => setEditPaymentVoucher(e.target.value)}
                      placeholder="Ej. TRANSF-098124"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-purple-700 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Notas u Observaciones del Pedido:</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Ej. Entregar en horario de la tarde / Cliente solicitó aumento de 1 producto"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Delivery details / Tracking & Courier fields in Edit Modal */}
                {editDeliveryType === 'pickup' ? (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center space-x-2 text-amber-900">
                      <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        <strong>Modalidad: Retiro en Local / Tienda</strong>. Este pedido no requiere empresa de transporte ni número de guía de envío.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-slate-700 font-semibold text-xs">Empresa de Transporte / Courier:</label>
                        <span className="text-[10px] text-blue-700 font-medium">Seleccionar de transportes registrados</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {courierPartners
                          .filter((c) => c.active !== false)
                          .map((c) => (
                            <button
                              key={c.id || c.name}
                              type="button"
                              onClick={() => setEditTrackingCarrier(c.name)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                                editTrackingCarrier.toLowerCase() === c.name.toLowerCase()
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900'
                              }`}
                            >
                              {c.logoUrl ? (
                                <img src={c.logoUrl} alt={c.name} className="w-3 h-3 object-contain rounded-xs bg-white p-0.2" />
                              ) : (
                                <Truck className="w-3 h-3 text-blue-600" />
                              )}
                              <span>{c.name}</span>
                            </button>
                          ))}
                      </div>
                      <input
                        type="text"
                        value={editTrackingCarrier}
                        onChange={(e) => setEditTrackingCarrier(e.target.value)}
                        placeholder="Ej. Servientrega / Laar / Urbano"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-blue-700 font-semibold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">N° de Guía / Tracking:</label>
                        <input
                          type="text"
                          value={editTrackingNumber}
                          onChange={(e) => setEditTrackingNumber(e.target.value)}
                          placeholder="Ej. 109284719"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-blue-700 font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Nota / Enlace Seguimiento:</label>
                        <input
                          type="text"
                          value={editTrackingNotes}
                          onChange={(e) => setEditTrackingNotes(e.target.value)}
                          placeholder="Ej. Llega en 24h"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Products Detail & Add Products */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Detalle de Productos en el Pedido ({editItems.length})
                  </span>
                  <span className="text-emerald-700 font-mono font-bold text-xs">
                    Subtotal: ${editSubtotal.toFixed(2)} {currency}
                  </span>
                </div>

                {/* Items in the order */}
                {editItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-300 rounded-xl text-slate-500 bg-white">
                    <Package className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                    <p>No hay productos en el pedido. Agrega productos desde el buscador inferior.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {editItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 gap-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 truncate">{item.name}</p>
                            {item.sku && (
                              <span className="text-[10px] font-mono text-slate-500">SKU: {item.sku}</span>
                            )}
                          </div>
                        </div>

                        {/* Price Input & Quantity Controls */}
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-500 text-[10px]">Precio $</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.salePrice}
                              onChange={(e) => {
                                const newPrice = Math.max(0, Number(e.target.value) || 0);
                                setEditItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, salePrice: newPrice } : it))
                                );
                              }}
                              className="w-16 px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-right font-mono font-bold text-emerald-700 text-xs focus:outline-none focus:border-sky-500"
                            />
                          </div>

                          <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  setEditItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity - 1 } : it))
                                  );
                                } else {
                                  setEditItems((prev) => prev.filter((_, i) => i !== idx));
                                }
                              }}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center font-mono font-black text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it))
                                );
                              }}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-16 text-right font-mono font-bold text-slate-900">
                            ${(Number(item.salePrice) * Number(item.quantity)).toFixed(2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Quitar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add product from catalog search */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    ➕ Aumentar Productos del Catálogo al Pedido:
                  </span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={editProductSearch}
                      onChange={(e) => setEditProductSearch(e.target.value)}
                      placeholder="Buscar por nombre, SKU o categoría para aumentar al pedido..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Catalog items results */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {filteredProductsForEdit.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-sky-400 transition shadow-xs"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate text-[11px]">{prod.name}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                              <span className="text-emerald-700 font-bold">${Number(prod.salePrice).toFixed(2)}</span>
                              <span>•</span>
                              <span>Stock: {prod.stock}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((prev) => {
                              const existing = prev.find((it) => it.id === prod.id || it.sku === prod.sku);
                              if (existing) {
                                return prev.map((it) =>
                                  it.id === prod.id || it.sku === prod.sku
                                    ? { ...it, quantity: it.quantity + 1 }
                                    : it
                                );
                              } else {
                                return [
                                  ...prev,
                                  {
                                    id: prod.id,
                                    name: prod.name,
                                    sku: prod.sku,
                                    salePrice: Number(prod.salePrice) || 0,
                                    quantity: 1,
                                    imageUrl: prod.imageUrl || null,
                                  },
                                ];
                              }
                            });
                            showToast(`✓ Agregado al pedido: ${prod.name}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] transition cursor-pointer flex items-center space-x-1 flex-shrink-0 shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add custom item toggle */}
                  {!isAddingCustomEditItem ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomEditItem(true)}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Agregar ítem o cargo personalizado fuera de catálogo</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                        <span>Ítem Personalizado / Cargo Especial</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingCustomEditItem(false)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Nombre del producto o servicio"
                            value={editCustomItemName}
                            onChange={(e) => setEditCustomItemName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Precio $"
                            value={editCustomItemPrice}
                            onChange={(e) => setEditCustomItemPrice(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-emerald-700 font-mono text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!editCustomItemName.trim()) {
                            showToast('⚠️ Ingresa el nombre del ítem');
                            return;
                          }
                          const price = Number(editCustomItemPrice) || 0;
                          setEditItems((prev) => [
                            ...prev,
                            {
                              name: editCustomItemName.trim(),
                              sku: 'CUSTOM',
                              salePrice: price,
                              quantity: 1,
                              imageUrl: null,
                            },
                          ]);
                          setEditCustomItemName('');
                          setEditCustomItemPrice('');
                          setIsAddingCustomEditItem(false);
                          showToast('✓ Ítem personalizado agregado');
                        }}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Insertar Ítem al Pedido
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-shrink-0">
              <div className="flex flex-col">
                <div className="flex items-baseline space-x-2">
                  <span className="text-slate-500 text-xs">Total Actualizado:</span>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    ${editTotal.toFixed(2)} {currency}
                  </span>
                  <span className="text-[11px] text-slate-500">({editItems.length} artículos)</span>
                </div>
                {editDeliveryType === 'shipping' && Number(editShippingCost) > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Subtotal: ${editSubtotal.toFixed(2)} + Envío: ${Number(editShippingCost).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <button
                  type="button"
                  disabled={isSavingEditOrder}
                  onClick={() => setOrderToEdit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={isSavingEditOrder || editItems.length === 0}
                  onClick={() => handleSaveEditOrder(false)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingEditOrder ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingEditOrder || editItems.length === 0}
                  onClick={() => handleSaveEditOrder(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>Guardar y Enviar a WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ORDER CREATION (Admin / Seller) */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-emerald-200 rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-xl space-y-4 my-auto animate-scaleUp max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center space-x-3 text-emerald-700">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Crear Pedido Manual</h3>
                  <p className="text-xs text-slate-500">
                    Ingresa el teléfono o WhatsApp del cliente, asigna los productos y envíale su ticket directo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Section 1: Customer CI & Contact Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    Datos del Cliente & Modalidad de Entrega
                  </span>
                  {matchedCustomerInfo && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Cliente Reconocido ({matchedCustomerInfo.source || 'Registrado'})</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Cédula / C.I. (FIRST FIELD) */}
                  <div className="relative">
                    <label className="block text-slate-800 font-bold mb-1 flex items-center justify-between">
                      <span>Cédula / C.I. / RUC:</span>
                      <span className="text-[10px] text-emerald-700 font-mono font-medium">Búsqueda Automática</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                      <input
                        type="text"
                        autoFocus
                        value={manualCustomerCi}
                        onChange={(e) => handleManualCustomerCiChange(e.target.value)}
                        onFocus={() => {
                          if (manualCustomerCi.trim().length >= 2 && matchingCustomerSuggestions.length > 0) {
                            setShowCustomerSuggestions(true);
                          }
                        }}
                        placeholder="Ej. 0912345678"
                        className="w-full pl-9 pr-7 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-semibold"
                      />
                      {manualCustomerCi && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualCustomerCi('');
                            setMatchedCustomerInfo(null);
                            setShowCustomerSuggestions(false);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                          title="Borrar identificación"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Customer Autocomplete Suggestions Dropdown */}
                    {showCustomerSuggestions && matchingCustomerSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-emerald-300 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        <div className="px-2.5 py-1.5 bg-emerald-50 text-[10px] font-bold text-emerald-800 flex items-center justify-between">
                          <span>Clientes encontrados con esta C.I.:</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomerSuggestions(false)}
                            className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {matchingCustomerSuggestions.map((cust, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectCustomerForManualOrder(cust)}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-xs truncate">
                                {cust.name || 'Cliente registrado'}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                <span className="text-emerald-700 font-bold">CI: {cust.ci}</span>
                                {cust.phone && <span>• Tel: {cust.phone}</span>}
                              </div>
                            </div>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                              {cust.source || 'Registrado'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {matchedCustomerInfo ? (
                      <div className="mt-1 text-[10px] text-emerald-700 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">✓ Datos de <strong>{matchedCustomerInfo.name || matchedCustomerInfo.ci}</strong> cargados</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Si ya existe, completa los datos automáticamente
                      </p>
                    )}
                  </div>

                  {/* 2. Teléfono o WhatsApp (SECOND FIELD) */}
                  <div>
                    <label className="block text-slate-800 font-bold mb-1">
                      Teléfono o WhatsApp <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={manualCustomerPhone}
                        onChange={(e) => setManualCustomerPhone(e.target.value)}
                        placeholder="Ej. 0983302390 o +593983302390"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    {manualCustomerPhone.trim() ? (
                      (() => {
                        const norm = normalizeEcuadorPhone(manualCustomerPhone);
                        if (norm.isValid) {
                          return (
                            <div className="mt-1 text-[10px] text-emerald-700 flex items-center gap-1 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp Válido ({norm.formattedLocal})</span>
                            </div>
                          );
                        }
                        return (
                          <p className="text-[10px] text-amber-600 mt-1 font-mono">
                            10 dígitos (Ej: 0983302390)
                          </p>
                        );
                      })()
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Para chat de WhatsApp y notificaciones
                      </p>
                    )}
                  </div>

                  {/* 3. Nombre del Cliente (THIRD FIELD) */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nombre (Opcional):</label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={manualCustomerName}
                        onChange={(e) => setManualCustomerName(e.target.value)}
                        placeholder="Ej. María Gómez"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Nombre o razón social
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Modalidad de Entrega:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setManualDeliveryType('shipping')}
                        className={`py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                          manualDeliveryType === 'shipping'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>A Domicilio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualDeliveryType('pickup')}
                        className={`py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                          manualDeliveryType === 'pickup'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>Retiro en Local</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      {manualDeliveryType === 'pickup' ? 'Lugar de Retiro:' : 'Dirección de Entrega:'}
                    </label>
                    <input
                      type="text"
                      value={manualCustomerAddress}
                      onChange={(e) => setManualCustomerAddress(e.target.value)}
                      placeholder={manualDeliveryType === 'pickup' ? 'Local Principal / Bodega' : 'Ej. Cdla. Kennedy Norte Mz 12'}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Payment & Status */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                  Método de Pago & Estado Inicial
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Método de Pago (Configurados en Tienda):</label>
                    <select
                      value={manualPaymentMethod}
                      onChange={(e) => setManualPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {activeConfiguredPayments.map((partner) => (
                        <option key={partner.id} value={partner.name}>
                          💳 {partner.name} {partner.details ? `(${partner.details})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Estado Inicial:</label>
                    <select
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="pending">🕒 Pendiente</option>
                      <option value="confirmed">🟣 Confirmado</option>
                      <option value="shipped">🚚 Enviado</option>
                      <option value="delivered">✅ Entregado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Comprobante de Pago (Opcional):</label>
                    <input
                      type="text"
                      value={manualPaymentVoucher}
                      onChange={(e) => setManualPaymentVoucher(e.target.value)}
                      placeholder="Ej. TRANSF-099231"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-purple-700 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Notas u Observaciones:</label>
                  <input
                    type="text"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Ej. Pedido acordado por llamada / Enviar por Servientrega"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Section 3: Select Products (Order Detail) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Detalle de Productos Seleccionados ({manualItems.length})
                  </span>
                  <span className="text-emerald-700 font-mono font-bold text-xs">
                    Subtotal: ${manualSubtotal.toFixed(2)} {currency}
                  </span>
                </div>

                {/* Selected items list */}
                {manualItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-300 rounded-xl text-slate-500 bg-white">
                    <Package className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-emerald-600" />
                    <p>Agrega los productos del pedido desde el catálogo o agrega un ítem personalizado abajo.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {manualItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 gap-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 truncate">{item.name}</p>
                            {item.sku && (
                              <span className="text-[10px] font-mono text-slate-500">SKU: {item.sku}</span>
                            )}
                          </div>
                        </div>

                        {/* Price Input & Quantity Controls */}
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-500 text-[10px]">Precio $</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.salePrice}
                              onChange={(e) => {
                                const newPrice = Math.max(0, Number(e.target.value) || 0);
                                setManualItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, salePrice: newPrice } : it))
                                );
                              }}
                              className="w-16 px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-right font-mono font-bold text-emerald-700 text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  setManualItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity - 1 } : it))
                                  );
                                } else {
                                  setManualItems((prev) => prev.filter((_, i) => i !== idx));
                                }
                              }}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center font-mono font-black text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setManualItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it))
                                );
                              }}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="w-16 text-right font-mono font-bold text-slate-900">
                            ${(Number(item.salePrice) * Number(item.quantity)).toFixed(2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => setManualItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Quitar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search in catalog to add */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    ➕ Buscar y Agregar Productos del Catálogo:
                  </span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={manualProductSearch}
                      onChange={(e) => setManualProductSearch(e.target.value)}
                      placeholder="Buscar por nombre, SKU o categoría..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Catalog items results */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {filteredProductsForManual.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 transition shadow-xs"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate text-[11px]">{prod.name}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                              <span className="text-emerald-700 font-bold">${Number(prod.salePrice).toFixed(2)}</span>
                              <span>•</span>
                              <span>Stock: {prod.stock}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setManualItems((prev) => {
                              const existing = prev.find((it) => it.id === prod.id || it.sku === prod.sku);
                              if (existing) {
                                return prev.map((it) =>
                                  it.id === prod.id || it.sku === prod.sku
                                    ? { ...it, quantity: it.quantity + 1 }
                                    : it
                                );
                              } else {
                                return [
                                  ...prev,
                                  {
                                    id: prod.id,
                                    name: prod.name,
                                    sku: prod.sku,
                                    salePrice: Number(prod.salePrice) || 0,
                                    quantity: 1,
                                    imageUrl: prod.imageUrl || null,
                                  },
                                ];
                              }
                            });
                            showToast(`✓ Agregado: ${prod.name}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer flex items-center space-x-1 flex-shrink-0 shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add custom item toggle */}
                  {!isAddingCustomManualItem ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomManualItem(true)}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Agregar ítem personalizado fuera de catálogo</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                        <span>Ítem Personalizado / Cargo Especial</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingCustomManualItem(false)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Nombre del producto o servicio"
                            value={manualCustomItemName}
                            onChange={(e) => setManualCustomItemName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Precio $"
                            value={manualCustomItemPrice}
                            onChange={(e) => setManualCustomItemPrice(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-emerald-700 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!manualCustomItemName.trim()) {
                            showToast('⚠️ Ingresa el nombre del ítem');
                            return;
                          }
                          const price = Number(manualCustomItemPrice) || 0;
                          setManualItems((prev) => [
                            ...prev,
                            {
                              name: manualCustomItemName.trim(),
                              sku: 'CUSTOM',
                              salePrice: price,
                              quantity: 1,
                              imageUrl: null,
                            },
                          ]);
                          setManualCustomItemName('');
                          setManualCustomItemPrice('');
                          setIsAddingCustomManualItem(false);
                          showToast('✓ Ítem personalizado agregado');
                        }}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Insertar Ítem al Pedido
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-shrink-0">
              <div className="flex items-baseline space-x-2">
                <span className="text-slate-500 text-xs">Total del Pedido:</span>
                <span className="text-lg font-black text-emerald-700 font-mono">
                  ${manualSubtotal.toFixed(2)} {currency}
                </span>
                <span className="text-[11px] text-slate-500">({manualItems.length} artículos)</span>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <button
                  type="button"
                  disabled={isSubmittingManualOrder}
                  onClick={() => setIsManualOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={isSubmittingManualOrder || manualItems.length === 0 || !manualCustomerPhone.trim()}
                  onClick={() => handleSaveManualOrder(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingManualOrder ? 'Creando Pedido...' : 'Guardar Pedido'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmittingManualOrder || manualItems.length === 0 || !manualCustomerPhone.trim()}
                  onClick={() => handleSaveManualOrder(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>Guardar y Enviar Ticket por WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK SET / EDIT SHIPPING COST & SEND PAYMENT DETAILS */}
      {orderToSetShipping && (() => {
        const items = Array.isArray(orderToSetShipping.items) ? orderToSetShipping.items : [];
        const itemsSub = items.reduce((acc: number, it: any) => acc + (Number(it.salePrice || it.item?.salePrice || 0) * (Number(it.quantity) || 1)), 0);
        const shipCost = Math.max(0, Number(quickShippingCostInput) || 0);
        const newTotal = itemsSub + shipCost;
        const activePartners = paymentPartners.filter((p) => p.active !== false);
        const currentPartner = activePartners.find((p) => p.id === selectedQuickPaymentPartnerId) || activePartners[0];
        const isCash = isCashPayment(orderToSetShipping.paymentMethod) || (currentPartner && isCashPayment(currentPartner.name));

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white border border-sky-200 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-xl space-y-4 my-auto animate-scaleUp max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
                <div className="flex items-center space-x-3 text-sky-700">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Asignar Envío y Enviar Datos de Pago</h3>
                    <p className="text-xs text-slate-500">Pedido #{orderToSetShipping.orderNumber} • {orderToSetShipping.customerName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOrderToSetShipping(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
                {/* Order items recap */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal de Productos:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      ${itemsSub.toFixed(2)} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Destino / Dirección:</span>
                    <span className="text-slate-800 text-right truncate max-w-[260px] font-medium">{orderToSetShipping.customerAddress || 'Envío a Domicilio'}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Teléfono WhatsApp:</span>
                    <span className="font-mono text-emerald-700 font-bold">{orderToSetShipping.customerPhone || 'Sin teléfono'}</span>
                  </div>
                </div>

                {/* Carrier Selection */}
                <div>
                  <label className="block text-slate-800 font-bold mb-1">1. Empresa de Transporte / Courier:</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {courierPartners
                      .filter((c) => c.active !== false)
                      .map((c) => (
                        <button
                          key={c.id || c.name}
                          type="button"
                          onClick={() => setQuickShippingCarrierInput(c.name)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                            quickShippingCarrierInput.toLowerCase() === c.name.toLowerCase()
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {c.logoUrl ? (
                            <img src={c.logoUrl} alt={c.name} className="w-3.5 h-3.5 object-contain rounded-xs bg-white p-0.5" />
                          ) : (
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{c.name}</span>
                        </button>
                      ))}
                  </div>
                  <input
                    type="text"
                    value={quickShippingCarrierInput}
                    onChange={(e) => setQuickShippingCarrierInput(e.target.value)}
                    placeholder="Ej. Servientrega, LaarCourier, Urbano..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 font-semibold"
                  />

                  {/* Enlace para abrir cotizador web si existe */}
                  {(() => {
                    const matched = courierPartners.find(
                      (c) =>
                        c.name.toLowerCase() === (quickShippingCarrierInput || '').trim().toLowerCase() ||
                        (quickShippingCarrierInput && c.name.toLowerCase().includes(quickShippingCarrierInput.trim().toLowerCase()))
                    );
                    if (matched?.quoteUrl?.trim()) {
                      return (
                        <div className="mt-1.5 p-2 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <ExternalLink className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="text-[11px] font-bold text-sky-900 truncate">
                              Cotizador Web de {matched.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const url = matched.quoteUrl!.trim();
                              const target = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
                              window.open(target, '_blank', 'noopener,noreferrer');
                            }}
                            className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shrink-0"
                            title={`Abrir portal de cotizaciones de ${matched.name} en una ventana nueva`}
                          >
                            <span>Abrir Cotizador</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Shipping cost input & quick chips */}
                <div>
                  <label className="block text-slate-800 font-bold mb-1">2. Valor del Envío / Flete ($):</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={quickShippingCostInput}
                        onChange={(e) => setQuickShippingCostInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-sky-300 text-emerald-700 font-mono font-bold text-sm focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['0.00', '3.50', '5.00', '7.00'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQuickShippingCostInput(val)}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-mono font-bold border transition cursor-pointer ${
                            Number(quickShippingCostInput) === Number(val)
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                          }`}
                        >
                          {val === '0.00' ? 'Gratis' : `$${val}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Payment Method Details to Send */}
                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-800 font-bold">
                      3. Método de Pago a Enviar por WhatsApp:
                    </label>
                    <span className="text-[10px] text-purple-700 font-medium">
                      Pedido original: {orderToSetShipping.paymentMethod || 'No especificado'}
                    </span>
                  </div>

                  {activePartners.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activePartners.map((partner) => (
                        <button
                          key={partner.id}
                          type="button"
                          onClick={() => setSelectedQuickPaymentPartnerId(partner.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                            (selectedQuickPaymentPartnerId === partner.id || (!selectedQuickPaymentPartnerId && activePartners[0]?.id === partner.id))
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {partner.logoUrl ? (
                            <img src={partner.logoUrl} alt={partner.name} className="w-3.5 h-3.5 object-contain rounded-xs bg-white p-0.5" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span>{partner.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {currentPartner?.details && (
                    <div className="p-2.5 rounded-lg bg-white border border-purple-200 text-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                      {currentPartner.details}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Nota o instrucción adicional (opcional):</label>
                    <input
                      type="text"
                      value={quickShippingPaymentNote}
                      onChange={(e) => setQuickShippingPaymentNote(e.target.value)}
                      placeholder="Ej. Enviar comprobante indicando tu nombre..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Total Calculation Preview */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-slate-800 font-bold block">Total Final (Productos + Envío):</span>
                    <span className="text-[10px] text-slate-500">
                      ${itemsSub.toFixed(2)} + ${shipCost.toFixed(2)} envío
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    ${newTotal.toFixed(2)} {currency}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  disabled={isSavingQuickShipping}
                  onClick={() => setOrderToSetShipping(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={isSavingQuickShipping}
                    onClick={() => handleSaveQuickShipping(false)}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingQuickShipping ? 'Guardando...' : 'Solo Guardar'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSavingQuickShipping}
                    onClick={() => handleSaveQuickShipping(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-current" />
                    <span>Guardar y Enviar a WhatsApp con Datos de Pago</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: PRINT SHIPPING TICKET & LABEL */}
      {orderToPrintShipping && (
        <ShippingTicketModal
          order={orderToPrintShipping}
          storeConfig={storeConfig}
          currency={currency}
          onClose={() => setOrderToPrintShipping(null)}
          showToast={showToast}
        />
      )}

      {/* MODAL: REQUEST EXACT SHIPPING DATA VIA WHATSAPP & UPDATE ADDRESS */}
      {orderToRequestShippingData && (
        <RequestShippingDataModal
          order={orderToRequestShippingData}
          storeConfig={storeConfig}
          onClose={() => setOrderToRequestShippingData(null)}
          onSaveAddress={handleSaveUpdatedShippingAddress}
          showToast={showToast}
          buildWhatsAppLink={buildWhatsAppLink}
        />
      )}

      {/* MODAL: PUBLIC PROMOTIONAL CAMPAIGN POPUP / BANNER */}
      {(isCustomerOnly || storeTab === 'catalog') && (
        <StorePromoModal
          config={storeConfig?.promoPopup}
          storeName={storeConfig?.storeName || 'Comerxia Store'}
          whatsappNumber={storeConfig?.whatsappNumber || ''}
          currency={currency}
          onFilterOffers={() => {
            setShowOffersOnly(true);
            setSelectedCategory('all');
          }}
        />
      )}
    </div>
  );
};
