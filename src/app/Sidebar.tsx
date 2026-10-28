import { NavLink } from 'react-router-dom';
import { Download, History, Moon, Repeat, Settings, Sun, type LucideIcon } from 'lucide-react';
import BrandMark from './BrandMark';
import { APP_THEMES, isDarkTheme, useTheme } from './ThemeContext';
import { useQueueStore } from '../features/queue/store';
import { useAppVersion } from '../features/settings/appUpdate';

const LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'İndir', icon: Download },
  { to: '/downloads', label: 'Geçmiş', icon: History },
  { to: '/convert', label: 'Dönüştür', icon: Repeat },
  { to: '/settings', label: 'Ayarlar', icon: Settings },
];

export default function Sidebar({ drawerId }: { drawerId: string }) {
  const { resolved, setTheme } = useTheme();
  const active = useQueueStore((s) => s.tasks.filter((t) => t.status === 'downloading').length);
  const version = useAppVersion().data;
  const dark = isDarkTheme(resolved);

  // Dar pencerede cekmece, sayfa secilince kapanir.
  const closeDrawer = () => {
    const toggle = document.getElementById(drawerId) as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  };

  return (
    <aside className="w-60 min-h-full bg-base-100 border-r border-base-300 flex flex-col">
      <div className="h-16 flex items-center px-4">
        <BrandMark />
      </div>

      <nav aria-label="Ana menü" className="flex-1">
        <ul className="menu w-full gap-1 px-3">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} onClick={closeDrawer} className={({ isActive }) => (isActive ? 'menu-active' : '')}>
                <Icon size={18} />
                {label}
                {to === '/' && active > 0 && (
                  <span className="badge badge-sm badge-primary ml-auto" aria-label={`${active} indirme sürüyor`}>{active}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-base-300 flex items-center justify-between">
        <span className="text-xs text-base-content/50">{version ? `v${version}` : ''}</span>
        <label className="swap swap-rotate btn btn-ghost btn-sm btn-circle" aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}>
          <input
            type="checkbox"
            checked={!dark}
            onChange={() => setTheme(dark ? APP_THEMES.light : APP_THEMES.dark)}
          />
          <Sun size={16} className="swap-on" />
          <Moon size={16} className="swap-off" />
        </label>
      </div>
    </aside>
  );
}
