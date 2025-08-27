export interface QueryParameterDescription {
  description: string;
  name: string;
  required: boolean;
}

export interface QueryDescription {
  queryName: string;
  query: string;
  description: string;
  parameters?: QueryParameterDescription[];
}
