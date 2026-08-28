import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

type PdfDocument = InstanceType<typeof PDFDocument>;

function existingFile(candidates: string[]) {
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) {
    throw new Error(`PDF font file not found. Checked: ${candidates.join(', ')}`);
  }
  return file;
}

export function pdfFontPaths() {
  const roots = [
    process.env.PDF_FONT_ROOT,
    path.join(process.cwd(), 'public', 'fonts'),
    path.join(process.cwd(), 'frontend', 'public', 'fonts'),
    path.join(process.cwd(), '..', 'frontend', 'public', 'fonts'),
  ].filter((value): value is string => Boolean(value));

  return {
    regular: existingFile(roots.map((root) => path.join(root, 'vazirmatn', 'Vazirmatn-Regular.ttf'))),
    bold: existingFile(roots.map((root) => path.join(root, 'vazirmatn', 'Vazirmatn-Bold.ttf'))),
    heading: existingFile(roots.map((root) => path.join(root, 'doran-pdf', 'DoranNoEn-ExtraBold.ttf'))),
    headingRegular: existingFile(roots.map((root) => path.join(root, 'doran-pdf', 'DoranNoEn-Regular.ttf'))),
  };
}

export function createPdfDocument(
  options: ConstructorParameters<typeof PDFDocument>[0] = {},
) {
  const fonts = pdfFontPaths();
  const document = new PDFDocument({
    ...options,
    font: fonts.regular,
  });
  document.registerFont('Vazirmatn', fonts.regular);
  document.registerFont('VazirmatnBold', fonts.bold);
  document.registerFont('DoranNoEn', fonts.heading);
  document.registerFont('DoranNoEnRegular', fonts.headingRegular);
  return document;
}

export function pdfBuffer(document: PdfDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    document.on('error', (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    document.end();
  });
}
