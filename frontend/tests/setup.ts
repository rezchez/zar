import { mock } from 'bun:test';

mock.module('server-only', () => ({}));
mock.module('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      const headersMap = new Map<string, string>();
      if (init?.headers) {
        Object.entries(init.headers).forEach(([k, v]) => headersMap.set(k.toLowerCase(), String(v)));
      }
      return {
        status: init?.status ?? 200,
        headers: {
          get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
        },
        json: async () => body,
      };
    },
  },
}));

mock.module('qrcode', () => ({
  default: {
    toDataURL: async () => 'data:image/png;base64,mock',
  },
}));

mock.module('pocketbase', () => {
  return {
    default: class MockPocketBase {
      autoCancellation() {}
      collection() {
        return {
          getFullList: async () => [],
          getFirstListItem: async () => null,
          getOne: async () => ({}),
          create: async (data: Record<string, unknown>) => ({ id: 'mock_id', ...data }),
          update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
          delete: async () => true,
        };
      }
      files = {
        getURL: () => '',
      };
      filter(template: string, params: Record<string, unknown>) {
        let str = template;
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(`{:${k}}`, String(v));
        }
        return str;
      }
    },
  };
});

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
