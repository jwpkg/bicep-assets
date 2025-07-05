import { Asset } from './types.bicep'

@description('Generates a SAS URL for downloading an asset from Azure Storage.')
param asset Asset

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

output assetSasUrl string = 'https://${asset.storageAccountName}.blob.${environment().suffixes.storage}/${asset.containerName}/${asset.filename}?${downloadSAS}'
