import * as cdk from "aws-cdk-lib";
import { DockerImage, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Architecture, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { EdgeFunction } from "aws-cdk-lib/aws-cloudfront/lib/experimental";
import { Role } from "aws-cdk-lib/aws-iam";

interface EdgeLambdaStackProps extends StackProps {
  roleArn: string;
  siteSubDomain: string;
}

export class EdgeLambdaStack extends Stack {
  private readonly _defaultHandler: EdgeFunction;
  private readonly _callbackHandler: EdgeFunction;

  constructor(scope: Construct, id: string, props: EdgeLambdaStackProps) {
    super(scope, id, props);

    const role = Role.fromRoleArn(this, `EdgeLambdaRole`, props.roleArn);

    this._defaultHandler = new EdgeFunction(this, "DefaultHandler", {
      functionName: `${props.siteSubDomain}DefaultHandler`,
      handler: "app.lambdaHandler",
      architecture: Architecture.X86_64,
      runtime: Runtime.NODEJS_LATEST,
      memorySize: 128,
      role,
      code: Code.fromAsset(path.join(__dirname, "../../"), {
        bundling: {
          command: [
            "/bin/sh",
            "-c",
            "mkdir -p /asset-input/target" +
              `&& esbuild src/function/default-handler/app.ts \
              --outfile=/asset-input/target/app.js \
              --platform=node \
              --minify \
              --bundle \
              --sourcemap ` +
              "&& cp -a /asset-input/target/. /asset-output/",
          ],
          image: DockerImage.fromBuild(path.resolve(__dirname, "../../")),
        },
      }),
    });

    this._callbackHandler = new EdgeFunction(this, "CallbackHandler", {
      functionName: `${props.siteSubDomain}CallbackHandler`,
      handler: "app.lambdaHandler",
      architecture: Architecture.X86_64,
      runtime: Runtime.NODEJS_LATEST,
      memorySize: 128,
      role,
      code: Code.fromAsset(path.join(__dirname, "../../"), {
        bundling: {
          command: [
            "/bin/sh",
            "-c",
            "mkdir -p /asset-input/target" +
              `&& esbuild src/function/callback-handler/app.ts \
              --outfile=/asset-input/target/app.js \
              --platform=node \
              --minify \
              --bundle \
              --sourcemap ` +
              "&& cp -a /asset-input/target/. /asset-output/",
          ],
          image: DockerImage.fromBuild(path.resolve(__dirname, "../../")),
        },
      }),
    });
  }

  public get defaultHandler(): EdgeFunction {
    return this._defaultHandler;
  }

  public get callbackHandler(): EdgeFunction {
    return this._callbackHandler;
  }
}
