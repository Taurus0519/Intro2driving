import test from 'node:test';
import assert from 'node:assert/strict';
import { createChecklistPdf } from '../src/js/pdcChecklistPdf.mjs';
import { PDC_CHECKLIST_SECTIONS } from '../src/js/pdcChecklistData.js';

const sections = [{ title: 'Start Stop', items: [
  { id: 'checks', label: 'Pre-driving checks' },
  { id: 'starting', label: 'Starting procedure' },
  { id: 'optional', label: 'Additional notes', optional: true },
] }];

test('PDF includes the selected student, saved results, remarks, and signatures', async () => {
  const { pdf, filename } = await createChecklistPdf({
    studentName: 'Test Student', sections,
    responses: [
      { item_id: 'checks', result: 'yes', remarks: 'Checks completed' },
      { item_id: 'starting', result: 'no', remarks: 'More practice needed' },
      { item_id: 'optional', result: 'yes', remarks: 'Instructor notes' },
    ],
  });
  const content = pdf.output();
  assert.ok(content.startsWith('%PDF-'));
  for (const expected of ['RITEWAY DRIVING SCHOOL', 'Test Student', 'Checks completed', 'More practice needed',
    '2 of 2 required items evaluated', 'STUDENT SIGNATURE', 'INSTRUCTOR SIGNATURE']) {
    assert.ok(content.includes(expected), `Missing PDF content: ${expected}`);
  }
  assert.equal((content.match(/\(X\) Tj/g) || []).length, 2, 'Optional rows must not receive Yes/No marks');
  assert.equal(filename, 'PDC-Checklist-Test-Student.pdf');
});

test('unevaluated items stay unmarked and filenames exclude filesystem separators', async () => {
  const { pdf, filename } = await createChecklistPdf({ studentName: '../Test/Student', sections, responses: [] });
  const content = pdf.output();
  assert.ok(content.includes('0 of 2 required items evaluated'));
  assert.equal((content.match(/\(X\) Tj/g) || []).length, 0);
  assert.equal(filename, 'PDC-Checklist-Test-Student.pdf');
});

test('long remarks flow across PDF pages with signature lines after the table', async () => {
  const { pdf } = await createChecklistPdf({
    studentName: 'Test Student', sections,
    responses: [{ item_id: 'checks', result: 'yes', remarks: 'Practice safely and check mirrors. '.repeat(150) }],
  });
  assert.ok(pdf.getNumberOfPages() > 1);
  const content = pdf.output();
  assert.ok(content.includes(`Page ${pdf.getNumberOfPages()} of ${pdf.getNumberOfPages()}`));
  assert.ok(content.includes('INSTRUCTOR SIGNATURE'));
});

test('the complete standard checklist fits on one A4 page without remarks', async () => {
  const { pdf } = await createChecklistPdf({ studentName: 'Test Student', sections: PDC_CHECKLIST_SECTIONS, responses: [] });
  assert.equal(pdf.getNumberOfPages(), 1);
});
