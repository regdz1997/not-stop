# 03 · Especificación — Not Stop

La spec funcional completa es el prompt del usuario (secciones 1 a 11, Diseño y Restricciones). Este documento fija las decisiones técnicas y las prioridades.

## Identidad
- Nombre **Not Stop**; ícono propio (un «rayo/pulso» blanco sobre azul `#4D8DFF`).
- Fondo `#0B0B0F`, tarjetas `#17171D`, borde `#24242C`, texto `#F2F2F5`, secundario `#8E8E99`.
- Colores de macros: proteína `#FF6B8A`, carbohidratos `#FFC24D`, grasa `#5FD3A8`.
- Tipografía del sistema (`-apple-system`), números grandes y tabulares.

## Prioridades por versión
| Versión | Contenido |
|---|---|
| **v1** | Onboarding, Diario, búsqueda + registro manual, porciones caseras, recientes/favoritos, comidas frecuentes y copiar comida, agua, entreno fuerza (biblioteca, rutinas, series, descanso, PR, kcal) y trote, peso con tendencia, ajustes/perfil, PWA offline, exportar/importar JSON y CSV. |
| v2 | Foto/voz/texto con IA, código de barras + Open Food Facts, alimentos propios con IA, comparar alimentos. |
| v3 | Metas dinámicas, puntuación nutricional, grasa corporal (Marina EE. UU.), medidas, fotos, ayuno. |
| v4 | Planificador automático, recetas, lista de compras, PDF, recordatorios, Coach IA. |
| v5 | Capacitor + HealthKit, widgets, Strava. |

## Arquitectura
- SPA React con 5 pestañas, sin router externo (estado de pestaña + hojas modales).
- `src/lib/`: lógica pura y probada (cálculos de metas, porciones, 1RM, MET, tendencia).
- `src/db.ts`: Dexie con tablas `profile, entries, foods, favorites, meals (frecuentes), water, weights, workouts, runs, routines, exercises, goalHistory`.
- `src/data/`: alimentos semilla latinoamericanos y genéricos (valores aproximados redactados por nosotros, no copiados de Fitia) y biblioteca de ejercicios.
- PWA con vite-plugin-pwa: manifest, íconos, `display: standalone`, precache de todo el build.

## Fórmulas
- BMR Mifflin-St Jeor: H `10p + 6,25e − 5a + 5`; M `… − 161`.
- Actividad: 1,2 / 1,375 / 1,55 / 1,725 / 1,9.
- kcal fuerza = MET 5,0 × kg × horas; trote MET según ritmo (Compendio de actividades).
- 1RM estimado (Epley) = peso × (1 + reps/30).
- Tendencia de peso: media móvil exponencial (α = 0,1).

## Mejoras deliberadas sobre el original
- Todo gratis; módulo de entrenamiento completo; datos 100 % locales.
