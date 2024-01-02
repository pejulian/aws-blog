import { Construct } from "constructs";

import { NestedStack, NestedStackProps, SecretValue } from "aws-cdk-lib/core";

import {
  UserPool,
  UserPoolClient,
  UserPoolDomain,
} from "aws-cdk-lib/aws-cognito";

import {
  ParameterDataType,
  ParameterTier,
  StringParameter,
} from "aws-cdk-lib/aws-ssm";

import { Secret } from "aws-cdk-lib/aws-secretsmanager";

import { Role } from "aws-cdk-lib/aws-iam";
import {
  CognitoUserPoolsAuthorizer,
  CorsOptions,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";

export interface ParametersStackProps extends NestedStackProps {
  parentDomain: string;
  subDomain: string;
  siteDomain: string;
  apiDomain: string;
  edgeLambdaRole?: Role;
  userPool?: UserPool;
  userPoolClient?: UserPoolClient;
  userPoolDomain?: UserPoolDomain;
  restApiCorsOptions: CorsOptions;
  restApi: RestApi;
  authorizer?: CognitoUserPoolsAuthorizer;
  loginURL?: string;
}

export class ParametersStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ParametersStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack creating all relevant SSM parameters and secret(s) used for authentication`,
    });

    if (props.userPool) {
      new StringParameter(this, "UserPoolIdParameter", {
        description: `ID of the Cognito user pool for ${props.siteDomain}`,
        dataType: ParameterDataType.TEXT,
        tier: ParameterTier.STANDARD,
        parameterName: `/${props.siteDomain}/cognito/user-pool-id`,
        stringValue: props.userPool.userPoolId,
      });
    }

    if (props.userPoolClient) {
      new StringParameter(this, "ClientIdParameter", {
        description: `Cognito user pool client ID for ${props.siteDomain}`,
        dataType: ParameterDataType.TEXT,
        tier: ParameterTier.STANDARD,
        parameterName: `/${props.siteDomain}/cognito/client-id`,
        stringValue: props.userPoolClient.userPoolClientId,
      });
    }

    if (props.loginURL) {
      new StringParameter(this, "LoginUrlParameter", {
        description: `Login URL for the Cognito hosted UI for ${props.siteDomain}`,
        dataType: ParameterDataType.TEXT,
        tier: ParameterTier.STANDARD,
        parameterName: `/${props.siteDomain}/cognito/login-url`,
        stringValue: props.loginURL,
      });
    }

    if (props.userPoolDomain) {
      new StringParameter(this, "UserPoolDomainParameter", {
        description: `User pool domain of the Cognito user pool for ${props.siteDomain}`,
        dataType: ParameterDataType.TEXT,
        tier: ParameterTier.STANDARD,
        parameterName: `/${props.siteDomain}/cognito/user-pool/domain`,
        stringValue: `https://${props.userPoolDomain.domainName}`,
      });
    }

    if (
      props.userPool &&
      props.userPoolClient &&
      props.userPoolDomain &&
      props.loginURL
    ) {
      new StringParameter(this, "UserPoolRedirectParameter", {
        description: `User pool client redirect URI for ${props.siteDomain}`,
        dataType: ParameterDataType.TEXT,
        tier: ParameterTier.STANDARD,
        parameterName: `/${props.siteDomain}/cognito/user-pool/client/redirect-uri`,
        stringValue: `https://${props.siteDomain}/callback`,
      });
    }

    if (props.userPoolClient && props.edgeLambdaRole) {
      const secret = new Secret(this, `UserPoolClientSecret`, {
        description: `Cognito user pool client secret for ${props.siteDomain}`,
        secretName: `${props.siteDomain}/cognito/user-pool/client-secret`,
        secretObjectValue: {
          clientId: SecretValue.unsafePlainText(
            props.userPoolClient.userPoolClientId
          ),
          clientSecret: props.userPoolClient.userPoolClientSecret,
        },
      });

      secret.grantRead(props.edgeLambdaRole);
    }

    new StringParameter(this, "RestApiCorsAllowOriginsParameter", {
      description: `Access-Control-Allow-Origin CORS header for ${props.apiDomain}`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/cors/allowOrigins`,
      stringValue: `${props.restApiCorsOptions.allowOrigins?.join(",")}`,
    });

    new StringParameter(this, "RestApiCorsAllowCredentialsParameter", {
      description: `Access-Control-Allow-Credentials CORS header for ${props.apiDomain}`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/cors/allowCredentials`,
      stringValue: `${props.restApiCorsOptions.allowCredentials}`,
    });

    new StringParameter(this, "RestApiCorsAllowHeadersParameter", {
      description: `Access-Control-Allow-Headers CORS header for ${props.apiDomain}`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/cors/allowHeaders`,
      stringValue: `${props.restApiCorsOptions.allowHeaders?.join(",")}`,
    });

    new StringParameter(this, "RestApiCorsAllowMethodsParameter", {
      description: `Access-Control-Allow-Methods CORS header for ${props.apiDomain}`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/cors/allowMethods`,
      stringValue: `${props.restApiCorsOptions.allowMethods?.join(",")}`,
    });

    new StringParameter(this, "RestApiCorsExposeHeadersParameter", {
      description: `Access-Control-Expose-Headers CORS header for ${props.apiDomain}`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/cors/exposeHeaders`,
      stringValue: `${props.restApiCorsOptions.exposeHeaders?.join(",")}`,
    });

    new StringParameter(this, "RestApiIdParameter", {
      description: `The ${props.apiDomain} REST API id`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/api/id`,
      stringValue: props.restApi.restApiId,
    });

    new StringParameter(this, "RestApiNameParameter", {
      description: `The ${props.apiDomain} REST API name`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/api/name`,
      stringValue: props.restApi.restApiName,
    });

    new StringParameter(this, "RestApiRootResourceIdParameter", {
      description: `The ${props.apiDomain} REST API root resource ID`,
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: `/${props.apiDomain}/rest/api/rootResourceId`,
      stringValue: props.restApi.restApiRootResourceId,
    });

    if (props.authorizer) {
      new StringParameter(this, "RestApiAuthorizerId", {
        description: `The ${props.apiDomain} REST API authorizer`,
        dataType: ParameterDataType.TEXT,
        tier: ParameterTier.STANDARD,
        parameterName: `/${props.apiDomain}/rest/api/authorizerId`,
        stringValue: props.authorizer.authorizerId,
      });
    }
  }
}
