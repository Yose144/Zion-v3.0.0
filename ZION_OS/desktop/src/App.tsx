import { ThemeProvider } from './context/ThemeContext';
import { DashboardProvider } from './context/DashboardContext';
import Dashboard from './Dashboard';
import { LangProvider } from './i18n';

export default function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <DashboardProvider>
          <Dashboard />
        </DashboardProvider>
      </ThemeProvider>
    </LangProvider>
  );
}
