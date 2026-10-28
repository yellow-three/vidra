import { useState } from 'react';
import { Scissors, X } from 'lucide-react';
import { formatClock, parseClock } from '../../engine/ytdlp';
import type { Task } from '../../types';
import { useQueueStore } from './store';
import { useT } from '../../i18n';

/** Videonun yalnizca bir araligini indirmek icin baslangic/bitis; bos bitis sonuna kadar demektir. */
export default function SectionPicker({ task }: { task: Task }) {
  const m = useT().section;
  const [open, setOpen] = useState(Boolean(task.section));
  const [start, setStart] = useState(task.section ? formatClock(task.section.start) : '');
  const [end, setEnd] = useState(task.section?.end != null ? formatClock(task.section.end) : '');
  const setSection = useQueueStore((s) => s.setSection);

  const startSec = start.trim() ? parseClock(start) : 0;
  const endSec = end.trim() ? parseClock(end) : undefined;
  const error = startSec === null || endSec === null
    ? m.badTime
    : endSec !== undefined && endSec <= startSec
      ? m.endBeforeStart
      : '';

  const apply = () => {
    if (error || startSec === null || endSec === null) return;
    setSection(task.id, startSec === 0 && endSec === undefined ? undefined : { start: startSec, end: endSec });
  };

  const close = () => {
    setOpen(false);
    setStart('');
    setEnd('');
    setSection(task.id, undefined);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-xs gap-1 self-start">
        <Scissors size={14} /> {m.open}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Scissors size={14} className="opacity-60" />
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          onBlur={apply}
          placeholder="0:00"
          aria-label={m.start}
          className={`input input-xs w-20 font-mono ${error && startSec === null ? 'input-error' : ''}`}
        />
        <span aria-hidden>–</span>
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          onBlur={apply}
          placeholder={m.endPlaceholder}
          aria-label={m.end}
          className={`input input-xs w-20 font-mono ${error && startSec !== null ? 'input-error' : ''}`}
        />
        <button onClick={close} className="btn btn-ghost btn-xs btn-square" aria-label={m.whole}>
          <X size={14} />
        </button>
      </div>
      <p className={`text-xs ${error ? 'text-error' : 'text-base-content/50'}`}>
        {error || m.hint}
      </p>
    </div>
  );
}
