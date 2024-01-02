import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

import { IApiKey } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";

export interface GetApiKeyConstructProps {
  apiKey: IApiKey;
}

export class GetApiKeyConstruct extends Construct {
  public apiKeyValue: string;

  constructor(scope: Construct, id: string, props: GetApiKeyConstructProps) {
    super(scope, id);

    console.log("apiKeyId", props.apiKey.keyId);

    const apiKey: AwsSdkCall = {
      service: "api-gateway",
      action: "GetApiKey",
      parameters: {
        apiKey: props.apiKey.keyId,
        includeValue: true,
      },
      physicalResourceId: PhysicalResourceId.of(`APIKey:${props.apiKey.keyId}`),
    };

    const apiKeyCustomResource = new AwsCustomResource(
      this,
      "ApiKeyCustomResource",
      {
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [props.apiKey.keyArn],
            actions: ["apigateway:GET"],
          }),
        ]),
        logRetention: RetentionDays.ONE_DAY,
        onCreate: apiKey,
        onUpdate: apiKey,
      }
    );

    apiKeyCustomResource.node.addDependency(props.apiKey);
    this.apiKeyValue = apiKeyCustomResource.getResponseField("value");

    console.log("apiKeyValue", this.apiKeyValue);
  }
}
