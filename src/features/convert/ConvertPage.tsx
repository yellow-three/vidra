import ConvertForm from '../components/ConvertForm';

export default function Convert() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-wide">Dönüştür</h1>
        <p className="text-xs text-slate-400 mt-1">Yerel dosyaları farklı formatlara dönüştürün</p>
      </div>
      <ConvertForm />
    </div>
  );
}
