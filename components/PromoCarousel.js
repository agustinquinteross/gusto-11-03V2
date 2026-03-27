'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export default function PromoCarousel() {
  const [banners, setBanners] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  // ✅ FIX: Usamos useRef para trackear el interval y poder limpiarlo
  // desde cualquier función sin depender del closure.
  const intervalRef = useRef(null)

  // 1. Cargar Banners desde Supabase y escuchar cambios en vivo
  useEffect(() => {
    const fetchBanners = async () => {
      const { data } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: false })

      if (data) {
         setBanners(data)
         // Evitamos crashear si el banner actual se borra y queda fuera de índice
         setCurrentIndex(prev => prev >= data.length && data.length > 0 ? 0 : prev)
      }
      setLoading(false)
    }
    fetchBanners()

    const bannersChannel = supabase
      .channel('public_banners_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, (payload) => {
         console.log("Banner actualizado en vivo:", payload);
         fetchBanners();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bannersChannel);
    }
  }, [])

  // ✅ FIX: nextSlide usa useCallback con setCurrentIndex en forma funcional.
  // Esto es clave: al usar "prev =>" dentro del setter, la función NO necesita
  // capturar "currentIndex" ni "banners.length" en su closure.
  // Así podemos sacar currentIndex de las dependencias del useEffect del interval,
  // rompiendo el ciclo que recreaba el interval en cada cambio de slide.
  const nextSlide = useCallback(() => {
    setCurrentIndex(prev => (prev === banners.length - 1 ? 0 : prev + 1))
  }, [banners.length]) // Solo depende de banners.length, no de currentIndex

  const prevSlide = useCallback(() => {
    setCurrentIndex(prev => (prev === 0 ? banners.length - 1 : prev - 1))
  }, [banners.length])

  // 2. Auto-Play
  // ✅ FIX: El problema original era que [currentIndex, banners.length] como
  // dependencias hacía que el useEffect se re-ejecutara en CADA cambio de slide,
  // lo que significa:
  //   - clearInterval del interval anterior ✅ (correcto)
  //   - setInterval nuevo ✅ (correcto)
  // Pero con 5 banners cambiando cada 5 segundos, esto creaba y destruía
  // 1 interval por segundo. En sí no es un "memory leak" clásico porque
  // el cleanup lo manejaba, pero sí era ineficiente y podía causar que el
  // timer se "resetee" cada vez que el usuario hace click en las flechas,
  // dando saltos irregulares en el timing.
  //
  // Solución: sacamos currentIndex de las dependencias usando la forma
  // funcional del setter dentro de nextSlide. El interval ahora se crea
  // UNA sola vez cuando carga el componente y solo se recrea si cambia
  // la cantidad de banners.
  useEffect(() => {
    if (banners.length <= 1) return

    // Limpiamos cualquier interval previo antes de crear uno nuevo
    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      nextSlide()
    }, 5000)

    // Cleanup al desmontar o cuando cambia banners.length
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [banners.length, nextSlide]) // ✅ currentIndex ya NO está en las dependencias

  // ✅ BONUS: Pausa el autoplay cuando el usuario interactúa con las flechas
  // y lo reinicia desde cero para que no haya un salto inmediato tras el click.
  const handleManualNav = (navFn) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    navFn()
    // Reiniciamos el timer desde cero después de la navegación manual
    if (banners.length > 1) {
      intervalRef.current = setInterval(() => {
        nextSlide()
      }, 5000)
    }
  }

  if (loading) return (
    <div className="h-40 sm:h-64 bg-white animate-pulse rounded-2xl mx-4 mt-6 flex items-center justify-center">
      <Loader2 className="animate-spin text-[#4A3B32]/40" />
    </div>
  )

  if (banners.length === 0) return null

  return (
    <div className="relative group w-full max-w-6xl mx-auto px-4 mt-6">
      <div className="relative w-full aspect-[4/3] sm:aspect-video md:aspect-[21/9] lg:aspect-[3/1] overflow-hidden rounded-2xl shadow-2xl border border-[#4A3B32]/10">

        {/* Imágenes */}
        <div
          className="w-full h-full flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {banners.map((banner) => (
            <div key={banner.id} className="min-w-full h-full relative bg-[#4A3B32]">
              <img
                src={banner.image_url}
                alt={banner.title || 'Promo'}
                className="w-full h-full object-cover object-center opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                {banner.title && (
                  <h2 className="text-[#4A3B32] font-black text-xl sm:text-3xl italic tracking-tighter drop-shadow-lg">
                    {banner.title}
                  </h2>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Flechas — ✅ usan handleManualNav para resetear el timer */}
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={() => handleManualNav(prevSlide)}
            className="absolute top-1/2 left-4 -translate-y-1/2 bg-[#FAF7F2]/50 hover:bg-[#4A3B32] text-[#4A3B32] p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => handleManualNav(nextSlide)}
            className="absolute top-1/2 right-4 -translate-y-1/2 bg-[#FAF7F2]/50 hover:bg-[#4A3B32] text-[#4A3B32] p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Indicadores (Puntitos) — ✅ también resetean el timer */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => handleManualNav(() => setCurrentIndex(index))}
              className={`w-2 h-2 rounded-full transition-all ${currentIndex === index ? 'bg-[#4A3B32] w-6' : 'bg-white/50 hover:bg-white'}`}
            />
          ))}
        </div>

      </div>
    </div>
  )
}