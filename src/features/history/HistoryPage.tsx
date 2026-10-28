import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import PageHeader from '../../app/PageHeader';
import HistoryList from './HistoryList';
import { useClearHistory, useHistory } from './queries';

export default function HistoryPage() {
  const count = useHistory().data?.length ?? 0;
  const clearAll = useClearHistory();
  const confirmRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Geçmiş"
        subtitle={count ? `${count} tamamlanan indirme` : 'Tamamlanan indirmeler burada listelenir.'}
        actions={count > 0 && (
          <button onClick={() => confirmRef.current?.showModal()} className="btn btn-sm btn-ghost text-error gap-1.5">
            <Trash2 size={14} /> Tümünü temizle
          </button>
        )}
      />
      <HistoryList />

      <dialog ref={confirmRef} className="modal" aria-labelledby="clear-title">
        <div className="modal-box max-w-sm">
          <h3 id="clear-title" className="text-lg font-bold">Geçmiş temizlensin mi?</h3>
          <p className="py-3 text-sm text-base-content/70">Kayıtlar silinir; indirdiğiniz dosyalar diskte kalır.</p>
          <form method="dialog" className="modal-action">
            <button className="btn btn-ghost">Vazgeç</button>
            <button className="btn btn-error" onClick={() => clearAll.mutate()}>Temizle</button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>kapat</button></form>
      </dialog>
    </div>
  );
}
