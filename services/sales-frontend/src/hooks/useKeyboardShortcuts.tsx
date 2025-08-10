import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/notifications/NotificationSystem';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  global?: boolean;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutConfig[];
}

/**
 * World-class keyboard shortcuts system
 * Provides comprehensive keyboard navigation
 */
export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { notifyInfo } = useNotification();
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Define all shortcuts
  const shortcutCategories: ShortcutCategory[] = [
    {
      name: 'Navigation',
      shortcuts: [
        {
          key: 'd',
          alt: true,
          description: 'Go to Dashboard',
          action: () => navigate('/dashboard'),
        },
        {
          key: 's',
          alt: true,
          description: 'Go to Stores',
          action: () => navigate('/stores'),
        },
        {
          key: 'c',
          alt: true,
          description: 'Go to Calls',
          action: () => navigate('/calls'),
        },
        {
          key: 'o',
          alt: true,
          description: 'Go to Orders',
          action: () => navigate('/orders'),
        },
        {
          key: 'p',
          alt: true,
          description: 'Go to Performance',
          action: () => navigate('/performance'),
        },
        {
          key: 'ArrowLeft',
          alt: true,
          description: 'Go Back',
          action: () => window.history.back(),
        },
        {
          key: 'ArrowRight',
          alt: true,
          description: 'Go Forward',
          action: () => window.history.forward(),
        },
      ],
    },
    {
      name: 'Actions',
      shortcuts: [
        {
          key: 'k',
          ctrl: true,
          description: 'Open Command Palette',
          action: () => setCommandPaletteOpen(true),
          global: true,
        },
        {
          key: '/',
          ctrl: true,
          description: 'Focus Search',
          action: () => {
            const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
            searchInput?.focus();
          },
        },
        {
          key: 'n',
          ctrl: true,
          description: 'Create New Order',
          action: () => navigate('/orders/create'),
        },
        {
          key: 'r',
          ctrl: true,
          shift: true,
          description: 'Refresh Data',
          action: () => window.location.reload(),
        },
        {
          key: 'Escape',
          description: 'Close Modal/Clear Selection',
          action: () => {
            // Close any open modals
            const closeButtons = document.querySelectorAll('[data-modal-close]');
            closeButtons.forEach(btn => (btn as HTMLElement).click());
            
            // Clear selections
            const selections = document.querySelectorAll('[data-selected="true"]');
            selections.forEach(el => el.setAttribute('data-selected', 'false'));
          },
        },
      ],
    },
    {
      name: 'Data Operations',
      shortcuts: [
        {
          key: 'a',
          ctrl: true,
          description: 'Select All',
          action: () => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"][data-row-select]');
            checkboxes.forEach(cb => (cb as HTMLInputElement).checked = true);
            notifyInfo('All items selected');
          },
        },
        {
          key: 'a',
          ctrl: true,
          shift: true,
          description: 'Deselect All',
          action: () => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"][data-row-select]');
            checkboxes.forEach(cb => (cb as HTMLInputElement).checked = false);
            notifyInfo('All items deselected');
          },
        },
        {
          key: 'e',
          ctrl: true,
          description: 'Export Data',
          action: () => {
            const exportBtn = document.querySelector('[data-export-button]') as HTMLElement;
            exportBtn?.click();
          },
        },
        {
          key: 'Delete',
          shift: true,
          description: 'Delete Selected',
          action: () => {
            const deleteBtn = document.querySelector('[data-bulk-delete]') as HTMLElement;
            deleteBtn?.click();
          },
        },
      ],
    },
    {
      name: 'View Controls',
      shortcuts: [
        {
          key: '1',
          alt: true,
          description: 'Grid View',
          action: () => {
            const gridViewBtn = document.querySelector('[data-view="grid"]') as HTMLElement;
            gridViewBtn?.click();
          },
        },
        {
          key: '2',
          alt: true,
          description: 'List View',
          action: () => {
            const listViewBtn = document.querySelector('[data-view="list"]') as HTMLElement;
            listViewBtn?.click();
          },
        },
        {
          key: '3',
          alt: true,
          description: 'Compact View',
          action: () => {
            const compactViewBtn = document.querySelector('[data-view="compact"]') as HTMLElement;
            compactViewBtn?.click();
          },
        },
        {
          key: '+',
          ctrl: true,
          description: 'Zoom In',
          action: () => {
            document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') * 1.1)}`;
          },
        },
        {
          key: '-',
          ctrl: true,
          description: 'Zoom Out',
          action: () => {
            document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') * 0.9)}`;
          },
        },
        {
          key: '0',
          ctrl: true,
          description: 'Reset Zoom',
          action: () => {
            document.body.style.zoom = '1';
          },
        },
      ],
    },
    {
      name: 'Help',
      shortcuts: [
        {
          key: '?',
          shift: true,
          description: 'Show Keyboard Shortcuts',
          action: () => setShortcutsHelpOpen(true),
          global: true,
        },
        {
          key: 'F1',
          description: 'Open Help',
          action: () => window.open('/help', '_blank'),
        },
      ],
    },
  ];

  // Flatten shortcuts for easy access
  const allShortcuts = shortcutCategories.flatMap(cat => cat.shortcuts);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow global shortcuts
      const globalShortcut = allShortcuts.find(s => 
        s.global &&
        s.key === event.key &&
        (!s.ctrl || event.ctrlKey) &&
        (!s.alt || event.altKey) &&
        (!s.shift || event.shiftKey) &&
        (!s.meta || event.metaKey)
      );
      
      if (globalShortcut) {
        event.preventDefault();
        globalShortcut.action();
      }
      return;
    }

    // Find matching shortcut
    const shortcut = allShortcuts.find(s =>
      s.key === event.key &&
      (!s.ctrl || event.ctrlKey) &&
      (!s.alt || event.altKey) &&
      (!s.shift || event.shiftKey) &&
      (!s.meta || event.metaKey)
    );

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }

    // Quick number navigation (1-9 for first 9 items in list)
    if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.altKey) {
      const index = parseInt(event.key) - 1;
      const items = document.querySelectorAll('[data-list-item]');
      if (items[index]) {
        (items[index] as HTMLElement).click();
      }
    }

    // Arrow key navigation
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const focusableElements = Array.from(
        document.querySelectorAll('[data-focusable], button, a, input, select, textarea')
      ) as HTMLElement[];
      
      const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
      let nextIndex = currentIndex;
      
      if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
      }
      
      focusableElements[nextIndex]?.focus();
      event.preventDefault();
    }

    // Tab navigation enhancement
    if (event.key === 'Tab') {
      // Add visual indicator for keyboard navigation
      document.body.classList.add('keyboard-navigation');
    }
  }, [allShortcuts, navigate, notifyInfo]);

  // Remove keyboard navigation class on mouse use
  const handleMouseDown = useCallback(() => {
    document.body.classList.remove('keyboard-navigation');
  }, []);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleKeyDown, handleMouseDown]);

  // Command palette actions
  const commandPaletteActions = [
    { id: 'dashboard', label: 'Go to Dashboard', action: () => navigate('/dashboard') },
    { id: 'stores', label: 'Go to Stores', action: () => navigate('/stores') },
    { id: 'calls', label: 'Go to Calls', action: () => navigate('/calls') },
    { id: 'orders', label: 'Go to Orders', action: () => navigate('/orders') },
    { id: 'performance', label: 'Go to Performance', action: () => navigate('/performance') },
    { id: 'profile', label: 'Go to Profile', action: () => navigate('/profile') },
    { id: 'new-order', label: 'Create New Order', action: () => navigate('/orders/create') },
    { id: 'refresh', label: 'Refresh Page', action: () => window.location.reload() },
    { id: 'help', label: 'Open Help', action: () => window.open('/help', '_blank') },
    { id: 'shortcuts', label: 'Show Shortcuts', action: () => setShortcutsHelpOpen(true) },
  ];

  return {
    shortcutCategories,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    isShortcutsHelpOpen,
    setShortcutsHelpOpen,
    commandPaletteActions,
    searchQuery,
    setSearchQuery,
  };
};

// Export shortcut formatter for display
export const formatShortcut = (shortcut: ShortcutConfig): string => {
  const keys = [];
  if (shortcut.ctrl) keys.push('Ctrl');
  if (shortcut.alt) keys.push('Alt');
  if (shortcut.shift) keys.push('Shift');
  if (shortcut.meta) keys.push('⌘');
  keys.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return keys.join('+');
};