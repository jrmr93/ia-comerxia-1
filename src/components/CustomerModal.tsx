import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, FileText, Mail, Save, AlertCircle, Building2, Check } from 'lucide-react';
import { Customer } from '../types.ts';
import { normalizeEcuadorPhone } from '../utils/phone.ts';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: Partial<Customer>) => Promise<boolean>;
  customer?: Customer | null;
  existingCustomers?: Customer[];
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customer,
  existingCustomers = [],
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [ci, setCi] = useState('');
  const [email, setEmail] = useState('');
  const [province, setProvince] = useState('');
  const [canton, setCanton] = useState('');
  const [parish, setParish] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setFullName(customer.fullName || customer.name || '');
      setPhone(customer.phone || '');
      setCi(customer.ci || '');
      setEmail(customer.email || '');
      setProvince(customer.province || '');
      setCanton(customer.canton || '');
      setParish(customer.parish || '');
      setFullAddress(customer.fullAddress || customer.address || '');
      setReference(customer.reference || '');
      setNotes(customer.notes || '');
    } else {
      setFullName('');
      setPhone('');
      setCi('');
      setEmail('');
      setProvince('');
      setCanton('');
      setParish('');
      setFullAddress('');
      setReference('');
      setNotes('');
    }
    setError(null);
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const cleanInputCi = ci.trim().toLowerCase();
  const existingMatch = !customer && cleanInputCi.length >= 5
    ? existingCustomers.find(
        (c) => c.ci && c.ci.trim().toLowerCase() === cleanInputCi
      )
    : null;

  const handleCiChange = (newCi: string) => {
    setCi(newCi);
    const clean = newCi.trim().toLowerCase();
    const cleanDigits = clean.replace(/\D/g, '');
    if (!customer && (clean.length >= 8 || cleanDigits.length >= 8)) {
      const match = existingCustomers.find((c) => {
        const cCi = (c.ci || '').trim().toLowerCase();
        const cDigits = cCi.replace(/\D/g, '');
        return cCi === clean || (cleanDigits.length >= 8 && cDigits === cleanDigits);
      });
      if (match) {
        handleAutofillFromExisting(match);
      }
    }
  };

  const handleAutofillFromExisting = (ex: Customer) => {
    if (ex.fullName || ex.name) setFullName(ex.fullName || ex.name || '');
    if (ex.phone) setPhone(ex.phone);
    if (ex.email) setEmail(ex.email);
    if (ex.province) setProvince(ex.province);
    if (ex.canton) setCanton(ex.canton);
    if (ex.parish) setParish(ex.parish);
    if (ex.fullAddress || ex.address) setFullAddress(ex.fullAddress || ex.address || '');
    if (ex.reference) setReference(ex.reference);
    if (ex.notes) setNotes(ex.notes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('El nombre completo es obligatorio');
      return;
    }
    if (!phone.trim()) {
      setError('El número de teléfono/WhatsApp es obligatorio');
      return;
    }
    if (!ci.trim()) {
      setError('El número de cédula o RUC es obligatorio para registrar al cliente');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: Partial<Customer> = {
        name: fullName.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        ci: ci.trim(),
        email: email.trim() || undefined,
        province: province.trim() || undefined,
        canton: canton.trim() || undefined,
        parish: parish.trim() || undefined,
        address: fullAddress.trim() || undefined,
        fullAddress: fullAddress.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const success = await onSave(payload);
      if (success) {
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {customer ? 'Modificar Datos de Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <p className="text-xs text-slate-500">
                {customer ? `Editando cliente #${customer.id}` : 'Ingresa los datos completos de envío y contacto'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Personal Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-sky-600" />
              Información de Contacto
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cédula de Identidad (CI / RUC) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={ci}
                  onChange={(e) => handleCiChange(e.target.value)}
                  placeholder="Ej. 1712345678 (Obligatorio)"
                  className={`w-full px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 transition font-medium ${
                    existingMatch
                      ? 'bg-amber-50/50 border border-amber-300 focus:bg-white focus:ring-amber-500/20 focus:border-amber-500'
                      : 'bg-slate-50 border border-slate-200 focus:bg-white focus:ring-sky-500/20 focus:border-sky-500'
                  }`}
                />
                {existingMatch && (
                  <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="leading-snug">
                      <span className="font-bold text-amber-800">⚠️ Cliente ya registrado con esta cédula:</span>{' '}
                      <span className="font-semibold text-slate-900">{existingMatch.fullName || existingMatch.name}</span>{' '}
                      <span className="text-slate-600">({existingMatch.phone})</span>. Datos cargados automáticamente.
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutofillFromExisting(existingMatch)}
                      className="shrink-0 text-[10px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      Recargar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teléfono / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 0991234567"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Juan Carlos Pérez"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej. cliente@email.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-medium"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Ubicación y Dirección de Envío
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provincia
                </label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Ej. Pichincha"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cantón / Ciudad
                </label>
                <input
                  type="text"
                  value={canton}
                  onChange={(e) => setCanton(e.target.value)}
                  placeholder="Ej. Quito"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parroquia
                </label>
                <input
                  type="text"
                  value={parish}
                  onChange={(e) => setParish(e.target.value)}
                  placeholder="Ej. Cumbayá"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Exacta (Calles, N° de casa, Sector)
              </label>
              <input
                type="text"
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                placeholder="Ej. Av. 6 de Diciembre N34-120 y Gaspar de Villarroel, Edif. Torre Azul"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Referencia de Entrega / Agencia de Preferencia
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej. Frente a la farmacia Fybeca / Retiro en Agencia Servientrega"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              Notas adicionales del cliente
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferencias de entrega, observaciones, cliente frecuente..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-medium resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer"
            >
              {isSaving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{customer ? 'Guardar Cambios' : 'Registrar Cliente'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
