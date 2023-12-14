import path from "path";

import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";

import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import {
  Bucket,
  BucketAccessControl,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

export class JucyStack extends Stack {
  private bucket: Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, `${id}-site-bucket`, {
      bucketName: `${id}-site-content`,
      accessControl: BucketAccessControl.PRIVATE,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
    });

    new BucketDeployment(this, `${id}-site-bucket-deployment`, {
      destinationBucket: this.bucket,
      sources: [Source.asset(path.resolve(__dirname, "./dist"))],
    });
  }
}
