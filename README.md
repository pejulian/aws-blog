# Static sub site

This infrastructure as code (IaC) deploys a  sub site under a given parent domain.

## Pre-requisites

- You should own a valid registered top level domain (e.g `julian-pereira.com`)
- You should first create a public hosted zone in Route53 for the top level domain. The hosted zone should act as the DNS service of your domian. If your domain registrar is not Route53, follow [this](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/migrate-dns-domain-in-use.html) guide to make Route53 the DNS service for a domain registered outside AWS. 
- This deployment should use a role that can write records for traffic delegation into the parent domain's hosted zone as an NS record. This is because the REST API and authentication features of this implementation will both also be created as subdomains under the parent domain.  

## For hello.julian-pereira.com

For example, to create the sub-site `hello.julian-pereira.com`, pass the following context values:

> Use the pre-made `cdk-*.sh` scripts in the repository root to reduce manual steps for deployment

---

The deployment requires a role that has relevant access to provision all required resources on the target account. 

The examples below assume you have configured a role on your local machine to accomplish this. 

> Replace `my-iam@012345678912` with a relevant named profile stored in `~/.aws/credentials`

---

The examples below deploys the solution to the US N. Virginia region (`us-east-1`). Change this if needed. 

---

Synthesize cloudformation template:

```bash
./cdk-synth.sh my-iam@012345678912 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=hello" --context "enableAuthentication=true"
```

> This does not deploy anything. The command will only create the necessary Cloudformation templates and package all assets locally to be ready for deployment. You can use this command to verify that your code compiles properly and that CDK is able to generate Cloudformation templates for deployment. 

---

Bootstrap:

```bash
./cdk-bootstrap.sh my-iam@012345678912 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=hello" --context "enableAuthentication=true"
```

---

Deploy:

```bash
./cdk-deploy.sh my-iam@012345678912 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=hello" --context "enableAuthentication=true"
```

---

Destroy

```bash
./cdk-destroy.sh my-iam@012345678912 us-east-1 --context "hostedZoneId=Z01113202LCYIASZV1KVG" --context "parentDomain=julian-pereira.com" --context "subDomain=hello" --context "enableAuthentication=true"
```
