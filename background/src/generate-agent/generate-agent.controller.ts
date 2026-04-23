import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { GenerateAgentService } from './generate-agent.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('generate-agent')
export class GenerateAgentController {
  constructor(private readonly generateAgentService: GenerateAgentService) {}

  @Get('/get')
  getImage(@Query('id') id: string) {
    return this.generateAgentService.getImage(id);
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadStyleReference(
    @UploadedFile()
    file:
      | { originalname: string; mimetype: string; buffer: Buffer }
      | undefined,
  ) {
    return this.generateAgentService.upload(file);
  }
}
