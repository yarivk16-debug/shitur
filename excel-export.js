(function attachExcelExporter(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MarineShiftExcel = api;
})(typeof window !== "undefined" ? window : globalThis, function createExcelExporter() {
  const encoder = new TextEncoder();

  function xmlEscape(value) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function columnName(index) {
    let value = index + 1;
    let name = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }

  function excelDateSerial(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return (timestamp - Date.UTC(1899, 11, 30)) / 86400000;
  }

  function worksheetXml(sheet) {
    const rows = sheet.rows || [];
    const maxColumns = Math.max(1, ...rows.map((row) => row.length));
    const widths = sheet.columnWidths || [];
    const columns = Array.from({ length: maxColumns }, (_, index) => {
      const width = Math.max(8, Math.min(42, Number(widths[index]) || 16));
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    }).join("");

    const sheetRows = rows.map((row, rowIndex) => {
      const cells = row.map((rawCell, columnIndex) => {
        const cell = rawCell && typeof rawCell === "object" && Object.prototype.hasOwnProperty.call(rawCell, "value")
          ? rawCell
          : { value: rawCell, type: "string" };
        const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
        const type = rowIndex === 0 ? "header" : (cell.type || "string");

        if (type === "number") {
          const number = Number(cell.value);
          return `<c r="${reference}" s="4"><v>${Number.isFinite(number) ? number : 0}</v></c>`;
        }
        if (type === "date") {
          const serial = excelDateSerial(cell.value);
          if (serial !== null) return `<c r="${reference}" s="3"><v>${serial}</v></c>`;
        }

        const style = type === "header" ? 1 : 2;
        return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
      }).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join("");

    const lastCell = `${columnName(maxColumns - 1)}${Math.max(1, rows.length)}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:${lastCell}"/>
</worksheet>`;
  }

  function crcTable() {
    return Array.from({ length: 256 }, (_, number) => {
      let crc = number;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      return crc >>> 0;
    });
  }

  const CRC_TABLE = crcTable();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.min(2107, Math.max(1980, date.getFullYear()));
    return {
      time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | (Math.floor(date.getSeconds() / 2) & 31),
      date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
    };
  }

  function concatBytes(parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      result.set(part, offset);
      offset += part.length;
    });
    return result;
  }

  function headerBytes(length, writer) {
    const bytes = new Uint8Array(length);
    writer(new DataView(bytes.buffer));
    return bytes;
  }

  function zipStore(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const stamp = dosDateTime();

    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
      const checksum = crc32(data);
      const local = headerBytes(30, (view) => {
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0x0800, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, stamp.time, true);
        view.setUint16(12, stamp.date, true);
        view.setUint32(14, checksum, true);
        view.setUint32(18, data.length, true);
        view.setUint32(22, data.length, true);
        view.setUint16(26, name.length, true);
        view.setUint16(28, 0, true);
      });
      localParts.push(local, name, data);

      const central = headerBytes(46, (view) => {
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0x0800, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, stamp.time, true);
        view.setUint16(14, stamp.date, true);
        view.setUint32(16, checksum, true);
        view.setUint32(20, data.length, true);
        view.setUint32(24, data.length, true);
        view.setUint16(28, name.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, 0, true);
        view.setUint32(42, offset, true);
      });
      centralParts.push(central, name);
      offset += local.length + name.length + data.length;
    });

    const centralDirectory = concatBytes(centralParts);
    const end = headerBytes(22, (view) => {
      view.setUint32(0, 0x06054b50, true);
      view.setUint16(4, 0, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, files.length, true);
      view.setUint16(10, files.length, true);
      view.setUint32(12, centralDirectory.length, true);
      view.setUint32(16, offset, true);
      view.setUint16(20, 0, true);
    });
    return concatBytes([...localParts, centralDirectory, end]);
  }

  function createWorkbookBytes(sheets) {
    const safeSheets = sheets.map((sheet, index) => ({
      ...sheet,
      name: String(sheet.name || `Sheet${index + 1}`).slice(0, 31)
    }));
    const sheetOverrides = safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    const workbookSheets = safeSheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
    const relationships = safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
    const stylesRelationId = safeSheets.length + 1;

    const files = [
      {
        name: "[Content_Types].xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`
      },
      {
        name: "_rels/.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      },
      {
        name: "xl/workbook.xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets></workbook>`
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${stylesRelationId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      },
      {
        name: "xl/styles.xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B6E69"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7E2E5"/></left><right style="thin"><color rgb="FFD7E2E5"/></right><top style="thin"><color rgb="FFD7E2E5"/></top><bottom style="thin"><color rgb="FFD7E2E5"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
      }
    ];

    safeSheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: worksheetXml(sheet) }));
    return zipStore(files);
  }

  function createWorkbookBlob(sheets) {
    return new Blob([createWorkbookBytes(sheets)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  return { createWorkbookBlob, createWorkbookBytes };
});
