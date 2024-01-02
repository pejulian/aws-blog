import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import errorLogger from "@middy/error-logger";
import cors from "@middy/http-cors";

const lambdaHandler: APIGatewayProxyHandler = async (
  event,
  context
): Promise<APIGatewayProxyResult> => {
  console.log(`lambdaHandler`, JSON.stringify(event, undefined, 2), context);
  return {
    statusCode: 200,
    body: JSON.stringify({
      hello: "world",
    }),
  };
};

export const handler = middy()
  .use(errorLogger())
  .use(httpErrorHandler({}))
  .use(
    cors({
      credentials: process.env.ACCESS_CONTROL_ALLOW_CREDENTIALS === "true",
      headers: process.env.ACCESS_CONTROL_ALLOW_HEADERS,
      methods: process.env.ACCESS_CONTROL_ALLOW_METHODS,
      origins: process.env.ACCESS_CONTROL_ALLOW_ORIGIN?.split(",") ?? ["*"],
    })
  )
  .handler(lambdaHandler);
