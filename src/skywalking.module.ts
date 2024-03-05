import { DynamicModule, Module } from '@nestjs/common';
import { Constants } from './constants';
import { DecoratorInjector } from './decorator.injector';
import { TraceService } from './trace.service';
import { Injector } from './injector.interface';
import { SkyWalkingOptions } from './skywalking-options.interface';

@Module({})
export class SkyWalkingModule {
  static forRoot(options: SkyWalkingOptions = {}): DynamicModule {
    return {
      global: true,
      module: SkyWalkingModule,
      providers: [
        TraceService,
        DecoratorInjector,
        this.buildInjectors(options),
      ],
      exports: [TraceService],
    };
  }

  private static buildInjectors(options: SkyWalkingOptions) {
    return {
      provide: Constants.TRACE_INJECTORS,
      useFactory: async (...injectors: Injector[]) => {
        for await (const injector of injectors) {
          if (injector.inject) await injector.inject(options);
        }
      },
      inject: [DecoratorInjector],
    };
  }
}
