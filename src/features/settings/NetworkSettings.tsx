import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField } from './SettingsParts';
import { useT } from '../../i18n';

// src-tauri/src/cookies.rs BROWSERS ile ayni.
const BROWSERS: [string, string][] = [
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
  const m = useT().network;
  // Kullanici yazmiyorken (null) kutu kayitli degeri gosterir; ayarlar diskten gec gelse de esit kalir.
  const [draft, setDraft] = useState<string | null>(null);
  const proxy = draft ?? settings.proxy ?? '';
  const proxyValid = isValidProxy(proxy.trim());

  const saveProxy = () => {
    const value = proxy.trim();
    if (isValidProxy(value) && value !== (settings.proxy ?? '')) save.mutate({ proxy: value });
    if (isValidProxy(value)) setDraft(null);
  };

  return (
    <Section title={m.title} icon={<Globe size={18} />}>
      <SelectField
        legend={m.cookies}
        value={settings.cookiesFromBrowser || ''}
        options={[['', m.none], ...BROWSERS]}
        onChange={(v) => save.mutate({ cookiesFromBrowser: v })}
        hint={m.cookiesHint}
      />
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{m.proxy}</legend>
        <input
          type="text"
          value={proxy}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveProxy}
          onKeyDown={(e) => e.key === 'Enter' && saveProxy()}
          placeholder="socks5://127.0.0.1:1080"
          className={`input w-full font-mono ${proxyValid ? '' : 'input-error'}`}
          aria-label={m.proxy}
          aria-invalid={!proxyValid}
        />
        <p className={`label whitespace-normal ${proxyValid ? '' : 'text-error'}`}>
          {proxyValid ? m.proxyHint : m.proxyInvalid}
        </p>
      </fieldset>
    </Section>
  );
}
