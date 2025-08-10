import { ZohoSdkClient } from './zoho-sdk-client';
import { ZohoModule } from './zoho-types';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

/**
 * Interface for the database service client
 */
interface DatabaseClient {
  query: (sql: string, params: any[]) => Promise<any>;
  insert: (table: string, data: any) => Promise<any>;
  update: (table: string, id: string, data: any) => Promise<any>;
  delete: (table: string, id: string) => Promise<any>;
  transaction: <T>(callback: (trx: DatabaseClient) => Promise<T>) => Promise<T>;
}

/**
 * Configuration for the ZohoSyncService
 */
export interface ZohoSyncConfig {
  zohoClient: ZohoSdkClient;
  databaseClient: DatabaseClient;
  databaseOrchestratorUrl: string;
  aiPredictionServiceUrl?: string;
  apiGatewayUrl?: string;
}

/**
 * Sync status enum
 */
export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * Sync result interface
 */
export interface SyncResult {
  status: SyncStatus;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: Error[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  aiPredictionUpdateStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  aiPredictionUpdateError?: string;
}

/**
 * Service for synchronizing data between Zoho CRM and the database
 */
export class ZohoSyncService {
  private zohoClient: ZohoSdkClient;
  private databaseClient: DatabaseClient;
  private databaseOrchestratorUrl: string;
  private aiPredictionServiceUrl?: string;
  private apiGatewayUrl?: string;
  private syncInProgress: boolean = false;

  /**
   * Constructor
   * @param config Configuration for the ZohoSyncService
   */
  constructor(config: ZohoSyncConfig) {
    this.zohoClient = config.zohoClient;
    this.databaseClient = config.databaseClient;
    this.databaseOrchestratorUrl = config.databaseOrchestratorUrl;
    this.aiPredictionServiceUrl = config.aiPredictionServiceUrl;
    this.apiGatewayUrl = config.apiGatewayUrl;
  }

  /**
   * Synchronize stores from Zoho CRM to the database
   * @returns Sync result
   */
  public async syncStores(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      status: SyncStatus.IN_PROGRESS,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Get stores from Zoho CRM
      const zohoStores = await this.zohoClient.getRecords(ZohoModule.ACCOUNTS);
      result.recordsProcessed = zohoStores.data.length;

      // Process each store
      await this.databaseClient.transaction(async (trx) => {
        for (const zohoStore of zohoStores.data) {
          try {
            // Check if store already exists
            const existingStore = await trx.query(
              'SELECT * FROM stores WHERE id = $1',
              [zohoStore.id]
            );

            // Transform Zoho store to database store
            const store = this.transformZohoStore(zohoStore);

            if (existingStore.length > 0) {
              // Update existing store
              await trx.update('stores', store.id, store);
              result.recordsUpdated++;
            } else {
              // Create new store
              await trx.insert('stores', store);
              result.recordsCreated++;
            }
          } catch (error) {
            result.recordsFailed++;
            result.errors.push(error as Error);
          }
        }
      });

      result.status = SyncStatus.COMPLETED;
    } catch (error) {
      result.status = SyncStatus.FAILED;
      result.errors.push(error as Error);
    } finally {
      this.syncInProgress = false;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
    }

    return result;
  }

  /**
   * Synchronize products from Zoho CRM to the database
   * @returns Sync result
   */
  public async syncProducts(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      status: SyncStatus.IN_PROGRESS,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Get products from Zoho CRM
      const zohoProducts = await this.zohoClient.getRecords(ZohoModule.PRODUCTS);
      result.recordsProcessed = zohoProducts.data.length;

      // Process each product
      await this.databaseClient.transaction(async (trx) => {
        for (const zohoProduct of zohoProducts.data) {
          try {
            // Check if product already exists
            const existingProduct = await trx.query(
              'SELECT * FROM products WHERE id = $1',
              [zohoProduct.id]
            );

            // Transform Zoho product to database product
            const product = this.transformZohoProduct(zohoProduct);

            if (existingProduct.length > 0) {
              // Update existing product
              await trx.update('products', product.id, product);
              result.recordsUpdated++;
            } else {
              // Create new product
              await trx.insert('products', product);
              result.recordsCreated++;
            }
          } catch (error) {
            result.recordsFailed++;
            result.errors.push(error as Error);
          }
        }
      });

      result.status = SyncStatus.COMPLETED;
    } catch (error) {
      result.status = SyncStatus.FAILED;
      result.errors.push(error as Error);
    } finally {
      this.syncInProgress = false;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
    }

    return result;
  }

  /**
   * Synchronize invoices from Zoho CRM to the database
   * @returns Sync result
   */
  public async syncInvoices(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      status: SyncStatus.IN_PROGRESS,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Get invoices from Zoho CRM
      const zohoInvoices = await this.zohoClient.getRecords(ZohoModule.INVOICES);
      result.recordsProcessed = zohoInvoices.data.length;

      // Process each invoice
      await this.databaseClient.transaction(async (trx) => {
        for (const zohoInvoice of zohoInvoices.data) {
          try {
            // Check if invoice already exists
            const existingInvoice = await trx.query(
              'SELECT * FROM historical_invoices WHERE id = $1',
              [zohoInvoice.id]
            );

            // Transform Zoho invoice to database invoice
            const invoice = this.transformZohoInvoice(zohoInvoice);

            if (existingInvoice.length > 0) {
              // Update existing invoice
              await trx.update('historical_invoices', invoice.id, invoice);
              result.recordsUpdated++;
            } else {
              // Create new invoice
              await trx.insert('historical_invoices', invoice);
              result.recordsCreated++;
            }

            // Process invoice items
            if (zohoInvoice.Product_Details) {
              for (const zohoInvoiceItem of zohoInvoice.Product_Details) {
                try {
                  // Transform Zoho invoice item to database invoice item
                  const invoiceItem = this.transformZohoInvoiceItem(zohoInvoiceItem, invoice.id);

                  // Check if invoice item already exists
                  const existingInvoiceItem = await trx.query(
                    'SELECT * FROM invoice_items WHERE invoice_id = $1 AND product_id = $2',
                    [invoice.id, invoiceItem.product_id]
                  );

                  if (existingInvoiceItem.length > 0) {
                    // Update existing invoice item
                    await trx.update('invoice_items', existingInvoiceItem[0].id, invoiceItem);
                  } else {
                    // Create new invoice item
                    await trx.insert('invoice_items', invoiceItem);
                  }
                } catch (error) {
                  result.recordsFailed++;
                  result.errors.push(error as Error);
                }
              }
            }
          } catch (error) {
            result.recordsFailed++;
            result.errors.push(error as Error);
          }
        }
      });

      result.status = SyncStatus.COMPLETED;
    } catch (error) {
      result.status = SyncStatus.FAILED;
      result.errors.push(error as Error);
    } finally {
      this.syncInProgress = false;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
    }

    return result;
  }

  /**
   * Synchronize all data from Zoho CRM to the database
   * @param triggerAiUpdate Whether to trigger AI prediction update after sync
   * @returns Sync result
   */
  public async syncAll(triggerAiUpdate: boolean = true): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      status: SyncStatus.IN_PROGRESS,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Sync stores
      const storesResult = await this.syncStores();
      result.recordsProcessed += storesResult.recordsProcessed;
      result.recordsCreated += storesResult.recordsCreated;
      result.recordsUpdated += storesResult.recordsUpdated;
      result.recordsFailed += storesResult.recordsFailed;
      result.errors = [...result.errors, ...storesResult.errors];

      // Sync products
      const productsResult = await this.syncProducts();
      result.recordsProcessed += productsResult.recordsProcessed;
      result.recordsCreated += productsResult.recordsCreated;
      result.recordsUpdated += productsResult.recordsUpdated;
      result.recordsFailed += productsResult.recordsFailed;
      result.errors = [...result.errors, ...productsResult.errors];

      // Sync invoices
      const invoicesResult = await this.syncInvoices();
      result.recordsProcessed += invoicesResult.recordsProcessed;
      result.recordsCreated += invoicesResult.recordsCreated;
      result.recordsUpdated += invoicesResult.recordsUpdated;
      result.recordsFailed += invoicesResult.recordsFailed;
      result.errors = [...result.errors, ...invoicesResult.errors];

      // Trigger AI prediction update if requested
      if (triggerAiUpdate) {
        try {
          await this.triggerAiPredictionUpdate();
          result.aiPredictionUpdateStatus = 'SUCCESS';
        } catch (error) {
          logger.error('Failed to trigger AI prediction update', {
            error: (error as Error).message,
            stack: (error as Error).stack
          });
          result.aiPredictionUpdateStatus = 'FAILED';
          result.aiPredictionUpdateError = (error as Error).message;
        }
      } else {
        result.aiPredictionUpdateStatus = 'SKIPPED';
      }

      result.status = SyncStatus.COMPLETED;
    } catch (error) {
      result.status = SyncStatus.FAILED;
      result.errors.push(error as Error);
    } finally {
      this.syncInProgress = false;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
    }

    return result;
  }

  /**
   * Trigger AI prediction update
   */
  public async triggerAiPredictionUpdate(): Promise<void> {
    // Try using API Gateway first if available
    if (this.apiGatewayUrl) {
      try {
        await axios.post(`${this.apiGatewayUrl}/mangalm/ai-predictions/batch`, {
          forceUpdate: true
        });
        logger.info('Successfully triggered AI prediction update via API Gateway');
        return;
      } catch (error) {
        logger.warn('Failed to trigger AI prediction update via API Gateway, falling back to direct service call', {
          error: (error as Error).message
        });
      }
    }

    // Fall back to direct service call if API Gateway is not available or failed
    if (this.aiPredictionServiceUrl) {
      try {
        await axios.post(`${this.aiPredictionServiceUrl}/api/predictions/batch`, {
          forceUpdate: true
        });
        logger.info('Successfully triggered AI prediction update via direct service call');
        return;
      } catch (error) {
        logger.error('Failed to trigger AI prediction update via direct service call', {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
        throw error;
      }
    } else {
      const error = new Error('Cannot trigger AI prediction update: No API Gateway or AI Prediction Service URL configured');
      logger.error(error.message);
      throw error;
    }
  }

  /**
   * Trigger call prioritization update
   */
  public async triggerCallPrioritizationUpdate(): Promise<void> {
    // Try using API Gateway first if available
    if (this.apiGatewayUrl) {
      try {
        await axios.post(`${this.apiGatewayUrl}/mangalm/call-prioritization/generate`, {
          forceUpdate: true
        });
        logger.info('Successfully triggered call prioritization update via API Gateway');
        return;
      } catch (error) {
        logger.warn('Failed to trigger call prioritization update via API Gateway, falling back to direct service call', {
          error: (error as Error).message
        });
      }
    }

    // Fall back to direct service call if API Gateway is not available or failed
    if (this.aiPredictionServiceUrl) {
      try {
        await axios.post(`${this.aiPredictionServiceUrl}/api/prioritization/generate`, {
          forceUpdate: true
        });
        logger.info('Successfully triggered call prioritization update via direct service call');
        return;
      } catch (error) {
        logger.error('Failed to trigger call prioritization update via direct service call', {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
        throw error;
      }
    } else {
      const error = new Error('Cannot trigger call prioritization update: No API Gateway or AI Prediction Service URL configured');
      logger.error(error.message);
      throw error;
    }
  }

  /**
   * Transform a Zoho store to a database store
   * @param zohoStore Zoho store
   * @returns Database store
   */
  private transformZohoStore(zohoStore: any): any {
    return {
      id: zohoStore.id || uuidv4(),
      name: zohoStore.Account_Name || '',
      address: zohoStore.Billing_Street || '',
      city: zohoStore.Billing_City || '',
      region: zohoStore.Billing_State || '',
      contact_person: zohoStore.Contact_Name || '',
      phone: zohoStore.Phone || '',
      email: zohoStore.Email || '',
      store_size: this.mapStoreSize(zohoStore.Annual_Revenue),
      call_frequency: this.mapCallFrequency(zohoStore.Account_Type),
      notes: zohoStore.Description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Transform a Zoho product to a database product
   * @param zohoProduct Zoho product
   * @returns Database product
   */
  private transformZohoProduct(zohoProduct: any): any {
    return {
      id: zohoProduct.id || uuidv4(),
      name: zohoProduct.Product_Name || '',
      category: zohoProduct.Product_Category || '',
      subcategory: zohoProduct.Product_Sub_Category || '',
      brand: zohoProduct.Vendor_Name || '',
      unit: zohoProduct.Unit || '',
      unit_price: parseFloat(zohoProduct.Unit_Price) || 0,
      stock_quantity: parseInt(zohoProduct.Qty_in_Stock) || 0,
      reorder_level: parseInt(zohoProduct.Reorder_Level) || 0,
      expiry_date: zohoProduct.Expiry_Date || null,
      warehouse_location: zohoProduct.Warehouse_Location || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Transform a Zoho invoice to a database invoice
   * @param zohoInvoice Zoho invoice
   * @returns Database invoice
   */
  private transformZohoInvoice(zohoInvoice: any): any {
    return {
      id: zohoInvoice.id || uuidv4(),
      store_id: zohoInvoice.Account_ID?.id || '',
      invoice_date: zohoInvoice.Invoice_Date || new Date().toISOString(),
      total_amount: parseFloat(zohoInvoice.Sub_Total) || 0,
      payment_status: zohoInvoice.Status || '',
      notes: zohoInvoice.Terms_and_Conditions || '',
      created_at: new Date().toISOString()
    };
  }

  /**
   * Transform a Zoho invoice item to a database invoice item
   * @param zohoInvoiceItem Zoho invoice item
   * @param invoiceId Invoice ID
   * @returns Database invoice item
   */
  private transformZohoInvoiceItem(zohoInvoiceItem: any, invoiceId: string): any {
    return {
      id: uuidv4(),
      invoice_id: invoiceId,
      product_id: zohoInvoiceItem.product?.id || '',
      quantity: parseInt(zohoInvoiceItem.quantity) || 0,
      unit_price: parseFloat(zohoInvoiceItem.unit_price) || 0,
      discount: parseFloat(zohoInvoiceItem.Discount) || 0,
      total_price: parseFloat(zohoInvoiceItem.total) || 0
    };
  }

  /**
   * Map store size from Zoho annual revenue
   * @param annualRevenue Annual revenue
   * @returns Store size
   */
  private mapStoreSize(annualRevenue: string): 'Small' | 'Medium' | 'Large' {
    const revenue = parseFloat(annualRevenue) || 0;
    if (revenue < 100000) {
      return 'Small';
    } else if (revenue < 500000) {
      return 'Medium';
    } else {
      return 'Large';
    }
  }

  /**
   * Map call frequency from Zoho account type
   * @param accountType Account type
   * @returns Call frequency
   */
  private mapCallFrequency(accountType: string): 'Weekly' | 'Bi-weekly' | 'Monthly' {
    switch (accountType) {
      case 'Customer - Direct':
        return 'Weekly';
      case 'Customer - Channel':
        return 'Bi-weekly';
      default:
        return 'Monthly';
    }
  }
}
