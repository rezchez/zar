import { redirect } from 'next/navigation';

export default function OpeningBalanceRedirectPage() {
  redirect('/dashboard/documents/initial-inventory');
}
