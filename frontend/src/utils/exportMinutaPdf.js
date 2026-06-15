import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureSynerteamFormat, hasSynerteamFields } from './minuteContent';

/** Colores de marca BOSA Hub (tailwind.config.js) */
const BRAND_NAVY = [7, 18, 33]; // #071221
const BRAND_GOLD = [203, 172, 128]; // #CBAC80
const BRAND_GOLD_DARK = [147, 124, 88]; // #937C58
const BRAND_GOLD_LIGHT = [222, 200, 159]; // #DEC89F
const LABEL_FILL = [252, 247, 240];
const PAGE_MARGIN_X = 14;
const BODY_FONT_SIZE = 9;
const LABEL_COL_W = 50;

const compactHeadStyles = {
  fillColor: BRAND_GOLD,
  textColor: BRAND_NAVY,
  font: 'helvetica',
  fontStyle: 'bold',
  fontSize: 8,
  cellPadding: { top: 1.4, right: 2, bottom: 1.4, left: 2 },
  minCellHeight: 6,
  halign: 'center',
  valign: 'middle',
  overflow: 'linebreak',
};

function contentWidth(pageW) {
  return pageW - PAGE_MARGIN_X * 2;
}

function valueColWidth(pageW) {
  return contentWidth(pageW) - LABEL_COL_W;
}

function baseTableStyles() {
  return {
    font: 'helvetica',
    fontStyle: 'normal',
    fontSize: BODY_FONT_SIZE,
    cellPadding: 2,
    textColor: [30, 30, 30],
    overflow: 'linebreak',
    valign: 'top',
    lineColor: BRAND_GOLD_LIGHT,
    lineWidth: 0.2,
  };
}

function labelColumnStyle() {
  return {
    cellWidth: LABEL_COL_W,
    fontStyle: 'normal',
    fillColor: LABEL_FILL,
    textColor: BRAND_NAVY,
    overflow: 'linebreak',
    valign: 'middle',
  };
}

function valueColumnStyle(pageW) {
  return {
    cellWidth: valueColWidth(pageW),
    overflow: 'linebreak',
    valign: 'top',
  };
}

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

function proseLines(list) {
  if (typeof list === 'string') {
    const t = list.trim();
    return t || '—';
  }
  const items = Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : [];
  if (!items.length) return '—';
  return items.join('\n\n');
}

/** Sección de texto con encabezado dorado; autoTable pagina el contenido dentro del cuadro. */
function addTextSection(doc, title, lines, startY, pageW) {
  const raw = lines && lines !== '—' ? String(lines) : '—';
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    tableWidth: contentWidth(pageW),
    head: [[title]],
    body: [[raw]],
    theme: 'grid',
    headStyles: compactHeadStyles,
    styles: {
      ...baseTableStyles(),
      minCellHeight: 10,
    },
    columnStyles: {
      0: { cellWidth: contentWidth(pageW), overflow: 'linebreak' },
    },
  });
  return doc.lastAutoTable.finalY + 5;
}

/**
 * Construye el documento PDF de minuta.
 * @param {object} record
 * @returns {jsPDF}
 */
export function buildMinutaPdfDoc(record) {
  const normalized = ensureSynerteamFormat(record);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const synerteam = hasSynerteamFields(normalized) || normalized?.next_meeting_planned === 'yes';
  const data = normalized;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BRAND_NAVY);
  doc.text('MINUTA DE REUNIÓN', pageW / 2, 16, { align: 'center' });

  if (data.tema) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_GOLD_DARK);
    doc.text(String(data.tema), pageW / 2, 22, { align: 'center', maxWidth: pageW - 30 });
  }

  const horario = data.hora_cierre
    ? `${data.hora_inicio || '—'} – ${data.hora_cierre}`
    : data.hora_inicio || '—';

  autoTable(doc, {
    startY: synerteam ? 26 : 22,
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    tableWidth: contentWidth(pageW),
    theme: 'grid',
    styles: baseTableStyles(),
    columnStyles: {
      0: labelColumnStyle(),
      1: valueColumnStyle(pageW),
    },
    body: [
      ['LUGAR', data.lugar || '—'],
      ...(data.department ? [['DEPARTAMENTO', data.department]] : []),
      ['FECHA', formatFechaHuman(data.fecha)],
      ['HORARIO', horario],
    ],
  });

  let y = doc.lastAutoTable.finalY + 6;

  const attendees = Array.isArray(data.attendees) ? data.attendees : [];
  const attRows = attendees
    .filter((a) => (a.nombre || '').trim() || (a.cargo || '').trim())
    .map((a) => [a.nombre || '—', a.cargo || '—', a.asistencia || 'Presente']);
  const attBody = attRows.length > 0 ? attRows : [['—', '—', '—']];

  const attCol1 = 58;
  const attCol2 = 68;
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    tableWidth: contentWidth(pageW),
    head: [['ASISTENTES', 'CARGO', 'ASISTENCIA']],
    body: attBody,
    theme: 'grid',
    headStyles: compactHeadStyles,
    styles: {
      ...baseTableStyles(),
      cellPadding: 1.6,
      valign: 'middle',
      minCellHeight: 8,
    },
    columnStyles: {
      0: { cellWidth: attCol1, overflow: 'linebreak' },
      1: { cellWidth: attCol2, overflow: 'linebreak' },
      2: { cellWidth: contentWidth(pageW) - attCol1 - attCol2, overflow: 'linebreak' },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  if (synerteam) {
    y = addTextSection(doc, 'TEMA PRINCIPAL', bulletLines(data.tema_principal), y, pageW);
    y = addTextSection(doc, 'DESARROLLO DE LA REUNIÓN', proseLines(data.desarrollo), y, pageW);
    y = addTextSection(doc, 'ACUERDOS', bulletLines(data.acuerdos), y, pageW);

    if (data.next_meeting_planned === 'yes' && (data.next_meeting_fecha || data.next_meeting_hora)) {
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
        margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
        tableWidth: contentWidth(pageW),
        theme: 'grid',
        styles: baseTableStyles(),
        columnStyles: {
          0: labelColumnStyle(),
          1: valueColumnStyle(pageW),
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
    const topics = Array.isArray(data.topics) ? data.topics : [];

    for (let i = 0; i < 3; i += 1) {
      const t = topics[i] || {};
      if (y > pageH - 55) {
        doc.addPage();
        y = 14;
      }
      const topicCol0 = 44;
      const topicCol1 = 68;
      autoTable(doc, {
        startY: y,
        margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
        tableWidth: contentWidth(pageW),
        head: [[topicTitles[i], 'DESCRIPCIÓN', 'COMENTARIOS']],
        body: [[t.titulo || '—', t.descripcion || '—', t.comentarios || '—']],
        theme: 'grid',
        headStyles: {
          ...compactHeadStyles,
          fillColor: topicColors[i],
        },
        styles: {
          ...baseTableStyles(),
          cellPadding: 1.8,
          minCellHeight: 10,
        },
        columnStyles: {
          0: { cellWidth: topicCol0, overflow: 'linebreak' },
          1: { cellWidth: topicCol1, overflow: 'linebreak' },
          2: { cellWidth: contentWidth(pageW) - topicCol0 - topicCol1, overflow: 'linebreak' },
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
      `BOSA Hub · Minuta de reunión${data.id ? ` · #${data.id}` : ''}`,
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
