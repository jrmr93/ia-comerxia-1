import React from 'react';
import {
  Package,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Tag,
  Scale,
  Bot,
  AlertTriangle,
  BadgeDollarSign,
} from 'lucide-react';
import { InventoryStats } from '../types.ts';

interface StatsBannerProps {
  stats: InventoryStats | null;
  currency?: string;
  totalMessagesCount?: number;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  stats,
  currency = 'USD',
  totalMessagesCount = 0,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const totalCost = stats?.totalCostValue || 0;
  const regularProfit = stats?.estimatedProfit || 0;
  const totalDiscount = stats?.totalDiscountValue || 0;
  const discountedCount = stats?.discountedProductsCount || 0;
  const totalExpectedWithDiscounts =
    stats?.totalDiscountedSaleValue !== undefined
      ? stats.totalDiscountedSaleValue
      : (stats?.totalSaleValue || 0) - totalDiscount;
  const profitWithDiscounts =
    stats?.profitWithDiscounts !== undefined ? stats.profitWithDiscounts : regularProfit - totalDiscount;

  const regularMarginPercent =
    totalCost > 0 ? Math.round((regularProfit / totalCost) * 100) : 0;
  const realMarginPercent =
    totalCost > 0 ? Math.round((profitWithDiscounts / totalCost) * 100) : 0;
  const isLoss = profitWithDiscounts < -0.001;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3.5 sm:gap-4 my-6">
      {/* 1. Total Artículos */}
      <div className="bg-white border border-slate-300 hover:border-sky-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Total Artículos</span>
          <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-slate-900 tracking-tight">{stats?.totalProducts || 0}</div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">{stats?.totalUnits || 0} unidades en stock</p>
        </div>
      </div>

      {/* 2. Inversión Costo */}
      <div className="bg-white border border-slate-300 hover:border-amber-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Inversión Costo</span>
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(totalCost)}
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Costo total inventario</p>
        </div>
      </div>

      {/* 3. Valor Esperado (PVP Catálogo) */}
      <div className="bg-white border border-slate-300 hover:border-indigo-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Valor Esperado</span>
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-indigo-700 tracking-tight">
            {formatCurrency(stats?.totalSaleValue || 0)}
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Precio regular (PVP)</p>
        </div>
      </div>

      {/* 4. Valor Esperado menos Descuentos */}
      <div className="bg-white border border-slate-300 hover:border-cyan-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Valor Esperado - Descuentos</span>
          <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-xs">
            <BadgeDollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-cyan-800 tracking-tight">
            {formatCurrency(totalExpectedWithDiscounts)}
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            {totalDiscount > 0 ? (
              <span className="text-cyan-700 font-semibold">PVP neto con promociones</span>
            ) : (
              'Sin descuentos activos'
            )}
          </p>
        </div>
      </div>

      {/* 5. Ganancia Estimada (Regular sin descuentos) */}
      <div className="bg-white border border-slate-300 hover:border-emerald-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Ganancia Estimada</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            +{formatCurrency(regularProfit)}
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            {totalCost > 0 ? `${regularMarginPercent}% margen regular` : 'PVP catálogo'}
          </p>
        </div>
      </div>

      {/* 6. Total en Descuentos */}
      <div className="bg-white border border-slate-300 hover:border-rose-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Total en Descuentos</span>
          <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
            <Tag className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`text-2xl font-black tracking-tight ${
              totalDiscount > 0 ? 'text-rose-600' : 'text-slate-800'
            }`}
          >
            {totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : formatCurrency(0)}
          </div>
          <p className="text-xs font-semibold mt-0.5 text-slate-500">
            {discountedCount > 0 ? (
              <span className="text-rose-700 font-bold">{discountedCount} producto(s) en oferta</span>
            ) : (
              'Sin descuentos activos'
            )}
          </p>
        </div>
      </div>

      {/* 7. Ganancia Total con Descuentos */}
      <div className="bg-white border border-slate-300 hover:border-teal-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group">
        <div className={`absolute top-0 left-0 right-0 h-1 ${isLoss ? 'bg-rose-600 animate-pulse' : 'bg-teal-500'}`} />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Ganancia con Descuentos</span>
          <div
            className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs ${
              isLoss ? 'bg-rose-600' : 'bg-teal-600'
            }`}
          >
            {isLoss ? <AlertTriangle className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`text-2xl font-black tracking-tight ${
              isLoss
                ? 'text-rose-600 font-mono animate-pulse'
                : profitWithDiscounts > 0
                ? 'text-teal-700 font-mono'
                : 'text-slate-800 font-mono'
            }`}
          >
            {profitWithDiscounts >= 0
              ? `+${formatCurrency(profitWithDiscounts)}`
              : `-${formatCurrency(Math.abs(profitWithDiscounts))}`}
          </div>
          <p className="text-xs font-semibold mt-0.5">
            {isLoss ? (
              <span className="text-rose-700 font-bold">⚠️ En pérdida ({realMarginPercent}%)</span>
            ) : totalDiscount > 0 ? (
              <span className="text-teal-700 font-bold">{realMarginPercent}% margen neto real</span>
            ) : (
              <span className="text-slate-500 font-medium">Igual a ganancia regular</span>
            )}
          </p>
        </div>
      </div>

      {/* 8. Mensajes Proveedor */}
      <div className="bg-white border border-slate-300 hover:border-purple-400 rounded-2xl p-4 shadow-sm hover:shadow-md col-span-2 sm:col-span-1 md:col-span-1 flex flex-col justify-between transition relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">Mensajes Proveedor</span>
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-black text-purple-800 tracking-tight">{totalMessagesCount}</div>
          <p className="text-xs text-emerald-700 font-bold mt-0.5 flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Gemini AI Activo
          </p>
        </div>
      </div>
    </div>
  );
};
