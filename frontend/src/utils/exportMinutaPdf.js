import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Paleta corporativa (hotelería / BOSA): azules profundos, sin primarios chillones
const NAVY_HEADER = [15, 39, 67]; // ~#0f2743 — asistentes y bloques
const NAVY_TOPIC_1 = [15, 39, 67];
const NAVY_TOPIC_2 = [21, 52, 84];
const NAVY_TOPIC_3 = [30, 64, 102];

function safeFilePart(s) {
  return String(s || 'sin-fecha').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 32);
}

function formatFechaHuman(fecha) {
  if (!fecha) return '—';
  try {
    const d = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return fecha;
  }
}

/**
 * Genera un PDF con el formato de minuta de reunión (tablas y colores de plantilla).
 * @param {object} record — mismo shape que devuelve GET /api/minutes/:id
 */
export function exportMinutaPdf(record) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 30, 50);
  doc.text('MINUTA DE REUNIÓN', pageW / 2, 16, { align: 'center' });

  autoTable(doc, {
    startY: 22,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: [245, 247, 250] },
      1: { cellWidth: pageW - 42 - 28 },
    },
    body: [
      ['LUGAR', record.lugar || '—'],
      ['FECHA', formatFechaHuman(record.fecha)],
      ['HORARIO DE LA REUNIÓN', `Inicio: ${record.hora_inicio || '—'}    Cierre: ${record.hora_cierre || '—'}`],
      ['TEMA', record.tema || '—'],
    ],
  });

  let y = doc.lastAutoTable.finalY + 6;

  const attendees = Array.isArray(record.attendees) ? record.attendees : [];
  const attRows = attendees
    .filter((a) => (a.nombre || '').trim() || (a.cargo || '').trim())
    .map((a) => [a.nombre || '—', a.cargo || '—', a.asistencia || 'Presente']);
  const attBody = attRows.length > 0 ? attRows : [['—', '—', '—']];

  autoTable(doc, {
    startY: y,
    head: [['NOMBRE', 'CARGO', 'ASISTENCIA']],
    body: attBody,
    theme: 'grid',
    headStyles: { fillColor: NAVY_HEADER, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 1.8, overflow: 'linebreak', valign: 'middle' },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 65 }, 2: { cellWidth: 40 } },
  });

  y = doc.lastAutoTable.finalY + 8;

  const topicTitles = ['TEMA 1 DEL DÍA', 'TEMA 2 DEL DÍA', 'TEMA 3 DEL DÍA'];
  const topicColors = [NAVY_TOPIC_1, NAVY_TOPIC_2, NAVY_TOPIC_3];
  const topics = Array.isArray(record.topics) ? record.topics : [];

  for (let i = 0; i < 3; i += 1) {
    const t = topics[i] || {};
    if (y > pageH - 55) {
      doc.addPage();
      y = 14;
    }
    autoTable(doc, {
      startY: y,
      head: [[topicTitles[i], 'DESCRIPCIÓN', 'COMENTARIOS']],
      body: [[t.titulo || '—', t.descripcion || '—', t.comentarios || '—']],
      theme: 'grid',
      headStyles: {
        fillColor: topicColors[i],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', minCellHeight: 14 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 78 },
        2: { cellWidth: pageW - 42 - 78 - 28 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 125, 135);
    doc.text(
      `Bosa HUB · Minuta de reunión${record.id ? ` · #${record.id}` : ''}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' }
    );
  }

  doc.save(`Minuta_${safeFilePart(record.fecha)}_${record.id || 'nueva'}.pdf`);
}
