/**
 * AutoML Service for automatic model selection and optimization
 * Enterprise-grade automated machine learning pipeline
 */

import { EnterpriseMLEngine, ModelType, Algorithm } from './enterprise-ml-engine';
import { logger } from '../utils/logger';

export interface AutoMLConfig {
  targetColumn: string;
  timeLimit?: number; // in minutes
  algorithms?: string[];
  optimizationMetric?: 'accuracy' | 'precision' | 'recall' | 'f1' | 'rmse' | 'mae';
  crossValidationFolds?: number;
  maxTrials?: number;
  earlyStoppingRounds?: number;
}

export interface AutoMLResult {
  bestModel: {
    algorithm: string;
    parameters: Record<string, any>;
    score: number;
    crossValidationScore: number;
  };
  allTrials: Array<{
    algorithm: string;
    parameters: Record<string, any>;
    score: number;
    trainingTime: number;
  }>;
  featureImportance: Record<string, number>;
  modelPath: string;
  executionTime: number;
}

export class AutoMLService {
  private mlEngine: EnterpriseMLEngine;

  constructor(mlEngine: EnterpriseMLEngine) {
    this.mlEngine = mlEngine;
  }

  /**
   * Run AutoML pipeline to find best model
   */
  public async runAutoML(
    data: any[],
    config: AutoMLConfig
  ): Promise<AutoMLResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting AutoML pipeline', {
        dataSize: data.length,
        targetColumn: config.targetColumn,
        timeLimit: config.timeLimit || 60,
      });

      // Step 1: Data preprocessing and validation
      const processedData = await this.preprocessData(data, config);

      // Step 2: Feature engineering
      const engineeredData = await this.engineerFeatures(processedData, config);

      // Step 3: Algorithm selection
      const algorithms = config.algorithms || this.getDefaultAlgorithms();

      // Step 4: Hyperparameter optimization
      const trials: AutoMLResult['allTrials'] = [];
      let bestTrial = { algorithm: '', parameters: {}, score: -Infinity, trainingTime: 0 };

      for (const algorithm of algorithms) {
        const algorithmTrials = await this.optimizeAlgorithm(
          engineeredData,
          algorithm,
          config
        );
        
        trials.push(...algorithmTrials);

        // Update best trial
        for (const trial of algorithmTrials) {
          if (trial.score > bestTrial.score) {
            bestTrial = trial;
          }
        }

        // Check time limit
        if (config.timeLimit) {
          const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
          if (elapsedMinutes >= config.timeLimit) {
            logger.info(`AutoML time limit reached (${config.timeLimit}m), stopping`);
            break;
          }
        }
      }

      // Step 5: Train final model with best parameters
      const modelName = `automl_${config.targetColumn}_${Date.now()}`;
      await this.mlEngine.trainModel(
        engineeredData,
        config.targetColumn,
        ModelType.REGRESSION,
        bestTrial.algorithm,
        {
          hyperparameters: bestTrial.parameters,
          validation: true,
          testSize: 0.2,
          randomSeed: 42
        }
      );

      // Step 6: Get feature importance
      const featureImportance = await this.mlEngine.getFeatureImportance(modelName);

      // Step 7: Cross-validation
      const cvScore = await this.performCrossValidation(
        engineeredData,
        bestTrial.algorithm,
        bestTrial.parameters,
        config
      );

      const executionTime = Date.now() - startTime;

      const result: AutoMLResult = {
        bestModel: {
          algorithm: bestTrial.algorithm,
          parameters: bestTrial.parameters,
          score: bestTrial.score,
          crossValidationScore: cvScore,
        },
        allTrials: trials.sort((a, b) => b.score - a.score),
        featureImportance,
        modelPath: modelName,
        executionTime,
      };

      logger.info('AutoML pipeline completed', {
        bestAlgorithm: bestTrial.algorithm,
        bestScore: bestTrial.score,
        totalTrials: trials.length,
        executionTimeMs: executionTime,
      });

      return result;
    } catch (error: any) {
      logger.error(`AutoML pipeline failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Preprocess data for AutoML
   */
  private async preprocessData(data: any[], config: AutoMLConfig): Promise<any[]> {
    // Remove rows with missing target values
    const cleanData = data.filter(row => row[config.targetColumn] != null);

    // Handle missing values for features
    const processedData = cleanData.map(row => {
      const processedRow = { ...row };
      
      // Fill numeric missing values with median
      for (const key in processedRow) {
        if (key !== config.targetColumn && processedRow[key] == null) {
          processedRow[key] = 0; // Simple imputation
        }
      }

      return processedRow;
    });

    logger.info(`Data preprocessing completed: ${data.length} -> ${processedData.length} rows`);
    return processedData;
  }

  /**
   * Automatic feature engineering
   */
  private async engineerFeatures(data: any[], config: AutoMLConfig): Promise<any[]> {
    const engineeredData = data.map(row => {
      const engineered = { ...row };

      // Date features
      for (const key in row) {
        if (row[key] instanceof Date) {
          const date = new Date(row[key]);
          engineered[`${key}_year`] = date.getFullYear();
          engineered[`${key}_month`] = date.getMonth() + 1;
          engineered[`${key}_day`] = date.getDate();
          engineered[`${key}_dayOfWeek`] = date.getDay();
          engineered[`${key}_quarter`] = Math.floor(date.getMonth() / 3) + 1;
          engineered[`${key}_isWeekend`] = [0, 6].includes(date.getDay()) ? 1 : 0;
        }
      }

      // Interaction features (for numeric columns)
      const numericKeys = Object.keys(row).filter(key => 
        typeof row[key] === 'number' && key !== config.targetColumn
      );

      for (let i = 0; i < numericKeys.length - 1; i++) {
        for (let j = i + 1; j < numericKeys.length; j++) {
          const key1 = numericKeys[i];
          const key2 = numericKeys[j];
          engineered[`${key1}_x_${key2}`] = (row[key1] || 0) * (row[key2] || 0);
          if (row[key2] !== 0) {
            engineered[`${key1}_div_${key2}`] = (row[key1] || 0) / (row[key2] || 1);
          }
        }
      }

      return engineered;
    });

    logger.info('Feature engineering completed');
    return engineeredData;
  }

  /**
   * Get default algorithms for AutoML
   */
  private getDefaultAlgorithms(): string[] {
    return [
      'random_forest',
      'lightgbm',
      'xgboost',
      'linear_regression',
      'ridge_regression',
      'lasso_regression',
    ];
  }

  /**
   * Optimize hyperparameters for a specific algorithm
   */
  private async optimizeAlgorithm(
    data: any[],
    algorithm: string,
    config: AutoMLConfig
  ): Promise<AutoMLResult['allTrials']> {
    const trials: AutoMLResult['allTrials'] = [];
    const maxTrials = config.maxTrials || 20;

    // Define hyperparameter search spaces
    const searchSpaces = this.getSearchSpaces(algorithm);

    for (let i = 0; i < maxTrials; i++) {
      const parameters = this.sampleParameters(searchSpaces);
      const trialStart = Date.now();

      try {
        // Create temporary model for trial
        const modelName = `trial_${algorithm}_${i}_${Date.now()}`;
        
        await this.mlEngine.trainModel(
          data,
          config.targetColumn,
          ModelType.REGRESSION,
          algorithm,
          {
            hyperparameters: parameters,
            validation: true,
            testSize: 0.2,
            randomSeed: 42
          }
        );

        // Get validation score
        const metrics = await this.mlEngine.getModelMetrics(modelName);
        const score = this.extractScore(metrics, config.optimizationMetric || 'accuracy');

        const trainingTime = Date.now() - trialStart;

        trials.push({
          algorithm,
          parameters,
          score,
          trainingTime,
        });

        // Clean up trial model
        await this.mlEngine.deleteModel(modelName);

        logger.debug(`Trial ${i + 1}/${maxTrials} for ${algorithm}: score=${score}`, parameters);

      } catch (error: any) {
        logger.warn(`Trial ${i + 1} failed for ${algorithm}: ${error.message}`);
      }
    }

    return trials;
  }

  /**
   * Get hyperparameter search spaces for each algorithm
   */
  private getSearchSpaces(algorithm: string): Record<string, any> {
    const spaces: Record<string, Record<string, any>> = {
      random_forest: {
        n_estimators: [50, 100, 200, 500],
        max_depth: [3, 5, 10, 15, null],
        min_samples_split: [2, 5, 10],
        min_samples_leaf: [1, 2, 4],
        max_features: ['auto', 'sqrt', 'log2'],
      },
      lightgbm: {
        num_leaves: [10, 20, 50, 100],
        learning_rate: [0.01, 0.05, 0.1, 0.2],
        feature_fraction: [0.6, 0.8, 1.0],
        bagging_fraction: [0.6, 0.8, 1.0],
        min_data_in_leaf: [10, 20, 50],
      },
      xgboost: {
        n_estimators: [100, 200, 500],
        max_depth: [3, 5, 7],
        learning_rate: [0.01, 0.1, 0.2],
        subsample: [0.8, 0.9, 1.0],
        colsample_bytree: [0.8, 0.9, 1.0],
      },
      linear_regression: {},
      ridge_regression: {
        alpha: [0.1, 1.0, 10.0, 100.0],
      },
      lasso_regression: {
        alpha: [0.1, 1.0, 10.0, 100.0],
      },
    };

    return spaces[algorithm] || {};
  }

  /**
   * Sample parameters from search space
   */
  private sampleParameters(searchSpace: Record<string, any>): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const [param, values] of Object.entries(searchSpace)) {
      if (Array.isArray(values)) {
        parameters[param] = values[Math.floor(Math.random() * values.length)];
      }
    }

    return parameters;
  }

  /**
   * Extract score from metrics based on optimization metric
   */
  private extractScore(metrics: any, optimizationMetric: string): number {
    switch (optimizationMetric) {
      case 'accuracy':
        return metrics.accuracy || 0;
      case 'precision':
        return metrics.precision || 0;
      case 'recall':
        return metrics.recall || 0;
      case 'f1':
        return metrics.f1_score || 0;
      case 'rmse':
        return -(metrics.rmse || Infinity); // Negative because we want to minimize
      case 'mae':
        return -(metrics.mae || Infinity); // Negative because we want to minimize
      default:
        return metrics.r2_score || metrics.accuracy || 0;
    }
  }

  /**
   * Perform cross-validation
   */
  private async performCrossValidation(
    data: any[],
    algorithm: string,
    parameters: Record<string, any>,
    config: AutoMLConfig
  ): Promise<number> {
    const folds = config.crossValidationFolds || 5;
    const scores: number[] = [];

    // Simple k-fold cross-validation
    const foldSize = Math.floor(data.length / folds);

    for (let fold = 0; fold < folds; fold++) {
      const testStart = fold * foldSize;
      const testEnd = fold === folds - 1 ? data.length : (fold + 1) * foldSize;

      const testData = data.slice(testStart, testEnd);
      const trainData = [
        ...data.slice(0, testStart),
        ...data.slice(testEnd),
      ];

      try {
        const modelName = `cv_${algorithm}_${fold}_${Date.now()}`;
        
        await this.mlEngine.trainModel(
          trainData,
          config.targetColumn,
          ModelType.REGRESSION,
          algorithm,
          {
            hyperparameters: parameters,
            validation: false,
            testSize: 0.2,
            randomSeed: 42
          }
        );

        // Predict on test set
        const predictions = await this.mlEngine.predictBatch(
          modelName,
          testData.map(row => {
            const { [config.targetColumn]: target, ...features } = row;
            return features;
          })
        );

        // Calculate score
        const actualValues = testData.map(row => row[config.targetColumn]);
        const score = this.calculateScore(actualValues, predictions, config.optimizationMetric || 'accuracy');
        scores.push(score);

        // Clean up
        await this.mlEngine.deleteModel(modelName);

      } catch (error: any) {
        logger.warn(`Cross-validation fold ${fold} failed: ${error.message}`);
      }
    }

    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  /**
   * Calculate score for cross-validation
   */
  private calculateScore(
    actual: number[],
    predicted: any[],
    metric: string
  ): number {
    if (actual.length !== predicted.length) {
      return 0;
    }

    const n = actual.length;
    const predictedValues = predicted.map(p => p.value || p);

    switch (metric) {
      case 'rmse':
        const rmse = Math.sqrt(
          actual.reduce((sum, a, i) => sum + Math.pow(a - predictedValues[i], 2), 0) / n
        );
        return -rmse; // Negative because we want to maximize

      case 'mae':
        const mae = actual.reduce((sum, a, i) => sum + Math.abs(a - predictedValues[i]), 0) / n;
        return -mae; // Negative because we want to maximize

      default:
        // R-squared for regression
        const actualMean = actual.reduce((sum, a) => sum + a, 0) / n;
        const totalSumSquares = actual.reduce((sum, a) => sum + Math.pow(a - actualMean, 2), 0);
        const residualSumSquares = actual.reduce((sum, a, i) => sum + Math.pow(a - predictedValues[i], 2), 0);
        
        return totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);
    }
  }

  /**
   * Get AutoML recommendations
   */
  public getRecommendations(result: AutoMLResult): string[] {
    const recommendations: string[] = [];

    // Check if more data is needed
    if (result.allTrials.length < 10) {
      recommendations.push('Consider collecting more training data for better model selection');
    }

    // Check feature importance
    const topFeatures = Object.entries(result.featureImportance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    recommendations.push(`Top 5 important features: ${topFeatures.map(([f]) => f).join(', ')}`);

    // Check execution time
    if (result.executionTime > 30 * 60 * 1000) { // 30 minutes
      recommendations.push('Consider using faster algorithms or reducing the search space for production use');
    }

    // Check cross-validation score
    const cvDiff = Math.abs(result.bestModel.score - result.bestModel.crossValidationScore);
    if (cvDiff > 0.1) {
      recommendations.push('Model may be overfitting - consider regularization or more data');
    }

    return recommendations;
  }
}

export default AutoMLService;