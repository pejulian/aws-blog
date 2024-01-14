import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";

import {
  ArnFormat,
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
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AssetsStackProps extends NestedStackProps {
  subDomain: string;
  parentDomain: string;
  apiDomain: string;
  siteDomain: string;
  bucket: Bucket;
}

const ESM_REQUIRE_SHIM =
  'await(async()=>{let{dirname:e}=await import(\\"path\\"),{fileURLToPath:i}=await import(\\"url\\");if(typeof globalThis.__filename>\\"u\\"&&(globalThis.__filename=i(import.meta.url)),typeof globalThis.__dirname>\\"u\\"&&(globalThis.__dirname=e(globalThis.__filename)),typeof globalThis.require>\\"u\\"){let{default:a}=await import(\\"module\\");globalThis.require=a.createRequire(import.meta.url)}})();';

export class AssetsStack extends NestedStack {
  private readonly _accessBucketAccessPoint: AccessPoint;
  private readonly _assetsBucketAccessPointHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props: AssetsStackProps) {
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

    const accessPoint = Stack.of(this).formatArn({
      resource: "accesspoint",
      resourceName: `${props.bucket.bucketName}-ap`,
      service: "s3",
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    });

    console.log(`accessPoint`, accessPoint);

    this._assetsBucketAccessPointHandler = new NodejsFunction(
      this,
      `AssetsBucketAccessPointFunction`,
      {
        entry: path.join(
          __dirname,
          "../../../src/site/assets/object-lambda/index.ts"
        ),
        handler: "handler",
        timeout: Duration.minutes(1),
        bundling: {
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: false,
          banner: ESM_REQUIRE_SHIM,
        },
      }
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
      `AccessBucketAccessPoint`,
      {
        bucket: props.bucket,
        handler: this._assetsBucketAccessPointHandler,
        accessPointName: `${props.bucket.bucketName}-access-point`,
        supportsGetObjectPartNumber: true,
        supportsGetObjectRange: true,
        payload: {
          foo: "bar",
        },
      }
    );
  }
}
