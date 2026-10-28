import PageHeader from '../../app/PageHeader';
import SettingsForm from './SettingsForm';
import { useT } from '../../i18n';

export default function SettingsPage() {
  const m = useT().settings;
  return (
    <div className="flex flex-col">
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <SettingsForm />
    </div>
  );
}
