'use client'
import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Loader2, TrendingUp, ShoppingBag, Clock,
  Award, Wallet, CreditCard, Printer, Calendar
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─────────────────────────────────────────────
// FORMATTING HELPERS
// ─────────────────────────────────────────────
function fmt(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

function fmtFull(n) {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

// ─────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────
function BentoCard({ children, className = "", delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const bgColor = className.includes('bg-') ? '' : 'bg-white';

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border border-[#4A3B32]/10 p-6 transition-all duration-700 ease-out shadow-sm hover:shadow-md ${bgColor} ${className}`}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)' }}
    >
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label, prefix = '$' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#4A3B32] border border-[#4A3B32]/20 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-[10px] text-[#FAF7F2]/70 font-bold uppercase mb-1 tracking-widest">{label}</p>
      <p className="text-[#FAF7F2] font-black text-lg">{prefix}{Number(payload[0].value).toLocaleString('es-AR')}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const PRESET_FILTERS = [
  { key: 'today',     label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week',      label: '7 Días' },
  { key: 'month',     label: '30 Días' },
  { key: 'custom',    label: 'Custom' },
];

const PAYMENT_COLORS = ['#4A3B32', '#D4A373', '#e2e8f0', '#9ca3af'];

export default function DashboardMetrics() {
  const [loading, setLoading] = useState(true);
  
  // Rango de fechas
  const [dateFilter, setDateFilter] = useState('today');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [stats, setStats] = useState({
    kpi: { totalRevenue: 0, totalOrders: 0, avgTicket: 0, deliveryCount: 0, pickupCount: 0, cashTotal: 0, mpTotal: 0 },
    hourlySales: [],
    topProducts: [],
    recentOrders: [],
    paymentBreakdown: [],
    deliveryBreakdown: [],
  });

  // Listener principal de recarga
  useEffect(() => {
    // Si elegimos "custom", solo disparamos manualmente (o si cambian las fechas directamente)
    // Para UX simple, disparamos siempre al cambiar.
    fetchMetrics();
  }, [dateFilter, customStart, customEnd]);

  const getDateRange = () => {
    const start = new Date();
    const end = new Date();
    
    if (dateFilter === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'yesterday') {
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);     end.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'week') {
      start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'month') {
      start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'custom') {
      const s = new Date(customStart + "T00:00:00");
      const e = new Date(customEnd + "T23:59:59");
      return { start: s, end: e };
    }
    return { start, end };
  };

  const getLabelForPeriod = () => {
    if (dateFilter !== 'custom') {
      return PRESET_FILTERS.find(f => f.key === dateFilter)?.label.toUpperCase();
    }
    return `${customStart} a ${customEnd}`;
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      // Fallback manual order query para asegurarnos de que el Custom Range funcione exacto con la fecha de la base.
      const { data: rawOrders, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .neq('status', 'cancelled')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      processRawOrders(rawOrders || []);

    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const processRawOrders = (orders) => {
    let totalRevenue = 0, deliveryCount = 0, pickupCount = 0, cashTotal = 0, mpTotal = 0;
    const hourMap = {}, productMap = {};
    
    orders.forEach(order => {
      const amount = Number(order.total) || 0;
      totalRevenue += amount;
      if (order.delivery_method === 'delivery') deliveryCount++; else pickupCount++;
      if (order.payment_method?.toLowerCase() === 'mercadopago') mpTotal += amount; else cashTotal += amount;
      
      const hour = new Date(order.created_at).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + amount;
      
      order.order_items?.forEach(item => {
        const name = item.product_name || 'Desconocido';
        productMap[name] = (productMap[name] || 0) + (item.quantity || 1);
      });
    });
    
    const kpi = { 
      totalRevenue, 
      totalOrders: orders.length, 
      avgTicket: orders.length > 0 ? totalRevenue / orders.length : 0, 
      deliveryCount, 
      pickupCount, 
      cashTotal, 
      mpTotal 
    };
    
    // Rellenamos siempre 24 horas para no romper el chart
    const hourlySales = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, total: hourMap[i] || 0 }));
    const topProducts = Object.entries(productMap).map(([name, cantidad]) => ({ name, cantidad })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 6);
    const recentOrders = orders.slice(0, 15);
    
    setStats({
      kpi,
      hourlySales,
      topProducts,
      recentOrders,
      paymentBreakdown: [
        { name: 'Efectivo', value: kpi.cashTotal },
        { name: 'MercadoPago', value: kpi.mpTotal },
      ].filter(p => p.value > 0),
      deliveryBreakdown: [
        { name: 'Delivery', value: kpi.deliveryCount },
        { name: 'Retiro', value: kpi.pickupCount },
      ].filter(p => p.value > 0),
    });
  };

  const generatePDF = async () => {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default;

    const element = document.getElementById('pdf-report-container');
    const opt = {
      margin:       0,
      filename:     `Gustó_Analítica_${getLabelForPeriod().replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  const peakHour = stats.hourlySales.reduce((best, h) => h.total > best.total ? h : best, { hour: '-', total: 0 });
  const deliveryRate = stats.kpi.totalOrders > 0 ? Math.round((stats.kpi.deliveryCount / stats.kpi.totalOrders) * 100) : 0;
  const cashPct = stats.kpi.totalRevenue > 0 ? Math.round(stats.kpi.cashTotal / stats.kpi.totalRevenue * 100) : 0;
  const mpPct   = stats.kpi.totalRevenue > 0 ? Math.round(stats.kpi.mpTotal   / stats.kpi.totalRevenue * 100) : 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700;900&display=swap');

        .dash { font-family: 'Inter', sans-serif; }
        .df   { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.05em; }
        .dash-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .dash-scroll::-webkit-scrollbar-track { background: transparent; }
        .dash-scroll::-webkit-scrollbar-thumb { background: #4A3B32; border-radius: 6px; opacity: 0.2; }

        /* ── NATIVE PDF PRINT ENGINE ───────── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0; /* Controlamos márgenes manuales vía CSS */
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
            background: #ffffff !important;
            margin: 0; padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ocultar UI web en print */
          .dash { display: none !important; }

          /* Contenedor PDF */
          .pdf-print-root {
            display: block !important;
            width: 210mm;
            padding: 15mm;
            background: #ffffff !important;
            color: #4A3B32 !important;
            font-family: 'Inter', sans-serif;
            box-sizing: border-box;
          }

          /* Forzamos que CUALQUIER texto dentro del root impreso sea oscuro si no está definido en línea */
          .pdf-print-root *, .pdf-print-root p, .pdf-print-root span, .pdf-print-root div {
            color: inherit;
          }

          /* Control de rupturas de página para que las tablas no se corten solas */
          .pdf-keep-together { break-inside: avoid; page-break-inside: avoid; }
        }

        /* Ocultar en pantalla */
        @media screen {
          .pdf-print-root { display: none !important; }
        }
      `}} />

      <div className="dash space-y-6 pb-24 max-w-7xl mx-auto">

        {/* ── HEADER & CONTROLS ───────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 no-print bg-white p-6 rounded-[24px] border border-[#4A3B32]/10 shadow-sm">
          <div>
            <h1 className="df text-6xl text-[#4A3B32] leading-none tracking-tight">INTELIGENCIA</h1>
            <p className="text-sm font-bold text-[#D4A373] uppercase tracking-[0.2em] mt-1">Gustó • Business Analytics</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
            <div className="flex bg-[#FAF7F2] border border-[#4A3B32]/10 rounded-xl p-1 w-full sm:w-auto overflow-x-auto dash-scroll">
              {PRESET_FILTERS.map(f => (
                <button key={f.key} onClick={() => setDateFilter(f.key)}
                  className={`px-4 py-2 rounded-lg transition text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${dateFilter === f.key ? 'bg-[#4A3B32] text-[#FAF7F2] shadow-md' : 'text-[#4A3B32]/60 hover:text-[#4A3B32]'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-2 w-full sm:w-auto animate-in slide-in-from-top-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs font-bold text-[#4A3B32] outline-none" />
                <span className="text-[#4A3B32]/40 font-bold text-xs">hasta</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs font-bold text-[#4A3B32] outline-none" />
              </div>
            )}

            <button onClick={generatePDF} className="flex items-center justify-center gap-2 bg-[#4A3B32] text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition shadow-lg w-full sm:w-auto">
              <Printer size={16} /> Exportar Backup PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-[#4A3B32]" size={40} />
            <p className="text-[#4A3B32]/60 text-xs font-black uppercase tracking-widest animate-pulse">Analizando Datos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-min gap-4">
            
            {/* ── BENTO TOP LEVEL: BIG METRICS ──────────────── */}
            <BentoCard className="md:col-span-8 bg-[#4A3B32] text-[#FAF7F2]" delay={0}>
              <div className="flex flex-col h-full justify-between">
                <p className="text-xs font-black text-[#D4A373] uppercase tracking-[0.2em]">Recaudación Total Bruta</p>
                <div className="mt-8 mb-4">
                  <p className="df text-8xl md:text-9xl leading-[0.8]">{fmt(stats.kpi.totalRevenue)}</p>
                  <p className="text-lg font-bold text-[#FAF7F2]/90 mt-2">{fmtFull(stats.kpi.totalRevenue)} exactos en {stats.kpi.totalOrders} pagos</p>
                </div>
                <div className="flex items-center justify-between border-t border-[#FAF7F2]/10 pt-4 mt-auto">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#D4A373]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#FAF7F2]/90">{getLabelForPeriod()}</span>
                  </div>
                  <div className="bg-[#FAF7F2] text-[#4A3B32] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{fmt(stats.kpi.avgTicket)} AL TICKET</div>
                </div>
              </div>
            </BentoCard>

            <div className="md:col-span-4 grid grid-rows-2 gap-4">
              <BentoCard className="bg-[#D4A373] text-[#4A3B32] border-none" delay={100}>
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-full bg-[#4A3B32]/10 flex items-center justify-center"><Clock size={20} /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/30 px-2 py-1 rounded">Trend</span>
                </div>
                <div className="mt-6">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Ráfaga de Ventas / Hora Pico</p>
                  <p className="df text-6xl leading-none">{peakHour.hour}</p>
                  <p className="text-sm font-bold mt-1 opacity-90">{fmtFull(peakHour.total)} operados</p>
                </div>
              </BentoCard>
              
              <BentoCard delay={200}>
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-full bg-[#4A3B32]/5 flex items-center justify-center"><ShoppingBag size={20} className="text-[#4A3B32]" /></div>
                </div>
                <div className="mt-6">
                  <p className="text-[10px] font-black text-[#4A3B32]/50 uppercase tracking-widest mb-1">Volumen de Pedidos</p>
                  <div className="flex items-baseline gap-2">
                    <p className="df text-6xl text-[#4A3B32] leading-none">{stats.kpi.totalOrders}</p>
                    <p className="text-xs font-bold text-[#4A3B32]/50 uppercase tracking-widest">Tickets</p>
                  </div>
                </div>
              </BentoCard>
            </div>


            {/* ── BENTO MID LEVEL: CHARTS ──────────────── */}
            <BentoCard className="md:col-span-8 p-0 flex flex-col" delay={300}>
               <div className="p-6 pb-2 border-b border-[#4A3B32]/5 flex justify-between items-center z-10 bg-white">
                  <div>
                    <h3 className="df text-3xl text-[#4A3B32] leading-none">Flujo Operativo Acumulado</h3>
                    <p className="text-[10px] font-black text-[#4A3B32]/40 uppercase tracking-widest mt-1">Evolución de ingresos por hora del día</p>
                  </div>
               </div>
               <div className="h-64 mt-auto w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.hourlySales} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4A3B32" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#D4A373" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#D4A373', strokeWidth: 1, strokeDasharray: '3 3' }} />
                      <Area type="monotone" dataKey="total" stroke="#4A3B32" strokeWidth={3} fill="url(#goldGrad)" dot={false} activeDot={{ r: 6, fill: '#D4A373', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </BentoCard>

            <BentoCard className="md:col-span-4" delay={400}>
              <h3 className="df text-3xl text-[#4A3B32] leading-none mb-1">Tesorería</h3>
              <p className="text-[10px] font-black text-[#4A3B32]/40 uppercase tracking-widest mb-4">Eficacia de cobro</p>
              
              <div className="h-40 relative flex justify-center items-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.paymentBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {stats.paymentBreakdown.map((_, i) => <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <Wallet size={20} className="text-[#4A3B32]/70 mb-1" />
                 </div>
              </div>

              <div className="mt-4 space-y-3">
                 <div className="flex justify-between items-center text-sm font-bold">
                    <div className="flex items-center gap-2 text-[#4A3B32]"><div className="w-3 h-3 rounded bg-[#4A3B32]"></div> Efectivo</div>
                    <span>{cashPct}%</span>
                 </div>
                 <div className="flex justify-between items-center text-sm font-bold">
                    <div className="flex items-center gap-2 text-[#D4A373]"><div className="w-3 h-3 rounded bg-[#D4A373]"></div> MercadoPago</div>
                    <span>{mpPct}%</span>
                 </div>
              </div>
            </BentoCard>

            {/* ── BENTO BOTTOM LEVEL: LOGISTICS & RANKING ──────────────── */}
            <BentoCard className="md:col-span-4 bg-[#FAF7F2]" delay={500}>
              <h3 className="df text-3xl text-[#4A3B32] leading-none mb-1">Modalidad</h3>
              <p className="text-[10px] font-black text-[#4A3B32]/70 uppercase tracking-widest mb-6">Logística de Entrega</p>
              
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-sm text-[#4A3B32]">🛵 Delivery</span>
                    <span className="df text-2xl text-[#4A3B32]">{deliveryRate}%</span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden border border-[#4A3B32]/10 shadow-inner">
                    <div className="h-full bg-[#4A3B32] rounded-full" style={{ width: `${deliveryRate}%` }}></div>
                  </div>
                  <p className="text-right text-[10px] font-black text-[#4A3B32]/70 uppercase mt-1">{stats.kpi.deliveryCount} Operaciones</p>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-sm text-[#4A3B32]">🏃 Retiro</span>
                    <span className="df text-2xl text-[#4A3B32]">{100 - deliveryRate}%</span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden border border-[#4A3B32]/10 shadow-inner">
                    <div className="h-full bg-[#D4A373] rounded-full" style={{ width: `${100-deliveryRate}%` }}></div>
                  </div>
                  <p className="text-right text-[10px] font-black text-[#4A3B32]/70 uppercase mt-1">{stats.kpi.pickupCount} Operaciones</p>
                </div>
              </div>
            </BentoCard>

            <BentoCard className="md:col-span-8 overflow-hidden flex flex-col" delay={600}>
               <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="df text-3xl text-[#4A3B32] leading-none mb-1">Estrellas de la Cocina</h3>
                    <p className="text-[10px] font-black text-[#4A3B32]/70 uppercase tracking-widest">Ranking de los 6 productos más vendidos</p>
                  </div>
                  <Award className="text-[#D4A373]" size={30} />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  {stats.topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${i === 0 ? 'bg-[#D4A373] text-white' : 'bg-[#FAF7F2] text-[#4A3B32]'}`}>
                         {i + 1}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="font-bold text-sm text-[#4A3B32] truncate">{p.name}</p>
                         <p className="text-[10px] font-black text-[#4A3B32]/80 uppercase tracking-widest">{p.cantidad} Ventas</p>
                       </div>
                    </div>
                  ))}
                  {stats.topProducts.length === 0 && <p className="text-sm font-bold text-[#4A3B32]/70 col-span-2 text-center py-4">No hay ventas registradas en el período.</p>}
               </div>
            </BentoCard>

            {/* ── BENTO WIDE: REGISTRO HISTORICO LIMITADO A 15 ──────────────── */}
            <BentoCard className="md:col-span-12 p-0 overflow-hidden" delay={700}>
              <div className="p-6 bg-[#4A3B32] text-[#FAF7F2] flex justify-between items-center">
                <div>
                  <h3 className="df text-3xl leading-none">Registro de Auditoría</h3>
                  <p className="text-[10px] font-black text-[#FAF7F2]/50 uppercase tracking-widest mt-1">Últimos {stats.recentOrders.length} tickets despachados</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left bg-white">
                  <thead>
                    <tr>
                      {['Folio', 'Cliente', 'Recaudado', 'Modalidad', 'Cobro', 'Fecha'].map((h, i) => (
                        <th key={h} className={`px-6 py-4 bg-[#FAF7F2] text-[10px] font-black text-[#4A3B32]/90 uppercase tracking-widest ${i===2 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#4A3B32]/5">
                    {stats.recentOrders.map(o => (
                      <tr key={o.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                        <td className="px-6 py-4"><span className="text-xs font-black text-[#4A3B32] bg-[#4A3B32]/10 px-2 py-1 rounded">#{o.id}</span></td>
                        <td className="px-6 py-4 font-bold text-sm text-[#4A3B32] truncate max-w-[150px]">{o.customer_name || 'Desconocido'}</td>
                        <td className="px-6 py-4 text-right"><span className="df text-xl text-[#4A3B32]">{fmtFull(o.total)}</span></td>
                        <td className="px-6 py-4">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${o.delivery_method === 'delivery' ? 'text-[#D4A373]' : 'text-[#4A3B32]'}`}>
                              {o.delivery_method === 'delivery' ? 'Delivery' : 'Local'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-[#4A3B32]/70 uppercase">{o.payment_method || 'EFECTIVO'}</td>
                        <td className="px-6 py-4 text-xs font-bold text-[#4A3B32]/80">{new Date(o.created_at).toLocaleString('es-AR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })}</td>
                      </tr>
                    ))}
                    {stats.recentOrders.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm font-bold text-[#4A3B32]/70">Historial vacío</td></tr>}
                  </tbody>
                </table>
              </div>
            </BentoCard>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          📄 PLANTILLA PDF OCULTA PARA HTML2PDF (210mm x 297mm)
      ══════════════════════════════════════════════ */}
      <div style={{ overflow: 'hidden', height: 0, width: 0, position: 'absolute', top: -9999, left: -9999 }}>
        <div id="pdf-report-container" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', background: '#fff', color: '#4A3B32', fontFamily: '"Inter", sans-serif', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '4px solid #4A3B32', paddingBottom: '30px', marginBottom: '30px' }}>
            <div>
              <h1 style={{ fontSize: '60px', fontWeight: '900', margin: 0, lineHeight: 1, fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '2px' }}>GUSTO</h1>
              <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '4px', margin: '8px 0 0 0', opacity: 0.7 }}>Reporte Analítico Oficial</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.5, margin: 0 }}>PERÍODO EXPORTADO</p>
              <p style={{ fontSize: '20px', fontWeight: '900', margin: '4px 0 0 0' }}>{getLabelForPeriod()}</p>
              <p style={{ fontSize: '10px', opacity: 0.5, margin: '4px 0 0 0', fontWeight: 'bold' }}>Emitido: {new Date().toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: '#4A3B32', color: '#fff', padding: '30px', borderRadius: '12px' }}>
              <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', color: '#D4A373', margin: 0 }}>Caja Bruta Acumulada</p>
              <p style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '70px', lineHeight: 1, margin: '20px 0' }}>{fmtFull(stats.kpi.totalRevenue)}</p>
              <p style={{ fontSize: '12px', fontWeight: '700', opacity: 0.8, margin: 0 }}>En {stats.kpi.totalOrders} tickets consolidados</p>
            </div>
            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '10px' }}>
              <div style={{ border: '2px solid #4A3B32', borderRadius: '12px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.6, margin: 0 }}>Ticket Promedio</p>
                  <p style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '40px', lineHeight: 1, margin: '10px 0 0 0' }}>{fmtFull(stats.kpi.avgTicket)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.6, margin: 0 }}>Ráfaga</p>
                  <p style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '40px', lineHeight: 1, margin: '10px 0 0 0', color: '#D4A373' }}>{peakHour.hour}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, background: '#D4A373', borderRadius: '12px', padding: '15px', color: '#fff' }}>
                  <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>MercadoPago</p>
                  <p style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '30px', margin: '5px 0' }}>{mpPct}%</p>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: '700' }}>{fmtFull(stats.kpi.mpTotal)}</p>
                </div>
                <div style={{ flex: 1, background: '#FAF7F2', border: '2px solid #4A3B32', borderRadius: '12px', padding: '15px', color: '#4A3B32' }}>
                  <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Efectivo / Cash</p>
                  <p style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '30px', margin: '5px 0' }}>{cashPct}%</p>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: '700' }}>{fmtFull(stats.kpi.cashTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '30px' }}>
             <div style={{ border: '2px solid #4A3B32', borderRadius: '12px', padding: '20px', background: '#fff' }}>
               <h3 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '24px', letterSpacing: '1px', borderBottom: '2px solid #FAF7F2', paddingBottom: '10px', margin: '0 0 20px 0', color: '#4A3B32' }}>LOGÍSTICA</h3>
               <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '900', color: '#4A3B32' }}>Delivery: {stats.kpi.deliveryCount} uds.</p>
               <div style={{ width: '100%', height: '10px', background: '#FAF7F2', borderRadius: '5px', marginBottom: '20px' }}>
                 <div style={{ width: `${deliveryRate}%`, height: '100%', background: '#4A3B32', borderRadius: '5px' }}></div>
               </div>
               <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '900', color: '#4A3B32' }}>Retiros: {stats.kpi.pickupCount} uds.</p>
               <div style={{ width: '100%', height: '10px', background: '#FAF7F2', borderRadius: '5px' }}>
                 <div style={{ width: `${100-deliveryRate}%`, height: '100%', background: '#D4A373', borderRadius: '5px' }}></div>
               </div>
             </div>
             <div style={{ border: '2px solid #4A3B32', borderRadius: '12px', padding: '20px', background: '#fff', minHeight: '150px' }}>
               <h3 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '24px', letterSpacing: '1px', borderBottom: '2px solid #FAF7F2', paddingBottom: '10px', margin: '0 0 20px 0', color: '#4A3B32' }}>PRODUCTOS ESTRELLA (TOP 6)</h3>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px 25px' }}>
                 {stats.topProducts.map((p, i) => (
                   <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #FAF7F2', paddingBottom: '15px' }}>
                     <div style={{ fontWeight: '900', fontSize: '14px', color: '#4A3B32', opacity: 0.5 }}>{i+1}.</div>
                     <div style={{ fontWeight: '700', fontSize: '13px', color: '#4A3B32', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                     <div style={{ fontWeight: '900', fontSize: '15px', color: '#D4A373' }}>{p.cantidad}</div>
                   </div>
                 ))}
               </div>
             </div>
          </div>

          <div style={{ border: '2px solid #4A3B32', borderRadius: '12px', overflow: 'hidden', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#4A3B32', color: '#fff', padding: '15px 20px' }}>
              <h3 style={{ margin: 0, fontFamily: '"Bebas Neue", sans-serif', fontSize: '24px', letterSpacing: '1px' }}>REGISTRO DE OPERACIONES AUDITADAS</h3>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Visibilizando {stats.recentOrders.length} tickets</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', background: '#fff' }}>
              <thead>
                <tr style={{ borderBottom: '3px solid #4A3B32' }}>
                  <th style={{ padding: '12px 15px', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>Folio</th>
                  <th style={{ padding: '12px 15px', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>Hora/Día</th>
                  <th style={{ padding: '12px 15px', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>Sujeto / Cliente</th>
                  <th style={{ padding: '12px 15px', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>Tipo</th>
                  <th style={{ padding: '12px 15px', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', textAlign: 'right' }}>Cobro Bruto</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((o, i) => (
                  <tr key={o.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAF7F2', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 15px', fontWeight: '900' }}>#{o.id}</td>
                    <td style={{ padding: '12px 15px', opacity: 0.8 }}>{new Date(o.created_at).toLocaleString('es-AR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'})}</td>
                    <td style={{ padding: '12px 15px', fontWeight: '700' }}>{o.customer_name || 'Sin especificar'}</td>
                    <td style={{ padding: '12px 15px', fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', opacity: 0.7 }}>{o.delivery_method}</td>
                    <td style={{ padding: '12px 15px', fontWeight: '900', textAlign: 'right', fontSize: '14px', color: '#00A380' }}>{fmtFull(o.total)}</td>
                  </tr>
                ))}
                {stats.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px', textAlign: 'center', opacity: 0.5, fontWeight: 'bold' }}>Sin operaciones registradas en este período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '40px', borderTop: '2px solid #e2e8f0', paddingTop: '15px', textAlign: 'center', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '4px', opacity: 0.4 }}>
            DOC. INTERNO CONFIDENCIAL · GUSTO · GENERADO POR WEBDESIGNER.COM
          </div>

        </div>
      </div>
    </>
  );
}
