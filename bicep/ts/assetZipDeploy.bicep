import { Asset } from './types.bicep'
@description('Asset for which to generate a SAS URL')
param asset Asset

@description('Name of the Function App to deploy the asset to')
param functionAppName string

resource assetStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: asset.storageAccountName
  scope: resourceGroup(asset.subscription, asset.resourceGroup)
}

param baseTime string = utcNow('u')

var downloadSAS = assetStorage.listAccountSas('2023-05-01',{
  signedProtocol: 'https'
  signedPermission: 'rl'
  signedResourceTypes: 'o'
  signedServices: 'b'
  signedExpiry: dateTimeAdd(baseTime, 'PT1H')
}).accountSasToken

resource functionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: functionAppName
}

resource zipDeploy 'Microsoft.Web/sites/extensions@2023-12-01' = {
  name: any('ZipDeploy')
  parent: functionApp
  properties: {
    packageUri: 'https://${asset.storageAccountName}.blob.${environment().suffixes.storage}/${asset.containerName}/${asset.filename}?${downloadSAS}'
  }
}
