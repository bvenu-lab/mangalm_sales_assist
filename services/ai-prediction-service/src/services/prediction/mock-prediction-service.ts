// Mock prediction service for local testing without TensorFlow
export class MockPredictionService {
  async predictOrder(storeId: string, date?: string, includeItems?: boolean) {
    // Generate mock prediction
    const prediction = {
      storeId,
      predictedDate: date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      predictedAmount: Math.random() * 1000 + 500,
      confidence: 0.75 + Math.random() * 0.2,
      items: includeItems ? [
        { productId: 'PROD001', name: 'Product 1', quantity: Math.floor(Math.random() * 10) + 1 },
        { productId: 'PROD002', name: 'Product 2', quantity: Math.floor(Math.random() * 10) + 1 }
      ] : []
    };
    
    return prediction;
  }

  async predictBatchOrders(storeIds: string[], date?: string, includeItems?: boolean) {
    return Promise.all(storeIds.map(id => this.predictOrder(id, date, includeItems)));
  }

  async getPredictionHistory(storeId: string, limit?: number, dateRange?: any) {
    // Generate mock history
    const history = [];
    const count = limit || 10;
    for (let i = 0; i < count; i++) {
      history.push({
        id: `hist_${i}`,
        storeId,
        predictedDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        predictedAmount: Math.random() * 1000 + 500,
        actualAmount: Math.random() * 1000 + 450,
        accuracy: 0.75 + Math.random() * 0.2
      });
    }
    return history;
  }

  async getAccuracyMetrics(storeId?: string, dateRange?: any) {
    return {
      overall: {
        accuracy: 0.78 + Math.random() * 0.1,
        precision: 0.82 + Math.random() * 0.1,
        recall: 0.75 + Math.random() * 0.1,
        f1Score: 0.78 + Math.random() * 0.1
      },
      byCategory: {
        'High Value': 0.85,
        'Medium Value': 0.78,
        'Low Value': 0.72
      },
      byTimeframe: {
        '7 days': 0.88,
        '14 days': 0.82,
        '30 days': 0.75
      }
    };
  }

  async submitFeedback(predictionId: string, feedback: any, userId?: string) {
    return {
      success: true,
      message: 'Feedback received',
      predictionId,
      feedback,
      userId
    };
  }
}

export const PredictionService = MockPredictionService;