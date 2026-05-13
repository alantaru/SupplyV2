import { useState, useMemo } from 'react';

export function usePagination(data = [], initialItemsPerPage = 10) {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

    // Reset to page 1 if data length changes
    const [prevDataLength, setPrevDataLength] = useState(data.length);
    if (data.length !== prevDataLength) {
        setPrevDataLength(data.length);
        setCurrentPage(1);
    }

    const totalPages = Math.ceil(data.length / itemsPerPage);

    const currentData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return data.slice(start, start + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    const goToPage = (page) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    return {
        currentData,
        paginationProps: {
            currentPage,
            totalPages,
            itemsPerPage,
            totalItems: data.length,
            onPageChange: goToPage,
            onItemsPerPageChange: (n) => {
                setItemsPerPage(n);
                setCurrentPage(1);
            }
        }
    };
}
