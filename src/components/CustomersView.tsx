import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  Building2,
  Mail,
  Calendar,
  ShoppingBag,
  DollarSign,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Customer } from '../types.ts';
import { CustomerModal } from './CustomerModal.tsx';
import { DeleteConfirmationModal } from './DeleteConfirmationModal.tsx';
import { normalizeEcuadorPhone, buildWhatsAppLink } from '../utils/phone.ts';

interface CustomersViewProps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  showToast: (message: string) => void;
  currency?: string;
  onOpenStoreOrders?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  authFetch,
  showToast,
  currency = '$',
  onOpenStoreOrders,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Fetch customers from API
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      } else {
        console.error('Error fetching customers:', res.statusText);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Sync customers from orders history
  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      const res = await authFetch('/api/customers/sync-orders', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`✓ Sincronización completa: ${data.syncedCount || 0} clientes registrados`);
        await fetchCustomers();
      } else {
        showToast('❌ Error al sincronizar clientes desde pedidos');
      }
    } catch (err: any) {
      showToast('❌ Error al sincronizar: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSyncing(false);
    }
  };

  // Save (Create or Update)
  const handleSaveCustomer = async (data: Partial<Customer>): Promise<boolean> => {
    try {
      let res;
      if (editingCustomer) {
        res = await authFetch(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        res = await authFetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      if (res.ok) {
        const saved = await res.json();
        const displayName = saved.fullName || saved.name || 'Cliente';
        if (saved.alreadyExisted) {
          showToast(`✓ Cliente con cédula ${saved.ci || ''} ya existía: datos actualizados sin duplicar`);
        } else {
          showToast(
            editingCustomer
              ? `✓ Cliente "${displayName}" modificado con éxito`
              : `✓ Cliente "${displayName}" registrado con éxito`
          );
        }
        fetchCustomers();
        return true;
      } else {
        const err = await res.json();
        showToast(`❌ Error: ${err.error || 'No se pudo guardar el cliente'}`);
        return false;
      }
    } catch (error: any) {
      showToast(`❌ Error: ${error.message || 'Error al guardar'}`);
      return false;
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!customerToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/customers/${customerToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const displayName = customerToDelete.fullName || customerToDelete.name || 'Cliente';
        showToast(`✓ Cliente "${displayName}" eliminado correctamente`);
        setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
        setCustomerToDelete(null);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`❌ Error al eliminar cliente: ${err.error || res.statusText}`);
      }
    } catch (error: any) {
      showToast('❌ Error al eliminar: ' + (error.message || 'Error'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Provinces list for filter
  const provincesList = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.province && c.province.trim()) {
        set.add(c.province.trim());
      }
    });
    return Array.from(set).sort();
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (selectedProvince !== 'all' && c.province !== selectedProvince) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (c.fullName || c.name || '').toLowerCase();
      const addr = (c.fullAddress || c.address || '').toLowerCase();
      return (
        name.includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.ci && c.ci.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.province && c.province.toLowerCase().includes(q)) ||
        (c.canton && c.canton.toLowerCase().includes(q)) ||
        (c.parish && c.parish.toLowerCase().includes(q)) ||
        addr.includes(q) ||
        (c.reference && c.reference.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery, selectedProvince]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = customers.length;
    const withCi = customers.filter((c) => c.ci && c.ci.trim().length > 0).length;
    const withAddress = customers.filter(
      (c) =>
        (c.fullAddress && c.fullAddress.trim().length > 0) ||
        (c.address && c.address.trim().length > 0) ||
        (c.province && c.province.trim().length > 0)
    ).length;
    const totalOrders = customers.reduce((acc, c) => acc + (Number(c.totalOrders) || 0), 0);
    const totalSpent = customers.reduce((acc, c) => acc + (Number(c.totalSpent) || 0), 0);

    return { total, withCi, withAddress, totalOrders, totalSpent };
  }, [customers]);

  const handleCopyCustomer = (c: Customer) => {
    const displayName = c.fullName || c.name || 'Cliente';
    const displayAddr = c.fullAddress || c.address;
    const lines = [
      `👤 Cliente: ${displayName}`,
      `📱 Teléfono: ${c.phone}`,
      c.ci ? `🪪 Cédula: ${c.ci}` : null,
      c.email ? `📧 Email: ${c.email}` : null,
      c.province ? `🏛️ Provincia: ${c.province}` : null,
      c.canton ? `🏙️ Cantón: ${c.canton}` : null,
      c.parish ? `📍 Parroquia: ${c.parish}` : null,
      displayAddr ? `🏠 Dirección: ${displayAddr}` : null,
      c.reference ? `📌 Referencia: ${c.reference}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(lines);
    setCopiedId(c.id);
    showToast('✓ Datos del cliente copiados');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenWhatsApp = (phone: string, name: string) => {
    const norm = normalizeEcuadorPhone(phone);
    if (!norm.whatsappDigits || !norm.isValid) {
      showToast('⚠️ Teléfono no válido para WhatsApp');
      return;
    }
    const msg = `¡Hola *${name || 'estimado/a'}*! 👋 Te saludamos de nuestra tienda. ¿En qué podemos ayudarte el día de hoy?`;
    const link = buildWhatsAppLink(norm.whatsappDigits, msg);
    window.open(link, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Gestión de Clientes
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Directorio centralizado con datos completos de envío, cédula y pedidos confirmados
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-sync-customers"
            onClick={handleSyncOrders}
            disabled={isSyncing}
            title="Sincronizar clientes desde pedidos confirmados que cuenten con cédula"
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Pedidos'}</span>
          </button>

          <button
            id="btn-add-customer"
            onClick={() => {
              setEditingCustomer(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 active:scale-98 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Clientes</div>
            <div className="text-lg font-extrabold text-slate-900 font-mono">{metrics.total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Pedidos</div>
            <div className="text-lg font-extrabold text-amber-700 font-mono">{metrics.totalOrders}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono, CI, ciudad..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-medium"
          />
        </div>

        {/* Province dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition cursor-pointer"
          >
            <option value="all">Todas las Provincias ({customers.length})</option>
            {provincesList.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customers List Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Cargando directorio de clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados aún'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            {searchQuery
              ? 'Intenta con otro término de búsqueda o limpia el filtro'
              : 'Los clientes se guardan automáticamente al confirmar pedidos, o puedes registrarlos o sincronizarlos manualmente.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Limpiar Búsqueda
              </button>
            )}
            <button
              onClick={handleSyncOrders}
              className="px-4 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition cursor-pointer"
            >
              Sincronizar desde Pedidos
            </button>
            <button
              onClick={() => {
                setEditingCustomer(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition cursor-pointer"
            >
              Registrar Primer Cliente
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Ubicación / Envío</th>
                  <th className="py-3 px-4">Dirección Exacta</th>
                  <th className="py-3 px-4 text-center">Pedidos</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCustomers.map((c) => {
                  const phoneNorm = normalizeEcuadorPhone(c.phone);
                  const displayName = c.fullName || c.name || 'Cliente';
                  const displayAddress = c.fullAddress || c.address || '';
                  const initials = (displayName || 'CL')
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      {/* Cliente Name & CI */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/10 to-indigo-500/10 text-sky-700 font-extrabold flex items-center justify-center text-xs border border-sky-200/60 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-sky-700 transition">
                              {displayName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {c.ci ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-mono font-semibold border border-indigo-200/60">
                                  <ShieldCheck className="w-2.5 h-2.5" />
                                  CI: {c.ci}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Sin CI</span>
                              )}
                              {c.email && (
                                <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={c.email}>
                                  • {c.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & WhatsApp */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-800">
                              {phoneNorm.formattedLocal || phoneNorm.local || c.phone}
                            </span>
                            <button
                              onClick={() => handleCopyCustomer(c)}
                              title="Copiar datos completos"
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                            >
                              {copiedId === c.id ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <button
                            onClick={() => handleOpenWhatsApp(c.phone, displayName)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition cursor-pointer"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </td>

                      {/* Location (Provincia / Cantón / Parroquia) */}
                      <td className="py-3.5 px-4">
                        {c.province || c.canton ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>
                                {c.province || 'Ecuador'}
                                {c.canton ? ` - ${c.canton}` : ''}
                              </span>
                            </div>
                            {c.parish && (
                              <div className="text-[11px] text-slate-500 pl-4">
                                Parr. {c.parish}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No especificada</span>
                        )}
                      </td>

                      {/* Exact Address & Reference */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {displayAddress ? (
                          <div className="space-y-0.5">
                            <p className="text-slate-800 text-xs font-medium line-clamp-2" title={displayAddress}>
                              {displayAddress}
                            </p>
                            {c.reference && (
                              <p className="text-[10px] text-slate-500 italic line-clamp-1" title={c.reference}>
                                Ref: {c.reference}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Sin dirección exacta</span>
                        )}
                      </td>

                      {/* Orders & Total Spent */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                            {c.totalOrders || 0} {c.totalOrders === 1 ? 'pedido' : 'pedidos'}
                          </span>
                          {Number(c.totalSpent) > 0 && (
                            <span className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                              ${Number(c.totalSpent).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            id={`btn-edit-customer-${c.id}`}
                            onClick={() => {
                              setEditingCustomer(c);
                              setIsModalOpen(true);
                            }}
                            title="Modificar datos del cliente"
                            className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-customer-${c.id}`}
                            onClick={() => setCustomerToDelete(c)}
                            title="Eliminar cliente"
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Modal (Create / Edit) */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
        existingCustomers={customers}
      />

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <DeleteConfirmationModal
          isOpen={Boolean(customerToDelete)}
          title="¿Eliminar cliente?"
          message={`¿Estás seguro de que deseas eliminar permanentemente a "${customerToDelete.fullName || customerToDelete.name || 'este cliente'}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar Cliente"
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) setCustomerToDelete(null);
          }}
          onConfirm={handleDeleteCustomer}
        />
      )}
    </div>
  );
};
