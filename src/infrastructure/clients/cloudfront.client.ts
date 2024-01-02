import {
  CloudFrontClient as Client,
  GetDistributionCommand,
  CloudFrontClientConfig,
  GetDistributionCommandOutput,
} from "@aws-sdk/client-cloudfront";

export class CloudfrontClient {
  private readonly client: Client;

  private readonly _distributionCache: {
    [key: string]: GetDistributionCommandOutput["Distribution"];
  } = {};

  constructor(options: CloudFrontClientConfig = {}) {
    this.client = new Client(options);
  }

  /**
   * Obtains the domain name associated to this distribution based on the distribution id
   * @param id
   * @returns
   */
  async getAlias(id: string): Promise<string> {
    let distribution: GetDistributionCommandOutput["Distribution"];
    if (this._distributionCache[id]) {
      distribution = this._distributionCache[id];
    } else {
      distribution = (
        await this.client.send(new GetDistributionCommand({ Id: id }))
      ).Distribution;

      this._distributionCache[id] = distribution;
    }

    return distribution?.AliasICPRecordals?.[0].CNAME ?? "";
  }
}

// (async () => {
//   const credentials = (await import("@aws-sdk/credential-providers")).fromIni({
//     profile: `pejulian-iam@335952011029`,
//   });

//   const client = new CloudfrontClient({
//     credentials,
//     region: `ap-southeast-1`,
//   });

//   const domainName = await client.getDistributionDomainName(`E1VWJPNWXTH2V5`);
// })();
