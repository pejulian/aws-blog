import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";
import {
  DockerImage,
  Duration,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
} from "aws-cdk-lib/core";
import { experimental } from "aws-cdk-lib/aws-cloudfront";
import { Architecture, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { Role } from "aws-cdk-lib/aws-iam";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EdgeLambdaStackProps extends NestedStackProps {
  subDomain: string;
  parentDomain: string;
  edgeLambdaRole: Role;
}

export class EdgeLambdaStack extends NestedStack {
  public static readonly DEFAULT_HANDLER_SUFFIX = `default-handler`;
  public static readonly CALLBACK_HANDLER_SUFFIX = `callback-handler`;

  private readonly _defaultHandler: experimental.EdgeFunction;
  private readonly _callbackHandler: experimental.EdgeFunction;

  constructor(scope: Construct, id: string, props: EdgeLambdaStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack for creating edge lambdas for the site distribution`,
    });

    const siteDomain = `${props.subDomain}.${props.parentDomain}`;

    const sanitizedSiteName = `${props.subDomain}-${props.parentDomain}`
      .replace(".", "-")
      .replace(" ", "");

    const ESM_REQUIRE_SHIM =
      'await(async()=>{let{dirname:e}=await import(\\"path\\"),{fileURLToPath:i}=await import(\\"url\\");if(typeof globalThis.__filename>\\"u\\"&&(globalThis.__filename=i(import.meta.url)),typeof globalThis.__dirname>\\"u\\"&&(globalThis.__dirname=e(globalThis.__filename)),typeof globalThis.require>\\"u\\"){let{default:a}=await import(\\"module\\");globalThis.require=a.createRequire(import.meta.url)}})();';

    const edgeFunctionProps = (
      options: Readonly<{
        currentVersionDescription: string;
        assetInputFolderName: string;
        handlerPath: string;
      }>
    ): Pick<
      experimental.EdgeFunctionProps,
      | "handler"
      | "architecture"
      | "runtime"
      | "memorySize"
      | "timeout"
      | "role"
      | "currentVersionOptions"
      | "code"
    > => ({
      handler: "index.handler",
      architecture: Architecture.X86_64, // Lambda@Edge currently does not support ARM architecture
      runtime: Runtime.NODEJS_20_X,
      memorySize: 128, // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-lambda-at-edge
      timeout: Duration.seconds(5), // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-lambda-at-edge
      role: props.edgeLambdaRole,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
        description: options.currentVersionDescription,
      },
      code: Code.fromAsset(path.join(__dirname, "../../../"), {
        bundling: {
          command: [
            "/bin/sh",
            "-c",
            [
              `mkdir -p /asset-input/${options.assetInputFolderName}`,
              `esbuild ${options.handlerPath} --outfile=/asset-input/${
                options.assetInputFolderName
              }/index.js --platform=node --format=esm --target=esnext --minify --bundle --sourcemap --external:@aws-sdk/* --banner:js="/* ${new Date().toUTCString()} */${ESM_REQUIRE_SHIM}"`,
              `cp -a /asset-input/${options.assetInputFolderName}/. /asset-output/`,
              `jq -n --arg appname "${siteDomain}" '{ name: $appname, type: "module" }' > ./${options.assetInputFolderName}/package.json`,
            ].join(" && "),
          ],
          image: DockerImage.fromBuild(path.resolve(__dirname, "../../../")),
        },
      }),
    });

    this._defaultHandler = new experimental.EdgeFunction(
      this,
      "DefaultHandler",
      {
        ...edgeFunctionProps({
          currentVersionDescription: `Default viewer request handler for ${siteDomain}`,
          assetInputFolderName: "default-target",
          handlerPath: "src/infrastructure/handlers/default.handler.ts",
        }),
        functionName: `${sanitizedSiteName}-${EdgeLambdaStack.DEFAULT_HANDLER_SUFFIX}`,
        description: `Default viewer request handler for ${siteDomain}`,
      }
    );

    this._callbackHandler = new experimental.EdgeFunction(
      this,
      "CallbackHandler",
      {
        ...edgeFunctionProps({
          currentVersionDescription: `Cognito user pool authentication callback handler for ${siteDomain}`,
          assetInputFolderName: "callback-target",
          handlerPath: "src/infrastructure/handlers/callback.handler.ts",
        }),
        functionName: `${sanitizedSiteName}-${EdgeLambdaStack.CALLBACK_HANDLER_SUFFIX}`,
        description: `Cognito user pool authentication callback handler for ${siteDomain}`,
      }
    );
  }

  get callbackHandler(): experimental.EdgeFunction {
    return this._callbackHandler;
  }

  get defaultHandler(): experimental.EdgeFunction {
    return this._defaultHandler;
  }
}
