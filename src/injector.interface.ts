import { SkyWalkingOptions } from './skywalking-options.interface';

export interface Injector {
  inject(options: SkyWalkingOptions): void;
}
