import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { User, UserRole, AuthContextType } from '../types';
import { tokenStore, apiLogin, apiRegister, apiGetMe, apiUpdateMe, ApiError } from '../lib/api';
import toast from 'react-hot-toast';

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Map raw API user object to our frontend User type ─────────────────────────

function mapApiUser(raw: any): User {
  return {
    id: raw.id || raw._id,
    name: raw.name,
    email: raw.email,
    role: raw.role as UserRole,
    avatarUrl: raw.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(raw.name)}&background=6366f1&color=fff`,
    bio: raw.bio || '',
    isOnline: raw.isOnline ?? true,
    createdAt: raw.createdAt || new Date().toISOString(),
    // Entrepreneur fields
    ...(raw.role === 'entrepreneur' && {
      startupName: raw.startupName || '',
      pitchSummary: raw.pitchSummary || '',
      fundingNeeded: raw.fundingNeeded || '',
      industry: raw.industry || '',
      location: raw.location || '',
      foundedYear: raw.foundedYear || new Date().getFullYear(),
      teamSize: raw.teamSize || 1,
    }),
    // Investor fields
    ...(raw.role === 'investor' && {
      investmentInterests: raw.investmentInterests || [],
      investmentStage: raw.investmentStage || [],
      portfolioCompanies: raw.portfolioCompanies || [],
      totalInvestments: raw.totalInvestments || 0,
      minimumInvestment: raw.minimumInvestment || '',
      maximumInvestment: raw.maximumInvestment || '',
    }),
  };
}

// ─── Auth Provider ────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from sessionStorage (survives page refresh, cleared on tab close)
  useEffect(() => {
    const storedToken = sessionStorage.getItem('nexus_token');
    if (storedToken) {
      tokenStore.set(storedToken);
      // Validate token is still good by hitting /api/users/me
      apiGetMe()
        .then(({ user: raw }) => {
          setUser(mapApiUser(raw));
        })
        .catch(() => {
          // Token expired or invalid – clear session silently
          sessionStorage.removeItem('nexus_token');
          tokenStore.clear();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // ── login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string, _role?: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const { token, user: raw } = await apiLogin(email, password);
      tokenStore.set(token);
      sessionStorage.setItem('nexus_token', token);
      setUser(mapApiUser(raw));
      toast.success('Welcome back!');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── register ───────────────────────────────────────────────────────────────

  const register = useCallback(async (name: string, email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const { token, user: raw } = await apiRegister(name, email, password, role);
      tokenStore.set(token);
      sessionStorage.setItem('nexus_token', token);
      setUser(mapApiUser(raw));
      toast.success('Account created! Welcome to Business Nexus.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed. Please try again.';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback((): void => {
    setUser(null);
    tokenStore.clear();
    sessionStorage.removeItem('nexus_token');
    toast.success('Logged out successfully.');
  }, []);

  // ── updateProfile ──────────────────────────────────────────────────────────

  const updateProfile = useCallback(async (_userId: string, updates: Partial<User>): Promise<void> => {
    try {
      const { user: raw } = await apiUpdateMe(updates as Record<string, any>);
      setUser(mapApiUser(raw));
      toast.success('Profile updated successfully.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update profile.';
      toast.error(msg);
      throw new Error(msg);
    }
  }, []);

  // ── stubs (not yet backed by API) ─────────────────────────────────────────

  const forgotPassword = useCallback(async (_email: string): Promise<void> => {
    toast.success('If that email exists, reset instructions will be sent.');
  }, []);

  const resetPassword = useCallback(async (_token: string, _newPassword: string): Promise<void> => {
    toast.success('Password reset successfully. Please log in.');
  }, []);

  const value: AuthContextType = {
    user,
    token: tokenStore.get(),
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};