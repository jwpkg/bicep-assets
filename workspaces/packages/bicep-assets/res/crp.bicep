param version string

var zipDeployContainerName = 'zipdeploy'
var zipDeployBlobName = 'bicep-assets-crp.zip'

// // Create container
// resource zipDeployContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
//   name: zipDeployContainerName
//   parent: blobServices
//   properties: {
//     publicAccess: 'None'
//     metadata: {}
//   }
// }

// resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
//   name: '${resourcePrefix}-hp'
//   location: resourceGroup().location
//   sku: {
//     name: 'Y1'
//     tier: 'Dynamic'
//   }
//   properties: {}
// }

// resource crpFunctionApp 'Microsoft.Web/sites@2023-12-01' = {
//   name: '${resourcePrefix}-fa'
//   location: resourceGroup().location
//   kind: 'functionapp'  
//   identity: {
//     type: 'SystemAssigned'
//   }
//   properties: {
//     serverFarmId: hostingPlan.id
//     siteConfig: {  
//       appSettings: [
//         {
//           name: 'AzureWebJobsStorage'
//           value: connectionString(assetStorage.name, assetStorage.listKeys())
//         }
//         {
//           name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
//           value: connectionString(assetStorage.name, assetStorage.listKeys())
//         }
//         {
//           name: 'ASSET_CONNECTIONSTRING'
//           value: connectionString(assetStorage.name, assetStorage.listKeys())
//         }
//         {
//           name: 'BICEP_ASSETS_VERSION'
//           value: version
//         }
//         {
//           name: 'WEBSITE_CONTENTSHARE'
//           value: toLower('${resourcePrefix}-fa')
//         }
//         {
//           name: 'FUNCTIONS_EXTENSION_VERSION'
//           value: '~4'
//         }
//         {
//           name: 'WEBSITE_NODE_DEFAULT_VERSION'
//           value: '~20'
//         }
//         {
//           name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
//           value: applicationInsights.properties.InstrumentationKey
//         }
//         {
//           name: 'FUNCTIONS_WORKER_RUNTIME'
//           value: 'node'
//         }
//       ]
//       ftpsState: 'FtpsOnly'
//       minTlsVersion: '1.2'
//     }
//     httpsOnly: true
//   }
// }

// var functionUrl = 'https://${crpFunctionApp.name}.azurewebsites.net/api'

// resource assetDeploymentProvider 'Microsoft.CustomProviders/resourceProviders@2018-09-01-preview' = {
//   location: resourceGroup().location
//   name: '${resourcePrefix}-crp'
//   properties: {
//     resourceTypes: [
//       {
//         name: 'deploy-asset'
//         routingType: 'Proxy,Cache'
//         endpoint: '${functionUrl}/deploy-asset'
//       }
//       {
//         name: 'associations'
//         routingType: 'Proxy,Cache,Extension'
//         endpoint: '${functionUrl}/associations'
//       }
//     ]
//     actions: [
//       {
//         name: 'listConfiguration'
//         routingType: 'Proxy'
//         endpoint: '${functionUrl}/config'
//       }
//       {
//         name: 'uploadAssetsSas'
//         routingType: 'Proxy'
//         endpoint: '${functionUrl}/upload-assets-sas'
//       }
//     ]
//   }
// }

// resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
//   name: '${resourcePrefix}-ws'
//   location: resourceGroup().location
// }

// resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
//   name: '${resourcePrefix}-ai'
//   location: resourceGroup().location
//   kind: 'web'
//   properties: {
//     Application_Type: 'web'
//     publicNetworkAccessForIngestion: 'Enabled'
//     publicNetworkAccessForQuery: 'Enabled'
//     WorkspaceResourceId: logAnalyticsWorkspace.id
//   }
// }


// param baseTime string = utcNow('u')

// // var downloadSAS = assetStorage.listServiceSas('2023-05-01',{
// //   signedProtocol: 'https'
// //   signedResource: 'f'
// //   signedPermission: 'rl'
// //   signedExpiry: dateTimeAdd(baseTime, 'PT1H')
// //   canonicalizedResource: '/${zipDeployContainerName}/${zipDeployBlobName}'
// // }).serviceSasToken

// // var uploadCRPSAS = assetStorage.listServiceSas('2023-05-01',{
// //   signedProtocol: 'https'
// //   signedResource: 'f'
// //   signedPermission: 'wl'
// //   signedExpiry: dateTimeAdd(baseTime, 'PT1H')  
// //   canonicalizedResource: '/${zipDeployContainerName}/${zipDeployBlobName}'
// // }).serviceSasToken

// var downloadSAS = assetStorage.listAccountSas('2023-05-01',{
//   signedProtocol: 'https'
//   signedPermission: 'rl'
//   signedResourceTypes: 'o'
//   signedServices: 'b'
//   signedExpiry: dateTimeAdd(baseTime, 'PT1H')
// }).accountSasToken

// var uploadCRPSAS = assetStorage.listAccountSas('2023-05-01',{
//   signedProtocol: 'https'
//   signedPermission: 'wlacu'
//   signedResourceTypes: 'sco'
//   signedServices: 'b'
//   signedExpiry: dateTimeAdd(baseTime, 'PT1H')
// }).accountSasToken

// resource zipDeploy 'Microsoft.Web/sites/extensions@2023-12-01' = if (execZipDeploy) {
//   name: any('ZipDeploy')
//   parent: crpFunctionApp
//   properties: {
//     packageUri: 'https://${storageAccountName}.blob.${environment().suffixes.storage}/${zipDeployContainerName}/${zipDeployBlobName}?${downloadSAS}'
//   }
// }
// output resourceProviderId string = assetDeploymentProvider.id
// output uploadCRPUrl string = 'https://${storageAccountName}.blob.${environment().suffixes.storage}/${zipDeployContainerName}/${zipDeployBlobName}?${uploadCRPSAS}'
