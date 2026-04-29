import { useState, useCallback } from 'react';

const MIN_WIDTH = 60;
const MAX_WIDTH = 600;

export function clampWidth(value) {
    const n = Number(value);
    if (isNaN(n)) return MIN_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

export function useColumnWidths(storageKey, defaultWidths = {}) {
    const lsKey = `${storageKey}_widths`;

    const [widths, setWidths] = useState(() => {
        try {
            const saved = localStorage.getItem(lsKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (_) {
            // silent fallback
        }
        return defaultWidths;
    });

    const setColumnWidth = useCallback((key, rawWidth) => {
        const clamped = clampWidth(rawWidth);
        setWidths(prev => {
            const next = { ...prev, [key]: clamped };
            try {
                localStorage.setItem(lsKey, JSON.stringify(next));
            } catch (_) {
                // silent fallback
            }
            return next;
        });
    }, [lsKey]);

    return { widths, setColumnWidth };
}
