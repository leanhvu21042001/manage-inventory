import AWS from "aws-sdk";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";

import { v4 } from "uuid";
import * as yup from "yup";

const tableName = "InventoryTable";
const HTTP_STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
};

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: false,
  convertClassInstanceToMap: false,
};

const unmarshallOptions = {
  wrapNumbers: false,
};

const translateConfig = { marshallOptions, unmarshallOptions };

// Create the DynamoDB document client.
const REGION = "ap-southeast-1";
const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

const dynamoDB = new AWS.DynamoDB();

const headers = {
  "content-type": "application/json",
};
const docClient = new AWS.DynamoDB.DocumentClient();

const schema = yup.object().shape({
  name: yup.string().required(),
  price: yup.number().required(),
  supplier: yup.object().required(),
  category: yup.string().required(),
  current_stock: yup.number().required(),
});

class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      headers,
      body: JSON.stringify({
        errors: e.errors,
      }),
    };
  }

  if (e instanceof SyntaxError) {
    return {
      statusCode: HTTP_STATUS_CODE.BAD_REQUEST,
      headers,
      body: JSON.stringify({ error: `invalid request body format : "${e.message}"` }),
    };
  }

  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
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
    await schema.validate(reqBody, { abortEarly: false });

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

    return {
      statusCode: HTTP_STATUS_CODE.CREATED,
      headers,
      body: JSON.stringify(inventory),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const getInventory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const inventory = await fetchInventoryById(event.pathParameters?.id as string);

    return {
      statusCode: HTTP_STATUS_CODE.OK,
      headers,
      body: JSON.stringify(inventory),
    };
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

      return {
        statusCode: HTTP_STATUS_CODE.OK,
        headers,
        body: JSON.stringify(inventories),
      };
    }

    const params = {
      Statement: `UPDATE ${tableName} SET price=?`,
      Parameters: [{ N: price }],
    };

    const { Items: inventories } = await ddbDocClient.send(new ExecuteStatementCommand(params));
    return {
      statusCode: HTTP_STATUS_CODE.OK,
      headers,
      body: JSON.stringify(inventories),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const listInventory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let limit = 10;
  const output = await docClient
    .scan({
      TableName: tableName,
      Limit: limit,
    })
    .promise();

  return {
    statusCode: HTTP_STATUS_CODE.OK,
    headers,
    body: JSON.stringify(output.Items),
  };
};
