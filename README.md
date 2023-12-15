# Static sub site

This IaC deploys the specified sub site under the given apex domain.

## Pre-requisites

- You should own a valid registered domain
- You should have (and own) the HostedZone for the apex domain.
- This code should be able to write the subdomain record into the apex domain's hosted zone as an A record

## For jucy.julian-pereira.com

For example, to create the sub-site `jucy.julian-pereira.com`, pass the following context values:

> Use the pre-made `cdk-*.sh` scripts in the repository root to reduce manual steps for deployment

---

> Replace `pejulian-iam@335952011029` with the relevant profile stored in your `~/.aws/credentials`

---

Synthesize cloudformation template:

```bash
./cdk-synth.sh pejulian-iam@335952011029 ap-southeast-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "siteDomain=julian-pereira.com" --context "siteSubDomain=jucy"
```

---

Bootstrap:

```bash
./cdk-bootstrap.sh pejulian-iam@335952011029 ap-southeast-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "siteDomain=julian-pereira.com" --context "siteSubDomain=jucy"
```

---

Deploy:

```bash
./cdk-deploy.sh pejulian-iam@335952011029 ap-southeast-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "siteDomain=julian-pereira.com" --context "siteSubDomain=jucy"
```

---

Destroy

```bash
./cdk-deploy.sh pejulian-iam@335952011029 ap-southeast-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "siteDomain=julian-pereira.com" --context "siteSubDomain=jucy"
```
