import { Construct } from "constructs";
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
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
  public static readonly CERTIFICATE_ARN_EXPORT_NAME = `JucyCertificate`;

  private certificate: Certificate;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, { ...props, description: `[jucy] Domain and certificate stack` });

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

    new CfnOutput(this, `SiteCertificateExport`, {
      value: this.certificate.certificateArn,
      exportName: DomainStack.CERTIFICATE_ARN_EXPORT_NAME,
    });
  }
}
