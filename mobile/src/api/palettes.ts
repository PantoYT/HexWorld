import { api } from './client';
import { ColorData } from './colors';

export interface Palette {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  colors_count: number;
  preview: string[];          // hex codes for swatch strip
  colors?: ColorData[];
  created_at: string;
}

export const getPalettes = () =>
  api.get<Palette[]>('/palettes').then(r => r.data);

export const createPalette = (name: string, description?: string, is_public = true) =>
  api.post<Palette>('/palettes', { name, description, is_public }).then(r => r.data);

export const addColorToPalette = (paletteId: string, hexId: number) =>
  api.post(`/palettes/${paletteId}/colors`, { hex_id: hexId }).then(r => r.data);

export const removeColorFromPalette = (paletteId: string, hexId: number) =>
  api.delete(`/palettes/${paletteId}/colors/${hexId}`).then(r => r.data);

export const deletePalette = (paletteId: string) =>
  api.delete(`/palettes/${paletteId}`).then(r => r.data);

export const searchColors = (q: string) =>
  api.get<{ data: ColorData[]; type: string }>('/search', { params: { q } }).then(r => r.data);

export const getColorOfTheDay = () =>
  api.get<ColorData & { cotd_date: string; score: number }>('/color-of-the-day').then(r => r.data);

export const getPaletteDetail = (id: string) =>
  api.get<Palette & { colors: ColorData[] }>(`/palettes/${id}`).then(r => r.data);
