import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Colores de marca BOSA Hub (tailwind.config.js) */
const BRAND_NAVY = [7, 18, 33]; // #071221
const BRAND_GOLD = [203, 172, 128]; // #CBAC80
const BRAND_GOLD_DARK = [147, 124, 88]; // #937C58
const BRAND_GOLD_LIGHT = [222, 200, 159]; // #DEC89F
const LABEL_FILL = [252, 247, 240];
const PAGE_MARGIN_X = 14;

const compactHeadStyles = {
  fillColor: BRAND_GOLD,
  textColor: BRAND_NAVY,
  fontStyle: 'bold',
  fontSize: 8,
  cellPadding: { top: 1.4, right: 2, bottom: 1.4, left: 2 },
  minCellHeight: 6,
  valign: 'middle',
};

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

function formatFechaCorta(fecha) {
  if (!fecha) return '—';
  try {
    const d = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return fecha;
  }
}

function bulletLines(list) {
  const items = Array.isArray(list) ? list.filter((s) => String(s).trim()) : [];
  if (!items.length) return '—';
  return items.map((s) => `• ${String(s).trim()}`).join('\n');
}

function hasSynerteamFields(record) {
  const tp = Array.isArray(record?.tema_principal) ? record.tema_principal.filter(Boolean) : [];
  const dev = Array.isArray(record?.desarrollo) ? record.desarrollo.filter(Boolean) : [];
  const ac = Array.isArray(record?.acuerdos) ? record.acuerdos.filter(Boolean) : [];
  return (
    tp.length > 0
    || dev.length > 0
    || ac.length > 0
    || (record?.next_meeting_planned === 'yes' && record?.next_meeting_fecha)
  );
}

function addBulletSection(doc, title, lines, startY, pageW, pageH) {
  const contentW = pageW - PAGE_MARGIN_X * 2;
  const headerH = 6.5;
  const padX = 3;
  const padTop = 3.5;
  const lineHeight = 4.2;

  const raw = lines && lines !== '—' ? String(lines) : '—';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const split = doc.splitTextToSize(raw, contentW - padX * 2);
  const bodyH = Math.max(11, padTop + split.length * lineHeight + 2);

  let y = startY;
  if (y + headerH + bodyH > pageH - 12) {
    doc.addPage();
    y = 16;
  }

  doc.setFillColor(...BRAND_GOLD);
  doc.rect(PAGE_MARGIN_X, y, contentW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_NAVY);
  doc.text(title, PAGE_MARGIN_X + padX, y + 4.5);

  const bodyY = y + headerH;
  doc.setDrawColor(...BRAND_GOLD_LIGHT);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.rect(PAGE_MARGIN_X, bodyY, contentW, bodyH, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(35, 45, 55);
  doc.text(split, PAGE_MARGIN_X + padX, bodyY + padTop);

  return bodyY + bodyH + 5;
}

/**
 * Construye el documento PDF de minuta.
 * @param {object} record
 * @returns {jsPDF}
 */
export function buildMinutaPdfDoc(record) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const synerteam = hasSynerteamFields(record);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BRAND_NAVY);
  doc.text('MINUTA DE REUNIÓN', pageW / 2, 16, { align: 'center' });

  if (record.tema) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_GOLD_DARK);
    doc.text(String(record.tema), pageW / 2, 22, { align: 'center', maxWidth: pageW - 30 });
  }

  const horario = record.hora_cierre
    ? `${record.hora_inicio || '—'} – ${record.hora_cierre}`
    : record.hora_inicio || '—';

  autoTable(doc, {
    startY: synerteam ? 26 : 22,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: LABEL_FILL, textColor: BRAND_NAVY },
      1: { cellWidth: pageW - 42 - 28 },
    },
    body: [
      ['LUGAR', record.lugar || '—'],
      ['FECHA', formatFechaHuman(record.fecha)],
      ['HORARIO', horario],
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
    head: [['ASISTENTES', 'CARGO', 'ASISTENCIA']],
    body: attBody,
    theme: 'grid',
    headStyles: compactHeadStyles,
    styles: {
      fontSize: 9,
      cellPadding: 1.6,
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 8,
    },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 65 }, 2: { cellWidth: 40 } },
  });

  y = doc.lastAutoTable.finalY + 8;

  if (synerteam) {
    y = addBulletSection(doc, 'TEMA PRINCIPAL', bulletLines(record.tema_principal), y, pageW, pageH);
    y = addBulletSection(doc, 'DESARROLLO DE LA REUNIÓN', bulletLines(record.desarrollo), y, pageW, pageH);
    y = addBulletSection(doc, 'ACUERDOS', bulletLines(record.acuerdos), y, pageW, pageH);

    if (record.next_meeting_planned === 'yes' && (record.next_meeting_fecha || record.next_meeting_hora)) {
      if (y > pageH - 35) {
        doc.addPage();
        y = 16;
      }
      const horario = record.next_meeting_hora_fin
        ? `${record.next_meeting_hora || '—'} – ${record.next_meeting_hora_fin}`
        : record.next_meeting_hora || '—';
      const lugar =
        record.next_meeting_lugar
        || (record.next_meeting_location_type === 'virtual' ? 'Reunión virtual' : 'Sala de juntas corporativo');
      autoTable(doc, {
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2, textColor: [30, 30, 30] },
        columnStyles: {
          0: { cellWidth: 52, fontStyle: 'bold', fillColor: LABEL_FILL, textColor: BRAND_NAVY },
          1: { cellWidth: pageW - 52 - 28 },
        },
        body: [
          ['PRÓXIMA REUNIÓN · FECHA', formatFechaCorta(record.next_meeting_fecha)],
          ['PRÓXIMA REUNIÓN · HORARIO', horario],
          ['PRÓXIMA REUNIÓN · LUGAR', lugar],
        ],
      });
      y = doc.lastAutoTable.finalY + 6;
    }
  } else {
    const topicTitles = ['TEMA 1 DEL DÍA', 'TEMA 2 DEL DÍA', 'TEMA 3 DEL DÍA'];
    const topicColors = [BRAND_GOLD, BRAND_GOLD_DARK, BRAND_GOLD_LIGHT];
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
          ...compactHeadStyles,
          fillColor: topicColors[i],
        },
        styles: {
          fontSize: 8,
          cellPadding: 1.8,
          overflow: 'linebreak',
          minCellHeight: 10,
          valign: 'top',
        },
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 78 },
          2: { cellWidth: pageW - 42 - 78 - 28 },
        },
      });
      y = doc.lastAutoTable.finalY + 6;
    }
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND_GOLD_DARK);
    doc.text(
      `BOSA Hub · Minuta de reunión${record.id ? ` · #${record.id}` : ''}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' },
    );
  }

  return doc;
}

/** URL blob del PDF para vista embebida (revocar con URL.revokeObjectURL al cerrar). */
export function createMinutaPdfBlobUrl(record) {
  const doc = buildMinutaPdfDoc(record);
  return doc.output('bloburl');
}

export function previewMinutaPdf(record) {
  const url = createMinutaPdfBlobUrl(record);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Permite ventanas emergentes para ver el PDF.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function exportMinutaPdf(record) {
  const doc = buildMinutaPdfDoc(record);
  doc.save(`Minuta_${safeFilePart(record.fecha)}_${record.id || 'nueva'}.pdf`);
}
