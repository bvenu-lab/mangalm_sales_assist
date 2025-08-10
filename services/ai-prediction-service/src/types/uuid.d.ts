declare module 'uuid' {
  /**
   * Generate a v1 (time-based) UUID
   * @returns A v1 UUID string
   */
  export function v1(): string;

  /**
   * Generate a v3 (namespace with MD5) UUID
   * @param name The value to use for creating a name-based UUID
   * @param namespace The namespace to use for creating a name-based UUID
   * @returns A v3 UUID string
   */
  export function v3(name: string | Buffer, namespace: string | Buffer): string;

  /**
   * Generate a v4 (random) UUID
   * @returns A v4 UUID string
   */
  export function v4(): string;

  /**
   * Generate a v5 (namespace with SHA-1) UUID
   * @param name The value to use for creating a name-based UUID
   * @param namespace The namespace to use for creating a name-based UUID
   * @returns A v5 UUID string
   */
  export function v5(name: string | Buffer, namespace: string | Buffer): string;

  /**
   * Validate a UUID string
   * @param uuid The UUID string to validate
   * @returns True if the UUID string is valid, false otherwise
   */
  export function validate(uuid: string): boolean;

  /**
   * Parse a UUID string into its components
   * @param uuid The UUID string to parse
   * @returns An array of UUID components
   */
  export function parse(uuid: string): Buffer;

  /**
   * Convert UUID components into a string
   * @param buffer The UUID components
   * @returns A UUID string
   */
  export function unparse(buffer: Buffer | number[]): string;

  /**
   * Pre-defined namespaces
   */
  export const DNS: string;
  export const URL: string;
  export const OID: string;
  export const X500: string;
  export const NIL: string;
}
