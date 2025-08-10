import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  IconButton,
  Chip,
  Stack,
  Typography,
  Collapse,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Slider,
  Switch,
  FormControlLabel,
  Popover,
  Divider,
  Badge,
  Tooltip,
  Grid,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';

type FilterOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

interface FilterField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'range';
  operators?: FilterOperator[];
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
}

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  value2?: any; // For 'between' operator
}

interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
  groups?: FilterGroup[];
}

interface SavedFilter {
  id: string;
  name: string;
  filter: FilterGroup;
  isDefault?: boolean;
  createdAt: Date;
}

interface AdvancedFilterProps {
  fields: FilterField[];
  onFilterChange: (filter: FilterGroup | null) => void;
  onSearch?: (query: string) => void;
  savedFilters?: SavedFilter[];
  onSaveFilter?: (name: string, filter: FilterGroup) => void;
  onDeleteSavedFilter?: (id: string) => void;
}

/**
 * World-class Advanced Filter Component
 * Sophisticated filtering with multiple conditions and groups
 */
const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  fields,
  onFilterChange,
  onSearch,
  savedFilters = [],
  onSaveFilter,
  onDeleteSavedFilter,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: generateId(),
    logic: 'AND',
    conditions: [],
  });
  const [savedFilterAnchor, setSavedFilterAnchor] = useState<null | HTMLElement>(null);
  const [filterName, setFilterName] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // Get operators for field type
  const getOperatorsForField = (field: FilterField): FilterOperator[] => {
    if (field.operators) return field.operators;

    switch (field.type) {
      case 'text':
        return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'];
      case 'number':
      case 'date':
        return ['equals', 'not_equals', 'greater_than', 'less_than', 'between', 'is_empty', 'is_not_empty'];
      case 'select':
        return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
      case 'multiselect':
        return ['in', 'not_in', 'is_empty', 'is_not_empty'];
      case 'boolean':
        return ['equals'];
      case 'range':
        return ['between'];
      default:
        return ['equals', 'not_equals'];
    }
  };

  // Get operator label
  const getOperatorLabel = (operator: FilterOperator): string => {
    const labels: Record<FilterOperator, string> = {
      equals: 'Equals',
      not_equals: 'Not equals',
      contains: 'Contains',
      not_contains: 'Does not contain',
      starts_with: 'Starts with',
      ends_with: 'Ends with',
      greater_than: 'Greater than',
      less_than: 'Less than',
      between: 'Between',
      in: 'In',
      not_in: 'Not in',
      is_empty: 'Is empty',
      is_not_empty: 'Is not empty',
    };
    return labels[operator] || operator;
  };

  // Generate unique ID
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add condition
  const addCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: generateId(),
      field: fields[0].name,
      operator: getOperatorsForField(fields[0])[0],
      value: '',
    };

    setFilterGroup(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
  }, [fields]);

  // Update condition
  const updateCondition = useCallback((conditionId: string, updates: Partial<FilterCondition>) => {
    setFilterGroup(prev => ({
      ...prev,
      conditions: prev.conditions.map(condition =>
        condition.id === conditionId
          ? { ...condition, ...updates }
          : condition
      ),
    }));
  }, []);

  // Remove condition
  const removeCondition = useCallback((conditionId: string) => {
    setFilterGroup(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== conditionId),
    }));
  }, []);

  // Toggle logic
  const toggleLogic = useCallback(() => {
    setFilterGroup(prev => ({
      ...prev,
      logic: prev.logic === 'AND' ? 'OR' : 'AND',
    }));
  }, []);

  // Apply filter
  useEffect(() => {
    if (filterGroup.conditions.length > 0) {
      onFilterChange(filterGroup);
    } else {
      onFilterChange(null);
    }
  }, [filterGroup, onFilterChange]);

  // Handle search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch?.(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterGroup({
      id: generateId(),
      logic: 'AND',
      conditions: [],
    });
    setSearchQuery('');
    setActiveFilterId(null);
  }, []);

  // Save current filter
  const saveCurrentFilter = useCallback(() => {
    if (filterName && onSaveFilter) {
      onSaveFilter(filterName, filterGroup);
      setFilterName('');
      setSavedFilterAnchor(null);
    }
  }, [filterName, filterGroup, onSaveFilter]);

  // Load saved filter
  const loadSavedFilter = useCallback((filter: SavedFilter) => {
    setFilterGroup(filter.filter);
    setActiveFilterId(filter.id);
    setSavedFilterAnchor(null);
  }, []);

  // Get active filters count
  const activeFiltersCount = filterGroup.conditions.length;

  // Render condition value input
  const renderValueInput = (condition: FilterCondition, field: FilterField) => {
    const needsValue = !['is_empty', 'is_not_empty'].includes(condition.operator);

    if (!needsValue) return null;

    switch (field.type) {
      case 'text':
        return (
          <TextField
            size="small"
            value={condition.value || ''}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            placeholder="Value"
            sx={{ minWidth: 150 }}
          />
        );

      case 'number':
        return condition.operator === 'between' ? (
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              value={condition.value || ''}
              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
              placeholder="Min"
              sx={{ width: 100 }}
            />
            <Typography>to</Typography>
            <TextField
              size="small"
              type="number"
              value={condition.value2 || ''}
              onChange={(e) => updateCondition(condition.id, { value2: e.target.value })}
              placeholder="Max"
              sx={{ width: 100 }}
            />
          </Stack>
        ) : (
          <TextField
            size="small"
            type="number"
            value={condition.value || ''}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            placeholder="Value"
            sx={{ minWidth: 150 }}
          />
        );

      case 'select':
        return (
          <Select
            size="small"
            value={condition.value || ''}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            sx={{ minWidth: 150 }}
          >
            {field.options?.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        );

      case 'multiselect':
        return (
          <Autocomplete
            multiple
            size="small"
            options={field.options || []}
            getOptionLabel={(option) => option.label}
            value={condition.value || []}
            onChange={(_, value) => updateCondition(condition.id, { value })}
            renderInput={(params) => <TextField {...params} placeholder="Select..." />}
            sx={{ minWidth: 200 }}
          />
        );

      case 'boolean':
        return (
          <Select
            size="small"
            value={condition.value || false}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
          </Select>
        );

      case 'range':
        return (
          <Box sx={{ width: 200, px: 2 }}>
            <Slider
              value={[condition.value || field.min || 0, condition.value2 || field.max || 100]}
              onChange={(_, value) => {
                const [min, max] = value as number[];
                updateCondition(condition.id, { value: min, value2: max });
              }}
              min={field.min || 0}
              max={field.max || 100}
              valueLabelDisplay="auto"
            />
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Search bar */}
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
              endAdornment: searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />

          <Tooltip title="Advanced filters">
            <IconButton
              onClick={() => setIsExpanded(!isExpanded)}
              color={activeFiltersCount > 0 ? 'primary' : 'default'}
            >
              <Badge badgeContent={activeFiltersCount} color="primary">
                <FilterIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Saved filters">
            <IconButton
              onClick={(e) => setSavedFilterAnchor(e.currentTarget)}
              color={activeFilterId ? 'primary' : 'default'}
            >
              {activeFilterId ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
          </Tooltip>

          {activeFiltersCount > 0 && (
            <Button
              size="small"
              onClick={clearFilters}
              startIcon={<ClearIcon />}
            >
              Clear
            </Button>
          )}
        </Stack>

        {/* Active filter chips */}
        {activeFiltersCount > 0 && !isExpanded && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {filterGroup.conditions.map(condition => {
              const field = fields.find(f => f.name === condition.field);
              return (
                <Chip
                  key={condition.id}
                  label={`${field?.label}: ${getOperatorLabel(condition.operator)} ${condition.value}`}
                  onDelete={() => removeCondition(condition.id)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              );
            })}
          </Stack>
        )}

        {/* Advanced filters */}
        <Collapse in={isExpanded}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            {/* Logic selector */}
            {filterGroup.conditions.length > 1 && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Match</Typography>
                <Button
                  size="small"
                  variant={filterGroup.logic === 'AND' ? 'contained' : 'outlined'}
                  onClick={toggleLogic}
                >
                  ALL
                </Button>
                <Typography variant="body2">or</Typography>
                <Button
                  size="small"
                  variant={filterGroup.logic === 'OR' ? 'contained' : 'outlined'}
                  onClick={toggleLogic}
                >
                  ANY
                </Button>
                <Typography variant="body2">of the following:</Typography>
              </Stack>
            )}

            {/* Filter conditions */}
            <Stack spacing={1}>
              {filterGroup.conditions.map((condition, index) => {
                const field = fields.find(f => f.name === condition.field)!;
                return (
                  <Stack key={condition.id} direction="row" spacing={1} alignItems="center">
                    {index > 0 && (
                      <Chip
                        label={filterGroup.logic}
                        size="small"
                        sx={{ width: 50 }}
                      />
                    )}

                    <Select
                      size="small"
                      value={condition.field}
                      onChange={(e) => {
                        const newField = fields.find(f => f.name === e.target.value)!;
                        updateCondition(condition.id, {
                          field: e.target.value,
                          operator: getOperatorsForField(newField)[0],
                          value: '',
                        });
                      }}
                      sx={{ minWidth: 150 }}
                    >
                      {fields.map(f => (
                        <MenuItem key={f.name} value={f.name}>
                          {f.label}
                        </MenuItem>
                      ))}
                    </Select>

                    <Select
                      size="small"
                      value={condition.operator}
                      onChange={(e) => updateCondition(condition.id, { operator: e.target.value as FilterOperator })}
                      sx={{ minWidth: 140 }}
                    >
                      {getOperatorsForField(field).map(op => (
                        <MenuItem key={op} value={op}>
                          {getOperatorLabel(op)}
                        </MenuItem>
                      ))}
                    </Select>

                    {renderValueInput(condition, field)}

                    <IconButton
                      size="small"
                      onClick={() => removeCondition(condition.id)}
                      color="error"
                    >
                      <RemoveIcon />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>

            {/* Add condition button */}
            <Button
              startIcon={<AddIcon />}
              onClick={addCondition}
              variant="outlined"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            >
              Add Condition
            </Button>
          </Stack>
        </Collapse>
      </Stack>

      {/* Saved filters popover */}
      <Popover
        open={Boolean(savedFilterAnchor)}
        anchorEl={savedFilterAnchor}
        onClose={() => setSavedFilterAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="subtitle2" gutterBottom>
            Saved Filters
          </Typography>
          
          {onSaveFilter && filterGroup.conditions.length > 0 && (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Filter name"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  fullWidth
                />
                <IconButton
                  size="small"
                  onClick={saveCurrentFilter}
                  disabled={!filterName}
                  color="primary"
                >
                  <SaveIcon />
                </IconButton>
              </Stack>
              <Divider sx={{ mb: 2 }} />
            </>
          )}

          {savedFilters.length > 0 ? (
            <Stack spacing={1}>
              {savedFilters.map(filter => (
                <Stack
                  key={filter.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: activeFilterId === filter.id ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                  onClick={() => loadSavedFilter(filter)}
                >
                  <Box flex={1}>
                    <Typography variant="body2">{filter.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {filter.filter.conditions.length} conditions
                    </Typography>
                  </Box>
                  {onDeleteSavedFilter && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSavedFilter(filter.id);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No saved filters
            </Typography>
          )}
        </Box>
      </Popover>
    </Paper>
  );
};

export default AdvancedFilter;