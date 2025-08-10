/// <reference types="cypress" />

// Custom Cypress commands

// Authentication commands
Cypress.Commands.add('login', (username: string = 'admin', password: string = 'admin123') => {
  cy.request('POST', `${Cypress.env('apiUrl')}/auth/login`, {
    username,
    password,
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('token');
    
    // Store token in local storage
    window.localStorage.setItem('auth-token', response.body.token);
    window.localStorage.setItem('user', JSON.stringify(response.body.user));
    
    // Set auth header for future requests
    cy.wrap(response.body.token).as('authToken');
  });
});

Cypress.Commands.add('logout', () => {
  cy.clearLocalStorage();
  cy.visit('/login');
});

// API commands
Cypress.Commands.add('apiRequest', (method: string, url: string, body?: any) => {
  cy.get('@authToken').then((token) => {
    return cy.request({
      method,
      url: `${Cypress.env('apiUrl')}${url}`,
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  });
});

// Navigation commands
Cypress.Commands.add('visitAuthenticated', (url: string) => {
  cy.login();
  cy.visit(url);
  cy.wait(500); // Wait for app to initialize
});

// Data commands
Cypress.Commands.add('createStore', (storeData: any) => {
  return cy.apiRequest('POST', '/api/stores', storeData);
});

Cypress.Commands.add('createPrediction', (storeId: string) => {
  return cy.apiRequest('POST', '/api/predictions/generate', { storeId });
});

// UI interaction commands
Cypress.Commands.add('selectFromDropdown', (selector: string, value: string) => {
  cy.get(selector).click();
  cy.get(`[data-value="${value}"]`).click();
});

Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-testid="loading-skeleton"]').should('not.exist');
  cy.get('[data-testid="loading-spinner"]').should('not.exist');
});

// Assertion commands
Cypress.Commands.add('shouldBeAccessible', () => {
  cy.injectAxe();
  cy.checkA11y();
});

Cypress.Commands.add('shouldHaveNotification', (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  cy.get(`[data-testid="notification-${type}"]`)
    .should('be.visible')
    .and('contain', message);
});

// Table commands
Cypress.Commands.add('getTableRow', (index: number) => {
  return cy.get('tbody tr').eq(index);
});

Cypress.Commands.add('sortTable', (column: string, order: 'asc' | 'desc' = 'asc') => {
  cy.get(`[data-testid="sort-${column}"]`).click();
  if (order === 'desc') {
    cy.get(`[data-testid="sort-${column}"]`).click();
  }
});

// Form commands
Cypress.Commands.add('fillForm', (formData: Record<string, any>) => {
  Object.entries(formData).forEach(([field, value]) => {
    if (typeof value === 'string') {
      cy.get(`[name="${field}"]`).clear().type(value);
    } else if (typeof value === 'boolean') {
      if (value) {
        cy.get(`[name="${field}"]`).check();
      } else {
        cy.get(`[name="${field}"]`).uncheck();
      }
    } else if (typeof value === 'number') {
      cy.get(`[name="${field}"]`).clear().type(value.toString());
    }
  });
});

Cypress.Commands.add('submitForm', () => {
  cy.get('form').submit();
});

// Performance commands
Cypress.Commands.add('measurePerformance', (name: string) => {
  cy.window().then((win) => {
    win.performance.mark(`${name}-start`);
    
    cy.on('window:load', () => {
      win.performance.mark(`${name}-end`);
      win.performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = win.performance.getEntriesByName(name)[0];
      cy.task('log', `Performance: ${name} took ${measure.duration}ms`);
    });
  });
});

// TypeScript declarations
declare global {
  namespace Cypress {
    interface Chainable {
      login(username?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
      apiRequest(method: string, url: string, body?: any): Chainable<Response>;
      visitAuthenticated(url: string): Chainable<void>;
      createStore(storeData: any): Chainable<Response>;
      createPrediction(storeId: string): Chainable<Response>;
      selectFromDropdown(selector: string, value: string): Chainable<void>;
      waitForLoading(): Chainable<void>;
      shouldBeAccessible(): Chainable<void>;
      shouldHaveNotification(message: string, type?: 'success' | 'error' | 'info'): Chainable<void>;
      getTableRow(index: number): Chainable<JQuery<HTMLElement>>;
      sortTable(column: string, order?: 'asc' | 'desc'): Chainable<void>;
      fillForm(formData: Record<string, any>): Chainable<void>;
      submitForm(): Chainable<void>;
      measurePerformance(name: string): Chainable<void>;
    }
  }
}

export {};