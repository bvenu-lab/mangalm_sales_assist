import * as ZOHOCRMSDK from '@zohocrm/nodejs-sdk-2.1';
import { Logger } from '../../utils/logger';
import { ZohoModule } from './zoho-types';
import performanceOptimizer from '../../utils/performance-optimizer';

/**
 * Configuration for the ZohoSdkClient
 */
export interface ZohoSdkConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  apiDomain?: string;
  tokenRefreshIntervalMs?: number;
  environment?: 'PRODUCTION' | 'SANDBOX' | 'DEVELOPER';
}

/**
 * Zoho SDK client for interacting with Zoho CRM API using the official SDK
 */
export class ZohoSdkClient {
  private config: ZohoSdkConfig;
  private logger: Logger;
  private initialized: boolean = false;
  private refreshTokenInterval: NodeJS.Timeout | null = null;

  /**
   * Constructor
   * @param config Zoho SDK configuration
   * @param logger Logger instance
   */
  constructor(config: ZohoSdkConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the SDK
   * @returns Promise that resolves when the SDK is initialized
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing Zoho SDK');

      // Set environment
      let environment;
      switch (this.config.environment) {
        case 'SANDBOX':
          environment = ZOHOCRMSDK.USDataCenter.SANDBOX();
          break;
        case 'DEVELOPER':
          environment = ZOHOCRMSDK.USDataCenter.DEVELOPER();
          break;
        case 'PRODUCTION':
        default:
          environment = ZOHOCRMSDK.USDataCenter.PRODUCTION();
          break;
      }

      // Create token
      const token = new ZOHOCRMSDK.OAuthBuilder()
        .clientId(this.config.clientId)
        .clientSecret(this.config.clientSecret)
        .refreshToken(this.config.refreshToken)
        .build();

      // Initialize SDK
      await ZOHOCRMSDK.InitializeBuilder()
        .environment(environment)
        .token(token)
        .initialize();

      this.initialized = true;
      this.logger.info('Zoho SDK initialized successfully');

      // Start token refresh interval
      this.startTokenRefreshInterval();
    } catch (error) {
      this.logger.error('Failed to initialize Zoho SDK', { error });
      throw error;
    }
  }

  /**
   * Start token refresh interval
   */
  private startTokenRefreshInterval(): void {
    const intervalMs = this.config.tokenRefreshIntervalMs || 3540000; // Default to 59 minutes (token expires in 60 minutes)
    this.refreshTokenInterval = setInterval(() => {
      this.refreshToken().catch((error) => {
        this.logger.error('Failed to refresh token', { error: error.message });
      });
    }, intervalMs);
  }

  /**
   * Stop token refresh interval
   */
  public stopTokenRefreshInterval(): void {
    if (this.refreshTokenInterval) {
      clearInterval(this.refreshTokenInterval);
      this.refreshTokenInterval = null;
    }
  }

  /**
   * Refresh token
   * @returns Promise that resolves when the token is refreshed
   */
  public async refreshToken(): Promise<void> {
    try {
      this.logger.info('Refreshing Zoho token');
      
      // The SDK handles token refresh automatically, but we can force it
      const userTokens = new ZOHOCRMSDK.UserSignature(this.config.refreshToken);
      await ZOHOCRMSDK.TokenStore.getTokenFromStore(userTokens);
      
      this.logger.info('Zoho token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh Zoho token', { error });
      throw error;
    }
  }

  /**
   * Get records from a Zoho module
   * @param module Zoho module
   * @param params Optional parameters
   * @returns Promise that resolves with the records
   */
  public async getRecords(module: ZohoModule, params?: any): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Getting records from ${module}`, { params });

        // Get instance of RecordOperations Class
        const recordOperations = new ZOHOCRMSDK.RecordOperations();
        
        // Get instance of ParameterMap Class
        const paramInstance = new ZOHOCRMSDK.ParameterMap();
        
        // Add parameters if provided
        if (params) {
          if (params.page) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.PAGE, params.page);
          }
          if (params.per_page) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.PER_PAGE, params.per_page);
          }
          if (params.fields) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.FIELDS, params.fields.join(','));
          }
          if (params.sort_by) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.SORT_BY, params.sort_by);
          }
          if (params.sort_order) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.SORT_ORDER, params.sort_order);
          }
          if (params.converted) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.CONVERTED, params.converted);
          }
          if (params.approved) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.APPROVED, params.approved);
          }
          if (params.include_child) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.INCLUDE_CHILD, params.include_child);
          }
          if (params.territory_id) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.TERRITORY_ID, params.territory_id);
          }
          if (params.custom_view_id) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordsParam.CUSTOM_VIEW_ID, params.custom_view_id);
          }
        }
        
        // Call getRecords method
        const response = await recordOperations.getRecords(module, paramInstance);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          if ([204, 304].includes(statusCode)) {
            return {
              data: [],
              info: {
                count: 0,
                more_records: false,
                page: params?.page || 1,
                per_page: params?.per_page || 200
              }
            };
          }
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ResponseWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.RecordResponseWrapper) {
              // Get the array of obtained Record instances
              const records = responseObject.getData();
              
              // Transform SDK records to match our API format
              const transformedRecords = records.map(record => {
                const id = record.getId();
                const properties = record.getKeyValues();
                
                return {
                  id,
                  ...properties
                };
              });
              
              // Get pagination info
              const info = responseObject.getInfo();
              
              return {
                data: transformedRecords,
                info: {
                  count: info.getCount(),
                  more_records: info.getMoreRecords(),
                  page: info.getPage(),
                  per_page: info.getPerPage()
                }
              };
            }
          }
        }
        
        // Return empty result if no data
        return {
          data: [],
          info: {
            count: 0,
            more_records: false,
            page: params?.page || 1,
            per_page: params?.per_page || 200
          }
        };
      } catch (error) {
        this.logger.error(`Failed to get records from ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Get a record from a Zoho module
   * @param module Zoho module
   * @param id Record ID
   * @param params Optional parameters
   * @returns Promise that resolves with the record
   */
  public async getRecord(module: ZohoModule, id: string, params?: any): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Getting record ${id} from ${module}`, { params });

        // Get instance of RecordOperations Class
        const recordOperations = new ZOHOCRMSDK.RecordOperations();
        
        // Get instance of ParameterMap Class
        const paramInstance = new ZOHOCRMSDK.ParameterMap();
        
        // Add parameters if provided
        if (params?.fields) {
          paramInstance.add(ZOHOCRMSDK.RecordOperations.GetRecordParam.FIELDS, params.fields.join(','));
        }
        
        // Call getRecord method
        const response = await recordOperations.getRecord(id, module, paramInstance);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          if ([204, 304].includes(statusCode)) {
            return {
              data: []
            };
          }
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ResponseWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.RecordResponseWrapper) {
              // Get the array of obtained Record instances
              const records = responseObject.getData();
              
              if (records.length > 0) {
                const record = records[0];
                const id = record.getId();
                const properties = record.getKeyValues();
                
                return {
                  data: [{
                    id,
                    ...properties
                  }]
                };
              }
            }
          }
        }
        
        // Return empty result if no data
        return {
          data: []
        };
      } catch (error) {
        this.logger.error(`Failed to get record ${id} from ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Create a record in a Zoho module
   * @param module Zoho module
   * @param data Record data
   * @param params Optional parameters
   * @returns Promise that resolves with the created record
   */
  public async createRecord(module: ZohoModule, data: any, params?: any): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Creating record in ${module}`, { data, params });

        // Get instance of RecordOperations Class
        const recordOperations = new ZOHOCRMSDK.RecordOperations();
        
        // Get instance of ParameterMap Class
        const paramInstance = new ZOHOCRMSDK.ParameterMap();
        
        // Add parameters if provided
        if (params) {
          if (params.trigger) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.CreateRecordsParam.TRIGGER, params.trigger.join(','));
          }
          if (params.process) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.CreateRecordsParam.PROCESS, params.process.join(','));
          }
          if (params.lar_id) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.CreateRecordsParam.LAR_ID, params.lar_id);
          }
          if (params.approve) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.CreateRecordsParam.APPROVE, params.approve);
          }
          if (params.workflow) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.CreateRecordsParam.WORKFLOW, params.workflow);
          }
        }
        
        // Get instance of BodyWrapper Class that will contain the request body
        const request = new ZOHOCRMSDK.BodyWrapper();
        
        // Get instance of Record Class
        const record = new ZOHOCRMSDK.Record();
        
        // Set record properties
        for (const [key, value] of Object.entries(data)) {
          record.addKeyValue(key, value);
        }
        
        // Add Record instance to the list
        request.setData([record]);
        
        // Call createRecords method that takes BodyWrapper instance and module as parameters
        const response = await recordOperations.createRecords(module, request, paramInstance);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ActionWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.ActionWrapper) {
              // Get the array of obtained ActionResponse instances
              const actionResponses = responseObject.getData();
              
              if (actionResponses.length > 0) {
                const actionResponse = actionResponses[0];
                
                // Check if the request is successful
                if (actionResponse instanceof ZOHOCRMSDK.SuccessResponse) {
                  return {
                    data: [{
                      id: actionResponse.getDetails().get('id'),
                      ...data
                    }]
                  };
                } else if (actionResponse instanceof ZOHOCRMSDK.APIException) {
                  throw new Error(actionResponse.getMessage());
                }
              }
            }
          }
        }
        
        // Return empty result if no data
        return {
          data: []
        };
      } catch (error) {
        this.logger.error(`Failed to create record in ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Update a record in a Zoho module
   * @param module Zoho module
   * @param id Record ID
   * @param data Record data
   * @param params Optional parameters
   * @returns Promise that resolves with the updated record
   */
  public async updateRecord(module: ZohoModule, id: string, data: any, params?: any): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Updating record ${id} in ${module}`, { data, params });

        // Get instance of RecordOperations Class
        const recordOperations = new ZOHOCRMSDK.RecordOperations();
        
        // Get instance of ParameterMap Class
        const paramInstance = new ZOHOCRMSDK.ParameterMap();
        
        // Add parameters if provided
        if (params) {
          if (params.trigger) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.UpdateRecordsParam.TRIGGER, params.trigger.join(','));
          }
          if (params.process) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.UpdateRecordsParam.PROCESS, params.process.join(','));
          }
          if (params.approve) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.UpdateRecordsParam.APPROVE, params.approve);
          }
          if (params.workflow) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.UpdateRecordsParam.WORKFLOW, params.workflow);
          }
        }
        
        // Get instance of BodyWrapper Class that will contain the request body
        const request = new ZOHOCRMSDK.BodyWrapper();
        
        // Get instance of Record Class
        const record = new ZOHOCRMSDK.Record();
        
        // Set record ID
        record.setId(id);
        
        // Set record properties
        for (const [key, value] of Object.entries(data)) {
          record.addKeyValue(key, value);
        }
        
        // Add Record instance to the list
        request.setData([record]);
        
        // Call updateRecords method that takes BodyWrapper instance and module as parameters
        const response = await recordOperations.updateRecords(module, request, paramInstance);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ActionWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.ActionWrapper) {
              // Get the array of obtained ActionResponse instances
              const actionResponses = responseObject.getData();
              
              if (actionResponses.length > 0) {
                const actionResponse = actionResponses[0];
                
                // Check if the request is successful
                if (actionResponse instanceof ZOHOCRMSDK.SuccessResponse) {
                  return {
                    data: [{
                      id,
                      ...data
                    }]
                  };
                } else if (actionResponse instanceof ZOHOCRMSDK.APIException) {
                  throw new Error(actionResponse.getMessage());
                }
              }
            }
          }
        }
        
        // Return empty result if no data
        return {
          data: []
        };
      } catch (error) {
        this.logger.error(`Failed to update record ${id} in ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Delete a record from a Zoho module
   * @param module Zoho module
   * @param id Record ID
   * @returns Promise that resolves with the deleted record
   */
  public async deleteRecord(module: ZohoModule, id: string): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Deleting record ${id} from ${module}`);

        // Get instance of RecordOperations Class
        const recordOperations = new ZOHOCRMSDK.RecordOperations();
        
        // Get instance of ParameterMap Class
        const paramInstance = new ZOHOCRMSDK.ParameterMap();
        
        // Call deleteRecord method that takes recordId and module as parameters
        const response = await recordOperations.deleteRecord(id, module, paramInstance);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ActionWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.ActionWrapper) {
              // Get the array of obtained ActionResponse instances
              const actionResponses = responseObject.getData();
              
              if (actionResponses.length > 0) {
                const actionResponse = actionResponses[0];
                
                // Check if the request is successful
                if (actionResponse instanceof ZOHOCRMSDK.SuccessResponse) {
                  return {
                    data: [{
                      id
                    }]
                  };
                } else if (actionResponse instanceof ZOHOCRMSDK.APIException) {
                  throw new Error(actionResponse.getMessage());
                }
              }
            }
          }
        }
        
        // Return empty result if no data
        return {
          data: []
        };
      } catch (error) {
        this.logger.error(`Failed to delete record ${id} from ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Search for records in a Zoho module
   * @param module Zoho module
   * @param criteria Search criteria
   * @param params Optional parameters
   * @returns Promise that resolves with the search results
   */
  public async searchRecords(module: ZohoModule, criteria: any[], params?: any): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Searching records in ${module}`, { criteria, params });

        // Get instance of RecordOperations Class
        const recordOperations = new ZOHOCRMSDK.RecordOperations();
        
        // Get instance of ParameterMap Class
        const paramInstance = new ZOHOCRMSDK.ParameterMap();
        
        // Build criteria string
        let criteriaString = '';
        if (criteria && criteria.length > 0) {
          criteriaString = criteria
            .map((criterion) => {
              let value = criterion.value;
              if (typeof value === 'string') {
                value = `'${value}'`;
              }
              return `(${criterion.field}:${criterion.operator}:${value})`;
            })
            .join('and');
        }
        
        // Add criteria to parameters
        paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.CRITERIA, criteriaString);
        
        // Add other parameters if provided
        if (params) {
          if (params.page) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.PAGE, params.page);
          }
          if (params.per_page) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.PER_PAGE, params.per_page);
          }
          if (params.fields) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.FIELDS, params.fields.join(','));
          }
          if (params.sort_by) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.SORT_BY, params.sort_by);
          }
          if (params.sort_order) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.SORT_ORDER, params.sort_order);
          }
          if (params.custom_view_id) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.CUSTOM_VIEW_ID, params.custom_view_id);
          }
          if (params.territory_id) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.TERRITORY_ID, params.territory_id);
          }
          if (params.include_child) {
            paramInstance.add(ZOHOCRMSDK.RecordOperations.SearchRecordsParam.INCLUDE_CHILD, params.include_child);
          }
        }
        
        // Call searchRecords method that takes module and ParameterMap instance as parameters
        const response = await recordOperations.searchRecords(module, paramInstance);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          if ([204, 304].includes(statusCode)) {
            return {
              data: [],
              info: {
                count: 0,
                more_records: false,
                page: params?.page || 1,
                per_page: params?.per_page || 200
              }
            };
          }
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ResponseWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.RecordResponseWrapper) {
              // Get the array of obtained Record instances
              const records = responseObject.getData();
              
              // Transform SDK records to match our API format
              const transformedRecords = records.map(record => {
                const id = record.getId();
                const properties = record.getKeyValues();
                
                return {
                  id,
                  ...properties
                };
              });
              
              // Get pagination info
              const info = responseObject.getInfo();
              
              return {
                data: transformedRecords,
                info: {
                  count: info.getCount(),
                  more_records: info.getMoreRecords(),
                  page: info.getPage(),
                  per_page: info.getPerPage()
                }
              };
            }
          }
        }
        
        // Return empty result if no data
        return {
          data: [],
          info: {
            count: 0,
            more_records: false,
            page: params?.page || 1,
            per_page: params?.per_page || 200
          }
        };
      } catch (error) {
        this.logger.error(`Failed to search records in ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Get module metadata
   * @param module Zoho module
   * @returns Promise that resolves with the module metadata
   */
  public async getModuleMetadata(module: ZohoModule): Promise<any> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug(`Getting module metadata for ${module}`);

        // Get instance of ModulesOperations Class
        const modulesOperations = new ZOHOCRMSDK.ModulesOperations();
        
        // Call getModule method that takes module as parameter
        const response = await modulesOperations.getModule(module);
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ResponseWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.ModulesOperations.ResponseWrapper) {
              // Get the array of obtained Module instances
              const modules = responseObject.getModules();
              
              if (modules.length > 0) {
                const moduleMetadata = modules[0];
                
                // Transform SDK module metadata to match our API format
                return {
                  module_name: moduleMetadata.getAPIName(),
                  id: moduleMetadata.getId(),
                  singular_label: moduleMetadata.getSingularLabel(),
                  plural_label: moduleMetadata.getPluralLabel(),
                  fields: moduleMetadata.getFields().map(field => ({
                    api_name: field.getAPIName(),
                    id: field.getId(),
                    field_label: field.getFieldLabel(),
                    data_type: field.getDataType(),
                    length: field.getLength(),
                    required: field.getMandatory(),
                    read_only: field.getReadOnly()
                  }))
                };
              }
            }
          }
        }
        
        // Return empty result if no data
        return null;
      } catch (error) {
        this.logger.error(`Failed to get module metadata for ${module}`, { error });
        throw error;
      }
    });
  }

  /**
   * Get all modules metadata
   * @returns Promise that resolves with all modules metadata
   */
  public async getAllModulesMetadata(): Promise<any[]> {
    await this.ensureInitialized();

    return performanceOptimizer.queueRequest(async () => {
      try {
        this.logger.debug('Getting all modules metadata');

        // Get instance of ModulesOperations Class
        const modulesOperations = new ZOHOCRMSDK.ModulesOperations();
        
        // Call getModules method
        const response = await modulesOperations.getModules();
        
        // Process the response
        if (response !== null) {
          // Get the status code from response
          const statusCode = response.getStatusCode();
          
          // Get object from response
          const responseObject = response.getObject();
          
          if (responseObject !== null) {
            // Check if expected ResponseWrapper instance is received
            if (responseObject instanceof ZOHOCRMSDK.ModulesOperations.ResponseWrapper) {
              // Get the array of obtained Module instances
              const modules = responseObject.getModules();
              
              // Transform SDK modules metadata to match our API format
              return modules.map(moduleMetadata => ({
                module_name: moduleMetadata.getAPIName(),
                id: moduleMetadata.getId(),
                singular_label: moduleMetadata.getSingularLabel(),
                plural_label: moduleMetadata.getPluralLabel(),
                fields: moduleMetadata.getFields().map(field => ({
                  api_name: field.getAPIName(),
                  id: field.getId(),
                  field_label: field.getFieldLabel(),
                  data_type: field.getDataType(),
                  length: field.getLength(),
                  required: field.getMandatory(),
                  read_only: field.getReadOnly()
                }))
              }));
            }
          }
        }
        
        // Return empty result if no data
        return [];
      } catch (error) {
        this.logger.error('Failed to get all modules metadata', { error });
        throw error;
      }
    });
  }

  /**
   * Ensure the SDK is initialized
   * @returns Promise that resolves when the SDK is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
