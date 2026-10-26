import { Play } from 'lucide-react';

/** Kirmizi "oynat" rozeti + uygulama adi. */
export default function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid place-items-center size-8 rounded-lg bg-primary text-primary-content shadow-sm">
        <Play size={16} fill="currentColor" strokeWidth={0} />
      </span>
      <span className="font-semibold tracking-tight leading-none">
        YouTube<span className="text-base-content/60 font-normal"> Downloader</span>
      </span>
    </div>
  );
}
