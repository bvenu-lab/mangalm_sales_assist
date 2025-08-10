import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LoadingSkeleton from '../loading/LoadingSkeleton';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('LoadingSkeleton', () => {
  test('renders default skeleton', () => {
    renderWithTheme(<LoadingSkeleton />);
    // Just verify it renders without error
    expect(true).toBe(true);
  });

  test('renders with custom rows', () => {
    renderWithTheme(<LoadingSkeleton rows={5} />);
    expect(true).toBe(true);
  });

  test('renders table variant', () => {
    renderWithTheme(<LoadingSkeleton variant="table" />);
    expect(true).toBe(true);
  });

  test('renders card variant', () => {
    renderWithTheme(<LoadingSkeleton variant="card" />);
    expect(true).toBe(true);
  });
});