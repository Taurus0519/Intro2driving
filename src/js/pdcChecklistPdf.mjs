export async function createChecklistPdf({ studentName, sections, responses }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const responseByItem = new Map(responses.map((response) => [response.item_id, response]));
  const requiredItems = sections.flatMap((section) => section.items).filter((item) => !item.optional);
  const evaluatedCount = requiredItems.filter((item) => ['yes', 'no'].includes(responseByItem.get(item.id)?.result)).length;
  // Render user-entered values as PDF text, never HTML.
  const text = (value) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

  pdf.setProperties({ title: `PDC Checklist - ${text(studentName)}`, author: 'Riteway Driving School' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('RITEWAY DRIVING SCHOOL', pageWidth / 2, 14, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Accreditation Number: DS-2022-00014-13', pageWidth / 2, 19, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('LIGHT VEHICLE', pageWidth / 2, 26, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text('8 HOURS PRACTICAL/ACTUAL DRIVING COURSE', pageWidth / 2, 32, { align: 'center' });

  autoTable(pdf, {
    startY: 38,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5, textColor: 0, lineColor: 50, lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { cellWidth: 26, fontStyle: 'bold' } },
    body: [
      ['LTO Client ID:', ''], ['Name:', text(studentName)], ['Address:', ''],
      [{ content: 'License Type:                                                         SP#:', colSpan: 2 }],
    ],
  });

  const startY = pdf.lastAutoTable.finalY + 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`${evaluatedCount} of ${requiredItems.length} required items evaluated`, margin, startY);
  const rows = sections.flatMap((section) => [
    [{ content: text(section.title).toUpperCase(), colSpan: 4,
      styles: { fontStyle: 'bold', fillColor: [232, 238, 241], halign: 'left' } }],
    ...section.items.map((item) => {
      const response = responseByItem.get(item.id);
      return [
        `${text(item.label)}${item.optional ? ' (Optional)' : ''}`,
        !item.optional && response?.result === 'yes' ? 'X' : '',
        !item.optional && response?.result === 'no' ? 'X' : '',
        text(response?.remarks),
      ];
    }),
  ]);
  autoTable(pdf, {
    startY: startY + 3,
    margin: { top: margin, bottom: 14, left: margin, right: margin },
    theme: 'grid',
    head: [['Training item', 'Yes', 'No', 'Remarks']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 1, textColor: 0, lineColor: 60, lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: [242, 246, 248], textColor: 0 },
    columnStyles: { 0: { cellWidth: 89 }, 1: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 12, halign: 'center' } },
    rowPageBreak: 'avoid',
  });

  let signatureY = pdf.lastAutoTable.finalY + 17;
  if (signatureY + 10 > pageHeight - 14) {
    pdf.addPage();
    signatureY = 25;
  }
  pdf.setDrawColor(50);
  pdf.line(margin, signatureY, pageWidth / 2 - 8, signatureY);
  pdf.line(pageWidth / 2 + 8, signatureY, pageWidth - margin, signatureY);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.text('STUDENT SIGNATURE OVER PRINTED NAME AND DATE', pageWidth / 4, signatureY + 4, { align: 'center' });
  pdf.text('INSTRUCTOR SIGNATURE OVER PRINTED NAME AND DATE', pageWidth * 3 / 4, signatureY + 4, { align: 'center' });
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFontSize(7);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  const name = String(studentName || 'student').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'student';
  return { pdf, filename: `PDC-Checklist-${name}.pdf` };
}
