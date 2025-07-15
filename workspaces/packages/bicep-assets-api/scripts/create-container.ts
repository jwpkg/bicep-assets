import { BlobServiceClient } from "@azure/storage-blob";

const run = async () => {
  const conn = "UseDevelopmentStorage=true";
  const client = BlobServiceClient.fromConnectionString(conn);
  const container = client.getContainerClient("assets");
  await container.createIfNotExists();
  console.log("Container ready.");
};

run();