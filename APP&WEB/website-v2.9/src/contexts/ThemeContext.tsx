'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeName = 'cosmic' | 'matrix' | 'cyberpunk' | 'sacred';

interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
}

const themes: Record<ThemeName, Theme> = {
  cosmic: {
    name: 'cosmic',
    displayName: 'Cosmic (Default)',
    colors: {
      primary: '#fcd116', // Gold
      secondary: '#e41e2b', // Purple
      accent: '#078930', // Cyan
      background: '#0a0118',
      text: '#e0e0e0',
    },
    fonts: {
      heading: 'Inter, sans-serif',
      body: 'Inter, sans-serif',
      mono: 'monospace',
    },
  },
  matrix: {
    name: 'matrix',
    displayName: 'Matrix Code',
    colors: {
      primary: '#00ff41', // Matrix Green
      secondary: '#00eaff', // Cyan
      accent: '#ff2dfb', // Magenta
      background: '#0d0208',
      text: '#e0e0e0',
    },
    fonts: {
      heading: 'Orbitron, sans-serif',
      body: 'Share Tech Mono, monospace',
      mono: 'Share Tech Mono, monospace',
    },
  },
  cyberpunk: {
    name: 'cyberpunk',
    displayName: 'Cyberpunk 2077',
    colors: {
      primary: '#fcee09', // Yellow
      secondary: '#00f0ff', // Cyan
      accent: '#ff006e', // Hot Pink
      background: '#0a0a0a',
      text: '#f0f0f0',
    },
    fonts: {
      heading: 'Rajdhani, sans-serif',
      body: 'Rajdhani, sans-serif',
      mono: 'Courier New, monospace',
    },
  },
  sacred: {
    name: 'sacred',
    displayName: 'Sacred Geometry',
    colors: {
      primary: '#d4af37', // Ancient Gold
      secondary: '#4a148c', // Deep Purple
      accent: '#00897b', // Teal
      background: '#1a1a2e',
      text: '#f5f5f5',
    },
    fonts: {
      heading: 'Cinzel, serif',
      body: 'Lora, serif',
      mono: 'monospace',
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeName: ThemeName) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return themes.cosmic;
  }
  const savedTheme = localStorage.getItem('zion-theme') as ThemeName | null;
  if (savedTheme && themes[savedTheme]) {
    return themes[savedTheme];
  }
  return themes.cosmic;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    // Apply theme CSS variables
    const root = document.documentElement;
    root.style.setProperty('--color-primary', currentTheme.colors.primary);
    root.style.setProperty('--color-secondary', currentTheme.colors.secondary);
    root.style.setProperty('--color-accent', currentTheme.colors.accent);
    root.style.setProperty('--color-background', currentTheme.colors.background);
    root.style.setProperty('--color-text', currentTheme.colors.text);
    root.style.setProperty('--font-heading', currentTheme.fonts.heading);
    root.style.setProperty('--font-body', currentTheme.fonts.body);
    root.style.setProperty('--font-mono', currentTheme.fonts.mono);

    // Update body text color; background is handled by BackgroundOrchestrator
    document.body.style.color = currentTheme.colors.text;
  }, [currentTheme]);

  useEffect(() => {
    localStorage.setItem('zion-theme', currentTheme.name);
  }, [currentTheme.name]);

  const setTheme = (themeName: ThemeName) => {
    const theme = themes[themeName];
    if (theme) {
      setCurrentTheme(theme);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        availableThemes: Object.values(themes),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
