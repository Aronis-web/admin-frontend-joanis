# ANÁLISIS DE PERFORMANCE - FLUJO COMPLETO

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. CampaignDetailScreen - loadCampaign()
**Líneas 204-223**: Carga sale-prices de TODOS los productos
- Si tienes 20 productos = 20 requests GET a /admin/products/{id}/sale-prices
- Esto se ejecuta CADA VEZ que se carga la campaña

### 2. CampaignDetailScreen - useFocusEffect
**Líneas 235-268**: Se ejecuta cada vez que la pantalla recibe foco
- Cuando vuelves de CampaignProductDetail, ejecuta el cleanup (línea 265)
- Esto resetea hasLoadedRef.current = false
- La próxima vez que entras, recarga TODO

### 3. CampaignProductDetailScreen - useFocusEffect  
**Líneas 154-158**: Llama loadProduct() cada vez que recibe foco
- Esto es correcto, pero puede optimizarse

## 📊 FLUJO ACTUAL (CON PROBLEMAS)

1. Usuario entra a Campaña
   → loadCampaign() se ejecuta
   → Carga campaña + 20 requests de sale-prices
   
2. Usuario entra a Producto
   → loadProduct() se ejecuta (1 request)
   → CampaignDetailScreen ejecuta cleanup (resetea hasLoadedRef)
   
3. Usuario genera reparto
   → Modal se abre (OK, no recarga)
   
4. Usuario vuelve a Campaña
   → useFocusEffect detecta hasLoadedRef = false
   → loadCampaign() se ejecuta OTRA VEZ
   → Carga campaña + 20 requests de sale-prices OTRA VEZ

## 🎯 TOTAL DE REQUESTS EN EL FLUJO
- Entrada inicial: 1 (campaña) + 20 (sale-prices) = 21 requests
- Volver de producto: 1 (campaña) + 20 (sale-prices) = 21 requests
- **TOTAL: 42+ requests** para un flujo simple

## ✅ SOLUCIONES PROPUESTAS

1. **Eliminar carga de sale-prices en CampaignDetailScreen**
   - Solo cargarlos cuando realmente se necesiten
   - O cargarlos de forma lazy (cuando se expande un producto)

2. **Mejorar lógica de useFocusEffect**
   - No resetear hasLoadedRef cuando navegas a un hijo
   - Solo resetear cuando sales completamente de la campaña

3. **Cachear datos**
   - Guardar sale-prices en un contexto o estado global
   - No recargar si ya están en cache

