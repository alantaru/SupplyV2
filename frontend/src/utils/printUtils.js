
/**
 * Splits an array of items into chunks of a specific size.
 * @param {Array} items - The array to split.
 * @param {number} size - The size of each chunk.
 * @returns {Array<Array>} - An array of chunks.
 */
export const paginateItems = (items, size = 5) => {
    if (!items || !Array.isArray(items)) return [];
    if (items.length === 0) return [[]]; // Return at least one empty page

    const pages = [];
    for (let i = 0; i < items.length; i += size) {
        pages.push(items.slice(i, i + size));
    }
    return pages;
};
