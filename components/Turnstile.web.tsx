import { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
}

// Widget de Cloudflare Turnstile para web. Carga el script una vez y renderiza
// el widget en modo explícito; el token resultante se pasa a onToken.
export function Turnstile({ siteKey, onToken }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SCRIPT_ID = 'cf-turnstile-script';
    let widgetId: string | undefined;

    function render() {
      const w = window as unknown as { turnstile?: any };
      if (!w.turnstile || !ref.current) return;
      widgetId = w.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'error-callback': () => onToken(''),
        'expired-callback': () => onToken(''),
      });
    }

    if (document.getElementById(SCRIPT_ID)) {
      render();
    } else {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    }

    return () => {
      const w = window as unknown as { turnstile?: any };
      if (widgetId && w.turnstile) w.turnstile.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return <div ref={ref} style={{ marginVertical: 8 } as any} />;
}
