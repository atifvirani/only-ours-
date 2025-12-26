export interface SharedNote {
  id: number;
  text_note: string;
  updated_at?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-edit';

export interface DrawPoint {
  x1: number; // Normalized (0 to 1)
  y1: number; // Normalized (0 to 1)
  x2: number; // Normalized (0 to 1)
  y2: number; // Normalized (0 to 1)
  color: string;
  width: number;
}

export type AppUser = 'Atif' | 'Adiba' | null;

export interface PresenceState {
  user: string;
  isDrawing: boolean;
  onlineAt: string;
}