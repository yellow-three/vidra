import HistoryList from './HistoryList';

export default function Downloads() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-wide">İndirilenler</h1>
        <p className="text-xs text-slate-400 mt-1">Tamamlanan indirmelerin geçmişi</p>
      </div>
      <HistoryList />
    </div>
  );
}
