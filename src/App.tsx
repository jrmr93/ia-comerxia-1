import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { StatsBanner } from './components/StatsBanner.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { TelegramMessagesFeed } from './components/TelegramMessagesFeed.tsx';
import { OnlineStoreView } from './components/OnlineStoreView.tsx';
import { TelegramSimulatorModal } from './components/TelegramSimulatorModal.tsx';
import { TelegramBotConfigModal } from './components/TelegramBotConfigModal.tsx';
import { GoogleAiConfigModal } from './components/GoogleAiConfigModal.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { ProductFormModal } from './components/ProductFormModal.tsx';
import { LocalDeploymentModal } from './components/LocalDeploymentModal.tsx';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal.tsx';
import { AdminLoginScreen } from './components/AdminLoginScreen.tsx';
import { AdminProfileModal } from './components/AdminProfileModal.tsx';
import { CustomersView } from './components/CustomersView.tsx';
import { AnalyticsDashboard } from './components/AnalyticsDashboard.tsx';
import { PurchasesView } from './components/PurchasesView.tsx';
import { CustomerOrder, InventoryItem, InventoryStats, ServerDomainConfig, StoreConfig, StoreTheme, TelegramConfig, TelegramMessage } from './types.ts';
import { parseThemePalettes, getThemeColors } from './utils/themeColors.ts';
import { safeLocalStorage } from './utils/safeStorage.ts';
import {
  Bot,
  Database,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Store,
} from 'lucide-react';

function InventoryApp() {
  const { authFetch, user, isAdmin, isOperator, loading: authLoading } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [highlightPurchaseId, setHighlightPurchaseId] = useState<number | undefined>(undefined);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    storeName: 'Comerxia Store',
    whatsappNumber: '',
    description: 'Catálogo digital con envíos y pedidos directos por WhatsApp',
    bannerText: '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',
    deliveryFee: 0,
    minOrderAmount: 0,
    currency: 'USD',
  });
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [domainConfig, setDomainConfig] = useState<ServerDomainConfig | null>(null);
  const [serverStats, setServerStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Dynamically recalculate real-time metrics strictly from current items in inventory
  const stats: InventoryStats = useMemo(() => {
    const totalProducts = items.length;
    const totalUnits = items.reduce((acc, it) => acc + (Number(it.stock) || 0), 0);
    const totalCostValue = items.reduce(
      (acc, it) => acc + (Number(it.costPrice) || 0) * (Number(it.stock) || 0),
      0
    );
    const totalSaleValue = items.reduce(
      (acc, it) => acc + (Number(it.salePrice) || 0) * (Number(it.stock) || 0),
      0
    );
    const estimatedProfit = totalSaleValue - totalCostValue;

    let totalDiscountValue = 0;
    let totalDiscountedSaleValue = 0;
    let discountedProductsCount = 0;

    items.forEach((it) => {
      const regular = Number(it.salePrice) || 0;
      const stock = Number(it.stock) || 0;
      const disc = Math.max(0, Math.min(100, Number(it.discountPercent) || 0));
      if (disc > 0) {
        discountedProductsCount += 1;
        const discountAmountPerUnit = regular * (disc / 100);
        totalDiscountValue += discountAmountPerUnit * stock;
        const effectiveSalePerUnit = regular * (1 - disc / 100);
        totalDiscountedSaleValue += effectiveSalePerUnit * stock;
      } else {
        totalDiscountedSaleValue += regular * stock;
      }
    });

    const profitWithDiscounts = totalDiscountedSaleValue - totalCostValue;

    const categoryMap: Record<string, { count: number; stock: number }> = {};
    for (const item of items) {
      const cat = item.category || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { count: 0, stock: 0 };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].stock += Number(item.stock) || 0;
    }

    return {
      totalProducts,
      totalUnits,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      totalSaleValue: Math.round(totalSaleValue * 100) / 100,
      estimatedProfit: Math.round(estimatedProfit * 100) / 100,
      totalDiscountValue: Math.round(totalDiscountValue * 100) / 100,
      totalDiscountedSaleValue: Math.round(totalDiscountedSaleValue * 100) / 100,
      profitWithDiscounts: Math.round(profitWithDiscounts * 100) / 100,
      discountedProductsCount,
      categories: Object.entries(categoryMap).map(([name, data]) => ({
        name,
        count: data.count,
        stock: data.stock,
      })),
    };
  }, [items]);

  // Active Main View Tab ('inventory' is default administration panel, remembered across sessions)
  const [activeTab, setActiveTab] = useState<'customers' | 'store' | 'inventory' | 'analytics' | 'purchases' | 'orders'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeLocalStorage.getItem('comerxia_active_main_tab');
        if (saved === 'customers' || saved === 'store' || saved === 'inventory' || saved === 'analytics' || saved === 'purchases' || saved === 'orders') {
          return saved;
        }
      } catch {}
    }
    return 'inventory';
  });

  // Store Sub-tab State ('catalog' | 'orders' | 'settings')
  const [storeSubTab, setStoreSubTab] = useState<'catalog' | 'orders' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = safeLocalStorage.getItem('comerxia_store_subtab');
        if (saved === 'catalog' || saved === 'orders' || saved === 'settings') {
          return saved;
        }
      } catch {}
    }
    return 'catalog';
  });

  // Handler to commute to store catalog or orders directly from Navbar or anywhere
  const handleSelectStoreSubTab = (subTab: 'catalog' | 'orders' | 'settings') => {
    setStoreSubTab(subTab);
    if (subTab === 'orders') {
      setActiveTab('orders');
    } else {
      setActiveTab('store');
    }
    setIsCustomerOnly(false);
    try {
      safeLocalStorage.setItem('comerxia_active_main_tab', subTab === 'orders' ? 'orders' : 'store');
      safeLocalStorage.setItem('comerxia_store_subtab', subTab);
    } catch {}
  };

  // Persist activeTab whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        safeLocalStorage.setItem('comerxia_active_main_tab', activeTab);
      } catch {}
    }
  }, [activeTab]);

  // Whenever user logs in or creates administrator account, direct them immediately to the administration panel (inventory)
  const previousUserRef = useRef<any>(null);
  useEffect(() => {
    if (!previousUserRef.current && user) {
      setActiveTab('inventory');
      setIsCustomerOnly(false);
      try {
        safeLocalStorage.setItem('comerxia_active_main_tab', 'inventory');
      } catch {}
    }
    previousUserRef.current = user;
  }, [user]);

  // Track seen product IDs across sessions in localStorage
  const [seenProductIds, setSeenProductIds] = useState<Set<number>>(() => {
    try {
      const stored = safeLocalStorage.getItem('comerxia_seen_product_ids');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {}
    return new Set();
  });

  // Track currently highlighted Telegram product IDs for this inventory session
  const [highlightedTelegramIds, setHighlightedTelegramIds] = useState<Set<number>>(new Set());
  const [unseenProductsCount, setUnseenProductsCount] = useState<number>(0);
  const isInitialProductsLoad = useRef<boolean>(true);

  // Recalculate unseen products whenever `items` or `seenProductIds` change
  useEffect(() => {
    if (items.length === 0) return;

    // If first load and localStorage was empty, initialize with existing items so there are no false notifications
    if (isInitialProductsLoad.current) {
      isInitialProductsLoad.current = false;
      const stored = safeLocalStorage.getItem('comerxia_seen_product_ids');
      if (!stored) {
        const initialIds = items.map((it) => it.id);
        safeLocalStorage.setItem('comerxia_seen_product_ids', JSON.stringify(initialIds));
        setSeenProductIds(new Set(initialIds));
        setUnseenProductsCount(0);
        return;
      }
    }

    // Unseen Telegram products (products whose rawTelegramMessage is truthy and not in seenProductIds)
    const unseenItems = items.filter((it) => Boolean(it.rawTelegramMessage) && !seenProductIds.has(it.id));
    setUnseenProductsCount(unseenItems.length);

    // If user is actively viewing inventory and a new Telegram item arrives, add it to highlightedTelegramIds immediately
    if (activeTab === 'inventory' && unseenItems.length > 0) {
      setHighlightedTelegramIds((prev) => {
        const next = new Set(prev);
        unseenItems.forEach((it) => next.add(it.id));
        return next;
      });
    }
  }, [items, seenProductIds, activeTab]);

  // Handler for switching tabs: when entering inventory, capture unseen items into highlightedTelegramIds,
  // and mark them in seenProductIds so NEXT time inventory is opened, the badges are cleared.
  const handleTabChange = (tab: 'customers' | 'store' | 'inventory' | 'purchases' | 'orders' | 'analytics') => {
    if (tab === 'inventory') {
      // Find all Telegram items that haven't been seen in previous sessions
      const newlyArrivedTelegramIds = items
        .filter((it) => Boolean(it.rawTelegramMessage) && !seenProductIds.has(it.id))
        .map((it) => it.id);

      // Set active highlight for this session so the user can clearly see them now
      if (newlyArrivedTelegramIds.length > 0) {
        setHighlightedTelegramIds(new Set(newlyArrivedTelegramIds));
      }

      // Mark all current products as seen in localStorage for subsequent visits
      const allCurrentIds = items.map((it) => it.id);
      safeLocalStorage.setItem('comerxia_seen_product_ids', JSON.stringify(allCurrentIds));
      setSeenProductIds(new Set(allCurrentIds));
      setUnseenProductsCount(0);
    } else {
      // When leaving inventory, clear the current session highlighted IDs
      setHighlightedTelegramIds(new Set());
    }

    if (tab === 'orders') {
      setStoreSubTab('orders');
    } else if (tab === 'store') {
      setStoreSubTab('catalog');
    }

    setActiveTab(tab);
  };

  // Helper to test if a hostname matches any domain listed in a comma/space separated config string
  const matchesDomainRule = (currentHost: string, ruleString?: string): boolean => {
    if (!ruleString) return false;
    const cleanHost = currentHost.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const rules = ruleString
      .split(/[,;\n]/)
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0])
      .filter(Boolean);

    for (const r of rules) {
      if (cleanHost === r || cleanHost.endsWith('.' + r)) {
        return true;
      }
    }
    return false;
  };

  // Check if current hostname is a local environment, private IP, or container dev host
  const isLocalHost = (host: string): boolean => {
    const clean = host.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    return (
      clean === 'localhost' ||
      clean === '127.0.0.1' ||
      clean === '0.0.0.0' ||
      clean === '::1' ||
      clean.startsWith('192.168.') ||
      clean.startsWith('10.') ||
      clean.startsWith('172.16.') ||
      clean.startsWith('172.17.') ||
      clean.startsWith('172.18.') ||
      clean.startsWith('172.19.') ||
      clean.startsWith('172.20.') ||
      clean.startsWith('172.21.') ||
      clean.startsWith('172.22.') ||
      clean.startsWith('172.23.') ||
      clean.startsWith('172.24.') ||
      clean.startsWith('172.25.') ||
      clean.startsWith('172.26.') ||
      clean.startsWith('172.27.') ||
      clean.startsWith('172.28.') ||
      clean.startsWith('172.29.') ||
      clean.startsWith('172.30.') ||
      clean.startsWith('172.31.') ||
      clean.endsWith('.local') ||
      clean.endsWith('.internal')
    );
  };

  // Subdomain & URL Detection for Admin Login vs Customer Online Storefront
  // - Matches configured adminDomain (e.g. admin.dominio1.com) or localhost -> Show Admin Login / Management
  // - Matches configured storeDomain (e.g. www.dominio1.com, dominio1.com) or /tienda /?view=store -> Show Public Customer Storefront
  const [isCustomerOnly, setIsCustomerOnly] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);

      // 1. Explicit query parameter overrides (?view=admin or ?view=store)
      if (params.get('view') === 'admin' || params.get('mode') === 'admin') {
        return false;
      }
      if (
        pathname.startsWith('/tienda') ||
        pathname.startsWith('/store') ||
        pathname.startsWith('/catalogo') ||
        pathname.startsWith('/shop') ||
        params.get('view') === 'store' ||
        params.get('mode') === 'customer' ||
        params.get('cliente') === 'true' ||
        params.get('customer') === 'true' ||
        params.has('producto') ||
        params.has('product') ||
        params.has('p') ||
        params.has('sku')
      ) {
        return true;
      }

      // 2. On localhost, 127.0.0.1 or local network, always default to Admin Panel/Login
      if (isLocalHost(hostname)) {
        return false;
      }

      // 3. Check cached domain config from localStorage if available
      try {
        const cachedRaw = safeLocalStorage.getItem('comerxia_domain_config_cache');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.autoRouting !== false) {
            if (matchesDomainRule(hostname, cached.adminDomain)) {
              return false;
            }
            if (matchesDomainRule(hostname, cached.storeDomain)) {
              return true;
            }
            if (cached.defaultFallbackView === 'admin') {
              return false;
            }
            if (cached.defaultFallbackView === 'store') {
              return true;
            }
          }
        }
      } catch {}

      // 4. Fallback heuristics for Admin vs Store
      if (hostname.startsWith('admin.') || hostname === 'admin') {
        return false;
      }

      if (
        hostname.startsWith('www.') ||
        hostname.startsWith('tienda.') ||
        hostname.startsWith('store.') ||
        hostname.startsWith('catalogo.') ||
        hostname.includes('lotengoo.com')
      ) {
        return true;
      }
    }
    return false;
  });

  // Dynamic browser window title:
  // - Customer-only / Public Storefront view -> storeConfig.storeName (from settings)
  // - Administration area -> "Comerxia System"
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCustomerOnly) {
        document.title = storeConfig?.storeName?.trim() || 'Comerxia Store';
      } else {
        document.title = 'Comerxia System';
      }
    }
  }, [isCustomerOnly, storeConfig?.storeName]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOffersOnly, setShowOffersOnly] = useState<boolean>(false);

  // Modal States
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isGoogleAiModalOpen, setIsGoogleAiModalOpen] = useState<boolean>(false);
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState<boolean>(false);
  const [deploymentInitialTab, setDeploymentInitialTab] = useState<'deploy' | 'status' | 'domains' | 'security' | 'backup' | 'telegram' | 'ai' | 'store'>('deploy');

  const handleOpenDeploymentTab = (tab: 'deploy' | 'status' | 'domains' | 'security' | 'backup' | 'telegram' | 'ai' | 'store' = 'deploy') => {
    setDeploymentInitialTab(tab);
    setIsDeploymentModalOpen(true);
  };

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [bulkItemsToDelete, setBulkItemsToDelete] = useState<InventoryItem[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Theme configuration memoization - MUST be declared unconditionally before any early returns
  const activeStoreTheme = (storeConfig?.theme || 'classic') as StoreTheme;
  const isStoreActive = isCustomerOnly || activeTab === 'store';
  const palettes = useMemo(() => parseThemePalettes(storeConfig?.themeColors), [storeConfig?.themeColors]);
  const activeStorePalette = palettes[activeStoreTheme];
  const dynamicThemeColors = useMemo(() => getThemeColors(activeStorePalette, activeStoreTheme), [activeStorePalette, activeStoreTheme]);

  // Helper to safely parse JSON responses
  const safeJson = async (res: Response) => {
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Fetch all core data
  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // In silent periodic polling mode, only refresh dynamic inventory/messages/orders/purchases/stats
      if (silent) {
        const [itemsRes, messagesRes, statsRes, ordersRes, purchasesRes] = await Promise.all([
          authFetch('/api/inventory').catch(() => null),
          authFetch('/api/messages').catch(() => null),
          authFetch('/api/stats').catch(() => null),
          authFetch('/api/orders').catch(() => null),
          authFetch('/api/purchases').catch(() => null),
        ]);

        const [itemsData, messagesData, statsData, ordersData, purchasesData] = await Promise.all([
          itemsRes ? safeJson(itemsRes) : null,
          messagesRes ? safeJson(messagesRes) : null,
          statsRes ? safeJson(statsRes) : null,
          ordersRes ? safeJson(ordersRes) : null,
          purchasesRes ? safeJson(purchasesRes) : null,
        ]);

        if (itemsData && Array.isArray(itemsData)) setItems(itemsData);
        if (messagesData && Array.isArray(messagesData)) setMessages(messagesData);
        if (statsData) setServerStats(statsData);
        if (ordersData && Array.isArray(ordersData)) setOrders(ordersData);
        if (purchasesData && Array.isArray(purchasesData)) setPurchases(purchasesData);
        return;
      }

      // Full initial or explicit refresh
      const [itemsRes, messagesRes, statsRes, configRes, storeRes, ordersRes, domainRes, purchasesRes] = await Promise.all([
        authFetch('/api/inventory').catch(() => null),
        authFetch('/api/messages').catch(() => null),
        authFetch('/api/stats').catch(() => null),
        authFetch('/api/telegram/config').catch(() => null),
        authFetch('/api/store/config').catch(() => null),
        authFetch('/api/orders').catch(() => null),
        authFetch('/api/server/domain-config').catch(() => null),
        authFetch('/api/purchases').catch(() => null),
      ]);

      const [itemsData, messagesData, statsData, configData, storeData, ordersData, domainData, purchasesData] = await Promise.all([
        itemsRes ? safeJson(itemsRes) : null,
        messagesRes ? safeJson(messagesRes) : null,
        statsRes ? safeJson(statsRes) : null,
        configRes ? safeJson(configRes) : null,
        storeRes ? safeJson(storeRes) : null,
        ordersRes ? safeJson(ordersRes) : null,
        domainRes ? safeJson(domainRes) : null,
        purchasesRes ? safeJson(purchasesRes) : null,
      ]);

      if (itemsData && Array.isArray(itemsData)) {
        setItems(itemsData);
      }

      if (messagesData && Array.isArray(messagesData)) {
        setMessages(messagesData);
      }

      if (statsData) {
        setServerStats(statsData);
      }

      if (configData) {
        setConfig(configData);
        if (configData.botToken) {
          safeLocalStorage.setItem('cached_tg_bot_token', configData.botToken);
        }
      }

      if (storeData) {
        setStoreConfig(storeData);
      }

      if (ordersData && Array.isArray(ordersData)) {
        setOrders(ordersData);
      }

      if (purchasesData && Array.isArray(purchasesData)) {
        setPurchases(purchasesData);
      }

      if (domainData) {
        setDomainConfig(domainData);
        try {
          safeLocalStorage.setItem('comerxia_domain_config_cache', JSON.stringify(domainData));
        } catch {}

        // Evaluate domain routing dynamically if no explicit query parameter or store pathname is forcing customer mode
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const pathname = window.location.pathname.toLowerCase();
          const hasExplicitCustomerRoute =
            pathname.startsWith('/tienda') ||
            pathname.startsWith('/store') ||
            pathname.startsWith('/catalogo') ||
            pathname.startsWith('/shop') ||
            params.has('view') ||
            params.has('mode') ||
            params.has('cliente') ||
            params.has('customer') ||
            params.has('producto') ||
            params.has('product') ||
            params.has('p') ||
            params.has('sku');

          if (!hasExplicitCustomerRoute && domainData.autoRouting !== false) {
            const currentHostname = window.location.hostname;
            const onLocalHost = isLocalHost(currentHostname);

            if (onLocalHost || matchesDomainRule(currentHostname, domainData.adminDomain)) {
              setIsCustomerOnly(false);
            } else if (matchesDomainRule(currentHostname, domainData.storeDomain)) {
              // If domain specifically matches store domain and user is not authenticated as admin
              if (!user) {
                setIsCustomerOnly(true);
              }
            } else if (domainData.defaultFallbackView === 'admin') {
              setIsCustomerOnly(false);
            } else if (domainData.defaultFallbackView === 'store') {
              if (!onLocalHost && !user) {
                setIsCustomerOnly(true);
              } else {
                setIsCustomerOnly(false);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Notice: Background data sync error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 seconds to capture live incoming Telegram messages
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  // Store Management Handlers
  const handleUpdateStoreConfig = async (cfg: Partial<StoreConfig>): Promise<boolean> => {
    try {
      const res = await authFetch('/api/store/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        const updated = await res.json();
        setStoreConfig(updated);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update store config:', err);
      return false;
    }
  };

  const handleCreateOrder = async (orderData: any) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          await fetchData(true);
          return { success: true, order: data.order, orderNumber: data.orderNumber };
        }
      }
      return { success: false };
    } catch (err) {
      console.error('Failed to create order:', err);
      return { success: false };
    }
  };

  const handleUpdateOrder = async (orderId: number, orderData: Partial<CustomerOrder>): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        await fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update order:', err);
      return false;
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: number,
    status: string,
    paymentVoucher?: string,
    notes?: string,
    trackingNumber?: string,
    trackingCarrier?: string,
    trackingNotes?: string
  ): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, paymentVoucher, notes, trackingNumber, trackingCarrier, trackingNotes }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: status as any,
                  ...(paymentVoucher !== undefined ? { paymentVoucher } : {}),
                  ...(notes !== undefined ? { notes } : {}),
                  ...(trackingNumber !== undefined ? { trackingNumber } : {}),
                  ...(trackingCarrier !== undefined ? { trackingCarrier } : {}),
                  ...(trackingNotes !== undefined ? { trackingNotes } : {}),
                }
              : o
          )
        );
        // Refresh inventory and stats because stock changes upon confirmed sale
        await fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update order status:', err);
      return false;
    }
  };

  const handleDeleteOrder = async (orderId: number): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        // Refresh inventory and stats because stock is restored if order was confirmed
        await fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete order:', err);
      return false;
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await authFetch('/api/telegram/sync-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData(true);
        if (data.updatesFound > 0) {
          setSyncFeedback(`🎉 ¡${data.updatesFound} producto(s) nuevo(s) procesado(s)!`);
        } else {
          setSyncFeedback('✅ Sincronizado: Al día');
        }
      } else {
        setSyncFeedback(data.error || 'Configura tu Token en Conectar Bot');
      }
    } catch (err: any) {
      setSyncFeedback('Error al conectar');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // Open confirmation modal for deleting single item
  const handleRequestDelete = (id: number) => {
    const target = items.find((it) => it.id === id);
    if (target) {
      setBulkItemsToDelete([]);
      setItemToDelete(target);
    }
  };

  // Open confirmation modal for bulk deleting items
  const handleRequestBulkDelete = (selectedItems: InventoryItem[]) => {
    if (selectedItems.length > 0) {
      setItemToDelete(null);
      setBulkItemsToDelete(selectedItems);
    }
  };

  // Perform actual deletion (single or bulk)
  const handleConfirmDelete = async () => {
    setIsDeleting(true);

    try {
      if (bulkItemsToDelete.length > 0) {
        // Bulk delete
        const ids = bulkItemsToDelete.map((it) => it.id);
        const res = await authFetch('/api/inventory/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok) {
          throw new Error('Error al eliminar productos de PostgreSQL');
        }

        const count = bulkItemsToDelete.length;
        setItems((prev) => prev.filter((it) => !ids.includes(it.id)));
        if (selectedItemDetail && ids.includes(selectedItemDetail.id)) {
          setSelectedItemDetail(null);
        }
        setBulkItemsToDelete([]);
        setSyncFeedback(`🗑️ Se eliminaron ${count} productos correctamente.`);
      } else if (itemToDelete) {
        // Single delete
        const id = itemToDelete.id;
        const res = await authFetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error('Error al eliminar de PostgreSQL');
        }

        // Optimistic removal from state
        setItems((prev) => prev.filter((it) => it.id !== id));
        if (selectedItemDetail?.id === id) {
          setSelectedItemDetail(null);
        }
        setItemToDelete(null);
        setSyncFeedback(`🗑️ Producto "${itemToDelete.name}" eliminado correctamente.`);
      }

      // Refresh inventory & stats
      fetchData(true);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      setSyncFeedback(`Error al eliminar: ${error.message || 'Error de servidor'}`);
    } finally {
      setIsDeleting(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleOpenDetailById = (id: number) => {
    const found = items.find((it) => it.id === id);
    if (found) {
      setSelectedItemDetail(found);
      setActiveTab('inventory');
    }
  };

  // Delete single telegram message
  const handleDeleteMessage = async (id: number): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/messages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setSyncFeedback('🗑️ Mensaje eliminado correctamente.');
        setTimeout(() => setSyncFeedback(null), 4000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete message:', err);
      return false;
    }
  };

  // Bulk delete telegram messages
  const handleBulkDeleteMessages = async (ids: number[]): Promise<boolean> => {
    try {
      const res = await authFetch('/api/messages/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
        setSyncFeedback(`🗑️ Se eliminaron ${ids.length} mensajes correctamente.`);
        setTimeout(() => setSyncFeedback(null), 4000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to bulk delete messages:', err);
      return false;
    }
  };

  // Clear all telegram messages
  const handleClearAllMessages = async (): Promise<boolean> => {
    try {
      const res = await authFetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setMessages([]);
        setSyncFeedback('🗑️ Se vació todo el historial de mensajes de Telegram.');
        setTimeout(() => setSyncFeedback(null), 4000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to clear messages:', err);
      return false;
    }
  };

  // Purchase management handlers (Hybrid business model: Stock vs On-Demand)
  const handleReceivePurchase = async (purchaseId: number) => {
    try {
      const res = await authFetch(`/api/purchases/${purchaseId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncFeedback(`✓ ${data.message || 'Mercancía recibida en bodega e inventario actualizado con éxito'}`);
        setTimeout(() => setSyncFeedback(null), 5000);
        await fetchData(true);
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.error || 'Error al recibir la compra');
      }
    } catch (err: any) {
      console.error('Failed to receive purchase:', err);
      alert('Error de conexión al recibir compra');
    }
  };

  const handleGeneratePurchaseFromOrder = async (order: any) => {
    try {
      const res = await authFetch(`/api/orders/${order.id}/generate-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncFeedback(`✓ Orden a Proveedor #${data.purchase?.purchaseNumber || ''} generada exitosamente`);
        setTimeout(() => setSyncFeedback(null), 5000);
        await fetchData(true);
        if (data.purchase?.id) {
          setHighlightPurchaseId(data.purchase.id);
          setActiveTab('purchases');
        }
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.error || 'Error al generar compra');
      }
    } catch (err) {
      console.error('Failed to generate purchase:', err);
      alert('Error al generar orden al proveedor');
    }
  };

  const handleCreatePurchase = async (purchaseData: any) => {
    try {
      const res = await authFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData),
      });
      if (res.ok) {
        setSyncFeedback('✓ Orden de compra al proveedor creada con éxito');
        setTimeout(() => setSyncFeedback(null), 4000);
        await fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to create purchase:', err);
      return false;
    }
  };

  const handleUpdatePurchase = async (purchaseId: number, purchaseData: any) => {
    try {
      const res = await authFetch(`/api/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData),
      });
      if (res.ok) {
        setSyncFeedback('✓ Orden de compra actualizada');
        setTimeout(() => setSyncFeedback(null), 4000);
        await fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update purchase:', err);
      return false;
    }
  };

  const handleDeletePurchase = async (purchaseId: number) => {
    try {
      const res = await authFetch(`/api/purchases/${purchaseId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSyncFeedback('✓ Orden de compra eliminada');
        setTimeout(() => setSyncFeedback(null), 4000);
        await fetchData(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete purchase:', err);
      return false;
    }
  };

  const handleViewLinkedPurchase = (purchaseId: number) => {
    setHighlightPurchaseId(purchaseId);
    setActiveTab('purchases');
  };

  // 1. Loading splash screen while verifying SQL authentication session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <div className="w-14 h-14 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 animate-pulse shadow-md shadow-emerald-500/10">
          <Database className="w-7 h-7" />
        </div>
        <p className="text-sm font-bold text-slate-900 tracking-tight">Comerxia App</p>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          Conectando a base de datos PostgreSQL...
        </p>
      </div>
    );
  }

  // 2. Initial View: If not authenticated and not in customer store view, show Admin Login Screen
  if (!user && !isCustomerOnly) {
    return (
      <AdminLoginScreen
        onViewCustomerStore={() => {
          setIsCustomerOnly(true);
          setActiveTab('store');
          setStoreSubTab('catalog');
        }}
        storeConfig={storeConfig}
      />
    );
  }

  const getAppBg = () => {
    if (!isCustomerOnly) return 'bg-slate-100/90 text-slate-800';
    switch (activeStoreTheme) {
      case 'boutique':
        return 'bg-zinc-950 text-zinc-100 selection:bg-amber-500 selection:text-black';
      case 'cyber':
        return 'bg-[#070d18] text-cyan-100 selection:bg-cyan-500 selection:text-black';
      case 'brutalist':
        return 'bg-amber-50/50 text-black selection:bg-yellow-300 selection:text-black';
      case 'minimal':
        return 'bg-[#FAF8F5] text-stone-900 selection:bg-stone-800 selection:text-white';
      case 'fresh':
        return 'bg-teal-50/40 text-slate-900 selection:bg-emerald-500 selection:text-white';
      case 'classic':
      default:
        return 'bg-slate-100/90 text-slate-800 selection:bg-sky-500 selection:text-white';
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${getAppBg()}`}
      style={isCustomerOnly ? { backgroundColor: dynamicThemeColors.c3, color: dynamicThemeColors.c3Text } : undefined}
    >
      {/* Top Navigation - Strictly hidden in Customer-Only view */}
      {!isCustomerOnly && (
        <Navbar
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          onOpenConfig={() => handleOpenDeploymentTab('telegram')}
          onOpenDeployment={() => handleOpenDeploymentTab('deploy')}
          onOpenAddProduct={() => {
            setEditingItem(null);
            setIsFormOpen(true);
          }}
          onOpenProfile={() => setIsProfileOpen(true)}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          storeSubTab={storeSubTab}
          onSelectStoreSubTab={handleSelectStoreSubTab}
          storeConfig={storeConfig}
          inventoryCount={items.length}
          messagesCount={messages.length}
          unseenProductsCount={unseenProductsCount}
          ordersCount={orders.length}
          pendingOrdersCount={orders.filter((o) => o.status === 'pending').length}
          purchasesCount={purchases.length}
          pendingPurchasesCount={purchases.filter((p) => p.status === 'pending' || p.status === 'ordered').length}
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto ${isCustomerOnly ? 'px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6' : 'px-4 sm:px-6 lg:px-8 py-6'}`}>
        {!isCustomerOnly && syncFeedback && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn">
            <span>{syncFeedback}</span>
            <button onClick={() => setSyncFeedback(null)} className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer">✕</button>
          </div>
        )}

        {/* Global Statistics Banner (shown on Inventory tab) */}
        {!isCustomerOnly && activeTab === 'inventory' && (
          <StatsBanner
            stats={stats}
            currency={config?.currency || 'USD'}
            totalMessagesCount={messages.length}
          />
        )}

        {/* Loading Indicator */}
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
            <span className="text-sm">Consultando catálogo...</span>
          </div>
        ) : isCustomerOnly || activeTab === 'store' || activeTab === 'orders' ? (
          /* Online Storefront / Sales Orders View */
          <OnlineStoreView
            products={items}
            orders={orders}
            storeConfig={storeConfig}
            currentSubTab={activeTab === 'orders' ? 'orders' : storeSubTab}
            onSubTabChange={(tab) => {
              setStoreSubTab(tab);
              if (tab === 'orders') {
                setActiveTab('orders');
              } else if (activeTab === 'orders' && tab === 'catalog') {
                setActiveTab('store');
              }
            }}
            isCustomerOnly={isCustomerOnly}
            onExitCustomerMode={() => {
              setIsCustomerOnly(false);
              setActiveTab('inventory');
              safeLocalStorage.setItem('comerxia_active_main_tab', 'inventory');
              window.history.replaceState({}, '', window.location.pathname);
            }}
            onRefreshProducts={() => fetchData(true)}
            onUpdateStoreConfig={handleUpdateStoreConfig}
            onCreateOrder={handleCreateOrder}
            onUpdateOrder={handleUpdateOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
            onOpenConfig={() => handleOpenDeploymentTab('store')}
            isSyncing={isSyncing}
            currency={config?.currency || 'USD'}
            onGenerateSupplierPurchase={handleGeneratePurchaseFromOrder}
            onViewLinkedPurchase={handleViewLinkedPurchase}
          />
        ) : activeTab === 'purchases' ? (
          /* Purchases & Supplier Orders Module */
          <PurchasesView
            purchases={purchases}
            inventoryItems={items}
            orders={orders}
            customerOrders={orders}
            currency={config?.currency || 'USD'}
            authFetch={authFetch}
            showToast={(msg) => {
              setSyncFeedback(msg);
              setTimeout(() => setSyncFeedback(null), 4000);
            }}
            onReceivePurchase={handleReceivePurchase}
            onRefreshPurchases={() => fetchData(true)}
            onCreatePurchase={handleCreatePurchase}
            onUpdatePurchase={handleUpdatePurchase}
            onDeletePurchase={handleDeletePurchase}
            onGoToInventory={() => setActiveTab('inventory')}
            onGoToStoreOrders={() => handleSelectStoreSubTab('orders')}
            highlightPurchaseId={highlightPurchaseId}
          />
        ) : activeTab === 'customers' ? (
          /* Customers CRM View */
          <CustomersView
            authFetch={authFetch}
            showToast={(msg) => {
              setSyncFeedback(msg);
              setTimeout(() => setSyncFeedback(null), 4000);
            }}
            currency={config?.currency || 'USD'}
            onOpenStoreOrders={() => handleSelectStoreSubTab('orders')}
          />
        ) : activeTab === 'analytics' ? (
          /* Store & Product Analytics Dashboard */
          <AnalyticsDashboard
            products={items}
            currency={config?.currency || 'USD'}
            authFetch={authFetch}
            onSelectProductDetail={(item) => setSelectedItemDetail(item)}
            onGoToStore={() => {
              setActiveTab('store');
              setStoreSubTab('catalog');
            }}
            onGoToInventory={() => setActiveTab('inventory')}
          />
        ) : (
          /* Inventory Items & Telegram Messages View */
          <InventoryView
            items={items}
            messages={messages}
            storeConfig={storeConfig}
            unseenProductIds={highlightedTelegramIds}
            unseenProductsCount={highlightedTelegramIds.size}
            onMarkAllProductsAsSeen={() => {
              const allCurrentIds = items.map((it) => it.id);
              safeLocalStorage.setItem('comerxia_seen_product_ids', JSON.stringify(allCurrentIds));
              setSeenProductIds(new Set(allCurrentIds));
              setHighlightedTelegramIds(new Set());
              setUnseenProductsCount(0);
            }}
            onMarkAllAsSeen={() => {
              const allCurrentIds = items.map((it) => it.id);
              safeLocalStorage.setItem('comerxia_seen_product_ids', JSON.stringify(allCurrentIds));
              setSeenProductIds(new Set(allCurrentIds));
              setHighlightedTelegramIds(new Set());
              setUnseenProductsCount(0);
            }}
            onMarkProductAsSeen={(id) => {
              setHighlightedTelegramIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              setSeenProductIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                safeLocalStorage.setItem('comerxia_seen_product_ids', JSON.stringify(Array.from(next)));
                return next;
              });
            }}
            onSelectItem={(item) => setSelectedItemDetail(item)}
            onOpenDetailById={handleOpenDetailById}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsFormOpen(true);
            }}
            onDeleteItem={handleRequestDelete}
            onBulkDelete={handleRequestBulkDelete}
            onOpenAddProduct={() => {
              setEditingItem(null);
              setIsFormOpen(true);
            }}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
            onOpenConfig={() => handleOpenDeploymentTab('telegram')}
            onManualSync={handleManualSync}
            isSyncing={isSyncing}
            onDeleteMessage={handleDeleteMessage}
            onBulkDeleteMessages={handleBulkDeleteMessages}
            onClearAllMessages={handleClearAllMessages}
            currency={config?.currency || 'USD'}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedSupplier={selectedSupplier}
            setSelectedSupplier={setSelectedSupplier}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            showOffersOnly={showOffersOnly}
            setShowOffersOnly={setShowOffersOnly}
          />
        )}
      </main>

      {/* Footer */}
      <footer
        className={`mt-auto py-5 text-center text-xs transition-colors ${
          isCustomerOnly
            ? 'border-t border-slate-200 bg-white text-slate-500 shadow-sm'
            : 'border-t border-[#181922] bg-[#07080b] text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          {isCustomerOnly ? (
            <>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800">
                  {storeConfig.storeName || 'Tienda Online Oficial'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600 font-medium">Catálogo en Línea</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Pedidos directos y atención personalizada vía WhatsApp
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <span className="flex items-center text-emerald-400 font-medium">
                  <Database className="w-3.5 h-3.5 mr-1" />
                  PostgreSQL Activo
                </span>
                <span>•</span>
                <span>Comerxia App</span>
              </div>
              <p className="text-slate-500">
                Recepción inteligente por Telegram + Gestión de Inventario + Tienda Online
              </p>
            </>
          )}
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Telegram Message Simulator */}
      <TelegramSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={fetchData}
      />

      {/* 2. Telegram Bot Configuration */}
      <TelegramBotConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onConfigSaved={fetchData}
      />

      {/* 2.1 Google Gemini AI Configuration */}
      <GoogleAiConfigModal
        isOpen={isGoogleAiModalOpen}
        onClose={() => setIsGoogleAiModalOpen(false)}
        onConfigSaved={fetchData}
      />

      {/* 3. Product Detail Modal */}
      <ProductDetailModal
        item={selectedItemDetail}
        onClose={() => setSelectedItemDetail(null)}
        onItemUpdated={(updated) => {
          setSelectedItemDetail(updated);
          fetchData(true);
        }}
        onEdit={(item) => {
          setSelectedItemDetail(null);
          setEditingItem(item);
          setIsFormOpen(true);
        }}
        onDelete={(id) => {
          setSelectedItemDetail(null);
          handleRequestDelete(id);
        }}
        currency={config?.currency || 'USD'}
      />

      {/* 4. Product Add / Edit Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingItem(null);
        }}
        onSaved={fetchData}
        editingItem={editingItem}
      />

      {/* 5. Local Server Deployment & Unified PostgreSQL Database Explorer Modal */}
      <LocalDeploymentModal
        isOpen={isDeploymentModalOpen}
        onClose={() => setIsDeploymentModalOpen(false)}
        initialTab={deploymentInitialTab}
        items={items}
        messages={messages}
        orders={orders}
        config={config}
        onConfigSaved={fetchData}
        storeConfig={storeConfig}
        onStoreConfigSaved={fetchData}
      />

      {/* 6. Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!itemToDelete || bulkItemsToDelete.length > 0}
        item={itemToDelete}
        bulkItems={bulkItemsToDelete}
        onClose={() => {
          if (!isDeleting) {
            setItemToDelete(null);
            setBulkItemsToDelete([]);
          }
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* 7. Admin Profile & Password Change Modal */}
      <AdminProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InventoryApp />
    </AuthProvider>
  );
}
