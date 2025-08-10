import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  Fade,
  Zoom,
  Slide,
  Portal,
  useTheme,
  alpha,
  Backdrop,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay as RestartIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';

interface TourStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  content: string | React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightPadding?: number;
  disableInteraction?: boolean;
  action?: () => void;
  waitFor?: string; // CSS selector to wait for
  delay?: number;
  spotlightRadius?: number;
  showSkip?: boolean;
  showProgress?: boolean;
}

interface TourConfig {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (step: number) => void;
  autoStart?: boolean;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  showOverlay?: boolean;
  overlayOpacity?: number;
  allowKeyboardNavigation?: boolean;
  allowClickOutside?: boolean;
  persistProgress?: boolean;
  storageKey?: string;
}

/**
 * World-class Onboarding Tour Component
 * Interactive product tours with spotlight effect
 */
const OnboardingTour: React.FC<TourConfig> = ({
  steps,
  onComplete,
  onSkip,
  onStepChange,
  autoStart = false,
  autoAdvance = false,
  autoAdvanceDelay = 5000,
  showOverlay = true,
  overlayOpacity = 0.7,
  allowKeyboardNavigation = true,
  allowClickOutside = false,
  persistProgress = true,
  storageKey = 'onboarding_tour',
}) => {
  const theme = useTheme();
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const autoAdvanceTimer = useRef<NodeJS.Timeout>();
  const resizeObserver = useRef<ResizeObserver>();
  const mutationObserver = useRef<MutationObserver>();

  // Load progress from storage
  useEffect(() => {
    if (persistProgress && storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.completed) {
            setIsActive(false);
          } else if (data.currentStep) {
            setCurrentStep(data.currentStep);
          }
        } catch (error) {
          console.error('Failed to load tour progress:', error);
        }
      }
    }
  }, [persistProgress, storageKey]);

  // Save progress to storage
  useEffect(() => {
    if (persistProgress && storageKey && isActive) {
      localStorage.setItem(storageKey, JSON.stringify({
        currentStep,
        timestamp: Date.now(),
      }));
    }
  }, [currentStep, isActive, persistProgress, storageKey]);

  // Find and observe target element
  useEffect(() => {
    if (!isActive || !steps[currentStep]) return;

    const step = steps[currentStep];
    
    const findTarget = () => {
      const element = document.querySelector(step.target) as HTMLElement;
      
      if (element) {
        setTargetElement(element);
        
        // Scroll into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });

        // Calculate spotlight
        updateSpotlight(element, step.highlightPadding);

        // Calculate tooltip position
        updateTooltipPosition(element, step.placement);

        // Observe element changes
        if (resizeObserver.current) {
          resizeObserver.current.disconnect();
        }
        
        resizeObserver.current = new ResizeObserver(() => {
          updateSpotlight(element, step.highlightPadding);
          updateTooltipPosition(element, step.placement);
        });
        
        resizeObserver.current.observe(element);

        // Run step action
        step.action?.();
      } else if (step.waitFor) {
        // Wait for element to appear
        if (mutationObserver.current) {
          mutationObserver.current.disconnect();
        }

        mutationObserver.current = new MutationObserver(() => {
          const waitElement = document.querySelector(step.waitFor!);
          if (waitElement) {
            mutationObserver.current?.disconnect();
            findTarget();
          }
        });

        mutationObserver.current.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    };

    // Add delay if specified
    if (step.delay) {
      setTimeout(findTarget, step.delay);
    } else {
      findTarget();
    }

    return () => {
      resizeObserver.current?.disconnect();
      mutationObserver.current?.disconnect();
    };
  }, [isActive, currentStep, steps]);

  // Update spotlight
  const updateSpotlight = (element: HTMLElement, padding: number = 10) => {
    const rect = element.getBoundingClientRect();
    setSpotlightRect({
      ...rect,
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      right: rect.right + padding,
      bottom: rect.bottom + padding,
    } as DOMRect);
  };

  // Update tooltip position
  const updateTooltipPosition = (element: HTMLElement, placement?: string) => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 200;
    const offset = 20;

    let top = 0;
    let left = 0;

    switch (placement || 'bottom') {
      case 'top':
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - offset;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + offset;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipHeight / 2;
        left = window.innerWidth / 2 - tooltipWidth / 2;
        break;
    }

    // Keep within viewport
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    setTooltipPosition({ top, left });
  };

  // Auto-advance
  useEffect(() => {
    if (autoAdvance && isActive && !isPaused) {
      autoAdvanceTimer.current = setTimeout(() => {
        handleNext();
      }, autoAdvanceDelay);

      return () => {
        if (autoAdvanceTimer.current) {
          clearTimeout(autoAdvanceTimer.current);
        }
      };
    }
  }, [currentStep, autoAdvance, autoAdvanceDelay, isActive, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    if (!allowKeyboardNavigation || !isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'Escape':
          handleSkip();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allowKeyboardNavigation, isActive, currentStep]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      onStepChange?.(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length, onStepChange]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      onStepChange?.(currentStep - 1);
    }
  }, [currentStep, onStepChange]);

  // Handle complete
  const handleComplete = useCallback(() => {
    setIsActive(false);
    
    if (persistProgress && storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({
        completed: true,
        timestamp: Date.now(),
      }));
    }
    
    onComplete?.();
  }, [persistProgress, storageKey, onComplete]);

  // Handle skip
  const handleSkip = useCallback(() => {
    setIsActive(false);
    onSkip?.();
  }, [onSkip]);

  // Handle restart
  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    setIsPaused(false);
    
    if (persistProgress && storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [persistProgress, storageKey]);

  if (!isActive) {
    return (
      <Portal>
        <Zoom in={true}>
          <Box
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: theme.zIndex.speedDial,
            }}
          >
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={handleRestart}
              sx={{
                borderRadius: 20,
                px: 3,
                boxShadow: 4,
              }}
            >
              Start Tour
            </Button>
          </Box>
        </Zoom>
      </Portal>
    );
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Portal>
      {/* Overlay with spotlight */}
      {showOverlay && (
        <Box
          onClick={allowClickOutside ? undefined : (e) => e.stopPropagation()}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: theme.zIndex.modal,
            pointerEvents: step?.disableInteraction ? 'auto' : 'none',
          }}
        >
          {/* Dark overlay */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {spotlightRect && (
                  <rect
                    x={spotlightRect.left}
                    y={spotlightRect.top}
                    width={spotlightRect.width}
                    height={spotlightRect.height}
                    rx={theme.shape.borderRadius}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill={alpha(theme.palette.common.black, overlayOpacity)}
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Animated border around spotlight */}
          {spotlightRect && (
            <Box
              sx={{
                position: 'absolute',
                top: spotlightRect.top - 2,
                left: spotlightRect.left - 2,
                width: spotlightRect.width + 4,
                height: spotlightRect.height + 4,
                border: `2px solid ${theme.palette.primary.main}`,
                borderRadius: 1,
                pointerEvents: 'none',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': {
                    boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.7)}`,
                  },
                  '70%': {
                    boxShadow: `0 0 0 10px ${alpha(theme.palette.primary.main, 0)}`,
                  },
                  '100%': {
                    boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}`,
                  },
                },
              }}
            />
          )}
        </Box>
      )}

      {/* Tooltip */}
      <Zoom in={true} key={currentStep}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: 400,
            maxWidth: 'calc(100vw - 20px)',
            zIndex: theme.zIndex.modal + 1,
            borderRadius: 2,
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {/* Progress bar */}
          {step?.showProgress !== false && (
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 3 }}
            />
          )}

          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Typography variant="h6" component="h2">
              {step?.title}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {autoAdvance && (
                <IconButton
                  size="small"
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <PlayIcon /> : <PauseIcon />}
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={handleSkip}
                title="Close tour"
              >
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* Content */}
          <Box sx={{ p: 2 }}>
            {typeof step?.content === 'string' ? (
              <Typography variant="body1">{step.content}</Typography>
            ) : (
              step?.content
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Step {currentStep + 1} of {steps.length}
            </Typography>

            <Stack direction="row" spacing={1}>
              {step?.showSkip !== false && (
                <Button
                  size="small"
                  onClick={handleSkip}
                >
                  Skip Tour
                </Button>
              )}
              
              <Button
                size="small"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                startIcon={<BackIcon />}
              >
                Back
              </Button>
              
              <Button
                size="small"
                variant="contained"
                onClick={handleNext}
                endIcon={
                  currentStep === steps.length - 1 ? <CheckIcon /> : <NextIcon />
                }
              >
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Zoom>
    </Portal>
  );
};

// Hook for managing tours
export const useOnboardingTour = (config: TourConfig) => {
  const [tourConfig, setTourConfig] = useState(config);
  const [isActive, setIsActive] = useState(false);

  const startTour = useCallback((stepIndex: number = 0) => {
    setIsActive(true);
    setTourConfig(prev => ({
      ...prev,
      autoStart: true,
    }));
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
  }, []);

  const updateSteps = useCallback((steps: TourStep[]) => {
    setTourConfig(prev => ({
      ...prev,
      steps,
    }));
  }, []);

  return {
    tourConfig,
    isActive,
    startTour,
    endTour,
    updateSteps,
  };
};

export default OnboardingTour;