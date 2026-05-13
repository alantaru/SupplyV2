import { useState, useEffect } from 'react';

export function useColumns(storageKey, defaultColumns) {
    const [columns, setColumns] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge saved with default to catch any new columns added in code updates
                // while preserving visibility and ordering
                const merged = parsed.map(savedCol => {
                    const defaultCol = defaultColumns.find(c => c.key === savedCol.key);
                    return defaultCol ? { ...defaultCol, visible: savedCol.visible } : null;
                }).filter(Boolean);

                // Add any missing default columns that aren't in saved (newly added features)
                defaultColumns.forEach(defaultCol => {
                    if (!merged.find(c => c.key === defaultCol.key)) {
                        merged.push({ ...defaultCol, visible: true });
                    }
                });
                return merged;
            }
        } catch (_e) {
            console.error("Failed to load columns from storage:", _e);
        }
        return defaultColumns.map(c => ({ ...c, visible: true }));
    });

    useEffect(() => {
        // Strip out React-specific render elements like the generic `label` if it's not needed, 
        // to keep localStorage clean, but saving {key, visible} is enough for ordering and visibility.
        const toSave = columns.map(c => ({ key: c.key, visible: c.visible }));
        localStorage.setItem(storageKey, JSON.stringify(toSave));
    }, [columns, storageKey]);

    const visibleColumns = columns.filter(c => c.visible);

    return { columns, setColumns, visibleColumns };
}
