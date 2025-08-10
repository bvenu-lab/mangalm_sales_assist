import React from 'react';
import {
  Box,
  Skeleton,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';

interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'list' | 'dashboard' | 'form' | 'chart' | 'profile' | 'custom';
  rows?: number;
  columns?: number;
  height?: number | string;
  animation?: 'wave' | 'pulse' | false;
  children?: React.ReactNode;
}

/**
 * Enterprise Loading Skeleton Component
 * Provides sophisticated loading states for better UX
 */
const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  rows = 5,
  columns = 4,
  height = 'auto',
  animation = 'wave',
  children,
}) => {
  const theme = useTheme();

  // Dashboard skeleton
  const DashboardSkeleton = () => (
    <Box p={3}>
      {/* Header */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Skeleton variant="text" width={300} height={40} animation={animation} />
          <Skeleton variant="text" width={200} height={20} animation={animation} />
        </Box>
        <Skeleton variant="rectangular" width={120} height={40} animation={animation} />
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} mb={4}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Skeleton variant="circular" width={40} height={40} animation={animation} />
                  <Skeleton variant="text" width={60} animation={animation} />
                </Box>
                <Skeleton variant="text" width="60%" height={40} animation={animation} />
                <Skeleton variant="text" width="80%" animation={animation} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Content Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" height={30} animation={animation} sx={{ mb: 2 }} />
              <Stack spacing={2}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Box key={i} display="flex" alignItems="center" gap={2}>
                    <Skeleton variant="circular" width={40} height={40} animation={animation} />
                    <Box flex={1}>
                      <Skeleton variant="text" width="70%" animation={animation} />
                      <Skeleton variant="text" width="50%" height={15} animation={animation} />
                    </Box>
                    <Skeleton variant="rectangular" width={80} height={30} animation={animation} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" height={30} animation={animation} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={250} animation={animation} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // Table skeleton
  const TableSkeleton = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            {Array.from({ length: columns }, (_, i) => (
              <TableCell key={i}>
                <Skeleton variant="text" animation={animation} />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton 
                    variant="text" 
                    animation={animation}
                    width={colIndex === 0 ? '80%' : '60%'}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Card skeleton
  const CardSkeleton = () => (
    <Card sx={{ height }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Skeleton variant="circular" width={50} height={50} animation={animation} sx={{ mr: 2 }} />
          <Box flex={1}>
            <Skeleton variant="text" width="60%" height={30} animation={animation} />
            <Skeleton variant="text" width="40%" height={20} animation={animation} />
          </Box>
        </Box>
        <Skeleton variant="rectangular" width="100%" height={150} animation={animation} sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Skeleton variant="text" width="90%" animation={animation} />
          <Skeleton variant="text" width="75%" animation={animation} />
          <Skeleton variant="text" width="80%" animation={animation} />
        </Stack>
        <Box display="flex" gap={1} mt={2}>
          <Skeleton variant="rectangular" width={100} height={36} animation={animation} />
          <Skeleton variant="rectangular" width={100} height={36} animation={animation} />
        </Box>
      </CardContent>
    </Card>
  );

  // List skeleton
  const ListSkeleton = () => (
    <Paper sx={{ p: 2, height }}>
      <Stack spacing={2}>
        {Array.from({ length: rows }, (_, i) => (
          <Box key={i} display="flex" alignItems="center" gap={2}>
            <Skeleton variant="circular" width={48} height={48} animation={animation} />
            <Box flex={1}>
              <Skeleton variant="text" width="70%" height={24} animation={animation} />
              <Skeleton variant="text" width="50%" height={18} animation={animation} />
            </Box>
            <Skeleton variant="rectangular" width={100} height={36} animation={animation} />
          </Box>
        ))}
      </Stack>
    </Paper>
  );

  // Chart skeleton
  const ChartSkeleton = () => (
    <Paper sx={{ p: 3, height }}>
      <Skeleton variant="text" width="30%" height={30} animation={animation} sx={{ mb: 3 }} />
      <Box position="relative" height={300}>
        {/* Y-axis labels */}
        <Box position="absolute" left={0} top={0} height="100%" display="flex" flexDirection="column" justifyContent="space-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="text" width={30} height={15} animation={animation} />
          ))}
        </Box>
        {/* Chart bars */}
        <Box ml={6} height="100%" display="flex" alignItems="flex-end" gap={1}>
          {Array.from({ length: 8 }, (_, i) => (
            <Box key={i} flex={1} display="flex" flexDirection="column" alignItems="center">
              <Skeleton 
                variant="rectangular" 
                width="100%" 
                height={`${Math.random() * 70 + 30}%`}
                animation={animation}
                sx={{ mb: 1 }}
              />
              <Skeleton variant="text" width="80%" height={15} animation={animation} />
            </Box>
          ))}
        </Box>
      </Box>
      {/* X-axis label */}
      <Skeleton variant="text" width="20%" height={20} animation={animation} sx={{ mx: 'auto', mt: 2 }} />
    </Paper>
  );

  // Form skeleton
  const FormSkeleton = () => (
    <Paper sx={{ p: 3, height }}>
      <Skeleton variant="text" width="40%" height={35} animation={animation} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        {Array.from({ length: 6 }, (_, i) => (
          <Grid item xs={12} sm={6} key={i}>
            <Skeleton variant="text" width="30%" height={20} animation={animation} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" width="100%" height={56} animation={animation} />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Skeleton variant="text" width="30%" height={20} animation={animation} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={120} animation={animation} />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Skeleton variant="rectangular" width={100} height={40} animation={animation} />
            <Skeleton variant="rectangular" width={120} height={40} animation={animation} />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );

  // Profile skeleton
  const ProfileSkeleton = () => (
    <Paper sx={{ p: 3, height }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Skeleton variant="circular" width={100} height={100} animation={animation} sx={{ mr: 3 }} />
        <Box flex={1}>
          <Skeleton variant="text" width="40%" height={35} animation={animation} />
          <Skeleton variant="text" width="30%" height={25} animation={animation} />
          <Skeleton variant="text" width="50%" height={20} animation={animation} />
        </Box>
        <Skeleton variant="rectangular" width={120} height={40} animation={animation} />
      </Box>
      
      <Grid container spacing={3}>
        {Array.from({ length: 4 }, (_, i) => (
          <Grid item xs={12} sm={6} key={i}>
            <Box p={2} bgcolor={alpha(theme.palette.primary.main, 0.05)} borderRadius={1}>
              <Skeleton variant="text" width="40%" height={20} animation={animation} />
              <Skeleton variant="text" width="70%" height={30} animation={animation} />
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box mt={4}>
        <Skeleton variant="text" width="30%" height={30} animation={animation} sx={{ mb: 2 }} />
        <Stack spacing={2}>
          {Array.from({ length: 3 }, (_, i) => (
            <Box key={i} display="flex" alignItems="center" gap={2} p={2} bgcolor={theme.palette.background.default} borderRadius={1}>
              <Skeleton variant="circular" width={40} height={40} animation={animation} />
              <Box flex={1}>
                <Skeleton variant="text" width="60%" animation={animation} />
                <Skeleton variant="text" width="40%" height={15} animation={animation} />
              </Box>
              <Skeleton variant="text" width={80} animation={animation} />
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );

  // Render based on variant
  switch (variant) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'table':
      return <TableSkeleton />;
    case 'card':
      return <CardSkeleton />;
    case 'list':
      return <ListSkeleton />;
    case 'chart':
      return <ChartSkeleton />;
    case 'form':
      return <FormSkeleton />;
    case 'profile':
      return <ProfileSkeleton />;
    case 'custom':
      return <>{children}</>;
    default:
      return <CardSkeleton />;
  }
};

// Export individual skeleton components for flexible usage
export const SkeletonCard: React.FC<{ animation?: 'wave' | 'pulse' | false }> = ({ animation = 'wave' }) => (
  <LoadingSkeleton variant="card" animation={animation} />
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; animation?: 'wave' | 'pulse' | false }> = ({ 
  rows = 5, 
  columns = 4, 
  animation = 'wave' 
}) => (
  <LoadingSkeleton variant="table" rows={rows} columns={columns} animation={animation} />
);

export const SkeletonDashboard: React.FC<{ animation?: 'wave' | 'pulse' | false }> = ({ animation = 'wave' }) => (
  <LoadingSkeleton variant="dashboard" animation={animation} />
);

export const SkeletonChart: React.FC<{ animation?: 'wave' | 'pulse' | false }> = ({ animation = 'wave' }) => (
  <LoadingSkeleton variant="chart" animation={animation} />
);

export const SkeletonForm: React.FC<{ animation?: 'wave' | 'pulse' | false }> = ({ animation = 'wave' }) => (
  <LoadingSkeleton variant="form" animation={animation} />
);

export default LoadingSkeleton;