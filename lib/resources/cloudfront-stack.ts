import { Construct } from "constructs";
import { CfnOutput, Fn, Stack, StackProps } from "aws-cdk-lib";

import {
  Distribution,
  GeoRestriction,
  OriginAccessIdentity,
  PriceClass,
} from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

export interface CloudfrontStackProps extends StackProps {
  bucketExportName: string;
  certificateArn: string;
}

export class CloudfrontStack extends Stack {
  public static readonly DISTRIBUTION_ID_EXPORT_NAME = "JucyDistributionId";
  public static readonly DISTRIBUTION_DOMAIN_NAME_EXPORT_NAME =
    "JucyDistributionDomainName";

  private oai: OriginAccessIdentity;
  private distribution: Distribution;

  constructor(scope: Construct, id: string, props: CloudfrontStackProps) {
    super(scope, id, props);

    const siteBucket = Bucket.fromBucketArn(
      this,
      `JucyBucket`,
      Fn.importValue(props.bucketExportName),
    );

    const siteDomain = StringParameter.valueForStringParameter(
      this,
      `/julian-pereira.com/SiteDomain`,
    );

    const certificate = Certificate.fromCertificateArn(
      this,
      `SiteCertificate`,
      props.certificateArn,
    );

    this.oai = new OriginAccessIdentity(this, "OriginAccessIdentity");

    siteBucket.grantRead(this.oai);

    this.distribution = new Distribution(this, `SiteDistribution`, {
      defaultRootObject: "index.html",
      priceClass: PriceClass.PRICE_CLASS_200,
      geoRestriction: GeoRestriction.allowlist("MY", "SG"),
      comment: `Distribution for Jucy!`,
      domainNames: [`jucy.${siteDomain}`],
      certificate,
      enableLogging: false,
      defaultBehavior: {
        origin: new S3Origin(siteBucket),
      },
    });

    // Add alias record in hosted zone to map jucy.julian-pereira.com to this cloudfront distribution

    new CfnOutput(this, `SiteDistributionId`, {
      value: this.distribution.distributionId,
      exportName: CloudfrontStack.DISTRIBUTION_ID_EXPORT_NAME,
    });

    new CfnOutput(this, `SiteDistributionDomainName`, {
      value: this.distribution.distributionDomainName,
      exportName: CloudfrontStack.DISTRIBUTION_DOMAIN_NAME_EXPORT_NAME,
    });
  }
}
