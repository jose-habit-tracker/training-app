# Backlog — mejoras futuras

> Para el agente que retome esto (p. ej. Opus 4.8): lee primero `CLAUDE.md`, el spec
> `docs/superpowers/specs/2026-07-06-coach-voz-home-conversacional-design.md` y el plan
> `docs/superpowers/plans/2026-07-06-coach-voz-home-conversacional.md` — describen la
> arquitectura actual (coach con voz, tool-calling, BYOK, RLS). Cada ítem de abajo debe
> pasar por brainstorming → spec → plan antes de implementarse, salvo los marcados como
> «directo». Regla de oro: el servidor Vercel NUNCA tiene `service_role`; toda escritura
> va del cliente a Supabase con el JWT del usuario.

## P1 — Alto valor, corto plazo

### 1. Feedback del coach tras confirmar una propuesta de registro
Hoy el formulario manual pide feedback IA al guardar (`ai_feedback` en la sesión), pero
confirmar una propuesta por voz en la home no lo hace. Tras `executeProposal` con éxito
de un `log_session`, pedir feedback a `/api/coach` (sin tools) con el resumen de la
sesión y persistirlo en `training_sessions.ai_feedback` + mostrarlo en el hilo.
Piezas: `app/(tabs)/hoy.tsx` (handleConfirm), `lib/coach/actions.ts`. **Directo.**

### 2. Persistir propuestas del coach entre recargas
Las tarjetas de propuesta son efímeras (estado en memoria): si recargas, queda el texto
pero no la tarjeta. Añadir columna `metadata jsonb` a `ai_conversations` (migración) y
guardar ahí `{proposal, status}`; al cargar el historial, rehidratar las tarjetas no
aplicadas. Cuidado: revalidar con `validateProposal` al rehidratar (nunca confiar en lo
guardado).

### 3. Gráficas de progresión con las métricas nuevas
Ahora que `metrics` existe (ritmo, km, FC, kg), Historial puede enseñar progresión:
ritmo medio por semana (running), volumen km/metros semanales, y carga máxima por
ejercicio (gym). Reusar el estilo del `RpeBarChart` existente (react-native-svg, grid
tenue, punto final destacado). Pantalla: `app/(tabs)/historial.tsx` + nuevos
componentes en `components/training/`.

### 4. Ocultar los hilos «Hoy · fecha» de la pestaña Chats
La home crea una conversación por día (`Hoy · YYYY-MM-DD`) que ensucia la lista de la
pestaña Chat. Filtrarlas de la lista (por prefijo de título) o agruparlas en una
sección colapsable «Diario del coach». Pantalla: `app/(tabs)/chat.tsx`. **Directo.**

## P2 — Valor alto, más trabajo

### 5. Grabación de voz en nativo (expo-audio)
`hooks/useRecorder.ts` ya define la interfaz (`status/seconds/supported/start/stop/cancel`)
y devuelve `unsupported` en nativo. Implementar la variante nativa con `expo-audio`
(grabar a AAC/m4a, convertir a base64 igual que web — `/api/transcribe` ya acepta
`audio/mp4`). Requiere probar en Expo Go/build real. Recordar: las env `EXPO_PUBLIC_*`
no viajan a builds EAS automáticamente.

### 6. Importar entrenos de Garmin (.FIT/.TCX)
Decisión previa (ver memoria del proyecto): las APIs de Garmin son de pago/gated, así
que la vía es subir el archivo exportado. Parsear .TCX (XML, fácil) y/o .FIT en el
cliente, extraer duración/distancia/ritmo/FC y pre-rellenar el formulario adaptativo o
proponer un `log_session` al coach. Empezar por .TCX.

### 7. Resumen semanal automático del coach
Cada domingo (o al abrir la app en domingo), generar un análisis de la semana: sesiones
completadas vs plan, RPE/fatiga media, y propuesta de ajustes para la siguiente semana
(vía `adjust_plan` con confirmación). Trigger client-side al abrir (comprobar si ya
existe el resumen de esa semana en `ai_conversations`), no cron.

## P2.5 — Follow-ups de la Agenda (review final 2026-07-08, no bloqueantes)

### A. Fase/cumplimiento con start_date real
`app/(tabs)/agenda.tsx` aproxima el inicio del plan como «carrera − 15 semanas» en vez
de leer `training_plans.start_date`. Deriva la barra de fases y el % de cumplimiento de
la fila real del plan. **Directo.**

### B. Limpiar goal_race_date al desmarcar la carrera objetivo
`EventModal` sincroniza `training_plans.goal_race_date` al activar el toggle, pero
desactivarlo no lo limpia. Añadir el camino inverso en `useEvents`. **Directo.**

### C. Unificar UTC vs local en fechas de agenda
`lib/agenda/phases.ts` usa UTC (`T00:00:00Z`); `agenda.tsx`/`RaceHeroCard` construyen
fechas locales. Solo afecta en la franja de medianoche; unificar criterio (y de paso el
`todayIso()` UTC heredado en `lib/coach/context.ts`).

### D. Normalizar distancias hyrox tipo «50m x4»
`metersOf` no las parsea (hoy es inofensivo: hyrox muestra nº de ejercicios). Convertir
seeds a `sets + distance` como se hizo con swim/run en `3f6cc4b`.

## P3 — Endurecimiento

### 8. Cifrar las keys BYOK en reposo
`user_ai_keys.groq_key` está en texto plano (protegida solo por RLS). Migrar a Supabase
Vault (o cifrado app-level con clave en env del servidor Vercel). Ojo: el proxy debe
poder descifrarla; evaluar trade-off de meter una clave de cifrado en Vercel vs Vault.

### 9. Rate limiting en los endpoints
`/api/chat`, `/api/coach` y `/api/transcribe` no tienen límite por usuario; una sesión
robada podría quemar la key de Groq del usuario. Límite simple por user_id en memoria
KV (Vercel KV o upstash gratis) o contador en Supabase. Mantener la respuesta 429 con
mensaje claro en español.

### 10. Arreglar la caché global de npm de la máquina
`~/.npm/_cacache` tiene ficheros con permisos rotos (EACCES) que ya corrompieron el
lockfile una vez (ver commit `a00e198`). Ejecutar `sudo chown -R $(whoami) ~/.npm`
(requiere al usuario) o `npm cache clean --force`. **Directo, 5 min, requiere sudo.**
