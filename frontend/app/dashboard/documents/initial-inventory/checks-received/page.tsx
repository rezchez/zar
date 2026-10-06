import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function InitialReceivedChecksPage() {
  redirect('/dashboard/documents/initial-inventory/checks?tab=received');
}
