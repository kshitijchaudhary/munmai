import { apiClient } from '@/api/client';
import {
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
  type User,
} from '@/auth/types';

export async function register(request: RegisterRequest): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', {
    ...request,
    email: request.email.trim().toLowerCase(),
    name: request.name.trim(),
    username: request.username.trim().toLowerCase(),
  });

  return response.data;
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    email: request.email.trim().toLowerCase(),
    password: request.password,
  });

  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/users/me');

  return response.data;
}
