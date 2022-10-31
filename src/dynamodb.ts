import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const tableName = "InventoryTable";

export const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: false,
  convertClassInstanceToMap: false,
};

export const unmarshallOptions = {
  wrapNumbers: false,
};

export const translateConfig = { marshallOptions, unmarshallOptions };

// Create the DynamoDB document client.
export const REGION = "ap-southeast-1";
export const ddbClient = new DynamoDBClient({ region: REGION });
export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);
