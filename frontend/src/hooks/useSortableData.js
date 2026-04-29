import { useState, useMemo } from 'react';

export const useSortableData = (items, config = null) => {
    const [sortConfig, setSortConfig] = useState(config);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let valueA = a[sortConfig.key];
                let valueB = b[sortConfig.key];

                // Handle null/undefined
                if (valueA === null || valueA === undefined) valueA = '';
                if (valueB === null || valueB === undefined) valueB = '';

                // Try to parse numbers for correct sorting (e.g. "10", "2" -> 2 before 10)
                // Check if both are numbers or numeric strings
                const isNumeric = (val) => !isNaN(parseFloat(val)) && isFinite(val);

                if (isNumeric(valueA) && isNumeric(valueB)) {
                    valueA = parseFloat(valueA);
                    valueB = parseFloat(valueB);
                } else {
                    // Case insensitive for strings
                    if (typeof valueA === 'string') valueA = valueA.toLowerCase();
                    if (typeof valueB === 'string') valueB = valueB.toLowerCase();
                }

                if (valueA < valueB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valueA > valueB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (
            sortConfig &&
            sortConfig.key === key &&
            sortConfig.direction === 'ascending'
        ) {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};
