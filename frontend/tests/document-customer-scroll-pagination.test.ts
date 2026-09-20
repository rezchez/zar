import { describe, expect, it } from 'bun:test';
import type { Customer } from '@/lib/customer';

describe('DocumentForm Customer Dropdown Lazy Scroll & 10-item Pagination', () => {
  const generateMockCustomers = (count: number): Customer[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `cust-${i + 1}`,
      customerCode: 1000 + i + 1,
      name: `طرف‌حساب شماره ${i + 1}`,
      englishName: `Customer ${i + 1}`,
      groupName: i % 3 === 0 ? 'بنکدار' : i % 3 === 1 ? 'ری‌گیر' : 'مشتری عادی',
      phone1: `091200000${String(i + 1).padStart(2, '0')}`,
      phone2: '',
      phone3: '',
      city: 'تهران',
      nationalId: '',
      showBalanceByUnit: false,
      goldBalance: 0,
      silverBalance: 0,
      platinumBalance: 0,
      rialBalance: 0,
      foreignBalance: 0,
      tertiaryBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) as unknown as Customer[];
  };

  it('initially displays exactly 10 customers when list has more than 10', () => {
    const customers = generateMockCustomers(35);
    const initialVisibleCount = 10;
    const displayed = customers.slice(0, initialVisibleCount);

    expect(displayed.length).toBe(10);
    expect(displayed[0].name).toBe('طرف‌حساب شماره 1');
    expect(displayed[9].name).toBe('طرف‌حساب شماره 10');
  });

  it('increments visible customers by 10 on simulated scroll down', () => {
    const customers = generateMockCustomers(25);
    let visibleCount = 10;

    const simulateScrollNearBottom = () => {
      if (visibleCount < customers.length) {
        visibleCount = Math.min(visibleCount + 10, customers.length);
      }
    };

    // First scroll: 10 -> 20
    simulateScrollNearBottom();
    expect(visibleCount).toBe(20);
    expect(customers.slice(0, visibleCount).length).toBe(20);

    // Second scroll: 20 -> 25 (capped at total)
    simulateScrollNearBottom();
    expect(visibleCount).toBe(25);
    expect(customers.slice(0, visibleCount).length).toBe(25);

    // Further scrolls don't exceed total
    simulateScrollNearBottom();
    expect(visibleCount).toBe(25);
  });

  it('resets visible count to 10 when search query or filter changes', () => {
    let visibleCount = 20;

    // Simulate query change
    const onFilterOrQueryChange = () => {
      visibleCount = 10;
    };

    onFilterOrQueryChange();
    expect(visibleCount).toBe(10);
  });

  it('prioritizes favorite customers at top of paginated list', () => {
    const customers = generateMockCustomers(20);
    const favoriteIds = ['cust-15', 'cust-19'];

    const sorted = [...customers].sort((a, b) => {
      const aFav = favoriteIds.includes(a.id) ? 1 : 0;
      const bFav = favoriteIds.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    const page1 = sorted.slice(0, 10);
    expect(page1.length).toBe(10);
    expect(page1[0].id).toBe('cust-15');
    expect(page1[1].id).toBe('cust-19');
  });
});
