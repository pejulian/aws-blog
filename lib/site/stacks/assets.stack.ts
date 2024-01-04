import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";

import {
  Arn,
  ArnFormat,
  Duration,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
} from "aws-cdk-lib/core";
import { BlockPublicAccess, Bucket, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  AnyPrincipal,
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import {
  AuthorizationType,
  LambdaIntegration,
  Resource,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AssetsStackProps extends NestedStackProps {
  subDomain: string;
  parentDomain: string;
  apiDomain: string;
  siteDomain: string;
  enableAuthentication: boolean;
}

export class AssetsStack extends NestedStack {
  private readonly _assetsBucket: Bucket;
  private readonly _fileUploaderFunction: NodejsFunction;
  private readonly _fileUploaderRole: Role;
  private readonly _uploadResource: Resource;

  constructor(scope: Construct, id: string, props: AssetsStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack defining storage for site assets uploaded by users`,
    });

    const restApi = RestApi.fromRestApiAttributes(this, `RestApi`, {
      restApiId: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/api/id`
      ),
      rootResourceId: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/api/rootResourceId`
      ),
      restApiName: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/api/name`
      ),
    });

    const CORS_ENV_VARS = {
      ACCESS_CONTROL_ALLOW_CREDENTIALS: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/cors/allowCredentials`
      ),
      ACCESS_CONTROL_ALLOW_ORIGIN: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/cors/allowOrigins`
      ),
      ACCESS_CONTROL_ALLOW_HEADERS: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/cors/allowHeaders`
      ),
      ACCESS_CONTROL_ALLOW_METHODS: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/cors/allowMethods`
      ),
      ACCESS_CONTROL_EXPOSE_HEADERS: StringParameter.valueForStringParameter(
        this,
        `/${props.apiDomain}/rest/cors/exposeHeaders`
      ),
    };

    const ESM_REQUIRE_SHIM =
      'await(async()=>{let{dirname:e}=await import(\\"path\\"),{fileURLToPath:i}=await import(\\"url\\");if(typeof globalThis.__filename>\\"u\\"&&(globalThis.__filename=i(import.meta.url)),typeof globalThis.__dirname>\\"u\\"&&(globalThis.__dirname=e(globalThis.__filename)),typeof globalThis.require>\\"u\\"){let{default:a}=await import(\\"module\\");globalThis.require=a.createRequire(import.meta.url)}})();';

    const siteDomain = `${props.subDomain}.${props.parentDomain}`;

    const assetsBucketName = `${props.subDomain}-assets-bucket-${this.account}`;
    this._assetsBucket = new Bucket(this, `AssetsBucket`, {
      bucketName: assetsBucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    // this._assetsBucket.addToResourcePolicy(
    //   new PolicyStatement({
    //     sid: `listObjectsForUser`,
    //     principals: [new AnyPrincipal()],
    //     effect: Effect.ALLOW,
    //     actions: ["s3:ListBucket"],
    //     resources: [
    //       Arn.format({
    //         arnFormat: ArnFormat.NO_RESOURCE_NAME,
    //         service: "s3",
    //         account: this.account,
    //         region: this.region,
    //         partition: this.partition,
    //         resource: assetsBucketName,
    //       }),
    //     ],
    //     conditions: {
    //       StringLike: {
    //         "s3:prefix": ["images/${cognito-identity.amazonaws.com:sub}/*"],
    //       },
    //     },
    //   })
    // );

    // this._assetsBucket.addToResourcePolicy(
    //   new PolicyStatement({
    //     sid: `crudObjectsForUser`,
    //     principals: [new AnyPrincipal()],
    //     effect: Effect.ALLOW,
    //     actions: ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
    //     resources: [
    //       [
    //         Arn.format({
    //           arnFormat: ArnFormat.NO_RESOURCE_NAME,
    //           service: "s3",
    //           account: this.account,
    //           region: this.region,
    //           partition: this.partition,
    //           resource: assetsBucketName,
    //         }),
    //         "images/",
    //         "${cognito-identity.amazonaws.com:sub",
    //         "*",
    //       ].join("/"),
    //     ],
    //   })
    // );

    this._fileUploaderRole = new Role(this, `FileUploaderRole`, {
      roleName: `${props.subDomain}FileUplaoderRole`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      description: `File uploader lambda execution role for ${props.subDomain}.${props.parentDomain}`,
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          `service-role/AWSLambdaBasicExecutionRole`
        ),
        ManagedPolicy.fromAwsManagedPolicyName(`AWSXRayDaemonWriteAccess`),
        new ManagedPolicy(
          this,
          `${props.subDomain}FileUploaderPresignedPostAccess`,
          {
            description: `Managed policy that allows the users of ${siteDomain} to create pre-signed upload URLs`,
            statements: [
              new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["s3:GetObject", "s3:PutObject"],
                resources: [this.assetsBucket.arnForObjects("*")],
              }),
            ],
          }
        ),
      ],
    });

    this._fileUploaderFunction = new NodejsFunction(
      this,
      `FileUploaderFunction`,
      {
        entry: path.join(__dirname, "../../../src/site/uploader/index.ts"),
        handler: "handler",
        timeout: Duration.seconds(28),
        role: this._fileUploaderRole,
        bundling: {
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: false,
          banner: ESM_REQUIRE_SHIM,
        },
        environment: {
          SUB_DOMAIN: props.subDomain,
          PARENT_DOMAIN: props.parentDomain,
          SITE_DOMAIN: props.siteDomain,
          ASSET_BUCKET_NAME: this.assetsBucket.bucketName,
          ASSET_BUCKET_ARN: this.assetsBucket.bucketArn,
          ...CORS_ENV_VARS,
        },
      }
    );

    this._uploadResource = restApi.root.addResource("upload");

    this._uploadResource.addMethod(
      "POST",
      new LambdaIntegration(this._fileUploaderFunction, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
        ...(props.enableAuthentication && {
          authorizer: {
            authorizerId: StringParameter.valueForStringParameter(
              this,
              `/${props.apiDomain}/rest/api/authorizerId`
            ),
            authorizationType: AuthorizationType.COGNITO,
          },
        }),
      }
    );

    this._uploadResource.addCorsPreflight({
      allowOrigins: CORS_ENV_VARS.ACCESS_CONTROL_ALLOW_ORIGIN.split(","),
      allowCredentials:
        CORS_ENV_VARS.ACCESS_CONTROL_ALLOW_CREDENTIALS === "true",
      allowHeaders: CORS_ENV_VARS.ACCESS_CONTROL_ALLOW_HEADERS.split(","),
      allowMethods: CORS_ENV_VARS.ACCESS_CONTROL_ALLOW_METHODS.split(","),
      exposeHeaders: CORS_ENV_VARS.ACCESS_CONTROL_EXPOSE_HEADERS.split(","),
    });
  }

  get assetsBucket(): Bucket {
    return this._assetsBucket;
  }
}
