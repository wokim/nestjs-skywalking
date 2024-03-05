import { Test, TestingModule } from '@nestjs/testing';
// import { TraceService } from './trace.service';
import { Controller, Get, Injectable, UsePipes } from '@nestjs/common';
import { NoSpan, Span } from './span.decorator';
import { SkyWalkingModule } from './skywalking.module';
import SkyWalkingSpan from 'skywalking-backend-js/lib/trace/span/Span';
import { ContextManager } from 'skywalking-backend-js';
import { Constants } from './constants';
import * as request from 'supertest';
import { PATH_METADATA, PIPES_METADATA } from '@nestjs/common/constants';
import { EventPattern, Transport } from '@nestjs/microservices';
import {
  PATTERN_METADATA,
  PATTERN_HANDLER_METADATA,
  TRANSPORT_METADATA,
} from '@nestjs/microservices/constants';
import { PatternHandler } from '@nestjs/microservices/enums/pattern-handler.enum';
import { TraceService } from './trace.service';

describe('DecoratorInjector', () => {
  it('should work with sync function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      hi() {
        return 0;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result = helloService.hi();

      // then
      expect(result).toBe(0);
      expect(
        Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
      ).toBe('hello');
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith('hello');
      expect(mockSpan.start).toHaveBeenCalled();
      expect(mockSpan.stop).toHaveBeenCalled();
    });
  });

  it('should work with async function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      async hi() {
        return new Promise<number>((resolve) => {
          setTimeout(() => resolve(0), 100);
        });
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result = await helloService.hi();

      // then
      expect(result).toBe(0);
      expect(
        Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
      ).toBe('hello');
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith('hello');
      expect(mockSpan.start).toHaveBeenCalled();
      expect(mockSpan.stop).toHaveBeenCalled();
    });
  });

  it('should record exception with sync function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      hi() {
        throw new Error('hello');
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      expect(() => {
        helloService.hi();
      }).toThrow('hello');

      // then
      expect(
        Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
      ).toBe('hello');
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith('hello');
      expect(mockSpan.start).toHaveBeenCalled();
      expect(mockSpan.stop).toHaveBeenCalled();
      expect(mockSpan.tag).toHaveBeenCalledWith({
        key: 'error.name',
        val: 'Error',
        overridable: false,
      });
      expect(mockSpan.tag).toHaveBeenCalledWith({
        key: 'error.message',
        val: 'hello',
        overridable: false,
      });
      expect(mockSpan.tag).toHaveBeenCalledWith({
        key: 'error.stack',
        val: expect.any(String),
        overridable: false,
      });
    });
  });

  it('should record exception with async function', async () => {
    // given
    @Injectable()
    class HelloService {
      @Span('hello')
      async hi() {
        return new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('hello')), 100);
        });
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      await expect(helloService.hi()).rejects.toEqual(new Error('hello'));

      // then
      expect(
        Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
      ).toBe('hello');
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith('hello');
      expect(mockSpan.start).toHaveBeenCalled();
      expect(mockSpan.stop).toHaveBeenCalled();
      expect(mockSpan.tag).toHaveBeenCalledWith({
        key: 'error.name',
        val: 'Error',
        overridable: false,
      });
      expect(mockSpan.tag).toHaveBeenCalledWith({
        key: 'error.message',
        val: 'hello',
        overridable: false,
      });
      expect(mockSpan.tag).toHaveBeenCalledWith({
        key: 'error.stack',
        val: expect.any(String),
        overridable: false,
      });
    });
  });

  it('should work with all methods in provider', async () => {
    // given
    @Injectable()
    @Span()
    class HelloService {
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result1 = helloService.hi();
      const result2 = helloService.hello();

      // then
      expect(result1).toBe(0);
      expect(result2).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hello,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hi',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hello',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(2);
      expect(mockSpan.stop).toHaveBeenCalledTimes(2);
    });
  });

  it('should exclude provider and all its methods', async () => {
    // given
    @Injectable()
    @NoSpan()
    class HelloService {
      @Span()
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result1 = helloService.hi();
      const result2 = helloService.hello();

      // then
      expect(result1).toBe(0);
      expect(result2).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hello,
        ),
      ).toBeUndefined();
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalled();
      expect(mockSpan.start).not.toHaveBeenCalled();
      expect(mockSpan.stop).not.toHaveBeenCalled();
    });
  });

  it('should exclude methods in provider', async () => {
    // given
    @Injectable()
    @Span()
    class HelloService {
      hi() {
        return 0;
      }
      @NoSpan()
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result1 = helloService.hi();
      const result2 = helloService.hello();

      // then
      expect(result1).toBe(0);
      expect(result2).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hello,
        ),
      ).toBeUndefined();
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hi',
      );
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalledWith(
        'HelloService.hello',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(1);
      expect(mockSpan.stop).toHaveBeenCalledTimes(1);
    });
  });

  it('should work with all methods in controller', async () => {
    // given
    @Controller()
    @Span()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await usingSpyMock(async (mockSpan) => {
      // when
      await request(app.getHttpServer()).get('/hi').send().expect(200);
      await request(app.getHttpServer()).get('/hello').send().expect(200);

      // then
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hello,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
      ).toBe('/hi');
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
      ).toBe('/hello');

      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hi',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hello',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(2);
      expect(mockSpan.stop).toHaveBeenCalledTimes(2);
    });
  });

  it('should exclude controller and all its methods', async () => {
    // given
    @Controller()
    @NoSpan()
    class HelloController {
      @Get('/hi')
      @Span()
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await usingSpyMock(async (mockSpan) => {
      // when
      await request(app.getHttpServer()).get('/hi').send().expect(200);
      await request(app.getHttpServer()).get('/hello').send().expect(200);

      // then
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hi,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hello,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
      ).toBe('/hi');
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
      ).toBe('/hello');

      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalled();
      expect(mockSpan.start).not.toHaveBeenCalled();
      expect(mockSpan.stop).not.toHaveBeenCalled();
    });
  });

  it('should exclude methods in controller', async () => {
    // given
    @Controller()
    @Span()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @NoSpan()
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await usingSpyMock(async (mockSpan) => {
      // when
      await request(app.getHttpServer()).get('/hi').send().expect(200);
      await request(app.getHttpServer()).get('/hello').send().expect(200);

      // then
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hello,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
      ).toBe('/hi');
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
      ).toBe('/hello');

      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hi',
      );
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalledWith(
        'HelloController.hello',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(1);
      expect(mockSpan.stop).toHaveBeenCalledTimes(1);
    });
  });

  it('should be usable with other annotations', async () => {
    // eslint-disable-next-line prettier/prettier
    const pipe = new (function transform() {})();

    // given
    @Controller()
    @Span()
    class HelloController {
      @EventPattern('pattern1', Transport.KAFKA)
      @UsePipes(pipe, pipe)
      hi() {
        return 0;
      }
      @EventPattern('pattern2', Transport.KAFKA)
      @UsePipes(pipe, pipe)
      hello() {
        return 1;
      }
    }

    await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      controllers: [HelloController],
    }).compile();

    // then
    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hi,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATTERN_METADATA, HelloController.prototype.hi),
    ).toEqual(['pattern1']);
    expect(
      Reflect.getMetadata(
        PATTERN_HANDLER_METADATA,
        HelloController.prototype.hi,
      ),
    ).toBe(PatternHandler.EVENT);
    expect(
      Reflect.getMetadata(TRANSPORT_METADATA, HelloController.prototype.hi),
    ).toBe(Transport.KAFKA);
    expect(
      Reflect.getMetadata(PIPES_METADATA, HelloController.prototype.hi),
    ).toEqual([pipe, pipe]);

    expect(
      Reflect.getMetadata(
        Constants.SPAN_METADATA_ACTIVE,
        HelloController.prototype.hello,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATTERN_METADATA, HelloController.prototype.hello),
    ).toEqual(['pattern2']);
    expect(
      Reflect.getMetadata(
        PATTERN_HANDLER_METADATA,
        HelloController.prototype.hello,
      ),
    ).toBe(PatternHandler.EVENT);
    expect(
      Reflect.getMetadata(TRANSPORT_METADATA, HelloController.prototype.hello),
    ).toBe(Transport.KAFKA);
    expect(
      Reflect.getMetadata(PIPES_METADATA, HelloController.prototype.hello),
    ).toEqual([pipe, pipe]);
  });

  it('should work with all methods in controller if options.controllers is enabled', async () => {
    // given
    @Controller()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    @Controller('/foo')
    class WorldController {
      @Get('/bar')
      bar() {
        return 'bar';
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot({ controllers: true })],
      controllers: [HelloController, WorldController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await usingSpyMock(async (mockSpan) => {
      // when
      await request(app.getHttpServer()).get('/hi').send().expect(200);
      await request(app.getHttpServer()).get('/hello').send().expect(200);
      await request(app.getHttpServer()).get('/foo/bar').send().expect(200);

      // then
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hello,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          WorldController.prototype.bar,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
      ).toBe('/hi');
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
      ).toBe('/hello');
      expect(
        Reflect.getMetadata(PATH_METADATA, WorldController.prototype.bar),
      ).toBe('/bar');

      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hi',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hello',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'WorldController.bar',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(3);
      expect(mockSpan.stop).toHaveBeenCalledTimes(3);
    });
  });

  it('should exclude some methods in controller if options.controllers is enabled', async () => {
    // given
    @Controller()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @NoSpan()
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot({ controllers: true })],
      controllers: [HelloController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await usingSpyMock(async (mockSpan) => {
      // when
      await request(app.getHttpServer()).get('/hi').send().expect(200);
      await request(app.getHttpServer()).get('/hello').send().expect(200);

      // then
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hello,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
      ).toBe('/hi');
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
      ).toBe('/hello');

      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hi',
      );
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalledWith(
        'HelloController.hello',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(1);
      expect(mockSpan.start).toHaveBeenCalledTimes(1);
    });
  });

  it('should exclude controller if included in options.excludeControllers', async () => {
    // given
    @Controller()
    class HelloController {
      @Get('/hi')
      hi() {
        return 0;
      }
      @Get('/hello')
      hello() {
        return 1;
      }
    }

    @Controller('/foo')
    class WorldController {
      @Get('/bar')
      bar() {
        return 'bar';
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        SkyWalkingModule.forRoot({
          controllers: true,
          excludeControllers: ['WorldController'],
        }),
      ],
      controllers: [HelloController, WorldController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await usingSpyMock(async (mockSpan) => {
      // when
      await request(app.getHttpServer()).get('/hi').send().expect(200);
      await request(app.getHttpServer()).get('/hello').send().expect(200);
      await request(app.getHttpServer()).get('/foo/bar').send().expect(200);

      // then
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloController.prototype.hello,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          WorldController.prototype.bar,
        ),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hi),
      ).toBe('/hi');
      expect(
        Reflect.getMetadata(PATH_METADATA, HelloController.prototype.hello),
      ).toBe('/hello');
      expect(
        Reflect.getMetadata(PATH_METADATA, WorldController.prototype.bar),
      ).toBe('/bar');

      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hi',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloController.hello',
      );
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalledWith(
        'WorldController.bar',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(2);
      expect(mockSpan.stop).toHaveBeenCalledTimes(2);
    });
  });

  it('should work with all methods in provider if options.providers is enabled', async () => {
    // given
    @Injectable()
    class HelloService {
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    @Injectable()
    class WorldService {
      foo() {
        return 2;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot({ providers: true })],
      providers: [HelloService, WorldService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const worldService = module.get<WorldService>(WorldService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result1 = helloService.hi();
      const result2 = helloService.hello();
      const result3 = worldService.foo();

      // then
      expect(result1).toBe(0);
      expect(result2).toBe(1);
      expect(result3).toBe(2);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hello,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          WorldService.prototype.foo,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hi',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hello',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'WorldService.foo',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(3);
      expect(mockSpan.stop).toHaveBeenCalledTimes(3);
    });
  });

  it('should exclude some methods in provider if options.providers is enabled', async () => {
    // given
    @Injectable()
    class HelloService {
      hi() {
        return 0;
      }
      @NoSpan()
      hello() {
        return 1;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot({ providers: true })],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result1 = helloService.hi();
      const result2 = helloService.hello();

      // then
      expect(result1).toBe(0);
      expect(result2).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hello,
        ),
      ).toBeUndefined();
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hi',
      );
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalledWith(
        'HelloService.hello',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(1);
      expect(mockSpan.stop).toHaveBeenCalledTimes(1);
    });
  });

  it('should exclude provider if included in options.excludeProviders', async () => {
    // given
    @Injectable()
    class HelloService {
      hi() {
        return 0;
      }
      hello() {
        return 1;
      }
    }

    @Injectable()
    class WorldService {
      foo() {
        return 2;
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        SkyWalkingModule.forRoot({
          providers: true,
          excludeProviders: ['WorldService'],
        }),
      ],
      providers: [HelloService, WorldService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    const worldService = module.get<WorldService>(WorldService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result1 = helloService.hi();
      const result2 = helloService.hello();
      const result3 = worldService.foo();

      // then
      expect(result1).toBe(0);
      expect(result2).toBe(1);
      expect(result3).toBe(2);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hello,
        ),
      ).toBe(1);
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          WorldService.prototype.foo,
        ),
      ).toBeUndefined();
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hi',
      );
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith(
        'HelloService.hello',
      );
      expect(ContextManager.current.newLocalSpan).not.toHaveBeenCalledWith(
        'WorldService.foo',
      );
      expect(mockSpan.start).toHaveBeenCalledTimes(2);
      expect(mockSpan.stop).toHaveBeenCalledTimes(2);
    });
  });

  it('should record custom tags with TraceService', async () => {
    // given
    @Injectable()
    class HelloService {
      constructor(private readonly traceService: TraceService) {}

      @Span('hello')
      async hi() {
        return new Promise<number>((resolve) => {
          this.traceService.addTags({ foo: 'bar', baz: 'qux' });
          setTimeout(() => resolve(0), 100);
        });
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result = await helloService.hi();

      // then
      expect(result).toBe(0);
      expect(
        Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
      ).toBe('hello');
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith('hello');
      expect(mockSpan.start).toHaveBeenCalled();
      expect(mockSpan.stop).toHaveBeenCalled();
      expect(ContextManager.currentSpan.tag).toHaveBeenCalledWith({
        key: 'foo',
        val: 'bar',
        overridable: false,
      });
      expect(ContextManager.currentSpan.tag).toHaveBeenCalledWith({
        key: 'baz',
        val: 'qux',
        overridable: false,
      });
    });
  });

  it('should record error tags with TraceService', async () => {
    // given
    @Injectable()
    class HelloService {
      constructor(private readonly traceService: TraceService) {}

      @Span('hello')
      hi() {
        try {
          throw new Error('hello');
        } catch (error) {
          this.traceService.addError(error);
        } finally {
          return 0;
        }
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [SkyWalkingModule.forRoot()],
      providers: [HelloService],
    }).compile();

    const helloService = module.get<HelloService>(HelloService);
    await usingSpyMock(async (mockSpan) => {
      // when
      const result = await helloService.hi();

      // then
      expect(result).toBe(0);
      expect(
        Reflect.getMetadata(Constants.SPAN_METADATA, HelloService.prototype.hi),
      ).toBe('hello');
      expect(
        Reflect.getMetadata(
          Constants.SPAN_METADATA_ACTIVE,
          HelloService.prototype.hi,
        ),
      ).toBe(1);
      expect(ContextManager.current.newLocalSpan).toHaveBeenCalledWith('hello');
      expect(mockSpan.start).toHaveBeenCalled();
      expect(mockSpan.stop).toHaveBeenCalled();
      expect(ContextManager.currentSpan.tag).toHaveBeenCalledWith({
        key: 'error.name',
        val: 'Error',
        overridable: false,
      });
      expect(ContextManager.currentSpan.tag).toHaveBeenCalledWith({
        key: 'error.message',
        val: 'hello',
        overridable: false,
      });
      expect(ContextManager.currentSpan.tag).toHaveBeenCalledWith({
        key: 'error.stack',
        val: expect.any(String),
        overridable: false,
      });
    });
  });
});

async function usingSpyMock(
  testFn: (mockSpan: SkyWalkingSpan) => Promise<void>,
) {
  const mockSpan = {
    start: jest.fn() as any,
    stop: jest.fn() as any,
    tag: jest.fn() as any,
  } as SkyWalkingSpan;
  const currentContextSpy = jest
    .spyOn(ContextManager, 'current', 'get')
    .mockReturnValue({
      newLocalSpan: jest.fn().mockImplementation(() => mockSpan),
    } as any);

  const currentSpanSpy = jest
    .spyOn(ContextManager, 'currentSpan', 'get')
    .mockReturnValue({
      tag: jest.fn().mockImplementation(() => {}),
    } as any);

  try {
    await testFn(mockSpan);
  } finally {
    currentContextSpy.mockClear();
    currentSpanSpy.mockClear();
  }
}
