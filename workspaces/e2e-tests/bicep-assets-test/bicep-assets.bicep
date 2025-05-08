

@export()
type Asset = {
  storageAccountName: string
  subscription: string
  resourceGroup: string
  containerName: string
  filename: string
}
    
@export() 
var assets = {
  test_folder: {
        subscription: '5cbc3b4c-c4d3-4adb-a492-c29f133c4516'
        resourceGroup: 'ne-bicep-assets-rg'
        storageAccountName: 'bicepassetsxgzgav3cnanza'
        containerName: 'assets'
        filename: '6d2da615601a9c1020fe5b37b021c5c77e966baa.zip'
      }
 bicep_assets_config_yaml: {
        subscription: '5cbc3b4c-c4d3-4adb-a492-c29f133c4516'
        resourceGroup: 'ne-bicep-assets-rg'
        storageAccountName: 'bicepassetsxgzgav3cnanza'
        containerName: 'assets'
        filename: '7e6966e9f9d3d5cd8706321b1fdc0319e977eb2b.yaml'
      }
}
