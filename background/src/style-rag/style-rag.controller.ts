import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StyleRagService } from './style-rag.service';

@Controller('style-rag')
export class StyleRagController {
  constructor(private readonly styleRagService: StyleRagService) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadStyleReference(
    @UploadedFile()
    file: { originalname: string; mimetype: string; buffer: Buffer },
    @Body('note') note?: string,
  ) {
    return this.styleRagService.uploadStyleReference(file, note);
  }

  @Get('/list')
  listStyleReferences() {
    return this.styleRagService.listStyleReferences();
  }

  @Get('/search')
  searchStyleReferences(@Query('query') query: string) {
    return this.styleRagService.searchStyleReferences(query);
  }
}
