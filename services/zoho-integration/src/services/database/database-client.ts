import axios from 'axios';

/**
 * Interface for the database client configuration
 */
export interface DatabaseClientConfig {
  databaseOrchestratorUrl: string;
  apiKey?: string;
}

/**
 * Database client for interacting with the database orchestrator microservice
 */
export class DatabaseClient {
  private databaseOrchestratorUrl: string;
  private apiKey?: string;

  /**
   * Constructor
   * @param config Database client configuration
   */
  constructor(config: DatabaseClientConfig) {
    this.databaseOrchestratorUrl = config.databaseOrchestratorUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Execute a query
   * @param sql SQL query
   * @param params Query parameters
   * @returns Query result
   */
  public async query(sql: string, params: any[] = []): Promise<any> {
    try {
      const response = await axios.post(
        `${this.databaseOrchestratorUrl}/api/database/query`,
        {
          sql,
          params
        },
        {
          headers: this.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Insert a record
   * @param table Table name
   * @param data Record data
   * @returns Insert result
   */
  public async insert(table: string, data: any): Promise<any> {
    try {
      const response = await axios.post(
        `${this.databaseOrchestratorUrl}/api/database/insert`,
        {
          table,
          data
        },
        {
          headers: this.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Update a record
   * @param table Table name
   * @param id Record ID
   * @param data Record data
   * @returns Update result
   */
  public async update(table: string, id: string, data: any): Promise<any> {
    try {
      const response = await axios.put(
        `${this.databaseOrchestratorUrl}/api/database/update`,
        {
          table,
          id,
          data
        },
        {
          headers: this.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Delete a record
   * @param table Table name
   * @param id Record ID
   * @returns Delete result
   */
  public async delete(table: string, id: string): Promise<any> {
    try {
      const response = await axios.delete(
        `${this.databaseOrchestratorUrl}/api/database/delete`,
        {
          data: {
            table,
            id
          },
          headers: this.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   * @param callback Transaction callback
   * @returns Transaction result
   */
  public async transaction<T>(callback: (trx: DatabaseClient) => Promise<T>): Promise<T> {
    try {
      // Start transaction
      const startResponse = await axios.post(
        `${this.databaseOrchestratorUrl}/api/database/transaction/start`,
        {},
        {
          headers: this.getHeaders()
        }
      );
      const transactionId = startResponse.data.transactionId;

      // Create transaction client
      const transactionClient = new DatabaseClient({
        databaseOrchestratorUrl: this.databaseOrchestratorUrl,
        apiKey: this.apiKey
      });

      // Set transaction ID in headers
      const originalGetHeaders = transactionClient.getHeaders.bind(transactionClient);
      transactionClient.getHeaders = () => {
        const headers = originalGetHeaders();
        return {
          ...headers,
          'X-Transaction-ID': transactionId
        };
      };

      try {
        // Execute transaction callback
        const result = await callback(transactionClient);

        // Commit transaction
        await axios.post(
          `${this.databaseOrchestratorUrl}/api/database/transaction/commit`,
          {
            transactionId
          },
          {
            headers: this.getHeaders()
          }
        );

        return result;
      } catch (error) {
        // Rollback transaction
        await axios.post(
          `${this.databaseOrchestratorUrl}/api/database/transaction/rollback`,
          {
            transactionId
          },
          {
            headers: this.getHeaders()
          }
        );

        throw error;
      }
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Get request headers
   * @returns Request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Handle error
   * @param error Error
   */
  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (response) {
        const { status, data } = response;
        console.error(`Database client error: ${status} - ${JSON.stringify(data)}`);
      } else {
        console.error(`Database client error: ${error.message}`);
      }
    } else {
      console.error(`Database client error: ${error}`);
    }
  }
}
