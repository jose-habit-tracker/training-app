# Training App — CLAUDE.md

## Proyecto
App móvil de entrenamiento personal para **media maratón (octubre) + Hyrox** (posterior).
Parte de un ecosistema mayor llamado **LifeOS**.

## Usuario objetivo
- Atleta, 23 años
- Deportes: running, natación, gimnasio
- Entrena 7 días/semana con sesiones específicas por día
- App invite-only, máximo 3 usuarios

## Stack técnico
- **React Native + Expo SDK 56 + TypeScript estricto**
- **Supabase** (Auth + PostgreSQL + RLS) — credenciales en `.env.local`
- **Groq API** (llama-3.3-70b-versatile) — gratis, key en `.env.local`
- **Expo Router** (file-based routing, v56)
- **Victory Native** para gráficas
- **@expo/vector-icons** (Ionicons) para iconos

## Variables de entorno (.env.local)
```
EXPO_PUBLIC_SUPABASE_URL=https://fsrnplttkvhudhtcsrmv.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
GROQ_API_KEY=gsk_...
```
⚠️ La URL de Supabase en .env.local incluye `/rest/v1/` — `lib/supabase.ts` lo elimina automáticamente.

## Estructura de archivos
```
app/
  (auth)/
    login.tsx          # Pantalla de login
    register.tsx       # Registro (invite-only)
  (tabs)/
    hoy.tsx            # Entrenamiento del día actual
    semana.tsx         # Vista semanal de todos los días
    agenda.tsx         # Carreras, cuenta atrás y calendario de eventos
    chat.tsx           # Chat con Coach IA (Groq)
    historial.tsx      # Historial y estadísticas
    _layout.tsx        # Tab navigator con Ionicons
  plan/
    index.tsx
    [day].tsx          # Editor adaptativo por deporte
  _layout.tsx          # Root layout con auth guard
components/
  ui/                  # Componentes UI reutilizables
  training/            # Componentes específicas de entrenamiento (editor adaptativo por deporte)
  agenda/              # Calendario, tarjeta de carrera, modales de evento/resultado
lib/
  supabase.ts          # Cliente Supabase con SecureStore
  groq.ts              # askGroq() + COACH_SYSTEM_PROMPT
  agenda/              # Fases, tiempos, PB y calendario mensual
  training/            # Campos por deporte y resúmenes de sesión
hooks/                 # Custom hooks (useEvents, useReduceMotion, ...)
types/
  index.ts             # Tipos TypeScript completos
constants/
  colors.ts            # Sistema de diseño Apple (dark mode)
  trainingPlan.ts      # Plan 7 días completo
supabase/
  schema.sql           # 6 tablas con RLS policies
  migrations/          # Migraciones incrementales sobre schema.sql
```

## Base de datos (Supabase)
6 tablas con RLS activado:
1. `training_plans` — plan del usuario (jsonb con semanas)
2. `training_sessions` — sesiones completadas con RPE/fatiga
3. `exercise_logs` — logs por ejercicio
4. `ai_conversations` — historial del chat con IA
5. `user_invites` — sistema de invitaciones
6. `events` — eventos del calendario y carreras (jsonb `race` con objetivo/resultado/análisis)

## Plan de entrenamiento (7 días)
| Día | Sesión | Duración |
|-----|--------|----------|
| Lunes | Running Umbral | 60 min |
| Martes | Natación Técnica | 45 min |
| Miércoles | Fuerza + Movilidad | 70 min |
| Jueves | Intervalos VO2max | 55 min |
| Viernes | Hyrox Circuit | 65 min |
| Sábado | Tirada Larga | 100 min |
| Domingo | Recuperación Activa | 30 min |

## Fases de entrenamiento
- **Base** (sem 1-4): Base aeróbica
- **Build** (sem 5-8): Volumen e intensidad
- **Peak** (sem 9-12): Pico de forma
- **Taper** (sem 13-14): Descarga pre-carrera
- **Race** (sem 15): Semana de carrera
- **Hyrox Prep** (sem 16-20): Preparación Hyrox

## Sistema de diseño
Dark mode estilo Apple. Fondo `#000000`, cards `#1C1C1E`, azul sistema `#0A84FF`.
Ver `constants/colors.ts` para todos los tokens.

## Coach IA
- Modelo: `llama-3.3-70b-versatile` (Groq, gratis)
- Función: `askGroq(messages, systemPrompt)` en `lib/groq.ts`
- System prompt en español, tono coach personal
- Analiza RPE, fatiga, feedback post-sesión

## Convenciones de código
- TypeScript estricto, todos los tipos en `types/index.ts`
- Estilos con `StyleSheet.create()` al final de cada archivo
- No usar `any`, preferir tipos explícitos
- Nombres en español para textos UI, inglés para código
- Sin comentarios obvios, solo WHY cuando no es evidente
