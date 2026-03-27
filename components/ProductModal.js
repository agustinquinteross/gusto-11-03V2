import { useState, useMemo, useEffect } from 'react';
import { X, Check, PenLine, Minus, Plus } from 'lucide-react';

// ✅ FIX: Helper para formatear precios sin decimales sucios.
function formatPrice(amount) {
  const rounded = Math.round(amount * 100) / 100
  return rounded % 1 === 0
    ? rounded.toLocaleString('es-AR')
    : rounded.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProductModal({ product, isOpen, onClose, onAddToCart }) {
  // selectedOptions ahora guarda cantidades: { [optionId]: número }
  const [selectedOptions, setSelectedOptions] = useState({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  // 1. Reiniciar estado al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedOptions({});
      setQty(1);
      setNote('');
    }
  }, [isOpen, product]);

  const groups = product?.modifiers || [];

  // Helper: contar total seleccionado en un grupo
  const getGroupTotal = (group) => {
    return (group.modifier_options || []).reduce((sum, opt) => sum + (selectedOptions[opt.id] || 0), 0);
  };

  // ¿Es un grupo tipo "Box" (con cantidades)?
  const isQuantityGroup = (group) => (group.max_per_option || 1) > 1;

  // 2. Calcular precio unitario
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    let extraCost = 0;
    groups.forEach(group => {
      const options = group.modifier_options || [];
      options.forEach(opt => {
        const count = selectedOptions[opt.id] || 0;
        if (count > 0) {
          extraCost += Number(opt.price) * count;
        }
      });
    });
    return Math.round((Number(product.price) + extraCost) * 100) / 100;
  }, [product, selectedOptions, groups]);

  if (!isOpen || !product) return null;

  // 3. Handlers
  const handleToggleOption = (group, option) => {
    if (group.min_selection === 1 && group.max_selection === 1) {
      // Radio (selección única)
      const newSelection = { ...selectedOptions };
      group.modifier_options.forEach(o => delete newSelection[o.id]);
      newSelection[option.id] = 1;
      setSelectedOptions(newSelection);
    } else if (isQuantityGroup(group)) {
      // Handled by handleQuantityChange
      return;
    } else {
      // Checkbox (selección múltiple, toggle 0/1)
      setSelectedOptions(prev => {
        const current = prev[option.id] || 0;
        const groupTotal = getGroupTotal(group);

        if (current > 0) {
          const newState = { ...prev };
          delete newState[option.id];
          return newState;
        } else {
          if (group.max_selection && groupTotal >= group.max_selection) {
            return prev; // Límite alcanzado
          }
          return { ...prev, [option.id]: 1 };
        }
      });
    }
  };

  // Handler para +/- en grupos tipo Box
  const handleQuantityChange = (group, option, delta) => {
    setSelectedOptions(prev => {
      const currentOptQty = prev[option.id] || 0;
      const newOptQty = currentOptQty + delta;
      const maxPerOpt = group.max_per_option || 1;

      // No bajar de 0
      if (newOptQty < 0) return prev;
      // No superar máx por opción
      if (newOptQty > maxPerOpt) return prev;

      // Calcular total del grupo sin esta opción
      const groupTotalWithout = (group.modifier_options || []).reduce(
        (sum, opt) => sum + (opt.id === option.id ? 0 : (prev[opt.id] || 0)), 0
      );

      // No superar máx total del grupo
      if (group.max_selection && (groupTotalWithout + newOptQty) > group.max_selection) return prev;

      const newState = { ...prev };
      if (newOptQty === 0) {
        delete newState[option.id];
      } else {
        newState[option.id] = newOptQty;
      }
      return newState;
    });
  };

  const handleAddToOrder = () => {
    // Validar obligatorios
    const missingRequired = groups.filter(g => {
      if (g.min_selection > 0) {
        const total = getGroupTotal(g);
        return total < g.min_selection;
      }
      return false;
    });

    if (missingRequired.length > 0) {
      const g = missingRequired[0];
      const total = getGroupTotal(g);
      alert(`⚠️ Faltan ${g.min_selection - total} selecciones en: ${g.name}`);
      return;
    }

    // Preparar lista de opciones elegidas (con cantidad)
    const optionsList = [];
    groups.forEach(g => {
      g.modifier_options.forEach(o => {
        const count = selectedOptions[o.id] || 0;
        if (count > 0) {
          // Para el resumen del carrito, repetimos o indicamos cantidad
          optionsList.push({ name: count > 1 ? `${o.name} x${count}` : o.name, price: o.price * count });
        }
      });
    });

    onAddToCart({
      ...product,
      selectedOptions: optionsList,
      price: unitPrice,
      quantity: qty,
      note: note
    });
    onClose();
  };

  const totalDisplay = formatPrice(unitPrice * qty)

  // 4. Renderizado
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#FAF7F2]/90 backdrop-blur-sm animate-in fade-in">

      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-[#4A3B32]/10 text-[#4A3B32]/90">

        {/* Imagen Header */}
        <div className="relative h-48 sm:h-56 bg-[#4A3B32]/5 shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#4A3B32]/5 text-[#4A3B32]/50">🍔</div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 bg-[#FAF7F2]/60 hover:bg-[#FAF7F2]/80 text-[#4A3B32] p-2 rounded-full transition border border-[#4A3B32]/20"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-0 w-full h-20 bg-gradient-to-t from-gray-900 to-transparent"></div>
        </div>

        {/* Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">

          {/* Info Producto */}
          <div>
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-3xl font-black text-[#4A3B32] uppercase italic tracking-tighter leading-none">{product.name}</h2>
              {product.stock !== null && product.stock !== undefined && (
                <span className={`text-[10px] font-black px-2 py-1 rounded border uppercase tracking-widest ${product.stock <= 0 ? 'bg-red-600 text-white border-red-600' : product.stock <= 5 ? 'bg-orange-500 text-white border-orange-500 animate-pulse' : 'bg-green-600/20 text-green-500 border-green-600/30'}`}>
                  {product.stock <= 0 ? 'Agotado' : product.stock <= 5 ? `¡Casi Agotado! (${product.stock})` : `En Stock: ${product.stock}`}
                </span>
              )}
            </div>
            <p className="text-[#4A3B32]/70 text-sm leading-relaxed">{product.description}</p>
          </div>

          <hr className="border-[#4A3B32]/10" />

          {/* Extras / Modificadores */}
          {groups.length > 0 ? (
            groups.map(group => {
              const groupTotal = getGroupTotal(group);
              const isBox = isQuantityGroup(group);
              
              return (
                <div key={group.id} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <h3 className="font-bold text-[#4A3B32] uppercase text-sm tracking-wide">{group.name}</h3>
                    <div className="flex gap-2 items-center">
                      {group.min_selection > 0 && (
                        <span className="text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-900/50 font-bold uppercase">Obligatorio</span>
                      )}
                      {isBox && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${groupTotal === group.max_selection ? 'bg-green-600/20 text-green-600 border-green-600/30' : 'bg-[#4A3B32]/5 text-[#4A3B32]/60 border-[#4A3B32]/20'}`}>
                          {groupTotal}/{group.max_selection}
                        </span>
                      )}
                      {!isBox && group.max_selection > 1 && (
                        <span className="text-[10px] text-[#4A3B32]/60 font-bold bg-[#4A3B32]/5 px-2 py-0.5 rounded border border-[#4A3B32]/20">Max: {group.max_selection}</span>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso para grupos tipo Box */}
                  {isBox && group.max_selection > 1 && (
                    <div className="h-1.5 bg-[#4A3B32]/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${groupTotal === group.max_selection ? 'bg-green-500' : 'bg-[#D4A373]'}`}
                        style={{ width: `${(groupTotal / group.max_selection) * 100}%` }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {group.modifier_options?.map(option => {
                      const optQty = selectedOptions[option.id] || 0;
                      const isSelected = optQty > 0;
                      const maxPerOpt = group.max_per_option || 1;
                      const canAdd = groupTotal < (group.max_selection || 999) && optQty < maxPerOpt && option.is_available;

                      if (isBox) {
                        // --- MODO BOX: +/- por opción ---
                        return (
                          <div
                            key={option.id}
                            className={`flex justify-between items-center p-3 rounded-xl border transition-all
                              ${!option.is_available ? 'opacity-50 grayscale cursor-not-allowed bg-[#4A3B32]/5' : ''}
                              ${isSelected ? 'border-[#D4A373] bg-[#D4A373]/10' : 'border-[#4A3B32]/10 bg-[#FAF7F2]/40'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`font-medium text-sm ${isSelected ? 'text-[#4A3B32] font-bold' : 'text-[#4A3B32]/80'}`}>
                                {option.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {Number(option.price) > 0 && (
                                <span className="text-xs font-bold text-[#4A3B32]/50 mr-2">+${formatPrice(Number(option.price))}</span>
                              )}
                              {option.is_available && (
                                <div className="flex items-center bg-white border border-[#4A3B32]/20 rounded-lg overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(group, option, -1)}
                                    disabled={optQty === 0}
                                    className="w-8 h-8 flex items-center justify-center text-[#4A3B32]/70 hover:bg-[#4A3B32]/5 transition disabled:opacity-30"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className={`w-6 text-center text-sm font-black ${optQty > 0 ? 'text-[#4A3B32]' : 'text-[#4A3B32]/30'}`}>
                                    {optQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(group, option, 1)}
                                    disabled={!canAdd}
                                    className="w-8 h-8 flex items-center justify-center text-[#4A3B32]/70 hover:bg-[#4A3B32]/5 transition disabled:opacity-30"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // --- MODO CLÁSICO: Toggle (checkbox/radio) ---
                      return (
                        <div
                          key={option.id}
                          onClick={() => option.is_available && handleToggleOption(group, option)}
                          className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.98] 
                            ${!option.is_available ? 'opacity-50 grayscale cursor-not-allowed bg-[#4A3B32]/5' : ''}
                            ${isSelected ? 'border-red-600 bg-red-900/10 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'border-[#4A3B32]/10 bg-[#FAF7F2]/40 hover:border-[#4A3B32]/30'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'border-red-500 bg-[#4A3B32] text-[#FAF7F2]' : 'border-[#4A3B32]/30 bg-transparent'}`}>
                              {isSelected && <Check size={12} strokeWidth={4} />}
                            </div>
                            <span className={`font-medium text-sm ${isSelected ? 'text-[#4A3B32]' : 'text-[#4A3B32]/80'}`}>{option.name}</span>
                          </div>
                          <span className={`text-sm font-bold ${isSelected ? 'text-[#4A3B32]' : 'text-[#4A3B32]/60'}`}>
                            {Number(option.price) > 0 ? `+$${formatPrice(Number(option.price))}` : 'Gratis'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-[#4A3B32]/50 text-xs italic">Este producto no tiene ingredientes extra.</p>
          )}

          {/* SECCIÓN NOTA DE PEDIDO */}
          <div className="bg-[#FAF7F2]/30 p-4 rounded-xl border border-[#4A3B32]/10">
            <div className="flex items-center gap-2 mb-2">
              <PenLine size={14} className="text-yellow-500" />
              <h3 className="font-bold text-[#4A3B32] text-xs uppercase tracking-wide">¿Alguna aclaración?</h3>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-white border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] text-sm focus:border-yellow-500 outline-none placeholder-gray-600 resize-none transition-all focus:ring-1 focus:ring-yellow-500/50"
              rows="2"
              placeholder="Ej: Sin sal, la carne bien cocida, sin mayonesa..."
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#4A3B32]/10 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 flex items-center justify-center font-bold text-lg text-[#4A3B32]/70 hover:text-[#4A3B32] transition active:scale-90"
              >-</button>
              <span className="w-8 text-center font-bold text-[#4A3B32] text-lg">{qty}</span>
              <button
                type="button"
                onClick={() => {
                  if (product.stock === undefined || product.stock === null || qty < product.stock) {
                    setQty(qty + 1)
                  }
                }}
                className={`w-10 h-10 flex items-center justify-center font-bold text-lg transition active:scale-90 ${product.stock !== undefined && product.stock !== null && qty >= product.stock ? 'text-gray-300 cursor-not-allowed' : 'text-[#4A3B32]/70 hover:text-[#4A3B32]'}`}
              >+</button>
            </div>

            <button
              type="button"
              onClick={handleAddToOrder}
              disabled={product.stock === 0}
              className="flex-1 bg-[#4A3B32] hover:bg-black text-[#FAF7F2] font-black py-3 rounded-xl text-lg flex justify-between px-6 shadow-lg shadow-red-900/30 transition-all active:scale-95 border-t border-red-400 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
              <span>{product.stock === 0 ? 'AGOTADO' : 'AGREGAR'}</span>
              <span>${totalDisplay}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}