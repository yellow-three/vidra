import SettingsForm from './SettingsForm';

export default function Settings() {
  return (
    <div className="flex-1 overflow-y-auto">
      <h1 className="text-2xl font-bold text-white tracking-wide">Ayarlar</h1>
      <p className="text-xs text-slate-400 mt-1">Uygulama yapılandırması</p>
      <div className="mt-6">
        <SettingsForm />
      </div>
    </div>
  );
}
