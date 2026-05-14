import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StyleRagService } from './style-rag.service';

@Controller('style-rag')
export class StyleRagController {
  constructor(private readonly styleRagService: StyleRagService) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadStyleReference(
    @Request() req: any,
    @UploadedFile()
    file: { originalname: string; mimetype: string; buffer: Buffer },
    @Body('note') note?: string,
    @Body('isPublic') isPublic?: boolean,
  ) {
    const userId = req?.userId ?? 'anonymous';

    // 验证文件是否存在
    if (!file) {
      throw new BadRequestException('请先上传图片文件');
    }

    // 验证备注长度
    if (note && note.length > 500) {
      throw new BadRequestException('备注长度不能超过 500 字符');
    }

    return this.styleRagService.uploadStyleReference(
      file,
      userId,
      note,
      isPublic ?? false,
    );
  }

  @Get('/list')
  listStyleReferences(@Request() req: any) {
    const userId = req?.userId ?? 'anonymous';
    return this.styleRagService.listStyleReferences(userId);
  }

  @Get('/search')
  searchStyleReferences(@Request() req: any, @Query('query') query: string) {
    const userId = req?.userId ?? 'anonymous';

    // 验证查询字符串
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('查询字符串不能为空');
    }

    if (query.length > 200) {
      throw new BadRequestException('查询字符串长度不能超过 200 字符');
    }

    return this.styleRagService.searchStyleReferences(query.trim(), userId);
  }
}
