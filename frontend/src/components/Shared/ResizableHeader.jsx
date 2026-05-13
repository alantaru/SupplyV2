import { useRef, useCallback } from 'react';
import { clampWidth } from '../../hooks/useColumnWidths';

/**
 * ResizableHeader — wrapper de <th> com handle de resize na borda direita.
 *
 * Props:
 *   columnKey  string   — chave da coluna (para onResize)
 *   width      number   — largura atual em px (undefined = auto)
 *   onResize   fn(key, newWidth) — chamado durante o arrasto (live feedback)
 *   onResizeEnd fn(key, newWidth) — chamado no mouseup (para persistir)
 *   children   ReactNode
 *   ...rest    — demais props passadas ao <th>
 */
export default function ResizableHeader({
    columnKey,
    width,
    onResize,
    onResizeEnd,
    children,
    style = {},
    ...rest
}) {
    const startXRef = useRef(null);
    const startWidthRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        startXRef.current = e.clientX;
        // Usa a largura atual ou a largura do elemento como base
        startWidthRef.current = width ?? e.currentTarget.parentElement?.offsetWidth ?? 120;

        const handleMouseMove = (moveEvent) => {
            const delta = moveEvent.clientX - startXRef.current;
            const newWidth = clampWidth(startWidthRef.current + delta);
            onResize?.(columnKey, newWidth);
        };

        const handleMouseUp = (upEvent) => {
            const delta = upEvent.clientX - startXRef.current;
            const newWidth = clampWidth(startWidthRef.current + delta);
            onResizeEnd?.(columnKey, newWidth);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnKey, width, onResize, onResizeEnd]);

    return (
        <th
            {...rest}
            style={{
                ...style,
                width: width ? `${width}px` : style.width,
                minWidth: width ? `${width}px` : style.minWidth,
                position: 'relative',
                userSelect: 'none',
            }}
        >
            {children}
            {/* Resize handle */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '6px',
                    height: '100%',
                    cursor: 'col-resize',
                    zIndex: 10,
                    // Linha visual sutil
                    borderRight: '2px solid transparent',
                    transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderRightColor = 'rgb(var(--color-primary, 79 70 229))'; }}
                onMouseLeave={e => { e.currentTarget.style.borderRightColor = 'transparent'; }}
                title="Arrastar para redimensionar"
            />
        </th>
    );
}
