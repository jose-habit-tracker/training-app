import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
}

// En nativo no hay widget JS: se carga dentro de un WebView. El baseUrl debe ser
// un hostname autorizado en el widget de Cloudflare (si no, da error 110200).
const BASE_URL = 'https://training-app-delta-self.vercel.app';

function buildHtml(siteKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }
    #cf { display: flex; justify-content: center; padding-top: 4px; }
  </style>
</head>
<body>
  <div id="cf"></div>
  <script>
    function post(t) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(t);
    }
    window.onloadTurnstileCallback = function () {
      window.turnstile.render('#cf', {
        sitekey: '${siteKey}',
        callback: function (token) { post(token); },
        'error-callback': function () { post(''); },
        'expired-callback': function () { post(''); }
      });
    };
  </script>
</body>
</html>`;
}

export function Turnstile({ siteKey, onToken }: TurnstileProps) {
  function handleMessage(e: WebViewMessageEvent) {
    onToken(e.nativeEvent.data || '');
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(siteKey), baseUrl: BASE_URL }}
        onMessage={handleMessage}
        scrollEnabled={false}
        style={styles.webview}
        androidLayerType="software"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 72, marginVertical: 8 },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
