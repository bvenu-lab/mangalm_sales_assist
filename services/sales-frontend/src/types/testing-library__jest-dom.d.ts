/**
 * Type definitions for @testing-library/jest-dom
 */

declare namespace jest {
  interface Matchers<R> {
    /**
     * Check if an element is present in the document
     */
    toBeInTheDocument(): R;

    /**
     * Check if an element has the specified text content
     */
    toHaveTextContent(text: string | RegExp): R;

    /**
     * Check if an element has the specified attribute
     */
    toHaveAttribute(attr: string, value?: string): R;

    /**
     * Check if an element has the specified class
     */
    toHaveClass(...classNames: string[]): R;

    /**
     * Check if an element has the specified style
     */
    toHaveStyle(css: string | Record<string, any>): R;

    /**
     * Check if an element is visible
     */
    toBeVisible(): R;

    /**
     * Check if an element is disabled
     */
    toBeDisabled(): R;

    /**
     * Check if an element is enabled
     */
    toBeEnabled(): R;

    /**
     * Check if a form element is required
     */
    toBeRequired(): R;

    /**
     * Check if a form element is valid
     */
    toBeValid(): R;

    /**
     * Check if a form element is invalid
     */
    toBeInvalid(): R;

    /**
     * Check if an element is checked
     */
    toBeChecked(): R;

    /**
     * Check if an element is empty
     */
    toBeEmpty(): R;

    /**
     * Check if an element contains another element
     */
    toContainElement(element: HTMLElement | null): R;

    /**
     * Check if an element contains HTML
     */
    toContainHTML(html: string): R;

    /**
     * Check if an element has focus
     */
    toHaveFocus(): R;

    /**
     * Check if a form has the specified values
     */
    toHaveFormValues(values: Record<string, any>): R;

    /**
     * Check if an element has the specified value
     */
    toHaveValue(value: string | string[] | number): R;

    /**
     * Check if an element has the specified display value
     */
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;

    /**
     * Check if an element is partially checked
     */
    toBePartiallyChecked(): R;

    /**
     * Check if an element has the specified accessible description
     */
    toHaveDescription(text: string | RegExp): R;

    /**
     * Check if an element has the specified accessible name
     */
    toHaveAccessibleName(text: string | RegExp): R;

    /**
     * Check if an element has the specified accessible description
     */
    toHaveAccessibleDescription(text: string | RegExp): R;

    /**
     * Check if an element has the specified error message
     */
    toHaveErrorMessage(text: string | RegExp): R;
  }
}
