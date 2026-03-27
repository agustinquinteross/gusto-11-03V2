'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// --- COMPONENTES / MODALES ---
import AdminProductForm from '../../components/AdminProductForm'
import AdminGroupForm from '../../components/AdminGroupForm'
import AdminCouponForm from '../../components/AdminCouponForm' 
import AdminBannerForm from '../../components/AdminBannerForm'
import AdminOfferForm from '../../components/AdminOfferForm'
import DashboardMetrics from '@/components/metrics/DashboardMetrics'; 
import AdminCategoryForm from '../../components/AdminCategoryForm'

import { 
  Loader2, Power, LogOut, RefreshCw, ShoppingBag, Utensils, 
  Plus, Trash2, Layers, Ticket, MapPin, Edit, X, Calendar, 
  Hash, Megaphone, Lock, Unlock, CheckCircle, Clock, Truck, 
  MessageCircle, CreditCard, Wallet, AlertCircle, GripVertical, Printer, Zap,
  TrendingUp, Search, FolderPlus, ChevronRight,
  Settings, Save, Phone, LayoutDashboard, Image as ImageIcon, UploadCloud // <-- NUEVOS ICONOS AÑADIDOS
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()

  // --- ESTADOS GLOBALES ---
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('menu') 
  
  // --- LOGIN ---
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // --- ESTADO Y CONFIG DE LA TIENDA ---
  const [storeOpen, setStoreOpen] = useState(true)
  const [updatingStore, setUpdatingStore] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false) // NUEVO: Estado para Sonidos Browser
  
  // NUEVO: Estado para los Ajustes
  const [storeConfig, setStoreConfig] = useState({
    whatsapp_number: '',
    delivery_base_price: 1500,
    delivery_free_base_km: 2,
    delivery_price_per_extra_km: 800,
    logo_url: null,
    hero_bg_url: null,
    use_hero_bg: false
  })
  const [savingConfig, setSavingConfig] = useState(false)

  // --- DATOS ---
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [categories, setCategories] = useState([])
  const [modifierGroups, setModifierGroups] = useState([])
  const [coupons, setCoupons] = useState([])
  const [banners, setBanners] = useState([])
  const [offers, setOffers] = useState([])

  // --- ESTADOS NUEVOS PARA BÚSQUEDA Y FILTROS ---
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todas')

  // --- MODALES ---
  const [showProductModal, setShowProductModal] = useState(false)
  const [productToEdit, setProductToEdit] = useState(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false) 
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupToEdit, setGroupToEdit] = useState(null)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [couponToEdit, setCouponToEdit] = useState(null)
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)

  // --- EXTRAS ---
  const [selectedGroupId, setSelectedGroupId] = useState(null) 
  const [groupOptions, setGroupOptions] = useState([])

  // --- DRAG & DROP ---
  const [draggedOrder, setDraggedOrder] = useState(null)
  const [isDraggingOver, setIsDraggingOver] = useState(null)

  // =========================================
  // 1. INICIALIZACIÓN
  // =========================================


  const loadAllData = async () => {
    setLoading(true)
    try {
        await Promise.all([
            fetchStoreConfig(), fetchCategories(), fetchModifiers(),
            fetchProducts(), fetchOrders(), fetchCoupons(), fetchBanners(), fetchOffers()
        ])
    } catch (error) { console.error("Error cargando datos:", error) }
    setLoading(false)
  }

  // --- ACTUALIZADO: Trae todo de store_config ---
  const fetchStoreConfig = async () => { 
      const { data } = await supabase.from('store_config').select('*').eq('id', 1).single(); 
      if (data) {
          setStoreOpen(data.is_open);
          setStoreConfig(data);
      }
  }

  const toggleStoreStatus = async () => { 
      if(updatingStore) return; 
      setUpdatingStore(true); 
      const newState = !storeOpen; 
      const { error } = await supabase.from('store_config').update({ is_open: newState }).eq('id', 1); 
      if (!error) setStoreOpen(newState); 
      else alert('Error al cambiar estado'); 
      setUpdatingStore(false) 
  }

  // NUEVO: Guardar Ajustes
  const saveConfig = async () => {
      setSavingConfig(true)
      const { error } = await supabase.from('store_config').update({
          whatsapp_number: storeConfig.whatsapp_number,
          delivery_base_price: storeConfig.delivery_base_price,
          delivery_free_base_km: storeConfig.delivery_free_base_km,
          delivery_price_per_extra_km: storeConfig.delivery_price_per_extra_km,
          logo_url: storeConfig.logo_url,
          hero_bg_url: storeConfig.hero_bg_url,
          use_hero_bg: storeConfig.use_hero_bg
      }).eq('id', 1)
      
      if (error) alert('Error al guardar: ' + error.message)
      else alert('✅ Configuración guardada correctamente')
      setSavingConfig(false)
  }

  // --- SUBIDA DE IMAGENES DE CONFIG ---
  const handleUploadImage = async (e, field) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${field}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      setSavingConfig(true); 

      const { error: uploadError } = await supabase.storage
          .from('banners')
          .upload(filePath, file);

      if (uploadError) {
          alert('Error al subir imagen: ' + uploadError.message);
          setSavingConfig(false);
          return;
      }

      const { data } = supabase.storage.from('banners').getPublicUrl(filePath);
      
      setStoreConfig(prev => ({ ...prev, [field]: data.publicUrl }));
      setSavingConfig(false);
  }
  
  const handleRemoveImage = (field) => {
      setStoreConfig(prev => ({ ...prev, [field]: null }));
  }

  // --- FETCHS ---
  const fetchProducts = async () => { const { data } = await supabase.from('products').select('*, categories(name), special_offers(id, title, type, discount_value, is_active)').order('id'); setProducts(data || []) }
  const fetchOrders = async () => { const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }); setOrders(data || []) }
  const fetchCategories = async () => { const { data } = await supabase.from('categories').select('*').order('id'); setCategories(data || []) }
  const fetchModifiers = async () => { const { data } = await supabase.from('modifier_groups').select('*').order('id'); setModifierGroups(data || []) }
  const fetchCoupons = async () => { const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); setCoupons(data || []) }
  const fetchBanners = async () => { const { data } = await supabase.from('banners').select('*').order('id', { ascending: false }); setBanners(data || []) }
  const fetchOffers = async () => { const { data } = await supabase.from('special_offers').select('*').order('id', { ascending: false }); setOffers(data || []) }
  const fetchGroupOptions = async (groupId) => { const { data } = await supabase.from('modifier_options').select('*').eq('group_id', groupId).order('id'); setGroupOptions(data || []); setSelectedGroupId(groupId) }

  // =========================================
  // 1. INICIALIZACIÓN (Mover useEffect aquí para evitar Hoisting)
  // =========================================
  useEffect(() => {
    // 🔥 FORZAR LOGIN FRESCO: Cerramos cualquier sesión previa al cargar para que siempre pida datos
    const forceFreshLogin = async () => {
      await supabase.auth.signOut()
      setLoading(false)
    }
    forceFreshLogin()

    // CANAL DE TIEMPO REAL: ESCUCHANDO NUEVOS PEDIDOS (Solo INSERT)
    const channel = supabase
      .channel('admin_realtime_orders') 
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, 
        (payload) => {
          console.log("¡Nuevo pedido entrado por WebSocket!", payload)
          // 1. Refrescar la base de datos de órdenes
          fetchOrders()
          
          // 2. Tocar campana en la caja vía DOM Element
          try {
             const audioEl = document.getElementById('order-alert-sound');
             if (audioEl) {
                 audioEl.currentTime = 0;
                 audioEl.play().catch(e => console.warn('Políticas del navegador bloquearon el autoplay del audio:', e))
             }
          } catch(e) { console.error(e) }

          // 3. (Opcional) Notificación visible en pantalla si estás fuera del tab
          if (typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === "granted") {
                  new Notification("Gustó | ¡NUEVO PEDIDO!", { body: `Ingresó un pedido de ${payload.new.customer_name} por $${payload.new.total}` })
              }
          }
        }
      )
      .subscribe((status, err) => {
        console.log("WebSocket Status:", status);
        if (err) console.error("WebSocket Error:", err);
      })

    return () => { 
       console.log("Desmontando escucha de WebSockets...");
       supabase.removeChannel(channel) 
    }
  }, [])

  // =========================================
  // 🖨️ IMPRESIÓN OPTIMIZADA PARA 80MM
  // =========================================
  const printOrder = (order) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const date = new Date(order.created_at).toLocaleString('es-AR');
    const doc = iframe.contentWindow.document;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Ticket #${order.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');
            @page { size: 80mm auto; margin: 0; }
            body { width: 72mm; margin: 0 auto; padding: 5px; font-family: 'Roboto Mono', 'Courier New', monospace; font-size: 12px; line-height: 1.2; color: #000; background: #fff; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            h1 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
            h2 { margin: 5px 0; font-size: 16px; }
            .big-type { font-size: 16px; font-weight: 900; text-align: center; border: 2px solid #000; padding: 5px; margin: 10px 0; border-radius: 0; text-transform: uppercase; }
            .info { margin-bottom: 10px; font-size: 12px; }
            .info p { margin: 3px 0; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { text-align: left; border-bottom: 2px solid #000; font-size: 12px; padding-bottom: 2px; }
            td { padding: 5px 0; vertical-align: top; border-bottom: 1px dotted #ccc; }
            .col-qty { width: 10%; font-weight: bold; font-size: 13px; }
            .col-prod { width: 65%; }
            .col-price { width: 25%; text-align: right; font-weight: bold; }
            .extras { font-size: 10px; color: #333; display: block; margin-top: 2px; }
            .note { display: block; font-size: 11px; font-weight: bold; background: #000; color: #fff; padding: 2px 4px; margin-top: 3px; border-radius: 2px; }
            .totals { border-top: 2px dashed #000; padding-top: 5px; margin-top: 5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
            .total-final { font-size: 22px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px solid #000; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header"><h1>GUSTO</h1><p>Catamarca, Argentina</p><p>${date}</p><h2>PEDIDO #${order.id}</h2></div>
          <div class="big-type">${order.delivery_method === 'delivery' ? '🛵 DELIVERY' : '🏪 RETIRO'}</div>
          <div class="info">
            <p><span class="bold">Cliente:</span> ${order.customer_name}</p>
            <p><span class="bold">Tel:</span> ${order.customer_phone}</p>
            ${order.delivery_method === 'delivery' ? `<p><span class="bold">Dirección:</span> ${order.customer_address}</p>` : ''}
            <p><span class="bold">Pago:</span> ${order.payment_method ? order.payment_method.toUpperCase() : 'EFECTIVO'}</p>
          </div>
          <table><thead><tr><th class="col-qty">Cnt</th><th class="col-prod">Producto</th><th class="col-price">Total</th></tr></thead><tbody>
            ${order.order_items.map(item => `<tr><td class="col-qty">${item.quantity}</td><td class="col-prod"><div class="bold">${item.product_name}</div>${item.options ? `<span class="extras">+ ${item.options}</span>` : ''}${item.note ? `<span class="note">NOTA: ${item.note}</span>` : ''}</td><td class="col-price">$${item.price * item.quantity}</td></tr>`).join('')}
          </tbody></table>
          <div class="totals">
            <div class="row"><span>Subtotal:</span><span>$${order.total - (order.delivery_method === 'delivery' ? 0 : 0) + (Number(order.discount) || 0)}</span></div>
            ${order.discount > 0 ? `<div class="row"><span>Descuento:</span><span>-$${order.discount}</span></div>` : ''}
            <div class="row total-final"><span>TOTAL:</span><span>$${order.total}</span></div>
          </div>
          <div class="footer"><p>¡Gracias por tu compra!</p><p>www.gusto.com</p></div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    
    setTimeout(() => { if(iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1000);
  }

  // =========================================
  // DRAG & DROP NATIVO
  // =========================================
  const handleDragStart = (e, order) => { setDraggedOrder(order); e.dataTransfer.effectAllowed = "move"; setTimeout(() => { if(e.target) e.target.classList.add('opacity-50', 'scale-95') }, 0) }
  const handleDragEnd = (e) => { if(e.target) e.target.classList.remove('opacity-50', 'scale-95'); setDraggedOrder(null); setIsDraggingOver(null) }
  const handleDragOver = (e, colId) => { e.preventDefault(); if (isDraggingOver !== colId) setIsDraggingOver(colId) }
  const handleDrop = async (e, newStatus) => { e.preventDefault(); setIsDraggingOver(null); if (!draggedOrder || draggedOrder.status === newStatus) return; setOrders(prev => prev.map(o => o.id === draggedOrder.id ? { ...o, status: newStatus } : o)); const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', draggedOrder.id); if (error) { alert('Error al mover pedido'); fetchOrders() } }

  // Botón rápido para avanzar estado
  const STATUS_FLOW = ['pending', 'cooking', 'delivery', 'completed']
  const advanceOrderStatus = async (order) => {
    const currentIndex = STATUS_FLOW.indexOf(order.status)
    if (currentIndex < 0 || currentIndex >= STATUS_FLOW.length - 1) return
    const newStatus = STATUS_FLOW[currentIndex + 1]
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)
    if (error) { alert('Error al cambiar estado'); fetchOrders() }
  }

  const deleteOrder = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este pedido?')) return
    
    // 1. Restaurar Stock antes de borrar
    const orderToRestore = orders.find(o => o.id === id)
    if (orderToRestore && orderToRestore.order_items) {
      for (const item of orderToRestore.order_items) {
        // Buscamos el producto en la lista de productos actual para ver su stock
        const product = products.find(p => p.name === item.product_name)
        if (product && product.stock !== undefined && product.stock !== null) {
          const newStock = Number(product.stock) + Number(item.quantity)
          await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
        }
      }
    }

    // 2. Borrar de base de datos
    await supabase.from('order_items').delete().eq('order_id', id)
    const { error } = await supabase.from('orders').delete().eq('id', id)
    
    if (error) alert('Error al eliminar pedido: ' + error.message)
    else {
      fetchOrders()
      fetchProducts() // Actualizar stock en la UI
    }
  }

  // =========================================
  // ACTIONS
  // =========================================
  const handleLogin = async (e) => { 
    e.preventDefault(); 
    setLoading(true); 
    const { error } = await supabase.auth.signInWithPassword({ email, password }); 
    if (error) {
      alert("Error: " + error.message); 
    } else {
      // ✅ FIX: Tras el login exitoso, solicitamos la nueva sesión y forzamos a React a renderizar el Admin Dashboard
      const { data: { session: newSession } } = await supabase.auth.getSession();
      setSession(newSession);
      loadAllData(); 
    }
    setLoading(false); 
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    router.push('/')
  }
  
  // CRUD
  const handleCreateProduct = () => { setProductToEdit(null); setShowProductModal(true) }
  const handleEditProduct = (p) => { setProductToEdit(p); setShowProductModal(true) }
  
  const deleteProduct = async (id, imageUrl) => { 
      if (!confirm('¿Eliminar producto de forma permanente?')) return; 
      
      // 1. Borrar imagen física si existe
      if (imageUrl) {
          const fileName = imageUrl.split('/').pop();
          await supabase.storage.from('menu-images').remove([fileName]);
      }

      // 2. Borrar de la Base de Datos
      await supabase.from('product_modifiers').delete().eq('product_id', id); 
      const { error } = await supabase.from('products').delete().eq('id', id); 
      if (error) alert('Error de servidor: ' + error.message);
      
      fetchProducts(); 
  }
  
  const toggleActive = async (id, current) => { const {error} = await supabase.from('products').update({ is_active: !current }).eq('id', id); if(error) alert(error.message); fetchProducts() }
  const handleCreateGroup = () => { setGroupToEdit(null); setShowGroupModal(true) }
  const handleEditGroup = (g) => { setGroupToEdit(g); setShowGroupModal(true) }
  const deleteGroup = async (id, e) => { e.stopPropagation(); if(!confirm('¿Borrar grupo?')) return; await supabase.from('modifier_options').delete().eq('group_id', id); const {error} = await supabase.from('modifier_groups').delete().eq('id', id); if(error) alert('Error: ' + error.message); fetchModifiers(); if(selectedGroupId === id) { setSelectedGroupId(null); setGroupOptions([]) } }
  const addOption = async () => { if(!selectedGroupId) return; const { error } = await supabase.from('modifier_options').insert([{ group_id: selectedGroupId, name: 'Nueva Opción', price: 0, is_available: true }]); if(error) alert(error.message); else fetchGroupOptions(selectedGroupId) }
  const updateOption = async (id, field, value) => { setGroupOptions(prev => prev.map(opt => opt.id === id ? { ...opt, [field]: value } : opt)); const {error} = await supabase.from('modifier_options').update({ [field]: value }).eq('id', id); if(error) alert('Error guardando opción'); }
  const deleteOption = async (id) => { if(!confirm('¿Borrar opción?')) return; const {error} = await supabase.from('modifier_options').delete().eq('id', id); if(error) alert(error.message); fetchGroupOptions(selectedGroupId) }
  const handleCreateCoupon = () => { setCouponToEdit(null); setShowCouponModal(true) }
  const handleEditCoupon = (c) => { setCouponToEdit(c); setShowCouponModal(true) }
  const deleteCoupon = async (code) => { if(!confirm('¿Eliminar cupón?')) return; const {error} = await supabase.from('coupons').delete().eq('code', code); if(error) alert(error.message); fetchCoupons() }
  
  // ACTIONS PROMOS
  const deleteBanner = async (id, imageUrl) => { 
      if(!confirm('¿Eliminar banner permanentemente?')) return; 
      
      // 1. Borrar imagen física de Storage para liberar espacio
      if (imageUrl) {
          const fileName = imageUrl.split('/').pop();
          await supabase.storage.from('banners').remove([fileName]);
      }

      // 2. Borrar de Base de Datos
      const { error } = await supabase.from('banners').delete().eq('id', id); 
      if (error) alert('Error al borrar banner: ' + error.message);
      fetchBanners();
  }
  const toggleBannerActive = async (id, current) => { const {error} = await supabase.from('banners').update({ is_active: !current }).eq('id', id); if(error) alert(error.message); fetchBanners() }
  const deleteOffer = async (id) => { 
      if(!confirm('¿Seguro que querés eliminar esta oferta?')) return; 
      await supabase.from('products').update({ offer_id: null }).eq('offer_id', id);
      const { error } = await supabase.from('special_offers').delete().eq('id', id); 
      if (error) alert('Error al eliminar: ' + error.message);
      else { fetchOffers(); fetchProducts(); }
  }
  const toggleOfferActive = async (id, current) => { await supabase.from('special_offers').update({ is_active: !current }).eq('id', id); fetchOffers() }

  if (!session) return <LoginScreen email={email} setEmail={setEmail} password={password} setPassword={setPassword} handleLogin={handleLogin} loading={loading} />

  // --- LÓGICA DE FILTRADO PARA PRODUCTOS ---
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || p.categories?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // --- TARJETA PEDIDO ---
  const OrderCard = ({ order }) => (
      <div 
        draggable="true"
        onDragStart={(e) => handleDragStart(e, order)}
        onDragEnd={handleDragEnd}
        className="bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-3 shadow-sm hover:border-[#4A3B32]/40 transition-all mb-3 flex flex-col gap-2 group cursor-grab active:cursor-grabbing hover:shadow-md hover:translate-y-[-2px] select-none relative"
      >
          <div className="flex justify-between items-start border-b border-[#4A3B32]/10 pb-2 pointer-events-none">
             <div className="flex items-center gap-2"><GripVertical size={16} className="text-[#4A3B32]/50 group-hover:text-[#4A3B32]/70 transition-colors"/><div><span className="font-black text-[#4A3B32] text-lg">#{order.id}</span><p className="text-xs text-[#4A3B32]/70 font-bold uppercase truncate max-w-[120px]">{order.customer_name}</p></div></div>
              <div className="flex flex-col items-end gap-1 pointer-events-auto">
                <div className="flex gap-1">
                  <button onClick={() => deleteOrder(order.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded transition mb-1" title="Eliminar"><Trash2 size={14} /></button>
                  <button onClick={() => printOrder(order)} className="p-1.5 bg-[#4A3B32]/5 hover:bg-[#4A3B32]/10 text-[#4A3B32]/70 hover:text-[#4A3B32] rounded transition mb-1" title="Imprimir"><Printer size={14} /></button>
                </div>
                <div className="flex items-center gap-1.5"><span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${order.delivery_method === 'delivery' ? 'bg-[#4A3B32] text-[#FAF7F2] shadow-sm' : 'bg-white text-[#4A3B32] border border-[#4A3B32]/30 shadow-sm'}`}>{order.delivery_method === 'delivery' ? 'Delivery' : 'Retiro'}</span>{order.status !== 'completed' && (<button onClick={(e) => { e.stopPropagation(); advanceOrderStatus(order) }} className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wide transition-all active:scale-95 flex items-center gap-1 ${
              order.status === 'pending' ? 'bg-red-500 text-white' :
              order.status === 'cooking' ? 'bg-blue-500 text-white' :
              'bg-green-500 text-white'
            }`}><ChevronRight size={10} />{order.status === 'pending' ? 'Cocina' : order.status === 'cooking' ? 'Enviar' : 'Listo'}</button>)}</div></div>
          </div>
          <div className="space-y-2 py-1 pointer-events-none">{order.order_items.map(item => (<div key={item.id} className="text-sm leading-tight"><div className="flex gap-2"><span className="text-red-500 font-bold">{item.quantity}x</span> <span className="text-[#4A3B32]/90">{item.product_name}</span></div>{item.options && <p className="text-[10px] text-[#4A3B32]/60 ml-6 line-clamp-1">+ {item.options}</p>}{item.note && <p className="text-[10px] text-yellow-500 ml-6 italic bg-yellow-900/10 px-1.5 py-0.5 rounded inline-block mt-0.5 border border-yellow-900/20">📝 {item.note}</p>}</div>))}</div>
          <div className="pt-2 mt-auto border-t border-[#4A3B32]/10 pointer-events-none"><div className="flex justify-between items-center mb-2"><span className="text-xs text-[#4A3B32]/70 font-medium flex items-center gap-1 uppercase">{order.payment_method === 'mercadopago' ? <CreditCard size={12} className="text-sky-400"/> : <Wallet size={12} className="text-green-500"/>}{order.payment_method || 'Efectivo'}</span><span className="text-lg font-black text-[#4A3B32]">${order.total}</span></div>{order.delivery_method === 'delivery' && (<div className="text-[10px] text-[#4A3B32]/70 mb-2 flex items-start gap-1 bg-white p-1.5 rounded"><MapPin size={10} className="mt-0.5 text-red-500"/> <span className="line-clamp-2">{order.customer_address}</span></div>)}</div>
      </div>
  )

  // --- RENDER PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#FAF7F2] font-sans text-[#4A3B32]/90 flex flex-col h-screen overflow-hidden">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-[#4A3B32]/10 p-4 shrink-0 flex justify-between items-center z-40 shadow-sm">
        <div className="flex items-center gap-1 shrink-0">
          <img src="/logo.png" alt="Gustó Admin" className="h-16 w-auto hidden sm:block object-contain drop-shadow-sm" />
          <img src="/logo.png" alt="GA" className="h-8 w-auto sm:hidden object-contain drop-shadow-sm" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar sm:gap-4 flex-1 justify-end py-1">
          <audio id="order-alert-sound" src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_3d1da9ac74.mp3?filename=cash-register-kaching-93513.mp3" preload="auto"></audio>
          
          <button onClick={() => {
              if (!soundEnabled) {
                 setSoundEnabled(true);
                 const audioEl = document.getElementById('order-alert-sound');
                 if (audioEl) { 
                     audioEl.volume = 0;
                     audioEl.play().then(() => { audioEl.pause(); audioEl.volume = 1; }).catch(()=>{}); 
                 }
                 if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== "granted") {
                     Notification.requestPermission();
                 }
              } else {
                 setSoundEnabled(false);
              }
          }} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider transition-all shadow-sm ${soundEnabled ? 'bg-green-600 text-[#FAF7F2]' : 'bg-red-500 text-white shadow-red-200'}`}>
             {soundEnabled ? '🔔 ON' : '🔕 SONIDO'}
          </button>

          <button onClick={toggleStoreStatus} disabled={updatingStore} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider transition-all shadow-sm ${storeOpen ? 'bg-green-600 text-[#FAF7F2]' : 'bg-[#4A3B32] text-[#FAF7F2]'}`}>
            {storeOpen ? <Unlock size={12}/> : <Lock size={12}/>}
            {storeOpen ? 'ABIERTO' : 'CERRADO'}
          </button>

          <div className="flex bg-[#4A3B32]/5 rounded-lg p-1 shrink-0 gap-0.5 border border-[#4A3B32]/10 shadow-inner">
             {[
               {id:'orders',icon:ShoppingBag},
               {id:'menu',icon:Utensils},
               {id:'extras',icon:Layers},
               {id:'coupons',icon:Ticket},
               {id:'promos',icon:Megaphone},
               {id:'metrics',icon:TrendingUp},
               {id:'settings',icon:Settings}
             ].map(t => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={`p-2 rounded transition-all active:scale-90 ${activeTab === t.id ? 'bg-white text-[#4A3B32] shadow-sm' : 'text-[#4A3B32]/60 hover:text-[#4A3B32]'}`}><t.icon size={16}/></button>))}
             <div className="w-px h-6 bg-[#4A3B32]/10 mx-1 self-center"></div>
             <button onClick={handleLogout} className="p-2 text-[#4A3B32]/40 hover:text-red-500 transition-colors"><LogOut size={16}/></button>
          </div>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-hidden relative">
        
        {/* KANBAN PEDIDOS */}
        {activeTab === 'orders' && (
          <div className="h-full p-4 overflow-x-auto">
             <div className="flex gap-4 h-full min-w-[1000px] md:min-w-0">
                 {[{id:'pending',label:'PENDIENTES',color:'yellow',icon:Clock},{id:'cooking',label:'COCINA',color:'red',icon:Utensils},{id:'delivery',label:'EN CAMINO',color:'blue',icon:Truck},{id:'completed',label:'LISTOS',color:'green',icon:CheckCircle}].map(col => (
                     <div key={col.id} onDragOver={(e) => handleDragOver(e, col.id)} onDrop={(e) => handleDrop(e, col.id)} className={`flex-1 flex flex-col rounded-xl border h-full transition-colors duration-200 ${isDraggingOver === col.id ? 'bg-[#4A3B32]/5/80 border-gray-500 ring-2 ring-inset ring-gray-600' : 'bg-white/50 border-[#4A3B32]/10'}`}>
                         <div className={`p-3 border-b rounded-t-xl flex justify-between items-center ${col.color==='yellow'?'border-yellow-900/30 bg-yellow-900/10 text-yellow-500':col.color==='red'?'border-red-900/30 bg-red-900/10 text-red-500':col.color==='blue'?'border-blue-900/30 bg-blue-900/10 text-blue-400':'border-green-900/30 bg-green-900/10 text-green-600'}`}>
                             <h3 className="font-black flex items-center gap-2"><col.icon size={16}/> {col.label}</h3><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FAF7F2]/50 border border-white/10 text-[#4A3B32]">{orders.filter(o => o.status === col.id).length}</span>
                         </div>
                         <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                             {orders.filter(o => o.status === col.id).map(order => <OrderCard key={order.id} order={order} />)}
                             {orders.filter(o => o.status === col.id).length === 0 && !isDraggingOver && (<div className="h-full flex items-center justify-center text-[#4A3B32]/40 text-sm opacity-50 font-bold tracking-widest uppercase select-none">Vacío</div>)}
                         </div>
                     </div>
                 ))}
             </div>
          </div>
        )}

        {/* --- PESTAÑA: REPORTES (METRICS) --- */}
        {activeTab === 'metrics' && (
          <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <DashboardMetrics />
          </div>
        )}

        {/* --- PESTAÑA: MENU --- */}
        {activeTab === 'menu' && (
           <div className="h-full overflow-y-auto p-4 custom-scrollbar pb-20">
               <div className="space-y-6 max-w-7xl mx-auto">
                   
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-[#4A3B32]/10">
                       <div className="flex flex-1 w-full md:w-auto gap-3">
                           <div className="relative flex-1 max-w-sm">
                               <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A3B32]/60" />
                               <input 
                                   type="text" 
                                   placeholder="Buscar producto..." 
                                   value={searchTerm}
                                   onChange={(e) => setSearchTerm(e.target.value)}
                                   className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg py-2 pl-10 pr-3 text-[#4A3B32] text-sm outline-none focus:border-red-600 transition-colors placeholder:text-[#4A3B32]/50"
                               />
                           </div>
                           <select 
                               value={selectedCategory}
                               onChange={(e) => setSelectedCategory(e.target.value)}
                               className="bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg px-3 py-2 text-[#4A3B32] text-sm outline-none focus:border-red-600"
                           >
                               <option value="Todas">Todas las Categorías</option>
                               {categories.map(cat => (
                                   <option key={cat.id} value={cat.name}>{cat.name}</option>
                               ))}
                           </select>
                       </div>

                       <div className="flex w-full md:w-auto gap-3">
                           <button onClick={() => setShowCategoryModal(true)} className="flex-1 md:flex-none bg-[#4A3B32]/5 hover:bg-[#4A3B32]/10 text-[#4A3B32] px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 border border-[#4A3B32]/20 transition text-sm">
                               <FolderPlus size={16}/> CATEGORÍAS
                           </button>
                           <button onClick={handleCreateProduct} className="flex-1 md:flex-none bg-[#4A3B32] hover:bg-black text-[#FAF7F2] px-5 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#4A3B32]/20 transition text-sm">
                               <Plus size={18}/> NUEVO PRODUCTO
                           </button>
                       </div>
                   </div>

                   {filteredProducts.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-20 text-[#4A3B32]/60 border-2 border-dashed border-[#4A3B32]/10 rounded-2xl">
                           <Utensils size={48} className="opacity-20 mb-4"/>
                           <p className="font-bold uppercase tracking-widest text-sm">No se encontraron productos</p>
                       </div>
                   ) : (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                           {filteredProducts.map(p => (
                               <div key={p.id} className={`bg-white border border-[#4A3B32]/10 rounded-xl overflow-hidden flex flex-col transition hover:border-[#4A3B32]/30 ${!p.is_active ? 'opacity-60 grayscale' : ''}`}>
                                   <div className="flex p-4 gap-3">
                                       <div className="w-20 h-20 bg-[#FAF7F2] rounded-lg overflow-hidden shrink-0 border border-[#4A3B32]/10">
                                           {p.image_url ? 
                                               <img src={p.image_url} alt={p.name} className="w-full h-full object-cover"/> 
                                               : 
                                               <div className="flex items-center justify-center h-full text-2xl">🍔</div>
                                           }
                                       </div>
                                       <div className="flex flex-col justify-between overflow-hidden">
                                           <div>
                                               <h3 className="font-bold text-[#4A3B32] text-base leading-tight truncate" title={p.name}>{p.name}</h3>
                                               <p className="text-xs text-red-500 font-black mt-0.5">{p.categories?.name}</p>
                                           </div>
                                           <p className="text-lg font-black text-[#4A3B32]">${p.price}</p>
                                       </div>
                                   </div>
                                   
                                   <div className="bg-[#FAF7F2] border-t border-[#4A3B32]/10 p-2 flex justify-between items-center mt-auto">
                                       <button 
                                           onClick={() => toggleActive(p.id, p.is_active)} 
                                           className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${p.is_active ? 'bg-green-900/20 text-green-500 hover:bg-green-900/40' : 'bg-[#4A3B32]/5 text-[#4A3B32]/60 hover:text-[#4A3B32]'}`}
                                       >
                                           <Power size={14} /> {p.is_active ? 'Activo' : 'Oculto'}
                                       </button>
                                       
                                       <div className="flex gap-1">
                                           <button onClick={() => handleEditProduct(p)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition"><Edit size={16}/></button>
                                           <button onClick={() => deleteProduct(p.id, p.image_url)} className="p-2 text-red-500 hover:bg-red-900/30 rounded-lg transition"><Trash2 size={16}/></button>
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
           </div>
        )}

        {/* --- PESTAÑA: EXTRAS --- */}
        {activeTab === 'extras' && (
           <div className="h-full overflow-y-auto p-4 custom-scrollbar pb-20"><div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto"><div className="bg-white rounded-xl border border-[#4A3B32]/10 flex flex-col overflow-hidden h-[600px]"><div className="p-4 border-b border-[#4A3B32]/10 flex justify-between items-center bg-[#4A3B32]/5/50"><h3 className="font-bold text-[#4A3B32] flex items-center gap-2"><Layers size={18}/> GRUPOS</h3><button onClick={handleCreateGroup} className="text-xs bg-[#4A3B32] text-[#FAF7F2] px-3 py-2 rounded font-bold flex gap-1 hover:bg-black transition"><Plus size={14}/> NUEVO</button></div><div className="p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">{modifierGroups.map(g => (<div key={g.id} onClick={() => fetchGroupOptions(g.id)} className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center transition group ${selectedGroupId === g.id ? 'bg-red-900/20 border-red-600 ring-1 ring-red-600' : 'bg-[#FAF7F2] border-[#4A3B32]/10 hover:border-[#4A3B32]/30'}`}><div><span className={`font-bold text-sm block ${selectedGroupId === g.id ? 'text-[#4A3B32]' : 'text-[#4A3B32]/80'}`}>{g.name}</span><div className="flex gap-2 mt-1"><span className="text-[10px] bg-[#4A3B32]/5 px-2 py-0.5 rounded text-[#4A3B32]/70 border border-[#4A3B32]/20">{g.min_selection === 1 && g.max_selection === 1 ? 'Radio (1)' : `Multi (Máx ${g.max_selection})`}</span>{g.min_selection > 0 && <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded font-bold">Obligatorio</span>}</div></div><div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); handleEditGroup(g) }} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded"><Edit size={14}/></button><button onClick={(e) => deleteGroup(g.id, e)} className="p-2 text-red-500 hover:bg-red-900/30 rounded"><Trash2 size={14}/></button></div></div>))}</div></div><div className="bg-white rounded-xl border border-[#4A3B32]/10 flex flex-col overflow-hidden h-[600px]"><div className="p-4 border-b border-[#4A3B32]/10 flex justify-between items-center bg-[#4A3B32]/5/50"><h3 className="font-bold text-[#4A3B32] flex items-center gap-2"><Utensils size={18}/> OPCIONES</h3>{selectedGroupId && <button onClick={addOption} className="text-xs bg-green-600 text-[#4A3B32] px-3 py-2 rounded font-bold flex gap-1 hover:bg-green-500 transition"><Plus size={14}/> AGREGAR</button>}</div><div className="p-4 overflow-y-auto flex-1 custom-scrollbar">{!selectedGroupId ? <div className="h-full flex flex-col items-center justify-center text-[#4A3B32]/50 space-y-2"><Layers size={40} className="opacity-20"/><p className="text-sm">Selecciona un grupo para ver opciones</p></div> : <div className="space-y-2">{groupOptions.map(opt => (<div key={opt.id} className="flex gap-3 items-center bg-[#FAF7F2] p-3 rounded-xl border border-[#4A3B32]/10 hover:border-[#4A3B32]/30 transition group"><div className="flex-1"><input className="bg-transparent text-[#4A3B32] text-sm font-medium w-full outline-none placeholder-gray-600 focus:text-red-500 transition-colors" defaultValue={opt.name} onBlur={(e) => updateOption(opt.id, 'name', e.target.value)} /></div><div className="flex items-center bg-white rounded-lg px-3 py-1.5 border border-[#4A3B32]/20 focus-within:border-yellow-500"><span className="text-xs text-[#4A3B32]/60 mr-1">$</span><input className="bg-transparent text-yellow-500 text-sm font-bold w-14 text-right outline-none" type="number" defaultValue={opt.price} onBlur={(e) => updateOption(opt.id, 'price', e.target.value)} /></div><button onClick={() => updateOption(opt.id, 'is_available', !opt.is_available)} className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase w-20 text-center border transition-all ${opt.is_available ? 'border-green-600 text-green-500 bg-green-900/20 hover:bg-green-900/30' : 'border-red-800 text-red-500 bg-red-900/20 hover:bg-red-900/30 line-through decoration-red-500'}`}>{opt.is_available ? 'EN STOCK' : 'AGOTADO'}</button><button onClick={() => deleteOption(opt.id)} className="text-[#4A3B32]/50 hover:text-red-500 p-1.5 hover:bg-red-900/20 rounded transition"><Trash2 size={16}/></button></div>))}</div>}</div></div></div></div>
        )}

        {/* --- PESTAÑA: CUPONES --- */}
        {activeTab === 'coupons' && (
           <div className="h-full overflow-y-auto p-4 custom-scrollbar pb-20"><div className="bg-white rounded-xl border border-[#4A3B32]/10 p-4 max-w-4xl mx-auto"><div className="flex justify-end mb-4"><button onClick={handleCreateCoupon} className="bg-[#4A3B32] hover:bg-black text-[#FAF7F2] px-3 py-2 rounded text-xs font-bold flex gap-2 transition shadow-lg shadow-[#4A3B32]/20"><Plus size={14}/> NUEVO CUPÓN</button></div><div className="grid gap-3">{coupons.map(c => { const isExpired = c.expires_at && new Date(c.expires_at) < new Date(); const isSoldOut = c.usage_limit && c.times_used >= c.usage_limit; const isActive = !isExpired && !isSoldOut; const statusColor = isActive ? 'text-green-500' : 'text-red-500'; return (<div key={c.code} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#FAF7F2] border ${isActive ? 'border-[#4A3B32]/10' : 'border-red-900/30 bg-red-900/5'} p-4 rounded-xl transition`}><div><div className="flex items-center gap-3"><span className={`font-black tracking-widest text-lg ${statusColor}`}>{c.code}</span>{!isActive && (<span className="text-[10px] bg-red-900/30 text-red-500 px-2 py-0.5 rounded border border-red-900/50 font-bold">{isExpired ? 'VENCIDO' : 'AGOTADO'}</span>)}</div><div className="text-xs text-[#4A3B32]/60 mt-2 flex flex-wrap gap-4 font-medium"><span className="flex items-center gap-1"><Ticket size={12}/> {c.discount_type === 'percent' ? `${c.value}% OFF` : `$${c.value} OFF`}</span>{c.usage_limit && <span className="flex items-center gap-1"><Hash size={12}/> {c.times_used} / {c.usage_limit} Usos</span>}{c.expires_at && <span className="flex items-center gap-1"><Calendar size={12}/> Vence: {new Date(c.expires_at).toLocaleDateString()}</span>}</div></div><div className="flex gap-2 mt-4 sm:mt-0"><button onClick={() => handleEditCoupon(c)} className="p-2 text-blue-500 hover:bg-blue-900/20 rounded border border-transparent hover:border-blue-900/30 transition"><Edit size={16}/></button><button onClick={() => deleteCoupon(c.code)} className="p-2 text-red-500 hover:bg-red-900/20 rounded border border-transparent hover:border-red-900/30 transition"><Trash2 size={16}/></button></div></div>) })}</div></div></div>
        )}

        {/* --- PESTAÑA: PROMOS --- */}
        {activeTab === 'promos' && (
           <div className="h-full overflow-y-auto p-4 custom-scrollbar pb-20">
               <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                   
                   <div className="bg-white rounded-xl border border-[#4A3B32]/10 p-4">
                       <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-[#4A3B32] flex items-center gap-2"><Megaphone size={18}/> BANNERS PRINCIPALES</h3><button onClick={() => setShowBannerModal(true)} className="bg-blue-600 hover:bg-blue-700 text-[#4A3B32] px-3 py-1.5 rounded text-xs font-bold flex gap-2"><Plus size={14}/> SUBIR</button></div>
                       <div className="grid gap-4">
                           {banners.map(b => (<div key={b.id} className={`group relative bg-[#FAF7F2] border rounded-xl overflow-hidden transition ${b.is_active ? 'border-[#4A3B32]/10' : 'border-red-900/50 opacity-70 grayscale'}`}><div className="aspect-video w-full relative"><img src={b.image_url} alt="Banner" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-[#FAF7F2]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 gap-4"><button onClick={() => deleteBanner(b.id, b.image_url)} className="bg-white text-red-500 hover:text-red-700 hover:bg-gray-100 border disabled:opacity-50 border-[#4A3B32]/20 p-3 rounded-full hover:scale-110 shadow-xl transition cursor-pointer z-10"><Trash2 size={20}/></button></div></div><div className="p-3 flex justify-between items-center border-t border-[#4A3B32]/10"><span className="font-bold text-sm text-[#4A3B32]/80 truncate pr-4">{b.title || 'Sin Título'}</span><button onClick={() => toggleBannerActive(b.id, b.is_active)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${b.is_active ? 'border-green-800 bg-green-900/20 text-green-500' : 'border-[#4A3B32]/20 bg-[#4A3B32]/5 text-[#4A3B32]/60'}`}>{b.is_active ? 'VISIBLE' : 'OCULTO'}</button></div></div>))}
                           {banners.length === 0 && <p className="text-center text-[#4A3B32]/50 py-10">Sin banners.</p>}
                       </div>
                   </div>

                   <div className="bg-white rounded-xl border border-[#4A3B32]/10 p-4">
                       <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-[#4A3B32] flex items-center gap-2"><Zap size={18} className="text-yellow-500"/> OFERTAS RELÁMPAGO</h3><button onClick={() => setShowOfferModal(true)} className="bg-yellow-600 hover:bg-yellow-700 text-[#4A3B32] px-3 py-1.5 rounded text-xs font-bold flex gap-2"><Plus size={14}/> CREAR</button></div>
                       <div className="space-y-3">
                           {offers.map(offer => (
                               <div key={offer.id} className={`flex justify-between items-center bg-[#FAF7F2] border p-3 rounded-xl transition ${offer.is_active ? 'border-[#4A3B32]/20' : 'border-red-900/30 bg-red-900/5'}`}>
                                   <div className="flex items-center gap-3">
                                       <div className={`w-12 h-12 flex items-center justify-center rounded-lg font-black text-xs text-center leading-none p-1 ${offer.type==='2x1'?'bg-[#4A3B32] text-[#FAF7F2]':offer.type==='50off'?'bg-blue-600 text-[#4A3B32]':'bg-purple-600 text-[#4A3B32]'}`}>{offer.discount_value}</div>
                                       <div><h4 className={`font-bold text-sm ${offer.is_active?'text-[#4A3B32]':'text-[#4A3B32]/60'}`}>{offer.title}</h4><p className="text-xs text-[#4A3B32]/60">{offer.description}</p></div>
                                   </div>
                                   <div className="flex gap-2">
                                       <button onClick={() => toggleOfferActive(offer.id, offer.is_active)} className={`p-1.5 rounded border ${offer.is_active ? 'border-green-900 bg-green-900/20 text-green-500' : 'border-[#4A3B32]/20 bg-[#4A3B32]/5 text-[#4A3B32]/60'}`}><Power size={14}/></button>
                                       <button onClick={() => deleteOffer(offer.id)} className="p-1.5 text-red-500 hover:bg-red-900/20 rounded border border-transparent hover:border-red-900/30"><Trash2 size={14}/></button>
                                   </div>
                               </div>
                           ))}
                           {offers.length === 0 && <p className="text-center text-[#4A3B32]/50 py-10">Sin ofertas activas.</p>}
                       </div>
                   </div>

               </div>
           </div>
        )}

        {/* --- PESTAÑA: AJUSTES (NUEVA) --- */}
        {activeTab === 'settings' && (
           <div className="h-full overflow-y-auto p-4 custom-scrollbar pb-20">
               <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#4A3B32]/10 overflow-hidden">
                   <div className="p-4 bg-[#4A3B32]/5/50 border-b border-[#4A3B32]/10 flex justify-between items-center">
                       <h2 className="font-black text-[#4A3B32] text-lg flex items-center gap-2"><Settings size={20}/> AJUSTES DEL LOCAL</h2>
                   </div>
                   
                   <div className="p-6 space-y-8">
                       <div className="space-y-4">
                           <h3 className="text-sm font-bold text-[#4A3B32]/70 uppercase tracking-widest flex items-center gap-2"><Phone size={16}/> Contacto</h3>
                           <div>
                               <label className="block text-xs font-bold text-[#4A3B32]/60 mb-1">Número de WhatsApp (Con código de país, sin el +)</label>
                               <input type="text" className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-3 text-[#4A3B32] focus:border-red-500 outline-none" 
                                      value={storeConfig.whatsapp_number || ''} onChange={e => setStoreConfig({...storeConfig, whatsapp_number: e.target.value})} placeholder="Ej: 5493834123456" />
                           </div>
                       </div>

                       <div className="space-y-4">
                           <h3 className="text-sm font-bold text-[#4A3B32]/70 uppercase tracking-widest flex items-center gap-2"><MapPin size={16}/> Calculadora de Envíos (GPS)</h3>
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               <div>
                                   <label className="block text-xs font-bold text-[#4A3B32]/60 mb-1">Precio Base ($)</label>
                                   <input type="number" className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-3 text-[#4A3B32] focus:border-red-500 outline-none" 
                                          value={storeConfig.delivery_base_price || ''} onChange={e => setStoreConfig({...storeConfig, delivery_base_price: e.target.value})} />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-[#4A3B32]/60 mb-1">KM Incluidos</label>
                                   <input type="number" step="0.1" className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-3 text-[#4A3B32] focus:border-red-500 outline-none" 
                                          value={storeConfig.delivery_free_base_km || ''} onChange={e => setStoreConfig({...storeConfig, delivery_free_base_km: e.target.value})} />
                               </div>
                               <div>
                                   <label className="block text-xs font-bold text-[#4A3B32]/60 mb-1">Costo x KM Extra ($)</label>
                                   <input type="number" className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-3 text-[#4A3B32] focus:border-red-500 outline-none" 
                                          value={storeConfig.delivery_price_per_extra_km || ''} onChange={e => setStoreConfig({...storeConfig, delivery_price_per_extra_km: e.target.value})} />
                               </div>
                           </div>
                           <p className="text-xs text-[#4A3B32]/60 italic bg-[#4A3B32]/5/50 p-3 rounded-lg border border-[#4A3B32]/20">
                               Ejemplo: El envío sale <strong>${storeConfig.delivery_base_price}</strong> hasta los <strong>{storeConfig.delivery_free_base_km} kilómetros</strong>. Si el cliente vive más lejos, se le suman <strong>${storeConfig.delivery_price_per_extra_km}</strong> por cada kilómetro adicional.
                           </p>
                       </div>

                   </div>

                   <div className="p-4 bg-[#4A3B32]/5/30 border-t border-[#4A3B32]/10 flex justify-end">
                       <button onClick={saveConfig} disabled={savingConfig} className="bg-green-600 hover:bg-green-500 text-[#4A3B32] px-6 py-3 rounded-xl font-black flex items-center gap-2 transition-all shadow-lg shadow-green-900/20 disabled:opacity-50">
                           {savingConfig ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> GUARDAR CAMBIOS</>}
                       </button>
                   </div>
               </div>
           </div>
        )}

      </main>

      {/* MODALES */}
      {showCategoryModal && <AdminCategoryForm onCancel={() => setShowCategoryModal(false)} onSaved={() => { fetchCategories(); fetchProducts(); }} />}
      {showProductModal && <AdminProductForm productToEdit={productToEdit} onCancel={() => setShowProductModal(false)} onSaved={() => { setShowProductModal(false); fetchProducts() }} />}
      {showGroupModal && <AdminGroupForm groupToEdit={groupToEdit} onCancel={() => setShowGroupModal(false)} onSaved={() => { setShowGroupModal(false); fetchModifiers() }} />}
      {showCouponModal && <AdminCouponForm couponToEdit={couponToEdit} onCancel={() => setShowCouponModal(false)} onSaved={() => { setShowCouponModal(false); fetchCoupons() }} />}
      {showBannerModal && <AdminBannerForm onCancel={() => setShowBannerModal(false)} onSaved={() => { setShowBannerModal(false); fetchBanners() }} />}
      {showOfferModal && <AdminOfferForm onCancel={() => setShowOfferModal(false)} onSaved={() => { setShowOfferModal(false); fetchOffers() }} />}

    </div>
  )
}

function LoginScreen({ email, setEmail, password, setPassword, handleLogin, loading }) {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="relative bg-white border border-[#4A3B32]/10 p-8 pt-16 rounded-2xl w-full max-w-md shadow-xl mt-16">
        {/* LOGO FLOTANTE REDONDO */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-white rounded-full border border-[#4A3B32]/10 shadow-lg flex items-center justify-center p-3">
            <img src="/logo.png" alt="Gustó" className="w-full h-full object-contain drop-shadow-sm" />
        </div>

        <h1 className="text-xl font-black text-center mb-8 text-[#4A3B32] uppercase tracking-widest">
          Acceso Seguro
        </h1>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#4A3B32]/60 mb-1 ml-1 uppercase tracking-widest">Email</label>
            <input 
              type="email" 
              placeholder="admin@gusto.com" 
              className="w-full p-4 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] transition" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#4A3B32]/60 mb-1 ml-1 uppercase tracking-widest">Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-4 bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl text-[#4A3B32] outline-none focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373] transition" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>
          <button 
            onClick={handleLogin} 
            className="w-full bg-[#4A3B32] text-[#FAF7F2] p-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition shadow-xl"
          >
            Entrar al panel
          </button>
        </form>
      </div>
    </div>
  )
}
