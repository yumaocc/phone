import { Controller, Post, Body, Get, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto, LoginUserDto } from './user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 用户注册
   */
  @Post('/register')
  async register(@Body() input: unknown) {
    const validated = RegisterUserDto.parse(input);
    return this.userService.register(validated);
  }

  /**
   * 用户登录
   */
  @Post('/login')
  async login(@Body() input: unknown) {
    const validated = LoginUserDto.parse(input);
    return this.userService.login(validated);
  }

  /**
   * 获取当前用户信息（需要认证）
   */
  @Get('/me')
  async getCurrentUser(@Request() req: any) {
    return req?.user ?? null;
  }
}
