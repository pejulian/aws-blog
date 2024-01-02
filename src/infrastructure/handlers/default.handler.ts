import "reflect-metadata";
import { CloudFrontRequestHandler } from "aws-lambda";

import { AuthService } from "../services/auth.service.js";
import { RequestUtils, State } from "../utils/request.utils.js";
import { ResponseUtils } from "../utils/response.utils.js";
import { LambdaUtils } from "../utils/lambda.utils.js";

export const handler: CloudFrontRequestHandler = async (event, context) => {
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
    await authService.authenticate(event);
    return event.Records[0].cf.request;
  } catch (e) {
    console.log(e);

    const requestUtils = new RequestUtils();

    const state: State = {
      requestedURL: requestUtils.getRequestedURL(event),
    };

    const loginPageURL = new URL(await authService.getLoginPageURL(event));

    loginPageURL.searchParams.append(
      "state",
      requestUtils.base64Encode(JSON.stringify(state))
    );

    return ResponseUtils.create().redirectTo(loginPageURL.toString()).build();
  }
};
