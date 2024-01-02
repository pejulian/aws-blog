import { Construct } from "constructs";
import {
  Duration,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
} from "aws-cdk-lib/core";

import {
  AllowedMethods,
  Distribution,
  GeoRestriction,
  LambdaEdgeEventType,
  OriginAccessIdentity,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";

import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";

import {
  Bucket,
  BucketAccessControl,
  BucketEncryption,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";

import { Certificate } from "aws-cdk-lib/aws-certificatemanager";

import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

import { experimental } from "aws-cdk-lib/aws-cloudfront";

import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";

import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

import { Role } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

export interface SiteDistributionStackProps extends NestedStackProps {
  subDomain: string;
  parentDomain: string;
  siteCertificate: Certificate;
  siteHostedZone: HostedZone;
  distributionPriceClass?: PriceClass;
  distributionGeoRestriction?: Array<string>;
  bucketAssetPaths: Array<string>;
  enableLogging?: boolean;
  authentication?: Readonly<{
    callbackHandler?: experimental.EdgeFunction;
    defaultHandler?: experimental.EdgeFunction;
  }>;
  geolocationCountryCode?: string;
}

export class SiteDistributionStack extends NestedStack {
  private oai: OriginAccessIdentity;

  private readonly _siteBucket: Bucket;
  private readonly _loggingBucket: Bucket | undefined;
  private readonly _distribution: Distribution;

  constructor(scope: Construct, id: string, props: SiteDistributionStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Site distribution nested stack`,
    });

    const siteDomain = `${props.subDomain}.${props.parentDomain}`;

    if (props.enableLogging) {
      this._loggingBucket = new Bucket(this, `LoggingBucket`, {
        bucketName: `${props.subDomain}-cloudfront-logs`,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
        accessControl: BucketAccessControl.PRIVATE,
        objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
        versioned: false,
        lifecycleRules: [
          {
            id: `${props.subDomain}CloudfrontAccessLogsRotation`,
            enabled: true,
            expiration: Duration.days(1),
          },
        ],
      });
    }

    // ==============================================================================
    // Site bucket and deployment
    // ==============================================================================

    this._siteBucket = new Bucket(this, `SiteBucket`, {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
      bucketName: `${props.subDomain}-site-bucket-${this.account}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      accessControl: BucketAccessControl.PRIVATE,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    new BucketDeployment(this, `SiteBucketDeployment`, {
      destinationBucket: this._siteBucket,
      destinationKeyPrefix: "site",
      logRetention: RetentionDays.ONE_DAY,
      sources: props.bucketAssetPaths.map((assetPath) => {
        return Source.asset(assetPath);
      }),
    });

    // ==============================================================================
    // Origin access identity (Legacy)
    // ==============================================================================

    this.oai = new OriginAccessIdentity(this, "OriginAccessIdentity");
    this._siteBucket.grantRead(this.oai);

    // ==============================================================================
    // Site CDN
    // ==============================================================================

    this._distribution = new Distribution(this, `SiteDistribution`, {
      defaultRootObject: "index.html",
      priceClass: props.distributionPriceClass ?? PriceClass.PRICE_CLASS_100,
      geoRestriction: props.distributionGeoRestriction
        ? GeoRestriction.allowlist(...props.distributionGeoRestriction)
        : GeoRestriction.allowlist("MY"),
      comment: `Distribution for ${siteDomain}`,
      domainNames: [`${siteDomain}`],
      certificate: props.siteCertificate,
      enableLogging: props.enableLogging,
      ...(props.enableLogging && {
        logBucket: this._loggingBucket,
        logFilePrefix: `${props.subDomain}`,
      }),
      defaultBehavior: {
        origin: new S3Origin(this._siteBucket, {
          originPath: "site",
          originAccessIdentity: this.oai,
        }),
        responseHeadersPolicy:
          ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
        originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN, // https://stackoverflow.com/questions/59431476/aws-s3-signaturedoesnotmatch-error-during-get-request-through-cloudfront
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        ...(props.authentication?.defaultHandler && {
          edgeLambdas: [
            {
              eventType: LambdaEdgeEventType.VIEWER_REQUEST,
              functionVersion:
                props.authentication.defaultHandler.currentVersion,
            },
          ],
        }),
      },
      additionalBehaviors: {
        [`/callback`]: {
          origin: new S3Origin(this._siteBucket, {
            originPath: "site",
            originAccessIdentity: this.oai,
          }),
          responseHeadersPolicy:
            ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
          originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN, // https://stackoverflow.com/questions/59431476/aws-s3-signaturedoesnotmatch-error-during-get-request-through-cloudfront
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          ...(props.authentication?.callbackHandler && {
            edgeLambdas: [
              {
                eventType: LambdaEdgeEventType.VIEWER_REQUEST,
                functionVersion:
                  props.authentication.callbackHandler.currentVersion,
              },
            ],
          }),
        },
      },
    });

    new ARecord(this, `CloudfrontRecord`, {
      zone: props.siteHostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this._distribution)),
      comment: `Alias record for ${siteDomain}`,
      ttl: Duration.seconds(60),
    });
  }

  get distribution(): Distribution {
    return this._distribution;
  }

  get siteBucket(): Bucket {
    return this._siteBucket;
  }

  get logginBucket(): Bucket | undefined {
    return this._loggingBucket;
  }
}
