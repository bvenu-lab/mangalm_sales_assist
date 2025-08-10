import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Box,
  Chip,
  InputAdornment,
  Paper,
  Fade,
  Zoom,
  IconButton,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Dashboard as DashboardIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  ShoppingCart as OrderIcon,
  TrendingUp as PerformanceIcon,
  Person as ProfileIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Help as HelpIcon,
  Keyboard as KeyboardIcon,
  Close as CloseIcon,
  ArrowForward as ArrowIcon,
  History as HistoryIcon,
  Star as StarIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
  shortcut?: string;
  action: () => void;
  recent?: boolean;
  favorite?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions?: CommandAction[];
}

/**
 * World-class Command Palette Component
 * Provides quick access to all app features
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  actions = [],
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [favoriteActions, setFavoriteActions] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Default actions if none provided
  const defaultActions: CommandAction[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View main dashboard',
      icon: <DashboardIcon />,
      category: 'Navigation',
      keywords: ['home', 'main', 'overview'],
      shortcut: 'Alt+D',
      action: () => {
        window.location.href = '/dashboard';
        onClose();
      },
    },
    {
      id: 'stores',
      label: 'Stores',
      description: 'Browse and manage stores',
      icon: <StoreIcon />,
      category: 'Navigation',
      keywords: ['shops', 'retailers', 'customers'],
      shortcut: 'Alt+S',
      action: () => {
        window.location.href = '/stores';
        onClose();
      },
    },
    {
      id: 'calls',
      label: 'Call List',
      description: 'View prioritized calls',
      icon: <PhoneIcon />,
      category: 'Navigation',
      keywords: ['phone', 'contact', 'priority'],
      shortcut: 'Alt+C',
      action: () => {
        window.location.href = '/calls';
        onClose();
      },
    },
    {
      id: 'orders',
      label: 'Orders',
      description: 'Manage orders and history',
      icon: <OrderIcon />,
      category: 'Navigation',
      keywords: ['sales', 'purchases', 'transactions'],
      shortcut: 'Alt+O',
      action: () => {
        window.location.href = '/orders';
        onClose();
      },
    },
    {
      id: 'performance',
      label: 'Performance',
      description: 'View performance metrics',
      icon: <PerformanceIcon />,
      category: 'Navigation',
      keywords: ['metrics', 'analytics', 'stats', 'charts'],
      shortcut: 'Alt+P',
      action: () => {
        window.location.href = '/performance';
        onClose();
      },
    },
    {
      id: 'new-order',
      label: 'Create New Order',
      description: 'Start a new order',
      icon: <AddIcon />,
      category: 'Actions',
      keywords: ['add', 'new', 'create', 'order'],
      shortcut: 'Ctrl+N',
      action: () => {
        window.location.href = '/orders/create';
        onClose();
      },
    },
    {
      id: 'profile',
      label: 'Profile',
      description: 'View your profile',
      icon: <ProfileIcon />,
      category: 'Navigation',
      keywords: ['account', 'settings', 'user'],
      action: () => {
        window.location.href = '/profile';
        onClose();
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Application settings',
      icon: <SettingsIcon />,
      category: 'System',
      keywords: ['preferences', 'config', 'options'],
      action: () => {
        window.location.href = '/settings';
        onClose();
      },
    },
    {
      id: 'refresh',
      label: 'Refresh Page',
      description: 'Reload current page',
      icon: <RefreshIcon />,
      category: 'Actions',
      keywords: ['reload', 'refresh', 'update'],
      shortcut: 'Ctrl+Shift+R',
      action: () => {
        window.location.reload();
        onClose();
      },
    },
    {
      id: 'help',
      label: 'Help',
      description: 'Open help documentation',
      icon: <HelpIcon />,
      category: 'System',
      keywords: ['docs', 'documentation', 'support'],
      shortcut: 'F1',
      action: () => {
        window.open('/help', '_blank');
        onClose();
      },
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: <KeyboardIcon />,
      category: 'System',
      keywords: ['keys', 'hotkeys', 'shortcuts'],
      shortcut: 'Shift+?',
      action: () => {
        // Open shortcuts modal
        onClose();
      },
    },
  ];

  const allActions = actions.length > 0 ? actions : defaultActions;

  // Load recent and favorite actions from localStorage
  useEffect(() => {
    const stored = {
      recent: JSON.parse(localStorage.getItem('commandPalette_recent') || '[]'),
      favorites: JSON.parse(localStorage.getItem('commandPalette_favorites') || '[]'),
    };
    setRecentActions(stored.recent);
    setFavoriteActions(stored.favorites);
  }, []);

  // Filter actions based on search query
  const filteredActions = useMemo(() => {
    if (!searchQuery) {
      // Show favorites and recent when no search
      const favs = allActions.filter(a => favoriteActions.includes(a.id));
      const recent = allActions.filter(a => recentActions.includes(a.id) && !favoriteActions.includes(a.id));
      const others = allActions.filter(a => !recentActions.includes(a.id) && !favoriteActions.includes(a.id));
      return [...favs, ...recent, ...others];
    }

    const query = searchQuery.toLowerCase();
    return allActions.filter(action => {
      const searchableText = [
        action.label,
        action.description,
        action.category,
        ...(action.keywords || []),
      ].join(' ').toLowerCase();
      
      // Fuzzy matching
      const words = query.split(' ');
      return words.every(word => searchableText.includes(word));
    }).sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.label.toLowerCase().startsWith(query);
      const bExact = b.label.toLowerCase().startsWith(query);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then favorites
      const aFav = favoriteActions.includes(a.id);
      const bFav = favoriteActions.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      
      // Then recent
      const aRecent = recentActions.indexOf(a.id);
      const bRecent = recentActions.indexOf(b.id);
      if (aRecent >= 0 && bRecent < 0) return -1;
      if (aRecent < 0 && bRecent >= 0) return 1;
      if (aRecent >= 0 && bRecent >= 0) return aRecent - bRecent;
      
      return 0;
    });
  }, [searchQuery, allActions, recentActions, favoriteActions]);

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    
    filteredActions.forEach(action => {
      let category = 'Other';
      
      if (favoriteActions.includes(action.id)) {
        category = '⭐ Favorites';
      } else if (recentActions.includes(action.id) && !searchQuery) {
        category = '🕐 Recent';
      } else if (action.category) {
        category = action.category;
      }
      
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(action);
    });
    
    // Sort categories
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      if (a.includes('Favorites')) return -1;
      if (b.includes('Favorites')) return 1;
      if (a.includes('Recent')) return -1;
      if (b.includes('Recent')) return 1;
      return a.localeCompare(b);
    });
    
    return sortedCategories.map(cat => ({
      category: cat,
      actions: groups[cat],
    }));
  }, [filteredActions, favoriteActions, recentActions, searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredActions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredActions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredActions[selectedIndex]) {
            executeAction(filteredActions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredActions, onClose]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredActions[selectedIndex]) {
      const element = listRef.current.querySelector(`[data-action-index="${selectedIndex}"]`);
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, filteredActions]);

  // Execute action and update recent
  const executeAction = (action: CommandAction) => {
    // Update recent actions
    const newRecent = [action.id, ...recentActions.filter(id => id !== action.id)].slice(0, 5);
    setRecentActions(newRecent);
    localStorage.setItem('commandPalette_recent', JSON.stringify(newRecent));
    
    // Execute the action
    action.action();
  };

  // Toggle favorite
  const toggleFavorite = (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favoriteActions.includes(actionId)
      ? favoriteActions.filter(id => id !== actionId)
      : [...favoriteActions, actionId];
    setFavoriteActions(newFavorites);
    localStorage.setItem('commandPalette_favorites', JSON.stringify(newFavorites));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Zoom}
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh',
          bgcolor: theme.palette.background.paper,
          boxShadow: theme.shadows[24],
        },
      }}
    >
      <Box sx={{ p: 2, pb: 0 }}>
        <TextField
          ref={searchInputRef}
          fullWidth
          placeholder="Type a command or search..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Chip
                  label="ESC"
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              </InputAdornment>
            ),
            sx: {
              fontSize: '1.1rem',
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none',
              },
            },
          }}
          autoComplete="off"
        />
        <Divider sx={{ mt: 2 }} />
      </Box>

      <DialogContent sx={{ p: 0, maxHeight: '60vh', overflowY: 'auto' }} ref={listRef}>
        {filteredActions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No commands found for "{searchQuery}"
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 1 }}>
            {groupedActions.map(group => (
              <Box key={group.category}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 2, py: 1, display: 'block', fontWeight: 600 }}
                >
                  {group.category}
                </Typography>
                {group.actions.map((action, index) => {
                  const globalIndex = filteredActions.indexOf(action);
                  const isSelected = globalIndex === selectedIndex;
                  
                  return (
                    <ListItem
                      key={action.id}
                      data-action-index={globalIndex}
                      onClick={() => executeAction(action)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      sx={{
                        borderRadius: 1,
                        mx: 1,
                        cursor: 'pointer',
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {action.icon || <ArrowIcon />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight={isSelected ? 500 : 400}>
                            {action.label}
                          </Typography>
                        }
                        secondary={action.description}
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {action.shortcut && (
                            <Chip
                              label={action.shortcut}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 22 }}
                            />
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => toggleFavorite(action.id, e)}
                            sx={{ opacity: favoriteActions.includes(action.id) ? 1 : 0.3 }}
                          >
                            <StarIcon fontSize="small" color={favoriteActions.includes(action.id) ? 'warning' : 'action'} />
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </Box>
            ))}
          </List>
        )}
      </DialogContent>

      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label="↑↓ Navigate" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
          <Chip label="↵ Select" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
          <Chip label="⭐ Favorite" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {filteredActions.length} commands
        </Typography>
      </Box>
    </Dialog>
  );
};

export default CommandPalette;