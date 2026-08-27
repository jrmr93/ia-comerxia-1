import React, { useState } from 'react';
import {
  X,
  Truck,
  MapPin,
  MessageCircle,
  Copy,
  Check,
  Send,
  Printer,
  User,
  Building2,
  FileText,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Package,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CustomerOrder, CourierPartner } from '../types.ts';
import { normalizeEcuadorPhone, buildWhatsAppLink } from '../utils/phone.ts';
import { getCustomerCi, stripCiFromAddress } from '../utils/orderUtils.ts';

interface ManageShippingGuideModalProps {
  order: CustomerOrder | null;
  storeConfig: {
    storeName?: string;
    currency?: string;
    logoUrl?: string | null;
    courierLogos?: string | CourierPartner[];
  };
  courierPartners?: CourierPartner[];
  currency?: string;
  onClose: () => void;
  onSaveShippingData: (
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
  ) => Promise<boolean | void>;
  onPrintShippingTicket?: (order: CustomerOrder) => void;
  onOpenEditOrder?: (order: CustomerOrder) => void;
  onOpenDeleteOrder?: (order: CustomerOrder) => void;
  showToast: (msg: string) => void;
}

export const ManageShippingGuideModal: React.FC<ManageShippingGuideModalProps> = ({
  order,
  storeConfig,
  courierPartners = [],
  currency = '$',
  onClose,
  onSaveShippingData,
  onPrintShippingTicket,
  onOpenEditOrder,
  onOpenDeleteOrder,
  showToast,
}) => {
  if (!order) return null;

  const phoneNorm = normalizeEcuadorPhone(order.customerPhone);
  const activeCouriers = courierPartners.filter((c) => c.active !== false);

  // Helper to parse address into structured fields
  const parseAddress = (rawAddress: string, existingCi: string) => {
    let prov = '';
    let can = '';
    let par = '';
    let dir = stripCiFromAddress(rawAddress || '');

    const provMatch = rawAddress.match(/(?:Provincia|Prov\.?)[\s:]*([^\n|]+)/i);
    if (provMatch) prov = stripCiFromAddress(provMatch[1]).trim();

    const canMatch = rawAddress.match(/(?:Cant[oó]n|Ciudad|Cant\.?)[\s:]*([^\n|]+)/i);
    if (canMatch) can = stripCiFromAddress(canMatch[1]).trim();

    const parMatch = rawAddress.match(/(?:Parroquia|Parr\.?)[\s:]*([^\n|]+)/i);
    if (parMatch) par = stripCiFromAddress(parMatch[1]).trim();

    const dirMatch = rawAddress.match(/(?:Direcci[oó]n|Direccion)[\s:]*([\s\S]+)/i);
    if (dirMatch) {
      dir = stripCiFromAddress(dirMatch[1]).trim();
    } else {
      // If structured markers not present, strip out CI if present
      if (existingCi) {
        dir = dir
          .replace(new RegExp(`(?:C\\.?I\\.?|C[eé]dula)[\\s:]*${existingCi}`, 'i'), '')
          .replace(/^[|\s,;-]+|[|\s,;-]+$/g, '')
          .trim();
      }
    }

    return { prov, can, par, dir };
  };

  const currentCi = getCustomerCi(order);
  const parsed = parseAddress(order.customerAddress || '', currentCi);

  // State for destination / recipient data
  const [ciInput, setCiInput] = useState<string>(currentCi);
  const [nameInput, setNameInput] = useState<string>(order.customerName || '');
  const [provinceInput, setProvinceInput] = useState<string>(parsed.prov);
  const [cantonInput, setCantonInput] = useState<string>(parsed.can);
  const [parishInput, setParishInput] = useState<string>(parsed.par);
  const [exactAddressInput, setExactAddressInput] = useState<string>(parsed.dir);
  const [directAddressInput, setDirectAddressInput] = useState<string>(stripCiFromAddress(order.customerAddress || ''));
  const [addressMode, setAddressMode] = useState<'structured' | 'direct'>('structured');

  // State for shipping guide / carrier
  const [carrierInput, setCarrierInput] = useState<string>(
    order.trackingCarrier || activeCouriers[0]?.name || 'Servientrega'
  );
  const [trackingNumberInput, setTrackingNumberInput] = useState<string>(order.trackingNumber || '');
  const [trackingNotesInput, setTrackingNotesInput] = useState<string>(order.trackingNotes || '');

  // Matched courier to get configured quote/tracking URL
  const matchedCourier = activeCouriers.find(
    (c) =>
      c.name.toLowerCase() === (carrierInput || '').trim().toLowerCase() ||
      (carrierInput && c.name.toLowerCase().includes(carrierInput.trim().toLowerCase())) ||
      (carrierInput && carrierInput.trim().toLowerCase().includes(c.name.toLowerCase()))
  );

  const activeCouriersWithQuote = activeCouriers.filter((c) => !!c.quoteUrl?.trim());

  const handleOpenQuoteUrl = (url?: string) => {
    if (!url || !url.trim()) return;
    const clean = url.trim();
    const target = clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  // UI States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isWhatsAppRequestOpen, setIsWhatsAppRequestOpen] = useState<boolean>(false);

  // Template to request structured shipping data from the client
  const generateShippingRequestMessage = () => {
    let msg = `¡Hola *${nameInput.trim() || order.customerName || 'estimado cliente'}*! 👋\n\n`;
    msg += `Tu pedido *#${order.orderNumber}* en *${storeConfig.storeName || 'nuestra tienda'}* está siendo preparado para despacho. 📦✨\n\n`;
    msg += `Por favor, confírmanos tus *datos completos de envío* para emitir tu guía y etiqueta de transporte:\n\n`;
    msg += `🪪 *Cédula de Identidad:*\n`;
    msg += `👤 *Nombres completos:*\n`;
    msg += `🏛️ *Provincia:*\n`;
    msg += `🏙️ *Cantón / Ciudad:*\n`;
    msg += `📍 *Parroquia:*\n`;
    msg += `🏠 *Dirección exacta y referencia:*\n\n`;
    msg += `¡Quedamos atentos a tu confirmación para proceder con el envío de inmediato! 🚚`;
    return msg;
  };

  const handleSendWhatsAppRequest = () => {
    if (!phoneNorm.whatsappDigits || !phoneNorm.isValid) {
      showToast('⚠️ Este pedido no tiene registrado un número de WhatsApp válido.');
      return;
    }
    const msg = generateShippingRequestMessage();
    const url = buildWhatsAppLink(phoneNorm.whatsappDigits, msg);
    window.open(url, '_blank');
    showToast('✓ Solicitud de datos de envío enviada a WhatsApp');
  };

  const handleCopyWhatsAppRequest = () => {
    const msg = generateShippingRequestMessage();
    navigator.clipboard.writeText(msg);
    showToast('✓ Plantilla copiada al portapapeles');
  };

  // Build the compiled address string from structured fields (never include CI in address)
  const buildFinalAddress = () => {
    if (addressMode === 'direct') {
      return stripCiFromAddress(directAddressInput).trim() || 'Envío a Domicilio';
    }

    const lines: string[] = [];
    if (provinceInput.trim()) lines.push(`Provincia: ${provinceInput.trim()}`);
    if (cantonInput.trim()) lines.push(`Cantón: ${cantonInput.trim()}`);
    if (parishInput.trim()) lines.push(`Parroquia: ${parishInput.trim()}`);
    if (exactAddressInput.trim()) lines.push(`Dirección: ${exactAddressInput.trim()}`);

    return lines.length > 0 ? lines.join(' | ') : (stripCiFromAddress(directAddressInput).trim() || 'Envío a Domicilio');
  };

  // Save handler (save changes or mark as shipped)
  const handleSave = async (markAsShipped: boolean, notifyWhatsApp: boolean) => {
    setError(null);
    const finalAddress = buildFinalAddress();
    const finalCarrier = carrierInput.trim();
    const finalTracking = trackingNumberInput.trim();
    const finalNotes = trackingNotesInput.trim();
    const finalCi = ciInput.trim();
    const finalName = nameInput.trim() || order.customerName;

    if (markAsShipped && !finalTracking) {
      setError('Debes ingresar el N° de Guía / Código de Tracking para marcar el pedido como Enviado.');
      return;
    }

    setIsSaving(true);
    try {
      const newStatus = markAsShipped ? 'shipped' : order.status;

      await onSaveShippingData(order.id, {
        customerAddress: finalAddress,
        customerName: finalName,
        customerCi: finalCi,
        trackingCarrier: finalCarrier || undefined,
        trackingNumber: finalTracking || undefined,
        trackingNotes: finalNotes || undefined,
        status: newStatus,
      });

      showToast(
        markAsShipped
          ? `✓ Pedido #${order.orderNumber} marcado como ENVIADO con guía #${finalTracking}`
          : `✓ Datos de envío y guía del pedido #${order.orderNumber} actualizados exitosamente`
      );

      // Send tracking update message via WhatsApp if requested
      if (notifyWhatsApp) {
        if (!phoneNorm.whatsappDigits || !phoneNorm.isValid) {
          showToast('⚠️ No se abrió WhatsApp porque el número registrado no es válido.');
        } else {
          let shipMsg = `¡Hola *${finalName}*! 🚚\n\n`;
          shipMsg += `Te informamos que tu pedido *#${order.orderNumber}* en *${storeConfig.storeName || 'nuestra tienda'}* ha sido *ENVIADO / DESPACHADO* con éxito.\n\n`;
          shipMsg += `📦 *Empresa de Transporte / Courier:* ${finalCarrier || 'Courier'}\n`;
          if (finalTracking) {
            shipMsg += `🔍 *N° de Guía / Tracking:* ${finalTracking}\n`;
          }
          if (finalNotes) {
            shipMsg += `📝 *Detalle / Instrucciones:* ${finalNotes}\n`;
          }
          shipMsg += `📍 *Dirección de Destino:* ${finalAddress}\n`;
          if (finalCi) {
            shipMsg += `🪪 *Cédula:* ${finalCi}\n`;
          }
          shipMsg += `💰 *Total:* $${Number(order.totalAmount).toFixed(2)} ${currency}\n\n`;
          shipMsg += `¡Muchas gracias por tu compra! Quedamos atentos para cualquier consulta sobre tu entrega.`;

          const waUrl = buildWhatsAppLink(phoneNorm.whatsappDigits, shipMsg);
          window.open(waUrl, '_blank');
        }
      }

      if (onClose) onClose();
    } catch (err: any) {
      console.error('Error saving shipping guide:', err);
      setError(err.message || 'Error al guardar la información de envío');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDirectWhatsApp = () => {
    if (phoneNorm.whatsappDigits && phoneNorm.isValid) {
      const link = buildWhatsAppLink(phoneNorm.whatsappDigits);
      window.open(link, '_blank');
    } else {
      showToast('⚠️ No hay un número de WhatsApp válido registrado para este cliente');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-blue-200 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto animate-scaleUp max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
          <div className="flex items-center space-x-3 text-blue-700">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">Gestión de Guía de Envío</h3>
                <span className="font-mono font-black text-blue-700 text-xs px-2 py-0.5 bg-blue-50 rounded-md border border-blue-200">
                  #{order.orderNumber}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                    order.status === 'shipped'
                      ? 'bg-blue-100 text-blue-800'
                      : order.status === 'confirmed'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {order.status === 'shipped'
                    ? 'Enviado'
                    : order.status === 'confirmed'
                    ? 'Confirmado'
                    : 'Pendiente'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Flujo guiado para solicitar datos, completar destinatario y registrar guía de transporte
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Order Quick Context */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{order.customerName}</span>
                <span className="text-slate-500 font-mono text-xs">({order.customerPhone || 'Sin teléfono'})</span>
                <button
                  type="button"
                  onClick={handleOpenDirectWhatsApp}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs ${
                    phoneNorm.isValid
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 active:scale-95'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                  title="Abrir chat de WhatsApp directamente con el cliente (sin mensaje)"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>{phoneNorm.isValid ? 'Abrir WhatsApp' : 'Añadir Tel.'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-600 truncate max-w-md">
                <span className="font-semibold text-slate-500">Dirección actual:</span> {order.customerAddress || 'Envío a Domicilio'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
              <span className="font-mono font-black text-emerald-700 text-sm">
                ${Number(order.totalAmount).toFixed(2)} {currency}
              </span>
            </div>
          </div>

          {/* 1.- SOLICITAR DATOS PARA ENVÍO */}
          <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-300 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-emerald-950 font-black text-xs">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                  1
                </span>
                <span>1.- Solicitar Datos para Envío</span>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsAppRequestOpen(!isWhatsAppRequestOpen)}
                className="text-[11px] text-emerald-800 hover:text-emerald-950 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isWhatsAppRequestOpen ? 'Ocultar plantilla' : 'Ver plantilla editable'}</span>
                {isWhatsAppRequestOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <p className="text-[11px] text-emerald-900 leading-snug">
              Envía al cliente la plantilla oficial por WhatsApp para solicitar sus datos de facturación, cédula, provincia, cantón y dirección exacta.
            </p>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={handleSendWhatsAppRequest}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Pedir Datos por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWhatsAppRequest}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-700" />
                <span>Copiar Plantilla</span>
              </button>
            </div>

            {isWhatsAppRequestOpen && (
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs mt-2">
                {generateShippingRequestMessage()}
              </div>
            )}
          </div>

          {/* 2.- FORMULARIO DATOS DE DESTINO Y DESTINATARIO */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                <span>2.- Formulario Datos de Destino y Destinatario</span>
              </div>
              <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAddressMode('structured')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                    addressMode === 'structured' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Campos Separados
                </button>
                <button
                  type="button"
                  onClick={() => setAddressMode('direct')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                    addressMode === 'direct' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Texto Libre
                </button>
              </div>
            </div>

            {addressMode === 'structured' ? (
              <div className="space-y-2.5">
                {/* CÉDULA Y NOMBRE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                      <span>🪪 Cédula de Identidad (C.I. / RUC):</span>
                      {ciInput && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(ciInput);
                            showToast('✓ Cédula copiada');
                          }}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copiar</span>
                        </button>
                      )}
                    </label>
                    <input
                      type="text"
                      value={ciInput}
                      onChange={(e) => setCiInput(e.target.value)}
                      placeholder="Ej. 1712345678"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      👤 Nombres Completos (Destinatario):
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Nombre de quien recibe"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* PROVINCIA, CANTÓN, PARROQUIA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      🏛️ Provincia:
                    </label>
                    <input
                      type="text"
                      value={provinceInput}
                      onChange={(e) => setProvinceInput(e.target.value)}
                      placeholder="Ej. Pichincha"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      🏙️ Cantón / Ciudad:
                    </label>
                    <input
                      type="text"
                      value={cantonInput}
                      onChange={(e) => setCantonInput(e.target.value)}
                      placeholder="Ej. Quito"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      📍 Parroquia:
                    </label>
                    <input
                      type="text"
                      value={parishInput}
                      onChange={(e) => setParishInput(e.target.value)}
                      placeholder="Ej. Iñaquito / Cumbayá"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* DIRECCIÓN EXACTA */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    🏠 Dirección exacta, calles y referencia:
                  </label>
                  <textarea
                    rows={2}
                    value={exactAddressInput}
                    onChange={(e) => setExactAddressInput(e.target.value)}
                    placeholder="Ej. Av. Amazonas N34-120 y Naciones Unidas, Edificio Platinum Of. 402"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Dirección completa (pegar o escribir texto completo):
                </label>
                <textarea
                  rows={3}
                  value={directAddressInput}
                  onChange={(e) => setDirectAddressInput(e.target.value)}
                  placeholder="Ej. Juan Pérez - CI: 1712345678 - Quito, Av. Amazonas y Naciones Unidas..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}

            {/* Action Buttons for Section 2 (Formulario Destino & Destinatario) */}
            <div className="pt-2 flex items-center justify-between gap-2 flex-wrap border-t border-slate-200">
              <div className="flex items-center gap-2">
                {onPrintShippingTicket && (
                  <button
                    type="button"
                    onClick={() => {
                      // Pass current populated recipient and destination data to print label
                      const tempOrder: CustomerOrder = {
                        ...order,
                        customerName: nameInput.trim() || order.customerName,
                        customerCi: ciInput.trim() || (order as any).customerCi,
                        customerAddress: buildFinalAddress(),
                        trackingCarrier: carrierInput.trim() || order.trackingCarrier,
                        trackingNumber: trackingNumberInput.trim() || order.trackingNumber,
                      };
                      onPrintShippingTicket(tempOrder);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="Imprimir etiqueta con los datos de destino y destinatario ingresados"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-100" />
                    <span>Imprimir Etiqueta</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSave(false, false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                  title="Guardar cédula, destinatario y dirección de entrega"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Datos de Destino'}</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Etiqueta de despacho lista para rotular el paquete
              </span>
            </div>
          </div>

          {/* 3.- EMPRESA DE TRANSPORTE & N° DE GUÍA (TRACKING) */}
          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-300 shadow-2xs space-y-3">
            <div className="flex items-center space-x-2 text-blue-950 font-black text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                3
              </span>
              <span>3.- Empresa de Transporte & N° de Guía (Tracking)</span>
            </div>

            {/* Courier quick select chips */}
            <div className="space-y-1.5">
              <label className="block text-slate-800 font-bold text-xs">
                Empresa de Transporte / Courier: <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {activeCouriers.map((c) => (
                  <button
                    key={c.id || c.name}
                    type="button"
                    onClick={() => {
                      setCarrierInput(c.name);
                      if (error) setError(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      carrierInput.toLowerCase() === c.name.toLowerCase()
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name} className="w-4 h-4 object-contain rounded bg-white p-0.5" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span>{c.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCarrierInput('');
                    if (error) setError(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                    !activeCouriers.some((c) => c.name.toLowerCase() === carrierInput.toLowerCase()) && carrierInput === ''
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-800'
                  }`}
                >
                  Otro / Manual
                </button>
              </div>

              <input
                type="text"
                value={carrierInput}
                onChange={(e) => {
                  setCarrierInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nombre del courier o transporte (ej. Servientrega, Tramaco, Urbano, Cooperativa)..."
                className="w-full mt-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />

              {/* OPINIÓN/OPCIÓN PARA ABRIR EL LINK DE COTIZACIÓN O PORTAL EN VENTANA NUEVA */}
              {matchedCourier?.quoteUrl?.trim() ? (
                <div className="mt-2 p-2 rounded-xl bg-blue-100/70 border border-blue-200 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-blue-950 block truncate">
                        Portal / Cotizador de {matchedCourier.name}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenQuoteUrl(matchedCourier.quoteUrl)}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer flex-shrink-0"
                    title={`Abrir portal de ${matchedCourier.name} en una ventana nueva`}
                  >
                    <span>Abrir Portal Web</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ) : activeCouriersWithQuote.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-bold">Portales disponibles:</span>
                  {activeCouriersWithQuote.map((c) => (
                    <button
                      key={c.id || c.name}
                      type="button"
                      onClick={() => handleOpenQuoteUrl(c.quoteUrl)}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      title={`Abrir portal de ${c.name} en una ventana nueva`}
                    >
                      <span>{c.name}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-blue-600" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Tracking number input */}
            <div className="space-y-1.5">
              <label className="block text-slate-800 font-bold text-xs flex items-center justify-between">
                <span>N° de Guía / Código de Tracking:</span>
                <span className="text-[10px] text-blue-700 font-normal">Requerido para marcar como Enviado</span>
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={trackingNumberInput}
                  onChange={(e) => {
                    setTrackingNumberInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ej. 1294810294 o ENV-8921"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-blue-900 font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tracking notes */}
            <div className="space-y-1.5">
              <label className="block text-slate-800 font-bold text-xs">
                Observaciones o Enlace Web de Seguimiento (Opcional):
              </label>
              <textarea
                rows={2}
                value={trackingNotesInput}
                onChange={(e) => setTrackingNotesInput(e.target.value)}
                placeholder="Ej. Entrega estimada 24 horas. Retiro en agencia o entrega a domicilio."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Main Shipping Actions */}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(false, false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Datos'}</span>
              </button>

              <button
                type="button"
                disabled={isSaving || !carrierInput.trim() || !trackingNumberInput.trim()}
                onClick={() => handleSave(true, false)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Marcar como Enviado</span>
              </button>

              <button
                type="button"
                disabled={isSaving || !carrierInput.trim() || !trackingNumberInput.trim()}
                onClick={() => handleSave(true, true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs ml-auto"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                <span>Guardar y Notificar por WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer: Quick Admin Actions (Modificar Pedido, Eliminar Pedido, Cerrar) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center space-x-2">
            {onOpenEditOrder && (
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  onOpenEditOrder(order);
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="Aumentar productos, editar cantidades o cambiar items"
              >
                <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                <span>Modificar Pedido</span>
              </button>
            )}

            {onOpenDeleteOrder && (
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  onOpenDeleteOrder(order);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="Eliminar este pedido permanentemente"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Eliminar Pedido</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
