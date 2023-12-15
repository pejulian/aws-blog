import { Construct } from "constructs";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";

export interface RouteStackProps extends StackProps {
  siteDomain: string;
  siteSubDomain: string;
  hostedZoneId: string;
  distributionId: string;
  distributionName: string;
}

export class RouteStack extends Stack {
  constructor(scope: Construct, id: string, props: RouteStackProps) {
    super(scope, id, {
      ...props,
      stackName: `${props.siteSubDomain}RouteStack`,
      description: `[${props.siteSubDomain}] Route stack`,
    });

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, `HostedZone`, {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.siteDomain,
    });

    const distribution = Distribution.fromDistributionAttributes(
      this,
      `SiteDistribution`,
      {
        distributionId: props.distributionId,
        domainName: props.distributionName,
      }
    );

    new ARecord(this, `AliasRecord`, {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      comment: `Alias record for ${props.siteSubDomain}.${props.siteDomain}`,
      recordName: props.siteSubDomain,
      ttl: Duration.seconds(60),
    });
  }
}
