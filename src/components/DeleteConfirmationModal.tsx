import React from 'react';
import { AlertTriangle, Loader2, Package, Trash2, X } from 'lucide-react';
import { InventoryItem } from '../types.ts';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  item?: InventoryItem | null;
  bulkItems?: InventoryItem[];
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  item = null,
  bulkItems = [],
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  const isBulk = bulkItems.length > 0;
  const hasItem = Boolean(item);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-800">
        {/* Close icon */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start space-x-3.5 mb-4">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex-shrink-0 shadow-2xs">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {title ||
                (isBulk
                  ? `¿Eliminar ${bulkItems.length} productos seleccionados?`
                  : '¿Eliminar producto del inventario?')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {message ||
                `Esta acción eliminará ${isBulk ? 'todos los registros seleccionados' : 'el registro'} en la base de datos PostgreSQL de forma permanente.`}
            </p>
          </div>
        </div>

        {/* Preview */}
        {isBulk ? (
          <div className="my-4 max-h-48 overflow-y-auto space-y-2 pr-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Productos a eliminar ({bulkItems.length}):
            </div>
            {bulkItems.map((bi) => (
              <div
                key={bi.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-1 rounded border border-sky-200">
                    {bi.sku}
                  </span>
                  <span className="text-slate-800 font-medium truncate">{bi.name}</span>
                </div>
                <span className="text-slate-700 text-[11px] font-mono font-bold ml-2 flex-shrink-0">
                  ${bi.salePrice}
                </span>
              </div>
            ))}
          </div>
        ) : item ? (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-3 my-4">
            <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
              <div className="flex items-center space-x-2 mt-1">
                <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                  {item.sku}
                </span>
                <span className="text-[11px] text-slate-500">Stock: {item.stock}</span>
                <span className="text-[11px] font-bold font-mono text-emerald-700">${item.salePrice}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>
              {isDeleting
                ? 'Eliminando...'
                : confirmLabel || (isBulk ? `Eliminar (${bulkItems.length})` : 'Sí, Eliminar')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
