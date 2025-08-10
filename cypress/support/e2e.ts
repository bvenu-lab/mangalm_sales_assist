// Cypress E2E support file
import './commands';
import '@cypress/code-coverage/support';

// Preserve cookies between tests
Cypress.Cookies.defaults({
  preserve: ['auth-token', 'session'],
});

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  if (err.message.includes('ResizeObserver')) {
    return false;
  }
  return true;
});

// Before each test
beforeEach(() => {
  // Clear local storage
  cy.clearLocalStorage();
  
  // Reset API state
  cy.request('POST', `${Cypress.env('apiUrl')}/test/reset`).then(() => {
    cy.log('Test environment reset');
  });
});

// After each test
afterEach(() => {
  // Take screenshot on failure
  if (Cypress.currentTest.state === 'failed') {
    cy.screenshot(`failed-${Cypress.currentTest.title}`);
  }
});