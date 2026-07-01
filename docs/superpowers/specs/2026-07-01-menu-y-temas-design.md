# Menú de cuenta + temas conmutables (Dark / White / Nude)

**Fecha:** 2026-07-01
**Estado:** Aprobado (diseño), pendiente de plan de implementación

## Objetivo

Mejorar el frontend hacia un estilo minimalista funcional tipo Apple con dos entregables:

1. **Menú de cuenta desplegable** accesible desde un avatar en el header, con: cambio de tema, editar plan, ajustes y cerrar sesión.
2. **Temas conmutables** por el usuario: **Dark**, **White** y **Nude** (nuevo), con cambio instantáneo y persistente en toda la app.

## Contexto actual

- Todas las pantallas (15 archivos) leen el color vía `getColors(useColorScheme())`, es decir, siguen el tema **del sistema** sin posibilidad de override manual ni persistencia.
- Existen `AuthContext` y `PlanContext` como patrón de estado global; la persistencia local se hace con `lib/storage.ts` (SecureStore en nativo, `localStorage` en web).
- `constants/colors.ts` ya define paletas `light` y `dark` con la interfaz `ThemeColors`, y `getColors(scheme)` devuelve una u otra.
- La pantalla `app/ajustes.tsx` **es** la configuración de la API key de Groq (no son pantallas separadas).

Archivos que consumen el tema hoy (a migrar):
`app/index.tsx`, `app/chat/[id].tsx`, `app/ajustes.tsx`, `app/plan/[day].tsx`, `app/plan/index.tsx`, `app/(tabs)/hoy.tsx`, `app/(tabs)/historial.tsx`, `app/(tabs)/semana.tsx`, `app/(tabs)/chat.tsx`, `app/(auth)/login.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/register.tsx`, `app/log/[day].tsx`, `hooks/useTheme.ts`, `components/ui/Input.tsx`.

## Enfoque técnico

**ThemeProvider (React Context) + migración de los 15 call-sites**, siguiendo el patrón existente de `AuthContext`/`PlanContext`.

Alternativas descartadas:
- **Migración parcial** (solo algunas pantallas): dejaría login/registro/editor de plan con el tema del sistema → experiencia inconsistente. Rechazada porque el objetivo es mejorar el frontend de forma global.
- **Librería de estado (Zustand)**: dependencia extra innecesaria teniendo ya el patrón Context en el proyecto.

## Arquitectura

### 1. `constants/colors.ts` — añadir tema `nude`

- Añadir la paleta `nude` con la misma forma que `ThemeColors`:
  - `background: '#f6efe3'`
  - `card: '#fdf9f2'`
  - `accent: '#b97a55'` (terracota) · `accentSoft: '#eadfce'`
  - `text: '#3d342a'` · `text2: '#5c4f40'` · `text3: '#9a8c78'`
  - `border: 'rgba(90,70,40,0.10)'`
  - `glassBg: 'rgba(253,249,242,0.6)'` · `glassBorder: 'rgba(90,70,40,0.10)'`
  - `shadow: 'rgba(90,70,40,0.08)'` · `ripple: 'rgba(90,70,40,0.12)'`
  - `danger`/`dangerSoft` y los colores de categoría/deporte (`cat*`, `orange`, `blue`, etc.) se conservan iguales entre temas (como ya ocurre con light/dark).
- Definir `export type ThemeName = 'dark' | 'light' | 'nude'`.
- Cambiar `getColors` para aceptar `ThemeName`: `getColors(name: ThemeName): ThemeColors` mapeando a `themes[name]`.
- Ajustar `themes` a `{ light, dark, nude }`.

> Nota: los valores exactos del nude son los aprobados en el mockup; el implementador puede afinar tokens derivados (p. ej. `accentSoft`) para contraste correcto, pero sin cambiar la dirección de color.

### 2. `lib/ThemeContext.tsx` (nuevo)

- `ThemeProvider` que:
  - Mantiene `theme: ThemeName` en estado.
  - **Primer arranque** (sin valor guardado): deriva del sistema con `useColorScheme()` → `dark` si el sistema está en oscuro, `light` en caso contrario.
  - Al montar, carga el valor guardado desde `storage.getItem('theme')`; si existe y es un `ThemeName` válido, lo usa.
  - `setTheme(name)` actualiza el estado y persiste con `storage.setItem('theme', name)`.
- Expone un hook `useThemeMode(): { theme: ThemeName; setTheme: (t: ThemeName) => void }`.
- Se monta en `app/_layout.tsx` envolviendo la app, dentro de `AuthProvider`/`PlanProvider` (orden no crítico; colocarlo de forma que `StatusBar` y navegación queden dentro).

### 3. `hooks/useTheme.ts` — leer del Context

- Sustituir `useColorScheme()` por `useThemeMode()` del nuevo contexto.
- `colors: getColors(theme)` y `isDark: theme === 'dark'`.
- El resto de la interfaz `Theme` (shadows, spacing, radius, fontSize, fontWeight, text) se mantiene.

### 4. Migración de call-sites (15 archivos)

- Reemplazar `getColors(useColorScheme())` por el tema del contexto:
  - En componentes/pantallas: usar `useTheme().colors` (hook ya existente y actualizado).
  - Eliminar los imports de `useColorScheme` y de `getColors` directo donde ya no se necesiten.
- `app/(tabs)/_layout.tsx`: además de migrar colores, añadir el **avatar de cuenta** en `headerRight` global (ver §5) y aplicar `tabBarStyle`/`headerStyle` desde el tema del contexto.
- `components/ui/Input.tsx` y demás componentes UI: pasar a `useTheme().colors`.
- `StatusBar` en `app/_layout.tsx`: mantener `style="auto"` o derivar de `isDark` para que los iconos de la barra de estado contrasten en White/Nude (claros) vs Dark.

### 5. `components/ui/AccountMenu.tsx` (nuevo)

Componente autocontenido con dos partes:

**Disparador (`AccountAvatar`)**
- Avatar circular con la **inicial** del usuario (de `useAuth()` → `session.user.email`).
- Fondo `colors.accent`, texto claro, ~36px, `borderRadius: pill`.
- Se coloca en `headerRight` de las tabs (aparece en Hoy/Semana/Chat/Historial).
- `onPress` abre el popover.

**Popover (menú)**
- `Modal` (`transparent`, `animationType="fade"`) con:
  - **Backdrop** tocable a pantalla completa que cierra el menú al tocar fuera.
  - **Panel** posicionado arriba a la derecha (bajo el header), `width ~250`, `backgroundColor: colors.card`, `borderRadius: Radius.card`, sombra estilo Apple (`shadow`/elevation), `borderColor: colors.border`.
- Contenido, de arriba abajo:
  1. **Cabecera**: nombre (parte local del email o nombre si disponible) + email en `text3`. Separador.
  2. **Selector de tema segmentado**: label "TEMA" + 3 botones **Dark / White / Nude**; el activo va con fondo `accent` y texto claro; al pulsar llama `setTheme(...)` (cambio instantáneo, el menú puede permanecer abierto). Separador.
  3. **Editar plan** → `router.push('/plan')`.
  4. **Ajustes** (incluye API key de Groq) → `router.push('/ajustes')`.
  5. Separador.
  6. **Cerrar sesión** (texto en `danger`): confirmación (`Alert.alert` nativo / `window.confirm` en web, mismo patrón que `notify` en `ajustes.tsx`) y `supabase.auth.signOut()`. El `NavigationGuard` existente redirige a login al desaparecer la sesión.
- Navegar a una opción cierra el menú.

> No se incluyen extras (recordatorio, invitar, exportar): el usuario eligió "solo lo esencial".

## Flujo de datos

- **Tema**: `ThemeProvider` (estado + `storage`) → `useTheme()`/`useThemeMode()` → componentes. Cambiar tema en `AccountMenu` → `setTheme` → re-render global instantáneo → persistencia.
- **Sesión/usuario**: `useAuth()` provee email para el avatar y la cabecera; `signOut()` dispara el guard de navegación existente.
- **Navegación**: opciones del menú usan `expo-router` (`router.push`) hacia rutas ya existentes (`plan/index`, `ajustes`).

## Manejo de errores

- Persistencia de tema: si `storage.getItem` falla o devuelve valor inválido, caer al derivado del sistema (nunca romper el render).
- `signOut`: si devuelve error, mostrar aviso con el patrón `notify` existente; no forzar navegación manual (lo hace el guard).
- El `ThemeProvider` debe entregar un tema válido de forma síncrona en el primer render (usar el derivado del sistema como valor inicial y aplicar el guardado cuando cargue) para evitar parpadeo/flash de tema incorrecto.

## Pruebas / verificación

Al ser una app Expo sin suite de tests, la verificación es manual (correr la app):
- Cambiar entre Dark/White/Nude desde el menú y confirmar que **todas** las pantallas (tabs, login/registro, editor de plan, ajustes, chat, log) adoptan el tema.
- Cerrar y reabrir la app: el tema elegido persiste.
- Primer arranque en un dispositivo limpio: respeta el tema del sistema.
- Avatar visible en las 4 tabs; popover abre/cierra por backdrop y por navegación.
- Cerrar sesión pide confirmación y redirige a login.
- Verificar contraste de texto/acento legible en los 3 temas, en especial Nude.
- TypeScript estricto sin `any`; tipos de tema en `constants/colors.ts` y `types/index.ts` según convenga.

## Fuera de alcance

- Extras de menú (recordatorios, invitaciones, exportar CSV).
- Rediseño de contenido de pantallas más allá de aplicar tema y unificar el header.
- Cambios de backend/Supabase.
