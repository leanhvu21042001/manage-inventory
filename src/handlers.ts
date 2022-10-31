import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AttributeValue, ExecuteStatementCommand, ScanOutput } from "@aws-sdk/client-dynamodb";

import { v4 } from "uuid";
import * as yup from "yup";

import HttpError from "./http-error";
import { docClient } from "./doc-client";
import { responseData } from "./response-data";
import { schemaInventory } from "./yup-schema";
import { HTTP_STATUS_CODE } from "./http-status-code";
import { tableName } from "./dynamodb";

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return responseData(
      HTTP_STATUS_CODE.BAD_REQUEST,
      JSON.stringify({
        errors: e.errors,
      }),
    );
  }

  if (e instanceof SyntaxError) {
    return responseData(
      HTTP_STATUS_CODE.BAD_REQUEST,
      JSON.stringify({ error: `invalid request body format : "${e.message}"` }),
    );
  }

  if (e instanceof HttpError) {
    return responseData(e.statusCode, e.message);
  }

  throw e;
};

const fetchInventoryById = async (id: string) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        inventoryId: id,
      },
    })
    .promise();

  if (!output.Item) {
    throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, { error: "not found" });
  }

  return output.Item;
};

const updatesInventories = async (inventories: [], price: number) => {
  const updates: Promise<any>[] =
    inventories?.map(({ inventoryId }) =>
      docClient
        .update({
          TableName: tableName,
          Key: { inventoryId },
          UpdateExpression: "SET #price = :price",
          ExpressionAttributeValues: {
            ":price": price,
          },
          ExpressionAttributeNames: {
            "#price": "price",
          },
        })
        .promise(),
    ) || [];

  await Promise.all(updates);
};

const getAllInventories = async () => {
  const { Items: inventories } = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return inventories;
};

const getInventoriesByCategory = async (category: string) => {
  const { Items: inventories } = await docClient
    .scan({
      TableName: tableName,
      FilterExpression: "#category = :category",
      ExpressionAttributeNames: {
        "#category": "category",
      },
      ExpressionAttributeValues: { ":category": category },
    })
    .promise();

  return inventories;
};

export const createInventory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);
    await schemaInventory.validate(reqBody, { abortEarly: false });

    const inventory = {
      ...reqBody,
      inventoryId: v4(),
    };

    await docClient
      .put({
        TableName: tableName,
        Item: inventory,
      })
      .promise();

    return responseData(HTTP_STATUS_CODE.CREATED, JSON.stringify(inventory));
  } catch (e) {
    return handleError(e);
  }
};

export const getInventory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const inventory = await fetchInventoryById(event.pathParameters?.id as string);

    return responseData(HTTP_STATUS_CODE.OK, JSON.stringify(inventory));
  } catch (e) {
    return handleError(e);
  }
};

export const updateInventory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);
    const price = reqBody?.price;
    const category = reqBody?.category;

    if (!price) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, { error: "Miss field `price`" });
    }

    const inventories = category ? await getInventoriesByCategory(category) : await getAllInventories();

    if (inventories) {
      await updatesInventories(inventories, price);
    }

    return responseData(HTTP_STATUS_CODE.OK, JSON.stringify({ inventories }));
  } catch (e) {
    return handleError(e);
  }
};

export const listInventory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const query = event.queryStringParameters;

  const limit = query?.limit ? Number(query.limit) : 10;

  const params: {
    Limit?: number;
    TableName?: string;
    ExclusiveStartKey?: { [key: string]: AttributeValue };
  } = {
    TableName: tableName,
    Limit: limit,
  };

  if (query?.last_key) {
    params.ExclusiveStartKey = { inventoryId: query.last_key };
  }

  const { Items: inventories, LastEvaluatedKey } = await docClient.scan(params).promise();

  return responseData(
    HTTP_STATUS_CODE.OK,
    JSON.stringify({
      inventories,
      LastEvaluatedKey,
    }),
  );
};
