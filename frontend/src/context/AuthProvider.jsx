import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const parseJwt = useCallback((token) => {
        if (!token) return null;
        try {
            const base64Url = token.split('.')[1];
            if (!base64Url) return null;
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (_e) {
            return null;
        }
    }, []);

    const setUserFromToken = useCallback((token) => {
        const decoded = parseJwt(token);
        if (decoded) {
            const contracts = decoded.contracts || [];
            const role = decoded.role || 'user';
            
            // Determine active contract from localStorage
            const storedContract = localStorage.getItem('active_contract');
            
            // For superadmin: trust the stored contract unconditionally
            // (their JWT contracts list may be stale — auth/me will refresh it)
            // For regular users: only accept stored contract if it's in their JWT contracts list
            const activeContract = storedContract && (
                role === 'superadmin' || role === 'admin' || contracts.includes(storedContract)
            )
                ? storedContract
                : (contracts.length > 0 ? contracts[0] : null);

            setUser({
                username: decoded.sub,
                role,
                initial_route: decoded.initial_route || '/',
                contracts: contracts,
                activeContract: activeContract,
                theme: decoded.theme || 'light',
                accent: decoded.accent || 'indigo',
                avatar: decoded.avatar || 'default'
            });
            if (activeContract) {
                localStorage.setItem('active_contract', activeContract);
            } else {
                localStorage.removeItem('active_contract');
            }
        } else {
            setUser(null);
            localStorage.removeItem('token');
        }
    }, [parseJwt]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setUserFromToken(token);
            // Refresh data from backend to get latest contracts list and prefs
            api.get('auth/me')
                .then(res => {
                    // Preserve the activeContract already set from localStorage
                    // auth/me returns updated contracts list (especially for superadmin)
                    // but must NOT override the activeContract the user chose
                    const storedContract = localStorage.getItem('active_contract');
                    setUser(prev => {
                        if (!prev) return prev;
                        const newContracts = res.data.contracts || prev.contracts;
                        // For superadmin/admin: keep stored contract even if not in list
                        // For regular users: validate stored contract against new list
                        const role = res.data.role || prev.role;
                        const isPrivileged = role === 'superadmin' || role === 'admin';
                        const validStored = storedContract && (
                            isPrivileged || newContracts.includes(storedContract)
                        );
                        const activeContract = validStored
                            ? storedContract
                            : (newContracts.length > 0 ? newContracts[0] : null);
                        if (activeContract) localStorage.setItem('active_contract', activeContract);
                        return {
                            ...prev,
                            ...res.data,
                            contracts: newContracts,
                            activeContract,
                        };
                    });
                })
                .catch((_err) => {
                    console.warn("Silent token refresh failed.");
                });
        }
        setLoading(false);
    }, [setUserFromToken]);

    const login = async (username, password) => {
        // Use URLSearchParams to force application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        try {
            // Updated to match backend router prefix '/auth'
            const res = await api.post('auth/token', params);
            const { access_token } = res.data;

            localStorage.setItem('token', access_token);
            setUserFromToken(access_token);

            const decoded = parseJwt(access_token);
            return { success: true, route: decoded?.initial_route || '/' };
        } catch (_error) {
            return { success: false, msg: _error?.response?.data?.detail || "Usuário ou senha inválidos" };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const updateActiveContract = (contractId) => {
        localStorage.setItem('active_contract', contractId);
        setUser(prev => prev ? { ...prev, activeContract: contractId } : prev);
    };

    const refreshUser = async () => {
        try {
            const res = await api.get('auth/me');
            setUser(prev => ({ ...prev, ...res.data }));
            return res.data;
        } catch (_err) {
            console.error("Failed to refresh user data:", _err);
            return null;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, updateActiveContract, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
