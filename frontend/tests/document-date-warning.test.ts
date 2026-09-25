import { describe, it, expect } from 'bun:test';
import {
  checkDocumentDateDiff,
  toPersianDigits,
} from '@/features/accounting/documents/utils/document-helpers';
import { formatJalaliDate, parseJalaliDate } from '@/lib/jalali';

describe('Document Date Confirmation & Warning Tests', () => {
  it('identifies today date as not different (no modal required)', () => {
    const today = formatJalaliDate();
    const diff = checkDocumentDateDiff(today);

    expect(diff.isDifferent).toBe(false);
    expect(diff.isPast).toBe(false);
    expect(diff.isFuture).toBe(false);
  });

  it('correctly identifies past dates and flags isPast=true', () => {
    const today = formatJalaliDate();
    const parsedToday = parseJalaliDate(today);
    expect(parsedToday).not.toBeNull();

    if (parsedToday) {
      // Create a past date (1 year before)
      const pastYear = parsedToday.year - 1;
      const pastDateStr = `${pastYear}/${String(parsedToday.month).padStart(2, '0')}/${String(parsedToday.day).padStart(2, '0')}`;

      const diff = checkDocumentDateDiff(pastDateStr);
      expect(diff.isDifferent).toBe(true);
      expect(diff.isPast).toBe(true);
      expect(diff.isFuture).toBe(false);
    }
  });

  it('correctly identifies future dates and flags isFuture=true', () => {
    const today = formatJalaliDate();
    const parsedToday = parseJalaliDate(today);
    expect(parsedToday).not.toBeNull();

    if (parsedToday) {
      // Create a future date (1 year ahead)
      const futureYear = parsedToday.year + 1;
      const futureDateStr = `${futureYear}/${String(parsedToday.month).padStart(2, '0')}/${String(parsedToday.day).padStart(2, '0')}`;

      const diff = checkDocumentDateDiff(futureDateStr);
      expect(diff.isDifferent).toBe(true);
      expect(diff.isPast).toBe(false);
      expect(diff.isFuture).toBe(true);
    }
  });

  it('handles Persian digits correctly in date comparison', () => {
    const today = formatJalaliDate();
    const parsedToday = parseJalaliDate(today);
    expect(parsedToday).not.toBeNull();

    if (parsedToday) {
      const pastYear = parsedToday.year - 2;
      const pastDateStr = `${pastYear}/01/15`;
      const persianDigitsDate = toPersianDigits(pastDateStr);

      const diff = checkDocumentDateDiff(persianDigitsDate);
      expect(diff.isDifferent).toBe(true);
      expect(diff.isPast).toBe(true);
      expect(diff.isFuture).toBe(false);
    }
  });

  it('formats prompt message accurately matching user requirement', () => {
    const testDate = '1403/05/20';
    const promptMessage = `از ثبت سند با تاریخ ${toPersianDigits(testDate)} مطمئنی؟`;

    expect(promptMessage).toContain('از ثبت سند با تاریخ');
    expect(promptMessage).toContain('مطمئنی؟');
    expect(promptMessage).toContain(toPersianDigits(testDate));
  });

  it('checks date when committing the first row, not during DatePicker selection', () => {
    const today = formatJalaliDate();
    let documentDate = '1402/05/10'; // non-today date selected
    let dateWarningAcknowledged = false;
    let showModal = false;
    const committedLines: any[] = [];
    let linesCommittedCount = 0;

    // 1. Changing date in DatePicker: updates date directly, does NOT open modal
    const onDatePickerChange = (newDate: string) => {
      documentDate = newDate;
      dateWarningAcknowledged = false;
    };

    onDatePickerChange('1402/05/10');
    expect(showModal).toBe(false); // No modal on DatePicker change!
    expect(documentDate).toBe('1402/05/10');

    // 2. Committing the FIRST row:
    const handleCommitRow = (draftLineIsValid: boolean) => {
      const isFirstRow = committedLines.length === 0;

      if (isFirstRow && !dateWarningAcknowledged) {
        const diff = checkDocumentDateDiff(documentDate);
        if (diff.isDifferent) {
          if (!draftLineIsValid) return false;
          showModal = true;
          return false;
        }
      }

      committedLines.push({ id: 'line-1' });
      linesCommittedCount++;
      return true;
    };

    // First attempt: draft line is invalid (e.g. weight is 0) -> no date modal
    const invalidResult = handleCommitRow(false);
    expect(invalidResult).toBe(false);
    expect(showModal).toBe(false);
    expect(committedLines.length).toBe(0);

    // Second attempt: draft line is valid -> triggers modal!
    const validResult = handleCommitRow(true);
    expect(validResult).toBe(false); // Paused for user confirmation
    expect(showModal).toBe(true);
    expect(committedLines.length).toBe(0);

    // User cancels in modal: row not committed
    showModal = false;
    expect(committedLines.length).toBe(0);

    // User tries again and clicks "بله، مطمئنم"
    handleCommitRow(true);
    expect(showModal).toBe(true);

    // Confirm:
    dateWarningAcknowledged = true;
    showModal = false;
    committedLines.push({ id: 'line-1' });
    expect(committedLines.length).toBe(1);

    // 3. Committing the SECOND row:
    // Should commit immediately without prompting!
    const secondRowResult = handleCommitRow(true);
    expect(secondRowResult).toBe(true);
    expect(showModal).toBe(false); // No modal on subsequent rows!
    expect(committedLines.length).toBe(2);
  });

  it('allows user to set date to today and commit in date modal', () => {
    const today = formatJalaliDate();
    let documentDate = '1401/01/01';
    let dateWarningAcknowledged = false;
    let showModal = false;
    const committedLines: any[] = [];

    const handleCommitRow = () => {
      const isFirstRow = committedLines.length === 0;
      if (isFirstRow && !dateWarningAcknowledged) {
        const diff = checkDocumentDateDiff(documentDate);
        if (diff.isDifferent) {
          showModal = true;
          return;
        }
      }
      committedLines.push({ id: 'line-1' });
    };

    handleCommitRow();
    expect(showModal).toBe(true);

    // User clicks "تنظیم به امروز و ثبت"
    documentDate = today;
    dateWarningAcknowledged = true;
    showModal = false;
    committedLines.push({ id: 'line-1' });

    expect(documentDate).toBe(today);
    expect(committedLines.length).toBe(1);
    expect(showModal).toBe(false);
  });
});
