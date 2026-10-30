import { useRef } from 'react';
import { Check, Palette } from 'lucide-react';
import { APP_THEMES, DAISY_THEMES, isDarkTheme, useTheme } from '../../app/ThemeContext';
import { useT } from '../../i18n';
import { useSaveSettings, useSettings } from './queries';
import { SelectField } from './SettingsParts';

const capitalize = (theme: string) => theme.charAt(0).toUpperCase() + theme.slice(1);
const ALL_THEMES = [APP_THEMES.dark, APP_THEMES.light, ...DAISY_THEMES];

function useThemeLabel() {
  const m = useT().settings;
  const labels: Record<string, string> = { system: m.themeSystem, [APP_THEMES.dark]: m.themeDark, [APP_THEMES.light]: m.themeLight };
  return (theme: string) => labels[theme] ?? capitalize(theme);
}

/** Bir temanin kendi renkleriyle cizilen ornegi. */
function Swatch({ theme, label, active }: { theme: string; label: string; active?: boolean }) {
  return (
    <div data-theme={theme} className="bg-base-100 text-base-content px-3 py-2.5 flex items-center gap-2">
      <span className="flex gap-1 shrink-0" aria-hidden>
        <span className="size-3 rounded-full bg-primary" />
        <span className="size-3 rounded-full bg-secondary" />
        <span className="size-3 rounded-full bg-accent" />
        <span className="size-3 rounded-full bg-neutral" />
      </span>
      <span className="text-xs font-medium truncate flex-1">{label}</span>
      {active && <Check size={14} className="shrink-0" />}
    </div>
  );
}

/**
 * Secili tema ve "Degistir" dugmesi; temalar pencerede secilir (liste uzun, Ayarlar kisa kalsin).
 * "Sistem" seciliyken isletim sisteminin acik ve koyu modunda kullanilacak temalar ayrica secilir.
 */
export default function ThemePicker() {
  const { theme, resolved, setTheme } = useTheme();
  const settings = useSettings().data ?? {};
  const save = useSaveSettings();
  const m = useT().settings;
  const label = useThemeLabel();
  const dialog = useRef<HTMLDialogElement>(null);
  const options = ['system', ...ALL_THEMES];
  const lightThemes = ALL_THEMES.filter((t) => !isDarkTheme(t));
  const darkThemes = ALL_THEMES.filter((t) => isDarkTheme(t));

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="fieldset">
        <legend className="fieldset-legend">{m.theme}</legend>
        <div className="flex items-center gap-2">
          <div className="rounded-box border border-base-300 overflow-hidden w-56">
            <Swatch theme={resolved} label={label(theme)} />
          </div>
          <button type="button" onClick={() => dialog.current?.showModal()} className="btn btn-sm gap-1.5" aria-label={m.changeThemeLabel}>
            <Palette size={14} /> {m.changeTheme}
          </button>
        </div>
      </fieldset>
      {theme === 'system' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField
            legend={m.themeForLight}
            value={settings.themeLight || APP_THEMES.light}
            options={lightThemes.map((t) => [t, label(t)])}
            onChange={(v) => save.mutate({ themeLight: v })}
          />
          <SelectField
            legend={m.themeForDark}
            value={settings.themeDark || APP_THEMES.dark}
            options={darkThemes.map((t) => [t, label(t)])}
            onChange={(v) => save.mutate({ themeDark: v })}
          />
        </div>
      )}

      <dialog ref={dialog} className="modal" aria-labelledby="theme-title">
        <div className="modal-box max-w-3xl">
          <h3 id="theme-title" className="text-lg font-bold mb-3">{m.theme}</h3>
          <div role="radiogroup" aria-label={m.theme} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto p-1">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === theme}
                onClick={() => setTheme(option)}
                className={`rounded-box border-2 overflow-hidden text-left transition-colors ${
                  option === theme ? 'border-primary' : 'border-base-300 hover:border-base-content/30'
                }`}
              >
                <Swatch theme={option === 'system' ? resolved : option} label={label(option)} active={option === theme} />
              </button>
            ))}
          </div>
          <div className="modal-action">
            <form method="dialog"><button className="btn">{m.done}</button></form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>{m.done}</button></form>
      </dialog>
    </div>
  );
}
