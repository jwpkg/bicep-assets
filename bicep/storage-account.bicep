param location string = resourceGroup().location
param storageAccountName string = 'bicepassets${uniqueString(resourceGroup().id)}'
param storageAccountAssetsUserRoleName string = 'BicepAssetsUser'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

// A storage account can only have one blob storage
resource storageAccountBlobService 'Microsoft.Storage/storageAccounts/blobServices@2022-09-01' = {
  name: 'default'
  parent: storageAccount
}

// A blob can have zero or more containers
resource storageAccountAssetContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: 'assets'
  parent: storageAccountBlobService
}


resource customRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(storageAccountAssetsUserRoleName)
  properties: {
    roleName: storageAccountAssetsUserRoleName
    description: 'Custom role to allow reading, creating, and writing assets in the assets blob container.'
    type: 'CustomRole'
    permissions: [
      {
        actions: []
        notActions: []
        dataActions: [
          'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read'
          'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write'
        ]
        notDataActions: []        
      }
    ]
    assignableScopes: [
      resourceGroup().id
    ]
  }
}
