import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';
import * as t from 'typanion';

const assetContainerClient = BlobServiceClient.fromConnectionString(process.env.ASSET_CONNECTIONSTRING!).getContainerClient('assets');

const isUploadRequest = t.isObject({
  assets: t.isArray(t.isString()),
});

export async function generateSas (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const principalId = request.headers.get('x-ms-client-principal-id');
  const principalName = request.headers.get('x-ms-client-principal-name');

  if (!principalId) {
    return {
      status: 401,
      body: 'Unauthorized: Missing client principal 2' + JSON.stringify(process.env),
    };
  }

  const requestContent = request.body ? await request.json() : {};
  console.log(`Request content: ${JSON.stringify(requestContent)}`);

  if (!isUploadRequest(requestContent)) {
    return {
      status: 400,
      body: 'Invalid request format. Expected an object with an "assets" array.',
    };
  }

  context.log(`Request by principalId: ${principalId}, principalName: ${principalName}`);

  const sasPromises = requestContent.assets.map(assetFilename => generateSasUrl(assetFilename)).filter(client => client !== null);
  const allUrls = await Promise.all(sasPromises);
  const result: Record<string, string> = allUrls.reduce((p: Record<string, string>, c) => {
    c = {
      ...c,
      ...p,
    };
    return c;
  }, {});

  return {
    status: 200,
    jsonBody: {
      assets: result,
    } 
  };

}

async function generateSasUrl(assetFilename: string) {
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
