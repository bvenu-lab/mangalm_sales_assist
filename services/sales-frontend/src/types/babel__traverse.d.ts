/**
 * Type definitions for @babel/traverse
 */

declare module '@babel/traverse' {
  export interface NodePath<T = any> {
    node: T;
    parent: any;
    parentPath: NodePath | null;
    scope: Scope;
    type: string;
    
    findParent(callback: (path: NodePath) => boolean): NodePath | null;
    find(callback: (path: NodePath) => boolean): NodePath | null;
    get(key: string): NodePath;
    traverse(visitor: Visitor): void;
    remove(): void;
    replaceWith(node: any): void;
    insertBefore(nodes: any | any[]): void;
    insertAfter(nodes: any | any[]): void;
  }
  
  export interface Scope {
    bindings: { [key: string]: Binding };
    parent: Scope | null;
    
    hasBinding(name: string): boolean;
    getBinding(name: string): Binding | undefined;
    generateUidIdentifier(name: string): any;
  }
  
  export interface Binding {
    identifier: any;
    path: NodePath;
    kind: string;
    referenced: boolean;
    references: number;
    referencePaths: NodePath[];
  }
  
  export interface Visitor {
    [key: string]: (path: NodePath, state?: any) => void | {
      enter?: (path: NodePath, state?: any) => void;
      exit?: (path: NodePath, state?: any) => void;
    };
  }
  
  export default function traverse(ast: any, visitor: Visitor, scope?: Scope, state?: any): void;
}
