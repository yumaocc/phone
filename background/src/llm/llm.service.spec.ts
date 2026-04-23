import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { GenerateAgentService } from '../generate-agent/generate-agent.service';
import { StyleRagService } from '../style-rag/style-rag.service';

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: GenerateAgentService,
          useValue: {
            generateImage: jest.fn(),
          },
        },
        {
          provide: StyleRagService,
          useValue: {
            buildStyleContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
