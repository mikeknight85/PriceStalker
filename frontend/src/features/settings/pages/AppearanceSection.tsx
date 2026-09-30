import { useTheme, ThemeMode } from '../../../context/ThemeContext';
import { useLayoutMode, LayoutMode } from '../../../context/LayoutContext';

const THEME_MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow system preference' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

const LAYOUT_MODES: { value: LayoutMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Choose the layout from the window width' },
  { value: 'desktop', label: 'Desktop', hint: 'Always use the desktop layout, whatever the width' },
  { value: 'mobile', label: 'Mobile', hint: 'Always use the compact layout, whatever the width' },
];

export default function AppearanceSection() {
  const { mode: themeMode, setMode: setThemeMode, backgroundParticles, setBackgroundParticles } = useTheme();
  const { mode: layoutMode, setMode: setLayoutMode } = useLayoutMode();

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Theme</h2>
      <p className="settings-card-description">
        Choose a color theme, or let it follow your operating system. Applied
        immediately on this device.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {THEME_MODES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`btn btn-sm ${themeMode === t.value ? 'btn-primary' : 'btn-secondary'}`}
            title={t.hint}
            onClick={() => setThemeMode(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <h2 className="settings-card-title" style={{ marginTop: '2rem' }}>Layout</h2>
      <p className="settings-card-description">
        Normally the layout follows the width of the window. Some tablets report
        a narrow width even with the browser set to request the desktop site,
        which leaves them on the compact layout; choose Desktop here to override
        that. A forced desktop layout scrolls sideways on a narrow screen.
        Applied immediately on this device.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {LAYOUT_MODES.map((l) => (
          <button
            key={l.value}
            type="button"
            className={`btn btn-sm ${layoutMode === l.value ? 'btn-primary' : 'btn-secondary'}`}
            title={l.hint}
            aria-pressed={layoutMode === l.value}
            onClick={() => setLayoutMode(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <h2 className="settings-card-title" style={{ marginTop: '2rem' }}>Background Animations</h2>
      <p className="settings-card-description">
        Display subtle floating particle animations across page backgrounds.
        Turning this off saves battery and GPU resources on lower-powered devices.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${backgroundParticles ? 'btn-primary' : 'btn-secondary'}`}
          title="Enable background particle animations"
          onClick={() => setBackgroundParticles(true)}
        >
          Enabled
        </button>
        <button
          type="button"
          className={`btn btn-sm ${!backgroundParticles ? 'btn-primary' : 'btn-secondary'}`}
          title="Disable background particle animations"
          onClick={() => setBackgroundParticles(false)}
        >
          Disabled
        </button>
      </div>
    </section>
  );
}
