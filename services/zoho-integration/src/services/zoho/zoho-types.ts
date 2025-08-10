/**
 * Zoho module enum
 */
export enum ZohoModule {
  ACCOUNTS = 'Accounts',
  CONTACTS = 'Contacts',
  LEADS = 'Leads',
  DEALS = 'Deals',
  CAMPAIGNS = 'Campaigns',
  TASKS = 'Tasks',
  CALLS = 'Calls',
  MEETINGS = 'Meetings',
  PRODUCTS = 'Products',
  VENDORS = 'Vendors',
  PRICE_BOOKS = 'Price_Books',
  QUOTES = 'Quotes',
  SALES_ORDERS = 'Sales_Orders',
  PURCHASE_ORDERS = 'Purchase_Orders',
  INVOICES = 'Invoices',
  CUSTOM = 'Custom'
}

/**
 * Zoho authentication response
 */
export interface ZohoAuthResponse {
  access_token: string;
  refresh_token: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
}

/**
 * Zoho API response
 */
export interface ZohoApiResponse<T> {
  data: T[];
  info?: {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
  };
}

/**
 * Zoho API error
 */
export interface ZohoApiError {
  code: string;
  details: {
    api_name: string;
    expected_data_type?: string;
  };
  message: string;
  status: string;
}

/**
 * Zoho API error response
 */
export interface ZohoApiErrorResponse {
  code: string;
  details: ZohoApiError[];
  message: string;
  status: string;
}

/**
 * Zoho API configuration
 */
export interface ZohoApiConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  apiDomain: string;
  tokenRefreshIntervalMs?: number;
}

/**
 * Zoho record field
 */
export interface ZohoRecordField {
  field_label: string;
  json_type: string;
  data_type: string;
  column_name: string;
  field_read_only: boolean;
  lookup: {
    display_label: string;
    module: string;
    api_name: string;
  };
  visible: boolean;
  length: number;
  created_source: string;
  required: boolean;
  api_name: string;
  unique: {
    casesensitive: boolean;
    ui: boolean;
  };
  businesscard_supported: boolean;
  filterable: boolean;
  currency: {
    precision: number;
    rounding_option: string;
  };
  id: string;
  custom_field: boolean;
  pick_list_values: {
    display_value: string;
    actual_value: string;
    id: string;
    sequence_number: number;
  }[];
  auto_number: {
    prefix: string;
    suffix: string;
    start_number: number;
  };
  convert_mapping: {
    Contacts: {
      api_name: string;
      field_label: string;
    };
    Accounts: {
      api_name: string;
      field_label: string;
    };
    Deals: {
      api_name: string;
      field_label: string;
    };
  };
  sequence_number: number;
  view_type: {
    view: boolean;
    edit: boolean;
    quick_create: boolean;
    create: boolean;
  };
  subform: {
    module: string;
    api_name: string;
  };
  external: boolean;
  formula: {
    return_type: string;
    expression: string;
  };
  decimal_place: number;
  mass_update: boolean;
  multiselectlookup: {
    display_label: string;
    module: string;
    api_name: string;
  };
  pick_list_values_sorted_lexically: boolean;
  created_time: string;
  modified_time: string;
  show_type: number;
  associated_module: {
    module: string;
    api_name: string;
  };
  tooltip: {
    name: string;
    value: string;
  };
  historytracking: boolean;
  display_label: string;
  read_only: boolean;
  association_details: {
    lookup_field: {
      display_label: string;
      api_name: string;
      module: string;
    };
    related_field: {
      display_label: string;
      api_name: string;
      module: string;
    };
  };
  quick_create: boolean;
  modified_source: string;
  display_type: number;
  ui_type: number;
  searchable: boolean;
  system_mandatory: boolean;
}

/**
 * Zoho module metadata
 */
export interface ZohoModuleMetadata {
  module_name: string;
  api_supported: boolean;
  fields: ZohoRecordField[];
}

/**
 * Zoho record
 */
export interface ZohoRecord {
  id: string;
  [key: string]: any;
}

/**
 * Zoho search criteria
 */
export interface ZohoSearchCriteria {
  field: string;
  operator: string;
  value: string | number | boolean;
}

/**
 * Zoho search parameters
 */
export interface ZohoSearchParams {
  module: ZohoModule;
  criteria?: ZohoSearchCriteria[];
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  fields?: string[];
  custom_view_id?: string;
  territory_id?: string;
  include_child?: boolean;
}

/**
 * Zoho create record parameters
 */
export interface ZohoCreateRecordParams {
  module: ZohoModule;
  data: any;
  trigger?: string[];
  process?: string[];
  lar_id?: string;
  approve?: boolean;
  workflow?: boolean;
}

/**
 * Zoho update record parameters
 */
export interface ZohoUpdateRecordParams {
  module: ZohoModule;
  id: string;
  data: any;
  trigger?: string[];
  process?: string[];
  approve?: boolean;
  workflow?: boolean;
}

/**
 * Zoho delete record parameters
 */
export interface ZohoDeleteRecordParams {
  module: ZohoModule;
  id: string;
}

/**
 * Zoho get record parameters
 */
export interface ZohoGetRecordParams {
  module: ZohoModule;
  id: string;
  fields?: string[];
}

/**
 * Zoho get records parameters
 */
export interface ZohoGetRecordsParams {
  module: ZohoModule;
  page?: number;
  per_page?: number;
  fields?: string[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  converted?: boolean;
  approved?: boolean;
  include_child?: boolean;
  territory_id?: string;
  custom_view_id?: string;
}
