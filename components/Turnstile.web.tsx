import { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
}

// Widget de Cloudflare Turnstile para web. Carga el script una vez y renderiza
// el widget en cuanto la API está disponible; el token se pasa a onToken.
export function Turnstile({ siteKey, onToken }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    const SCRIPT_ID = 'cf-turnstile-script';
    let cancelled = false;

    // El evento load del script puede dispararse antes de que window.turnstile
    // esté listo, así que reintentamos hasta que exista.
    function tryRender() {
      if (cancelled || rendered.current) return;
      const w = window as unknown as { turnstile?: any };
      if (w.turnstile && ref.current) {
        rendered.current = true;
        w.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(''),
          'expired-callback': () => onToken(''),
        });
      } else {
        setTimeout(tryRender, 200);
      }
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    tryRender();

    return () => {
      cancelled = true;
    };
  }, [siteKey, onToken]);

  return <div ref={ref} style={{ marginTop: 8, marginBottom: 8 } as any} />;
}
