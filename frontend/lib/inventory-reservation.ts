export type MetalInventoryMovement = {
  id: string;
  type: 'received' | 'paid';
  date: string;
  customerName: string;
  weight: number;
  description?: string;
};

export type MeltedInventoryItem = {
  id: string;
  weight: number;
  remainingWeight: number;
  purity: number;
  stampNumber: string;
  labName?: string;
  customerName: string;
  rawKind?: 'molten' | 'conditional' | 'misc' | 'question';
  date?: string;
  history?: MetalInventoryMovement[];
};

export type DocumentLineMinimal = {
  id: string;
  documentNature: 'received' | 'paid';
  details: {
    inventorySourceId?: string;
    rawWeight?: string | number;
    [key: string]: unknown;
  };
};

export function getInventoryItemAvailability(
  item: MeltedInventoryItem,
  committedLines: DocumentLineMinimal[] = [],
  editingLineId: string | null = null,
) {
  const currentReserved = committedLines.reduce((sum, line) => {
    if (line.id === editingLineId) return sum;
    if (line.documentNature === 'paid' && line.details.inventorySourceId === item.id) {
      const weight = Number(line.details.rawWeight) || 0;
      return sum + weight;
    }
    return sum;
  }, 0);

  const initialWeight = item.weight || item.remainingWeight;
  const availableRemaining = Math.max(0, item.remainingWeight - currentReserved);

  return {
    initialWeight,
    currentReserved,
    availableRemaining,
  };
}
