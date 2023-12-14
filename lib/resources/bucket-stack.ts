import path from "path";

import { Construct } from "constructs";
import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";

import {
  Bucket,
  BucketAccessControl,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

export class BucketStack extends Stack {

  public static readonly BUCKET_EXPORT_NAME = 'JucySiteBucket';

  private bucket: Bucket;
  private bucketDeployment: BucketDeployment;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, `SiteBucket`, {
      bucketName: `${id}-site-content`,
      removalPolicy: RemovalPolicy.DESTROY,
      accessControl: BucketAccessControl.PRIVATE,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
    });

    this.bucketDeployment = new BucketDeployment(this, `SiteBucketDeployment`, {
      destinationBucket: this.bucket,
      sources: [Source.asset(path.resolve(__dirname, "./dist"))],
    });

    new CfnOutput(this, `SiteBucketExport`, {
      value: this.bucket.bucketArn,
      exportName: BucketStack.BUCKET_EXPORT_NAME,
    });
  }
}
