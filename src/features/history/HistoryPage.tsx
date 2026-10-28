import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import PageHeader from '../../app/PageHeader';
import HistoryList from './HistoryList';
import { useClearHistory, useHistory } from './queries';
import { useT } from '../../i18n';

export default function HistoryPage() {
  const m = useT().history;
  const count = useHistory().data?.length ?? 0;
  const clearAll = useClearHistory();
  const confirmRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={m.title}
        subtitle={m.subtitle(count)}
        actions={count > 0 && (
          <button onClick={() => confirmRef.current?.showModal()} className="btn btn-sm btn-ghost text-error gap-1.5">
            <Trash2 size={14} /> {m.clearAll}
          </button>
        )}
      />
      <HistoryList />

      <dialog ref={confirmRef} className="modal" aria-labelledby="clear-title">
        <div className="modal-box max-w-sm">
          <h3 id="clear-title" className="text-lg font-bold">{m.confirmTitle}</h3>
          <p className="py-3 text-sm text-base-content/70">{m.confirmBody}</p>
          <form method="dialog" className="modal-action">
            <button className="btn btn-ghost">{m.confirmCancel}</button>
            <button className="btn btn-error" onClick={() => clearAll.mutate()}>{m.confirmOk}</button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>{m.close}</button></form>
      </dialog>
    </div>
  );
}
