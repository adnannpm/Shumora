export interface ToolCacheEntry { id: string; name: string; bytes: number; files: number; supported: boolean; failed: boolean }
export interface ToolCacheReport { entries: ToolCacheEntry[]; totalBytes: number; freedBytes?: number }
export interface ToolCacheAPI { scan(): Promise<ToolCacheReport>; clear(): Promise<ToolCacheReport> }
declare global { interface Window { toolCache?: ToolCacheAPI } }
