import { request } from '@umijs/max';

const API_BASE_URL = process.env.UMI_APP_API_BASE_URL || 'http://localhost:3000';

export type UserResponseDto = {
  id: string;
  username: string;
  createdAt: string;
};

export type LoginResponseDto = {
  accessToken: string;
  user: UserResponseDto;
};

export async function register(body: {
  username: string;
  password: string;
}) {
  return request<UserResponseDto>(`${API_BASE_URL}/user/register`, {
    method: 'POST',
    data: body,
  });
}

export async function login(body: {
  username: string;
  password: string;
}) {
  return request<LoginResponseDto>(`${API_BASE_URL}/user/login`, {
    method: 'POST',
    data: body,
  });
}

export async function getProfile() {
  return request<UserResponseDto>(`${API_BASE_URL}/user/profile`, {
    method: 'GET',
  });
}
