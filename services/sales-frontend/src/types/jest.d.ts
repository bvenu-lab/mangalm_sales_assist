/**
 * Type definitions for Jest
 */

declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveTextContent(text: string | RegExp): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(className: string): R;
    toHaveStyle(style: Record<string, any>): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeChecked(): R;
    toBeEmpty(): R;
    toBeInvalid(): R;
    toBeRequired(): R;
    toBeValid(): R;
    toContainElement(element: HTMLElement | null): R;
    toContainHTML(html: string): R;
    toHaveFocus(): R;
    toHaveFormValues(values: Record<string, any>): R;
    toHaveValue(value: string | string[] | number): R;
    toBeInTheDOM(): R;
    toHaveDescription(text: string | RegExp): R;
  }

  interface MockInstance<T, Y extends any[]> {
    mockClear(): this;
    mockReset(): this;
    mockRestore(): void;
    mockImplementation(fn: (...args: Y) => T): this;
    mockImplementationOnce(fn: (...args: Y) => T): this;
    mockReturnValue(value: T): this;
    mockReturnValueOnce(value: T): this;
    mockResolvedValue(value: Awaited<T>): this;
    mockResolvedValueOnce(value: Awaited<T>): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    getMockName(): string;
    mockName(name: string): this;
    mock: {
      calls: Y[];
      instances: T[];
      invocationCallOrder: number[];
      results: Array<{ type: string; value: any }>;
    };
  }

  type SpyInstance<T, Y extends any[]> = MockInstance<T, Y>;

  interface Mock<T = any, Y extends any[] = any[]> extends Function, MockInstance<T, Y> {
    new (...args: Y): T;
    (...args: Y): T;
  }

  function fn<T = any, Y extends any[] = any[]>(): Mock<T, Y>;
  function fn<T = any, Y extends any[] = any[]>(implementation?: (...args: Y) => T): Mock<T, Y>;

  function spyOn<T, M extends keyof T>(object: T, method: M): SpyInstance<Required<T>[M], T[M] extends (...args: infer A) => any ? A : any[]>;

  function mock<T extends string>(moduleName: T): { [K in T]: any };

  function setTimeout(timeout: number): void;
  function useFakeTimers(): void;
  function useRealTimers(): void;
  function runAllTimers(): void;
  function runOnlyPendingTimers(): void;
  function advanceTimersByTime(msToRun: number): void;
  function clearAllTimers(): void;
  function getTimerCount(): number;

  const genMockFromModule: <T>(moduleName: string) => T;
  const requireActual: <T>(moduleName: string) => T;
  const requireMock: <T>(moduleName: string) => T;
  const resetModules: () => void;
  const isolateModules: (fn: () => void) => void;
  const doMock: (moduleName: string, factory?: any, options?: { virtual?: boolean }) => void;
  const dontMock: (moduleName: string) => void;
  const setMock: <T>(moduleName: string, moduleExports: T) => void;
  const unmock: (moduleName: string) => void;
  const deepUnmock: (moduleName: string) => void;
  const createMockFromModule: <T>(moduleName: string) => T;
}

declare function expect<T = any>(actual: T): jest.Matchers<void>;

declare function describe(name: string, fn: () => void): void;
declare function describe(table: string, name: string, fn: () => void): void;
declare function describe(name: string, fn: () => Promise<void>): void;
declare function describe(table: string, name: string, fn: () => Promise<void>): void;

declare function beforeAll(fn: () => void): void;
declare function beforeAll(fn: () => Promise<void>): void;
declare function afterAll(fn: () => void): void;
declare function afterAll(fn: () => Promise<void>): void;

declare function beforeEach(fn: () => void): void;
declare function beforeEach(fn: () => Promise<void>): void;
declare function afterEach(fn: () => void): void;
declare function afterEach(fn: () => Promise<void>): void;

declare function it(name: string, fn: () => void): void;
declare function it(name: string, fn: () => Promise<void>): void;
declare function it(name: string, timeout: number, fn: () => void): void;
declare function it(name: string, timeout: number, fn: () => Promise<void>): void;

declare function test(name: string, fn: () => void): void;
declare function test(name: string, fn: () => Promise<void>): void;
declare function test(name: string, timeout: number, fn: () => void): void;
declare function test(name: string, timeout: number, fn: () => Promise<void>): void;

declare namespace jest {
  const fn: typeof global.jest.fn;
  const spyOn: typeof global.jest.spyOn;
  const mock: typeof global.jest.mock;
}
