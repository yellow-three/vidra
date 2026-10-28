import type { ReactNode } from 'react';

export function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="card bg-base-100 border border-base-300">
      <div className="card-body gap-4">
        <h2 className="card-title text-base gap-2">{icon}{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-base-content/60">{description}</span>
      </span>
      <input type="checkbox" className="toggle toggle-sm" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

interface SelectFieldProps {
  legend: string;
  value: string;
  options: [value: string, label: string][];
  onChange: (value: string) => void;
  hint?: string;
}

export function SelectField({ legend, value, options, onChange, hint }: SelectFieldProps) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{legend}</legend>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="select w-full">
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      {hint && <p className="label whitespace-normal">{hint}</p>}
    </fieldset>
  );
}
