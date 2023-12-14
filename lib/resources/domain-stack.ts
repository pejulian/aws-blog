import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";

export interface DomainStackProps extends StackProps {
  domainName: string;
  siteSubDomain: string;
  certificateArn: string;
}

export class DomainStack extends Stack {
  private certificate: Certificate;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    const hostedZoneId = StringParameter.valueForStringParameter(
      this,
      `/julian-pereira.com/HostedZoneId`,
    );

    const siteDomain = StringParameter.valueForStringParameter(
      this,
      `/julian-pereira.com/SiteDomain`,
    );

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, `HostedZone`, {
      hostedZoneId: hostedZoneId,
      zoneName: siteDomain,
    });

    this.certificate = new Certificate(this, `JucySiteCertificate`, {
      domainName: siteDomain,
      subjectAlternativeNames: [`jucy.${siteDomain}`],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    
  }
}
