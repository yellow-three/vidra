import { useState } from 'react';
import {
  FILENAME_FIELDS, FILENAME_PRESETS, patternError, previewFilename, type FilenameField, type FilenameSample,
} from '../../engine/filename';
import { useT } from '../../i18n';

/** Secimde gosterilen hazir kaliplar (eski ayar anahtari `uploader-title` haric). */
const PRESET_KEYS = ['title', 'channel-title', 'title-id', 'channel-title-id', 'date-title', 'channel-date-title'] as const;
const FIELDS = Object.keys(FILENAME_FIELDS) as FilenameField[];

interface FilenamePickerProps {
  /** Gecerli kalip; `undefined` varsayilani (`defaultLabel`) secer. */
  value: string | undefined;
  onChange: (pattern: string | undefined) => void;
  /** Verilirse listede "Varsayilan" secenegi olur (video basina secimde). */
  defaultLabel?: string;
  sample?: FilenameSample;
  /** Cozunurluk gibi sabit ekler; onizlemede gosterilir. */
  suffix?: string;
  /** "Varsayilan" secilince onizlenen kalip. */
  defaultPattern?: string;
}

/** Hazir kaliplar ya da alan dugmeleriyle yazilan ozel kalip, canli onizlemeyle. */
export default function FilenamePicker({
  value, onChange, defaultLabel, sample = {}, suffix = '', defaultPattern = FILENAME_PRESETS.title,
}: FilenamePickerProps) {
  const m = useT().filename;
  const preset = value === undefined ? 'default' : PRESET_KEYS.find((k) => FILENAME_PRESETS[k] === value) ?? 'custom';
  const [custom, setCustom] = useState(preset === 'custom' ? value ?? '' : '');
  const [editing, setEditing] = useState(preset === 'custom');
  const shown = editing ? 'custom' : preset;
  const error = editing ? patternError(custom) : null;
  const example = previewFilename(editing ? custom : value ?? defaultPattern, sample, m.fields);

  const select = (key: string) => {
    if (key === 'custom') {
      setEditing(true);
      setCustom(value ?? FILENAME_PRESETS.title);
      return;
    }
    setEditing(false);
    onChange(key === 'default' ? undefined : FILENAME_PRESETS[key]);
  };
  const edit = (text: string) => {
    setCustom(text);
    if (!patternError(text)) onChange(text.trim());
  };

  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{m.legend}</legend>
      <select value={shown} onChange={(e) => select(e.target.value)} className="select select-sm w-full" aria-label={m.legend}>
        {defaultLabel && <option value="default">{defaultLabel}</option>}
        {PRESET_KEYS.map((k) => <option key={k} value={k}>{m.presets[k]}</option>)}
        <option value="custom">{m.custom}</option>
      </select>
      {editing && (
        <>
          <input
            value={custom}
            onChange={(e) => edit(e.target.value)}
            className={`input input-sm w-full font-mono ${error ? 'input-error' : ''}`}
            aria-label={m.customLabel}
            aria-invalid={!!error}
            placeholder="{channel} - {title}"
          />
          <div className="flex flex-wrap gap-1" role="group" aria-label={m.insert}>
            {FIELDS.map((f) => (
              <button key={f} type="button" onClick={() => edit(`${custom}{${f}}`)} className="btn btn-xs btn-soft">
                + {m.fields[f]}
              </button>
            ))}
          </div>
        </>
      )}
      <p className={`label whitespace-normal break-all ${error ? 'text-error' : ''}`}>
        {error ? m.errors[error] : m.preview(`${example}${suffix}`)}
      </p>
    </fieldset>
  );
}
