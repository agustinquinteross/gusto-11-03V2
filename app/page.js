'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { Search, Lock, MapPin, Phone, Instagram, Loader2, ShoppingCart, Clock, Zap, Gift } from 'lucide-react'

// --- COMPONENTES ---
import ProductModal from '../components/ProductModal'
import CartModal from '../components/CartModal'
import PromoCarousel from '../components/PromoCarousel'
import { useCart } from '../store/useCart'

export default function Home() {
  // --- ESTADOS DE DATOS ---
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // --- ESTADOS DE NEGOCIO ---
  const [isStoreOpen, setIsStoreOpen] = useState(true)
  const [checkingStore, setCheckingStore] = useState(true)
  const [storeConfig, setStoreConfig] = useState(null)

  // --- ESTADOS DE UI ---
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Estados para controlar los Modales
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Hook del Carrito (Evita error de hidratación con 'mounted')
  const { cart, addToCart, mounted } = useCart()
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)

  // 1. Chequear si la tienda está abierta y obtener ajustes visuales
  const fetchStoreConfig = async () => {
    const { data } = await supabase.from('store_config').select('*').eq('id', 1).single()
    if (data) {
      setIsStoreOpen(data.is_open)
      setStoreConfig(data)
    }
    setCheckingStore(false)
  }

  // 2. Cargar Productos y Categorías
  const fetchData = async () => {
    try {
      // Categorías
      const { data: cats } = await supabase.from('categories').select('*').order('id')
      if (cats) setCategories([{ id: 'all', name: 'Todos' }, ...cats])

      // Productos con sus Extras y Ofertas
      const { data: rawProducts } = await supabase
        .from('products')
        .select(`
            *,
            categories (name),
            special_offers (*),
            product_modifiers (
                group_id,
                position,
                modifier_groups (
                    id, name, min_selection, max_selection, max_per_option,
                    modifier_options (id, name, price, is_available)
                )
            )
        `)
        .eq('is_active', true)
        .order('id')

      if (rawProducts) {
        // Formateamos los datos ordenando por 'position'
        const formatted = rawProducts.map(p => {
          const sortedModifiers = (p.product_modifiers || []).sort((a, b) => (a.position || 0) - (b.position || 0));
          return {
            ...p,
            modifiers: sortedModifiers.map(pm => pm.modifier_groups).filter(Boolean)
          };
        });
        setProducts(formatted)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // --- CARGA INICIAL Y REALTIME ---
  useEffect(() => {
    async function init() {
      await Promise.all([fetchStoreConfig(), fetchData()])
      setLoading(false)
    }
    init()

    // 📡 CANALES TIEMPO REAL: WEB CLIENTE
    
    // 1. Escuchar si el Admin Cierra o Abre el local de golpe
    const storeChannel = supabase
      .channel('public_store_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_config' }, (payload) => {
         console.log("Status de tienda cambió en vivo:", payload);
         fetchStoreConfig(); // Re-chequear y mostrar u ocultar cartel de CERRADO
      })
      .subscribe();

    // 2. Escuchar si un producto se queda sin stock o cambia de precio
    const productsChannel = supabase
      .channel('public_products_stock')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
         console.log("Stock o detalle de producto cambió en vivo:", payload);
         fetchData(); // Refrescar catálogo
      })
      .subscribe();

    // 3. Escuchar cambios en promociones / special_offers
    const promosChannel = supabase
      .channel('public_promos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_offers' }, (payload) => {
         console.log("Promoción actualizada en vivo:", payload);
         fetchData(); // Refrescar catálogo para actualizar las etiquetas amarillas
      })
      .subscribe();

    return () => {
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(promosChannel);
    }
  }, [])

  // --- FILTROS Y ORDENAMIENTO ESTELAR ---
  const filteredProducts = products
    .filter(p => {
      const matchesCategory = activeCategory === 'Todos' || p.categories?.name === activeCategory
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
    .sort((a, b) => {
      // 1. STOCK 0 SIEMPRE AL FONDO
      if (a.stock === 0 && b.stock !== 0) return 1;
      if (b.stock === 0 && a.stock !== 0) return -1;

      // 2. PROMOCIONES ARRIBA
      const aHasPromo = a.special_offers && a.special_offers.is_active !== false;
      const bHasPromo = b.special_offers && b.special_offers.is_active !== false;
      if (aHasPromo && !bHasPromo) return -1;
      if (bHasPromo && !aHasPromo) return 1;

      // 3. ETIQUETAS DESTACADAS (Ej: NUEVO, MAS VENDIDO) suben un poquito
      const aHasTags = a.promo_tag && a.promo_tag.trim() !== '';
      const bHasTags = b.promo_tag && b.promo_tag.trim() !== '';
      if (aHasTags && !bHasTags) return -1;
      if (bHasTags && !aHasTags) return 1;

      // 4. ORDEN ALFABÉTICO POR DEFECTO PARA EL RESTO
      return a.name.localeCompare(b.name);
    });

  // Pantalla de carga inicial para evitar el parpadeo
  if (checkingStore) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#4A3B32] mb-4" size={48} />
        <p className="text-[#4A3B32]/90 font-bold tracking-widest uppercase text-sm animate-pulse">
          Preparando la cocina...
        </p>
      </div>
    )
  }

  // --- RENDER: PANTALLA "CERRADO" ---
  if (!isStoreOpen) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#FAF7F2] flex flex-col items-center justify-center text-center p-6 text-[#4A3B32] overflow-hidden">
        {/* Fondo sutil elegante */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo animado lentamente */}
          <div className="mb-8 hover:scale-105 transition-transform duration-700">
             <img src="/logo.png" alt="Gustó" className="w-56 sm:w-64 object-contain drop-shadow-xl opacity-90" />
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter mb-4 text-[#4A3B32]">CERRADO</h1>
          
          <p className="text-[#4A3B32]/70 font-medium mb-8 max-w-sm text-sm sm:text-base">
            Nos estamos preparando para ofrecerte el mejor sabor.
          </p>
          
          <div className="bg-[#4A3B32] px-6 py-3 rounded-2xl shadow-lg border border-[#D4A373]/20 flex items-center gap-3">
             <Clock size={20} className="text-[#D4A373] animate-pulse" />
             <span className="text-[#FAF7F2] font-black uppercase tracking-widest text-sm">Pronto abriremos</span>
          </div>
        </div>
      </div>
    )
  }

  // --- RENDER PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#FAF7F2] font-sans text-[#4A3B32] pb-24">

      {/* HERO BANNER - LOGO EXCLUSIVO */}
      <div className="relative pt-8 pb-4 bg-[#FAF7F2] flex flex-col items-center justify-center text-center w-full z-10">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes gentleFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
        `}} />
        <img src="/logo.png" alt="Gustó" className="w-full max-w-[280px] sm:max-w-[360px] px-4 object-contain drop-shadow-xl select-none" style={{ animation: 'gentleFloat 4s ease-in-out infinite' }} />
      </div>

      {/* BARRA DE NAVEGACIÓN STICKY */}
      <div className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#4A3B32]/10 shadow-sm">
        <div className="max-w-6xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4">

          {/* Buscador */}
          <div className="relative z-20 shadow-[0_8px_30px_rgb(74,59,50,0.12)] rounded-xl">
            <Search className="absolute left-4 top-3.5 text-[#4A3B32]/70" size={22} />
            <input
              type="text" placeholder="¿Qué se te antoja hoy?"
              className="w-full bg-white border-0 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 text-[#4A3B32] text-sm sm:text-base font-bold placeholder-[#4A3B32]/40 outline-none transition-all ring-1 ring-[#4A3B32]/10 focus:ring-2 focus:ring-[#D4A373]"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Categorías */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 custom-scrollbar hide-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                  className={`whitespace-nowrap px-4 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all border ${activeCategory === cat.name ? 'bg-[#4A3B32] text-[#FAF7F2] border-[#4A3B32] shadow-lg' : 'bg-transparent text-[#4A3B32]/70 border-[#4A3B32]/20 hover:border-[#4A3B32]/50 hover:text-[#4A3B32]'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CARRUSEL DE PROMOS */}
      <PromoCarousel />

      {/* GRILLA DE PRODUCTOS */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#4A3B32]" size={40} /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map(product => (
                <div key={product.id} onClick={() => product.stock !== 0 && setSelectedProduct(product)} className={`bg-white border border-[#4A3B32]/10 rounded-2xl overflow-hidden transition-all group relative ${product.stock === 0 ? 'opacity-75 cursor-not-allowed grayscale-[0.2]' : 'hover:border-[#4A3B32]/30 cursor-pointer shadow-sm hover:shadow-md'}`}>

                  {/* 🔥 CONTENEDOR DE ETIQUETAS 🔥 */}
                  <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-1.5">

                    {/* 1. Etiqueta de la Oferta Vinculada (Amarilla) */}
                    {product.special_offers && product.special_offers.is_active !== false && (
                      <div className="bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1 animate-pulse">
                        <Gift size={12} /> {product.special_offers.discount_value}
                      </div>
                    )}

                    {/* Etiqueta de Stock */}
                    {product.stock !== null && product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
                      <div className="bg-orange-500 text-white font-black text-[9px] uppercase tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1 animate-pulse">
                        ¡Últimos {product.stock}!
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="bg-red-600 text-white font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1">
                        AGOTADO
                      </div>
                    )}

                    {/* 2. Etiquetas de Texto (Rojas) - Con filtro anti-duplicados */}
                    {product.promo_tag && product.promo_tag.split(',').map((tag, index) => {
                      const cleanTag = tag.trim().toUpperCase();
                      const offerTag = product.special_offers?.discount_value?.toUpperCase();

                      // Si la etiqueta está vacía o dice exactamente lo mismo que la oferta (ej: 2X1), no la mostramos
                      if (cleanTag === "" || cleanTag === offerTag) return null;

                      return (
                        <div key={index} className="bg-[#4A3B32] text-[#FAF7F2] font-black text-[9px] uppercase tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1">
                          <Zap size={10} /> {cleanTag}
                        </div>
                      );
                    })}
                  </div>

                  {/* Contenedor de la Imagen con Aspect Ratio 4:3 para mantener un tamaño uniforme y elegante */}
                  <div className="aspect-[4/3] overflow-hidden relative bg-[#FAF7F2] flex justify-center items-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🍩</div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-[#4A3B32]/90 backdrop-blur text-[#FAF7F2] px-3 py-1 rounded-lg font-bold shadow-sm">${product.price}</div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-2xl font-serif text-[#4A3B32] mb-1 leading-tight">{product.name}</h3>
                    <p className="text-sm text-[#4A3B32]/70 line-clamp-2">{product.description}</p>
                    <button className="mt-4 w-full bg-transparent border border-[#4A3B32] hover:bg-[#4A3B32] text-[#4A3B32] hover:text-[#FAF7F2] font-bold uppercase tracking-widest text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">Ver Detalles</button>
                  </div>
                </div>
              ))}
            </div>
            {filteredProducts.length === 0 && <div className="text-center py-20 text-[#4A3B32]/90"><p className="text-lg">No encontramos productos 😔</p></div>}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-[#4A3B32] text-[#FAF7F2] mt-12 px-6 pb-20">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center py-10 gap-5">
          <img src="/logo.png" alt="Gustó" className="h-16 w-auto object-contain" style={{ filter: 'brightness(0) invert(0.93) sepia(0.15)' }} />
          
          <div className="space-y-1">
            <p className="text-[#FAF7F2]/90 font-bold text-sm">San Fernando del Valle de Catamarca</p>
            <p className="text-[#FAF7F2]/50 text-xs">Pedidos: 12:00 a 16:00 hs</p>
            <p className="text-[#FAF7F2]/50 text-xs">Entregas/retiros: 15:00 a 17:30 hs</p>
          </div>

          <div className="flex items-center gap-3">
            <a href="https://www.instagram.com/gusto.ok/" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/10 rounded-full text-[#FAF7F2] hover:bg-[#FAF7F2] hover:text-[#4A3B32] transition" title="Instagram">
              <Instagram size={18} />
            </a>
            <a href="https://wa.me/543834975040" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/10 rounded-full text-[#FAF7F2] hover:bg-[#FAF7F2] hover:text-[#4A3B32] transition" title="WhatsApp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto text-center pt-6 border-t border-[#FAF7F2]/10 space-y-3 pb-2">
          <p className="text-[#FAF7F2]/25 text-[11px]">Gustó &copy; 2026 &middot; Todos los derechos reservados</p>
          <a href="https://pulso-apps.vercel.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 text-[#FAF7F2]/40 hover:text-[#FAF7F2]/70 transition-all group">
            <span className="text-xs tracking-wide">Creado por</span>
            <img src="/logopulso.png" alt="Pulso" className="h-7 w-auto group-hover:scale-105 transition-transform" style={{ filter: 'brightness(0) invert(0.93) sepia(0.15)' }} />
            <span className="text-sm font-black tracking-wide">pulso.app</span>
          </a>
        </div>
      </footer>

      {/* BOTONES FLOTANTES */}
      <Link href="/admin" className="fixed bottom-6 left-6 z-40 bg-[#FAF7F2]/80 backdrop-blur-md border border-[#4A3B32]/20 p-3 rounded-full text-[#4A3B32]/70 hover:bg-[#4A3B32] hover:text-[#FAF7F2] hover:border-[#4A3B32] transition-all shadow-2xl group"><Lock size={20} className="group-hover:scale-110 transition-transform" /></Link>

      <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 right-6 z-40 bg-[#4A3B32] text-[#FAF7F2] p-4 rounded-full shadow-xl hover:bg-black hover:scale-105 transition-all flex items-center justify-center group">
        <ShoppingCart size={24} className="group-hover:rotate-12 transition-transform" />
        {/* Renderiza el contador solo si se montó en el cliente */}
        {mounted && totalItems > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black font-black text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-black animate-in zoom-in">{totalItems}</span>}
      </button>

      {/* --- MODALES --- */}
      <ProductModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(item) => {
          addToCart(item)
          setIsCartOpen(true)
        }}
      />

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

    </div>
  )
}
