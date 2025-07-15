import { InvocationContext } from '@azure/functions';
import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';
import AdmZip from 'adm-zip';
import { CacheHandler, Request, RequestInputError } from 'azure-custom-resources';
import mime from 'mime';
import { join } from 'path';
import * as t from 'typanion';

/* eslint-disable @typescript-eslint/naming-convention */
const isCopyAssetRequest = t.isObject({
  extensionId: t.isOptional(t.isString()),
  action: t.isLiteral('copy'),
  asset_filename: t.isString(),
  target_account_name: t.isString(),
  target_account_sas: t.isString(),
  target_account_container: t.isString(),
  target_account_filename: t.isString(),
});
/* eslint-enable @typescript-eslint/naming-convention */

type CopyAssetRequest = t.InferType<typeof isCopyAssetRequest>;

/* eslint-disable @typescript-eslint/naming-convention */
const isExtractAssetRequest = t.isObject({
  extensionId: t.isOptional(t.isString()),
  action: t.isLiteral('extract'),
  asset_filename: t.isString(),
  target_account_name: t.isString(),
  target_account_sas: t.isString(),
  target_account_container: t.isString(),
  target_account_folder: t.isOptional(t.isString()),
});
/* eslint-enable @typescript-eslint/naming-convention */

type ExtractAssetRequest = t.InferType<typeof isExtractAssetRequest>;

/* eslint-disable @typescript-eslint/naming-convention */
const isGenerateAssetSasUrlRequest = t.isObject({
  extensionId: t.isOptional(t.isString()),
  action: t.isLiteral('sas-url'),
  asset_filename: t.isString(),
  expirationSeconds: t.cascade(t.isNumber(), t.isInteger()),
});
/* eslint-enable @typescript-eslint/naming-convention */

type GenerateAssetSasUrlRequest = t.InferType<typeof isGenerateAssetSasUrlRequest>;

const isAssetRequest = t.isOneOf([
  isCopyAssetRequest,
  isExtractAssetRequest,
  isGenerateAssetSasUrlRequest,
]);

const assetClient = BlobServiceClient.fromConnectionString(process.env.ASSET_CONNECTIONSTRING!).getContainerClient('assets');

export class DeployAssetsCrp implements CacheHandler {
  constructor() {}

  async createUpdate(request: Request, context: InvocationContext) {
    const errors: string[] = [];
    if (!isAssetRequest(request.properties, { errors })) {
      context.error('Validation errors', errors);
      throw new RequestInputError('Invalid request. Request is not a valid asset deployment request');
    }

    if (isCopyAssetRequest(request.properties)) {
      return this.copyAsset(request.properties, context);
    }

    if (isExtractAssetRequest(request.properties)) {
      return this.extractAsset(request.properties, context);
    }

    if (isGenerateAssetSasUrlRequest(request.properties)) {
      return this.generateAssetSasUrl(request.properties, context);
    }

    throw new RequestInputError('Unknown request type');
  }

  async copyAsset(request: CopyAssetRequest, _context: InvocationContext) {
    const targetClient = new BlobServiceClient(`https://${request.target_account_name}.blob.core.windows.net?${request.target_account_sas}`);

    try {
      await targetClient.createContainer(request.target_account_container);
    } catch (_error) {

    }
    const targetContainerClient =  targetClient.getContainerClient(request.target_account_container);

    const blobClient = assetClient.getBlobClient(request.asset_filename);
    const targetBlobClient = targetContainerClient.getBlobClient(request.target_account_filename);

    if (await targetBlobClient.exists()) {
      const properties = await targetBlobClient.getProperties();
      if (properties.metadata && 'source_asset_filename' in properties.metadata) {
        if (properties.metadata.source_asset_filename === request.asset_filename) {
          return {
            updated: {},
          };
        }
      }
    }

    const operation = await targetBlobClient.beginCopyFromURL(await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.from({ read: true }),
      expiresOn: new Date(Date.now() + 60000),
    }));
    await operation.pollUntilDone();

    await targetBlobClient.setMetadata({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      source_asset_filename: request.asset_filename,
    });

    // always return updated. We do not care about cleanup of created resources in this scenario
    return {
      updated: {},
    };
  }

  async extractAsset(request: ExtractAssetRequest, _context: InvocationContext) {
    const targetClient = new BlobServiceClient(`https://${request.target_account_name}.blob.core.windows.net?${request.target_account_sas}`);

    try {
      await targetClient.createContainer(request.target_account_container);
    } catch (_error) {

    }
    const targetContainerClient =  targetClient.getContainerClient(request.target_account_container);
    await targetContainerClient.createIfNotExists();

    const blobClient = assetClient.getBlobClient(request.asset_filename);


    const zipBuffer = await blobClient.downloadToBuffer();
    const zip = new AdmZip(zipBuffer);

    for (const entry of zip.getEntries()) {
      const data = entry.getData();

      const fileName = request.target_account_folder ? join(request.target_account_folder, entry.entryName) : entry.entryName;
      await targetContainerClient.uploadBlockBlob(fileName, data, data.length, {
        blobHTTPHeaders: {
          blobContentType: mime.getType(fileName) ?? undefined,
        },
      });
    }

    // always return updated. We do not care about cleanup of created resources in this scenario
    return {
      updated: {},
    };
  }

  async generateAssetSasUrl(request: GenerateAssetSasUrlRequest, _context: InvocationContext) {
    const blobClient = assetClient.getBlobClient(request.asset_filename);

    const url = await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.from({ read: true }),
      expiresOn: new Date(Date.now() + (request.expirationSeconds * 1000)),
    });

    // always return updated. We do not care about cleanup of created resources in this scenario
    return {
      updated: {
        properties: {
          downloadSasUrl: url,
        },
      },
    };
  }

  async delete(_request: Request, _context: InvocationContext) {
    return;
  }

  async retrieve(_request: Request, _context: InvocationContext) {
    return {};
  }
}
