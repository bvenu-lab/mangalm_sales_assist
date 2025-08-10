import { exportToCSV, exportToExcel } from '../exportUtils';

// Mock the file download functionality
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'blob:url'),
    revokeObjectURL: jest.fn(),
  },
});

// Mock document.createElement and click
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
    style: {},
  })),
});

describe('Export Utils', () => {
  const sampleData = [
    { id: 1, name: 'Test Store', sales: 1000 },
    { id: 2, name: 'Another Store', sales: 2000 }
  ];

  test('exportToCSV works without errors', () => {
    expect(() => exportToCSV(sampleData, 'test')).not.toThrow();
  });

  test('exportToExcel works without errors', () => {
    expect(() => exportToExcel(sampleData, 'test')).not.toThrow();
  });

  test('exportToCSV handles empty data', () => {
    expect(() => exportToCSV([], 'empty')).not.toThrow();
  });

  test('exportToExcel handles empty data', () => {
    expect(() => exportToExcel([], 'empty')).not.toThrow();
  });
});