import z from 'zod';

/**
 * 用户注册请求
 */
export const RegisterUserDto = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  password: z
    .string()
    .min(6, '密码至少 6 个字符')
    .max(50, '密码最多 50 个字符'),
});

export type RegisterUserInput = z.infer<typeof RegisterUserDto>;

/**
 * 用户登录请求
 */
export const LoginUserDto = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export type LoginUserInput = z.infer<typeof LoginUserDto>;

/**
 * 用户认证响应
 */
export const AuthResponseDto = z.object({
  userId: z.string(),
  username: z.string(),
  token: z.string(),
  expiresIn: z.number(),
});

export type AuthResponse = z.infer<typeof AuthResponseDto>;

/**
 * 用户信息（不包含密码）
 */
export const UserInfoDto = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserInfo = z.infer<typeof UserInfoDto>;

/**
 * 用户数据库模型
 */
export const UserEntityDto = z.object({
  id: z.string(),
  username: z.string(),
  passwordHash: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserEntity = z.infer<typeof UserEntityDto>;

/**
 * JWT Payload
 */
export const JwtPayloadDto = z.object({
  userId: z.string(),
  username: z.string(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadDto>;
