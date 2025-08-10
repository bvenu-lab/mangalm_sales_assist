/**
 * World-class Data Export Utilities
 * Supports CSV, Excel, PDF, and JSON exports
 */

interface ExportOptions {
  filename?: string;
  sheetName?: string;
  includeHeaders?: boolean;
  dateFormat?: string;
  numberFormat?: string;
  columnWidths?: number[];
  orientation?: 'portrait' | 'landscape';
}

/**
 * Export data to CSV format
 */
export const exportToCSV = (
  data: any[],
  columns: { key: string; label: string }[],
  options: ExportOptions = {}
) => {
  const {
    filename = `export_${Date.now()}`,
    includeHeaders = true,
    dateFormat = 'YYYY-MM-DD',
  } = options;

  // Build CSV content
  let csvContent = '';

  // Add headers
  if (includeHeaders) {
    csvContent += columns.map(col => `"${col.label}"`).join(',') + '\n';
  }

  // Add data rows
  data.forEach(row => {
    const values = columns.map(col => {
      let value = row[col.key];

      // Format dates
      if (value instanceof Date) {
        value = formatDate(value, dateFormat);
      }
      // Handle null/undefined
      else if (value === null || value === undefined) {
        value = '';
      }
      // Escape quotes in strings
      else if (typeof value === 'string') {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      // Numbers and booleans
      else {
        value = String(value);
      }

      return value;
    });

    csvContent += values.join(',') + '\n';
  });

  // Create blob and download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

/**
 * Export data to Excel format (using native browser capabilities)
 */
export const exportToExcel = (
  data: any[],
  columns: { key: string; label: string; width?: number }[],
  options: ExportOptions = {}
) => {
  const {
    filename = `export_${Date.now()}`,
    sheetName = 'Sheet1',
    includeHeaders = true,
  } = options;

  // Create HTML table
  let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
  html += '<head>';
  html += '<meta charset="utf-8"/>';
  html += '<!--[if gte mso 9]>';
  html += '<xml>';
  html += '<x:ExcelWorkbook>';
  html += '<x:ExcelWorksheets>';
  html += '<x:ExcelWorksheet>';
  html += `<x:Name>${sheetName}</x:Name>`;
  html += '<x:WorksheetOptions>';
  html += '<x:DisplayGridlines/>';
  html += '</x:WorksheetOptions>';
  html += '</x:ExcelWorksheet>';
  html += '</x:ExcelWorksheets>';
  html += '</x:ExcelWorkbook>';
  html += '</xml>';
  html += '<![endif]-->';
  html += '<style>';
  html += 'table { border-collapse: collapse; width: 100%; }';
  html += 'th { background-color: #4CAF50; color: white; font-weight: bold; padding: 12px; text-align: left; border: 1px solid #ddd; }';
  html += 'td { padding: 8px; text-align: left; border: 1px solid #ddd; }';
  html += 'tr:nth-child(even) { background-color: #f2f2f2; }';
  html += '.number { text-align: right; mso-number-format: "0.00"; }';
  html += '.date { mso-number-format: "yyyy-mm-dd"; }';
  html += '.currency { text-align: right; mso-number-format: "$#,##0.00"; }';
  html += '.percentage { text-align: right; mso-number-format: "0.00%"; }';
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<table>';

  // Add headers
  if (includeHeaders) {
    html += '<thead><tr>';
    columns.forEach(col => {
      const width = col.width ? `style="width: ${col.width}px;"` : '';
      html += `<th ${width}>${col.label}</th>`;
    });
    html += '</tr></thead>';
  }

  // Add data rows
  html += '<tbody>';
  data.forEach((row, rowIndex) => {
    html += `<tr>`;
    columns.forEach(col => {
      let value = row[col.key];
      let className = '';

      // Determine cell type and format
      if (value instanceof Date) {
        className = 'date';
        value = formatDate(value, 'YYYY-MM-DD');
      } else if (typeof value === 'number') {
        if (col.key.toLowerCase().includes('price') || col.key.toLowerCase().includes('amount')) {
          className = 'currency';
        } else if (col.key.toLowerCase().includes('percent') || col.key.toLowerCase().includes('rate')) {
          className = 'percentage';
          value = value / 100; // Excel expects decimal for percentage
        } else {
          className = 'number';
        }
      } else if (value === null || value === undefined) {
        value = '';
      }

      html += `<td class="${className}">${value}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  html += '</table>';
  html += '</body>';
  html += '</html>';

  // Create blob and download
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `${filename}.xls`);
};

/**
 * Export data to JSON format
 */
export const exportToJSON = (
  data: any[],
  options: ExportOptions = {}
) => {
  const {
    filename = `export_${Date.now()}`,
  } = options;

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, `${filename}.json`);
};

/**
 * Export data to PDF format (creates a formatted HTML that opens as PDF)
 */
export const exportToPDF = (
  data: any[],
  columns: { key: string; label: string }[],
  options: ExportOptions = {}
) => {
  const {
    filename = `export_${Date.now()}`,
    includeHeaders = true,
    orientation = 'portrait',
  } = options;

  // Create HTML document
  let html = '<!DOCTYPE html>';
  html += '<html>';
  html += '<head>';
  html += '<meta charset="utf-8">';
  html += `<title>${filename}</title>`;
  html += '<style>';
  html += '@page { size: ' + (orientation === 'landscape' ? 'landscape' : 'portrait') + '; margin: 1cm; }';
  html += '@media print { body { -webkit-print-color-adjust: exact; } }';
  html += 'body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }';
  html += 'h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }';
  html += 'table { width: 100%; border-collapse: collapse; margin-top: 20px; page-break-inside: auto; }';
  html += 'thead { display: table-header-group; }';
  html += 'tr { page-break-inside: avoid; page-break-after: auto; }';
  html += 'th { background-color: #3498db; color: white; padding: 10px; text-align: left; font-weight: bold; }';
  html += 'td { padding: 8px; border-bottom: 1px solid #ecf0f1; }';
  html += 'tr:nth-child(even) { background-color: #f8f9fa; }';
  html += '.footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #7f8c8d; }';
  html += '.meta-info { margin-bottom: 20px; color: #7f8c8d; }';
  html += '.summary { background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }';
  html += '</style>';
  html += '</head>';
  html += '<body>';

  // Add header
  html += `<h1>Data Export Report</h1>`;
  html += '<div class="meta-info">';
  html += `<strong>Generated:</strong> ${new Date().toLocaleString()}<br>`;
  html += `<strong>Total Records:</strong> ${data.length}<br>`;
  html += `<strong>Format:</strong> PDF Report`;
  html += '</div>';

  // Add summary if data has numeric columns
  const numericColumns = columns.filter(col => {
    return data.length > 0 && typeof data[0][col.key] === 'number';
  });

  if (numericColumns.length > 0) {
    html += '<div class="summary">';
    html += '<h3>Summary Statistics</h3>';
    numericColumns.forEach(col => {
      const values = data.map(row => row[col.key]).filter(v => typeof v === 'number');
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      html += `<strong>${col.label}:</strong> `;
      html += `Min: ${formatNumber(min)} | `;
      html += `Max: ${formatNumber(max)} | `;
      html += `Avg: ${formatNumber(avg)} | `;
      html += `Total: ${formatNumber(sum)}<br>`;
    });
    html += '</div>';
  }

  // Add table
  html += '<table>';

  // Add headers
  if (includeHeaders) {
    html += '<thead><tr>';
    columns.forEach(col => {
      html += `<th>${col.label}</th>`;
    });
    html += '</tr></thead>';
  }

  // Add data rows
  html += '<tbody>';
  data.forEach(row => {
    html += '<tr>';
    columns.forEach(col => {
      let value = row[col.key];

      if (value instanceof Date) {
        value = formatDate(value, 'YYYY-MM-DD HH:mm');
      } else if (typeof value === 'number') {
        value = formatNumber(value);
      } else if (value === null || value === undefined) {
        value = '-';
      }

      html += `<td>${value}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  html += '</table>';

  // Add footer
  html += '<div class="footer">';
  html += `Page <span class="page"></span> | ${filename}`;
  html += '</div>';

  html += '</body>';
  html += '</html>';

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto-trigger print dialog
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

/**
 * Smart export that chooses format based on data characteristics
 */
export const smartExport = (
  data: any[],
  columns: { key: string; label: string }[],
  preferredFormat?: 'csv' | 'excel' | 'json' | 'pdf'
) => {
  // Determine best format
  let format = preferredFormat;

  if (!format) {
    // Choose format based on data characteristics
    const hasComplexData = data.some(row => 
      Object.values(row).some(val => 
        typeof val === 'object' && val !== null && !(val instanceof Date)
      )
    );

    const hasLargeText = data.some(row =>
      Object.values(row).some(val =>
        typeof val === 'string' && val.length > 100
      )
    );

    if (hasComplexData) {
      format = 'json';
    } else if (hasLargeText) {
      format = 'pdf';
    } else if (data.length > 1000) {
      format = 'csv'; // Most efficient for large datasets
    } else {
      format = 'excel'; // Best for general use
    }
  }

  // Export based on format
  switch (format) {
    case 'csv':
      exportToCSV(data, columns);
      break;
    case 'excel':
      exportToExcel(data, columns);
      break;
    case 'json':
      exportToJSON(data);
      break;
    case 'pdf':
      exportToPDF(data, columns);
      break;
    default:
      exportToExcel(data, columns);
  }

  return format;
};

// Helper functions
const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const formatDate = (date: Date, format: string): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};