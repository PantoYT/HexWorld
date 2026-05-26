import { api } from './client';

export interface ColorData {
  hex_id: number;
  hex_code: string;
  r: number; g: number; b: number;
  h: number; s: number; l: number;
  custom_name: string | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  discovered_by: { id: string; username: string; display_name: string; avatar_url: string | null; discovered_at: string } | null;
  discovered_at: string | null;
  is_liked: boolean;
  is_saved: boolean;
}

export const feedNext = (mode = 'random') =>
  api.get<ColorData>('/feed/next', { params: { mode } }).then(r => r.data);

export const getColor = (hexId: number) =>
  api.get<ColorData & { similar: ColorData[] }>(`/colors/${hexId}`).then(r => r.data);

export const discoverColor = (hexId: number, customName?: string) =>
  api.post(`/colors/${hexId}/discover`, { custom_name: customName }).then(r => r.data);

export const likeColor = (hexId: number) =>
  api.post(`/colors/${hexId}/like`).then(r => r.data);

export const unlikeColor = (hexId: number) =>
  api.post(`/colors/${hexId}/unlike`).then(r => r.data);

export const saveColor = (hexId: number) =>
  api.post(`/colors/${hexId}/save`).then(r => r.data);

export const markViewed = (hexId: number) =>
  api.post(`/colors/${hexId}/view`).then(r => r.data);

export const getComments = (hexId: number, page = 1) =>
  api.get(`/colors/${hexId}/comments`, { params: { page } }).then(r => r.data);

export const postComment = (hexId: number, body: string) =>
  api.post(`/colors/${hexId}/comments`, { body }).then(r => r.data);
