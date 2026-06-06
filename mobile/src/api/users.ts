import { api } from './client';
import { ColorData } from './colors';

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  discovered_count: number;
  followers_count: number;
  following_count: number;
  is_self: boolean;
  is_following: boolean;
}

export const getUser = (username: string) =>
  api.get<PublicUser>(`/users/${username}`).then(r => r.data);

export const getUserDiscovered = (username: string, page = 1) =>
  api.get<{ data: ColorData[]; meta: { current_page: number; last_page: number; total: number } }>(
    `/users/${username}/discovered`, { params: { page, limit: 24 } }
  ).then(r => r.data);

export const followUser = (username: string) =>
  api.post<{ following: boolean }>(`/users/${username}/follow`).then(r => r.data);

export const unfollowUser = (username: string) =>
  api.post<{ following: boolean }>(`/users/${username}/unfollow`).then(r => r.data);
