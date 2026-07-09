# Rediseño de «Hoy»: splash, dashboard y sesión en vivo

**Fecha:** 2026-07-09
**Estado:** aprobado por el usuario (mockups en visual companion, variante V2 + Opción B)

## Objetivo

Convertir la pestaña Hoy de un chat-primero a un dashboard del día: splash de marca al abrir la app, tarjeta hero del entrenamiento, semana de un vistazo, countdown a carrera, racha y RPE medio. El chat del coach se conserva íntegro pero se muda a un modal accesible desde una píldora.

## 1. Splash «Go to the next level» (V2 — overlay con glow)

- Componente `components/ui/NextLevelSplash.tsx`, renderizado como overlay absoluto encima del contenido de Hoy (la pantalla ya está montada y visible, atenuada, detrás).
- Visual: fondo `rgba(8,9,11,0.72)` (sin blur nativo, sin dependencias nuevas), texto «GO TO THE NEXT LEVEL» en blanco, mayúsculas, peso 800, con glow verde (`textShadow` con `colors.accent`); debajo, línea fina con gradiente verde que crece en anchura (usar `expo-linear-gradient`, ya instalado).
- Animación con `Animated`: fade-in + ligera escala (~400 ms) → mantiene (~2,5 s) → fade-out (~600 ms). Total ~3,5 s.
- Se muestra **una vez por arranque de la app**: flag a nivel de módulo (`let shown = false`), no persiste — cada cold start lo vuelve a mostrar; cambiar de pestaña o volver a Hoy no.
- Tocar en cualquier punto lo salta (fade-out inmediato).
- Con `useReduceMotion`: sin animaciones de escala/línea; aparición y desaparición con fades cortos, duración total ~1,5 s.

## 2. Hoy como dashboard

`app/(tabs)/hoy.tsx` se reescribe. Estructura (ScrollView vertical):

1. **Header** (se conserva): chip «Semana N · Focus» + `ProgressRing` hechas/planificadas.
2. **HeroCard** (`components/training/HeroCard.tsx`):
   - Color por tipo de sesión desde `SessionColors` (borde, tinte del gradiente de fondo, kicker y botón primario).
   - Kicker «JUEVES · HOY», título (`title`), meta «55 min · deporte».
   - Fila de **bloques**: calentamiento (`warmup`), principal (`description`, o resumen de `exercises` si existe), enfriamiento (`cooldown`). Solo se pintan los bloques con contenido; si no hay ninguno, la fila no aparece.
   - Botones: **▶ Empezar sesión** → `/session/live`; **Registrar** → `/log/[day]` (flujo actual).
   - Día de descanso (`sessionType === 'rest'`): estilo suave (gris `SessionColors.rest`), sin botón «Empezar sesión»; «Registrar» se mantiene.
3. **WeekStrip** (`components/training/WeekStrip.tsx`): L-D con puntos — hecha ✓ (verde), hoy (relleno con el color de la sesión de hoy), pendiente (borde punteado). Datos: `useWeekSessions` (hechas por `session_date`) + días del plan de la semana actual. Tocar cualquier día navega a la pestaña Semana.
4. **StatTiles** (`components/training/StatTiles.tsx`), tres tiles:
   - **Countdown**: días hasta el próximo evento `kind === 'race'` con fecha futura (de `useEvents`, el más cercano). Si no hay carreras futuras, el tile muestra «—» con etiqueta «Sin carrera».
   - **Racha 🔥**: días consecutivos hacia atrás desde hoy cumpliendo el plan. Regla: día de descanso en el plan → no rompe y no suma visualmente distinto (cuenta como mantenida); día con sesión planificada y `training_session` registrada → suma; sin registrar → rompe. El día de hoy sin registrar aún **no** rompe (se salta). Cálculo en `lib/training/streak.ts` sobre `useSessions(60)`.
   - **RPE medio semanal**: media de `rpe_perceived` de las sesiones de la semana (`useWeekSessions`); «—» si no hay ninguna con RPE.
5. **Píldora coach** (fija abajo, fuera del scroll): texto «Habla con tu coach…» + icono de micrófono Ionicons a la derecha (sin avatar ni segundo icono). Gradiente sutil verde→azul de fondo. Tocarla abre el modal del coach.

Se eliminan de `hoy.tsx`: el hilo inline (FlatList de mensajes), `CoachInput`, `ActionChips`, saludo `buildGreeting` — todo migra al modal.

## 3. Modal del coach (`app/coach.tsx`)

- Nueva pantalla registrada en el Stack raíz con `presentation: 'modal'`, título «Coach».
- Contiene **el hilo diario actual de Hoy movido tal cual**: get-or-create de la conversación `Hoy · <fecha>` en `conversations`, historial de `ai_conversations`, `MessageBubble`, `ProposalCard` con confirmar/editar (`executeProposal` anclado a `currentWeekIndex`), `ActionChips`, `CoachInput` con audio y transcripción.
- La lógica get-or-create del hilo diario se extrae a `lib/coach/dailyThread.ts` para que no viva dentro del componente.
- No se toca `chat/[id]` (solo texto): sigue siendo el chat histórico de la pestaña Chat.
- El saludo `buildGreeting` se muestra como primer bubble del modal (comportamiento actual).

## 4. Sesión en vivo (`app/session/live.tsx`)

- Ruta nueva en el Stack raíz (header con título «Sesión en vivo», back).
- Recibe `day` como parámetro; carga el `DayPlan` desde `PlanContext` (semana actual).
- UI: cronómetro grande (mm:ss) calculado con timestamps (`Date.now() - startedAt`), sobrevive a background/foreground sin timers nativos; lista de bloques (los mismos del hero) con el actual resaltado y los completados marcados; botón «Siguiente bloque» y, en el último, «Terminar».
- «Terminar» navega con `router.replace` a `/log/[day]` pasando `duration_min` redondeado como prefill (el editor de registro ya acepta `prefill`).
- Sin notificaciones, sin keep-awake, sin persistencia del estado del cronómetro: si el usuario cierra la app a mitad, la sesión en vivo se pierde (aceptado, registra a mano).

## 5. Errores y estados vacíos

- Sin plan para hoy (no debería pasar con onboarding hecho): hero muestra «Sin sesión planificada» con botón a Plan.
- Fallos de red en tiles: cada tile muestra «—»; nunca bloquean el render del hero.
- El splash nunca bloquea la interacción más de su duración (overlay con `pointerEvents` que capturan solo el tap de salto).

## 6. Testing

- `lib/training/streak.ts`: unit tests (descansos no rompen, hoy pendiente no rompe, hueco rompe, sin sesiones = 0).
- Derivación de bloques desde `DayPlan` (warmup/description/exercises/cooldown, casos con campos ausentes): unit tests.
- Countdown: próxima carrera futura, sin carreras, carrera hoy (0 días): unit tests sobre helper puro en `lib/agenda/`.
- Resto (splash, dashboard, modal, live): verificación manual en Expo (flujo completo: arranque → splash → hero → empezar sesión → terminar → registrar; píldora → modal con audio y propuestas).

## Fuera de alcance

- Check-in matinal de energía/sueño (descartado por el usuario).
- Frase del día (descartada).
- Blur nativo en el splash (se aproxima con overlay semitransparente).
- Cambios en `chat/[id]` o en la pestaña Chat.
