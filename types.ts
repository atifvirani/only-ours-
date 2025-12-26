
export interface SharedNote {
  id: number;
  text_note: string;
  updated_at?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local-edit';

export interface AIAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export interface DrawPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}
