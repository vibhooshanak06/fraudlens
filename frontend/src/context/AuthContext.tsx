import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export interface User {
    id: number;
    name: string;
    email: string;
    avatar: string;
    role: 'researcher' | 'admin';
    plan: 'free' | 'pro';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('fl_token');
        const storedUser = localStorage.getItem('fl_user');
        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch { /* ignore */ }
        }
        setLoading(false);
    }, []);

    async function login(email: string, password: string) {
        const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
        const { token: t, user: u } = res.data;
        setToken(t);
        setUser(u);
        localStorage.setItem('fl_token', t);
        localStorage.setItem('fl_user', JSON.stringify(u));
    }

    async function signup(name: string, email: string, password: string) {
        const res = await axios.post(`${BASE_URL}/auth/signup`, { name, email, password });
        const { token: t, user: u } = res.data;
        setToken(t);
        setUser(u);
        localStorage.setItem('fl_token', t);
        localStorage.setItem('fl_user', JSON.stringify(u));
    }

    async function logout() {
        try {
            if (token) await axios.post(`${BASE_URL}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } });
        } catch { /* ignore */ }
        setUser(null);
        setToken(null);
        localStorage.removeItem('fl_token');
        localStorage.removeItem('fl_user');
        sessionStorage.clear();
    }

    return (
        <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
