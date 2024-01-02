import "reflect-metadata";
import { CloudFrontRequestHandler } from "aws-lambda";

import { RequestUtils } from "../utils/request.utils.js";
import { AuthService } from "../services/auth.service.js";
import { ResponseUtils } from "../utils/response.utils.js";
import { LambdaUtils } from "../utils/lambda.utils.js";

export const handler: CloudFrontRequestHandler = async (event, context) => {
  // console.log("callback.handler.event", JSON.stringify(event, undefined, 4));
  // console.log(
  //   "callback.handler.context",
  //   JSON.stringify(context, undefined, 4)
  // );

  const requestUtils = new RequestUtils();

  const lambdaUtils = new LambdaUtils();
  const region = lambdaUtils.getRegionFromContext(context);

  const authService = new AuthService({
    ssmClientOptions: {
      region,
    },
    cloudfrontClientOptions: {},
    secretsManagerClientOptions: {
      region,
    },
  });

  try {
    const code = requestUtils.parseCode(event);
    const requestedUrl = requestUtils.parseRequestedURLFromState(event);
    const idToken = await authService.exchangeCodeForToken(code, event);

    return ResponseUtils.create()
      .setCookie("idToken", idToken)
      .redirectTo(requestedUrl)
      .build();
  } catch (e) {
    console.log(e);
    return ResponseUtils.create()
      .redirectTo(requestUtils.getRequestedURL(event))
      .build();
  }
};
