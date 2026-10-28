import PageHeader from '../../app/PageHeader';
import ConvertForm from './ConvertForm';
import { useT } from '../../i18n';

export default function ConvertPage() {
  const m = useT().convert;
  return (
    <div className="flex flex-col">
      <PageHeader title={m.title} subtitle={m.subtitle} />
      <ConvertForm />
    </div>
  );
}
