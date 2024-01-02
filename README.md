# Static sub site

This IaC deploys the specified sub site under the given apex domain.

## Pre-requisites

- You should own a valid registered domain (e.g `julian-pereira.com`)
- You should own the above top-level domain
- This deployment should be able to write subdomain records for traffic delegation into the apex domain's hosted zone as an NS record

## For jucy.julian-pereira.com

For example, to create the sub-site `jucy.julian-pereira.com`, pass the following context values:

> Use the pre-made `cdk-*.sh` scripts in the repository root to reduce manual steps for deployment

---

> Replace `pejulian-iam@335952011029` with the relevant profile stored in your `~/.aws/credentials`

---

Synthesize cloudformation template:

```bash
./cdk-synth.sh pejulian-iam@335952011029 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=jucy" --context "enableAuthentication=true"
```

---

Bootstrap:

```bash
./cdk-bootstrap.sh pejulian-iam@335952011029 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=jucy" --context "enableAuthentication=true"
```

---

Deploy:

```bash
./cdk-deploy.sh pejulian-iam@335952011029 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=jucy" --context "enableAuthentication=true"
```

---

Destroy

```bash
./cdk-destroy.sh pejulian-iam@335952011029 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=jucy" --context "enableAuthentication=true"
```
