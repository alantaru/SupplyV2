import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../../lib/notificationService';
import { useAuth } from '../../context/AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
    const { activeContract } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    const loadNotifications = async () => {
        const notifs = await notificationService.getNotifications(activeContract);
        setNotifications(notifs);
        setUnreadCount(notifs.length); // Assuming all fetched are unread for simplicity now
    };

    useEffect(() => {
        loadNotifications();
        // Poll every 60 seconds
        const interval = setInterval(loadNotifications, 60000);
        return () => clearInterval(interval);
    }, [activeContract]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotificationClick = (n) => {
        setIsOpen(false);
        if (n.link) {
            navigate(n.link);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 relative transition-colors"
                title="Notificações"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-white dark:border-slate-800 animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Notificações</h3>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {unreadCount} nova{unreadCount !== 1 && 's'}
                        </span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p>Tudo tranquilo por aqui!</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                {notifications.map((n, i) => (
                                    <li
                                        key={i}
                                        onClick={() => handleNotificationClick(n)}
                                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.type === 'warning' ? 'bg-amber-500' :
                                                    n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                                }`} />
                                            <div>
                                                <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                                                    {n.title}
                                                </h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                                    {n.message}
                                                </p>
                                                <span className="text-[10px] text-slate-400 mt-2 block">
                                                    {n.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-2 text-center border-t border-slate-100 dark:border-slate-700">
                            <button onClick={() => setNotifications([])} className="text-xs text-slate-500 hover:text-primary transition-colors">
                                Limpar todas
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
