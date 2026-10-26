import type { ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { HardDrive, Info, Package, Palette, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { AppSettings } from '../../types';
import { LEGAL_TEXT } from '../../app/LegalNotice';
import { queryClient } from '../../app/queryClient';
import { engine } from '../../engine';
import { appApi } from '../../lib/appApi';
import { invalidateSettings, useSaveSettings, useSettings } from './queries';
import { useAppUpdate, useAppVersion, useInstallUpdate } from './appUpdate';
import ThemePicker from './ThemePicker';

const versionKey = ['ytdlp-version'] as const;

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="card bg-base-100 border border-base-300">
      <div className="card-body gap-4">
        <h2 className="card-title text-base gap-2">{icon}{title}</h2>
        {children}
      </div>
    </section>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-base-content/60">{description}</span>
      </span>
      <input type="checkbox" className="toggle toggle-sm" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SettingsForm() {
  const settings: AppSettings = useSettings().data ?? {};
  const save = useSaveSettings();
  const ytdlpVersion = useQuery({ queryKey: versionKey, queryFn: () => engine.engineVersion() });
  const updateYtdlp = useMutation({
    mutationFn: () => engine.updateEngine(),
    onSuccess: (v) => queryClient.setQueryData(versionKey, v),
    onError: (error) => console.warn('yt-dlp güncellenemedi:', error),
  });
  const appVersion = useAppVersion();
  const appUpdate = useAppUpdate();
  const install = useInstallUpdate();

  const updateAndSave = (key: keyof AppSettings, value: string | boolean) => save.mutate({ [key]: value });

  const handleBrowseFolder = async () => {
    const res = await appApi.selectDownloadFolder();
    if (res?.success && res.path) await invalidateSettings();
  };

  const appUpdateText = appUpdate.isFetching
    ? 'Kontrol ediliyor...'
    : appUpdate.isError
      ? `Kontrol başarısız: ${appUpdate.error instanceof Error ? appUpdate.error.message : String(appUpdate.error)}`
      : appUpdate.data
        ? `Yeni sürüm: ${appUpdate.data.version}`
        : appUpdate.isSuccess ? 'Güncel' : '';

  return (
    <div className="flex flex-col gap-4">
      <Section title="Depolama" icon={<HardDrive size={18} />}>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">İndirme klasörü</legend>
          <div className="join w-full">
            <input
              readOnly
              value={settings.downloadDir || 'İndirilenler (varsayılan)'}
              title={settings.downloadDir}
              className="input join-item w-full"
              aria-label="İndirme klasörü"
            />
            <button onClick={handleBrowseFolder} className="btn join-item">Değiştir</button>
          </div>
        </fieldset>
      </Section>

      <Section title="Varsayılanlar" icon={<SlidersHorizontal size={18} />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Kalite</legend>
            <select value={settings.defaultQuality || ''} onChange={(e) => updateAndSave('defaultQuality', e.target.value)} className="select w-full">
              <option value="">Otomatik (en iyi)</option>
              <option value="2160">4K</option>
              <option value="1440">2K</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Format</legend>
            <select value={settings.defaultFormat || ''} onChange={(e) => updateAndSave('defaultFormat', e.target.value)} className="select w-full">
              <option value="">MP4 (Video)</option>
              <option value="mp3">MP3 (Ses)</option>
            </select>
          </fieldset>
        </div>
        <div className="divider my-0" />
        <ToggleRow
          label="Klasörü otomatik aç"
          description="İndirme bitince dosyanın bulunduğu klasörü açar."
          checked={settings.autoOpenFolder ?? true}
          onChange={(v) => updateAndSave('autoOpenFolder', v)}
        />
        <ToggleRow
          label="Altyazıları göm"
          description="Türkçe ve İngilizce altyazılar varsa videoya eklenir."
          checked={settings.downloadSubtitles ?? false}
          onChange={(v) => updateAndSave('downloadSubtitles', v)}
        />
      </Section>

      <Section title="Görünüm" icon={<Palette size={18} />}>
        <ThemePicker />
      </Section>

      <Section title="Sistem" icon={<Package size={18} />}>
        <div className="flex items-center gap-3">
          <span className="text-sm">yt-dlp</span>
          <span className="badge badge-ghost font-mono">{ytdlpVersion.isPending ? '…' : ytdlpVersion.data || 'Bilinmiyor'}</span>
          <button onClick={() => updateYtdlp.mutate()} disabled={updateYtdlp.isPending} className="btn btn-sm ml-auto gap-1.5">
            {updateYtdlp.isPending ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />}
            {updateYtdlp.isPending ? 'Güncelleniyor...' : 'Güncelle'}
          </button>
        </div>
        {updateYtdlp.isError && <p className="text-xs text-error">Güncelleme başarısız: {updateYtdlp.error.message}</p>}
        <div className="divider my-0" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Uygulama</span>
          <span className="badge badge-ghost font-mono">{appVersion.data ?? '…'}</span>
          <span className={`text-xs ${appUpdate.isError ? 'text-error' : 'text-base-content/60'}`} role="status">{appUpdateText}</span>
          {appUpdate.data ? (
            <button onClick={() => install.mutate(appUpdate.data!)} disabled={install.isPending} className="btn btn-sm btn-primary ml-auto">
              {install.isPending ? `İndiriliyor %${install.percent ?? 0}` : 'İndir ve yeniden başlat'}
            </button>
          ) : (
            <button onClick={() => void appUpdate.refetch()} disabled={appUpdate.isFetching} className="btn btn-sm ml-auto">
              Güncellemeleri kontrol et
            </button>
          )}
        </div>
        {appUpdate.data?.body && <p className="text-xs text-base-content/70 whitespace-pre-line">{appUpdate.data.body}</p>}
        {install.isError && <p className="text-xs text-error">Güncelleme kurulamadı: {install.error.message}</p>}
        <p className="text-xs text-base-content/50">{save.isPending ? 'Kaydediliyor…' : 'Değişiklikler otomatik kaydedilir.'}</p>
      </Section>

      <Section title="Hakkında" icon={<Info size={18} />}>
        <p className="text-sm text-base-content/70 leading-relaxed">{LEGAL_TEXT}</p>
      </Section>
    </div>
  );
}
