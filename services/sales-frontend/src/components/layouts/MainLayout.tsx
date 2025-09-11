import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Avatar,
  Menu,
  MenuItem,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  ShoppingCart as ShoppingCartIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Scanner as ScannerIcon,
  CloudUpload as CloudUploadIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Define the drawer width
const drawerWidth = 240;

/**
 * MainLayout component
 * 
 * This component provides the main layout for the application, including
 * the header, sidebar, and main content area.
 */
const MainLayout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Handle drawer toggle
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Handle profile menu open
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // Handle profile menu close
  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle navigation
  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
  };

  // Define the sidebar content
  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          Mangalm Sales-Assist
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigation('/dashboard')}>
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleNavigation('/documents')}
            sx={{
              backgroundColor: theme => theme.palette.mode === 'light' 
                ? 'rgba(33, 150, 243, 0.08)' 
                : 'rgba(33, 150, 243, 0.15)',
              '&:hover': {
                backgroundColor: theme => theme.palette.mode === 'light'
                  ? 'rgba(33, 150, 243, 0.12)'
                  : 'rgba(33, 150, 243, 0.25)',
              },
            }}
          >
            <ListItemIcon>
              <ScannerIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Scan Orders" 
              secondary="Upload & Process"
              primaryTypographyProps={{ fontWeight: 'medium' }}
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigation('/bulk-upload')}>
            <ListItemIcon>
              <TableChartIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Bulk Upload" 
              secondary="CSV/XLSX Orders"
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigation('/stores')}>
            <ListItemIcon>
              <StoreIcon />
            </ListItemIcon>
            <ListItemText primary="Stores" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigation('/calls')}>
            <ListItemIcon>
              <PhoneIcon />
            </ListItemIcon>
            <ListItemText primary="Call List" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigation('/orders')}>
            <ListItemIcon>
              <ShoppingCartIcon />
            </ListItemIcon>
            <ListItemText primary="Orders" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigation('/performance')}>
            <ListItemIcon>
              <AssessmentIcon />
            </ListItemIcon>
            <ListItemText primary="Performance" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {/* Page title could be dynamic based on current route */}
            Sales Assistant Dashboard
          </Typography>
          <Button
            color="inherit"
            startIcon={<CloudUploadIcon />}
            onClick={() => navigate('/documents')}
            sx={{ 
              mr: 2,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
              }
            }}
          >
            Scan Order
          </Button>
          <IconButton color="inherit" aria-label="notifications">
            <NotificationsIcon />
          </IconButton>
          <IconButton color="inherit" aria-label="settings">
            <SettingsIcon />
          </IconButton>
          <IconButton
            onClick={handleProfileMenuOpen}
            size="small"
            sx={{ ml: 2 }}
            aria-controls="profile-menu"
            aria-haspopup="true"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => {
              handleProfileMenuClose();
              navigate('/profile');
            }}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => {
              handleProfileMenuClose();
              navigate('/settings');
            }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Toolbar /> {/* This is for spacing below the AppBar */}
        <Outlet /> {/* This is where the child routes will be rendered */}
      </Box>
    </Box>
  );
};

export default MainLayout;
