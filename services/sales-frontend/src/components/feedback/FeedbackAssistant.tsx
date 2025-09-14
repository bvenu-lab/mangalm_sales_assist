import React, { useState, useEffect } from 'react';
import {
  Box,
  Fab,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  Chip,
  Fade,
  Zoom,
  Avatar,
  Divider,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';
import {
  SmartToy as AssistantIcon,
  Close as CloseIcon,
  Send as SendIcon,
  BugReport as BugIcon,
  Lightbulb as SuggestionIcon,
  ThumbUp as ImprovementIcon,
  Feedback as FeedbackIcon,
  CheckCircle as SuccessIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import apiGatewayClient from '../../services/api-gateway-client';

// Floating animation for the FAB
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

// Pulse animation for attention
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(33, 150, 243, 0); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
`;

interface FeedbackAssistantProps {
  userEmail?: string;
  userName?: string;
}

const FeedbackAssistant: React.FC<FeedbackAssistantProps> = ({
  userEmail = 'user@example.com',
  userName = 'User'
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'improvement' | 'suggestion' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);

  // Show welcome message briefly when first opened
  useEffect(() => {
    if (isOpen && showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showWelcome]);

  const handleOpen = () => {
    setIsOpen(true);
    setSubmitStatus('idle');
    setErrorMessage('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setFeedbackType(null);
    setFeedbackText('');
    setSubmitStatus('idle');
    setErrorMessage('');
  };

  const handleSubmit = async () => {
    if (!feedbackText.trim()) {
      setErrorMessage('Please enter your feedback before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await apiGatewayClient.post('/api/feedback/submit', {
        type: feedbackType || 'general',
        message: feedbackText,
        userEmail,
        userName,
        timestamp: new Date().toISOString(),
        source: 'dashboard',
        metadata: {
          url: window.location.href,
          userAgent: navigator.userAgent,
        }
      });

      console.log('[Feedback] Response received:', response);
      console.log('[Feedback] Response data:', response.data);
      console.log('[Feedback] Response success flag:', response.data?.success);

      if (response.data && response.data.success) {
        setSubmitStatus('success');
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        throw new Error(response.data?.error || 'Failed to send feedback');
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      setSubmitStatus('error');
      setErrorMessage(error.response?.data?.error || error.message || 'Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes = [
    { type: 'bug', label: 'Bug Report', icon: <BugIcon />, color: 'error' },
    { type: 'improvement', label: 'Improvement', icon: <ImprovementIcon />, color: 'info' },
    { type: 'suggestion', label: 'Suggestion', icon: <SuggestionIcon />, color: 'warning' },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <Zoom in={!isOpen} timeout={300}>
        <Fab
          color="primary"
          aria-label="feedback assistant"
          onClick={handleOpen}
          sx={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 1300,
            animation: `${float} 3s ease-in-out infinite`,
            '&:hover': {
              animation: `${pulse} 1s infinite`,
            },
            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
            boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)',
          }}
        >
          <AssistantIcon />
        </Fab>
      </Zoom>

      {/* Feedback Dialog */}
      <Fade in={isOpen} timeout={300}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            maxHeight: '80vh',
            display: isOpen ? 'flex' : 'none',
            flexDirection: 'column',
            zIndex: 1300,
            borderRadius: 3,
            overflow: 'hidden',
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar
                sx={{
                  bgcolor: 'white',
                  color: theme.palette.primary.main,
                  width: 36,
                  height: 36,
                }}
              >
                <SparkleIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Feedback Assistant
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Powered by AI
                </Typography>
              </Box>
            </Box>
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2.5 }}>
            {/* Welcome Message */}
            {showWelcome && submitStatus === 'idle' && (
              <Collapse in={showWelcome}>
                <Alert
                  severity="info"
                  icon={<FeedbackIcon />}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Welcome! I'm here to help.
                  </Typography>
                  <Typography variant="caption">
                    Share your feedback, report bugs, or suggest improvements.
                    Your input helps us make the app better for everyone!
                  </Typography>
                </Alert>
              </Collapse>
            )}

            {/* Success Message */}
            {submitStatus === 'success' && (
              <Alert
                severity="success"
                icon={<SuccessIcon />}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  Thank you for your feedback!
                </Typography>
                <Typography variant="caption">
                  We've received your message and will review it shortly.
                </Typography>
              </Alert>
            )}

            {/* Error Message */}
            {submitStatus === 'error' && errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
              </Alert>
            )}

            {/* Feedback Type Selection */}
            {submitStatus !== 'success' && (
              <>
                <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                  What type of feedback do you have?
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                  {feedbackTypes.map((type) => (
                    <Chip
                      key={type.type}
                      label={type.label}
                      icon={type.icon}
                      onClick={() => setFeedbackType(type.type as any)}
                      color={feedbackType === type.type ? type.color as any : 'default'}
                      variant={feedbackType === type.type ? 'filled' : 'outlined'}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 2,
                        }
                      }}
                    />
                  ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Feedback Text Area */}
                <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                  Tell us more:
                </Typography>
                <TextField
                  multiline
                  rows={4}
                  fullWidth
                  variant="outlined"
                  placeholder={
                    feedbackType === 'bug'
                      ? "Describe the issue you're experiencing..."
                      : feedbackType === 'improvement'
                      ? "What could we improve?..."
                      : feedbackType === 'suggestion'
                      ? "Share your ideas with us..."
                      : "Share your thoughts..."
                  }
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  disabled={isSubmitting}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: theme.palette.primary.main,
                      },
                    },
                  }}
                />

                {/* Character Count */}
                <Box display="flex" justifyContent="flex-end" mt={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {feedbackText.length} / 500 characters
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Footer Actions */}
          {submitStatus !== 'success' && (
            <Box
              sx={{
                p: 2,
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Your feedback will be sent to our team
              </Typography>
              <Button
                variant="contained"
                endIcon={isSubmitting ? <CircularProgress size={16} /> : <SendIcon />}
                onClick={handleSubmit}
                disabled={isSubmitting || !feedbackText.trim()}
                sx={{
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                  boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)',
                }}
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </Button>
            </Box>
          )}
        </Paper>
      </Fade>
    </>
  );
};

export default FeedbackAssistant;