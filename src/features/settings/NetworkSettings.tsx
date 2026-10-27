import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField } from './SettingsParts';

// src-tauri/src/cookies.rs BROWSERS ile ayni.
const BROWSERS: [string, string][] = [
  ['', 'Kullanma'],
  ['firefox', 'Firefox'],
  ['chrome', 'Google Chrome'],
  ['chromium', 'Chromium'],
  ['edge', 'Microsoft Edge'],
  ['brave', 'Brave'],
  ['opera', 'Opera'],
  ['vivaldi', 'Vivaldi'],
  ['safari', 'Safari'],
];

const PROXY_PATTERN = /^(https?|socks4a?|socks5h?):\/\/\S+$/i;

export const isValidProxy = (value: string) => value === '' || PROXY_PATTERN.test(value);

export default function NetworkSettings() {
  const settings = useSettings().data ?? {};
  const save = useSaveSettings();
  const [proxy, setProxy] = useState(settings.proxy ?? '');
  const proxyValid = isValidProxy(proxy.trim());

  // Ayarlar diskten gec gelir; kullanici yazmiyorken kutuyu esitle.
  useEffect(() => setProxy(settings.proxy ?? ''), [settings.proxy]);

  const saveProxy = () => {
    const value = proxy.trim();
    if (isValidProxy(value) && value !== (settings.proxy ?? '')) save.mutate({ proxy: value });
  };

  return (
    <Section title="Ağ ve hesap" icon={<Globe size={18} />}>
      <SelectField
        legend="Tarayıcı çerezleri"
        value={settings.cookiesFromBrowser || ''}
        options={BROWSERS}
        onChange={(v) => save.mutate({ cookiesFromBrowser: v })}
        hint={
          'YouTube "bot olmadığınızı doğrulayın" derse, yaş kısıtlamalı veya üyelere özel videolar için '
          + 'YouTube\'a giriş yaptığınız tarayıcıyı seçin. Çerezler yalnızca yt-dlp\'ye verilir, başka yere gönderilmez. '
          + 'Windows\'ta Chrome ve Edge çerezleri okunamayabilir; Firefox önerilir.'
        }
      />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Proxy</legend>
        <input
          type="text"
          value={proxy}
          onChange={(e) => setProxy(e.target.value)}
          onBlur={saveProxy}
          onKeyDown={(e) => e.key === 'Enter' && saveProxy()}
          placeholder="socks5://127.0.0.1:1080"
          className={`input w-full font-mono ${proxyValid ? '' : 'input-error'}`}
          aria-label="Proxy"
          aria-invalid={!proxyValid}
        />
        <p className={`label whitespace-normal ${proxyValid ? '' : 'text-error'}`}>
          {proxyValid ? 'Boş bırakılırsa sistem bağlantısı kullanılır. http, https, socks4 ve socks5 desteklenir.' : 'Adres http://, https://, socks4:// veya socks5:// ile başlamalı.'}
        </p>
      </fieldset>
    </Section>
  );
}
