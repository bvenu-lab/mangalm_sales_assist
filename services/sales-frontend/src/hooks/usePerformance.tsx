import { useEffect, useRef, useCallback } from 'react';
import { getPerformanceMonitor } from '../services/performance';

/**
 * Hook for component-level performance monitoring
 */
export function useComponentPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current++;

    return () => {
      const renderEndTime = performance.now();
      const duration = renderEndTime - renderStartTime.current;
      
      const monitor = getPerformanceMonitor();
      if (monitor) {
        monitor.trackComponentRender(componentName, duration);
        
        // Warn if render is slow
        if (duration > 16) { // More than one frame (60fps)
          console.warn(
            `Slow render detected in ${componentName}: ${duration.toFixed(2)}ms`
          );
        }
      }
    };
  });

  return {
    renderCount: renderCount.current,
  };
}

/**
 * Hook for tracking user interactions
 */
export function useInteractionTracking(featureName: string) {
  const monitor = getPerformanceMonitor();

  const trackClick = useCallback((elementName: string, metadata?: Record<string, any>) => {
    monitor?.recordUserAction({
      type: 'click',
      target: `${featureName}.${elementName}`,
      timestamp: Date.now(),
      ...metadata,
    });
  }, [monitor, featureName]);

  const trackChange = useCallback((elementName: string, value: any) => {
    monitor?.recordUserAction({
      type: 'change',
      target: `${featureName}.${elementName}`,
      timestamp: Date.now(),
    });
  }, [monitor, featureName]);

  const trackSubmit = useCallback((formName: string, success: boolean, error?: string) => {
    monitor?.recordUserAction({
      type: 'submit',
      target: `${featureName}.${formName}`,
      timestamp: Date.now(),
      success,
      error,
    });
  }, [monitor, featureName]);

  return {
    trackClick,
    trackChange,
    trackSubmit,
  };
}

/**
 * Hook for API performance tracking
 */
export function useApiPerformance() {
  const monitor = getPerformanceMonitor();

  const trackApiCall = useCallback(async <T,>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const endTime = performance.now();
      
      monitor?.trackApiCall(endpoint, method, startTime, endTime, 200);
      
      return result;
    } catch (error: any) {
      const endTime = performance.now();
      const status = error.response?.status || 500;
      
      monitor?.trackApiCall(endpoint, method, startTime, endTime, status);
      
      throw error;
    }
  }, [monitor]);

  return { trackApiCall };
}

/**
 * Hook for custom performance timing
 */
export function usePerformanceTiming(timerName: string) {
  const monitor = getPerformanceMonitor();
  const isTimingRef = useRef(false);

  const startTiming = useCallback(() => {
    if (!isTimingRef.current) {
      monitor?.startTimer(timerName);
      isTimingRef.current = true;
    }
  }, [monitor, timerName]);

  const endTiming = useCallback((metadata?: Record<string, any>) => {
    if (isTimingRef.current) {
      const duration = monitor?.endTimer(timerName, metadata);
      isTimingRef.current = false;
      return duration;
    }
    return null;
  }, [monitor, timerName]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTimingRef.current) {
        endTiming({ abandoned: true });
      }
    };
  }, [endTiming]);

  return { startTiming, endTiming };
}

/**
 * Hook for Web Vitals monitoring
 */
export function useWebVitals() {
  const monitor = getPerformanceMonitor();

  const getVitals = useCallback(() => {
    return monitor?.getWebVitals() || { score: 'poor', metrics: null };
  }, [monitor]);

  const getBottlenecks = useCallback(() => {
    return monitor?.analyzeBottlenecks() || {
      slowResources: [],
      largeResources: [],
      uncachedResources: [],
    };
  }, [monitor]);

  return { getVitals, getBottlenecks };
}