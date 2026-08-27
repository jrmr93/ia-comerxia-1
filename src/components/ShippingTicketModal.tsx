import React, { useRef } from 'react';
import {
  Printer,
  X,
  User,
  Phone,
  Calendar,
  Store,
  ExternalLink,
  Package,
} from 'lucide-react';
import { CustomerOrder, StoreConfig } from '../types.ts';
import { normalizeEcuadorPhone } from '../utils/phone.ts';
import { getCustomerCi } from '../utils/orderUtils.ts';

interface ShippingTicketModalProps {
  order: CustomerOrder | null;
  storeConfig: StoreConfig;
  currency?: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const ShippingTicketModal: React.FC<ShippingTicketModalProps> = ({
  order,
  storeConfig,
  currency = '$',
  onClose,
  showToast,
}) => {
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const phoneNorm = normalizeEcuadorPhone(order.customerPhone);
  const formattedPhone = phoneNorm.formattedLocal || order.customerPhone || 'No registrado';
  const storeName = storeConfig.storeName || 'Comerxia Store';
  const logoUrl = storeConfig.logoUrl;
  const storePhone = storeConfig.whatsappNumber || '';
  const storeAddress = storeConfig.address || '';

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) : new Date().toLocaleString('es-EC');

  // Parser to extract CI and structured delivery address sections
  const recipientData = (() => {
    const rawAddress: string = order.customerAddress || '';
    const ci: string = getCustomerCi(order);

    let province = '';
    let canton = '';
    let parish = '';
    let exactAddress = '';

    const provMatch = rawAddress.match(/(?:Provincia|Prov\.?)[\s:]*([^\n|]+)/i);
    if (provMatch) province = provMatch[1].trim();

    const canMatch = rawAddress.match(/(?:Cant[oó]n|Ciudad|Cant\.?)[\s:]*([^\n|]+)/i);
    if (canMatch) canton = canMatch[1].trim();

    const parMatch = rawAddress.match(/(?:Parroquia|Parr\.?)[\s:]*([^\n|]+)/i);
    if (parMatch) parish = parMatch[1].trim();

    const dirMatch = rawAddress.match(/(?:Direcci[oó]n|Direccion)[\s:]*([\s\S]+)/i);
    if (dirMatch) {
      exactAddress = dirMatch[1].trim();
    }

    const fields: { title: string; value: string }[] = [];

    if (province) {
      fields.push({ title: 'Provincia:', value: province });
    }
    if (canton) {
      fields.push({ title: 'Cantón:', value: canton });
    }
    if (parish) {
      fields.push({ title: 'Parroquia:', value: parish });
    }
    if (exactAddress) {
      fields.push({ title: 'Dirección:', value: exactAddress });
    }

    // If no structured markers matched, display the clean address text
    if (fields.length === 0 && rawAddress.trim()) {
      let cleanRaw = rawAddress.trim();
      if (ci) {
        cleanRaw = cleanRaw
          .replace(new RegExp(`(?:C\\.?I\\.?|C[eé]dula)[\\s:]*${ci}`, 'i'), '')
          .replace(/^[|\s,;-]+|[|\s,;-]+$/g, '')
          .trim();
      }
      if (cleanRaw) {
        fields.push({ title: 'Dirección:', value: cleanRaw });
      }
    }

    return {
      ci,
      fields: fields.length > 0 ? fields : [{ title: 'Dirección:', value: 'No especificada' }],
    };
  })();

  const generateTicketHtml = () => {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Etiqueta_Envio_${order.orderNumber}</title>
        <style>
          @page {
            size: 70mm 120mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 70mm;
            height: 120mm;
            max-width: 70mm;
            max-height: 120mm;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            font-size: 9px;
            line-height: 1.2;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: hidden;
          }
          .ticket-container {
            width: 70mm;
            height: 120mm;
            max-width: 70mm;
            max-height: 120mm;
            margin: 0 auto;
            border: 1.5px solid #0f172a;
            border-radius: 4px;
            padding: 2.5mm 3mm;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .store-header {
            text-align: center;
            border-bottom: 1px dashed #cbd5e1;
            padding-bottom: 2px;
            margin-bottom: 2px;
          }
          .store-logo {
            max-height: 22px;
            max-width: 48mm;
            object-fit: contain;
            margin: 0 auto 1px auto;
            display: block;
          }
          .store-icon-fallback {
            display: inline-block;
            background: #0f172a;
            color: #ffffff;
            border-radius: 4px;
            padding: 2px 5px;
            font-size: 8px;
            font-weight: 800;
            margin-bottom: 1px;
          }
          .store-title {
            font-size: 11px;
            font-weight: 900;
            color: #020617;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1.1;
          }
          .store-subtitle {
            font-size: 7.5px;
            color: #64748b;
            margin-top: 0.5px;
            line-height: 1.1;
          }
          .ticket-badge {
            display: block;
            background: #0f172a;
            color: #ffffff;
            font-weight: 900;
            font-size: 9px;
            text-align: center;
            padding: 2px 4px;
            border-radius: 2px;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin: 2px 0;
          }
          .card-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            padding: 3px 4px;
            margin-bottom: 2px;
          }
          .order-meta-grid {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .order-number {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 900;
            color: #0369a1;
          }
          .section-title {
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
            color: #1e293b;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 1px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .field-label {
            font-size: 7.5px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            line-height: 1;
            margin-bottom: 1px;
          }
          .field-value {
            font-size: 10px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.15;
          }
          .address-box {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 3px;
            padding: 3px 4px;
            margin-top: 1.5px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1px 0;
            font-size: 8.5px;
            color: #1e293b;
          }
          .item-row:not(:last-child) {
            border-bottom: 1px dashed #f1f5f9;
          }
          .footer-note {
            font-size: 7.5px;
            color: #64748b;
            border-top: 1px dashed #cbd5e1;
            padding-top: 1.5px;
            margin-top: 1.5px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="ticket-container">
          <!-- 1. Header Tienda -->
          <div class="store-header">
            ${logoUrl ? `
              <img src="${logoUrl}" alt="${storeName}" class="store-logo" />
            ` : `
              <div class="store-icon-fallback">🏪 TIENDA</div>
            `}
            <div class="store-title">${storeName}</div>
            ${storeAddress ? `<div class="store-subtitle">${storeAddress}</div>` : ''}
            ${storePhone ? `<div class="store-subtitle">WhatsApp / Tel: ${storePhone}</div>` : ''}
          </div>

          <!-- 2. Badge Etiqueta -->
          <div class="ticket-badge">ETIQUETA DE ENVÍO</div>

          <!-- 3. N° Pedido y Fecha -->
          <div class="card-box order-meta-grid">
            <div>
              <div class="field-label">N° Pedido:</div>
              <div class="order-number">#${order.orderNumber}</div>
            </div>
            <div style="text-align: right;">
              <div class="field-label">Fecha:</div>
              <div style="font-size: 8.5px; font-weight: 700; color: #334155;">${orderDate}</div>
            </div>
          </div>

          <!-- 4. Datos del Destinatario (Cliente) -->
          <div class="card-box" style="margin-bottom: 2px;">
            <div class="section-title">
              <span>👤 Datos del Destinatario (Cliente)</span>
            </div>
            
            <!-- CI antes del nombre -->
            <div style="margin-bottom: 2.5px;">
              <div class="field-label">CI (Cédula de Identidad):</div>
              <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9.5px; font-weight: 900; color: #0284c7; line-height: 1.1;">
                ${recipientData.ci || '<span style="color: #94a3b8; font-weight: normal; font-style: italic;">No registrada</span>'}
              </div>
            </div>

            <!-- Nombre -->
            <div style="margin-bottom: 2.5px;">
              <div class="field-label">Nombre del Cliente:</div>
              <div class="field-value">${order.customerName || 'Cliente no especificado'}</div>
            </div>

            <!-- Teléfono -->
            <div style="margin-bottom: 2.5px;">
              <div class="field-label">Teléfono / Celular:</div>
              <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9.5px; font-weight: 900; color: #047857; line-height: 1.1;">
                ${formattedPhone}
              </div>
            </div>

            <!-- Dirección de Entrega con títulos seguidos de dos puntos y salto de línea -->
            <div>
              <div class="field-label">📍 Dirección de Entrega:</div>
              <div class="address-box">
                ${recipientData.fields.map((f, i) => `
                  <div style="${i > 0 ? 'margin-top: 2.5px;' : ''}">
                    <div style="font-size: 7.5px; font-weight: 900; color: #475569; text-transform: uppercase; line-height: 1;">
                      ${f.title}
                    </div>
                    <div style="font-size: 9px; font-weight: 800; color: #0f172a; white-space: pre-wrap; line-height: 1.2;">
                      ${f.value}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- 5. Resumen de Paquete -->
          ${Array.isArray(order.items) && order.items.length > 0 ? `
            <div class="card-box" style="margin-bottom: 2px;">
              <div class="section-title">
                <span>📦 Contenido (${order.items.length} ítems)</span>
                <span style="color: #047857; font-weight: 900; font-size: 8px;">
                  Total: $${Number(order.totalAmount || 0).toFixed(2)} ${currency}
                </span>
              </div>
              <div style="margin-top: 1.5px;">
                ${order.items.slice(0, 3).map((it: any) => `
                  <div class="item-row">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 3px; max-width: 46mm;">
                      <strong style="font-family: ui-monospace, SFMono-Regular, monospace; color: #0284c7; font-weight: 800;">${it.quantity || 1}x</strong> ${it.name || it.item?.name || 'Producto'}
                    </span>
                    <span style="font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 800; color: #475569; flex-shrink: 0; font-size: 8px;">
                      $${(Number(it.salePrice || it.item?.salePrice || 0) * (it.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                `).join('')}
                ${order.items.length > 3 ? `
                  <div style="text-align: center; font-size: 7.5px; color: #94a3b8; font-style: italic; margin-top: 1px;">
                    +${order.items.length - 3} productos adicionales
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- 6. Nota al pie -->
          <div class="footer-note">
            ${storeName} • Manipular paquete con cuidado
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Primary Print Action: Isolated iframe print (safely opens printer dialog inside iframe embeds)
  const handlePrint = () => {
    try {
      showToast('Abriendo ventana de impresión...');
      const htmlContent = generateTicketHtml();
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 3000);
        }, 350);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Iframe print error, falling back to popup:', err);
      handleOpenPrintPopup();
    }
  };

  // Dedicated Popup Window Print Handler (100% reliable across browsers and iframe embeds)
  const handleOpenPrintPopup = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=750,toolbar=0,menubar=0,location=0');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = generateTicketHtml();
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  // Quick Copy Shipping Text format
  const handleCopyShippingText = () => {
    let text = `📦 *ETIQUETA DE ENVÍO - ${storeName.toUpperCase()}*\n\n`;
    text += `🏷️ *N° de Pedido:* #${order.orderNumber}\n`;
    if (recipientData.ci) {
      text += `🪪 *CI (Cédula):* ${recipientData.ci}\n`;
    }
    text += `👤 *Destinatario:* ${order.customerName}\n`;
    text += `📞 *Teléfono:* ${formattedPhone}\n\n`;
    text += `📍 *DIRECCIÓN DE ENTREGA:*\n`;
    recipientData.fields.forEach((f) => {
      text += `${f.title}\n${f.value}\n\n`;
    });
    text += `💰 *Total:* $${Number(order.totalAmount || 0).toFixed(2)} ${currency}\n`;
    if (Array.isArray(order.items) && order.items.length > 0) {
      text += `\n*Contenido del paquete:*\n`;
      order.items.forEach((it: any) => {
        text += `• ${it.quantity || 1}x ${it.name || it.item?.name || 'Producto'}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    showToast('✓ Datos de envío copiados al portapapeles');
  };

  return (
    <div
      id="shipping-ticket-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="shipping-ticket-modal-card"
        className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto animate-scaleUp max-h-[95vh] flex flex-col"
      >
        {/* Modal Header (Hidden on Print) */}
        <div
          id="shipping-ticket-modal-header"
          className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0 no-print"
        >
          <div className="flex items-center space-x-3 text-sky-700">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center shadow-2xs">
              <Printer className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Etiqueta de Envío</h3>
                <span className="font-mono font-black text-sky-700 text-xs px-2 py-0.5 bg-sky-50 rounded-md border border-sky-200">
                  #{order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">Rotulado de paquete para despacho</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body: Printable Ticket Preview */}
        <div className="overflow-y-auto pr-1 flex-1 py-2 flex flex-col items-center bg-slate-100/70 rounded-xl p-3 border border-slate-200">
          <div className="flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-extrabold border border-sky-200">
            <span>🏷️ Medida estándar de etiqueta: 7 cm × 12 cm</span>
          </div>

          <div
            id="shipping-ticket-printable-root"
            ref={ticketRef}
            style={{ width: '100%', maxWidth: '320px', minHeight: '440px' }}
            className="bg-white border-2 border-slate-900 rounded-md p-3 shadow-md text-slate-900 flex flex-col justify-between relative space-y-2"
          >
            {/* Store Header with Logo & Name */}
            <div className="text-center border-b border-dashed border-slate-300 pb-1.5">
              {logoUrl ? (
                <div className="flex justify-center mb-1">
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="max-h-8 max-w-[140px] object-contain rounded-xs"
                  />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 text-white mb-1">
                  <Store className="w-4 h-4" />
                </div>
              )}
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-950 leading-tight">
                {storeName}
              </h4>
              {storeAddress && <p className="text-[9px] text-slate-500 font-medium leading-tight">{storeAddress}</p>}
              {storePhone && (
                <p className="text-[9px] text-slate-500 font-medium leading-tight">WhatsApp / Tel: {storePhone}</p>
              )}
            </div>

            {/* Badge: Exact title requested "ETIQUETA DE ENVÍO" */}
            <div className="bg-slate-900 text-white font-black text-[10px] text-center py-1 px-2 rounded-xs uppercase tracking-wider">
              ETIQUETA DE ENVÍO
            </div>

            {/* Order Number & Date Box */}
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">N° Pedido:</span>
                <span className="font-mono font-black text-sky-700 text-xs sm:text-sm">
                  #{order.orderNumber}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Fecha:</span>
                <span className="text-[10px] font-semibold text-slate-700 flex items-center gap-1 justify-end">
                  <Calendar className="w-2.5 h-2.5 text-slate-400" />
                  {orderDate}
                </span>
              </div>
            </div>

            {/* Customer Information Card (CI, Nombre, Teléfono, Dirección) */}
            <div className="p-2 rounded-md bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center gap-1 border-b border-slate-200 pb-0.5 text-slate-800">
                <User className="w-3 h-3 text-sky-600" />
                <span className="text-[9.5px] font-black uppercase tracking-wider">
                  Datos del Destinatario (Cliente)
                </span>
              </div>

              {/* 1. CI antes del nombre */}
              <div>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block leading-none">CI (Cédula de Identidad):</span>
                <p className="text-xs font-mono font-bold text-sky-800 leading-tight">
                  {recipientData.ci || <span className="text-slate-400 font-normal italic">No registrada</span>}
                </p>
              </div>

              {/* 2. Nombre del Cliente */}
              <div>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block leading-none">Nombre del Cliente:</span>
                <p className="text-xs font-bold text-slate-950 leading-tight">{order.customerName}</p>
              </div>

              {/* 3. Teléfono */}
              <div>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block leading-none">Teléfono / Celular:</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span className="font-mono font-bold text-emerald-800 text-xs">
                    {formattedPhone}
                  </span>
                </div>
              </div>

              {/* 4. Dirección de Entrega con títulos seguidos de dos puntos y salto de línea */}
              <div>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase block leading-none mb-0.5">
                  📍 Dirección de Entrega:
                </span>
                <div className="p-2 rounded bg-white border border-slate-300 text-slate-950 text-xs space-y-1.5">
                  {recipientData.fields.map((f, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <span className="block font-black text-slate-600 text-[9px] uppercase tracking-wide leading-none">
                        {f.title}
                      </span>
                      <p className="font-bold text-slate-950 whitespace-pre-wrap pl-0.5 leading-tight text-[11px]">
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items Summary */}
            {Array.isArray(order.items) && order.items.length > 0 && (
              <div className="p-2 rounded-md bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Package className="w-2.5 h-2.5 text-sky-600" />
                    Contenido ({order.items.length} ítems)
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 uppercase">
                    Total: ${Number(order.totalAmount || 0).toFixed(2)} {currency}
                  </span>
                </div>

                <div className="space-y-0.5 text-[10px]">
                  {order.items.slice(0, 3).map((it: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-0.5 text-slate-800">
                      <span className="truncate pr-1">
                        <strong className="font-mono text-sky-800">{it.quantity || 1}x</strong> {it.name || it.item?.name}
                      </span>
                      <span className="font-mono text-slate-600 text-[9px] flex-shrink-0">
                        ${(Number(it.salePrice || it.item?.salePrice || 0) * (it.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-[8.5px] text-slate-400 italic text-center">
                      +{order.items.length - 3} productos adicionales
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-dashed border-slate-300 text-center text-[8.5px] text-slate-500">
              {storeName} • Manipular paquete con cuidado
            </div>
          </div>
        </div>

        {/* Modal Actions Footer (Hidden on Print) */}
        <div
          id="shipping-ticket-modal-footer"
          className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 flex-shrink-0 no-print"
        >
          <button
            type="button"
            onClick={handleOpenPrintPopup}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
            title="Abrir etiqueta en una pestaña dedicada para imprimir"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-100" />
            <span>Pestaña de Impresión</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
