# Not Stop

App personal de calorías, macros, IA, plan de comidas, ayuno, fuerza y trote (PWA para iPhone). Datos solo en el teléfono.

## Uso local
Node está en `~/.local/node-dl/node-v22.23.5-darwin-arm64/bin` (añádelo al PATH).

```bash
npm install
npm run dev      # desarrollo, accesible en la red local
npm test         # pruebas de lógica y de copia de seguridad
npm run build    # genera dist/ listo para publicar
```

## Instalar en el iPhone
1. Publica `dist/` en un hosting con HTTPS (Netlify Drop, Vercel o GitHub Pages).
2. Abre la URL en **Safari** → botón Compartir → **Agregar a pantalla de inicio**.
3. Ábrela desde el ícono: va a pantalla completa y funciona sin conexión.

Haz copias de seguridad desde Perfil → «Crear copia de seguridad».

Documentación del proyecto en `docs/`.
