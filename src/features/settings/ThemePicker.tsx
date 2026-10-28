import { Check } from 'lucide-react';
import { APP_THEMES, DAISY_THEMES, useTheme } from '../../app/ThemeContext';
import { useT } from '../../i18n';

const capitalize = (theme: string) => theme.charAt(0).toUpperCase() + theme.slice(1);

/** Her secenek kendi temasiyla (data-theme) cizilir; kullanici rengi secmeden gorur. */
export default function ThemePicker() {
  const { theme, resolved, setTheme } = useTheme();
  const options = ['system', APP_THEMES.dark, APP_THEMES.light, ...DAISY_THEMES];
  const m = useT().settings;
  const labels: Record<string, string> = { system: m.themeSystem, [APP_THEMES.dark]: m.themeDark, [APP_THEMES.light]: m.themeLight };
  const label = (theme: string) => labels[theme] ?? capitalize(theme);

  return (
    <div role="radiogroup" aria-label={m.theme} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
      {options.map((option) => {
        const active = option === theme;
        const preview = option === 'system' ? resolved : option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option)}
            className={`rounded-box border-2 overflow-hidden text-left transition-colors ${
              active ? 'border-primary' : 'border-base-300 hover:border-base-content/30'
            }`}
          >
            <div data-theme={preview} className="bg-base-100 text-base-content px-3 py-2.5 flex items-center gap-2">
              <span className="flex gap-1 shrink-0" aria-hidden>
                <span className="size-3 rounded-full bg-primary" />
                <span className="size-3 rounded-full bg-secondary" />
                <span className="size-3 rounded-full bg-accent" />
                <span className="size-3 rounded-full bg-neutral" />
              </span>
              <span className="text-xs font-medium truncate flex-1">{label(option)}</span>
              {active && <Check size={14} className="shrink-0" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
