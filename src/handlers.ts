import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";

import { v4 } from "uuid";
import * as yup from "yup";

import HttpError from "./http-error";
import { docClient } from "./doc-client";
import { responseData } from "./response-data";
import { schemaInventory } from "./yup-schema";
import { HTTP_STATUS_CODE } from "./http-status-code";
import { ddbDocClient, tableName } from "./dynamodb";

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

    // update all items equal with category
    if (category) {
      const params = {
        Statement: `UPDATE ${tableName} SET price=? WHERE category=?`,
        Parameters: [{ N: price }, { S: category }],
      };
      const { Items: inventories } = await ddbDocClient.send(new ExecuteStatementCommand(params));

      return responseData(HTTP_STATUS_CODE.OK, JSON.stringify(inventories));
    }

    const params = {
      Statement: `UPDATE ${tableName} SET price=?`,
      Parameters: [{ N: price }],
    };

    const { Items: inventories } = await ddbDocClient.send(new ExecuteStatementCommand(params));

    return responseData(HTTP_STATUS_CODE.OK, JSON.stringify(inventories));
  } catch (e) {
    return handleError(e);
  }
};

export const listInventory = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let limit = 10;
  const { Items: inventories } = await docClient
    .scan({
      TableName: tableName,
      Limit: limit,
    })
    .promise();

  return responseData(HTTP_STATUS_CODE.OK, JSON.stringify(inventories));
};
