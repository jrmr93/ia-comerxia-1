import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Send,
  MessageCircle,
  Copy,
  Printer,
  Trash2,
  Edit3,
  ExternalLink,
  Receipt,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Boxes,
  ArrowRight,
  Filter,
  BarChart3,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { PurchaseOrder, PurchaseItem, InventoryItem, CustomerOrder, FinancialReportSummary } from '../types.ts';

interface PurchasesViewProps {
  purchases?: PurchaseOrder[];
  inventoryItems?: InventoryItem[];
  customerOrders?: CustomerOrder[];
  orders?: CustomerOrder[];
  currency?: string;
  authFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  onReceivePurchase?: (purchaseId: number) => Promise<void> | void;
  onRefreshPurchases?: () => Promise<void> | void;
  onCreatePurchase?: (data: any) => Promise<boolean>;
  onUpdatePurchase?: (id: number, data: any) => Promise<boolean>;
  onDeletePurchase?: (id: number) => Promise<boolean>;
  showToast?: (msg: string) => void;
  onGoToStoreOrders?: () => void;
  onGoToInventory?: () => void;
  highlightPurchaseId?: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases = [],
  inventoryItems = [],
  customerOrders,
  orders = [],
  currency = 'USD',
  authFetch = window.fetch.bind(window),
  onReceivePurchase,
  onRefreshPurchases = async () => {},
  onCreatePurchase,
  onUpdatePurchase,
  onDeletePurchase,
  showToast = (_msg: string) => {},
  onGoToStoreOrders,
  onGoToInventory,
  highlightPurchaseId,
}) => {
  const allCustomerOrders = customerOrders || orders || [];

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<number | null>(highlightPurchaseId || null);

  useEffect(() => {
    if (highlightPurchaseId) {
      setExpandedPurchaseId(highlightPurchaseId);
    }
  }, [highlightPurchaseId]);

  // Modals
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrder | null>(null);
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);
  const [financialPeriod, setFinancialPeriod] = useState<string>('month');
  const [financialSummary, setFinancialSummary] = useState<FinancialReportSummary | null>(null);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  // In-App Action Modals (Zero Dependency on blocked window.confirm)
  const [purchaseToDelete, setPurchaseToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeletingPurchase, setIsDeletingPurchase] = useState(false);
  const [purchaseToReceive, setPurchaseToReceive] = useState<PurchaseOrder | null>(null);
  const [isReceivingPurchase, setIsReceivingPurchase] = useState(false);

  // Fetch Financial Summary
  const fetchFinancialSummary = async (period: string) => {
    setLoadingFinancial(true);
    try {
      const res = await authFetch(`/api/finances/summary?period=${period}`);
      if (res && res.ok) {
        const data = await res.json();
        setFinancialSummary(data);
      }
    } catch (err) {
      console.warn('Error fetching financial summary:', err);
    } finally {
      setLoadingFinancial(false);
    }
  };

  useEffect(() => {
    if (isFinancialModalOpen) {
      fetchFinancialSummary(financialPeriod);
    }
  }, [isFinancialModalOpen, financialPeriod]);

  // Unique Suppliers list
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    (purchases || []).forEach((p) => {
      if (p?.supplierName) set.add(p.supplierName.trim());
    });
    (inventoryItems || []).forEach((it) => {
      if ((it as any)?.supplier) set.add((it as any).supplier.trim());
      if ((it as any)?.channelTitle) set.add((it as any).channelTitle.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [purchases, inventoryItems]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter((p) => {
      if (!p) return false;
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      // Supplier filter
      if (supplierFilter !== 'all' && p.supplierName !== supplierFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = p.purchaseNumber?.toLowerCase().includes(q);
        const matchSupplier = p.supplierName?.toLowerCase().includes(q);
        const matchOrder = p.linkedCustomerOrderNumber?.toLowerCase().includes(q);
        const matchNotes = p.notes?.toLowerCase().includes(q);
        const matchItems = Array.isArray(p.items) && p.items.some(
          (it) => it?.name?.toLowerCase().includes(q) || it?.sku?.toLowerCase().includes(q)
        );
        if (!matchNumber && !matchSupplier && !matchOrder && !matchNotes && !matchItems) {
          return false;
        }
      }
      return true;
    });
  }, [purchases, statusFilter, supplierFilter, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    let totalInvested = 0;
    let pendingPurchasesCost = 0;
    let pendingCount = 0;
    let receivedCount = 0;
    let customerLinkedCount = 0;

    (purchases || []).forEach((p) => {
      if (!p) return;
      const cost = Number(p.totalCost || 0);
      if (p.status === 'received' || p.paymentStatus === 'paid') {
        totalInvested += cost;
      }
      if (p.status === 'pending' || p.status === 'ordered' || p.status === 'in_transit') {
        pendingPurchasesCost += cost;
        pendingCount++;
      }
      if (p.status === 'received') {
        receivedCount++;
      }
      if (p.linkedCustomerOrderId) {
        customerLinkedCount++;
      }
    });

    return {
      totalInvested,
      pendingPurchasesCost,
      pendingCount,
      receivedCount,
      customerLinkedCount,
      totalCount: (purchases || []).length,
    };
  }, [purchases]);

  // 1-Click Receive Stock in Warehouse Execution
  const executeReceivePurchase = async () => {
    if (!purchaseToReceive) return;
    const purchase = purchaseToReceive;
    if (purchase.status === 'received') {
      setPurchaseToReceive(null);
      return;
    }

    setIsReceivingPurchase(true);
    try {
      if (onReceivePurchase) {
        await onReceivePurchase(purchase.id);
        showToast(`✓ Compra #${purchase.purchaseNumber} recibida y stock sumado a bodega.`);
      } else {
        const res = await authFetch(`/api/purchases/${purchase.id}/receive`, {
          method: 'POST',
        });
        if (res && res.ok) {
          const data = await res.json();
          showToast(data.message || `✓ Compra #${purchase.purchaseNumber} recibida y stock sumado a bodega.`);
        } else {
          const errData = await res?.json().catch(() => ({}));
          showToast(`❌ Error: ${errData?.error || 'No se pudo recibir la compra'}`);
        }
      }
      await onRefreshPurchases();
      setPurchaseToReceive(null);
    } catch (err) {
      console.error('Error receiving purchase:', err);
      showToast('❌ Error de conexión al recibir la compra');
    } finally {
      setIsReceivingPurchase(false);
    }
  };

  // Delete Purchase Execution
  const executeDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    const purchase = purchaseToDelete;
    setIsDeletingPurchase(true);

    try {
      let isSuccess = false;
      if (onDeletePurchase) {
        const res = await onDeletePurchase(purchase.id);
        isSuccess = res !== false;
      } else {
        const res = await authFetch(`/api/purchases/${purchase.id}`, {
          method: 'DELETE',
        });
        isSuccess = !!(res && res.ok);
      }

      if (isSuccess) {
        showToast(`✓ Compra #${purchase.purchaseNumber} eliminada correctamente`);
        await onRefreshPurchases();
        setPurchaseToDelete(null);
        if (editingPurchase?.id === purchase.id) {
          setIsNewPurchaseModalOpen(false);
          setEditingPurchase(null);
        }
      } else {
        showToast('❌ No se pudo eliminar la compra. Intente nuevamente.');
      }
    } catch (err) {
      console.error('Error deleting purchase:', err);
      showToast('❌ Error de conexión al eliminar la compra');
    } finally {
      setIsDeletingPurchase(false);
    }
  };

  // Format supplier message for Telegram / WhatsApp
  const handleCopySupplierMessage = (purchase: PurchaseOrder) => {
    let text = `📦 *ORDEN DE COMPRA / PEDIDO A PROVEEDOR*\n`;
    text += `*N° Compra:* #${purchase.purchaseNumber}\n`;
    text += `*Proveedor:* ${purchase.supplierName}\n`;
    text += `*Fecha:* ${new Date(purchase.purchaseDate || purchase.createdAt).toLocaleDateString('es-EC')}\n\n`;
    text += `*PRODUCTOS SOLICITADOS:*\n`;

    purchase.items.forEach((it, idx) => {
      text += `${idx + 1}. *${it.name}* (Cant: *${it.quantity}*)${it.sku ? ` - SKU: ${it.sku}` : ''}${it.costPrice ? ` - Costo: $${Number(it.costPrice).toFixed(2)}` : ''}\n`;
    });

    text += `\n💰 *Total Estimado:* $${Number(purchase.totalCost || 0).toFixed(2)} ${currency}\n`;
    if (purchase.notes) {
      text += `📝 *Observaciones:* ${purchase.notes}\n`;
    }
    text += `\nPor favor confirmar disponibilidad y tiempo de entrega. ¡Muchas gracias!`;

    navigator.clipboard.writeText(text);
    showToast('✓ Mensaje de pedido para proveedor copiado al portapapeles');
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Title */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <Boxes className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Gestión de Compras y Pedidos a Proveedores
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                    Bajo Pedido & Stock
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Administra las compras a tus proveedores de Telegram, abastece pedidos sin stock y controla la inversión real de tu negocio.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setIsFinancialModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 font-bold text-xs border border-violet-200 cursor-pointer transition shadow-2xs active:scale-95"
            >
              <BarChart3 className="w-4 h-4 text-violet-600" />
              <span>Balance y Margen Real</span>
            </button>

            <button
              onClick={async () => {
                setIsRefreshing(true);
                await onRefreshPurchases();
                setIsRefreshing(false);
                showToast('✓ Compras sincronizadas');
              }}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs border border-slate-200 cursor-pointer transition shadow-2xs active:scale-95"
              title="Actualizar listado de compras"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <button
              onClick={() => {
                setEditingPurchase(null);
                setIsNewPurchaseModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Compra a Proveedor</span>
            </button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Inversión en Compras</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              ${metrics.totalInvested.toFixed(2)}
              <span className="text-xs font-semibold text-slate-500 ml-1">{currency}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Pagado / Recibido en bodega</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Pedidos en Camino</span>
              <Truck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-900 mt-1">
              {metrics.pendingCount} <span className="text-xs font-semibold text-amber-700">órdenes</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">${metrics.pendingPurchasesCost.toFixed(2)} {currency} comprometidos</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Recibidas en Bodega</span>
              <CheckCircle2 className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {metrics.receivedCount} <span className="text-xs font-semibold text-slate-500">completadas</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Stock sumado al catálogo</p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Ventas Bajo Pedido</span>
              <ShoppingBag className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-black text-purple-900 mt-1">
              {metrics.customerLinkedCount} <span className="text-xs font-semibold text-purple-700">pedidos</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Originados por clientes online</p>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por N° compra, proveedor, producto, SKU o pedido cliente..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* State Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs">
          {[
            { id: 'all', label: 'Todas', count: purchases.length },
            { id: 'pending', label: '⏳ Pendientes', count: purchases.filter((p) => p.status === 'pending').length },
            { id: 'ordered', label: '🔵 Pedidas', count: purchases.filter((p) => p.status === 'ordered').length },
            { id: 'in_transit', label: '🚚 En Tránsito', count: purchases.filter((p) => p.status === 'in_transit').length },
            { id: 'received', label: '✅ En Bodega', count: purchases.filter((p) => p.status === 'received').length },
            { id: 'cancelled', label: '❌ Canceladas', count: purchases.filter((p) => p.status === 'cancelled').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 text-[11px] ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded-md ${statusFilter === tab.id ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Supplier Filter */}
        {uniqueSuppliers.length > 0 && (
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Todos los Proveedores ({uniqueSuppliers.length})</option>
            {uniqueSuppliers.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Purchases List */}
      {filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Boxes className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-800">No hay compras registradas con este filtro</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Cuando tus clientes compren productos bajo pedido o cuando decidas reabastecer a tus proveedores de Telegram, las compras aparecerán aquí.
          </p>
          <button
            onClick={() => {
              setEditingPurchase(null);
              setIsNewPurchaseModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Primera Compra a Proveedor</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map((purchase) => {
            const isExpanded = expandedPurchaseId === purchase.id;
            const isReceived = purchase.status === 'received';
            const isPending = purchase.status === 'pending' || purchase.status === 'ordered' || purchase.status === 'in_transit';
            const totalItemsCount = Array.isArray(purchase.items)
              ? purchase.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0)
              : 0;

            return (
              <div
                key={purchase.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  isReceived
                    ? 'border-emerald-200/90 hover:border-emerald-300'
                    : isPending
                    ? 'border-amber-200/90 hover:border-amber-300 ring-1 ring-amber-100'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                        isReceived
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : purchase.status === 'in_transit'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : purchase.status === 'ordered'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isReceived ? <CheckCircle2 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900">
                          #{purchase.purchaseNumber}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                            purchase.status === 'received'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : purchase.status === 'in_transit'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : purchase.status === 'ordered'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : purchase.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {purchase.status === 'received'
                            ? '✅ Recibido en Bodega'
                            : purchase.status === 'in_transit'
                            ? '🚚 En Tránsito / Despachado'
                            : purchase.status === 'ordered'
                            ? '🔵 Pedido a Proveedor'
                            : purchase.status === 'cancelled'
                            ? '❌ Cancelado'
                            : '⏳ Pendiente'}
                        </span>

                        {/* Payment Status */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            purchase.paymentStatus === 'paid'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {purchase.paymentStatus === 'paid' ? '💳 Pagado' : '⚠️ Por Pagar'}
                        </span>

                        {/* Linked Customer Order badge */}
                        {purchase.linkedCustomerOrderId && (
                          <span
                            onClick={() => onGoToStoreOrders && onGoToStoreOrders()}
                            title="Haz clic para ver el pedido del cliente"
                            className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                          >
                            <ShoppingBag className="w-3 h-3 text-indigo-600" />
                            Pedido #{purchase.linkedCustomerOrderNumber || purchase.linkedCustomerOrderId}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span className="font-bold text-slate-800">
                          Proveedor: {purchase.supplierName}
                        </span>
                        <span>
                          Fecha: {new Date(purchase.purchaseDate || purchase.createdAt).toLocaleDateString('es-EC', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span>
                          {totalItemsCount} {totalItemsCount === 1 ? 'unidad' : 'unidades'} ({purchase.items?.length || 0} productos)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Cost & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right">
                      <div className="text-xs text-slate-500 font-medium">Costo Total</div>
                      <div className="font-mono font-black text-lg text-slate-900">
                        ${Number(purchase.totalCost || 0).toFixed(2)}
                        <span className="text-xs font-semibold text-slate-500 ml-1">{currency}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* 1-Click Receive in Warehouse */}
                      {!isReceived && purchase.status !== 'cancelled' && (
                        <button
                          onClick={() => setPurchaseToReceive(purchase)}
                          disabled={isReceivingPurchase && purchaseToReceive?.id === purchase.id}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition shadow-xs active:scale-95"
                          title="Ingresar productos recibidos a la bodega y stock"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Recibir en Bodega</span>
                        </button>
                      )}

                      {/* WhatsApp / Telegram format */}
                      <button
                        onClick={() => handleCopySupplierMessage(purchase)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs border border-slate-200 cursor-pointer transition"
                        title="Copiar texto de pedido para enviar al proveedor"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingPurchase(purchase);
                          setIsNewPurchaseModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs border border-slate-200 cursor-pointer transition"
                        title="Editar orden de compra"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setPurchaseToDelete(purchase)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 text-xs border border-slate-200 cursor-pointer transition"
                        title="Eliminar compra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Expand / Collapse */}
                      <button
                        onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs border border-slate-200 cursor-pointer transition"
                        title={isExpanded ? 'Contraer detalle' : 'Ver productos de la compra'}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Products Details */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200/80 p-4 sm:p-5 space-y-3">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center justify-between">
                      <span>Detalle de Productos ({purchase.items?.length || 0})</span>
                      {purchase.receivedDate && (
                        <span className="text-emerald-700 text-[11px] font-semibold">
                          Ingresado a bodega: {new Date(purchase.receivedDate).toLocaleDateString('es-EC')}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {Array.isArray(purchase.items) && purchase.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-3 flex items-center space-x-3 shadow-2xs"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-200">
                              <Package className="w-5 h-5" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate">
                              {item.name}
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                              {item.sku && <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-[10px]">SKU: {item.sku}</span>}
                              <span>Cant: <strong className="text-slate-800">{item.quantity}</strong></span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-[10px] text-slate-500">Costo Unitario</div>
                            <div className="font-mono font-bold text-xs text-slate-800">
                              ${Number(item.costPrice || 0).toFixed(2)}
                            </div>
                            <div className="font-mono font-black text-[11px] text-indigo-700 mt-0.5">
                              Sub: ${(Number(item.costPrice || 0) * Number(item.quantity || 1)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {purchase.notes && (
                      <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-2.5 text-xs text-amber-900">
                        <strong>Notas / Instrucciones de Proveedor:</strong> {purchase.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Nueva / Editar Compra a Proveedor */}
      {isNewPurchaseModalOpen && (
        <PurchaseFormModal
          purchase={editingPurchase}
          inventoryItems={inventoryItems}
          customerOrders={allCustomerOrders}
          currency={currency}
          authFetch={authFetch}
          onClose={() => {
            setIsNewPurchaseModalOpen(false);
            setEditingPurchase(null);
          }}
          onDeleteClick={(p) => {
            setPurchaseToDelete(p);
          }}
          onSaved={async () => {
            setIsNewPurchaseModalOpen(false);
            setEditingPurchase(null);
            await onRefreshPurchases();
          }}
          showToast={showToast}
        />
      )}

      {/* MODAL: Estado de Resultados Financiero y Margen Real */}
      {isFinancialModalOpen && (
        <FinancialSummaryModal
          summary={financialSummary}
          period={financialPeriod}
          onPeriodChange={(p) => setFinancialPeriod(p)}
          loading={loadingFinancial}
          currency={currency}
          onClose={() => setIsFinancialModalOpen(false)}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN: Eliminar Compra a Proveedor */}
      {purchaseToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                ¿Eliminar Orden de Compra #{purchaseToDelete.purchaseNumber}?
              </h3>
              <p className="text-xs text-slate-500">
                Proveedor: <strong className="text-slate-700">{purchaseToDelete.supplierName}</strong> • Inversión: <strong className="text-slate-700 font-mono">${Number(purchaseToDelete.totalCost || 0).toFixed(2)} {currency}</strong>
              </p>
            </div>

            {purchaseToDelete.status === 'received' && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">Aviso de Stock en Bodega:</strong>
                  Esta compra ya fue recibida. Al eliminarla, el stock ingresado ({Array.isArray(purchaseToDelete.items) ? purchaseToDelete.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 0} unidades) se restará automáticamente de tu inventario físico.
                </div>
              </div>
            )}

            {purchaseToDelete.linkedCustomerOrderId && (
              <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">Pedido de Cliente Vinculado:</strong>
                  Esta orden abastece al Pedido #{purchaseToDelete.linkedCustomerOrderNumber || purchaseToDelete.linkedCustomerOrderId}. Al eliminarla, el pedido volverá a estado pendiente de pedir a proveedor.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                disabled={isDeletingPurchase}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDeletePurchase}
                disabled={isDeletingPurchase}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer transition shadow-xs disabled:opacity-50 active:scale-95"
              >
                {isDeletingPurchase ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Eliminar Compra</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN: Recibir Compra en Bodega */}
      {purchaseToReceive && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                ¿Ingresar Compra #{purchaseToReceive.purchaseNumber} a Bodega?
              </h3>
              <p className="text-xs text-slate-500">
                Proveedor: <strong className="text-slate-700">{purchaseToReceive.supplierName}</strong>
              </p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
              <p className="font-bold">Productos que se sumarán al inventario físico:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-800">
                {Array.isArray(purchaseToReceive.items) && purchaseToReceive.items.map((it, idx) => (
                  <li key={idx}>
                    <strong>+{it.quantity || 1}</strong> {it.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPurchaseToReceive(null)}
                disabled={isReceivingPurchase}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeReceivePurchase}
                disabled={isReceivingPurchase}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer transition shadow-xs disabled:opacity-50 active:scale-95"
              >
                {isReceivingPurchase ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ingresando stock...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Ingreso a Bodega</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: Modal Formulario de Compra
// ==========================================

interface PurchaseFormModalProps {
  purchase: PurchaseOrder | null;
  inventoryItems?: InventoryItem[];
  customerOrders?: CustomerOrder[];
  currency: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onDeleteClick?: (purchase: PurchaseOrder) => void;
  onSaved: () => Promise<void>;
  showToast: (msg: string) => void;
}

const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({
  purchase,
  inventoryItems = [],
  customerOrders = [],
  currency,
  authFetch,
  onClose,
  onDeleteClick,
  onSaved,
  showToast,
}) => {
  const isEditing = Boolean(purchase);
  const [supplierName, setSupplierName] = useState(purchase?.supplierName || 'Proveedor Telegram Principal');
  const [supplierContact, setSupplierContact] = useState(purchase?.supplierContact || '');
  const [status, setStatus] = useState<string>(purchase?.status || 'received');
  const [paymentStatus, setPaymentStatus] = useState<string>(purchase?.paymentStatus || 'paid');
  const [linkedOrderId, setLinkedOrderId] = useState<string>(
    purchase?.linkedCustomerOrderId ? String(purchase.linkedCustomerOrderId) : ''
  );
  const [notes, setNotes] = useState(purchase?.notes || '');
  const [purchaseDate, setPurchaseDate] = useState(
    purchase?.purchaseDate
      ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );

  // Items in Purchase
  const [items, setItems] = useState<PurchaseItem[]>(
    purchase?.items && Array.isArray(purchase.items) ? [...purchase.items] : []
  );

  // Item Picker state
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered catalog products for picker
  const filteredCatalog = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return inventoryItems
      .filter((it) => it.name?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [inventoryItems, productSearch]);

  // Add Item from catalog
  const handleAddCatalogItem = (it: InventoryItem) => {
    const cost = Number(it.costPrice || it.salePrice || 0);
    setItems((prev) => [
      ...prev,
      {
        inventoryItemId: it.id,
        name: it.name,
        sku: it.sku,
        costPrice: cost.toFixed(2),
        salePrice: it.salePrice,
        quantity: 1,
        imageUrl: it.imageUrl || null,
        supplierName: (it as any).supplier || (it as any).channelTitle || supplierName,
      },
    ]);
    setProductSearch('');
  };

  // Add custom on-demand item
  const handleAddCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: 'Producto Bajo Pedido',
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        costPrice: '10.00',
        quantity: 1,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate total cost
  const totalCost = useMemo(() => {
    return items.reduce((sum, it) => {
      const cost = Number(it.costPrice || 0);
      const qty = Number(it.quantity || 1);
      return sum + cost * qty;
    }, 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      showToast('⚠️ Ingresa el nombre del proveedor');
      return;
    }
    if (items.length === 0) {
      showToast('⚠️ Agrega al menos un producto a la compra');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplierName: supplierName.trim(),
        supplierContact: supplierContact.trim(),
        items,
        totalCost: totalCost.toFixed(2),
        status,
        paymentStatus,
        linkedCustomerOrderId: linkedOrderId ? parseInt(linkedOrderId, 10) : null,
        notes: notes.trim(),
        purchaseDate,
      };

      let res: Response;
      if (isEditing && purchase) {
        res = await authFetch(`/api/purchases/${purchase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch('/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        showToast(isEditing ? '✓ Compra actualizada exitosamente' : '✓ Compra registrada exitosamente');
        await onSaved();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`❌ Error: ${errData.error || 'No se pudo guardar la compra'}`);
      }
    } catch (err) {
      console.error('Error saving purchase:', err);
      showToast('❌ Error de conexión al guardar la compra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {isEditing ? `Editar Compra #${purchase?.purchaseNumber}` : 'Nueva Compra / Pedido a Proveedor'}
            </h2>
            <p className="text-xs text-slate-500">
              Registra los productos que compraste o solicitaste a tus proveedores de Telegram
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Supplier & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Proveedor *</label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ej. Proveedor Calzados Telegram"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de la Compra</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estado de la Compra
                {status === 'received' && (
                  <span className="ml-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    + Suma stock
                  </span>
                )}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="received">✅ Recibida en Bodega (Ingresa y suma stock ya)</option>
                <option value="ordered">🔵 Ordenada al Proveedor (Pendiente recibir)</option>
                <option value="in_transit">🚚 En Tránsito / Despachada por Proveedor</option>
                <option value="pending">⏳ Pendiente de pedir</option>
                <option value="cancelled">❌ Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estado del Pago</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="paid">💳 Pagado al proveedor</option>
                <option value="unpaid">⚠️ Por pagar / Crédito</option>
              </select>
            </div>
          </div>

          {/* Link to Customer Order */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ¿Vincular a un Pedido de Cliente Bajo Pedido? (Opcional)
            </label>
            <select
              value={linkedOrderId}
              onChange={(e) => setLinkedOrderId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Ninguno (Compra directa para inventario propio)</option>
              {(customerOrders || []).map((ord) => (
                <option key={ord.id} value={ord.id}>
                  Pedido #{ord.orderNumber} - {ord.customerName} (${Number(ord.totalAmount).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Items Section */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide">
                Productos de la Compra ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                + Añadir Producto Manual
              </button>
            </div>

            {/* Search catalog picker */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Escribe para buscar y añadir productos de tu catálogo..."
                className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
              {filteredCatalog.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {filteredCatalog.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => handleAddCatalogItem(it)}
                      className="p-2.5 hover:bg-indigo-50/70 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {it.imageUrl && (
                          <img src={it.imageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800 truncate">{it.name}</span>
                        {it.sku && <span className="text-[10px] font-mono text-slate-500">({it.sku})</span>}
                      </div>
                      <span className="font-mono font-bold text-indigo-700 ml-2">
                        Costo: ${Number(it.costPrice || it.salePrice || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 flex items-center space-x-2.5 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={it.name}
                      onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                      placeholder="Nombre del producto"
                      className="w-full font-bold text-slate-900 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={it.sku || ''}
                      onChange={(e) => handleUpdateItem(idx, 'sku', e.target.value)}
                      placeholder="SKU (opcional)"
                      className="w-full text-[11px] font-mono text-slate-500 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="w-16 flex-shrink-0">
                    <label className="text-[10px] text-slate-500 block">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center text-xs"
                    />
                  </div>

                  <div className="w-20 flex-shrink-0">
                    <label className="text-[10px] text-slate-500 block">Costo ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.costPrice}
                      onChange={(e) => handleUpdateItem(idx, 'costPrice', e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs text-right"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Total Cost Display */}
            <div className="bg-slate-100/90 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Total Inversión de Compra:</span>
              <span className="font-mono font-black text-base text-indigo-700">
                ${totalCost.toFixed(2)} {currency}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notas / Guía de Proveedor</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, números de guía del proveedor o acuerdos de pago..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div>
              {isEditing && purchase && onDeleteClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteClick(purchase);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer transition border border-rose-200/80"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Orden</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Compra'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: Modal Resumen Financiero
// ==========================================

interface FinancialSummaryModalProps {
  summary: FinancialReportSummary | null;
  period: string;
  onPeriodChange: (p: string) => void;
  loading: boolean;
  currency: string;
  onClose: () => void;
}

const FinancialSummaryModal: React.FC<FinancialSummaryModalProps> = ({
  summary,
  period,
  onPeriodChange,
  loading,
  currency,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-600" />
              Estado de Resultados & Rentabilidad Real
            </h2>
            <p className="text-xs text-slate-500">
              Compara tus ingresos reales por ventas frente a los costos de compra a proveedores
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Period selector */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Esta Semana' },
              { id: 'month', label: 'Este Mes' },
              { id: 'year', label: 'Este Año' },
              { id: 'all', label: 'Histórico Total' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onPeriodChange(tab.id)}
                className={`flex-1 py-1.5 rounded-lg font-bold text-center transition cursor-pointer text-xs ${
                  period === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              Calculando estado de resultados...
            </div>
          ) : summary ? (
            <div className="space-y-6">
              {/* Top Financial Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Ingresos por Ventas</span>
                  <div className="text-2xl font-black text-emerald-900 mt-1">
                    ${summary.totalSalesRevenue.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">{summary.totalOrdersCount} ventas concretadas</p>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Costo de Mercancía (COGS)</span>
                  <div className="text-2xl font-black text-rose-900 mt-1">
                    ${summary.costOfGoodsSold.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-rose-700 mt-0.5">Pagado a proveedores</p>
                </div>

                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-violet-800 uppercase tracking-wide">Utilidad Bruta Real</span>
                  <div className="text-2xl font-black text-violet-900 mt-1">
                    ${summary.grossProfit.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-violet-700 mt-0.5 font-bold">Margen: {summary.netProfitMarginPercent}%</p>
                </div>
              </div>

              {/* Physical Inventory Valuation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Valoración de Stock Físico en Bodega
                </h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Unidades Físicas:</span>
                    <strong className="text-slate-900 text-sm font-mono">{summary.currentPhysicalStockUnits} unid.</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Valor a Costo (Inversión):</span>
                    <strong className="text-slate-900 text-sm font-mono">${summary.currentPhysicalStockCostValue.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Valor a Venta Estimado:</span>
                    <strong className="text-emerald-700 text-sm font-mono">${summary.currentPhysicalStockSaleValue.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Recent Ledger / Transactions */}
              {summary.recentTransactions && summary.recentTransactions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Libro de Movimientos Recientes
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {summary.recentTransactions.map((tx, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'sale'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {tx.type === 'sale' ? 'Venta' : 'Compra'}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900">{tx.reference}</span>
                            <span className="text-slate-500 ml-2 text-[11px]">{tx.description}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-mono font-bold ${
                              tx.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {tx.amount >= 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(tx.date).toLocaleDateString('es-EC')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
