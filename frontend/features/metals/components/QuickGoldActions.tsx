'use client';

/**
 * QuickGoldActions — میان‌برهای حسابداری طلا:
 * فاکتور خرید/فروش طلا، ثبت طلای شرطی، دریافت/پرداخت نقد و چک.
 */
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FilePlus2, HandCoins, Landmark, ReceiptText } from 'lucide-react';

export const QUICK_GOLD_ACTIONS = [
  { id: 'invoice', title: 'فاکتور خرید / فروش طلا', icon: ReceiptText, href: '/dashboard/documents/new#gold-sale', accent: true },
  { id: 'conditional', title: 'ثبت طلای شرطی', icon: HandCoins, href: '/dashboard/documents/new?kind=conditional#metals' },
  { id: 'cash', title: 'دریافت / پرداخت نقد', icon: Landmark, href: '/dashboard/documents/new#cash' },
  { id: 'cheque', title: 'ثبت چک', icon: FilePlus2, href: '/dashboard/documents/new?kind=check-payment#bank' },
];

const ACTIONS = QUICK_GOLD_ACTIONS;

export default function QuickGoldActions() {
  const router = useRouter();

  return (
    <div className="quick-gold-actions" role="group" aria-label="عملیات سریع حسابداری">
      {ACTIONS.map((action, index) => (
        <motion.button
          key={action.id}
          type="button"
          className={`quick-gold-action ${action.accent ? 'is-accent' : ''}`}
          onClick={() => router.push(action.href)}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.06, type: 'spring', stiffness: 320, damping: 22 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.96 }}
        >
          <action.icon size={19} strokeWidth={1.7} />
          <span>{action.title}</span>
        </motion.button>
      ))}
    </div>
  );
}
