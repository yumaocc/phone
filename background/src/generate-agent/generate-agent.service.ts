import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type GenerateImageInput,
  type GenerateImageResponse,
  GenerateImageResponseDto,
  type GenerateImageTaskResponse,
  GenerateImageTaskResponseDto,
} from './generate-image.dto';

@Injectable()
export class GenerateAgentService {
  constructor(private configService: ConfigService) {}

  async generateImage(
    body: GenerateImageInput,
  ): Promise<GenerateImageResponse> {
    const baseUrl = this.configService.get<string>('GEMINI_BASE_URL');
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new InternalServerErrorException(
        '未配置 GEMINI_BASE_URL 或 GEMINI_API_KEY',
      );
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/images/generations`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildGeneratePayload(body)),
      },
    );

    const result = await this.parseResponse(response);

    if (!response.ok) {
      throw new InternalServerErrorException(result);
    }

    return GenerateImageResponseDto.parse(result);
  }

  async getImage(taskId: string): Promise<GenerateImageTaskResponse> {
    const baseUrl = this.configService.get<string>('GEMINI_BASE_URL');
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new InternalServerErrorException(
        '未配置 GEMINI_BASE_URL 或 GEMINI_API_KEY',
      );
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/images/generations/${taskId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    const result = await this.parseResponse(response);

    if (!response.ok) {
      throw new InternalServerErrorException(result);
    }

    return GenerateImageTaskResponseDto.parse(result);
  }

  private buildGeneratePayload(body: GenerateImageInput) {
    const imageUrls = body.image_urls?.map((item) =>
      typeof item === 'string' ? item : item.url,
    );

    return {
      model:
        this.configService.get<string>('GEMINI_MODEL') ??
        'gemini-2.5-flash-image-official',
      prompt: body.prompt,
      size: body.size,
      n: body.n,
      metadata: body.metadata,
      ...(imageUrls?.length ? { image_urls: imageUrls } : {}),
    };
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();

    if (!text) {
      return {
        message: response.ok
          ? '上游接口未返回内容'
          : `${response.status} ${response.statusText}`,
      };
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {
        message: text,
        status: response.status,
      };
    }
  }
  public async upload(
    file:
      | { originalname: string; mimetype: string; buffer: Buffer }
      | undefined,
  ): Promise<string> {
    const baseUrl = this.configService.get<string>('GEMINI_BASE_URL');
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new InternalServerErrorException(
        '未配置 GEMINI_BASE_URL 或 GEMINI_API_KEY',
      );
    }

    if (!file) {
      throw new InternalServerErrorException('未接收到上传文件');
    }

    const formData = new FormData();
    const fileBytes = new Uint8Array(file.buffer.byteLength);
    fileBytes.set(file.buffer);
    const blob = new Blob([fileBytes.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/uploads/images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const uploadResult = await this.parseResponse(res);

    if (!res.ok) {
      throw new InternalServerErrorException(uploadResult);
    }

    if (typeof uploadResult === 'string') {
      return uploadResult;
    }

    if (
      uploadResult &&
      typeof uploadResult === 'object' &&
      'data' in uploadResult &&
      uploadResult.data &&
      typeof uploadResult.data === 'object' &&
      'url' in uploadResult.data &&
      typeof uploadResult.data.url === 'string'
    ) {
      return uploadResult.data.url;
    }

    if (
      uploadResult &&
      typeof uploadResult === 'object' &&
      'url' in uploadResult &&
      typeof uploadResult.url === 'string'
    ) {
      return uploadResult.url;
    }

    throw new InternalServerErrorException({
      message: '上传接口未返回有效图片地址',
      raw: uploadResult,
    });
  }
}
