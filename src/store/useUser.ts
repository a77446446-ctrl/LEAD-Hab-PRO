import { create } from 'zustand';
import { User } from '@/types';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  updateBalance: (amount: number) => void;
  logout: () => void;
}

export const useUser = create<UserState>((set) => ({
  user: {
    id: '1',
    max_id: 12345678,
    name: 'Master Lead',
    role: 'admin', // Defaulting to admin for development
    balance: 1250,
    rating: 4.9,
    notify_enabled: false,
    created_at: new Date().toISOString(),
  },
  isAuthenticated: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  updateBalance: (amount) => set((state) => ({
    user: state.user ? { ...state.user, balance: state.user.balance + amount } : null
  })),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
