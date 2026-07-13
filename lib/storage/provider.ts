import path from "node:path";
import { promises as fs } from "node:fs";

export interface StorageProvider {
  put(objectKey: string, data: Buffer): Promise<{ publicUrl: string; objectKey: string }>;
}

class LocalStorageProvider implements StorageProvider {
  private readonly basePath = path.join(process.cwd(), "public", "uploads");

  async put(objectKey: string, data: Buffer): Promise<{ publicUrl: string; objectKey: string }> {
    const targetPath = path.join(this.basePath, objectKey);
    const directory = path.dirname(targetPath);

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(targetPath, data);

    return {
      objectKey,
      publicUrl: `/uploads/${objectKey.replace(/\\/g, "/")}`,
    };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider();
  }
  return provider;
}
