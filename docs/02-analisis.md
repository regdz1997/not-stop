# 02 · Análisis del original (Fitia)

Fuente: la descripción detallada del usuario y el conocimiento público de la app. No se exploró la app instalada; lo deducido va marcado con `(?)`.

## Pantallas y navegación
- **Onboarding** paso a paso: objetivo → sexo → edad → estatura → peso → peso meta (?) → actividad → resultado con calorías y macros.
- **Diario** (inicio): selector de fecha arriba, tarjeta de calorías restantes con anillo, barras de macros, tarjetas por comida (desayuno, almuerzo, cena, snacks) con «+», agua.
- **Plan**: plan de comidas generado y recetas (Premium en Fitia).
- **Registrar** (+): búsqueda, foto IA, voz, texto, código de barras.
- **Progreso**: peso, medidas, fotos, estadísticas.
- **Perfil/Ajustes** desde el ícono de usuario.

## Funciones (inventario)
Ver la lista completa en el mensaje original del usuario (secciones 1 a 11). Resumen: diario y macros; registro por 5 vías; porciones caseras; comidas frecuentes y copiar comidas; alimentos propios; comparar alimentos; metas Mifflin-St Jeor + ajuste dinámico semanal; puntuación nutricional; plan automático, recetas, lista de compras, PDF; coach IA; ayuno intermitente; progreso (peso, grasa, medidas, fotos, estadísticas); exportar y respaldar.

## Flujos principales
1. **Primer uso**: onboarding → cálculo de meta → Diario vacío.
2. **Registrar comida**: Diario → «+» en una comida → buscar → elegir alimento → ajustar porción (g o medida casera) → agregar → vuelve al Diario con totales recalculados.
3. **Repetir comida**: guardar la comida como frecuente → agregarla otro día con un toque, o copiarla desde otro día.
4. **Entreno (propio)**: Entreno → iniciar rutina → registrar series con la referencia anterior → descanso automático → terminar → las kcal se suman al Diario.
5. **Peso**: Progreso → registrar peso → la tendencia se actualiza.

## Modelo de datos (deducido)
Perfil, Entrada de comida (fecha, comida, alimento, cantidad), Alimento, Comida frecuente, Agua por día, Peso, Medidas, Entreno (series), Trote, Ayuno, Plan, Receta, Historial de objetivos.

## Comportamientos invisibles
- Restantes = meta − consumidas + quemadas (puede ser negativo, se muestra «excedido» (?)).
- Estados vacíos en cada comida con un llamado a agregar.
- Alimentos recientes y favoritos primero en la búsqueda.
- Guardado automático, sin botón «guardar» global.
