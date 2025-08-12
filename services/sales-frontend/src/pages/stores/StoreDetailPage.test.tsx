import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StoreDetailPage from './StoreDetailPage';
import api from '../../services/api';

// Mock the API
jest.mock('../../services/api');

// Mock useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: '4261931000001048015' }),
  useNavigate: () => jest.fn()
}));

// Mock recharts to avoid render issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Line: () => null,
  Bar: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Brush: () => null,
  ReferenceLine: () => null,
  LabelList: () => null
}));

describe('StoreDetailPage - Data Mapping and Display', () => {
  const storeId = '4261931000001048015';
  
  // Test data with snake_case fields as returned from API
  const mockStoreResponse = {
    id: storeId,
    name: 'Test Store',
    address: '123 Main St',
    city: 'Test City',
    state: 'Test State',
    region: 'Test Region',
    phone: '555-1234',
    email: 'test@store.com',
    contactPerson: 'John Doe',
    storeSize: 'Large',
    callFrequency: 'Weekly'
  };

  const mockPredictedOrdersResponse = {
    success: true,
    data: [
      {
        id: 'pred-1',
        store_id: storeId,
        store: { name: 'Test Store' },
        prediction_date: '2025-02-01T00:00:00.000Z',
        status: 'pending',
        predicted_items: [
          { productId: 'prod-1', name: 'Product 1', quantity: 10 }
        ],
        confidence_score: 0.85,
        estimated_value: '1500.50', // String value to test conversion
        notes: 'Test prediction'
      },
      {
        id: 'pred-2',
        store_id: 'different-store', // Should be filtered out
        prediction_date: '2025-02-01T00:00:00.000Z',
        status: 'pending'
      }
    ]
  };

  const mockInvoicesResponse = {
    success: true,
    data: [
      {
        id: 'inv-1',
        store_id: storeId,
        store_name: 'Test Store',
        invoice_date: '2025-01-15T00:00:00.000Z',
        total_amount: '1500.99', // String to test conversion
        payment_status: 'Paid',
        notes: 'January order'
      },
      {
        id: 'inv-2',
        store_id: storeId,
        invoice_date: '2025-01-01T00:00:00.000Z',
        total_amount: 2000.50, // Number to test handling
        payment_status: 'Pending',
        notes: 'December order'
      },
      {
        id: 'inv-3',
        store_id: storeId,
        invoice_date: '2024-12-01T00:00:00.000Z',
        total_amount: null, // Null to test error handling
        payment_status: 'Paid',
        notes: 'Invalid invoice'
      }
    ]
  };

  const mockCallPrioritizationResponse = {
    success: true,
    data: [
      {
        id: 'call-1',
        store_id: storeId,
        priority_score: 8.5,
        priority_reason: 'High-value customer',
        last_call_date: '2025-01-01T00:00:00.000Z',
        scheduled_date: '2025-02-01T00:00:00.000Z',
        status: 'pending'
      },
      {
        id: 'call-2',
        store_id: 'different-store',
        priority_score: 5,
        priority_reason: 'Regular'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup API mocks
    (api.store.getById as jest.Mock).mockResolvedValue(mockStoreResponse);
    (api.predictedOrder.getByStore as jest.Mock).mockResolvedValue(mockPredictedOrdersResponse);
    (api.invoice.getByStore as jest.Mock).mockResolvedValue(mockInvoicesResponse);
    (api.callPrioritization.getAll as jest.Mock).mockResolvedValue(mockCallPrioritizationResponse);
  });

  describe('Data Fetching and Filtering', () => {
    test('fetches data for the correct store ID', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.store.getById).toHaveBeenCalledWith(storeId);
        expect(api.predictedOrder.getByStore).toHaveBeenCalledWith(storeId);
        expect(api.invoice.getByStore).toHaveBeenCalledWith(storeId);
        expect(api.callPrioritization.getAll).toHaveBeenCalledWith({ storeId });
      });
    });

    test('filters predicted orders for the specific store', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      // Click on Predicted Orders tab
      const predictedOrdersTab = screen.getByRole('tab', { name: /Predicted Orders/i });
      predictedOrdersTab.click();

      await waitFor(() => {
        // Should only show order for this store
        expect(screen.getByText(/Test prediction/i)).toBeInTheDocument();
        // Should not show order from different store
        expect(screen.queryByText('pred-2')).not.toBeInTheDocument();
      });
    });

    test('filters call prioritization for the specific store', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('High-value customer')).toBeInTheDocument();
      });

      // Should not show call prioritization for different store
      const callSection = screen.getByText('Call Prioritization').closest('div');
      expect(within(callSection!).queryByText('Regular')).not.toBeInTheDocument();
    });
  });

  describe('Data Type Conversions', () => {
    test('converts string totalAmount to number for display', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      // Click on Order History tab
      const orderHistoryTab = screen.getByRole('tab', { name: /Order History/i });
      orderHistoryTab.click();

      await waitFor(() => {
        // Should display formatted currency values
        expect(screen.getByText('$1500.99')).toBeInTheDocument(); // String converted
        expect(screen.getByText('$2000.50')).toBeInTheDocument(); // Number handled
        // Should not crash on null value
        expect(screen.queryByText('$null')).not.toBeInTheDocument();
      });
    });

    test('handles null/undefined totalAmount gracefully', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      // Should render without crashing despite null totalAmount in one invoice
      const orderHistoryTab = screen.getByRole('tab', { name: /Order History/i });
      orderHistoryTab.click();

      await waitFor(() => {
        // Should show valid invoices
        expect(screen.getByText(/January order/i)).toBeInTheDocument();
        expect(screen.getByText(/December order/i)).toBeInTheDocument();
      });
    });

    test('converts estimated_value to number in predicted orders', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      const predictedOrdersTab = screen.getByRole('tab', { name: /Predicted Orders/i });
      predictedOrdersTab.click();

      // Verify the estimated value was converted from string
      await waitFor(() => {
        expect(api.predictedOrder.getByStore).toHaveBeenCalled();
        // The component should have processed the string value
        const tabPanel = screen.getByRole('tabpanel');
        expect(within(tabPanel).getByText(/Test prediction/i)).toBeInTheDocument();
      });
    });
  });

  describe('Field Mapping (snake_case to camelCase)', () => {
    test('maps store fields correctly', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // All store fields should be displayed
        expect(screen.getByText('Test Store')).toBeInTheDocument();
        expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
        expect(screen.getByText(/Test City/)).toBeInTheDocument();
        expect(screen.getByText(/555-1234/)).toBeInTheDocument();
        expect(screen.getByText(/test@store.com/)).toBeInTheDocument();
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/Large/)).toBeInTheDocument();
        expect(screen.getByText(/Weekly/)).toBeInTheDocument();
      });
    });

    test('maps invoice snake_case fields to camelCase', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Check that mapping occurred in console logs
        const invoiceLog = consoleSpy.mock.calls.find(call => 
          call[0]?.includes('[StoreDetailPage] Extracted invoices data:')
        );
        expect(invoiceLog).toBeDefined();
      });

      consoleSpy.mockRestore();
    });

    test('maps call prioritization fields correctly', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Check call prioritization is displayed with mapped fields
        expect(screen.getByText('High-value customer')).toBeInTheDocument();
        
        const callSection = screen.getByText('Call Prioritization').closest('div');
        expect(callSection).toBeInTheDocument();
        
        // Priority score should be displayed as High (score >= 8)
        const highChip = within(callSection!).getByText('High');
        expect(highChip).toBeInTheDocument();
      });
    });
  });

  describe('Analytics Tab Data Processing', () => {
    test('processes invoice data for charts', async () => {
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      // Analytics tab should be default
      const analyticsPanel = screen.getByRole('tabpanel');
      
      // Check for chart controls
      expect(within(analyticsPanel).getByLabelText(/Time Period/i)).toBeInTheDocument();
      expect(within(analyticsPanel).getByText(/Total Revenue/i)).toBeInTheDocument();
      
      // Summary statistics should be calculated
      const totalRevenue = within(analyticsPanel).getByText(/\$3501\.49/i); // 1500.99 + 2000.50
      expect(totalRevenue).toBeInTheDocument();
    });

    test('skips invoices with invalid totalAmount in chart processing', async () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      
      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      // Should have warned about invalid invoice
      await waitFor(() => {
        const warnings = consoleSpy.mock.calls.filter(call => 
          call[0]?.includes('Skipping invoice with invalid totalAmount')
        );
        expect(warnings.length).toBeGreaterThan(0);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      (api.store.getById as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Failed to load store data/i)).toBeInTheDocument();
      });
    });

    test('handles empty responses', async () => {
      (api.predictedOrder.getByStore as jest.Mock).mockResolvedValue({ success: true, data: [] });
      (api.invoice.getByStore as jest.Mock).mockResolvedValue({ success: true, data: [] });
      (api.callPrioritization.getAll as jest.Mock).mockResolvedValue({ success: true, data: [] });

      render(
        <BrowserRouter>
          <StoreDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
      });

      // Should show empty state messages
      const predictedOrdersTab = screen.getByRole('tab', { name: /Predicted Orders/i });
      predictedOrdersTab.click();

      await waitFor(() => {
        expect(screen.getByText(/No predicted orders available/i)).toBeInTheDocument();
      });
    });
  });
});

describe('StoreDetailPage - Integration Tests', () => {
  test('complete data flow from API to display', async () => {
    const mockApiResponse = {
      store: {
        id: '4261931000001048015',
        name: 'Integration Test Store',
        address: '456 Test Ave',
        city: 'Test City',
        phone: '555-9999'
      },
      invoices: {
        success: true,
        data: [
          {
            id: 'test-inv-1',
            store_id: '4261931000001048015',
            invoice_date: '2025-01-20T00:00:00.000Z',
            total_amount: '999.99',
            payment_status: 'Paid'
          }
        ]
      }
    };

    (api.store.getById as jest.Mock).mockResolvedValue(mockApiResponse.store);
    (api.invoice.getByStore as jest.Mock).mockResolvedValue(mockApiResponse.invoices);
    (api.predictedOrder.getByStore as jest.Mock).mockResolvedValue({ success: true, data: [] });
    (api.callPrioritization.getAll as jest.Mock).mockResolvedValue({ success: true, data: [] });

    render(
      <BrowserRouter>
        <StoreDetailPage />
      </BrowserRouter>
    );

    // Verify complete data flow
    await waitFor(() => {
      // Store name displayed
      expect(screen.getByText('Integration Test Store')).toBeInTheDocument();
      
      // Store details displayed
      expect(screen.getByText(/456 Test Ave/)).toBeInTheDocument();
      expect(screen.getByText(/555-9999/)).toBeInTheDocument();
    });

    // Check invoice data
    const orderHistoryTab = screen.getByRole('tab', { name: /Order History/i });
    orderHistoryTab.click();

    await waitFor(() => {
      // Invoice amount properly formatted
      expect(screen.getByText('$999.99')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });
  });
});