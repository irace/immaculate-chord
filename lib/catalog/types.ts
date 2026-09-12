export type CatalogSelection = { provider: string; id: string };
export type CatalogHit = CatalogSelection & {
  title: string;
  artist: string;
  version?: string;
  album?: string;
  year?: string;
};
export type CatalogRecording = CatalogHit & {
  firstReleaseDate?: string;
  durationMs?: number;
  albumCoverageComplete?: boolean;
  albums: {
    title: string;
    date: string;
    position: number;
    trackCount: number;
    source: string;
  }[];
  source: string;
};
export interface CatalogProvider {
  id: string;
  search(query: string): Promise<CatalogHit[]>;
  resolve(id: string, options?: { albums: boolean }): Promise<CatalogRecording>;
}
