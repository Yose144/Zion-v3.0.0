import './index.css';
import { useEffect } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { useSettingsStore } from './stores/settingsStore';

function ThemeSync() {
  const theme = useSettingsStore(s => s.theme);

  useEffect(() => {
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
        : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [theme]);

  return null;
}

function App() {
  return (
    <>
      <ThemeSync />
      <DashboardLayout />
    </>
  );
}

export default App;
