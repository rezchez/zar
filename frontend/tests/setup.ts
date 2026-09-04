import { mock } from 'bun:test';

mock.module('server-only', () => ({}));

mock.module('next/cache', () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

class MockNextResponse {
  body: any;
  status: number;
  headers: Map<string, string>;

  constructor(body?: any, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.headers = new Map();
    if (init?.headers) {
      Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k.toLowerCase(), String(v)));
    }
  }

  static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    const res = new MockNextResponse(body, init);
    if (!res.headers.has('content-type')) {
      res.headers.set('content-type', 'application/json');
    }
    return {
      status: res.status,
      headers: {
        get: (name: string) => res.headers.get(name.toLowerCase()) ?? null,
      },
      json: async () => body,
      text: async () => typeof body === 'string' ? body : JSON.stringify(body),
    };
  }

  get(name: string) {
    return this.headers.get(name.toLowerCase()) ?? null;
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
}

mock.module('next/server', () => ({
  NextResponse: MockNextResponse,
}));

mock.module('qrcode', () => ({
  default: {
    toDataURL: async () => 'data:image/png;base64,mock',
  },
}));

class MockPocketBase {
  autoCancellation() {}
  authStore = {
    token: 'mock_token',
    isValid: true,
    save: () => {},
    clear: () => {},
  };
  collection() {
    return {
      authWithPassword: async () => ({ token: 'mock_token', record: {} }),
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
}

mock.module('pocketbase', () => {
  return {
    default: MockPocketBase,
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

const sharedMockPb = new MockPocketBase();

mock.module('@/lib/auth', () => ({
  getServerAuthContext: async () => {
    if (!currentMockUser) return null;
    return {
      user: currentMockUser,
      pb: sharedMockPb,
    };
  },
}));
