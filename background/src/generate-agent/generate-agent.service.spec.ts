import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GenerateAgentService } from './generate-agent.service';

describe('GenerateAgentService', () => {
  let service: GenerateAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateAgentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GenerateAgentService>(GenerateAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
