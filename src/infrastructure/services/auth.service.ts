import { RequestUtils } from "../utils/request.utils.js";
import { SSMClient } from "../clients/ssm.client.js";
import { CloudfrontClient } from "../clients/cloudfront.client.js";
import { SecretsManagerClient } from "../clients/secrets-manager.client.js";

import axios from "axios";

import { UnauthorizedError } from "../errors/UnauthorizedError.js";
import { CognitoJwtVerifierSingleUserPool } from "aws-jwt-verify/cognito-verifier";
import { CloudFrontRequestEvent } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

export type CognitoUserPoolClientSecrets = Readonly<{
  clientId: string;
  clientSecret: string;
}>;

export type JwtVerifierProperties = Readonly<{
  userPoolId: string;
  clientId: string;
  tokenUse: "id";
}>;

export type JwtVerifier =
  CognitoJwtVerifierSingleUserPool<JwtVerifierProperties>;

export type TokenExchangeResponse = Readonly<{
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}>;

export type AuthServiceOptions = {
  ssmClientOptions: ConstructorParameters<typeof SSMClient>[0];
  cloudfrontClientOptions: ConstructorParameters<typeof CloudfrontClient>[0];
  secretsManagerClientOptions: ConstructorParameters<
    typeof SecretsManagerClient
  >[0];
};

export class AuthService {
  private static jwtVerifier: JwtVerifier;

  private requestUtils: RequestUtils;
  private ssmClient: SSMClient;
  private cloudfrontClient: CloudfrontClient;
  private secretsManagerClient: SecretsManagerClient;

  constructor(options?: AuthServiceOptions) {
    this.requestUtils = new RequestUtils();
    this.ssmClient = new SSMClient(options?.ssmClientOptions);
    this.cloudfrontClient = new CloudfrontClient(
      options?.cloudfrontClientOptions
    );
    this.secretsManagerClient = new SecretsManagerClient(
      options?.secretsManagerClientOptions
    );
  }

  private async getJwtVerifier(event: CloudFrontRequestEvent) {
    if (!AuthService.jwtVerifier) {
      const userPoolId = await this.ssmClient.getParameterValue(
        `/${await this.cloudfrontClient.getAlias(
          event.Records[0].cf.config.distributionId
        )}/cognito/user-pool-id`
      );

      const clientId = await this.ssmClient.getParameterValue(
        `/${await this.cloudfrontClient.getAlias(
          event.Records[0].cf.config.distributionId
        )}/cognito/client-id`
      );

      AuthService.jwtVerifier = CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: "id",
      });
    }

    return AuthService.jwtVerifier;
  }

  public async authenticate(event: CloudFrontRequestEvent): Promise<void> {
    const cookies = this.requestUtils.extractCookies(event);

    if (!cookies.idToken) {
      throw new UnauthorizedError("cookies.idToken is missing.");
    }

    const jwtVerifier = await this.getJwtVerifier(event);

    try {
      await jwtVerifier.verify(cookies.idToken);
    } catch (e) {
      console.log(e);
      throw new UnauthorizedError("invalid idToken provided.");
    }
  }

  public async getLoginPageURL(event: CloudFrontRequestEvent): Promise<string> {
    return await this.ssmClient.getParameterValue(
      `/${await this.cloudfrontClient.getAlias(
        event.Records[0].cf.config.distributionId
      )}/cognito/login-url`
    );
  }

  public async exchangeCodeForToken(
    code: string,
    event: CloudFrontRequestEvent
  ): Promise<string> {
    const site = await this.cloudfrontClient.getAlias(
      event.Records[0].cf.config.distributionId
    );

    const [secretString, userPoolDomain, redirectURI] = await Promise.all([
      this.secretsManagerClient.getSecret(
        `${site}/cognito/user-pool/client-secret`
      ),
      this.ssmClient.getParameterValue(`/${site}/cognito/user-pool/domain`),
      this.ssmClient.getParameterValue(
        `/${site}/cognito/user-pool/client/redirect-uri`
      ),
    ]);

    const { clientId, clientSecret } = JSON.parse(
      secretString
    ) as CognitoUserPoolClientSecrets;

    // console.log("clientId", clientId, `clientSecret`, clientSecret);

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", clientId);
    params.append("code", code);
    params.append("redirect_uri", redirectURI);

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    };

    const url = `${userPoolDomain}/oauth2/token`;

    const response = await axios.post(url, params, {
      headers,
    });

    console.log(`id_token`, response.data);

    const { id_token } = response.data as TokenExchangeResponse;

    return id_token;
  }
}
