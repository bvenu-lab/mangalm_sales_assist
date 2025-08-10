import { Router, Request, Response } from 'express';
import { SimpleVectorDB, VectorDocument } from '../services/vector/simple-vector-db';
import { logger } from '../utils/logger';

const router = Router();
const vectorDB = new SimpleVectorDB();

// Semantic search endpoint
router.get('/search/semantic', (req: Request, res: Response) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const results = vectorDB.semanticSearch(query, parseInt(limit as string));
    
    logger.info('Semantic search performed', {
      query,
      resultsCount: results.length,
      topScore: results[0]?.relevanceScore || 0
    });

    res.json({
      success: true,
      query,
      results: results.map(result => ({
        id: result.document.id,
        content: result.document.content.substring(0, 200) + '...', // Truncate for display
        metadata: result.document.metadata,
        similarity: result.similarity,
        relevanceScore: result.relevanceScore,
        chunkInfo: result.document.chunkId ? {
          chunkId: result.document.chunkId,
          filePath: result.document.filePath,
          lines: `${result.document.startLine}-${result.document.endLine}`
        } : undefined
      })),
      totalResults: results.length
    });
  } catch (error: any) {
    logger.error('Error in semantic search', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to perform semantic search'
    });
  }
});

// Keyword search endpoint
router.get('/search/keywords', (req: Request, res: Response) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const results = vectorDB.keywordSearch(query, parseInt(limit as string));
    
    logger.info('Keyword search performed', {
      query,
      resultsCount: results.length
    });

    res.json({
      success: true,
      query,
      results: results.map(result => ({
        id: result.document.id,
        content: result.document.content.substring(0, 200) + '...',
        metadata: result.document.metadata,
        similarity: result.similarity,
        chunkInfo: result.document.chunkId ? {
          chunkId: result.document.chunkId,
          filePath: result.document.filePath,
          lines: `${result.document.startLine}-${result.document.endLine}`
        } : undefined
      })),
      totalResults: results.length
    });
  } catch (error: any) {
    logger.error('Error in keyword search', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to perform keyword search'
    });
  }
});

// Filter by metadata endpoint
router.get('/filter', (req: Request, res: Response) => {
  try {
    const { type, component, priority, limit = 10 } = req.query;
    
    const filters: Record<string, any> = {};
    if (type) filters.type = type;
    if (component) filters.component = component;
    if (priority) filters.priority = priority;
    
    if (Object.keys(filters).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one filter parameter is required (type, component, priority)'
      });
    }

    const results = vectorDB.filterByMetadata(filters, parseInt(limit as string));
    
    logger.info('Metadata filter applied', {
      filters,
      resultsCount: results.length
    });

    res.json({
      success: true,
      filters,
      results: results.map(doc => ({
        id: doc.id,
        content: doc.content.substring(0, 200) + '...',
        metadata: doc.metadata,
        chunkInfo: doc.chunkId ? {
          chunkId: doc.chunkId,
          filePath: doc.filePath,
          lines: `${doc.startLine}-${doc.endLine}`
        } : undefined
      })),
      totalResults: results.length
    });
  } catch (error: any) {
    logger.error('Error in metadata filtering', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to filter by metadata'
    });
  }
});

// Get related documents
router.get('/related/:documentId', (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { limit = 5 } = req.query;
    
    const results = vectorDB.getRelatedDocuments(documentId, parseInt(limit as string));
    
    logger.info('Related documents retrieved', {
      documentId,
      resultsCount: results.length
    });

    res.json({
      success: true,
      sourceDocumentId: documentId,
      relatedDocuments: results.map(doc => ({
        id: doc.id,
        content: doc.content.substring(0, 200) + '...',
        metadata: doc.metadata,
        chunkInfo: doc.chunkId ? {
          chunkId: doc.chunkId,
          filePath: doc.filePath,
          lines: `${doc.startLine}-${doc.endLine}`
        } : undefined
      })),
      totalResults: results.length
    });
  } catch (error: any) {
    logger.error('Error retrieving related documents', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve related documents'
    });
  }
});

// Add new document to vector DB
router.post('/documents', (req: Request, res: Response) => {
  try {
    const document: VectorDocument = req.body;
    
    if (!document.id || !document.content) {
      return res.status(400).json({
        success: false,
        error: 'Document must have id and content fields'
      });
    }

    vectorDB.addDocument(document);
    
    logger.info('Document added to vector DB', {
      id: document.id,
      contentLength: document.content.length,
      type: document.metadata?.type
    });

    res.json({
      success: true,
      message: 'Document added successfully',
      documentId: document.id
    });
  } catch (error: any) {
    logger.error('Error adding document to vector DB', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add document'
    });
  }
});

// Get vector database statistics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = vectorDB.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    logger.error('Error retrieving vector DB stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stats'
    });
  }
});

// Context retrieval for AI agents (Enterprise feature)
router.post('/context/retrieve', (req: Request, res: Response) => {
  try {
    const { task, component, maxChunks = 5 } = req.body;
    
    if (!task) {
      return res.status(400).json({
        success: false,
        error: 'Task description is required'
      });
    }

    // Semantic search for relevant code chunks
    const semanticResults = vectorDB.semanticSearch(task, maxChunks);
    
    // Filter by component if specified
    let filteredResults = semanticResults;
    if (component) {
      const componentDocs = vectorDB.filterByMetadata({ component }, 10);
      const componentIds = new Set(componentDocs.map(doc => doc.id));
      filteredResults = semanticResults.filter(result => 
        componentIds.has(result.document.id)
      );
    }

    // Get related documents for additional context
    const relatedContext = [];
    for (const result of filteredResults.slice(0, 2)) { // Get related for top 2 results
      const related = vectorDB.getRelatedDocuments(result.document.id, 2);
      relatedContext.push(...related);
    }

    const contextPackage = {
      primaryChunks: filteredResults.map(result => ({
        id: result.document.id,
        content: result.document.content,
        metadata: result.document.metadata,
        relevanceScore: result.relevanceScore,
        chunkInfo: result.document.chunkId ? {
          chunkId: result.document.chunkId,
          filePath: result.document.filePath,
          lines: `${result.document.startLine}-${result.document.endLine}`
        } : undefined
      })),
      relatedContext: relatedContext.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        chunkInfo: doc.chunkId ? {
          chunkId: doc.chunkId,
          filePath: doc.filePath,
          lines: `${doc.startLine}-${doc.endLine}`
        } : undefined
      })),
      task,
      component,
      retrievedAt: new Date().toISOString()
    };

    logger.info('Context package retrieved for agent', {
      task: task.substring(0, 50) + '...',
      component,
      primaryChunks: contextPackage.primaryChunks.length,
      relatedContext: contextPackage.relatedContext.length
    });

    res.json({
      success: true,
      contextPackage
    });
  } catch (error: any) {
    logger.error('Error retrieving context package', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve context package'
    });
  }
});

export default router;