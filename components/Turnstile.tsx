interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
}

// En nativo no hay widget JS de Turnstile (requeriría un WebView). No-op:
// si en el futuro se distribuye la app nativa con CAPTCHA activo en Supabase,
// habrá que implementar aquí el flujo con react-native-webview.
export function Turnstile(_props: TurnstileProps) {
  return null;
}
