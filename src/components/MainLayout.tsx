import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-body)] flex font-sans select-none">
      <Sidebar />
      <div className="flex-1 p-8 flex flex-col min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
