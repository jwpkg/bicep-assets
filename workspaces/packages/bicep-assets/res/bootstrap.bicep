import { connectionString } from 'utils.bicep'

@minLength(5)
@maxLength(20)
param resourcePrefix string



var storageAccountName = 'bicepassets${uniqueString(resourceGroup().id, resourcePrefix)}'



resource assetStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: resourceGroup().location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Cool'
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true    
  }
}

// Create blob service
resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: assetStorage
}


// Create container
resource assetContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: 'assets'
  parent: blobServices
  properties: {
    publicAccess: 'None'
    metadata: {}
  }
}


output storageAccountName string = assetStorage.name
