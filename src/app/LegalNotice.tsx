import { Scale } from 'lucide-react';
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
    <div role="dialog" aria-modal="true" aria-labelledby="legal-title" className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex items-center gap-3 mb-3">
          <span className="grid place-items-center size-10 rounded-full bg-base-200">
            <Scale size={20} />
          </span>
          <h2 id="legal-title" className="text-lg font-bold">Kullanım koşulları</h2>
        </div>
        <p className="text-sm text-base-content/80 leading-relaxed">{LEGAL_TEXT}</p>
        <div className="modal-action">
          <button onClick={() => save.mutate({ legalAccepted: true })} className="btn btn-primary btn-block" autoFocus>
            Anladım, kabul ediyorum
          </button>
        </div>
      </div>
    </div>
  );
}
