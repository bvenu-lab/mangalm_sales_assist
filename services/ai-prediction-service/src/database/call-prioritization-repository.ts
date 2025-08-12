import { db } from './db-connection';
import { logger } from '../utils/logger';

export interface CallPrioritization {
  id: string;
  storeId: string;
  priorityScore: number;
  priorityReason: string;
  lastCallDate?: Date;
  nextCallDate?: Date;
  status: string;
  notes?: string;
}

export class CallPrioritizationRepository {
  async getAll(params?: {
    storeId?: string;
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{ data: any[], total: number }> {
    try {
      let query = `
        SELECT 
          cp.*,
          s.name as store_name,
          s.city,
          s.state,
          s.phone,
          s.primary_contact_name as contact_person
        FROM call_prioritization cp
        JOIN stores s ON cp.store_id = s.id
        WHERE 1=1
      `;
      
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      if (params?.storeId) {
        query += ` AND cp.store_id = $${paramIndex}`;
        queryParams.push(params.storeId);
        paramIndex++;
      }
      
      if (params?.status) {
        query += ` AND cp.status = $${paramIndex}`;
        queryParams.push(params.status);
        paramIndex++;
      }
      
      query += ' ORDER BY cp.priority_score DESC';
      
      if (params?.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(params.limit);
        paramIndex++;
      }
      
      if (params?.offset) {
        query += ` OFFSET $${paramIndex}`;
        queryParams.push(params.offset);
        paramIndex++;
      }
      
      const result = await db.query(query, queryParams);
      
      // Map the results to include all needed fields
      const data = result.rows.map(row => ({
        id: row.id,
        storeId: row.store_id,
        storeName: row.store_name,
        city: row.city,
        state: row.state,
        phone: row.phone,
        contactPerson: row.contact_person,
        priorityScore: parseFloat(row.priority_score),
        priorityReason: row.priority_reason,
        lastCallDate: row.last_call_date,
        nextCallDate: row.next_call_date,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM call_prioritization cp
        JOIN stores s ON cp.store_id = s.id
        WHERE 1=1
      `;
      
      const countParams: any[] = [];
      let countParamIndex = 1;
      
      if (params?.storeId) {
        countQuery += ` AND cp.store_id = $${countParamIndex}`;
        countParams.push(params.storeId);
        countParamIndex++;
      }
      
      if (params?.status) {
        countQuery += ` AND cp.status = $${countParamIndex}`;
        countParams.push(params.status);
        countParamIndex++;
      }
      
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);
      
      logger.info(`Retrieved ${data.length} call prioritizations`);
      
      return { data, total };
    } catch (error) {
      logger.error('Error fetching call prioritizations:', error);
      throw error;
    }
  }
  
  async getByStoreId(storeId: string): Promise<CallPrioritization | null> {
    try {
      const query = `
        SELECT 
          cp.*,
          s.name as store_name,
          s.city,
          s.state,
          s.phone,
          s.primary_contact_name as contact_person
        FROM call_prioritization cp
        JOIN stores s ON cp.store_id = s.id
        WHERE cp.store_id = $1
        ORDER BY cp.created_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(query, [storeId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        storeId: row.store_id,
        priorityScore: parseFloat(row.priority_score),
        priorityReason: row.priority_reason,
        lastCallDate: row.last_call_date,
        nextCallDate: row.next_call_date,
        status: row.status,
        notes: row.notes
      };
    } catch (error) {
      logger.error(`Error fetching call prioritization for store ${storeId}:`, error);
      throw error;
    }
  }
  
  async updateStatus(id: string, status: string): Promise<boolean> {
    try {
      const query = `
        UPDATE call_prioritization 
        SET status = $2, updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await db.query(query, [id, status]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error updating call prioritization ${id}:`, error);
      throw error;
    }
  }
}

export const callPrioritizationRepository = new CallPrioritizationRepository();