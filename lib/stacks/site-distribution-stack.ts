import { Construct } from "constructs";
import {
  CfnOutput,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib/core";

import {
  Distribution,
  GeoRestriction,
  OriginAccessIdentity,
  PriceClass,
} from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  Bucket,
  BucketAccessControl,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

export interface SiteDistributionStackProps extends StackProps {
  certificateArn: string;
  siteSubDomain: string;
  siteDomain: string;
  distributionPriceClass?: PriceClass;
  distributionGeoRestriction?: Array<string>;
  bucketAssetPaths: Array<string>;
}

export class SiteDistributionStack extends Stack {
  private oai: OriginAccessIdentity;
  private _bucket: Bucket;
  private bucketDeployment: BucketDeployment;
  private _distribution: Distribution;

  constructor(scope: Construct, id: string, props: SiteDistributionStackProps) {
    super(scope, id, {
      ...props,
      stackName: `${props.siteSubDomain}CloudfrontStack`,
      description: `[${props.siteSubDomain}] Site distribution stack`,
      crossRegionReferences: true,
    });

    this._bucket = new Bucket(this, `SiteBucket`, {
      bucketName: `${props.siteSubDomain}.${props.siteDomain}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      accessControl: BucketAccessControl.PRIVATE,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    this.bucketDeployment = new BucketDeployment(this, `SiteBucketDeployment`, {
      destinationBucket: this._bucket,
      sources: props.bucketAssetPaths.map((assetPath) => {
        return Source.asset(assetPath);
      }),
    });

    this.oai = new OriginAccessIdentity(this, "OriginAccessIdentity");

    this._bucket.grantRead(this.oai);

    const certificate = Certificate.fromCertificateArn(
      this,
      `SiteCertificate`,
      props.certificateArn
    );

    this._distribution = new Distribution(this, `SiteDistribution`, {
      defaultRootObject: "index.html",
      priceClass: props.distributionPriceClass ?? PriceClass.PRICE_CLASS_200,
      geoRestriction: props.distributionGeoRestriction
        ? GeoRestriction.allowlist(...props.distributionGeoRestriction)
        : GeoRestriction.allowlist("MY"),
      comment: `Distribution for ${props.siteSubDomain}.${props.siteDomain}`,
      domainNames: [`${props.siteSubDomain}.${props.siteDomain}`],
      certificate,
      enableLogging: false,
      defaultBehavior: {
        origin: new S3Origin(this._bucket),
      },
    });

    new CfnOutput(this, `SiteBucketExport`, {
      value: this._bucket.bucketArn,
      exportName: `${props.siteSubDomain}SiteBucket`,
    });

    new CfnOutput(this, `SiteDistributionId`, {
      value: this._distribution.distributionId,
      exportName: `${props.siteSubDomain}DistributionId`,
    });

    new CfnOutput(this, `SiteDistributionDomainName`, {
      value: this._distribution.distributionDomainName,
      exportName: `${props.siteSubDomain}DistributionDomainName`,
    });
  }

  get distribution(): Distribution {
    return this._distribution;
  }

  get bucket(): Bucket {
    return this._bucket;
  }
}
