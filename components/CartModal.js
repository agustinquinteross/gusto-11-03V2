'use client'
import { useState, useEffect } from 'react'
import { useCart } from '../store/useCart'
import { supabase } from '../lib/supabase'
import { X, Loader2, MapPin, Store, Search, Trash2, Ticket, CreditCard, MessageCircle, Wallet, Gift, ChevronDown } from 'lucide-react'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false, loading: () => <div className="h-40 bg-[#4A3B32]/5 animate-pulse rounded-xl"/> })

// 📍 COORDENADAS EXACTAS DE GUSTO
const RESTAURANT_COORDS = { lat: -28.4746029, lng: -65.7761164 }

function calculateDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export default function CartModal({ isOpen, onClose }) {
  const { cart, getTotal, clearCart, removeFromCart } = useCart()
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [deliveryType, setDeliveryType] = useState('delivery')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  
  const [config, setConfig] = useState({
    whatsapp_number: '5493834968345',
    delivery_base_price: 1500,
    delivery_free_base_km: 2,
    delivery_price_per_extra_km: 800
  })

  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponMsg, setCouponMsg] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [coords, setCoords] = useState(null)
  const [forcedCoords, setForcedCoords] = useState(null)
  const [searchingMap, setSearchingMap] = useState(false)

  const [distanceKm, setDistanceKm] = useState(0)
  const [deliveryCost, setDeliveryCost] = useState(0)

  // Autocomplete de dirección
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState(null)

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('store_config').select('*').eq('id', 1).single()
      if (data) {
          setConfig({
              whatsapp_number: data.whatsapp_number || '5493834968345',
              delivery_base_price: Number(data.delivery_base_price) || 1500,
              delivery_free_base_km: Number(data.delivery_free_base_km) || 2,
              delivery_price_per_extra_km: Number(data.delivery_price_per_extra_km) || 800
          })
      }
    }
    if (isOpen) fetchConfig()
  }, [isOpen])

  useEffect(() => {
    if (coords && deliveryType === 'delivery') {
      const dist = calculateDistanceKM(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, coords.lat, coords.lng)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistanceKm(dist)
      
      if (dist <= config.delivery_free_base_km) {
        setDeliveryCost(config.delivery_base_price)
      } else {
        const extraKm = Math.ceil(dist - config.delivery_free_base_km)
        setDeliveryCost(config.delivery_base_price + (extraKm * config.delivery_price_per_extra_km))
      }
    } else {
      setDeliveryCost(0)
      setDistanceKm(0)
    }
  }, [coords, deliveryType, config])

  if (!isOpen) return null

  const getItemPromoSavings = (item) => {
    const offer = item.special_offers
    if (!offer || offer.is_active === false) return 0
    const qty   = Math.max(0, Number(item.quantity) || 0)
    // ✅ FIX: Usar precio base del producto (sin extras) para calcular descuentos
    const price = Math.max(0, Number(item.basePrice || item.price) || 0)
    try {
      if (offer.type === 'nxm' || offer.type === '2x1') {
        let n = 2, m = 1; 
        if (offer.type === 'nxm') {
           const parts = offer.discount_value.toLowerCase().split('x');
           n = parseInt(parts[0]) || 2; m = parseInt(parts[1]) || 1;
        }
        if (n <= m || n <= 0) return 0; 
        return Math.floor(qty / n) * (n - m) * price;
      }
      if (offer.type === 'percent' || offer.type === '50off') {
        let pct = offer.type === 'percent' ? parseInt(offer.discount_value) || 0 : 50; 
        return Math.round(qty * price * (pct / 100) * 100) / 100;
      }
      if (offer.type === 'second_unit' || offer.type === '70off_2nd') {
        let pct = offer.type === 'second_unit' ? parseInt(offer.discount_value) || 0 : 70;
        return Math.round(Math.floor(qty / 2) * price * (pct / 100) * 100) / 100;
      }
    } catch (e) { console.error(e) }
    return 0; 
  }

  const promoSavings = Math.round(cart.reduce((total, item) => total + getItemPromoSavings(item), 0) * 100) / 100
  const subtotal = Number(getTotal()) || 0
  
  // ✅ FIX: El descuento del cupón ahora es dinámico (se recalcula si cambia el subtotal).
  let discountAmount = 0
  if (appliedCoupon) {
      discountAmount = appliedCoupon.discount_type === 'percent' 
          ? (subtotal * appliedCoupon.value) / 100 
          : appliedCoupon.value;
  }
  
  const total = Math.max(0, subtotal - discountAmount - promoSavings + deliveryCost)

  const handleSearchAddress = async (query) => {
    if (!query || query.length < 3) { setSuggestions([]); return }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&viewbox=-65.85,-28.55,-65.65,-28.40&bounded=1&countrycodes=ar&addressdetails=1`)
      const data = await response.json()
      if (data && data.length > 0) {
        setSuggestions(data.map(d => {
          const street = d.address?.road || ''
          const number = d.address?.house_number || ''
          const neighborhood = d.address?.neighbourhood || d.address?.suburb || d.address?.city_district || ''
          const city = d.address?.city || d.address?.town || d.address?.village || ''
          
          let label = street
          if (number) label += ` ${number}`
          if (neighborhood) label += `, ${neighborhood}`
          if (city && !neighborhood.includes(city)) label += ` (${city})`
          
          // Si no hay calle, usamos display_name corto
          if (!street) label = d.display_name.split(',').slice(0, 2).join(',')
          
          return { label, lat: parseFloat(d.lat), lng: parseFloat(d.lon) }
        }))
        setShowSuggestions(true)
      } else { setSuggestions([]) }
    } catch (error) { console.error(error) }
  }

  const handleSelectSuggestion = (suggestion) => {
    setAddress(suggestion.label)
    setForcedCoords({ lat: suggestion.lat, lng: suggestion.lng })
    setCoords({ lat: suggestion.lat, lng: suggestion.lng })
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleAddressChange = (value) => {
    setAddress(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => handleSearchAddress(value), 200)
    setSearchTimeout(timeout)
  }

  const handleApplyCoupon = async () => {
    if (!couponCode) return
    setLoading(true)
    const { data, error } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).single()
    setLoading(false)
    if (error || !data) { setCouponMsg('❌ Cupón inválido'); setAppliedCoupon(null); return }
    if (data.expires_at && new Date() > new Date(data.expires_at)) { setCouponMsg('⚠️ Vencido'); setAppliedCoupon(null); return }
    if (data.usage_limit && data.times_used >= data.usage_limit) { setCouponMsg('⚠️ Agotado'); setAppliedCoupon(null); return }
    
    // ✅ FIX: Guardamos todo el objeto del cupón, no el valor del descuento fijo.
    setAppliedCoupon(data)
    setCouponMsg(`✅ Cupón aplicado correctamente`)
  }

  const getOptionsString = (item) => item.selectedOptions?.map(o => o.name).join(', ') || ''

  const handleCheckout = async () => {
    if (!name || !phone) return alert('⚠️ Completa Nombre y Teléfono')
    if (deliveryType === 'delivery' && !coords) return alert('⚠️ Por favor, marcá tu ubicación en el mapa para calcular el envío.')
    
    setLoading(true)

    const { data: order, error } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        customer_address: deliveryType === 'delivery' ? `(${distanceKm.toFixed(1)} km) ${address}` : 'Retiro en Local',
        total: total,
        status: 'pending',
        delivery_method: deliveryType,
        payment_method: paymentMethod,
        discount: discountAmount + promoSavings, 
        coupon_code: couponCode || null
      }).select().single()

    if (error) { alert('Error al guardar: ' + error.message); setLoading(false); return }

    // --- DESCONTAR STOCK ---
    await Promise.all(cart.map(async (item) => {
        if (item.stock !== null && item.stock !== undefined) {
            const newStock = Math.max(0, item.stock - item.quantity);
            await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
        }
    }));

    const orderItems = cart.map(item => ({
      order_id: order.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      options: getOptionsString(item),
      note: item.note || ''
    }))
    await supabase.from('order_items').insert(orderItems)
    
    if (discountAmount > 0 && couponCode) {
        const { data: c } = await supabase.from('coupons').select('times_used').eq('code', couponCode).single()
        if(c) await supabase.from('coupons').update({ times_used: c.times_used + 1 }).eq('code', couponCode)
    }

    const itemsList = cart.map(i => {
        const extras    = getOptionsString(i)
        const nota      = i.note ? ` _(Nota: ${i.note})_` : ''
        const savings   = getItemPromoSavings(i)
        const hasPromo  = i.special_offers && i.special_offers.is_active !== false
        const promoTag  = hasPromo ? ` 🎁 *[${i.special_offers.discount_value}]*` : ''
        const promoLine = savings > 0 ? `%0A  └ Ahorro: -$${Math.round(savings).toLocaleString('es-AR')}` : ''
        return `▪️ ${i.quantity}x *${i.name}*${promoTag}${extras ? ` + ${extras}` : ''}${nota}${promoLine}`
    }).join('%0A')

    // ✅ FIX: Link de Google Maps estándar y funcional
    const mapLink = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : ''
    
    let msg = `Hola Gustó! ✨%0A%0ASoy *${name}*.%0APedido *%23${order.id}*%0A`
    
    if (deliveryType === 'delivery') {
        msg += `%0A🛵 *ENVÍO A DOMICILIO*`
        msg += `%0A📏 Distancia: *${distanceKm.toFixed(1)} KM*` 
        msg += `%0A📍 Dir: *${address}*`
        // ✅ FIX: Agregamos un salto de línea después del link para que el paréntesis no se pegue
        if (mapLink) msg += `%0A📍 GPS: ${mapLink}%0A`
    } else { 
        msg += `%0A🏪 *RETIRO EN LOCAL*%0A` 
    }

    msg += `%0A${itemsList}%0A%0A`
    if (promoSavings > 0) msg += `🎁 Ahorro Promos: -$${promoSavings}%0A`
    if (deliveryType === 'delivery') msg += `🛵 Costo Envío: $${deliveryCost}%0A`
    msg += `Total a Pagar: *$${total}*%0APago: ${paymentMethod.toUpperCase()}%0A%0A`

    const trackingUrl = `${window.location.origin}/pedido/${order.id}`
    msg += `📍 *SEGUÍ TU PEDIDO EN VIVO ACÁ:*%0A${trackingUrl}`

    window.open(`https://wa.me/${config.whatsapp_number}?text=${msg}`, '_blank')
    
    clearCart()
    onClose()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-[#FAF7F2]/90 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[95vh] overflow-y-auto shadow-2xl border border-[#4A3B32]/10 text-[#4A3B32]/90 no-scrollbar">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#4A3B32] italic tracking-tighter uppercase">Tu Pedido</h2>
          <button onClick={onClose} className="p-2 bg-[#4A3B32]/5 rounded-full hover:bg-[#4A3B32]/10 text-[#4A3B32]"><X size={20} /></button>
        </div>

        {/* LISTA DE PRODUCTOS */}
        <div className="space-y-3 mb-6 pr-1">
          {cart.length === 0 ? (
            <p className="text-center text-[#4A3B32]/60 py-4">Carrito vacío</p>
          ) : cart.map((item, index) => {
            const itemSavings = getItemPromoSavings(item)
            const hasPromo = item.special_offers && item.special_offers.is_active !== false
            return (
              <div key={index} className={`flex justify-between items-start p-3 rounded-xl border transition-all ${hasPromo ? 'bg-yellow-900/10 border-yellow-800/50' : 'bg-[#FAF7F2]/40 border-[#4A3B32]/10'}`}>
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="text-red-500 font-bold mt-0.5 shrink-0">{item.quantity}x</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#4A3B32] leading-tight">{item.name}</p>
                      {hasPromo && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-yellow-400 bg-yellow-900/30 border border-yellow-800/50 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          <Gift size={9} className="shrink-0"/> {item.special_offers.discount_value}
                        </span>
                      )}
                    </div>
                    {item.selectedOptions?.length > 0 && <p className="text-xs text-[#4A3B32]/70 mt-0.5">+ {getOptionsString(item)}</p>}
                    {item.note && <p className="text-[10px] text-yellow-500 italic mt-1 bg-yellow-900/10 px-2 py-0.5 rounded border border-yellow-900/30">📝 {item.note}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`font-bold text-sm ${hasPromo ? 'line-through text-[#4A3B32]/60' : 'text-[#4A3B32]/70'}`}>${Math.round(item.price * item.quantity).toLocaleString('es-AR')}</p>
                      {itemSavings > 0 && (
                        <p className="text-yellow-400 font-black text-sm">
                          ${Math.round((item.price * item.quantity) - itemSavings).toLocaleString('es-AR')}
                          <span className="text-[9px] text-yellow-600 ml-1">(-${Math.round(itemSavings).toLocaleString('es-AR')})</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.cartItemId)} className="text-[#4A3B32]/50 hover:text-red-500 p-1 transition-colors shrink-0 ml-2"><Trash2 size={16}/></button>
              </div>
            )
          })}
        </div>

        {/* FORMULARIO */}
        <div className="space-y-4">
            <div className="flex gap-2">
                <input type="text" placeholder="CUPÓN" className="w-full pl-4 p-3 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] outline-none uppercase text-sm focus:border-green-600" value={couponCode} onChange={e => setCouponCode(e.target.value)} />
                <button onClick={handleApplyCoupon} className="bg-[#4A3B32]/5 text-[#4A3B32] font-bold px-4 rounded-xl text-xs border border-[#4A3B32]/20">APLICAR</button>
            </div>
            {couponMsg && <p className={`text-xs text-center font-bold ${appliedCoupon ? 'text-green-500' : 'text-red-500'}`}>{couponMsg}</p>}

            <input type="text" placeholder="Tu Nombre" className="w-full p-3 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] focus:border-red-600 outline-none transition-all" value={name} onChange={e => setName(e.target.value)} />
            <input type="tel" placeholder="Tu WhatsApp" className="w-full p-3 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] focus:border-red-600 outline-none transition-all" value={phone} onChange={e => setPhone(e.target.value)} />
            
            <div className="flex bg-white rounded-xl p-1 border border-[#4A3B32]/20">
                <button onClick={() => setDeliveryType('delivery')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${deliveryType === 'delivery' ? 'bg-[#4A3B32] text-[#FAF7F2]' : 'text-[#4A3B32]/60'}`}><MapPin size={16} className="inline mr-1"/> ENVÍO</button>
                <button onClick={() => setDeliveryType('pickup')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${deliveryType === 'pickup' ? 'bg-[#4A3B32] text-[#FAF7F2]' : 'text-[#4A3B32]/60'}`}><Store size={16} className="inline mr-1"/> RETIRO</button>
            </div>

            {deliveryType === 'delivery' && (
                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative">
                        <input type="text" placeholder="Escribí tu dirección..." className="w-full p-3 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] focus:border-red-600 outline-none transition-all pr-10" value={address} onChange={e => handleAddressChange(e.target.value)} onFocus={() => suggestions.length > 0 && setShowSuggestions(true)} />
                        {address && <Search size={18} className="absolute right-3 top-3.5 text-[#4A3B32]/40" />}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-[#4A3B32]/20 rounded-xl shadow-lg overflow-hidden">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => handleSelectSuggestion(s)} className="w-full text-left px-4 py-3 text-sm text-[#4A3B32] hover:bg-[#FAF7F2] border-b border-[#4A3B32]/5 last:border-0 transition-colors flex items-start gap-2">
                                        <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                                        <span className="line-clamp-1">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="rounded-xl overflow-hidden border border-[#4A3B32]/10 h-48 ring-1 ring-white/5 relative">
                        <MapPicker setLocation={setCoords} forcedCoords={forcedCoords} restaurantCoords={RESTAURANT_COORDS} />
                    </div>

                    <div className={`p-4 rounded-xl border transition-all ${coords ? 'bg-green-900/10 border-green-800/50' : 'bg-white border-[#4A3B32]/10'}`}>
                        {coords ? (
                           <div className="flex justify-between items-center">
                              <div>
                                <p className="text-[10px] text-[#4A3B32]/70 font-bold uppercase tracking-widest mb-1">Costo de Envío</p>
                                <p className="text-sm font-medium text-[#4A3B32]">Distancia: <span className="text-green-400 font-bold">{distanceKm.toFixed(1)} km</span></p>
                              </div>
                              <span className="text-2xl font-black text-green-500">${deliveryCost}</span>
                           </div>
                        ) : (
                           <p className="text-xs text-[#4A3B32]/70 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                              <MapPin size={14} className="text-red-500 animate-bounce" /> Marcá tu ubicación en el mapa
                           </p>
                        )}
                    </div>
                </div>
            )}

            <select className="w-full p-3 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] focus:border-red-600 outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia</option>
            </select>
        </div>

        {/* RESUMEN DE TOTALES */}
        <div className="mt-6 pt-4 border-t border-[#4A3B32]/10 space-y-1">
            <div className="flex justify-between text-[#4A3B32]/70 text-sm font-medium"><span>Subtotal</span><span>${subtotal}</span></div>
            {deliveryType === 'delivery' && coords && <div className="flex justify-between text-[#4A3B32]/70 text-sm font-medium"><span>Envío</span><span>${deliveryCost}</span></div>}
            {promoSavings > 0 && <div className="flex justify-between text-yellow-500 font-bold text-sm italic"><span>Ahorro Promos</span><span>-${promoSavings}</span></div>}
            {discountAmount > 0 && <div className="flex justify-between text-green-500 font-bold text-sm"><span>Descuento Cupón</span><span>-${discountAmount}</span></div>}
            <div className="flex justify-between text-2xl font-black text-[#4A3B32] pt-2 mb-4"><span>Total</span><span className="text-[#4A3B32]">${total}</span></div>
            
            <div className="space-y-3">
                <button onClick={handleCheckout} disabled={loading || cart.length === 0 || (deliveryType === 'delivery' && !coords)} className="w-full bg-green-600 text-[#4A3B32] py-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-green-500 disabled:opacity-50 shadow-lg shadow-green-900/20 transition-all uppercase tracking-widest text-sm">
                    {loading ? <Loader2 className="animate-spin"/> : <><MessageCircle size={20}/> Enviar Pedido</>}
                </button>
            </div>
        </div>

      </div>
    </div>
  )
}