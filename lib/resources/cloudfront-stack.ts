import { Construct } from "constructs";
import { Fn, Stack, StackProps } from "aws-cdk-lib";

import {
  Distribution,
  GeoRestriction,
  OriginAccessIdentity,
  PriceClass,
} from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Bucket } from "aws-cdk-lib/aws-s3";

export interface CloudfrontStackProps extends StackProps {
  bucketExportName: string;
}

export class CloudfrontStack extends Stack {
  private oai: OriginAccessIdentity;
  private distribution: Distribution;

  constructor(scope: Construct, id: string, props: CloudfrontStackProps) {
    super(scope, id, props);

    const siteBucket = Bucket.fromBucketArn(
      this,
      `JucyBucket`,
      Fn.importValue(props.bucketExportName),
    );

    this.oai = new OriginAccessIdentity(this, "OriginAccessIdentity");

    siteBucket.grantRead(this.oai);

    this.distribution = new Distribution(this, `SiteDistribution`, {
      defaultRootObject: "index.html",
      priceClass: PriceClass.PRICE_CLASS_100,
      geoRestriction: GeoRestriction.allowlist("MY", "SG"),
      comment: `Distribution for Jucy!`,
      defaultBehavior: {
        origin: new S3Origin(siteBucket),
      },
    });
  }
}
