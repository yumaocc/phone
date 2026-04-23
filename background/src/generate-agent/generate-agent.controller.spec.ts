import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GenerateAgentController } from './generate-agent.controller';
import { GenerateAgentService } from './generate-agent.service';

describe('GenerateAgentController', () => {
  let controller: GenerateAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenerateAgentController],
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

    controller = module.get<GenerateAgentController>(GenerateAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
