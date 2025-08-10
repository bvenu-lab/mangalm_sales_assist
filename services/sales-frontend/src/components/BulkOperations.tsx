import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Checkbox,
  IconButton,
  Button,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Fade,
  Slide,
  Stack,
  Tooltip,
  Badge,
  LinearProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
  IndeterminateCheckBox as IndeterminateIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  Label as LabelIcon,
  Download as ExportIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
  PlayArrow as ExecuteIcon,
  ContentCopy as DuplicateIcon,
  Mail as EmailIcon,
  Merge as MergeIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Star as StarIcon,
  StarBorder as UnstarIcon,
} from '@mui/icons-material';
import { useNotification } from './notifications/NotificationSystem';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';

interface BulkOperation {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: (selectedIds: string[]) => Promise<void>;
  confirmRequired?: boolean;
  dangerous?: boolean;
  disabled?: (selectedIds: string[]) => boolean;
}

interface BulkOperationsProps {
  data: any[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  operations?: BulkOperation[];
  columns?: { key: string; label: string }[];
  resourceName?: string;
  onRefresh?: () => void;
}

/**
 * World-class Bulk Operations Component
 * Provides sophisticated multi-select and batch operations
 */
const BulkOperations: React.FC<BulkOperationsProps> = ({
  data,
  selectedIds,
  onSelectionChange,
  operations,
  columns = [],
  resourceName = 'items',
  onRefresh,
}) => {
  const theme = useTheme();
  const { notifySuccess, notifyError, notifyWarning } = useNotification();
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [processing, setProcessing] = useState(false);
  const [processingOperation, setProcessingOperation] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'none' | 'some' | 'all'>('none');

  // Default operations if none provided
  const defaultOperations: BulkOperation[] = [
    {
      id: 'export-csv',
      label: 'Export to CSV',
      icon: <ExportIcon />,
      action: async (ids) => {
        const selectedData = data.filter(item => ids.includes(item.id));
        exportToCSV(selectedData, columns, { filename: `${resourceName}_export` });
        notifySuccess(`Exported ${ids.length} ${resourceName} to CSV`);
      },
    },
    {
      id: 'export-excel',
      label: 'Export to Excel',
      icon: <ExportIcon />,
      action: async (ids) => {
        const selectedData = data.filter(item => ids.includes(item.id));
        exportToExcel(selectedData, columns, { filename: `${resourceName}_export` });
        notifySuccess(`Exported ${ids.length} ${resourceName} to Excel`);
      },
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <DuplicateIcon />,
      action: async (ids) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        notifySuccess(`Duplicated ${ids.length} ${resourceName}`);
        onRefresh?.();
      },
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <ArchiveIcon />,
      action: async (ids) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        notifySuccess(`Archived ${ids.length} ${resourceName}`);
        onRefresh?.();
      },
      confirmRequired: true,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <DeleteIcon />,
      action: async (ids) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        notifySuccess(`Deleted ${ids.length} ${resourceName}`);
        onRefresh?.();
      },
      confirmRequired: true,
      dangerous: true,
    },
  ];

  const allOperations = operations || defaultOperations;

  // Update selection mode
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectionMode('none');
    } else if (selectedIds.length === data.length) {
      setSelectionMode('all');
    } else {
      setSelectionMode('some');
    }
  }, [selectedIds, data]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectionMode === 'all') {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(item => item.id));
    }
  }, [selectionMode, data, onSelectionChange]);

  // Handle individual selection
  const handleSelectItem = useCallback((id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }, [selectedIds, onSelectionChange]);

  // Handle range selection (shift+click)
  const handleRangeSelect = useCallback((id: string, shiftKey: boolean) => {
    if (!shiftKey || selectedIds.length === 0) {
      handleSelectItem(id);
      return;
    }

    const lastSelectedIndex = data.findIndex(item => item.id === selectedIds[selectedIds.length - 1]);
    const currentIndex = data.findIndex(item => item.id === id);
    
    if (lastSelectedIndex === -1 || currentIndex === -1) {
      handleSelectItem(id);
      return;
    }

    const start = Math.min(lastSelectedIndex, currentIndex);
    const end = Math.max(lastSelectedIndex, currentIndex);
    
    const rangeIds = data.slice(start, end + 1).map(item => item.id);
    const newSelection = [...Array.from(new Set([...selectedIds, ...rangeIds]))];
    
    onSelectionChange(newSelection);
  }, [data, selectedIds, onSelectionChange, handleSelectItem]);

  // Execute operation
  const executeOperation = async (operation: BulkOperation) => {
    if (operation.disabled?.(selectedIds)) {
      notifyWarning(`This operation is not available for the selected ${resourceName}`);
      return;
    }

    if (operation.confirmRequired) {
      const confirmed = window.confirm(
        `Are you sure you want to ${operation.label.toLowerCase()} ${selectedIds.length} ${resourceName}?`
      );
      if (!confirmed) return;
    }

    setProcessing(true);
    setProcessingOperation(operation.id);
    setAnchorEl(null);

    try {
      await operation.action(selectedIds);
      
      // Clear selection after dangerous operations
      if (operation.dangerous) {
        onSelectionChange([]);
      }
    } catch (error) {
      notifyError(`Failed to ${operation.label.toLowerCase()} ${resourceName}`);
      console.error(error);
    } finally {
      setProcessing(false);
      setProcessingOperation(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Select all (Ctrl+A)
      if (e.ctrlKey && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        handleSelectAll();
      }
      
      // Clear selection (Escape)
      if (e.key === 'Escape' && selectedIds.length > 0) {
        e.preventDefault();
        onSelectionChange([]);
      }
      
      // Delete (Delete key)
      if (e.key === 'Delete' && selectedIds.length > 0) {
        const deleteOp = allOperations.find(op => op.id === 'delete');
        if (deleteOp) {
          executeOperation(deleteOp);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, handleSelectAll, onSelectionChange, allOperations]);

  // Quick actions for common operations
  const quickActions = allOperations.filter(op => 
    ['export-csv', 'duplicate', 'archive', 'delete'].includes(op.id)
  );

  const moreActions = allOperations.filter(op => 
    !quickActions.includes(op)
  );

  if (selectedIds.length === 0 && selectionMode === 'none') {
    return null;
  }

  return (
    <Slide direction="up" in={selectedIds.length > 0} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: theme.zIndex.speedDial,
          borderRadius: 2,
          overflow: 'hidden',
          minWidth: 400,
          maxWidth: '90vw',
        }}
      >
        {processing && (
          <LinearProgress 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0,
              height: 2,
            }} 
          />
        )}
        
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          }}
        >
          {/* Selection info */}
          <Stack direction="row" spacing={1} alignItems="center" flex={1}>
            <Checkbox
              checked={selectionMode === 'all'}
              indeterminate={selectionMode === 'some'}
              onChange={handleSelectAll}
              icon={<CheckBoxBlankIcon />}
              checkedIcon={<CheckBoxIcon />}
              indeterminateIcon={<IndeterminateIcon />}
              disabled={processing}
            />
            
            <Typography variant="body1" fontWeight={500}>
              {selectedIds.length} {resourceName} selected
            </Typography>
            
            {selectedIds.length > 0 && (
              <Chip
                label="Clear"
                size="small"
                onClick={() => onSelectionChange([])}
                onDelete={() => onSelectionChange([])}
                deleteIcon={<CloseIcon />}
                variant="outlined"
                disabled={processing}
              />
            )}
          </Stack>

          {/* Quick actions */}
          <Stack direction="row" spacing={1}>
            {quickActions.map(operation => (
              <Tooltip key={operation.id} title={operation.label}>
                <span>
                  <IconButton
                    onClick={() => executeOperation(operation)}
                    disabled={processing || operation.disabled?.(selectedIds)}
                    color={operation.dangerous ? 'error' : 'default'}
                    sx={{
                      bgcolor: operation.dangerous 
                        ? alpha(theme.palette.error.main, 0.1)
                        : alpha(theme.palette.action.active, 0.1),
                      '&:hover': {
                        bgcolor: operation.dangerous
                          ? alpha(theme.palette.error.main, 0.2)
                          : alpha(theme.palette.action.active, 0.2),
                      },
                    }}
                  >
                    {processingOperation === operation.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                        <LinearProgress sx={{ width: 16 }} />
                      </Box>
                    ) : (
                      operation.icon
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            ))}
            
            {/* More actions menu */}
            {moreActions.length > 0 && (
              <>
                <Divider orientation="vertical" flexItem />
                <IconButton
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  disabled={processing}
                >
                  <Badge badgeContent={moreActions.length} color="primary">
                    <MoreIcon />
                  </Badge>
                </IconButton>
              </>
            )}
          </Stack>
        </Box>

        {/* More actions menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          PaperProps={{
            sx: { minWidth: 200 },
          }}
        >
          {moreActions.map(operation => (
            <MenuItem
              key={operation.id}
              onClick={() => executeOperation(operation)}
              disabled={processing || operation.disabled?.(selectedIds)}
            >
              <ListItemIcon>
                {operation.icon}
              </ListItemIcon>
              <ListItemText>
                {operation.label}
              </ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Paper>
    </Slide>
  );
};

// Export selection hook for use in tables
export const useSelection = <T extends { id: string }>(data: T[]) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isSelected = (id: string) => selectedIds.includes(id);
  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(data.map(item => item.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const selectedItems = data.filter(item => selectedIds.includes(item.id));

  return {
    selectedIds,
    setSelectedIds,
    selectedItems,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
  };
};

export default BulkOperations;