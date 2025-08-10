import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Stack,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
  errorId: string;
}

/**
 * Enterprise Error Boundary Component
 * Provides sophisticated error handling with recovery options
 */
class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log to error reporting service (e.g., Sentry, LogRocket)
    this.logErrorToService(error, errorInfo);

    // Auto-reset after multiple errors (circuit breaker pattern)
    if (this.state.errorCount >= 3) {
      this.scheduleReset(5000);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    // Reset on prop changes if enabled
    if (hasError && prevProps.children !== this.props.children && resetOnPropsChange) {
      this.resetErrorBoundary();
    }

    // Reset when resetKeys change
    if (resetKeys && hasError) {
      const hasResetKeyChanged = resetKeys.some((key, idx) => key !== this.previousResetKeys[idx]);
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
    
    this.previousResetKeys = resetKeys || [];
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In production, this would send to an error tracking service
    const errorReport = {
      id: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level || 'component',
    };

    // Placeholder for error service integration
    console.log('Error Report:', errorReport);
    
    // Store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push(errorReport);
      // Keep only last 10 errors
      if (errors.length > 10) {
        errors.shift();
      }
      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  scheduleReset = (delay: number) => {
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: '',
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  handleReportBug = () => {
    const { error, errorInfo, errorId } = this.state;
    const bugReport = {
      id: errorId,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    };

    // In production, this would open a bug report form or send to issue tracker
    console.log('Bug Report:', bugReport);
    
    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(bugReport, null, 2));
    alert('Error details copied to clipboard. Please include this in your bug report.');
  };

  renderErrorFallback = () => {
    const { error, errorInfo, showDetails, errorCount, errorId } = this.state;
    const { level = 'component', isolate } = this.props;

    // Different UI based on error level
    if (level === 'page') {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          bgcolor="background.default"
          p={3}
        >
          <Paper elevation={3} sx={{ maxWidth: 600, width: '100%', p: 4 }}>
            <Stack spacing={3} alignItems="center" textAlign="center">
              <ErrorIcon color="error" sx={{ fontSize: 64 }} />
              
              <Typography variant="h4" component="h1" gutterBottom>
                Oops! Something went wrong
              </Typography>
              
              <Typography variant="body1" color="text.secondary">
                We encountered an unexpected error. The issue has been logged and our team will look into it.
              </Typography>

              {errorCount > 2 && (
                <Alert severity="warning" sx={{ width: '100%' }}>
                  Multiple errors detected. The application may be unstable.
                </Alert>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                  size="large"
                >
                  Reload Page
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Go Home
                </Button>
              </Stack>

              <Divider sx={{ width: '100%' }} />

              <Box width="100%">
                <Button
                  onClick={this.toggleDetails}
                  endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  size="small"
                >
                  {showDetails ? 'Hide' : 'Show'} Error Details
                </Button>

                <Collapse in={showDetails}>
                  <Box mt={2}>
                    <Alert 
                      severity="error" 
                      sx={{ textAlign: 'left', mb: 2 }}
                      action={
                        <IconButton
                          size="small"
                          onClick={this.handleReportBug}
                          title="Report Bug"
                        >
                          <BugReportIcon />
                        </IconButton>
                      }
                    >
                      <AlertTitle>Error ID: {errorId}</AlertTitle>
                      <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {error?.message}
                      </Typography>
                    </Alert>

                    {process.env.NODE_ENV === 'development' && errorInfo && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.100', maxHeight: 300, overflow: 'auto' }}>
                        <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {errorInfo.componentStack}
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Stack>
          </Paper>
        </Box>
      );
    }

    // Component/Section level error
    return (
      <Box p={isolate ? 0 : 2}>
        <Alert 
          severity="error"
          action={
            <Stack direction="row" spacing={1}>
              <IconButton size="small" onClick={this.resetErrorBoundary} title="Retry">
                <RefreshIcon />
              </IconButton>
              <IconButton size="small" onClick={this.toggleDetails} title="Details">
                {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>
          }
        >
          <AlertTitle>Component Error</AlertTitle>
          This component encountered an error and cannot be displayed.
        </Alert>

        <Collapse in={showDetails}>
          <Paper variant="outlined" sx={{ mt: 1, p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="caption" color="text.secondary">
              Error: {error?.message}
            </Typography>
            {process.env.NODE_ENV === 'development' && (
              <Typography variant="caption" component="pre" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {error?.stack}
              </Typography>
            )}
          </Paper>
        </Collapse>
      </Box>
    );
  };

  render() {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }
      
      return this.renderErrorFallback();
    }

    return children;
  }
}

// HOC for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Props
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;