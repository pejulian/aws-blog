import { Construct } from "constructs";

import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib/core";

import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";

import {
  ARecord,
  HostedZone,
  NsRecord,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";

export interface DomainStackProps extends NestedStackProps {
  tldHostedZoneId: string;
  parentDomain: string;
  subDomain: string;
  siteDomain: string;
  authDomain: string;
  apiDomain: string;
  enableAuthentication: boolean;
}

export class DomainStack extends NestedStack {
  private readonly _authCertificate: Certificate | undefined;
  private readonly _siteCertificate: Certificate;
  private readonly _apiCertificate: Certificate;

  private readonly _authHostedZone: HostedZone | undefined;
  private readonly _siteHostedZone: HostedZone;
  private readonly _apiHostedZone: HostedZone;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack provisioning hosted zones and SSL certs for subsite`,
    });

    // ==============================================================================
    // Subdomain hosted zones
    // ==============================================================================

    if (props.enableAuthentication) {
      this._authHostedZone = new HostedZone(this, `AuthHostedZone`, {
        zoneName: props.authDomain,
        comment: `The hosted zone for the auth domain ${props.authDomain}`,
      });

      if (this._authHostedZone.hostedZoneNameServers == null) {
        throw new Error(
          `No hosted zone name servers found for ${props.authDomain}`
        );
      }
    }

    this._siteHostedZone = new HostedZone(this, `SiteHostedZone`, {
      zoneName: props.siteDomain,
      comment: `The hosted zone for the site ${props.siteDomain}`,
    });

    if (this._siteHostedZone.hostedZoneNameServers == null) {
      throw new Error(
        `No hosted zone name servers found for ${props.siteDomain}`
      );
    }

    this._apiHostedZone = new HostedZone(this, `ApiHostedZone`, {
      zoneName: props.apiDomain,
      comment: `The hosted zone for the api domain ${props.apiDomain}`,
    });

    if (this._apiHostedZone.hostedZoneNameServers == null) {
      throw new Error(
        `No hosted zone name servers found for ${props.apiDomain}`
      );
    }

    const tldHostedZone = HostedZone.fromHostedZoneAttributes(
      this,
      `TopLevelDomainHostedZone`,
      {
        hostedZoneId: props.tldHostedZoneId,
        zoneName: props.parentDomain,
      }
    );

    // ==============================================================================
    // Cognito custom domain enablement
    //
    // https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-add-custom-domain.html
    // ==============================================================================

    new ARecord(this, `ParentDomainIpRecord`, {
      zone: tldHostedZone,
      recordName: `${props.parentDomain}`,
      target: RecordTarget.fromIpAddresses("127.0.0.1"),
      ttl: Duration.seconds(60),
    });

    // ==============================================================================
    // Subdomain traffic delegation records
    // ==============================================================================

    if (
      props.enableAuthentication &&
      this._authHostedZone?.hostedZoneNameServers
    ) {
      new NsRecord(this, `AuthHostedZoneDelegationRecord`, {
        values: this._authHostedZone.hostedZoneNameServers,
        zone: tldHostedZone,
        recordName: props.authDomain,
      });
    }

    new NsRecord(this, `SiteHostedZoneDelegationRecord`, {
      values: this._siteHostedZone.hostedZoneNameServers,
      zone: tldHostedZone,
      recordName: props.siteDomain,
    });

    new NsRecord(this, `ApiHostedZoneDelegationRecord`, {
      values: this._apiHostedZone.hostedZoneNameServers,
      zone: tldHostedZone,
      recordName: props.apiDomain,
    });

    // ==============================================================================
    // Certificates for subdomains created
    // ==============================================================================

    if (props.enableAuthentication && this._authHostedZone) {
      this._authCertificate = new Certificate(this, `AuthSubdomainCert`, {
        domainName: props.authDomain,
        validation: CertificateValidation.fromDns(this._authHostedZone),
      });
    }

    this._siteCertificate = new Certificate(this, `SiteSubdomainCertificate`, {
      domainName: props.siteDomain,
      validation: CertificateValidation.fromDns(this._siteHostedZone),
    });

    this._apiCertificate = new Certificate(this, `ApiSubdomainCertificate`, {
      domainName: props.apiDomain,
      validation: CertificateValidation.fromDns(this._apiHostedZone),
    });
  }

  get authCertificate(): Certificate | undefined {
    return this._authCertificate;
  }

  get authHostedZone(): HostedZone | undefined {
    return this._authHostedZone;
  }

  get siteCertificate(): Certificate {
    return this._siteCertificate;
  }

  get siteHostedZone(): HostedZone {
    return this._siteHostedZone;
  }

  get apiCertificate(): Certificate {
    return this._apiCertificate;
  }

  get apiHostedZone(): HostedZone {
    return this._apiHostedZone;
  }
}
