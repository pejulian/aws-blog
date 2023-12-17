import * as cdk from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface PermissionsStackProps extends StackProps {
  siteSubDomain: string;
}

export class PermissionsStack extends Stack {
  private _edgeLambdaRole: Role;

  constructor(scope: Construct, id: string, props: PermissionsStackProps) {
    super(scope, id, props);

    const ssmGetParameterPolicy = new ManagedPolicy(
      this,
      "SsmGetParameterPolicy",
      {
        managedPolicyName: `${props.siteSubDomain}SsmGetParameterPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["ssm:GetParameter"],
            resources: ["*"],
          }),
        ],
      }
    );

    const cloudWatchLogsPolicy = new ManagedPolicy(this, "CwLogsPolicy", {
      managedPolicyName: `${props.siteSubDomain}CwLogsPolicy`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: [`arn:${this.partition}:logs:*:*:*`],
        }),
      ],
    });

    const secretsManagerPolicy = new ManagedPolicy(
      this,
      "SecretsManagerPolicy",
      {
        managedPolicyName: `${props.siteSubDomain}SecretsManagerPolicy`,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: [
              `arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:${props.siteSubDomain}*`,
            ],
          }),
        ],
      }
    );

    this._edgeLambdaRole = new Role(this, "EdgeLambdaRole", {
      roleName: `${props.siteSubDomain}EdgeLambdaRole`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        cloudWatchLogsPolicy,
        ssmGetParameterPolicy,
        secretsManagerPolicy,
      ],
    });

    this._edgeLambdaRole.grantAssumeRole(
      new ServicePrincipal("edgelambda.amazonaws.com")
    );
  }

  get edgeLambdaRole(): Role {
    return this._edgeLambdaRole;
  }
}
