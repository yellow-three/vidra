import { useState } from 'react';
import { ListVideo, Search } from 'lucide-react';
import { formatClock } from '../../engine/ytdlp';
import { useT } from '../../i18n';
import { videoKey } from './duplicates';
import { useQueueStore, type PlaylistPick } from './store';
import { addSubscription } from '../subscriptions/subscriptions';

/**
 * Oynatma listesi linki verilince videolar dogrudan kuyruga eklenmez; bu pencerede listelenir,
 * kullanici eklemek istediklerini secer. Daha once indirilenler isaretsiz gelir.
 * Birden fazla liste ayni anda analiz edilirse sirayla sorulur.
 */
const SHORT_SECONDS = 60;

export default function PlaylistPicker() {
  const pick = useQueueStore((s) => s.playlistPicks[0]);
  // Liste degisince secim sifirlansin diye her liste kendi bileseniyle acilir.
  return pick ? <Picker key={pick.taskId} pick={pick} /> : null;
}

function Picker({ pick }: { pick: PlaylistPick }) {
  const m = useT();
  const p = m.playlist;
  const entries = pick.info.entries ?? [];
  const { confirmPlaylist, dismissPlaylist } = useQueueStore.getState();
  // Abonelik kontrolunde yalnizca yeni videolar, aksi halde indirilmemis olanlar isaretli gelir.
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(entries.flatMap((e, i) => (
      (pick.fresh ? pick.fresh.has(e.url) : !pick.downloaded.has(videoKey(e.url))) ? [i] : []))),
  );
  const [follow, setFollow] = useState(false);
  const [query, setQuery] = useState('');
  const [reverse, setReverse] = useState(false);
  const [dateAfter, setDateAfter] = useState('');
  const q = query.trim().toLocaleLowerCase(m.locale);
  const shown = entries.map((e, i) => ({ e, i })).filter(({ e }) => !q || e.title.toLocaleLowerCase(m.locale).includes(q));
  const allShownChecked = shown.length > 0 && shown.every(({ i }) => checked.has(i));

  const toggle = (i: number) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  const setShown = (on: boolean) => setChecked((prev) => {
    const next = new Set(prev);
    for (const { i } of shown) if (on) next.add(i); else next.delete(i);
    return next;
  });
  const add = () => {
    // Takip edilen listede pencerede gorulen videolar bir sonraki kontrolde yeni sayilmaz.
    if (follow) void addSubscription(pick.info.url, pick.info, true);
    confirmPlaylist(pick.taskId, entries.filter((_, i) => checked.has(i)).map((e) => e.url), {
      reverse,
      dateAfter: dateAfter ? dateAfter.replace(/-/g, '') : undefined,
    });
  };
  /** Kisa videolar (Shorts): suresi bilinen ve en fazla bir dakika olanlar. */
  const shorts = entries.flatMap((e, i) => (e.duration != null && e.duration <= SHORT_SECONDS ? [i] : []));
  const skipShorts = () => setChecked((prev) => new Set([...prev].filter((i) => !shorts.includes(i))));
  const selectFirst = (n: number) => setChecked(new Set(shown.slice(0, n).map(({ i }) => i)));

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="playlist-title" className="modal modal-open">
      <div className="modal-box max-w-2xl flex flex-col max-h-[85vh] p-0">
        <div className="px-6 pt-6 pb-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center size-10 rounded-full bg-base-200 shrink-0">
              <ListVideo size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="playlist-title" className="text-lg font-bold truncate">{pick.info.title}</h2>
              <p className="text-sm text-base-content/70">
                {pick.fresh ? p.freshIntro(pick.fresh.size, entries.length) : p.intro(entries.length)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="input input-sm flex-1">
              <Search size={14} className="opacity-50" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={p.search} aria-label={p.search} />
            </label>
            <button onClick={() => setShown(!allShownChecked)} className="btn btn-sm btn-ghost">
              {allShownChecked ? p.selectNone : p.selectAll}
            </button>
          </div>
        </div>

        <div className="px-6 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <select
            className="select select-xs w-auto"
            value=""
            onChange={(e) => e.target.value && selectFirst(Number(e.target.value))}
            aria-label={p.selectFirst}
          >
            <option value="">{p.selectFirst}</option>
            {[10, 25, 50, 100].filter((n) => n < entries.length).map((n) => <option key={n} value={n}>{p.first(n)}</option>)}
          </select>
          {shorts.length > 0 && (
            <button onClick={skipShorts} className="btn btn-xs btn-ghost">{p.skipShorts(shorts.length)}</button>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-xs" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
            {p.reverse}
          </label>
          <label className="flex items-center gap-2">
            {p.dateAfter}
            <input type="date" className="input input-xs w-36" value={dateAfter} onChange={(e) => setDateAfter(e.target.value)} aria-label={p.dateAfter} />
          </label>
        </div>

        <ul className="list overflow-y-auto border-y border-base-300 flex-1 min-h-0" aria-label={p.entries}>
          {shown.map(({ e, i }) => (
            <li key={i} className="list-row items-center py-2 px-6">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={checked.has(i)}
                onChange={() => toggle(i)}
                aria-label={e.title}
              />
              <div className="min-w-0">
                <div className="text-sm truncate" title={e.title}>{i + 1}. {e.title}</div>
                {pick.fresh?.has(e.url) && <span className="badge badge-primary badge-xs mr-1">{p.fresh}</span>}
                {pick.downloaded.has(videoKey(e.url)) && <span className="badge badge-ghost badge-xs">{p.downloaded}</span>}
              </div>
              <span className="text-xs text-base-content/60 tabular-nums">{e.duration != null ? formatClock(e.duration) : ''}</span>
            </li>
          ))}
        </ul>

        <div className="modal-action px-6 pb-6 mt-3 items-center">
          {pick.following && <span className="text-sm text-base-content/60 mr-auto">{p.following}</span>}
          {!pick.fresh && !pick.following && (
            <label className="flex items-center gap-2 text-sm mr-auto cursor-pointer">
              <input type="checkbox" className="checkbox checkbox-sm" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              {p.follow}
            </label>
          )}
          <button onClick={() => dismissPlaylist(pick.taskId)} className="btn btn-ghost">{p.cancel}</button>
          <button onClick={add} disabled={checked.size === 0} className="btn btn-primary">{p.add(checked.size)}</button>
        </div>
      </div>
    </div>
  );
}
