import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";

import {
  Duration,
  NestedStack,
  NestedStackProps,
  Stack,
} from "aws-cdk-lib/core";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { AccessPoint } from "@aws-cdk/aws-s3objectlambda-alpha";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  AccountRootPrincipal,
  AnyPrincipal,
  ManagedPolicy,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ThumbnailStackProps extends NestedStackProps {
  subDomain: string;
  bucket: Bucket;
  logLevel?: string;
}

const ESM_REQUIRE_SHIM =
  'await(async()=>{let{dirname:e}=await import(\\"path\\"),{fileURLToPath:i}=await import(\\"url\\");if(typeof globalThis.__filename>\\"u\\"&&(globalThis.__filename=i(import.meta.url)),typeof globalThis.__dirname>\\"u\\"&&(globalThis.__dirname=e(globalThis.__filename)),typeof globalThis.require>\\"u\\"){let{default:a}=await import(\\"module\\");globalThis.require=a.createRequire(import.meta.url)}})();';

export class ThumbnailStack extends NestedStack {
  private readonly _accessBucketAccessPoint: AccessPoint;
  private readonly _assetsBucketAccessPointHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props: ThumbnailStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack defining storage for site assets uploaded by users`,
    });

    props.bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ["s3:Get*", "s3:Put*", "s3:List*"],
        principals: [new AnyPrincipal()],
        resources: [props.bucket.bucketArn, props.bucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "s3:DataAccessPointAccount": Stack.of(this).account,
          },
        },
      })
    );

    this._assetsBucketAccessPointHandler = new NodejsFunction(
      this,
      `AssetsBucketAccessPointFunction`,
      {
        functionName: `AssetsBucketAccessPointFunction`,
        description: `S3 Object lambda function that handles resizing of images in the ${props.bucket.bucketName} bucket into thumbnails`,
        entry: path.join(
          __dirname,
          "../../../src/site/assets/object-lambda/index.ts"
        ),
        architecture: Architecture.ARM_64,
        handler: "handler",
        runtime: Runtime.NODEJS_20_X,
        memorySize: 256,
        environment: {
          POWERTOOLS_LOG_LEVEL: props.logLevel ?? "ERROR",
          POWERTOOLS_SERVICE_NAME: `AssetsThumbnailObjectLambda`,
        },
        timeout: Duration.minutes(1),
        bundling: {
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: false,
          banner: ESM_REQUIRE_SHIM,
          externalModules: ["sharp"],
        },
      }
    );

    this._assetsBucketAccessPointHandler.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        `service-role/AWSLambdaBasicExecutionRole`
      )
    );

    // only allow this account to call this lambda
    this._assetsBucketAccessPointHandler.addPermission(
      `invocationRestriction`,
      {
        action: "lambda:InvokeFunction",
        principal: new AccountRootPrincipal(),
        sourceAccount: Stack.of(this).account,
      }
    );

    this._accessBucketAccessPoint = new AccessPoint(
      this,
      `AssetsBucketAccessPoint`,
      {
        bucket: props.bucket,
        handler: this._assetsBucketAccessPointHandler,
        accessPointName: `thumbnail-generator-access-point`,
        supportsGetObjectPartNumber: true,
        supportsGetObjectRange: true,
        payload: {
          foo: "bar",
        },
      }
    );

    this.exportValue(this._accessBucketAccessPoint.accessPointArn, {
      name: `AssetsBucketAccessPointArn`,
    });
  }

  get accessPoint(): AccessPoint {
    return this._accessBucketAccessPoint;
  }
}
