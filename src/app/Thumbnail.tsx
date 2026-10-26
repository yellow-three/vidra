import { useState } from 'react';
import { FileAudio, FileVideo } from 'lucide-react';

/** YouTube kucuk resmi; yoksa ya da yuklenemezse (ag hatasi) dosya turu simgesi. */
export default function Thumbnail({ src, audio = false, loading = false, className = '' }: {
  src?: string | null;
  audio?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = audio ? FileAudio : FileVideo;

  return (
    <figure className={`aspect-video shrink-0 rounded-lg overflow-hidden bg-base-300 grid place-items-center ${className}`}>
      {loading ? (
        <div className="skeleton size-full rounded-none" />
      ) : src && !failed ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Icon size={20} className="opacity-40" />
      )}
    </figure>
  );
}
