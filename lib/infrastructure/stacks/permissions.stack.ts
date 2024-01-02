import { NestedStack, NestedStackProps } from "aws-cdk-lib/core";

import {
  CompositePrincipal,
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

import { Construct } from "constructs";

import { EdgeLambdaStack } from "./edge-lambda.stack.js";

interface PermissionsStackProps extends NestedStackProps {
  parentDomain: string;
  subDomain: string;
}

export class PermissionsStack extends NestedStack {
  public static readonly EDGE_LAMBDA_ROLE_SUFFIX = "EdgeLambdaRole";

  private _edgeLambdaRole: Role;

  constructor(scope: Construct, id: string, props: PermissionsStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack that provisions relevant IAM lambda execution role(s) and permissions`,
    });

    const sanitizedSiteName = `${props.subDomain}-${props.parentDomain}`
      .replace(".", "-")
      .replace(" ", "");

    const cloudfrontPolicy = new ManagedPolicy(this, "CloudfrontPolicy", {
      managedPolicyName: `${props.subDomain}CloudfrontPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["cloudfront:GetDistribution"],
          resources: ["*"],
        }),
      ],
    });

    const ssmGetParameterPolicy = new ManagedPolicy(
      this,
      "SsmGetParameterPolicy",
      {
        managedPolicyName: `${props.subDomain}SsmGetParameterPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["ssm:GetParameter"],
            resources: ["*"],
          }),
        ],
      }
    );

    /**
     * Permissions and naming for Lambda@Edge log groups are important to avoid cryptic errors
     *
     * https://dev.to/aws-builders/authorizing-requests-with-lambdaedge-mjm
     */
    const cloudWatchLogsPolicy = new ManagedPolicy(this, "CwLogsPolicy", {
      managedPolicyName: `${props.subDomain}CwLogsPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["logs:CreateLogGroup"],
          resources: [`arn:${this.partition}:logs:*:${this.account}:*`],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
          resources: [
            `arn:${this.partition}:logs:*:${this.account}:log-group:/aws/lambda/${sanitizedSiteName}-${EdgeLambdaStack.DEFAULT_HANDLER_SUFFIX}:*`,
            `arn:${this.partition}:logs:*:${this.account}:log-group:/aws/lambda/us-east-1.${sanitizedSiteName}-${EdgeLambdaStack.DEFAULT_HANDLER_SUFFIX}:*`,
            `arn:${this.partition}:logs:*:${this.account}:log-group:/aws/lambda/${sanitizedSiteName}-${EdgeLambdaStack.CALLBACK_HANDLER_SUFFIX}:*`,
            `arn:${this.partition}:logs:*:${this.account}:log-group:/aws/lambda/us-east-1.${sanitizedSiteName}-${EdgeLambdaStack.CALLBACK_HANDLER_SUFFIX}:*`,
          ],
        }),
      ],
    });

    const secretsManagerPolicy = new ManagedPolicy(
      this,
      "SecretsManagerPolicy",
      {
        managedPolicyName: `${props.subDomain}SecretsManagerPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "secretsmanager:GetResourcePolicy",
              "secretsmanager:GetSecretValue",
              "secretsmanager:DescribeSecret",
              "secretsmanager:ListSecretVersionIds",
            ],
            resources: [
              `arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:${props.subDomain}.${props.parentDomain}/*`,
            ],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["secretsmanager:ListSecrets"],
            resources: [`*`],
          }),
        ],
      }
    );

    this._edgeLambdaRole = new Role(this, "EdgeLambdaRole", {
      roleName: `${props.subDomain}${PermissionsStack.EDGE_LAMBDA_ROLE_SUFFIX}`,
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("lambda.amazonaws.com"),
        new ServicePrincipal("edgelambda.amazonaws.com")
      ),
      managedPolicies: [
        cloudWatchLogsPolicy,
        ssmGetParameterPolicy,
        secretsManagerPolicy,
        cloudfrontPolicy,
      ],
      description: `The role for Lambda@Edge functions used in the ${props.subDomain} distribution`,
    });

    this._edgeLambdaRole.grantAssumeRole(
      new CompositePrincipal(
        new ServicePrincipal("lambda.amazonaws.com"),
        new ServicePrincipal("edgelambda.amazonaws.com")
      )
    );
  }

  get edgeLambdaRole(): Role {
    return this._edgeLambdaRole;
  }
}
