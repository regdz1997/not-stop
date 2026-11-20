# 01 · Ficha del proyecto

| | |
|---|---|
| **Software de referencia** | Fitia (fitia.app): contador de calorías y macros con IA, plan de comidas y coach. |
| **Tipo** | Recrear software ajeno → mismas funciones y flujos, **identidad propia**. |
| **Nombre propio** | **Not Stop** (elegido por el usuario). |
| **Acento** | Azul eléctrico `#4D8DFF` sobre tema oscuro. |
| **Para qué** | Uso personal: bajar de peso (objetivo cambiable), entrenamiento de fuerza + trote 2×/semana. |
| **Plataforma** | Fase 1: PWA instalable en iPhone (Safari → «Agregar a inicio»), sin conexión. Fase 2 (opcional): Capacitor nativo. |
| **Stack** | Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa (service worker), gráficas SVG propias. |
| **Coste** | Cero. Alojamiento gratis con HTTPS (Netlify/Vercel/GitHub Pages). Único coste posible: IA con clave propia. |
| **Restricciones** | Sin cuentas ni servidor propio, datos solo en el dispositivo, todo en español, sin muros de pago, avisar que las calorías son aproximadas. |
| **Entrega** | Por versiones v1→v5 (ver `04-plan.md`); probar en el iPhone entre versiones. |

## Supuestos tomados
- Node no estaba instalado: se descargó Node 22 LTS oficial en `~/.local/node-dl/` (sin tocar el sistema).
- Unidades por defecto: kg, cm, km, fechas `dd/mm/aaaa`, semana empieza el lunes.
- Factor de objetivo: pérdida −20 %, mantenimiento 0 %, ganancia +10 %.
- Proteína por defecto 2,0 g/kg; grasa 0,8 g/kg; carbohidratos = resto.
