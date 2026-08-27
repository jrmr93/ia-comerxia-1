import React from 'react';
import {
  Copy,
  Clock,
  MessageCircle,
  Truck,
  Building2,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  AlertCircle,
  CreditCard,
  DollarSign,
  Send,
  Printer,
  MapPin,
  Receipt,
  Check,
  Boxes,
  ShoppingBag,
} from 'lucide-react';
import { normalizeEcuadorPhone } from '../utils/phone.ts';
import { getCustomerCi, getCleanAddress, stripCiFromAddress } from '../utils/orderUtils.ts';

interface OrdersTableViewProps {
  orders: any[];
  storeConfig: {
    storeName?: string;
    currency?: string;
    logoUrl?: string | null;
  };
  paymentPartners: any[];
  currency?: string;
  onOpenEditOrder: (order: any) => void;
  onOpenConfirmVoucher: (order: any) => void;
  onOpenShipOrder: (order: any) => void;
  onOpenShippingCost?: (order: any) => void;
  onOpenPendingShipping?: (order: any) => void;
  onOpenPrintShippingTicket?: (order: any) => void;
  onOpenRequestShippingData?: (order: any) => void;
  onGenerateSupplierPurchase?: (order: any) => void | Promise<void>;
  onViewLinkedPurchase?: (purchaseId: number) => void;
  onUpdateStatus: (
    orderId: any,
    status: string,
    voucher?: string,
    notes?: string,
    trackingNumber?: string,
    trackingCarrier?: string,
    trackingNotes?: string
  ) => Promise<void>;
  onDeleteOrder: (order: any) => void;
  showToast: (msg: string) => void;
  buildWhatsAppLink: (phone: string, text?: string) => string;
  renderPaymentBadge: (method: string, partners: any[]) => React.ReactNode;
}

export const OrdersTableView: React.FC<OrdersTableViewProps> = ({
  orders = [],
  storeConfig,
  paymentPartners = [],
  currency = '$',
  onOpenEditOrder,
  onOpenConfirmVoucher,
  onOpenShipOrder,
  onOpenShippingCost,
  onOpenPendingShipping,
  onOpenPrintShippingTicket,
  onOpenRequestShippingData,
  onGenerateSupplierPurchase,
  onViewLinkedPurchase,
  onUpdateStatus,
  onDeleteOrder,
  showToast,
  buildWhatsAppLink,
  renderPaymentBadge,
}) => {
  // 1. Abrir chat de WhatsApp directamente con el cliente (sin texto/mensaje)
  const handleOpenDirectWhatsApp = (ord: any) => {
    const norm = normalizeEcuadorPhone(ord.customerPhone);
    if (!norm.whatsappDigits || !norm.isValid) {
      showToast('⚠️ Este pedido no tiene registrado un número de WhatsApp. Por favor añádelo en el formulario.');
      onOpenEditOrder(ord);
      return;
    }
    const url = buildWhatsAppLink(norm.whatsappDigits);
    window.open(url, '_blank');
  };

  // 2. Abrir WhatsApp con la plantilla estructurada del pedido
  const handleOpenClientWhatsApp = (ord: any) => {
    const norm = normalizeEcuadorPhone(ord.customerPhone);
    if (!norm.whatsappDigits || !norm.isValid) {
      showToast('⚠️ Este pedido no tiene registrado un número de WhatsApp. Por favor añádelo en el formulario.');
      onOpenEditOrder(ord);
      return;
    }
    const activePartners = Array.isArray(paymentPartners) ? paymentPartners.filter((p) => p.active !== false) : [];
    const matchedPartner = activePartners.find(
      (p) =>
        p.id === ord.paymentMethod ||
        p.name?.toLowerCase() === (ord.paymentMethod || '').toLowerCase() ||
        (ord.paymentMethod && p.name?.toLowerCase().includes(ord.paymentMethod.toLowerCase())) ||
        (ord.paymentMethod && ord.paymentMethod.toLowerCase().includes(p.name?.toLowerCase()))
    );
    const partnerName = matchedPartner ? matchedPartner.name : (ord.paymentMethod || 'Coordinar con la tienda');
    const isPickup = (ord.customerAddress || '').toLowerCase().includes('retiro');

    let msg = `¡Hola *${ord.customerName || 'estimado cliente'}*! 👋 Me contacto de *${storeConfig.storeName || 'la tienda'}* con respecto a tu *Pedido #${ord.orderNumber}*:\n\n`;
    msg += `💰 *Total:* $${Number(ord.totalAmount || 0).toFixed(2)} ${currency}\n`;
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

  // Helper to copy order summary
  const handleCopyOrderSummary = (ord: any) => {
    const isPickup = (ord.customerAddress || '').toLowerCase().includes('retiro');
    const ci = getCustomerCi(ord);
    let summary = `*PEDIDO #${ord.orderNumber}*\nCliente: ${ord.customerName} (${ord.customerPhone})\n`;
    if (ci) summary += `Cédula: ${ci}\n`;
    summary += `Modalidad: ${isPickup ? 'Retiro en Local' : 'Envío a Domicilio'}\nDirección: ${ord.customerAddress}\nMétodo: ${ord.paymentMethod}\n`;
    if (ord.paymentVoucher) {
      summary += `Comprobante de Pago: ${ord.paymentVoucher}\n`;
    }
    if (ord.trackingNumber || ord.trackingCarrier) {
      summary += `Envío (${ord.trackingCarrier || 'Courier'}): Guía #${ord.trackingNumber || 'N/A'}\n`;
    }
    summary += `*Total: $${Number(ord.totalAmount).toFixed(2)} ${currency}*\n\n*Productos:*\n`;
    if (Array.isArray(ord.items)) {
      ord.items.forEach((it: any) => {
        summary += `• ${it.quantity || 1}x ${it.name || it.item?.name} ($${it.salePrice || it.item?.salePrice})\n`;
      });
    }
    navigator.clipboard.writeText(summary);
    showToast('✓ Resumen del pedido copiado al portapapeles');
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
            <th className="py-3.5 px-4 whitespace-nowrap">Acciones</th>
            <th className="py-3.5 px-4 whitespace-nowrap"># Pedido & Fecha</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Cliente & Contacto</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Modalidad / Entrega</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Productos</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Método de Pago</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Comprobante</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Guía / Envío</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Total</th>
            <th className="py-3.5 px-4 whitespace-nowrap">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((ord) => {
            const isPickup = (ord.customerAddress || '').toLowerCase().includes('retiro');
            const itemsCount = Array.isArray(ord.items)
              ? ord.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0)
              : 0;
            const isPending = ord.status === 'pending';

            return (
              <tr
                key={ord.id}
                className={
                  isPending
                    ? 'halo-pending-row transition-all relative'
                    : 'hover:bg-slate-50/70 transition'
                }
              >
                {/* 1. Acciones (ACCIONES CENTRALIZADAS Y LIMPIAS SEGÚN ESTADO) */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5 relative">
                    {/* MODALIDAD ENVÍO Y ESTADO PENDIENTE */}
                    {ord.status === 'pending' && !isPickup ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenPendingShipping) {
                              onOpenPendingShipping(ord);
                            } else if (onOpenShippingCost) {
                              onOpenShippingCost(ord);
                            }
                          }}
                          className="p-1.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white border border-sky-700 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-bold shadow-xs active:scale-95"
                          title="Gestionar Servicio de Envío, Cotizaciones y Comprobante"
                        >
                          <Truck className="w-3.5 h-3.5 text-sky-200" />
                          <span>Gestionar Servicio de Envío</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(ord)}
                          className={`p-1.5 px-2.5 rounded-xl border transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95 ${
                            normalizeEcuadorPhone(ord.customerPhone).isValid
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                          title={
                            normalizeEcuadorPhone(ord.customerPhone).isValid
                              ? 'Abrir chat de WhatsApp vacío (directo sin mensaje)'
                              : 'Sin WhatsApp registrado - Clic para ingresar número'
                          }
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    ) : ord.status === 'pending' && isPickup ? (
                      <>
                        {/* RETIRO EN LOCAL PENDIENTE */}
                        <button
                          type="button"
                          onClick={() => onOpenConfirmVoucher(ord)}
                          className="p-1.5 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white border border-purple-800 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-bold shadow-xs active:scale-95"
                          title="Confirmar comprobante de retiro en local"
                        >
                          <Receipt className="w-3.5 h-3.5 text-purple-200" />
                          <span>Confirmar Comprobante</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(ord)}
                          className={`p-1.5 px-2.5 rounded-xl border transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95 ${
                            normalizeEcuadorPhone(ord.customerPhone).isValid
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                          title="Abrir chat de WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    ) : ord.status === 'confirmed' ? (
                      <>
                        {/* CONFIRMADO */}
                        {!isPickup && (
                          <button
                            type="button"
                            onClick={() => onOpenShipOrder(ord)}
                            className="p-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-bold shadow-xs active:scale-95"
                            title="Gestionar Guía de Envío"
                          >
                            <Truck className="w-3.5 h-3.5 text-blue-200" />
                            <span>Gestionar Guía</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(ord)}
                          className="p-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95"
                          title="Abrir chat de WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    ) : ord.status === 'shipped' ? (
                      <>
                        {/* ENVIADO */}
                        <button
                          type="button"
                          onClick={() => onOpenShipOrder(ord)}
                          className="p-1.5 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs"
                          title="Ver / Modificar Guía de Envío"
                        >
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Guía: {ord.trackingNumber ? `#${ord.trackingNumber}` : 'Ver'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(ord)}
                          className="p-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95"
                          title="Abrir chat de WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateStatus(
                              ord.id,
                              'delivered',
                              ord.paymentVoucher || undefined,
                              ord.notes || undefined,
                              ord.trackingNumber || undefined,
                              ord.trackingCarrier || undefined,
                              ord.trackingNotes || undefined
                            );
                            showToast('✓ Pedido marcado como ENTREGADO');
                          }}
                          className="p-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs"
                          title="Marcar como Entregado"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Entregado</span>
                        </button>
                      </>
                    ) : ord.status === 'delivered' ? (
                      <>
                        {/* ENTREGADO */}
                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(ord)}
                          className="p-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95"
                          title="Abrir chat de WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* CANCELADO U OTRO */}
                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(ord)}
                          className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs"
                          title="Abrir chat de WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    )}

                    {/* SEPARADOR */}
                    <div className="h-4 w-px bg-slate-200 mx-0.5" />

                    {/* ICONOS DE ACCIÓN VISIBLES EN TODOS LOS ESTADOS (MODIFICAR Y ELIMINAR) */}
                    <button
                      type="button"
                      onClick={() => onOpenEditOrder(ord)}
                      className="p-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200 hover:border-sky-300 transition cursor-pointer shadow-2xs active:scale-95"
                      title="Modificar detalle del pedido"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteOrder(ord)}
                      className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition cursor-pointer shadow-2xs active:scale-95"
                      title="Eliminar pedido"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                {/* 2. # Pedido & Fecha */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5 font-mono font-bold text-sky-600 text-xs">
                    {isPending && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-amber-500 halo-dot-pulse flex-shrink-0"
                        title="Pedido pendiente de atención"
                      />
                    )}
                    <span className={isPending ? 'text-amber-950 font-black' : ''}>#{ord.orderNumber}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(ord.orderNumber || '');
                        showToast('✓ Número de orden copiado');
                      }}
                      className="text-slate-400 hover:text-sky-600 p-0.5 cursor-pointer"
                      title="Copiar número"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Clock className={`w-3 h-3 ${isPending ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
                    {ord.createdAt
                      ? new Date(ord.createdAt).toLocaleDateString('es-EC', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Reciente'}
                    {isPending && (
                      <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-200/80 text-amber-900 border border-amber-300">
                        PENDIENTE
                      </span>
                    )}
                  </div>
                </td>

                {/* Cliente & Contacto */}
                <td className="py-3.5 px-4">
                  <div className="font-bold text-slate-900 whitespace-nowrap">
                    {ord.customerName || 'Cliente'}
                  </div>
                  {/* Cédula del Cliente */}
                  {(() => {
                    const ci = getCustomerCi(ord);
                    if (ci) {
                      return (
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">CI:</span>
                          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200/80 px-1.5 py-0.2 rounded font-mono font-bold text-[11px]">
                            {ci}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(ci);
                                showToast('✓ Cédula copiada');
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
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    {(() => {
                      const norm = normalizeEcuadorPhone(ord.customerPhone);
                      if (norm.whatsappDigits && norm.isValid) {
                        return (
                          <div className="flex items-center space-x-1">
                            <span className="text-[11px] text-slate-600 font-mono">
                              {norm.formattedLocal || ord.customerPhone}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(norm.formattedLocal || ord.customerPhone);
                                showToast('✓ Teléfono copiado');
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copiar teléfono"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          Sin teléfono
                        </span>
                      );
                    })()}
                  </div>
                </td>

                {/* Modalidad / Entrega */}
                <td className="py-3.5 px-4 max-w-[200px]">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      isPickup
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    {isPickup ? <Building2 className="w-3 h-3 text-amber-600" /> : <Truck className="w-3 h-3 text-sky-600" />}
                    {isPickup ? 'Retiro en Local' : 'Envío'}
                  </span>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5" title={getCleanAddress(ord.customerAddress)}>
                    {getCleanAddress(ord.customerAddress)}
                  </p>
                </td>

                {/* Productos */}
                <td className="py-3.5 px-4 max-w-[240px]">
                  <div className="flex items-center space-x-1 font-semibold text-slate-700">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] text-sky-700 border border-slate-200 font-bold">
                      {itemsCount} {itemsCount === 1 ? 'ítem' : 'ítems'}
                    </span>
                  </div>
                  <div
                    className="text-[11px] text-slate-500 truncate mt-0.5"
                    title={
                      Array.isArray(ord.items)
                        ? ord.items.map((it: any) => `${it.quantity || 1}x ${it.name || it.item?.name}`).join(', ')
                        : ''
                    }
                  >
                    {Array.isArray(ord.items)
                      ? ord.items.map((it: any) => `${it.quantity || 1}x ${it.name || it.item?.name}`).join(', ')
                      : 'Sin productos'}
                  </div>

                  {/* Estado de Abastecimiento / Bajo Pedido */}
                  <div className="mt-1.5 flex flex-col gap-1">
                    {ord.fulfillmentStatus === 'supplier_pending' ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-md">
                          <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                          <span>Sin Stock (Bajo Pedido)</span>
                        </span>
                        {onGenerateSupplierPurchase && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onGenerateSupplierPurchase(ord);
                            }}
                            className="inline-flex items-center justify-center gap-1 px-2 py-0.8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] shadow-2xs transition cursor-pointer active:scale-95"
                            title="Crear orden de compra automática al proveedor de Telegram"
                          >
                            <Boxes className="w-3 h-3" />
                            <span>Pedir a Proveedor (1-clic)</span>
                          </button>
                        )}
                      </div>
                    ) : ord.fulfillmentStatus === 'supplier_ordered' ? (
                      <div className="flex items-center gap-1">
                        <span
                          onClick={() => ord.linkedPurchaseId && onViewLinkedPurchase && onViewLinkedPurchase(ord.linkedPurchaseId)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-300 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-sky-100"
                          title="Haz clic para ver la compra al proveedor"
                        >
                          <Truck className="w-3 h-3 text-sky-600 flex-shrink-0" />
                          <span>Pedido #{ord.linkedPurchaseNumber || ord.linkedPurchaseId} en camino</span>
                        </span>
                      </div>
                    ) : ord.fulfillmentStatus === 'supplier_received' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span>Recibido en Bodega (Listo para entregar)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        📦 Stock disponible
                      </span>
                    )}
                  </div>
                </td>

                {/* Método de Pago */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {renderPaymentBadge(ord.paymentMethod, paymentPartners)}
                </td>

                {/* Comprobante */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {ord.paymentVoucher ? (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-mono font-bold">
                      <CheckCircle2 className="w-3 h-3 text-purple-600" />
                      <span>{ord.paymentVoucher}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px] font-medium">—</span>
                  )}
                </td>

                {/* Guía / Envío */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {isPickup ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Retiro en Local</span>
                    </div>
                  ) : ord.trackingNumber || ord.trackingCarrier ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-[11px]">
                      <Truck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-[10px] text-blue-700">
                          {ord.trackingCarrier || 'Guía Envío'}
                        </span>
                        {ord.trackingNumber && (
                          <span className="font-mono font-bold text-slate-900 text-[11px]">
                            {ord.trackingNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">—</span>
                  )}
                </td>

                {/* Total */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="flex items-baseline">
                      <span className="font-mono font-black text-sm text-emerald-700">
                        ${Number(ord.totalAmount || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">{currency}</span>
                    </div>
                  </div>
                </td>

                {/* Estado */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black tracking-wide uppercase shadow-xs halo-badge-beacon">
                            ⚡ NUEVO
                          </span>
                        )}
                        <select
                          value={ord.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            if (newStatus === 'confirmed') {
                              onOpenConfirmVoucher(ord);
                            } else if (newStatus === 'shipped') {
                              if (ord.status === 'pending' && !ord.paymentVoucher) {
                                showToast('⚠️ Para enviar el pedido, primero debes confirmarlo con su comprobante de pago');
                                onOpenConfirmVoucher(ord);
                              } else {
                                onOpenShipOrder(ord);
                              }
                            } else if (newStatus === 'delivered') {
                              if (ord.status === 'pending' && !ord.paymentVoucher) {
                                showToast('⚠️ Para entregar el pedido, primero debes confirmarlo con su comprobante de pago');
                                onOpenConfirmVoucher(ord);
                              } else {
                                await onUpdateStatus(ord.id, 'delivered', ord.paymentVoucher || undefined, ord.notes || undefined);
                                showToast(isPickup ? '✓ Pedido marcado como ENTREGADO en local' : '✓ Pedido marcado como ENTREGADO');
                              }
                            } else {
                              await onUpdateStatus(ord.id, newStatus, ord.paymentVoucher || undefined, ord.notes || undefined);
                              showToast('✓ Estado del pedido actualizado');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-black focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm transition ${
                            ord.status === 'pending'
                              ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 ring-2 ring-amber-400/70 shadow-amber-200'
                              : 'bg-slate-50 border border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="pending">🕒 Pendiente</option>
                          <option value="confirmed">🟣 Confirmado {isPickup ? '(Listo en Local)' : ''}</option>
                          {!isPickup && (
                            <option value="shipped" disabled={ord.status === 'pending' && !ord.paymentVoucher}>
                              🚚 Enviado {ord.status === 'pending' && !ord.paymentVoucher ? '(Requiere Confirmación)' : ''}
                            </option>
                          )}
                          <option value="delivered" disabled={ord.status === 'pending' && !ord.paymentVoucher}>
                            ✅ {isPickup ? 'Entregado en Local' : 'Entregado'} {ord.status === 'pending' && !ord.paymentVoucher ? '(Requiere Confirmación)' : ''}
                          </option>
                          <option value="cancelled">❌ Cancelado</option>
                        </select>
                      </div>
                      <div className="mt-1">
                        {ord.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50/90 border border-amber-200/80 px-1.5 py-0.5 rounded-md">
                            ⏳ Stock intacto (esperando pago)
                          </span>
                        ) : ord.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                            ↩️ Stock disponible (cancelado)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            ✓ Venta concretada (Stock descontado)
                          </span>
                        )}
                      </div>
                    </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
