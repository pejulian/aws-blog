import path from "path";

import { Construct } from "constructs";

import { Stack, StackProps } from "aws-cdk-lib/core";

import { SiteDistributionStack } from "./stacks/site-distribution-stack";
import { DomainStack } from "./stacks/domain-stack";
import { RouteStack } from "./stacks/route-stack";

export interface MainStackProps extends StackProps {
  hostedZoneId: string;
  siteDomain: string;
  siteSubDomain: string;
}

export class MainStack extends Stack {
  private domainStack: DomainStack;
  private siteDistributionStack: SiteDistributionStack;
  private routeStack: RouteStack;

  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    this.domainStack = new DomainStack(this, `DomainStack`, {
      siteDomain: props.siteDomain,
      siteSubDomain: props.siteSubDomain,
      hostedZoneId: props.hostedZoneId,
      env: {
        account: props.env?.account,
        region: "us-east-1", // hardcoded to us-east-1 because SSL certs for Cloudfront must be created there
      },
    });

    this.siteDistributionStack = new SiteDistributionStack(
      this,
      `BucketStack`,
      {
        siteDomain: props.siteDomain,
        siteSubDomain: props.siteSubDomain,
        bucketAssetPaths: [path.join(__dirname, "../dist")],
        certificateArn: this.domainStack.certificate.certificateArn,
        env: {
          account: props.env?.account,
          region: props.env?.region,
        },
      }
    );

    this.routeStack = new RouteStack(this, `RouteStack`, {
      siteDomain: props.siteDomain,
      siteSubDomain: props.siteSubDomain,
      hostedZoneId: props.hostedZoneId,
      distributionId: this.siteDistributionStack.distribution.distributionId,
      distributionName:
        this.siteDistributionStack.distribution.distributionDomainName,
      env: {
        account: props.env?.account,
        region: props.env?.region,
      },
    });

    this.routeStack.addDependency(this.siteDistributionStack);
  }
}
