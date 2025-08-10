/**
 * Enterprise Model Registry and Deployment Pipeline
 * Manages model lifecycle, versioning, and deployment
 */

import { logger } from '../utils/logger';
import { RedisCache } from '../../../../shared/src/cache/redis-cache';
import { EnterpriseMLEngine } from './enterprise-ml-engine';

export interface ModelMetadata {
  modelId: string;
  name: string;
  version: string;
  algorithm: string;
  trainedAt: Date;
  trainedBy: string;
  datasetVersion: string;
  metrics: Record<string, number>;
  tags: string[];
  description?: string;
  status: 'training' | 'ready' | 'deployed' | 'deprecated' | 'failed';
  deployedAt?: Date;
  deploymentConfig?: DeploymentConfig;
}

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  strategy: 'blue-green' | 'canary' | 'rolling';
  rolloutPercentage?: number;
  autoRollback?: boolean;
  healthChecks?: string[];
  resources?: {
    cpu: string;
    memory: string;
    replicas: number;
  };
}

export interface ModelComparison {
  currentModel: ModelMetadata;
  newModel: ModelMetadata;
  metricComparison: Record<string, { current: number; new: number; improvement: number }>;
  recommendation: 'deploy' | 'reject' | 'a_b_test';
  reasoning: string[];
}

export class ModelRegistry {
  private cache: RedisCache;
  private mlEngine: EnterpriseMLEngine;
  private models: Map<string, ModelMetadata> = new Map();

  constructor(mlEngine: EnterpriseMLEngine, cache?: RedisCache) {
    this.mlEngine = mlEngine;
    this.cache = cache || new RedisCache({ keyPrefix: 'model_registry:' });
    this.loadModelsFromCache();
  }

  /**
   * Register a new model version
   */
  public async registerModel(
    name: string,
    version: string,
    algorithm: string,
    metrics: Record<string, number>,
    metadata?: Partial<ModelMetadata>
  ): Promise<string> {
    try {
      const modelId = `${name}_${version}_${Date.now()}`;
      
      const model: ModelMetadata = {
        modelId,
        name,
        version,
        algorithm,
        trainedAt: new Date(),
        trainedBy: metadata?.trainedBy || 'system',
        datasetVersion: metadata?.datasetVersion || 'latest',
        metrics,
        tags: metadata?.tags || [],
        description: metadata?.description,
        status: 'ready',
        ...metadata
      };

      this.models.set(modelId, model);
      await this.cache.set(`model:${modelId}`, model);
      
      logger.info('Model registered successfully', {
        modelId,
        name,
        version,
        algorithm,
        metrics
      });

      return modelId;
    } catch (error: any) {
      logger.error(`Failed to register model: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get model by ID
   */
  public async getModel(modelId: string): Promise<ModelMetadata | null> {
    try {
      let model = this.models.get(modelId);
      
      if (!model) {
        model = await this.cache.get<ModelMetadata>(`model:${modelId}`);
        if (model) {
          this.models.set(modelId, model);
        }
      }

      return model || null;
    } catch (error: any) {
      logger.error(`Failed to get model: ${error.message}`, error);
      return null;
    }
  }

  /**
   * List all models with filtering
   */
  public async listModels(filters?: {
    name?: string;
    status?: ModelMetadata['status'];
    algorithm?: string;
    tags?: string[];
    limit?: number;
  }): Promise<ModelMetadata[]> {
    try {
      let models = Array.from(this.models.values());

      // Apply filters
      if (filters) {
        if (filters.name) {
          models = models.filter(m => m.name === filters.name);
        }
        if (filters.status) {
          models = models.filter(m => m.status === filters.status);
        }
        if (filters.algorithm) {
          models = models.filter(m => m.algorithm === filters.algorithm);
        }
        if (filters.tags) {
          models = models.filter(m => 
            filters.tags!.some(tag => m.tags.includes(tag))
          );
        }
      }

      // Sort by trained date (newest first)
      models.sort((a, b) => b.trainedAt.getTime() - a.trainedAt.getTime());

      // Apply limit
      if (filters?.limit) {
        models = models.slice(0, filters.limit);
      }

      return models;
    } catch (error: any) {
      logger.error(`Failed to list models: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Deploy model to environment
   */
  public async deployModel(
    modelId: string,
    environment: 'development' | 'staging' | 'production',
    config?: DeploymentConfig
  ): Promise<boolean> {
    try {
      const model = await this.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      if (model.status !== 'ready') {
        throw new Error(`Model is not ready for deployment. Status: ${model.status}`);
      }

      const deploymentConfig: DeploymentConfig = {
        environment,
        strategy: config?.strategy || 'rolling',
        rolloutPercentage: config?.rolloutPercentage || 100,
        autoRollback: config?.autoRollback || true,
        healthChecks: config?.healthChecks || ['prediction_accuracy', 'response_time'],
        resources: config?.resources || {
          cpu: '500m',
          memory: '1Gi',
          replicas: environment === 'production' ? 3 : 1
        }
      };

      // Perform deployment based on strategy
      const success = await this.executeDeployment(model, deploymentConfig);

      if (success) {
        model.status = 'deployed';
        model.deployedAt = new Date();
        model.deploymentConfig = deploymentConfig;
        
        this.models.set(modelId, model);
        await this.cache.set(`model:${modelId}`, model);
        
        // Mark previous models as deprecated if this is production
        if (environment === 'production') {
          await this.deprecateOldModels(model.name, modelId);
        }

        logger.info('Model deployed successfully', {
          modelId,
          environment,
          strategy: deploymentConfig.strategy
        });
      }

      return success;
    } catch (error: any) {
      logger.error(`Failed to deploy model: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Compare two models and provide deployment recommendation
   */
  public async compareModels(currentModelId: string, newModelId: string): Promise<ModelComparison> {
    try {
      const currentModel = await this.getModel(currentModelId);
      const newModel = await this.getModel(newModelId);

      if (!currentModel || !newModel) {
        throw new Error('One or both models not found');
      }

      const metricComparison: Record<string, any> = {};
      const reasoning: string[] = [];

      // Compare metrics
      for (const [metric, newValue] of Object.entries(newModel.metrics)) {
        const currentValue = currentModel.metrics[metric];
        if (currentValue !== undefined) {
          const improvement = ((newValue - currentValue) / currentValue) * 100;
          metricComparison[metric] = {
            current: currentValue,
            new: newValue,
            improvement: improvement
          };

          if (improvement > 5) {
            reasoning.push(`${metric} improved by ${improvement.toFixed(2)}%`);
          } else if (improvement < -5) {
            reasoning.push(`${metric} degraded by ${Math.abs(improvement).toFixed(2)}%`);
          }
        }
      }

      // Determine recommendation
      let recommendation: ModelComparison['recommendation'] = 'reject';
      
      const keyMetrics = ['accuracy', 'precision', 'recall', 'f1_score', 'rmse', 'mae'];
      const improvements = keyMetrics
        .filter(metric => metricComparison[metric])
        .map(metric => metricComparison[metric].improvement);

      const avgImprovement = improvements.length > 0 
        ? improvements.reduce((a, b) => a + b, 0) / improvements.length 
        : 0;

      if (avgImprovement > 10) {
        recommendation = 'deploy';
        reasoning.push('Significant overall improvement detected');
      } else if (avgImprovement > 2) {
        recommendation = 'a_b_test';
        reasoning.push('Moderate improvement - recommend A/B testing');
      } else if (avgImprovement < -5) {
        recommendation = 'reject';
        reasoning.push('Performance degradation detected');
      } else {
        reasoning.push('No significant improvement detected');
      }

      return {
        currentModel,
        newModel,
        metricComparison,
        recommendation,
        reasoning
      };
    } catch (error: any) {
      logger.error(`Failed to compare models: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Rollback deployment
   */
  public async rollbackDeployment(
    environment: 'development' | 'staging' | 'production',
    modelName: string
  ): Promise<boolean> {
    try {
      // Find previous deployed model
      const models = await this.listModels({
        name: modelName,
        status: 'deprecated',
        limit: 1
      });

      if (models.length === 0) {
        throw new Error('No previous version found for rollback');
      }

      const previousModel = models[0];
      
      // Redeploy previous model
      const success = await this.deployModel(previousModel.modelId, environment, {
        environment,
        strategy: 'rolling', // Fast rollback
        rolloutPercentage: 100
      });

      if (success) {
        logger.info('Rollback completed successfully', {
          modelId: previousModel.modelId,
          version: previousModel.version,
          environment
        });
      }

      return success;
    } catch (error: any) {
      logger.error(`Failed to rollback deployment: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Get deployment status
   */
  public async getDeploymentStatus(environment: string): Promise<any> {
    try {
      const deployedModels = await this.listModels({ status: 'deployed' });
      
      const environmentModels = deployedModels.filter(
        model => model.deploymentConfig?.environment === environment
      );

      return {
        environment,
        totalDeployedModels: environmentModels.length,
        models: environmentModels.map(model => ({
          modelId: model.modelId,
          name: model.name,
          version: model.version,
          deployedAt: model.deployedAt,
          metrics: model.metrics,
          healthStatus: 'healthy' // This would come from actual health checks
        }))
      };
    } catch (error: any) {
      logger.error(`Failed to get deployment status: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Monitor model performance in production
   */
  public async monitorModelPerformance(modelId: string): Promise<any> {
    try {
      const model = await this.getModel(modelId);
      if (!model || model.status !== 'deployed') {
        throw new Error('Model is not currently deployed');
      }

      // Get real-time metrics from ML engine
      const liveMetrics = await this.mlEngine.getModelMetrics(model.name);
      
      // Compare with training metrics
      const metricDrift: Record<string, any> = {};
      for (const [metric, trainValue] of Object.entries(model.metrics)) {
        const liveValue = liveMetrics[metric];
        if (liveValue !== undefined) {
          const drift = Math.abs((liveValue - trainValue) / trainValue) * 100;
          metricDrift[metric] = {
            training: trainValue,
            live: liveValue,
            drift: drift,
            status: drift > 15 ? 'alert' : drift > 10 ? 'warning' : 'ok'
          };
        }
      }

      return {
        modelId,
        monitoredAt: new Date(),
        metricDrift,
        overallStatus: Object.values(metricDrift).some((m: any) => m.status === 'alert') 
          ? 'needs_attention' : 'healthy'
      };
    } catch (error: any) {
      logger.error(`Failed to monitor model performance: ${error.message}`, error);
      throw error;
    }
  }

  // Private methods

  private async loadModelsFromCache(): Promise<void> {
    try {
      // This would load models from persistent storage in a real implementation
      logger.info('Model registry initialized');
    } catch (error: any) {
      logger.error(`Failed to load models from cache: ${error.message}`, error);
    }
  }

  private async executeDeployment(model: ModelMetadata, config: DeploymentConfig): Promise<boolean> {
    try {
      logger.info(`Executing ${config.strategy} deployment for model ${model.modelId}`);

      // Simulate deployment based on strategy
      switch (config.strategy) {
        case 'blue-green':
          return await this.blueGreenDeployment(model, config);
        case 'canary':
          return await this.canaryDeployment(model, config);
        case 'rolling':
          return await this.rollingDeployment(model, config);
        default:
          throw new Error(`Unknown deployment strategy: ${config.strategy}`);
      }
    } catch (error: any) {
      logger.error(`Deployment execution failed: ${error.message}`, error);
      return false;
    }
  }

  private async blueGreenDeployment(model: ModelMetadata, config: DeploymentConfig): Promise<boolean> {
    // Deploy to blue environment
    logger.info('Deploying to blue environment');
    await this.sleep(2000); // Simulate deployment time

    // Run health checks
    const healthy = await this.runHealthChecks(model, config);
    if (!healthy) {
      logger.error('Health checks failed, aborting deployment');
      return false;
    }

    // Switch traffic
    logger.info('Switching traffic to blue environment');
    await this.sleep(1000);

    return true;
  }

  private async canaryDeployment(model: ModelMetadata, config: DeploymentConfig): Promise<boolean> {
    const percentage = config.rolloutPercentage || 10;
    
    logger.info(`Starting canary deployment with ${percentage}% traffic`);
    await this.sleep(2000);

    // Monitor canary for issues
    const canaryHealthy = await this.runHealthChecks(model, config);
    if (!canaryHealthy) {
      logger.error('Canary health checks failed, rolling back');
      return false;
    }

    // Gradually increase traffic
    for (let p = percentage; p <= 100; p += 20) {
      logger.info(`Increasing canary traffic to ${p}%`);
      await this.sleep(1000);
    }

    return true;
  }

  private async rollingDeployment(model: ModelMetadata, config: DeploymentConfig): Promise<boolean> {
    const replicas = config.resources?.replicas || 3;
    
    logger.info(`Starting rolling deployment across ${replicas} replicas`);

    for (let i = 0; i < replicas; i++) {
      logger.info(`Updating replica ${i + 1}/${replicas}`);
      await this.sleep(1000);

      // Health check after each replica
      const healthy = await this.runHealthChecks(model, config);
      if (!healthy && config.autoRollback) {
        logger.error('Health check failed, initiating rollback');
        return false;
      }
    }

    return true;
  }

  private async runHealthChecks(model: ModelMetadata, config: DeploymentConfig): Promise<boolean> {
    const checks = config.healthChecks || [];
    
    for (const check of checks) {
      logger.info(`Running health check: ${check}`);
      await this.sleep(500);

      // Simulate health check (in reality, this would check actual metrics)
      const healthy = Math.random() > 0.1; // 90% success rate
      if (!healthy) {
        logger.warn(`Health check failed: ${check}`);
        return false;
      }
    }

    return true;
  }

  private async deprecateOldModels(modelName: string, currentModelId: string): Promise<void> {
    const oldModels = await this.listModels({
      name: modelName,
      status: 'deployed'
    });

    for (const model of oldModels) {
      if (model.modelId !== currentModelId) {
        model.status = 'deprecated';
        this.models.set(model.modelId, model);
        await this.cache.set(`model:${model.modelId}`, model);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ModelRegistry;