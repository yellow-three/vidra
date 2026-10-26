import PageHeader from '../../app/PageHeader';
import ConvertForm from './ConvertForm';

export default function ConvertPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Dönüştür" subtitle="Bilgisayarınızdaki video ve ses dosyalarını başka formata çevirin." />
      <ConvertForm />
    </div>
  );
}
