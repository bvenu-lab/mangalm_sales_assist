/**
 * Type definitions for TensorFlow.js
 */
declare module '@tensorflow/tfjs-node' {
  export function loadLayersModel(modelPath: any): Promise<LayersModel>;
  export interface LayersModel {
    compile(config: ModelCompileConfig): void;
    fit(
      x: Tensor | Tensor[],
      y: Tensor | Tensor[],
      config?: ModelFitConfig
    ): Promise<History>;
    predict(x: Tensor | Tensor[]): Tensor | Tensor[];
    save(io: any): Promise<any>;
  }

  export interface ModelCompileConfig {
    optimizer: string | Optimizer;
    loss: string | string[] | Loss | Loss[];
    metrics?: string[] | Metric[];
  }

  export interface ModelFitConfig {
    epochs?: number;
    batchSize?: number;
    validationSplit?: number;
    callbacks?: Callback | Callback[];
  }

  export interface Callback {
    onEpochEnd?: (epoch: number, logs?: any) => void;
    onBatchEnd?: (batch: number, logs?: any) => void;
    onTrainBegin?: (logs?: any) => void;
    onTrainEnd?: (logs?: any) => void;
  }

  export interface History {
    history: {
      [key: string]: number[];
    };
  }

  export interface Tensor {
    dispose(): void;
    array(): Promise<any>;
  }

  export interface Optimizer {
    // Placeholder for optimizer interface
  }

  export interface Loss {
    // Placeholder for loss interface
  }

  export interface Metric {
    // Placeholder for metric interface
  }

  export namespace layers {
    export function dense(config: {
      units: number;
      activation?: string;
      inputShape?: number[];
    }): Layer;

    export function dropout(config: { rate: number }): Layer;
  }

  export interface Layer {
    // Placeholder for layer interface
  }

  export namespace train {
    export function adam(learningRate?: number): Optimizer;
  }

  export function sequential(config?: { layers?: Layer[] }): LayersModel;
  export function tensor2d(data: number[][], shape?: [number, number]): Tensor;

  export namespace io {
    export function fromMemory(modelData: any): any;
    export function memory(): any;
  }
}
