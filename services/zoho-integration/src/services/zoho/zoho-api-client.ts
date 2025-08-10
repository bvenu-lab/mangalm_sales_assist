import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  ZohoApiConfig,
  ZohoApiResponse,
  ZohoApiErrorResponse,
  ZohoModule,
  ZohoRecord,
  ZohoGetRecordsParams,
  ZohoGetRecordParams,
  ZohoCreateRecordParams,
  ZohoUpdateRecordParams,
  ZohoDeleteRecordParams,
  ZohoSearchParams,
  ZohoModuleMetadata
} from './zoho-types';
import { Logger } from '../../utils/logger';

/**
 * Zoho API client for interacting with Zoho CRM API
 */
export class ZohoApiClient {
  private config: ZohoApiConfig;
  private accessToken: string | null = null;
  private accessTokenExpiry: number = 0;
  private refreshTokenInterval: NodeJS.Timeout | null = null;
  private axiosInstance: AxiosInstance;
  private logger: Logger;

  /**
   * Constructor
   * @param config Zoho API configuration
   * @param logger Logger instance
   */
  constructor(config: ZohoApiConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.axiosInstance = axios.create({
      baseURL: `https://${config.apiDomain}/crm/v2`,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to add access token to requests
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Check if access token is expired
        if (!this.accessToken || Date.now() >= this.accessTokenExpiry) {
          await this.refreshAccessToken();
        }

        // Add access token to request headers
        if (this.accessToken) {
          config.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle errors
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;

          // Handle authentication errors
          if (status === 401) {
            this.logger.error('Zoho API authentication error', { status, data });
            this.refreshAccessToken();
          }

          // Handle rate limiting
          if (status === 429) {
            this.logger.warn('Zoho API rate limit exceeded', { status, data });
            // Retry after a delay
            const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(this.axiosInstance(error.config));
              }, retryAfter * 1000);
            });
          }

          // Handle other errors
          this.logger.error('Zoho API error', { status, data });
        } else {
          this.logger.error('Zoho API request error', { error: error.message });
        }

        return Promise.reject(error);
      }
    );

    // Start token refresh interval
    this.startTokenRefreshInterval();
  }

  /**
   * Start token refresh interval
   */
  private startTokenRefreshInterval(): void {
    const intervalMs = this.config.tokenRefreshIntervalMs || 3540000; // Default to 59 minutes (token expires in 60 minutes)
    this.refreshTokenInterval = setInterval(() => {
      this.refreshAccessToken().catch((error) => {
        this.logger.error('Failed to refresh access token', { error: error.message });
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
   * Refresh access token
   * @returns Promise that resolves when the access token is refreshed
   */
  public async refreshAccessToken(): Promise<void> {
    try {
      this.logger.info('Refreshing Zoho access token');

      const response = await axios.post(
        'https://accounts.zoho.com/oauth/v2/token',
        null,
        {
          params: {
            refresh_token: this.config.refreshToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'refresh_token'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.accessTokenExpiry = Date.now() + (response.data.expires_in * 1000);

      this.logger.info('Zoho access token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh Zoho access token', { error });
      throw error;
    }
  }

  /**
   * Get records from a Zoho module
   * @param params Get records parameters
   * @returns Promise that resolves with the records
   */
  public async getRecords<T = ZohoRecord>(
    module: ZohoModule,
    params?: Omit<ZohoGetRecordsParams, 'module'>
  ): Promise<ZohoApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<ZohoApiResponse<T>>(
        `/${module}`,
        {
          params: {
            page: params?.page || 1,
            per_page: params?.per_page || 200,
            fields: params?.fields?.join(','),
            sort_by: params?.sort_by,
            sort_order: params?.sort_order,
            converted: params?.converted,
            approved: params?.approved,
            include_child: params?.include_child,
            territory_id: params?.territory_id,
            custom_view_id: params?.custom_view_id
          }
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get records from ${module}`, { error });
      throw error;
    }
  }

  /**
   * Get a record from a Zoho module
   * @param params Get record parameters
   * @returns Promise that resolves with the record
   */
  public async getRecord<T = ZohoRecord>(
    params: ZohoGetRecordParams
  ): Promise<ZohoApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<ZohoApiResponse<T>>(
        `/${params.module}/${params.id}`,
        {
          params: {
            fields: params.fields?.join(',')
          }
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get record ${params.id} from ${params.module}`, { error });
      throw error;
    }
  }

  /**
   * Create a record in a Zoho module
   * @param params Create record parameters
   * @returns Promise that resolves with the created record
   */
  public async createRecord<T = ZohoRecord>(
    params: ZohoCreateRecordParams
  ): Promise<ZohoApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<ZohoApiResponse<T>>(
        `/${params.module}`,
        {
          data: [params.data]
        },
        {
          params: {
            trigger: params.trigger?.join(','),
            process: params.process?.join(','),
            lar_id: params.lar_id,
            approve: params.approve,
            workflow: params.workflow
          }
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create record in ${params.module}`, { error });
      throw error;
    }
  }

  /**
   * Update a record in a Zoho module
   * @param params Update record parameters
   * @returns Promise that resolves with the updated record
   */
  public async updateRecord<T = ZohoRecord>(
    params: ZohoUpdateRecordParams
  ): Promise<ZohoApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<ZohoApiResponse<T>>(
        `/${params.module}/${params.id}`,
        {
          data: [params.data]
        },
        {
          params: {
            trigger: params.trigger?.join(','),
            process: params.process?.join(','),
            approve: params.approve,
            workflow: params.workflow
          }
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update record ${params.id} in ${params.module}`, { error });
      throw error;
    }
  }

  /**
   * Delete a record from a Zoho module
   * @param params Delete record parameters
   * @returns Promise that resolves with the deleted record
   */
  public async deleteRecord<T = ZohoRecord>(
    params: ZohoDeleteRecordParams
  ): Promise<ZohoApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<ZohoApiResponse<T>>(
        `/${params.module}/${params.id}`
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to delete record ${params.id} from ${params.module}`, { error });
      throw error;
    }
  }

  /**
   * Search for records in a Zoho module
   * @param params Search parameters
   * @returns Promise that resolves with the search results
   */
  public async searchRecords<T = ZohoRecord>(
    params: ZohoSearchParams
  ): Promise<ZohoApiResponse<T>> {
    try {
      // Build criteria string
      let criteriaString = '';
      if (params.criteria && params.criteria.length > 0) {
        criteriaString = params.criteria
          .map((criteria) => {
            let value = criteria.value;
            if (typeof value === 'string') {
              value = `'${value}'`;
            }
            return `(${criteria.field}:${criteria.operator}:${value})`;
          })
          .join('and');
      }

      const response = await this.axiosInstance.get<ZohoApiResponse<T>>(
        `/${params.module}/search`,
        {
          params: {
            criteria: criteriaString,
            page: params.page || 1,
            per_page: params.per_page || 200,
            fields: params.fields?.join(','),
            sort_by: params.sort_by,
            sort_order: params.sort_order,
            custom_view_id: params.custom_view_id,
            territory_id: params.territory_id,
            include_child: params.include_child
          }
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search records in ${params.module}`, { error });
      throw error;
    }
  }

  /**
   * Get module metadata
   * @param module Zoho module
   * @returns Promise that resolves with the module metadata
   */
  public async getModuleMetadata(module: ZohoModule): Promise<ZohoModuleMetadata> {
    try {
      const response = await this.axiosInstance.get<{ modules: ZohoModuleMetadata[] }>(
        '/settings/modules',
        {
          params: {
            module: module
          }
        }
      );

      const moduleMetadata = response.data.modules.find((m) => m.module_name === module);
      if (!moduleMetadata) {
        throw new Error(`Module metadata not found for ${module}`);
      }

      return moduleMetadata;
    } catch (error) {
      this.logger.error(`Failed to get module metadata for ${module}`, { error });
      throw error;
    }
  }

  /**
   * Get all modules metadata
   * @returns Promise that resolves with all modules metadata
   */
  public async getAllModulesMetadata(): Promise<ZohoModuleMetadata[]> {
    try {
      const response = await this.axiosInstance.get<{ modules: ZohoModuleMetadata[] }>(
        '/settings/modules'
      );

      return response.data.modules;
    } catch (error) {
      this.logger.error('Failed to get all modules metadata', { error });
      throw error;
    }
  }
}
