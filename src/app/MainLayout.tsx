import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import BrandMark from './BrandMark';
import { useT } from '../i18n';

const DRAWER_ID = 'app-drawer';

/** Genis pencerede kenar cubugu sabit, dar pencerede (min 900px) cekmece olarak acilir. */
export default function MainLayout() {
  const m = useT().nav;
  return (
    <div className="drawer lg:drawer-open h-screen">
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" aria-label={m.openMenu} />
      <div className="drawer-content flex flex-col min-h-0 bg-base-200">
        <div className="navbar lg:hidden bg-base-100 border-b border-base-300 min-h-14">
          <label htmlFor={DRAWER_ID} className="btn btn-ghost btn-square" aria-label={m.openMenu}>
            <Menu size={20} />
          </label>
          <BrandMark />
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-8 min-h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
      <div className="drawer-side z-20">
        <label htmlFor={DRAWER_ID} aria-label={m.closeMenu} className="drawer-overlay" />
        <Sidebar drawerId={DRAWER_ID} />
      </div>
    </div>
  );
}
