import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import api from "./api";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const globalToast = (message, type = 'info', duration = 4000) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('add-toast', { detail: { message, type, duration } }));
    }
};

export const downloadFileFromAPI = async (endpoint, filename, params = {}, method = 'GET', body = null) => {
    try {
        const config = {
            responseType: 'blob',
            params: params,
        };

        let response;
        if (method === 'POST') {
            response = await api.post(endpoint, body, config);
        } else {
            response = await api.get(endpoint, config);
        }

        // Use filename from Content-Disposition if not provided, or fallback to arg
        const contentDisposition = response.headers['content-disposition'];
        let finalFilename = filename;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (fileNameMatch && fileNameMatch.length === 2)
                finalFilename = fileNameMatch[1];
        }

        // --- CUSTOM DOWNLOAD DESTINATION MANAGEMENT ---
        const isCustomDestination = localStorage.getItem('VITE_INTERNAL_DOWNLOADS') === null 
                                   ? true 
                                   : localStorage.getItem('VITE_INTERNAL_DOWNLOADS') === 'true';

        const targetPath = localStorage.getItem('VITE_INTERNAL_DOWNLOAD_PATH');

        if (isCustomDestination && !targetPath) {
            globalToast("Por favor, configure o local de destino no seu perfil antes de exportar.", "warning");
            window.dispatchEvent(new CustomEvent('open-user-profile'));
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('set-user-profile-tab', { detail: { tab: 'downloads' } }));
            }, 100);
            return;
        }

        if (isCustomDestination) {

            
            try {
                // Prepare Base64
                const getBase64 = (file) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });

                const base64data = await getBase64(response.data);
                const targetDir = localStorage.getItem('VITE_INTERNAL_DOWNLOAD_PATH');

                // Attempt to reach the local helper
                const saveResponse = await fetch('http://127.0.0.1:8000/debug/save-download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: finalFilename,
                        content: base64data,
                        target_dir: targetDir
                    })
                });

                if (saveResponse.ok) {
                    globalToast(`Arquivo salvo em: ${finalFilename}`, "success");
                    return; // SUCCESS: Exit early
                }
            } catch (_err) {
                console.error("Local save failed, falling back to browser download:", _err);
            }
        }

        // --- NATIVE DOWNLOAD FALLBACK ---

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', finalFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (_error) {
        console.error("Download failed:", _error);
        globalToast("Falha ao baixar arquivo. Tente novamente.", "error");
    }
};
