declare module '@zohocrm/nodejs-sdk-2.1' {
  // Environment classes
  export class Environment {
    static getUrl(): string;
    static getName(): string;
  }

  export class USDataCenter {
    static PRODUCTION(): Environment;
    static SANDBOX(): Environment;
    static DEVELOPER(): Environment;
  }

  export class EUDataCenter {
    static PRODUCTION(): Environment;
    static SANDBOX(): Environment;
    static DEVELOPER(): Environment;
  }

  export class INDataCenter {
    static PRODUCTION(): Environment;
    static SANDBOX(): Environment;
    static DEVELOPER(): Environment;
  }

  export class CNDataCenter {
    static PRODUCTION(): Environment;
    static SANDBOX(): Environment;
    static DEVELOPER(): Environment;
  }

  export class AUDataCenter {
    static PRODUCTION(): Environment;
    static SANDBOX(): Environment;
    static DEVELOPER(): Environment;
  }

  export class JPDataCenter {
    static PRODUCTION(): Environment;
    static SANDBOX(): Environment;
    static DEVELOPER(): Environment;
  }

  // OAuth classes
  export class OAuthBuilder {
    clientId(clientId: string): OAuthBuilder;
    clientSecret(clientSecret: string): OAuthBuilder;
    refreshToken(refreshToken: string): OAuthBuilder;
    redirectURL(redirectURL: string): OAuthBuilder;
    build(): OAuthToken;
  }

  export class OAuthToken {
    getAccessToken(): string;
    getRefreshToken(): string;
    getClientId(): string;
    getClientSecret(): string;
    getRedirectURL(): string;
    getGrantToken(): string;
    getExpiresIn(): string;
    getId(): string;
    getUserMail(): string;
  }

  export class TokenStore {
    static getTokenFromStore(userSignature: UserSignature): Promise<OAuthToken>;
    static saveTokenToStore(userSignature: UserSignature, token: OAuthToken): Promise<void>;
    static deleteToken(id: string): Promise<void>;
  }

  export class UserSignature {
    constructor(email: string);
    getEmail(): string;
  }

  // Initialize class
  export class InitializeBuilder {
    environment(environment: Environment): InitializeBuilder;
    token(token: OAuthToken): InitializeBuilder;
    initialize(): Promise<void>;
  }

  // Static initialize function
  export function InitializeBuilder(): InitializeBuilder;

  // Record operations
  export class RecordOperations {
    static GetRecordsParam: {
      APPROVED: string;
      CONVERTED: string;
      CUSTOM_VIEW_ID: string;
      FIELDS: string;
      INCLUDE_CHILD: string;
      PAGE: string;
      PER_PAGE: string;
      SORT_BY: string;
      SORT_ORDER: string;
      TERRITORY_ID: string;
    };

    static GetRecordParam: {
      APPROVED: string;
      CONVERTED: string;
      FIELDS: string;
      INCLUDE_CHILD: string;
      TERRITORY_ID: string;
    };

    static SearchRecordsParam: {
      CRITERIA: string;
      EMAIL: string;
      PHONE: string;
      WORD: string;
      CUSTOM_VIEW_ID: string;
      FIELDS: string;
      INCLUDE_CHILD: string;
      PAGE: string;
      PER_PAGE: string;
      SORT_BY: string;
      SORT_ORDER: string;
      TERRITORY_ID: string;
    };

    static CreateRecordsParam: {
      APPROVE: string;
      LAR_ID: string;
      PROCESS: string;
      TRIGGER: string;
      WORKFLOW: string;
    };

    static UpdateRecordsParam: {
      APPROVE: string;
      PROCESS: string;
      TRIGGER: string;
      WORKFLOW: string;
    };

    getRecords(moduleAPIName: string, paramInstance?: ParameterMap): Promise<APIResponse>;
    getRecord(id: string, moduleAPIName: string, paramInstance?: ParameterMap): Promise<APIResponse>;
    createRecords(moduleAPIName: string, request: BodyWrapper, paramInstance?: ParameterMap): Promise<APIResponse>;
    updateRecords(moduleAPIName: string, request: BodyWrapper, paramInstance?: ParameterMap): Promise<APIResponse>;
    deleteRecord(id: string, moduleAPIName: string, paramInstance?: ParameterMap): Promise<APIResponse>;
    searchRecords(moduleAPIName: string, paramInstance?: ParameterMap): Promise<APIResponse>;
  }

  // Module field type
  export interface ModuleField {
    getAPIName(): string;
    getId(): string;
    getFieldLabel(): string;
    getDataType(): string;
    getLength(): number;
    getMandatory(): boolean;
    getReadOnly(): boolean;
  }

  // Module type
  export interface Module {
    getAPIName(): string;
    getId(): string;
    getSingularLabel(): string;
    getPluralLabel(): string;
    getFields(): ModuleField[];
  }

  // Modules operations
  export class ModulesOperations {
    getModules(): Promise<APIResponse>;
    getModule(moduleAPIName: string): Promise<APIResponse>;

    static ResponseWrapper: {
      new(): {
        getModules(): Module[];
      }
    };
  }

  // Parameter map
  export class ParameterMap {
    add(key: string, value: any): void;
    get(key: string): any;
    getAll(): Map<string, any>;
  }

  // Body wrapper
  export class BodyWrapper {
    setData(data: Record[]): void;
    getData(): Record[];
  }

  // Record class
  export class Record {
    setId(id: string): void;
    getId(): string;
    addKeyValue(key: string, value: any): void;
    getKeyValues(): Record<string, any>;
  }

  // Response classes
  export class APIResponse {
    getStatusCode(): number;
    getObject(): any;
    getHeaders(): Map<string, string>;
  }

  export class RecordResponseWrapper {
    getData(): Record[];
    getInfo(): Info;
  }

  export class ActionWrapper {
    getData(): (SuccessResponse | APIException)[];
  }

  export class SuccessResponse {
    getCode(): string;
    getDetails(): Map<string, any>;
    getMessage(): string;
    getStatus(): string;
  }

  export class APIException {
    getCode(): string;
    getDetails(): Map<string, any>;
    getMessage(): string;
    getStatus(): string;
  }

  export class Info {
    getCount(): number;
    getMoreRecords(): boolean;
    getPage(): number;
    getPerPage(): number;
  }
}
