import { useState } from 'react';
import { Plus, RefreshCw, Rss, Trash2 } from 'lucide-react';
import PageHeader from '../../app/PageHeader';
import { engine } from '../../engine';
import { useT } from '../../i18n';
import type { Subscription } from '../../types';
import { isHttpUrl, videoKey } from '../queue/duplicates';
import { fetchHistory } from '../history/queries';
import { pickDefaultFormat } from '../queue/defaultFormat';
import { useQueueStore } from '../queue/store';
import { useSaveSettings, useSettings } from '../settings/queries';
import { ToggleRow } from '../settings/SettingsParts';
import { addSubscription, checkSubscription, removeSubscription } from './subscriptions';

type Status = { state: 'checking' } | { state: 'done'; fresh: number } | { state: 'error'; message: string };

/** Takip edilen kanal ve listeler: yeni videolar kontrol edilir, secim penceresinde isaretli gelir. */
export default function SubscriptionsPage() {
  const m = useT();
  const s = m.subscriptions;
  const settings = useSettings().data ?? {};
  const save = useSaveSettings();
  const subs = settings.subscriptions ?? [];
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [status, setStatus] = useState<Record<string, Status>>({});

  const check = async (sub: Subscription) => {
    setStatus((prev) => ({ ...prev, [sub.id]: { state: 'checking' } }));
    try {
      const fresh = await checkSubscription(sub);
      setStatus((prev) => ({ ...prev, [sub.id]: { state: 'done', fresh } }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, [sub.id]: { state: 'error', message: error instanceof Error ? error.message : String(error) } }));
    }
  };
  const checkAll = async () => {
    for (const sub of subs) await check(sub);
  };

  /** Eklerken mevcut videolar pencerede gosterilir; istenenler indirilir, sonrakiler "yeni" sayilir. */
  const add = async () => {
    const link = url.trim();
    if (!isHttpUrl(link)) {
      setAddError(m.addUrl.invalid);
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const info = await engine.getInfo(link, {
        cookiesFromBrowser: settings.cookiesFromBrowser || undefined, proxy: settings.proxy?.trim() || undefined, playlist: true,
      });
      if (!info.entries) throw new Error(s.notAList);
      await addSubscription(link, info, true);
      const downloaded = new Set((await fetchHistory().catch(() => [])).map((h) => videoKey(h.url)));
      useQueueStore.getState().offerPick({ info, formatId: pickDefaultFormat(info.formats, settings), downloaded, following: true });
      setUrl('');
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={s.title}
        subtitle={s.subtitle}
        actions={subs.length > 0 && (
          <button onClick={() => void checkAll()} className="btn btn-sm gap-1.5">
            <RefreshCw size={14} /> {s.checkAll}
          </button>
        )}
      />

      <section className="card bg-base-100 border border-base-300">
        <div className="card-body gap-3">
          <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="join w-full">
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setAddError(''); }}
              placeholder="https://www.youtube.com/@kanal"
              aria-label={s.urlLabel}
              className={`input join-item w-full ${addError ? 'input-error' : ''}`}
            />
            <button type="submit" disabled={adding || !url.trim()} className="btn btn-primary join-item gap-1.5">
              {adding ? <span className="loading loading-spinner loading-xs" /> : <Plus size={16} />} {s.add}
            </button>
          </form>
          <p className={`text-xs ${addError ? 'text-error' : 'text-base-content/60'}`}>{addError || s.hint}</p>
          <ToggleRow
            label={s.onStart}
            description={s.onStartHint}
            checked={settings.checkSubscriptionsOnStart ?? true}
            onChange={(v) => save.mutate({ checkSubscriptionsOnStart: v })}
          />
        </div>
      </section>

      {subs.length === 0 ? (
        <div className="grid place-items-center rounded-box border border-dashed border-base-300 py-16 text-center text-base-content/50">
          <div className="flex flex-col items-center gap-3">
            <Rss size={40} strokeWidth={1.5} />
            <p className="text-sm">{s.empty}</p>
          </div>
        </div>
      ) : (
        <ul className="list bg-base-100 rounded-box border border-base-300" aria-label={s.title}>
          {subs.map((sub) => {
            const st = status[sub.id];
            return (
              <li key={sub.id} className="list-row items-center">
                <Rss size={18} className="opacity-60" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{sub.title}</div>
                  <div className="text-xs text-base-content/50 truncate">{sub.url}</div>
                  <div className={`text-xs ${st?.state === 'error' ? 'text-error' : 'text-base-content/60'}`}>
                    {st?.state === 'checking'
                      ? s.checking
                      : st?.state === 'error'
                        ? st.message
                        : st?.state === 'done'
                          ? (st.fresh ? s.found(st.fresh) : s.nothingNew)
                          : sub.checkedAt ? s.lastChecked(new Date(sub.checkedAt).toLocaleString(m.locale)) : ''}
                  </div>
                </div>
                <button onClick={() => void check(sub)} disabled={st?.state === 'checking'} className="btn btn-sm btn-ghost gap-1.5">
                  <RefreshCw size={14} className={st?.state === 'checking' ? 'animate-spin' : ''} /> {s.check}
                </button>
                <button onClick={() => void removeSubscription(sub.id)} className="btn btn-sm btn-ghost btn-square" aria-label={s.remove}>
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
