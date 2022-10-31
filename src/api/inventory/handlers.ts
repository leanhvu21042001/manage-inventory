import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

import { v4 } from "uuid";

import HttpError from "../../utils/http-error";
import { tableName } from "../../config/dynamodb";
import { docClient } from "../../config/doc-client";
import { calDiscount } from "../../utils/cal-discount";
import { handleError } from "../../helpers/handle-error";
import { responseData } from "../../helpers/response-data";
import { schemaInventory } from "../../helpers/yup-schema";
import { HTTP_STATUS_CODE } from "../../utils/http-status-code";

const fetchInventoryById = async (id: string) => {
  const params = {
    TableName: tableName,
    Key: {
      inventoryId: id,
    },
  };

  const { Item: inventory } = await docClient.get(params).promise();

  if (!inventory) {
    throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, { error: "not found" });
  }

  return inventory;
};

const updatesInventories = async (inventories: [], discount: number) => {
  const data: any = [];
  const updates: Promise<any>[] =
    inventories?.map(({ inventoryId, price, ...inventory }) => {
      const params: any = {
        TableName: tableName,
        Key: { inventoryId },
        UpdateExpression: "SET #price = :price",
        ExpressionAttributeValues: {
          ":price": calDiscount(price, discount),
        },
        ExpressionAttributeNames: {
          "#price": "price",
        },
      };

      data.push({
        ...inventory,
        inventoryId,
        price: calDiscount(price, discount),
      });

      return docClient.update(params).promise();
    }) || [];

  await Promise.all(updates);

  return data;
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
  const params = {
    TableName: tableName,
    FilterExpression: "#category = :category",
    ExpressionAttributeNames: {
      "#category": "category",
    },
    ExpressionAttributeValues: { ":category": category },
  };

  const { Items: inventories } = await docClient.scan(params).promise();

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

    const params = {
      TableName: tableName,
      Item: inventory,
    };

    await docClient.put(params).promise();

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

export const discountInventories = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    let inventories = [];
    const reqBody = JSON.parse(event.body as string);
    const discount = reqBody?.discount;
    const category = reqBody?.category;

    if (!discount) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, { error: "Miss field `discount`" });
    }

    const inventoriesUpdate = category ? await getInventoriesByCategory(category) : await getAllInventories();

    if (inventoriesUpdate) {
      inventories = await updatesInventories(inventoriesUpdate, discount);
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
