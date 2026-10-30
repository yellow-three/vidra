import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { create } from 'zustand';
import { useLanguageCode, useT } from '../../i18n';
import { useAppVersion } from '../settings/appUpdate';
import { useSaveSettings, useSettings } from '../settings/queries';
import { missingTools, useToolsStatus } from '../setup/tools';
import { RELEASES, releasesSince } from './releases';

/** Pencere Ayarlar'dan ve kenar cubugundaki surumden de acilir. */
export const useWhatsNew = create<{ open: boolean }>()(() => ({ open: false }));
export const openWhatsNew = () => useWhatsNew.setState({ open: true });

/**
 * "Yenilikler": yeni surume gecilince bir kez kendiliginden acilir (kurulum ekrani ve kullanim
 * kosullari bittikten sonra); goruldugu surum ayarlara yazilir.
 */
export default function WhatsNew() {
  const t = useT();
  const m = t.whatsNew;
  const language = useLanguageCode();
  const open = useWhatsNew((s) => s.open);
  const settings = useSettings();
  const tools = useToolsStatus();
  const version = useAppVersion().data;
  const save = useSaveSettings();

  const ready = settings.isSuccess && settings.data.legalAccepted && tools.isSuccess && missingTools(tools.data).length === 0;
  const unseen = ready && !!version && settings.data.lastSeenVersion !== version && RELEASES.some((r) => r.version === version);
  useEffect(() => {
    if (unseen) useWhatsNew.setState({ open: true });
  }, [unseen]);

  if (!open) return null;
  const close = () => {
    useWhatsNew.setState({ open: false });
    if (version && settings.data?.lastSeenVersion !== version) save.mutate({ lastSeenVersion: version });
  };
  // Son gorulenden bu yana cikan surumler (birden fazla surum atlandiysa hepsi), yoksa yalnizca bu surum.
  const releases = releasesSince(settings.data?.lastSeenVersion, version);
  const release = releases[0];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" className="modal modal-open">
      <div className="modal-box max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 mb-3">
          <span className="grid place-items-center size-10 rounded-full bg-primary/15 text-primary shrink-0">
            <Sparkles size={20} />
          </span>
          <div>
            <h2 id="whats-new-title" className="text-lg font-bold">{m.title(release.version)}</h2>
            <p className="text-xs text-base-content/60">{new Date(release.date).toLocaleDateString(t.locale, { dateStyle: 'long' })}</p>
          </div>
        </div>
        <div className="overflow-y-auto flex flex-col gap-4 pr-1">
          {releases.map((r, i) => (
            <div key={r.version} className="flex flex-col gap-4">
              {i > 0 && <div className="divider my-0 text-xs">{m.older(r.version)}</div>}
              {r.notes[language].map((group) => (
                <section key={group.title}>
                  <h3 className="font-semibold text-sm mb-1">{group.title}</h3>
                  <ul className="list-disc pl-5 text-sm text-base-content/80 space-y-1">
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          ))}
        </div>
        <div className="modal-action">
          <button onClick={close} className="btn btn-primary" autoFocus>{m.close}</button>
        </div>
      </div>
    </div>
  );
}
