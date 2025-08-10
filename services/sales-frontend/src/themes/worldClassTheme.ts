import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';

/**
 * World-class Theme System
 * Professional, accessible, and beautiful
 */

// Color palettes
const colors = {
  primary: {
    main: '#2563eb', // Modern blue
    light: '#60a5fa',
    dark: '#1e40af',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#7c3aed', // Vibrant purple
    light: '#a78bfa',
    dark: '#5b21b6',
    contrastText: '#ffffff',
  },
  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    contrastText: '#ffffff',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    contrastText: '#ffffff',
  },
  info: {
    main: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
    contrastText: '#ffffff',
  },
};

// Typography configuration
const typography = {
  fontFamily: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  button: {
    textTransform: 'none' as const,
    fontWeight: 500,
  },
};

// Shadows with more depth
const createShadows = (mode: 'light' | 'dark') => {
  const shadowColor = mode === 'light' 
    ? 'rgba(0, 0, 0, 0.1)' 
    : 'rgba(0, 0, 0, 0.3)';
  
  return [
    'none',
    `0 1px 2px 0 ${shadowColor}`,
    `0 1px 3px 0 ${shadowColor}, 0 1px 2px -1px ${shadowColor}`,
    `0 1px 4px 0 ${shadowColor}, 0 2px 2px -1px ${shadowColor}`,
    `0 2px 8px 0 ${shadowColor}, 0 2px 4px -1px ${shadowColor}`,
    `0 3px 10px 0 ${shadowColor}, 0 3px 5px -1px ${shadowColor}`,
    `0 4px 12px 0 ${shadowColor}, 0 4px 6px -1px ${shadowColor}`,
    `0 5px 14px 0 ${shadowColor}, 0 5px 7px -1px ${shadowColor}`,
    `0 6px 16px 0 ${shadowColor}, 0 6px 8px -1px ${shadowColor}`,
    `0 7px 18px 0 ${shadowColor}, 0 7px 9px -1px ${shadowColor}`,
    `0 8px 20px 0 ${shadowColor}, 0 8px 10px -1px ${shadowColor}`,
    `0 9px 22px 0 ${shadowColor}, 0 9px 11px -1px ${shadowColor}`,
    `0 10px 24px 0 ${shadowColor}, 0 10px 12px -1px ${shadowColor}`,
    `0 11px 26px 0 ${shadowColor}, 0 11px 13px -1px ${shadowColor}`,
    `0 12px 28px 0 ${shadowColor}, 0 12px 14px -1px ${shadowColor}`,
    `0 13px 30px 0 ${shadowColor}, 0 13px 15px -1px ${shadowColor}`,
    `0 14px 32px 0 ${shadowColor}, 0 14px 16px -1px ${shadowColor}`,
    `0 15px 34px 0 ${shadowColor}, 0 15px 17px -1px ${shadowColor}`,
    `0 16px 36px 0 ${shadowColor}, 0 16px 18px -1px ${shadowColor}`,
    `0 17px 38px 0 ${shadowColor}, 0 17px 19px -1px ${shadowColor}`,
    `0 18px 40px 0 ${shadowColor}, 0 18px 20px -1px ${shadowColor}`,
    `0 20px 44px 0 ${shadowColor}, 0 20px 22px -1px ${shadowColor}`,
    `0 22px 48px 0 ${shadowColor}, 0 22px 24px -1px ${shadowColor}`,
    `0 24px 52px 0 ${shadowColor}, 0 24px 26px -1px ${shadowColor}`,
    `0 26px 56px 0 ${shadowColor}, 0 26px 28px -1px ${shadowColor}`,
  ] as any;
};

// Light theme configuration
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    ...colors,
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      disabled: '#94a3b8',
    },
    divider: '#e2e8f0',
    action: {
      active: colors.primary.main,
      hover: alpha(colors.primary.main, 0.08),
      selected: alpha(colors.primary.main, 0.12),
      disabled: '#94a3b8',
      disabledBackground: '#f1f5f9',
    },
  },
  typography,
  shadows: createShadows('light'),
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: '0.875rem',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
          },
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-1px)',
            transition: 'all 0.2s ease',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'box-shadow 0.3s ease',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover fieldset': {
              borderColor: colors.primary.main,
            },
            '&.Mui-focused fieldset': {
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b',
          fontSize: '0.75rem',
          borderRadius: 6,
          padding: '6px 12px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #f1f5f9',
        },
        head: {
          backgroundColor: '#f8fafc',
          fontWeight: 600,
          color: '#475569',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        },
        elevation2: {
          boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#e2e8f0',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 2,
          '&:hover': {
            backgroundColor: alpha(colors.primary.main, 0.08),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.main, 0.12),
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.16),
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        standardSuccess: {
          backgroundColor: alpha(colors.success.main, 0.12),
          color: colors.success.dark,
        },
        standardError: {
          backgroundColor: alpha(colors.error.main, 0.12),
          color: colors.error.dark,
        },
        standardWarning: {
          backgroundColor: alpha(colors.warning.main, 0.12),
          color: colors.warning.dark,
        },
        standardInfo: {
          backgroundColor: alpha(colors.info.main, 0.12),
          color: colors.info.dark,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: '#f1f5f9',
        },
      },
    },
  },
} as ThemeOptions);

// Dark theme configuration
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    ...colors,
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      disabled: '#64748b',
    },
    divider: '#334155',
    action: {
      active: colors.primary.light,
      hover: alpha(colors.primary.light, 0.12),
      selected: alpha(colors.primary.light, 0.16),
      disabled: '#64748b',
      disabledBackground: '#1e293b',
    },
  },
  typography,
  shadows: createShadows('dark'),
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: '0.875rem',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
          },
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-1px)',
            transition: 'all 0.2s ease',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#1e293b',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.3)',
            transition: 'box-shadow 0.3s ease',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover fieldset': {
              borderColor: colors.primary.light,
            },
            '&.Mui-focused fieldset': {
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#334155',
          fontSize: '0.75rem',
          borderRadius: 6,
          padding: '6px 12px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #334155',
        },
        head: {
          backgroundColor: '#1e293b',
          fontWeight: 600,
          color: '#cbd5e1',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e293b',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        },
        elevation2: {
          boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
          color: '#f1f5f9',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#334155',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 2,
          '&:hover': {
            backgroundColor: alpha(colors.primary.light, 0.12),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.light, 0.16),
            '&:hover': {
              backgroundColor: alpha(colors.primary.light, 0.20),
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: '#334155',
        },
      },
    },
  },
} as ThemeOptions);

// Theme provider hook
export const useWorldClassTheme = (mode: 'light' | 'dark' = 'light') => {
  return mode === 'dark' ? darkTheme : lightTheme;
};