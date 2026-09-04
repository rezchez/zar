import { beforeEach, describe, expect, it } from 'bun:test';

import { POST as rebuildCacheHandler } from '../app/api/admin/cache/rebuild/route';
import { setMockAuthUser } from './setup';

describe('Cache Rebuild Server Endpoint', () => {
  beforeEach(() => {
    setMockAuthUser(null);
  });

  it('returns 401 when unauthenticated', async () => {
    setMockAuthUser(null);
    const req = new Request('http://localhost:3000/api/admin/cache/rebuild', {
      method: 'POST',
    });
    const res = await rebuildCacheHandler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('عدم احراز هویت');
  });

  it('returns 403 when user is regular user', async () => {
    setMockAuthUser({
      id: 'usr-1',
      name: 'کاربر عادی',
      email: 'user@zarfolio.ir',
      role: 'user',
      status: 'active',
    });

    const req = new Request('http://localhost:3000/api/admin/cache/rebuild', {
      method: 'POST',
    });
    const res = await rebuildCacheHandler(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('دسترسی غیرمجاز');
  });

  it('rebuilds cache successfully when user is admin', async () => {
    setMockAuthUser({
      id: 'admin-1',
      name: 'مدیر کل',
      email: 'admin@zarfolio.ir',
      role: 'admin',
      status: 'active',
    });

    const req = new Request('http://localhost:3000/api/admin/cache/rebuild', {
      method: 'POST',
    });
    const res = await rebuildCacheHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBeTrue();
    expect(body.message).toBe('کش برنامه با موفقیت بازسازی و پاکسازی شد.');
  });
});
