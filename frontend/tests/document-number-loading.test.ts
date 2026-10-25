import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const formSource = readFileSync(
  new URL('../features/accounting/documents/components/DocumentForm.tsx', import.meta.url),
  'utf8',
);
const numberEffectSource = formSource.split('// Fetch document number when customer changes')[1]
  .split('// Fetch melted inventory')[0];

function createNumberEffect() {
  let loading = false;
  let documentNumber = '';
  const requests: Array<(data: { documentNumber: string }) => void> = [];
  const runEffect = new Function(
    'useEffect',
    'selectedCustomerId',
    'editingExistingDocId',
    'isEditingExistingDoc',
    'setDocumentNumberLoading',
    'setDocumentNumberDisplay',
    'fetch',
    numberEffectSource,
  );

  return {
    get loading() { return loading; },
    get documentNumber() { return documentNumber; },
    requests,
    setDocumentNumber(value: string) { documentNumber = value; },
    run(customerId: string, editId = '', isEditing = false) {
      let cleanup: (() => void) | undefined;
      runEffect(
        (effect: () => (() => void) | undefined) => { cleanup = effect(); },
        customerId,
        editId,
        isEditing,
        (value: boolean) => { loading = value; },
        (value: string) => { documentNumber = value; },
        () => new Promise((resolve) => {
          requests.push((data) => resolve({ ok: true, json: async () => data }));
        }),
      );
      return cleanup;
    },
  };
}

const flushRequests = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Document number loading lifecycle', () => {
  it('does not request a new number while an existing document is being loaded', () => {
    const state = createNumberEffect();
    state.run('customer-1', 'document-1');

    expect(state.requests).toHaveLength(0);
    expect(state.loading).toBe(false);
  });

  it('clears pending loading on edit and preserves the saved number against stale responses', async () => {
    const state = createNumberEffect();
    const cleanup = state.run('customer-1');
    expect(state.loading).toBe(true);

    cleanup?.();
    state.setDocumentNumber('ZF12345678');
    state.run('customer-1', 'document-1', true);

    expect(state.loading).toBe(false);
    expect(state.documentNumber).toBe('ZF12345678');
    expect(state.requests).toHaveLength(1);

    state.requests[0]({ documentNumber: 'ZF99999999' });
    await flushRequests();

    expect(state.documentNumber).toBe('ZF12345678');
    expect(state.loading).toBe(false);
  });

  it('clears pending loading and number when the customer is removed', () => {
    const state = createNumberEffect();
    state.setDocumentNumber('ZF12345678');
    const cleanup = state.run('customer-1');

    cleanup?.();
    state.run('');

    expect(state.loading).toBe(false);
    expect(state.documentNumber).toBe('');
  });

  it('still fetches the number for a new document', async () => {
    const state = createNumberEffect();
    state.run('customer-1');
    expect(state.loading).toBe(true);

    state.requests[0]({ documentNumber: 'ZF12345678' });
    await flushRequests();

    expect(state.documentNumber).toBe('ZF12345678');
    expect(state.loading).toBe(false);
  });
});
