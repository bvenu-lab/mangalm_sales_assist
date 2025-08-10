import { logger } from '../../utils/logger';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  vector?: number[];
  chunkId?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  relevanceScore: number;
}

export class SimpleVectorDB {
  private documents: Map<string, VectorDocument> = new Map();
  private index: Map<string, Set<string>> = new Map(); // Simple keyword index

  constructor() {
    logger.info('Simple Vector Database initialized');
    this.initializeWithSampleData();
  }

  // Initialize with sample code chunks and business data
  private initializeWithSampleData(): void {
    const sampleDocuments: VectorDocument[] = [
      {
        id: 'chunk_auth_login',
        content: 'JWT authentication login endpoint with password hashing and token generation',
        metadata: {
          type: 'code_chunk',
          component: 'authentication',
          language: 'typescript',
          functionality: 'login',
          security_level: 'high'
        },
        chunkId: 'auth_001',
        filePath: '/src/auth/login.ts',
        startLine: 1,
        endLine: 50
      },
      {
        id: 'chunk_auth_jwt',
        content: 'JWT token validation middleware for protecting API routes',
        metadata: {
          type: 'code_chunk',
          component: 'authentication',
          language: 'typescript',
          functionality: 'middleware',
          security_level: 'high'
        },
        chunkId: 'auth_002',
        filePath: '/src/middleware/auth.ts',
        startLine: 1,
        endLine: 30
      },
      {
        id: 'chunk_api_gateway',
        content: 'API Gateway routing and load balancing with rate limiting',
        metadata: {
          type: 'code_chunk',
          component: 'api_gateway',
          language: 'typescript',
          functionality: 'routing',
          performance: 'high'
        },
        chunkId: 'gateway_001',
        filePath: '/src/gateway/routes.ts',
        startLine: 1,
        endLine: 100
      },
      {
        id: 'chunk_database_orm',
        content: 'Database ORM models for user management and role-based access control',
        metadata: {
          type: 'code_chunk',
          component: 'database',
          language: 'typescript',
          functionality: 'orm_models',
          data_layer: 'persistence'
        },
        chunkId: 'db_001',
        filePath: '/src/models/user.ts',
        startLine: 1,
        endLine: 80
      },
      {
        id: 'req_authentication_system',
        content: 'Enterprise authentication system with JWT, OAuth2, 2FA, and role-based permissions',
        metadata: {
          type: 'requirement',
          priority: 'high',
          business_value: 'security',
          complexity: 'high',
          estimated_hours: 40
        }
      },
      {
        id: 'req_api_performance',
        content: 'API performance optimization with caching, compression, and CDN integration',
        metadata: {
          type: 'requirement',
          priority: 'medium',
          business_value: 'performance',
          complexity: 'medium',
          estimated_hours: 24
        }
      },
      {
        id: 'req_real_time_features',
        content: 'Real-time notifications and live updates using WebSocket connections',
        metadata: {
          type: 'requirement',
          priority: 'medium',
          business_value: 'user_experience',
          complexity: 'medium',
          estimated_hours: 32
        }
      },
      {
        id: 'business_rule_sales_predictions',
        content: 'Sales prediction algorithms must achieve 85% accuracy with confidence intervals',
        metadata: {
          type: 'business_rule',
          domain: 'sales',
          criticality: 'high',
          measurable: true,
          target_metric: '85% accuracy'
        }
      },
      {
        id: 'business_rule_data_retention',
        content: 'Customer data retention policy compliance with GDPR and regional regulations',
        metadata: {
          type: 'business_rule',
          domain: 'compliance',
          criticality: 'critical',
          regulatory: true,
          frameworks: ['GDPR', 'CCPA']
        }
      }
    ];

    sampleDocuments.forEach(doc => {
      this.addDocument(doc);
    });

    logger.info(`Vector DB initialized with ${sampleDocuments.length} sample documents`);
  }

  // Add document to the vector database
  public addDocument(document: VectorDocument): void {
    // Generate simple text-based vector (word frequency)
    document.vector = this.generateSimpleVector(document.content);
    
    this.documents.set(document.id, document);
    
    // Update keyword index
    this.updateKeywordIndex(document);
    
    logger.debug('Document added to vector DB', {
      id: document.id,
      contentLength: document.content.length,
      metadata: document.metadata
    });
  }

  // Generate simple vector based on word frequency
  private generateSimpleVector(content: string): number[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Create frequency map
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Convert to fixed-size vector (top 50 dimensions for simplicity)
    const dimensions = 50;
    const vector = new Array(dimensions).fill(0);
    
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, dimensions);

    sortedWords.forEach(([word, freq], index) => {
      vector[index] = freq / words.length; // Normalize frequency
    });

    return vector;
  }

  // Update keyword index for fast text search
  private updateKeywordIndex(document: VectorDocument): void {
    const words = document.content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    words.forEach(word => {
      if (!this.index.has(word)) {
        this.index.set(word, new Set());
      }
      this.index.get(word)!.add(document.id);
    });
  }

  // Semantic search using vector similarity
  public semanticSearch(query: string, limit: number = 10): SearchResult[] {
    const queryVector = this.generateSimpleVector(query);
    const results: SearchResult[] = [];

    this.documents.forEach((doc, id) => {
      if (doc.vector) {
        const similarity = this.cosineSimilarity(queryVector, doc.vector);
        const relevanceScore = this.calculateRelevanceScore(query, doc, similarity);
        
        results.push({
          document: doc,
          similarity,
          relevanceScore
        });
      }
    });

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Calculate relevance score combining similarity and metadata
  private calculateRelevanceScore(query: string, doc: VectorDocument, similarity: number): number {
    let score = similarity * 0.7; // Base similarity weight

    const queryLower = query.toLowerCase();
    
    // Boost score for metadata matches
    if (doc.metadata.type && queryLower.includes(doc.metadata.type)) {
      score += 0.1;
    }
    
    if (doc.metadata.component && queryLower.includes(doc.metadata.component)) {
      score += 0.1;
    }
    
    if (doc.metadata.functionality && queryLower.includes(doc.metadata.functionality)) {
      score += 0.1;
    }

    // Boost for high priority/security items
    if (doc.metadata.priority === 'high' || doc.metadata.security_level === 'high') {
      score += 0.05;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  // Keyword-based search for fast retrieval
  public keywordSearch(query: string, limit: number = 10): SearchResult[] {
    const words = query.toLowerCase().split(/\s+/);
    const candidateIds = new Set<string>();

    words.forEach(word => {
      const docIds = this.index.get(word);
      if (docIds) {
        docIds.forEach(id => candidateIds.add(id));
      }
    });

    const results: SearchResult[] = Array.from(candidateIds)
      .map(id => {
        const doc = this.documents.get(id)!;
        const similarity = this.calculateKeywordSimilarity(query, doc.content);
        
        return {
          document: doc,
          similarity,
          relevanceScore: similarity
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return results;
  }

  private calculateKeywordSimilarity(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...queryWords].filter(word => contentWords.has(word)));
    const union = new Set([...queryWords, ...contentWords]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  // Filter documents by metadata
  public filterByMetadata(filters: Record<string, any>, limit: number = 10): VectorDocument[] {
    const results: VectorDocument[] = [];

    this.documents.forEach(doc => {
      const matches = Object.entries(filters).every(([key, value]) => {
        return doc.metadata[key] === value;
      });

      if (matches) {
        results.push(doc);
      }
    });

    return results.slice(0, limit);
  }

  // Get related documents based on metadata similarity
  public getRelatedDocuments(documentId: string, limit: number = 5): VectorDocument[] {
    const sourceDoc = this.documents.get(documentId);
    if (!sourceDoc) return [];

    const related: Array<{ doc: VectorDocument; score: number }> = [];

    this.documents.forEach(doc => {
      if (doc.id !== documentId) {
        const score = this.calculateMetadataSimilarity(sourceDoc.metadata, doc.metadata);
        if (score > 0) {
          related.push({ doc, score });
        }
      }
    });

    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.doc);
  }

  private calculateMetadataSimilarity(metaA: Record<string, any>, metaB: Record<string, any>): number {
    const keysA = Object.keys(metaA);
    const keysB = Object.keys(metaB);
    const commonKeys = keysA.filter(key => keysB.includes(key));
    
    if (commonKeys.length === 0) return 0;
    
    const matchingValues = commonKeys.filter(key => metaA[key] === metaB[key]).length;
    return matchingValues / commonKeys.length;
  }

  // Get database statistics
  public getStats() {
    const typeCount = new Map<string, number>();
    const componentCount = new Map<string, number>();
    
    this.documents.forEach(doc => {
      const type = doc.metadata.type || 'unknown';
      const component = doc.metadata.component || 'unknown';
      
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
      componentCount.set(component, (componentCount.get(component) || 0) + 1);
    });

    return {
      totalDocuments: this.documents.size,
      indexSize: this.index.size,
      documentTypes: Object.fromEntries(typeCount),
      components: Object.fromEntries(componentCount)
    };
  }

  // Clear all documents
  public clear(): void {
    this.documents.clear();
    this.index.clear();
    logger.info('Vector DB cleared');
  }
}