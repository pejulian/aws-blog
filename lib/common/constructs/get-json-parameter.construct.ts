import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

import { Construct } from "constructs";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { ArnFormat, Stack } from "aws-cdk-lib/core";

export interface GetJsonParameterConstructProps {
  parameterName: string;
  region: string;
  withDecryption?: boolean;
}

export class GetJsonParameterConstruct extends Construct {
  public jsonParameterValue: string;

  constructor(
    scope: Construct,
    id: string,
    props: GetJsonParameterConstructProps
  ) {
    super(scope, id);

    const jsonParameter: AwsSdkCall = {
      service: "ssm",
      action: "GetParameter",
      parameters: {
        Name: props.parameterName,
        WithDecription: props.withDecryption,
      },
      region: props.region,
      physicalResourceId: PhysicalResourceId.of(
        `Parameter:${props.parameterName
          .replaceAll(".", "")
          .replaceAll("/", "")}`
      ),
    };

    const jsonParameterCustomResource = new AwsCustomResource(
      this,
      "ApiKeyCustomResource",
      {
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [
              Stack.of(this).formatArn({
                region: props.region,
                service: "ssm",
                resource: "parameter",
                resourceName: props.parameterName,
                arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
              }),
            ],
            actions: ["ssm:GetParameter"],
          }),
        ]),
        logRetention: RetentionDays.ONE_DAY,
        onCreate: jsonParameter,
        onUpdate: jsonParameter,
      }
    );

    jsonParameterCustomResource.node.addDependency(props.parameterName);

    if (
      typeof jsonParameterCustomResource.getResponseField("value") ===
      "undefined"
    ) {
      throw new Error(`${props.parameterName} is undefined or empty`);
    }

    console.log(jsonParameterCustomResource.getResponseField("value"));

    this.jsonParameterValue =
      jsonParameterCustomResource.getResponseField("value");
  }
}
