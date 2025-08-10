// Mock implementation of the Zoho CRM SDK

// Mock USDataCenter
const USDataCenter = {
  PRODUCTION: () => ({ environment: 'PRODUCTION' }),
  SANDBOX: () => ({ environment: 'SANDBOX' }),
  DEVELOPER: () => ({ environment: 'DEVELOPER' })
};

// Mock OAuthBuilder
class OAuthBuilder {
  constructor() {
    this.config = {};
  }

  clientId(clientId) {
    this.config.clientId = clientId;
    return this;
  }

  clientSecret(clientSecret) {
    this.config.clientSecret = clientSecret;
    return this;
  }

  refreshToken(refreshToken) {
    this.config.refreshToken = refreshToken;
    return this;
  }

  build() {
    return this.config;
  }
}

// Mock InitializeBuilder
class InitializeBuilder {
  constructor() {
    this.config = {};
  }

  environment(environment) {
    this.config.environment = environment;
    return this;
  }

  token(token) {
    this.config.token = token;
    return this;
  }

  initialize() {
    return Promise.resolve();
  }
}

// Mock RecordOperations
class RecordOperations {
  static GetRecordsParam = {
    PAGE: 'page',
    PER_PAGE: 'per_page',
    FIELDS: 'fields',
    SORT_BY: 'sort_by',
    SORT_ORDER: 'sort_order',
    CONVERTED: 'converted',
    APPROVED: 'approved',
    INCLUDE_CHILD: 'include_child',
    TERRITORY_ID: 'territory_id',
    CUSTOM_VIEW_ID: 'custom_view_id'
  };

  static GetRecordParam = {
    FIELDS: 'fields'
  };

  static CreateRecordsParam = {
    TRIGGER: 'trigger',
    PROCESS: 'process',
    LAR_ID: 'lar_id',
    APPROVE: 'approve',
    WORKFLOW: 'workflow'
  };

  static UpdateRecordsParam = {
    TRIGGER: 'trigger',
    PROCESS: 'process',
    APPROVE: 'approve',
    WORKFLOW: 'workflow'
  };

  static SearchRecordsParam = {
    CRITERIA: 'criteria',
    PAGE: 'page',
    PER_PAGE: 'per_page',
    FIELDS: 'fields',
    SORT_BY: 'sort_by',
    SORT_ORDER: 'sort_order',
    CUSTOM_VIEW_ID: 'custom_view_id',
    TERRITORY_ID: 'territory_id',
    INCLUDE_CHILD: 'include_child'
  };

  getRecords() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new RecordResponseWrapper()
    });
  }

  getRecord() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new RecordResponseWrapper()
    });
  }

  createRecords() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new ActionWrapper()
    });
  }

  updateRecords() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new ActionWrapper()
    });
  }

  deleteRecord() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new ActionWrapper()
    });
  }

  searchRecords() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new RecordResponseWrapper()
    });
  }
}

// Mock ModulesOperations
class ModulesOperations {
  static ResponseWrapper = class {
    getModules() {
      return [
        {
          getAPIName: () => 'Accounts',
          getId: () => '1',
          getSingularLabel: () => 'Account',
          getPluralLabel: () => 'Accounts',
          getFields: () => [
            {
              getAPIName: () => 'Account_Name',
              getId: () => '1',
              getFieldLabel: () => 'Account Name',
              getDataType: () => 'text',
              getLength: () => 255,
              getMandatory: () => true,
              getReadOnly: () => false
            }
          ]
        }
      ];
    }
  };

  getModule() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new ModulesOperations.ResponseWrapper()
    });
  }

  getModules() {
    return Promise.resolve({
      getStatusCode: () => 200,
      getObject: () => new ModulesOperations.ResponseWrapper()
    });
  }
}

// Mock RecordResponseWrapper
class RecordResponseWrapper {
  getData() {
    return [
      {
        getId: () => '1',
        getKeyValues: () => ({
          Account_Name: 'Test Account',
          Billing_Street: '123 Main St',
          Billing_City: 'New York',
          Billing_State: 'NY',
          Contact_Name: 'John Doe',
          Phone: '123-456-7890',
          Email: 'john@example.com',
          Annual_Revenue: '200000',
          Account_Type: 'Customer - Direct',
          Description: 'Test account'
        })
      }
    ];
  }

  getInfo() {
    return {
      getCount: () => 1,
      getMoreRecords: () => false,
      getPage: () => 1,
      getPerPage: () => 200
    };
  }
}

// Mock ActionWrapper
class ActionWrapper {
  getData() {
    return [
      new SuccessResponse()
    ];
  }
}

// Mock SuccessResponse
class SuccessResponse {
  getDetails() {
    const map = new Map();
    map.set('id', '1');
    return map;
  }
}

// Mock APIException
class APIException {
  getMessage() {
    return 'API Exception';
  }
}

// Mock ParameterMap
class ParameterMap {
  constructor() {
    this.params = new Map();
  }

  add(key, value) {
    this.params.set(key, value);
    return this;
  }

  get(key) {
    return this.params.get(key);
  }
}

// Mock Record
class Record {
  constructor() {
    this.values = new Map();
    this.id = null;
  }

  setId(id) {
    this.id = id;
    return this;
  }

  getId() {
    return this.id;
  }

  addKeyValue(key, value) {
    this.values.set(key, value);
    return this;
  }

  getKeyValue(key) {
    return this.values.get(key);
  }

  getKeyValues() {
    const obj = {};
    this.values.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}

// Mock BodyWrapper
class BodyWrapper {
  constructor() {
    this.data = [];
  }

  setData(data) {
    this.data = data;
    return this;
  }

  getData() {
    return this.data;
  }
}

// Mock UserSignature
class UserSignature {
  constructor(email) {
    this.email = email;
  }

  getEmail() {
    return this.email;
  }
}

// Mock TokenStore
const TokenStore = {
  getTokenFromStore: (userSignature) => Promise.resolve({
    getAccessToken: () => 'access-token',
    getRefreshToken: () => 'refresh-token',
    getExpiresIn: () => 3600
  })
};

// Export all mocks
module.exports = {
  USDataCenter,
  OAuthBuilder,
  InitializeBuilder,
  RecordOperations,
  ModulesOperations,
  RecordResponseWrapper,
  ActionWrapper,
  SuccessResponse,
  APIException,
  ParameterMap,
  Record,
  BodyWrapper,
  UserSignature,
  TokenStore
};
