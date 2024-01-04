import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";

import { Stack, StackProps } from "aws-cdk-lib/core";

import { SiteDistributionStack } from "./stacks/site-distribution.stack.js";
import { AuthStack } from "./stacks/auth.stack.js";
import { PermissionsStack } from "./stacks/permissions.stack.js";
import { ParametersStack } from "./stacks/parameters.stack.js";
import { EdgeLambdaStack } from "./stacks/edge-lambda.stack.js";
import { DomainStack } from "./stacks/domain.stack.js";
import { ApiStack } from "./stacks/api.stack.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface InfrastructureStackProps extends StackProps {
  hostedZoneId: string;
  parentDomain: string;
  subDomain: string;
  siteDomain: string;
  authDomain: string;
  apiDomain: string;
  enableAuthentication: boolean;
  enableApiLogging: boolean;
  enableApiTracing: boolean;
}

export class InfrastructureStack extends Stack {
  public readonly permissionsStack: PermissionsStack | undefined;
  public readonly domainStack: DomainStack;
  public readonly edgeLambdaStack: EdgeLambdaStack | undefined;
  public readonly authStack: AuthStack | undefined;
  public readonly siteDistributionStack: SiteDistributionStack;
  public readonly parametersStack: ParametersStack;
  public readonly apiStack: ApiStack;

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, {
      ...props,
      stackName: `${props.subDomain}InfrastructureStack`,
      description: `[${props.subDomain}] Root stack for the subsite infrastructure`,
    });

    // ===============================================================
    // Core infrastructure
    // ===============================================================

    if (props.enableAuthentication) {
      this.permissionsStack = new PermissionsStack(this, `PermissionsStack`, {
        parentDomain: props.parentDomain,
        subDomain: props.subDomain,
      });
    }

    this.domainStack = new DomainStack(this, `DomainStack`, {
      parentDomain: props.parentDomain,
      subDomain: props.subDomain,
      authDomain: props.authDomain,
      siteDomain: props.siteDomain,
      apiDomain: props.apiDomain,
      tldHostedZoneId: props.hostedZoneId,
      enableAuthentication: props.enableAuthentication,
    });

    // ===============================================================
    // Cloudfront infrastructure
    // ===============================================================

    if (props.enableAuthentication && this.permissionsStack?.edgeLambdaRole) {
      this.edgeLambdaStack = new EdgeLambdaStack(this, `EdgeLambdaStack`, {
        parentDomain: props.parentDomain,
        subDomain: props.subDomain,
        edgeLambdaRole: this.permissionsStack.edgeLambdaRole,
      });
    }

    this.siteDistributionStack = new SiteDistributionStack(
      this,
      `SiteDistributionStack`,
      {
        parentDomain: props.parentDomain,
        subDomain: props.subDomain,
        siteCertificate: this.domainStack.siteCertificate,
        siteHostedZone: this.domainStack.siteHostedZone,
        bucketAssetPaths: [path.join(__dirname, "../../dist")],
        authentication: {
          callbackHandler: this.edgeLambdaStack?.callbackHandler,
          defaultHandler: this.edgeLambdaStack?.defaultHandler,
        },
      }
    );

    // ===============================================================
    // Cognito infrastructure
    // ===============================================================

    if (
      props.enableAuthentication &&
      this.domainStack.authCertificate &&
      this.domainStack.authHostedZone
    ) {
      this.authStack = new AuthStack(this, `AuthStack`, {
        parentDomain: props.parentDomain,
        subDomain: props.subDomain,
        authDomain: props.authDomain,
        siteDomain: props.siteDomain,
        authCertificate: this.domainStack.authCertificate,
        authHostedZone: this.domainStack.authHostedZone,
      });
    }

    // ===============================================================
    // API infrastructure
    // ===============================================================

    this.apiStack = new ApiStack(this, `ApiStack`, {
      parentDomain: props.parentDomain,
      subDomain: props.subDomain,
      siteDomain: props.siteDomain,
      apiDomain: props.apiDomain,
      siteDistribution: this.siteDistributionStack.distribution,
      apiHostedZone: this.domainStack.apiHostedZone,
      apiCertificate: this.domainStack.apiCertificate,
      userPool: this.authStack?.userPool,
      enableApiLogs: props.enableApiLogging,
      enableApiTracing: props.enableApiTracing,
    });

    // ===============================================================
    // Parameters
    // ===============================================================

    this.parametersStack = new ParametersStack(this, `ParametersStack`, {
      parentDomain: props.parentDomain,
      subDomain: props.subDomain,
      apiDomain: props.apiDomain,
      siteDomain: props.siteDomain,
      edgeLambdaRole: this.permissionsStack?.edgeLambdaRole,
      loginURL: this.authStack?.loginURL,
      userPool: this.authStack?.userPool,
      userPoolClient: this.authStack?.userPoolClient,
      userPoolDomain: this.authStack?.userPoolDomain,
      restApi: this.apiStack.restApi,
      restApiCorsOptions: this.apiStack.corsOptions,
      authorizer: this.apiStack.authorizer,
    });
  }
}
