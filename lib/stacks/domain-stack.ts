import { Construct } from "constructs";
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";

export interface DomainStackProps extends StackProps {
  siteDomain: string;
  siteSubDomain: string;
  hostedZoneId: string;
}

export class DomainStack extends Stack {
  private _certificate: Certificate;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, {
      ...props,
      stackName: `${props.siteSubDomain}DomainStack`,
      description: `[${props.siteSubDomain}] Domain and certificate stack`,
    });

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, `HostedZone`, {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.siteDomain,
    });

    this._certificate = new Certificate(this, `SiteCertificate`, {
      domainName: props.siteDomain,
      subjectAlternativeNames: [`${props.siteSubDomain}.${props.siteDomain}`],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    new CfnOutput(this, `SiteCertificateExport`, {
      value: this._certificate.certificateArn,
      exportName: `${props.siteSubDomain}Certificate`,
    });
  }

  get certificate(): Certificate {
    return this._certificate;
  }
}
