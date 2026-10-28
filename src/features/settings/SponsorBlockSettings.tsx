import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Scissors, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import { appApi } from '../../lib/appApi';
import { refreshTools } from '../setup/tools';
import { useSaveSettings, useSettings } from './queries';
import { Section, SelectField } from './SettingsParts';

/** SponsorBlock yt-dlp'de ffprobe ister; ffprobe varsayilan olarak kurulmadigi icin istenirse indirilir. */
export default function SponsorBlockSettings() {
  const m = useT().sponsorBlock;
  const settings = useSettings().data ?? {};
  const save = useSaveSettings();
  const deps = useQuery({ queryKey: ['dependencies'], queryFn: () => appApi.checkDependencies() });
  const proxy = settings.proxy;
  const [percent, setPercent] = useState(0);
  const refresh = refreshTools;

  const install = useMutation({
    mutationFn: () => {
      setPercent(0);
      return appApi.installTool('ffprobe', { proxy }, setPercent);
    },
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: () => appApi.removeFfprobe(), onSettled: refresh });

  const installed = deps.data?.ffprobe ?? false;

  return (
    <Section title={m.title} icon={<Scissors size={18} />}>
      <p className="text-sm text-base-content/70">{m.description}</p>
      {installed ? (
        <>
          <div className="sm:w-1/2">
            <SelectField
              legend={m.mode}
              value={settings.sponsorBlock ?? 'off'}
              options={[['off', m.off], ['mark', m.mark], ['remove', m.remove]]}
              onChange={(v) => save.mutate({ sponsorBlock: v as 'off' | 'mark' | 'remove' })}
              hint={m.hint}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-base-content/60">
            <span className="status status-success" aria-hidden />
            <span>{m.installed}</span>
            <button onClick={() => remove.mutate()} disabled={remove.isPending} className="btn btn-ghost btn-xs gap-1 ml-auto">
              <Trash2 size={12} /> {m.uninstall}
            </button>
          </div>
        </>
      ) : (
        <div className="alert alert-soft flex flex-col items-stretch gap-3">
          <span className="text-sm">{m.needsFfprobe}</span>
          {install.isPending ? (
            <div className="flex items-center gap-3">
              <progress className="progress progress-primary flex-1" value={percent} max={100} aria-label={m.downloading} />
              <span className="text-xs font-semibold w-10 text-right">%{percent}</span>
            </div>
          ) : (
            <button onClick={() => install.mutate()} disabled={deps.isPending} className="btn btn-sm btn-primary gap-1.5 self-start">
              <Download size={14} /> {m.install}
            </button>
          )}
          {install.isError && <span className="text-xs text-error">{m.installFailed(String(install.error))}</span>}
        </div>
      )}
    </Section>
  );
}
