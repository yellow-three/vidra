import { useState, useEffect, useRef } from 'react';
import type { AppSettings } from '../types';
import { useTheme } from '../hooks/ThemeContext';
import { getSettings, invalidateSettings } from '../hooks/settingsCache';
import { appApi } from '../lib/appApi';

const diskIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const slidersIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const eyeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const packageIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        {children}
      </div>
    </section>
  );
}

export default function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({});
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
  const [versionLoading, setVersionLoading] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    getSettings().then((s) => {
      if (!mounted.current) return;
      setSettings({ ...s, theme: s.theme || theme });
    });
    appApi.getYtdlpVersion().then((r) => {
      if (!mounted.current) return;
      setYtdlpVersion(r.version);
      setVersionLoading(false);
    }).catch(() => setVersionLoading(false));
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, theme }));
  }, [theme]);

  const updateAndSave = (key: keyof AppSettings, value: string | boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    appApi.saveSettings(next).then(() => invalidateSettings()).catch(() => {}).finally(() => setSaving(false));
  };

  const handleBrowseFolder = async () => {
    const res = await appApi.selectDownloadFolder();
    if (res?.success && res.path) {
      setSettings((prev) => ({ ...prev, downloadDir: res.path }));
      invalidateSettings();
    }
  };

  const handleUpdateYtdlp = async () => {
    setCheckingUpdate(true);
    try {
      const res = await appApi.updateYtdlp();
      if (res.success && res.version) setYtdlpVersion(res.version);
    } catch {}
    setCheckingUpdate(false);
  };

  return (
    <div className="space-y-6">
      <Section title="Depolama" icon={diskIcon}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 shrink-0">İndirme Klasörü:</span>
          <code className="flex-1 text-xs text-slate-300 bg-[var(--bg-body)] px-3 py-1.5 rounded border border-[var(--border)] truncate" title={settings.downloadDir}>
            {settings.downloadDir ? settings.downloadDir.replace(/^\/home\/[^/]+/, '~') : 'Varsayılan (İndirilenler)'}
          </code>
          <button onClick={handleBrowseFolder} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded transition-all">
            Değiştir
          </button>
        </div>
      </Section>

      <Section title="Varsayılanlar" icon={slidersIcon}>
        <div className="flex gap-6">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Kalite</label>
            <select
              value={settings.defaultQuality || ''}
              onChange={(e) => updateAndSave('defaultQuality', e.target.value)}
              className="w-full bg-[var(--bg-body)] border border-[var(--border)] text-xs rounded p-2 text-slate-200"
            >
              <option value="">Otomatik (En iyi)</option>
              <option value="2160">4K</option>
              <option value="1440">2K</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Format</label>
            <select
              value={settings.defaultFormat || ''}
              onChange={(e) => updateAndSave('defaultFormat', e.target.value)}
              className="w-full bg-[var(--bg-body)] border border-[var(--border)] text-xs rounded p-2 text-slate-200"
            >
              <option value="">MP4 (Video)</option>
              <option value="mp3">MP3 (Ses)</option>
              <option value="webm">WebM</option>
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoOpenFolder ?? true}
              onChange={(e) => updateAndSave('autoOpenFolder', e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs text-slate-300">Klasörü otomatik aç</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.downloadSubtitles ?? false}
              onChange={(e) => updateAndSave('downloadSubtitles', e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs text-slate-300">Altyazıları da indir (YouTube)</span>
          </label>
        </div>
      </Section>

      <Section title="Görünüm" icon={eyeIcon}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Tema:</span>
          <button
            onClick={() => setTheme('light')}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
              theme === 'light' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-[var(--bg-body)] text-slate-400 border border-[var(--border)] hover:border-amber-500/50'
            }`}
          >
            ☀️ Aydınlık
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
              theme === 'dark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-[var(--bg-body)] text-slate-400 border border-[var(--border)] hover:border-blue-500/50'
            }`}
          >
            🌙 Karanlık
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
              theme === 'system' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-[var(--bg-body)] text-slate-400 border border-[var(--border)] hover:border-indigo-500/50'
            }`}
          >
            💻 Sistem
          </button>
        </div>
      </Section>

      <Section title="Sistem" icon={packageIcon}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">yt-dlp:</span>
          <code className="text-xs text-emerald-400 font-mono">{versionLoading ? 'Yükleniyor...' : ytdlpVersion || 'Bilinmiyor'}</code>
          <button
            onClick={handleUpdateYtdlp}
            disabled={checkingUpdate}
            className="ml-auto bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-all"
          >
            {checkingUpdate ? 'Güncelleniyor...' : 'Güncelle'}
          </button>
        </div>
        <div className="mt-3 text-[10px] text-slate-500">
          {saving ? 'Kaydediliyor...' : 'Tüm değişiklikler otomatik kaydedilir.'}
        </div>
      </Section>
    </div>
  );
}
