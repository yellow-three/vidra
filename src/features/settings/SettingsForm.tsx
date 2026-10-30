import { useMutation, useQuery } from '@tanstack/react-query';
import { FolderOpen, HardDrive, Info, MousePointerClick, Package, Palette, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { applyClipboardMode } from '../queue/bootstrap';
import type { ClipboardMode } from '../queue/duplicates';
import type { AppSettings } from '../../types';
import { engine } from '../../engine';
import { LANGUAGES, useLanguageCode, useT, type Language } from '../../i18n';
import { appApi } from '../../lib/appApi';
import { invalidateSettings, useSaveSettings, useSettings } from './queries';
import { useAppUpdate, useAppVersion, useInstallUpdate, useIsFlatpak } from './appUpdate';
import ThemePicker from './ThemePicker';
import DownloadSettings, { SubtitleLanguages } from './DownloadSettings';
import NetworkSettings from './NetworkSettings';
import SponsorBlockSettings from './SponsorBlockSettings';
import ToolsSettings from './ToolsSettings';
import { Section, SelectField, ToggleRow } from './SettingsParts';
import { updateYtdlp as runYtdlpUpdate, ytdlpVersionKey as versionKey } from './ytdlpAutoUpdate';


export default function SettingsForm() {
  const m = useT().settings;
  const legal = useT().legal;
  const currentLanguage = useLanguageCode();
  const settings: AppSettings = useSettings().data ?? {};
  const save = useSaveSettings();
  const ytdlpVersion = useQuery({ queryKey: versionKey, queryFn: () => engine.engineVersion() });
  const updateYtdlp = useMutation({
    mutationFn: runYtdlpUpdate,
    onError: (error) => console.warn('yt-dlp güncellenemedi:', error),
  });
  const appVersion = useAppVersion();
  const appUpdate = useAppUpdate();
  const install = useInstallUpdate();
  const flatpak = useIsFlatpak().data;

  const updateAndSave = (key: keyof AppSettings, value: string | boolean) => save.mutate({ [key]: value });

  const handleBrowseFolder = async () => {
    const res = await appApi.selectDownloadFolder();
    if (res?.success && res.path) await invalidateSettings();
  };

  const appUpdateText = appUpdate.isFetching
    ? m.checking
    : appUpdate.isError
      ? m.checkFailed(appUpdate.error instanceof Error ? appUpdate.error.message : String(appUpdate.error))
      : appUpdate.data
        ? m.newVersion(appUpdate.data.version)
        : appUpdate.isSuccess ? m.upToDate : '';

  return (
    <div className="flex flex-col gap-4">
      <Section title={m.storage} icon={<HardDrive size={18} />}>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">{m.folder}</legend>
          <div className="join w-full">
            <input
              readOnly
              value={settings.downloadDir || m.folderDefault}
              title={settings.downloadDir}
              className="input join-item w-full"
              aria-label={m.folder}
            />
            <button onClick={handleBrowseFolder} className="btn join-item">{m.change}</button>
          </div>
        </fieldset>
      </Section>

      <Section title={m.defaults} icon={<SlidersHorizontal size={18} />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">{m.quality}</legend>
            <select value={settings.defaultQuality || ''} onChange={(e) => updateAndSave('defaultQuality', e.target.value)} className="select w-full">
              <option value="">{m.qualityAuto}</option>
              <option value="2160">4K</option>
              <option value="1440">2K</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">{m.format}</legend>
            <select value={settings.defaultFormat || ''} onChange={(e) => updateAndSave('defaultFormat', e.target.value)} className="select w-full">
              <option value="">{m.formatVideo}</option>
              <option value="mp3">{m.formatAudio}</option>
            </select>
          </fieldset>
        </div>
        <div className="divider my-0" />
        <ToggleRow
          label={m.subtitles}
          description={m.subtitlesHint}
          checked={settings.downloadSubtitles ?? false}
          onChange={(v) => updateAndSave('downloadSubtitles', v)}
        />
        {settings.downloadSubtitles && <SubtitleLanguages />}
        <ToggleRow
          label={m.autoSubtitles}
          description={m.autoSubtitlesHint}
          checked={settings.autoSubtitles ?? false}
          onChange={(v) => updateAndSave('autoSubtitles', v)}
        />
        <ToggleRow
          label={m.subtitleFile}
          description={m.subtitleFileHint}
          checked={settings.subtitleFile ?? false}
          onChange={(v) => updateAndSave('subtitleFile', v)}
        />
      </Section>

      <DownloadSettings />

      <SponsorBlockSettings />

      <NetworkSettings />

      <Section title={m.behavior} icon={<MousePointerClick size={18} />}>
        <div className="sm:w-1/2">
          <SelectField
            legend={m.clipboardMode}
            value={settings.clipboardMode ?? 'youtube'}
            options={(['youtube', 'all', 'off'] as const).map((v) => [v, m.clipboardModes[v]])}
            onChange={(v) => {
              const mode = v as ClipboardMode;
              save.mutate({ clipboardMode: mode });
              applyClipboardMode(mode);
            }}
            hint={m.clipboardModeHint}
          />
        </div>
        <ToggleRow
          label={m.closeToTray}
          description={m.closeToTrayHint}
          checked={settings.closeToTray ?? true}
          onChange={(v) => updateAndSave('closeToTray', v)}
        />
      </Section>

      <Section title={m.appearance} icon={<Palette size={18} />}>
        <div className="sm:w-1/3">
          <SelectField
            legend={m.language}
            value={settings.language ?? currentLanguage}
            options={LANGUAGES}
            onChange={(v) => save.mutate({ language: v as Language })}
          />
        </div>
        <ThemePicker />
      </Section>

      <Section title={m.system} icon={<Package size={18} />}>
        <ToolsSettings />
        <div className="divider my-0" />
        <div className="flex items-center gap-3">
          <span className="text-sm">yt-dlp</span>
          <span className="badge badge-ghost font-mono">{ytdlpVersion.isPending ? '…' : ytdlpVersion.data || m.unknown}</span>
          <button onClick={() => updateYtdlp.mutate()} disabled={updateYtdlp.isPending} className="btn btn-sm ml-auto gap-1.5">
            {updateYtdlp.isPending ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />}
            {updateYtdlp.isPending ? m.updating : m.update}
          </button>
        </div>
        {updateYtdlp.isError && <p className="text-xs text-error">{m.updateFailed(updateYtdlp.error.message)}</p>}
        <ToggleRow
          label={m.autoUpdate}
          description={m.autoUpdateHint}
          checked={settings.autoUpdateYtdlp ?? true}
          onChange={(v) => updateAndSave('autoUpdateYtdlp', v)}
        />
        <div className="divider my-0" />
        <div className="flex items-center gap-3">
          <span>
            <span className="block text-sm">{m.logs}</span>
            <span className="block text-xs text-base-content/60">{m.logsHint}</span>
          </span>
          <button onClick={() => void appApi.openLogFolder()} className="btn btn-sm ml-auto gap-1.5">
            <FolderOpen size={14} /> {m.openLogs}
          </button>
        </div>
        <div className="divider my-0" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{m.app}</span>
          <span className="badge badge-ghost font-mono">{appVersion.data ?? '…'}</span>
          {flatpak ? (
            <span className="text-xs text-base-content/60" role="status">{m.flatpakUpdates}</span>
          ) : (
            <span className={`text-xs ${appUpdate.isError ? 'text-error' : 'text-base-content/60'}`} role="status">{appUpdateText}</span>
          )}
          {flatpak ? null : appUpdate.data ? (
            <button onClick={() => install.mutate(appUpdate.data!)} disabled={install.isPending} className="btn btn-sm btn-primary ml-auto">
              {install.isPending ? m.installing(install.percent ?? 0) : m.install}
            </button>
          ) : (
            <button onClick={() => void appUpdate.refetch()} disabled={appUpdate.isFetching} className="btn btn-sm ml-auto">
              {m.check}
            </button>
          )}
        </div>
        {appUpdate.data?.body && <p className="text-xs text-base-content/70 whitespace-pre-line">{appUpdate.data.body}</p>}
        {install.isError && <p className="text-xs text-error">{m.installFailed(install.error.message)}</p>}
        <p className="text-xs text-base-content/50">{save.isPending ? m.saving : m.autosave}</p>
      </Section>

      <Section title={m.about} icon={<Info size={18} />}>
        <p className="text-sm text-base-content/70 leading-relaxed">{legal.text}</p>
      </Section>
    </div>
  );
}
