import * as React from 'react';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', wrapperClassName = '', ...props }, ref) => (
    <div
      className={`relative w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800/80 dark:bg-slate-900 ${wrapperClassName}`}
    >
      <table
        ref={ref}
        className={`w-full caption-bottom text-xs text-right ${className}`}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', ...props }, ref) => (
  <thead
    ref={ref}
    className={`border-b border-slate-200/80 bg-slate-50/80 font-bold text-slate-600 dark:border-slate-800/80 dark:bg-slate-800/50 dark:text-slate-300 [&_tr]:border-b-0 ${className}`}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', ...props }, ref) => (
  <tbody
    ref={ref}
    className={`divide-y divide-slate-100 dark:divide-slate-800/60 [&_tr:last-child]:border-0 ${className}`}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', ...props }, ref) => (
  <tfoot
    ref={ref}
    className={`border-t border-slate-200/80 bg-slate-50/50 font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 [&>tr]:last:border-b-0 ${className}`}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className = '', ...props }, ref) => (
  <tr
    ref={ref}
    className={`transition-colors hover:bg-slate-50/80 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800 ${className}`}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className = '', ...props }, ref) => (
  <th
    ref={ref}
    className={`h-10 px-3 py-2 text-right align-middle text-[11px] font-black text-slate-600 dark:text-slate-300 whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className = '', ...props }, ref) => (
  <td
    ref={ref}
    className={`px-3 py-2.5 align-middle text-xs whitespace-nowrap text-slate-700 dark:text-slate-300 [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className = '', ...props }, ref) => (
  <caption
    ref={ref}
    className={`mt-3 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';
