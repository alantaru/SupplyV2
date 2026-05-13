import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import api from '../lib/api';

const ThemeContext = createContext();

export const ACCENT_COLORS = {
    indigo: { name: 'Indigo', value: '79 70 229' },
    blue: { name: 'Azul', value: '37 99 235' },
    emerald: { name: 'Verde', value: '5 150 105' },
    rose: { name: 'Rosa', value: '225 29 72' },
    amber: { name: 'Laranja', value: '217 119 6' },
};

export function ThemeProvider({ children }) {
    const { user } = useAuth();

    // Initialize from localStorage first (fastest), then sync from user
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [accent, setAccent] = useState(() => localStorage.getItem('accent') || 'indigo');

    // When user loads/changes, sync their saved preferences
    useEffect(() => {
        if (!user) return;
        // User backend preferences take priority on login
        if (user.theme && user.theme !== theme) {
            setTheme(user.theme);
        }
        if (user.accent && user.accent !== accent) {
            setAccent(user.accent);
        }
    }, [user, theme, accent]); // Sync when user, theme or accent changes

    // Apply theme to DOM
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Apply accent color to DOM
    useEffect(() => {
        const root = window.document.documentElement;
        const colorValue = ACCENT_COLORS[accent]?.value || ACCENT_COLORS.indigo.value;
        root.style.setProperty('--color-primary', colorValue);
        localStorage.setItem('accent', accent);
    }, [accent]);

    const updateBackend = async (updates) => {
        if (!user) return;
        try { await api.put('auth/me', updates); } catch { /* silent */ }
    };

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            updateBackend({ theme: next });
            return next;
        });
    };

    const changeAccent = (newAccent) => {
        setAccent(newAccent);
        updateBackend({ accent: newAccent });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent: changeAccent, ACCENT_COLORS }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
