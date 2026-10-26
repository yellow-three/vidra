import { useSaveSettings, useSettings } from '../features/settings/queries';

export const LEGAL_TEXT =
  'Bu uygulama yalnızca indirme hakkına sahip olduğunuz içerikler için tasarlanmıştır. ' +
  'İndirilen içeriklerin telif haklarına ve YouTube Hizmet Şartları’na uygun kullanılması tamamen kullanıcının sorumluluğundadır.';

/** Ilk acilista bir kez gosterilir; kabul ayarlara yazilir. */
export default function LegalNotice() {
  const { data: settings, isSuccess } = useSettings();
  const save = useSaveSettings();

  if (!isSuccess || settings.legalAccepted) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="legal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl space-y-4">
        <h2 id="legal-title" className="text-lg font-bold text-white">Kullanım koşulları</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{LEGAL_TEXT}</p>
        <button
          onClick={() => save.mutate({ legalAccepted: true })}
          className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl"
        >
          Anladım, kabul ediyorum
        </button>
      </div>
    </div>
  );
}
