import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ColorMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ColorMode
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleMode: () => {},
})

const STORAGE_KEY = 'cf-color-mode'

function getInitialMode(): ColorMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(getInitialMode)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggleMode = () => setMode(prev => prev === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  return useContext(ThemeContext)
}
