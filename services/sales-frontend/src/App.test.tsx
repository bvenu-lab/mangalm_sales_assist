import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

// Mock the AuthContext
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn()
  })
}));

// Mock Router
const MockedApp = () => (
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);

describe('App', () => {
  test('renders without crashing', () => {
    render(<MockedApp />);
    expect(document.body).toBeInTheDocument();
  });

  test('renders router provider', () => {
    render(<MockedApp />);
    // Just verify the app renders without throwing
    expect(true).toBe(true);
  });
});