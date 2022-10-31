export const responseData = (httpStatusCode: number, body: any) => ({
  headers: {
    "content-type": "application/json",
  },
  body: body,
  statusCode: httpStatusCode,
});
