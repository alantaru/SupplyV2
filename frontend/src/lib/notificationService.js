import api from './api';

export const notificationService = {
    /**
     * Fetch all notifications from various sources
     * @param {string} contractId
     */
    async getNotifications(contractId) {
        if (!contractId) return [];

        const notifications = [];

        try {
            // 1. Get Dashboard Alerts (Route Planning & Machine Status)
            const res = await api.get('data/assist/dashboard', { params: { contract_id: contractId } });
            const data = res.data;

            // Machine Alerts (Status)
            if (data.status_counts) {
                // Example: { "Em Alerta": 5, "Crítico": 2 }
                Object.entries(data.status_counts).forEach(([status, count]) => {
                    if (status.toLowerCase().includes('alerta') || status.toLowerCase().includes('crítico') || status.toLowerCase().includes('erro')) {
                        notifications.push({
                            id: `status-${status}`,
                            type: 'warning',
                            title: `Equipamentos: ${status}`,
                            message: `${count} equipamentos estão com status "${status}"`,
                            link: '/equipment',
                            date: new Date()
                        });
                    }
                });
            }

            // Route Planning / Supply Alerts
            // Assuming dashboard or trends endpoints provide supply info
            // For now, let's mock specific route alerts if they exist in trending data
            if (data.trends && data.trends.low_toner_count > 0) {
                notifications.push({
                    id: 'low-toner',
                    type: 'alert',
                    title: 'Suprimentos Baixos',
                    message: `${data.trends.low_toner_count} máquinas precisam de toner em breve.`,
                    link: '/routes',
                    date: new Date()
                });
            }

        } catch (e) {
            // Silent catch - notifications are non-critical
        }

        return notifications;
    }
};
