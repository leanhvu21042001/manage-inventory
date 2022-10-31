import * as yup from "yup";

import HttpError from "../utils/http-error";
import { responseData } from "./response-data";
import { HTTP_STATUS_CODE } from "../utils/http-status-code";

export const handleError = (e: unknown) => {
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
