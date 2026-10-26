import PageHeader from '../../app/PageHeader';
import SettingsForm from './SettingsForm';

export default function SettingsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Ayarlar" subtitle="İndirme, görünüm ve güncelleme tercihleri." />
      <SettingsForm />
    </div>
  );
}
