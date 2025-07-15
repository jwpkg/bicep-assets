import { app } from '@azure/functions';
import { wrapCachedResource, wrapAction } from 'azure-custom-resources';

import { ConfigurationAction } from './configuration';
import { DeployAssetsCrp } from './deploy-assets';
import { UploadAssetsSas } from './upload-assets-sas';

app.http('deploy-asset', wrapCachedResource(new DeployAssetsCrp()));
app.http('associations', wrapCachedResource(new DeployAssetsCrp(), 'associations/{*segments}'));
app.http('config', wrapAction(new ConfigurationAction()));
app.http('upload-assets-sas', wrapAction(new UploadAssetsSas()));
