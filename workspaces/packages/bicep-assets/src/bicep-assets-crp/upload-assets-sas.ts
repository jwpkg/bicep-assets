import { InvocationContext } from '@azure/functions';
import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';
import { ActionHandler, Request, CacheResponse, RequestInputError } from 'azure-custom-resources';
import * as t from 'typanion';

const isUploadRequest = t.isObject({
  assets: t.isArray(t.isString()),
});

const assetContainerClient = BlobServiceClient.fromConnectionString(process.env.ASSET_CONNECTIONSTRING!).getContainerClient('assets');

export class UploadAssetsSas implements ActionHandler {
  async execute(request: Request, _context: InvocationContext): Promise<CacheResponse> {
    if (!isUploadRequest(request.properties)) {
      throw new RequestInputError('Invalid request');
    }

    const sasPromises = request.properties.assets.map(assetFilename => this.generateSas(assetFilename)).filter(client => client !== null);
    const allUrls = await Promise.all(sasPromises);
    const result: Record<string, string> = allUrls.reduce((p: Record<string, string>, c) => {
      c = {
        ...c,
        ...p,
      };
      return c;
    }, {});

    return {
      properties: {
        assets: result,
      },
    };
  }

  async generateSas(assetFilename: string) {
    const assetBlobClient = assetContainerClient.getBlobClient(assetFilename);
    if (!await assetBlobClient.exists()) {
      return {
        [assetFilename]: await assetBlobClient.generateSasUrl({
          permissions: BlobSASPermissions.from({
            write: true,
            create: true,
          }),
          expiresOn: new Date(Date.now() + 60000),
        }),
      };
    } else {
      return null;
    }
  }
}
