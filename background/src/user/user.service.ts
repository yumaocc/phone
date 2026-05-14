import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  RegisterUserInput,
  LoginUserInput,
  AuthResponse,
  UserInfo,
  UserEntity,
  JwtPayload,
} from './user.dto';

const scrypt = promisify(scryptCallback);

@Injectable()
export class UserService {
  private readonly usersFile = path.join(
    process.cwd(),
    'local-data',
    'users',
    'users.json',
  );
  private readonly passwordHashPrefix = 'scrypt';

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.ensureUsersFile();
  }

  /**
   * 用户注册
   */
  async register(input: RegisterUserInput): Promise<AuthResponse> {
    // 检查用户名是否已存在
    const existingUser = await this.findByUsername(input.username);
    if (existingUser) {
      throw new BadRequestException('用户名已存在');
    }

    // 创建新用户
    const userId = randomUUID();
    const passwordHash = await this.hashPassword(input.password);
    const now = new Date().toISOString();

    const user: UserEntity = {
      id: userId,
      username: input.username,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    // 保存用户
    await this.saveUser(user);

    // 生成 token
    return this.generateAuthResponse(user);
  }

  /**
   * 用户登录
   */
  async login(input: LoginUserInput): Promise<AuthResponse> {
    const user = await this.findByUsername(input.username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await this.verifyPassword(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return this.generateAuthResponse(user);
  }

  /**
   * 验证 token 并获取用户信息
   */
  async validateToken(token: string): Promise<UserInfo> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.findById(payload.userId);

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      return this.toUserInfo(user);
    } catch (error) {
      throw new UnauthorizedException('Token 无效或已过期');
    }
  }

  /**
   * 根据 ID 查找用户
   */
  private async findById(userId: string): Promise<UserEntity | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.id === userId) || null;
  }

  /**
   * 根据用户名查找用户
   */
  private async findByUsername(username: string): Promise<UserEntity | null> {
    const users = await this.loadUsers();
    return users.find((u) => u.username === username) || null;
  }

  /**
   * 保存用户
   */
  private async saveUser(user: UserEntity): Promise<void> {
    const users = await this.loadUsers();
    users.push(user);
    await this.writeUsers(users);
  }

  /**
   * 加载所有用户
   */
  private async loadUsers(): Promise<UserEntity[]> {
    try {
      const content = await fs.readFile(this.usersFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * 写入用户数据
   */
  private async writeUsers(users: UserEntity[]): Promise<void> {
    await fs.mkdir(path.dirname(this.usersFile), { recursive: true });
    await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
  }

  /**
   * 确保用户文件存在
   */
  private async ensureUsersFile(): Promise<void> {
    try {
      await fs.access(this.usersFile);
    } catch {
      await this.writeUsers([]);
    }
  }

  /**
   * 生成认证响应
   */
  private generateAuthResponse(user: UserEntity): AuthResponse {
    const expiresIn = 7 * 24 * 60 * 60; // 7 天
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
    };

    const token = this.jwtService.sign(payload);

    return {
      userId: user.id,
      username: user.username,
      token,
      expiresIn,
    };
  }

  /**
   * 转换为用户信息（不包含密码）
   */
  private toUserInfo(user: UserEntity): UserInfo {
    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `${this.passwordHashPrefix}$${salt}$${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const [algorithm, salt, storedKey] = passwordHash.split('$');

    if (
      algorithm !== this.passwordHashPrefix ||
      !salt ||
      !storedKey
    ) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const storedBuffer = Buffer.from(storedKey, 'hex');

    if (storedBuffer.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, derivedKey);
  }
}
