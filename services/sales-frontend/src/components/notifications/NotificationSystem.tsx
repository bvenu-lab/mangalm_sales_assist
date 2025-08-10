import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Slide,
  Grow,
  Zoom,
  Fade,
  Stack,
  Button,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  position?: NotificationPosition;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  persistent?: boolean;
  progress?: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notify: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  notifySuccess: (message: string, title?: string) => void;
  notifyError: (message: string, title?: string) => void;
  notifyWarning: (message: string, title?: string) => void;
  notifyInfo: (message: string, title?: string) => void;
  clearAll: () => void;
  notifications: Notification[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

// Custom transition components
const SlideTransition = React.forwardRef<unknown, TransitionProps>((props, ref) => 
  <Slide ref={ref} {...props} direction="up" />
);
const GrowTransition = React.forwardRef<unknown, TransitionProps>((props, ref) => 
  <Grow ref={ref} {...props} />
);
const ZoomTransition = React.forwardRef<unknown, TransitionProps>((props, ref) => 
  <Zoom ref={ref} {...props} />
);
const FadeTransition = React.forwardRef<unknown, TransitionProps>((props, ref) => 
  <Fade ref={ref} {...props} />
);

const transitions = {
  slide: SlideTransition,
  grow: GrowTransition,
  zoom: ZoomTransition,
  fade: FadeTransition,
};

interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
  defaultPosition?: NotificationPosition;
  transition?: keyof typeof transitions;
  preventDuplicates?: boolean;
}

/**
 * Enterprise Notification System Provider
 * Provides global notification functionality with advanced features
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
  defaultDuration = 5000,
  defaultPosition = 'top-right',
  transition = 'slide',
  preventDuplicates = true,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [queue, setQueue] = useState<Notification[]>([]);

  // Process queue when space becomes available
  useEffect(() => {
    if (notifications.length < maxNotifications && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setNotifications(prev => [...prev, next]);
    }
  }, [notifications.length, queue, maxNotifications]);

  // Generate unique ID
  const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add notification
  const notify = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      duration: notification.persistent ? undefined : (notification.duration || defaultDuration),
      position: notification.position || defaultPosition,
    };

    // Check for duplicates
    if (preventDuplicates) {
      const isDuplicate = notifications.some(n => 
        n.message === newNotification.message && 
        n.type === newNotification.type
      );
      if (isDuplicate) return;
    }

    // Add to queue if at max capacity
    if (notifications.length >= maxNotifications) {
      setQueue(prev => [...prev, newNotification]);
    } else {
      setNotifications(prev => [...prev, newNotification]);
    }

    // Auto-remove after duration
    if (!notification.persistent && newNotification.duration) {
      setTimeout(() => {
        handleClose(newNotification.id);
      }, newNotification.duration);
    }
  }, [notifications, defaultDuration, defaultPosition, maxNotifications, preventDuplicates]);

  // Convenience methods
  const notifySuccess = useCallback((message: string, title?: string) => {
    notify({ type: 'success', message, title });
  }, [notify]);

  const notifyError = useCallback((message: string, title?: string) => {
    notify({ type: 'error', message, title, duration: 10000 }); // Errors stay longer
  }, [notify]);

  const notifyWarning = useCallback((message: string, title?: string) => {
    notify({ type: 'warning', message, title });
  }, [notify]);

  const notifyInfo = useCallback((message: string, title?: string) => {
    notify({ type: 'info', message, title });
  }, [notify]);

  // Handle close
  const handleClose = useCallback((id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification?.onClose) {
        notification.onClose();
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setQueue([]);
  }, []);

  // Get icon for notification type
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <SuccessIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
    }
  };

  // Get position styles
  const getPositionStyles = (position: NotificationPosition) => {
    const styles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
    };

    switch (position) {
      case 'top-left':
        return { ...styles, top: 20, left: 20 };
      case 'top-center':
        return { ...styles, top: 20, left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { ...styles, top: 20, right: 20 };
      case 'bottom-left':
        return { ...styles, bottom: 20, left: 20 };
      case 'bottom-center':
        return { ...styles, bottom: 20, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':
        return { ...styles, bottom: 20, right: 20 };
    }
  };

  // Group notifications by position
  const groupedNotifications = notifications.reduce((acc, notification) => {
    const pos = notification.position || defaultPosition;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(notification);
    return acc;
  }, {} as Record<NotificationPosition, Notification[]>);

  const TransitionComponent = transitions[transition];

  return (
    <NotificationContext.Provider
      value={{
        notify,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
        clearAll,
        notifications,
      }}
    >
      {children}
      
      {/* Render notifications grouped by position */}
      {Object.entries(groupedNotifications).map(([position, positionNotifications]) => (
        <Box
          key={position}
          sx={getPositionStyles(position as NotificationPosition)}
        >
          <Stack spacing={1} sx={{ width: 350 }}>
            {positionNotifications.map((notification) => (
              <Snackbar
                key={notification.id}
                open={true}
                TransitionComponent={TransitionComponent}
                sx={{ position: 'relative', width: '100%' }}
              >
                <Alert
                  severity={notification.type}
                  icon={getIcon(notification.type)}
                  action={
                    <>
                      {notification.action && (
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => {
                            notification.action!.onClick();
                            handleClose(notification.id);
                          }}
                        >
                          {notification.action.label}
                        </Button>
                      )}
                      {!notification.persistent && (
                        <IconButton
                          size="small"
                          color="inherit"
                          onClick={() => handleClose(notification.id)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </>
                  }
                  sx={{
                    width: '100%',
                    boxShadow: 4,
                    '& .MuiAlert-icon': {
                      fontSize: '1.5rem',
                    },
                  }}
                >
                  {notification.title && (
                    <AlertTitle sx={{ fontWeight: 'bold' }}>
                      {notification.title}
                    </AlertTitle>
                  )}
                  <Typography variant="body2">
                    {notification.message}
                  </Typography>
                  {notification.progress && (
                    <LinearProgress
                      color={notification.type === 'error' ? 'error' : 'primary'}
                      sx={{ mt: 1, mb: -1 }}
                    />
                  )}
                  {!notification.persistent && notification.duration && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 0.5,
                        opacity: 0.7,
                      }}
                    >
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
                </Alert>
              </Snackbar>
            ))}
          </Stack>
        </Box>
      ))}

      {/* Queue indicator */}
      {queue.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
          }}
        >
          <Alert
            severity="info"
            icon={<RefreshIcon />}
            sx={{ boxShadow: 4 }}
          >
            {queue.length} notification{queue.length > 1 ? 's' : ''} in queue
          </Alert>
        </Box>
      )}
    </NotificationContext.Provider>
  );
};

// Export hook for easy usage
export default NotificationProvider;