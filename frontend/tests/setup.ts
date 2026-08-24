import { mock } from 'bun:test';

mock.module('server-only', () => ({}));

export type MockAuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'manager' | 'admin';
  status: 'active' | 'blocked';
  customPermissions?: {
    grants: string[];
    denies: string[];
  };
} | null;

let currentMockUser: MockAuthUser = null;

export function setMockAuthUser(user: MockAuthUser) {
  currentMockUser = user;
}

mock.module('@/lib/auth', () => ({
  getServerAuthContext: async () => {
    if (!currentMockUser) return null;
    return {
      user: currentMockUser,
      pb: {
        filter: (template: string, params: Record<string, unknown>) => {
          let str = template;
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{:${k}}`, String(v));
          }
          return str;
        },
      },
    };
  },
}));
