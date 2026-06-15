/**
 * AssetManager — loads the in-repo selected Kenney assets described by
 * public/assets/kenney/selected/manifest.json. Everything is best-effort: if the
 * manifest or any individual sprite fails to load, the game silently falls back
 * to procedural canvas art (see Renderer). The deployed build only ever reads
 * files inside the repo.
 */

export interface AssetManifest {
  artDirection: string;
  bundleFound: boolean;
  tileSize: number;
  tiles: Record<string, { pack: string; tile: string; index: number }>;
  audio: Record<string, { source: string }>;
  missing: unknown[];
}

const BASE = import.meta.env.BASE_URL || "/";
export function assetUrl(rel: string): string {
  return BASE + rel.replace(/^\//, "");
}

export class AssetManager {
  manifest: AssetManifest | null = null;
  tileSize = 16;
  private images = new Map<string, HTMLImageElement>();
  /** keys we attempted but failed -> use fallback art. */
  failed = new Set<string>();

  async load(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    // 1) manifest (optional)
    try {
      const res = await fetch(assetUrl("assets/kenney/selected/manifest.json"), {
        cache: "no-cache",
      });
      if (res.ok) {
        this.manifest = (await res.json()) as AssetManifest;
        if (this.manifest.tileSize) this.tileSize = this.manifest.tileSize;
      }
    } catch {
      this.manifest = null;
    }

    // 2) tiles
    const tileFiles = this.manifest ? Object.keys(this.manifest.tiles) : [];
    let loaded = 0;
    const total = Math.max(1, tileFiles.length);
    await Promise.all(
      tileFiles.map(async (file) => {
        const key = file.replace(/\.png$/i, "");
        try {
          const img = await this.loadImage(
            assetUrl(`assets/kenney/selected/tiles/${file}`)
          );
          this.images.set(key, img);
        } catch {
          this.failed.add(key);
        } finally {
          loaded++;
          onProgress?.(loaded, total);
        }
      })
    );
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("img load failed: " + src));
      img.decoding = "async";
      img.src = src;
    });
  }

  /** Resolved sprite for a semantic key, or null if it should be drawn procedurally. */
  img(key: string): HTMLImageElement | null {
    return this.images.get(key) ?? null;
  }

  has(key: string): boolean {
    return this.images.has(key);
  }

  /** Audio sources from the manifest (consumed by AudioManager). */
  audioSources(): Record<string, string> {
    const out: Record<string, string> = {};
    if (!this.manifest) return out;
    for (const key of Object.keys(this.manifest.audio)) {
      out[key.replace(/\.ogg$/i, "")] = assetUrl(
        `assets/kenney/selected/audio/${key}`
      );
    }
    return out;
  }
}
