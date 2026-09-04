'use client';

/**
 * QuickGoldActions — میان‌برهای حسابداری طلا:
 * فاکتور خرید/فروش طلا، ثبت طلای شرطی، دریافت/پرداخت نقد و چک.
 */
import { motion } from 'framer-motion';
import { FilePlus2, HandCoins, Landmark, ReceiptText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';

const ACTIONS = [
  { id: 'invoice', title: 'فاکتور خرید / فروش طلا', icon: ReceiptText, href: '/dashboard/documents/new', accent: true },
  { id: 'conditional', title: 'ثبت طلای شرطی', icon: HandCoins, href: '/dashboard/documents/new' },
  { id: 'cash', title: 'دریافت / پرداخت نقد', icon: Landmark, href: '/dashboard/documents/new' },
  { id: 'cheque', title: 'ثبت چک', icon: FilePlus2, href: '/dashboard/documents/new' },
];

interface QuickGoldActionsProps {
  size?: DashboardWidgetSize;
}

export default function QuickGoldActions({ size = 'large' }: QuickGoldActionsProps) {
  const router = useRouter();

  const displayedActions = size === 'small' ? ACTIONS.slice(0, 2) : size === 'medium' ? ACTIONS.slice(0, 3) : ACTIONS;

  return (
    <div className="quick-gold-actions w-full h-full" role="group" aria-label="عملیات سریع حسابداری">
      {displayedActions.map((action, index) => (
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
