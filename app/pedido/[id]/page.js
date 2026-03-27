'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams } from 'next/navigation'
import { Clock, Utensils, Truck, CheckCircle, Loader2, MapPin, Package, Receipt } from 'lucide-react'
import Link from 'next/link'

// Diccionario de estados para la barra de progreso - ESTÉTICA GUSTO
const STATUS_STEPS = {
  'pending': { step: 1, label: 'Pendiente', desc: 'Esperando confirmación', icon: Clock, color: 'text-[#D4A373]', bg: 'bg-[#D4A373]' },
  'cooking': { step: 2, label: 'En Cocina', desc: 'Marchando el pedido', icon: Utensils, color: 'text-[#4A3B32]', bg: 'bg-[#4A3B32]' },
  'delivery': { step: 3, label: 'En Camino', desc: 'Llevando tu pedido', icon: Truck, color: 'text-[#00A380]', bg: 'bg-[#00A380]' },
  'completed': { step: 4, label: 'Entregado', desc: '¡A disfrutar!', icon: CheckCircle, color: 'text-[#4A3B32]', bg: 'bg-[#4A3B32]' }
}

export default function PedidoTrackingPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return

    // 1. Buscamos el pedido inicial
    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError(true)
      } else {
        setOrder(data)
      }
      setLoading(false)
    }

    fetchOrder()

    // 2. Nos suscribimos a los cambios EN VIVO de este pedido exacto
    const channel = supabase
      .channel(`order_tracking_${id}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders', 
          filter: `id=eq.${id}` 
        }, 
        (payload) => {
          setOrder(prev => ({ ...prev, status: payload.new.status }))
          
          // Efecto de sonido cuando cambia de estado
          try {
             const audio = new Audio('https://cdn.freesound.org/previews/274/274183_4322723-lq.mp3')
             audio.play().catch(e => console.log('Audio error', e))
          } catch(e) {}
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  if (loading) return <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center"><Loader2 className="animate-spin text-[#4A3B32]" size={48} /></div>
  
  if (error || !order) return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center text-[#4A3B32] p-4 text-center">
        <Package size={64} className="text-[#4A3B32]/40 mb-4"/>
        <h1 className="text-2xl font-black italic">PEDIDO NO ENCONTRADO</h1>
        <p className="text-[#4A3B32]/60">Revisá que el link sea correcto.</p>
        <Link href="/" className="mt-6 bg-[#4A3B32] px-6 py-2 rounded-xl font-bold hover:bg-black transition">Volver al Menú</Link>
    </div>
  )

  const currentStep = STATUS_STEPS[order.status]?.step || 1

  return (
    <div className="min-h-screen bg-[#FAF7F2] font-sans text-[#4A3B32]/90 pb-12 selection:bg-[#D4A373] selection:text-white">
      {/* HEADER PREMIUM (Logo limpio sin fondo) */}
      <div className="pt-8 pb-6 pointer-events-none flex flex-col items-center justify-center">
         <div className="w-28 h-28 flex items-center justify-center mb-4 z-10 hover:scale-105 transition-transform">
             <img src="/logo.png" alt="Gusto" className="w-full h-full object-contain drop-shadow-lg" />
         </div>
         <div className="flex flex-col items-center">
             <span className="text-[#4A3B32]/60 text-[10px] font-black tracking-[0.3em] uppercase mb-1">Tu Pedido</span>
             <p className="bg-[#4A3B32] text-[#FAF7F2] font-black text-sm tracking-widest uppercase px-6 py-2 rounded-full shadow-lg">#{order.id}</p>
         </div>
      </div>

      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* BARRA DE PROGRESO */}
        <div className="bg-white border border-[#4A3B32]/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${STATUS_STEPS[order.status]?.bg || 'bg-[#4A3B32]/10'} transition-colors duration-700`}></div>
            
            <h2 className="text-center text-3xl font-black text-[#4A3B32] mb-1 tracking-tighter df">Estado del Pedido</h2>
            <p className="text-center text-[11px] font-black text-[#D4A373] uppercase tracking-[0.2em] mb-10">Trazabilidad Activa</p>
            
            <div className="relative pl-2">
                <div className="space-y-4 relative z-10 flex flex-col">
                    {Object.entries(STATUS_STEPS).map(([statusKey, info], index, array) => {
                        const isCompleted = currentStep > info.step
                        const isCurrent = currentStep === info.step
                        const isLast = index === array.length - 1
                        const Icon = info.icon

                        return (
                            <div key={statusKey} className="flex flex-col">
                                <div className={`flex items-center gap-6 transition-all duration-500 relative z-20 ${isCurrent ? 'scale-[1.02] drop-shadow-xl' : isCompleted ? 'opacity-80' : 'opacity-40 grayscale'}`}>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-4 transition-all duration-500 bg-white ${isCurrent ? `border-${info.color.replace('text-', '')} text-${info.color.replace('text-', '')} shadow-2xl ring-4 ring-${info.bg}/20` : isCompleted ? `border-${info.color.replace('text-', '')} ${info.color}` : 'border-[#4A3B32]/20 text-[#4A3B32]'}`}>
                                        <Icon size={24} className={isCurrent ? 'animate-bounce drop-shadow-md' : ''} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`font-black text-lg uppercase tracking-wider ${isCurrent ? info.color : isCompleted ? 'text-[#4A3B32]' : 'text-[#4A3B32]/40'}`}>{info.label}</h3>
                                        <p className={`text-sm ${isCurrent ? 'text-[#4A3B32]/80 font-medium' : 'text-[#4A3B32]/50'}`}>{info.desc}</p>
                                    </div>
                                    {isCurrent && <div className="w-2 h-2 rounded-full bg-[#D4A373] animate-ping shrink-0 mr-4"></div>}
                                </div>
                                
                                {/* Segmento conector individual SOLO entre nodos, nunca cruzándolos */}
                                {!isLast && (
                                    <div className="ml-[27px] w-0.5 h-8 my-1 rounded-full relative">
                                        {/* Línea de fondo (gris) */}
                                        <div className="absolute inset-0 bg-[#4A3B32]/15"></div>
                                        {/* Línea activa (coloreada si el paso superior está completado) */}
                                        <div className={`absolute top-0 left-0 w-full bg-[#4A3B32] transition-all duration-1000 ease-in-out ${isCompleted ? 'h-full shadow-[0_0_8px_rgba(74,59,50,0.4)]' : 'h-0'}`}></div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

        {/* DETALLES DEL PEDIDO */}
        <div className="bg-white border border-[#4A3B32]/5 rounded-3xl p-6 shadow-xl">
            <h3 className="font-black text-[#4A3B32] uppercase tracking-[0.1em] text-sm flex items-center gap-2 mb-6 border-b border-[#4A3B32]/10 pb-4">
                <div className="bg-[#4A3B32]/10 p-2 rounded-lg text-[#4A3B32]"><Receipt size={18}/></div> 
                Resumen de Consumo
            </h3>
            
            <div className="space-y-4 mb-8">
                {order.order_items.map(item => (
                    <div key={item.id} className="flex justify-between items-start text-sm group">
                        <div className="flex-1">
                           <div className="flex items-center">
                               <span className="bg-[#4A3B32] text-[#FAF7F2] font-black text-[10px] px-2 py-0.5 rounded mr-3 shrink-0">{item.quantity}x</span>
                               <span className="text-[#4A3B32] font-bold group-hover:text-[#D4A373] transition-colors">{item.product_name}</span>
                           </div>
                           {item.options && <p className="text-[11px] text-[#4A3B32]/50 ml-[2.25rem] mt-1 font-medium leading-tight">+ {item.options}</p>}
                        </div>
                        <span className="text-[#4A3B32] font-black tracking-tight shrink-0 ml-4">${item.price * item.quantity}</span>
                    </div>
                ))}
            </div>

            <div className="bg-[#FAF7F2] rounded-2xl p-4 flex justify-between items-center border border-[#4A3B32]/10">
                <span className="text-[#4A3B32]/60 font-black textxs uppercase tracking-widest">Abonado:</span>
                <span className="text-3xl font-black text-[#4A3B32] df tracking-tighter sm:text-4xl">${order.total}</span>
            </div>
        </div>

        {/* INFO EXTRA */}
        <div className="bg-transparent border-2 border-[#4A3B32]/10 rounded-3xl p-6 text-sm text-[#4A3B32]">
            <p className="flex items-start gap-2 mb-2"><span className="font-bold text-[#4A3B32]/80">Cliente:</span> {order.customer_name}</p>
            <p className="flex items-start gap-2 mb-2"><span className="font-bold text-[#4A3B32]/80">Entrega:</span> {order.delivery_method === 'delivery' ? '🛵 Envío a Domicilio' : '🏪 Retiro en Local'}</p>
            {order.delivery_method === 'delivery' && (
                <p className="flex items-start gap-2"><MapPin size={16} className="shrink-0 mt-0.5 text-red-500"/><span className="line-clamp-2">{order.customer_address}</span></p>
            )}
        </div>

      </div>
    </div>
  )
}