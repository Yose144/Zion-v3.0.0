import { ThemeProvider } from './context/ThemeContext';
import { DashboardProvider } from './context/DashboardContext';
import Dashboard from './Dashboard';

export default function App() {
  return (
    <ThemeProvider>
      <DashboardProvider>
        <Dashboard />
      </DashboardProvider>
    </ThemeProvider>
  );
}
