import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { Injector } from './injector.interface';
import { Injectable, Logger } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
  Controller,
  Injectable as InjectableInterface,
} from '@nestjs/common/interfaces';
import { Constants } from './constants';
import { ContextManager } from 'skywalking-backend-js';
import Span from 'skywalking-backend-js/lib/trace/span/Span';
import { SkyWalkingOptions } from './skywalking-options.interface';

/**
 * Base class for decorator injectors.
 * Provides methods for retrieving providers and controllers from the modules container,
 * as well as checking if a prototype is affected, decorated, or excluded from span creation.
 * Also includes methods for retrieving the span name from a prototype and recording exception details in a span.
 */
export class BaseDecoratorInjector {
  constructor(private readonly modulesContainer: ModulesContainer) {}

  /**
   * Retrieves all providers from the modules container.
   * @returns A generator that yields instances of `InstanceWrapper<InjectableInterface>`.
   */
  protected *getProviders(): Generator<InstanceWrapper<InjectableInterface>> {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (provider && provider.metatype?.prototype) {
          yield provider as InstanceWrapper<InjectableInterface>;
        }
      }
    }
  }

  /**
   * Retrieves all the controllers from the modules container.
   * @returns A generator that yields the instance wrappers of the controllers.
   */
  protected *getControllers(): Generator<InstanceWrapper<Controller>> {
    for (const module of this.modulesContainer.values()) {
      for (const controller of module.controllers.values()) {
        if (controller && controller.metatype?.prototype) {
          yield controller as InstanceWrapper<Controller>;
        }
      }
    }
  }

  /**
   * Checks if the given prototype is affected by the active span metadata.
   * @param prototype - The prototype to check.
   * @returns A boolean indicating whether the prototype is affected by the active span metadata.
   */
  protected isAffected(prototype): boolean {
    return Reflect.hasMetadata(Constants.SPAN_METADATA_ACTIVE, prototype);
  }

  /**
   * Checks if the given prototype is decorated with the SPAN_METADATA metadata.
   *
   * @param prototype - The prototype to check.
   * @returns A boolean indicating whether the prototype is decorated.
   */
  protected isDecorated(prototype): boolean {
    return Reflect.hasMetadata(Constants.SPAN_METADATA, prototype);
  }

  /**
   * Checks if the given prototype is excluded from span creation.
   * @param prototype - The prototype to check.
   * @returns A boolean indicating whether the prototype is excluded.
   */
  protected isExcluded(prototype): boolean {
    return Reflect.hasMetadata(Constants.NO_SPAN_METADATA, prototype);
  }

  /**
   * Retrieves the span name from the given prototype.
   * @param prototype - The prototype to retrieve the span name from.
   * @returns The span name associated with the prototype.
   */
  protected getSpanName(prototype): string {
    return Reflect.getMetadata(Constants.SPAN_METADATA, prototype);
  }

  /**
   * Records the exception details in the given span and throws the error.
   *
   * @param error - The error object to be recorded.
   * @param span - The span to record the exception details in.
   * @throws The same error object that was passed in.
   */
  protected static recordException(error: Error, span: Span) {
    span.tag({ key: 'error.name', val: error.name, overridable: false });
    span.tag({ key: 'error.message', val: error.message, overridable: false });
    span.tag({
      key: 'error.stack',
      val: error.stack || '',
      overridable: false,
    });
  }

  /**
   * Wraps a function with SkyWalking tracing span.
   *
   * @param prototype - The function to be wrapped.
   * @param spanName - The name of the tracing span.
   * @returns The wrapped function.
   */
  protected wrap(prototype: Record<any, any>, spanName: string) {
    const method = {
      // To keep function.name property
      [prototype.name]: function (...args: any[]) {
        const span = ContextManager.current.newLocalSpan(spanName);
        span.start();

        if (prototype.constructor.name === 'AsyncFunction') {
          return prototype
            .apply(this, args)
            .catch((error: Error) => {
              DecoratorInjector.recordException(error, span);
              throw error;
            })
            .finally(() => span.stop());
        } else {
          try {
            const result = prototype.apply(this, args);
            return result;
          } catch (error) {
            DecoratorInjector.recordException(error, span);
            throw error;
          } finally {
            span.stop();
          }
        }
      },
    }[prototype.name];

    // Flag that wrapping is done
    Reflect.defineMetadata(Constants.SPAN_METADATA_ACTIVE, 1, prototype);

    // Copy existing metadata
    const source = prototype;
    const keys = Reflect.getMetadataKeys(source);

    for (const key of keys) {
      const meta = Reflect.getMetadata(key, source);
      Reflect.defineMetadata(key, meta, method);
    }

    return method;
  }
}

/**
 * DecoratorInjector class that extends BaseDecoratorInjector and implements Injector.
 * This class is responsible for injecting providers and controllers with span annotations.
 */
@Injectable()
export class DecoratorInjector
  extends BaseDecoratorInjector
  implements Injector
{
  private readonly metadataScanner: MetadataScanner = new MetadataScanner();
  private readonly logger = new Logger();

  /**
   * Constructor for DecoratorInjector.
   * @param modulesContainer - The modules container.
   */
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer);
  }

  /**
   * Injects providers and controllers with span annotations.
   * @param options - The injector options.
   */
  public inject(options: SkyWalkingOptions) {
    this.injectProviders(options.providers, new Set(options.excludeProviders));
    this.injectControllers(
      options.controllers,
      new Set(options.excludeControllers),
    );
  }

  /**
   * Injects providers with span annotations.
   * @param injectAll - Flag indicating whether to inject all providers.
   * @param exclude - Set of providers to exclude from injection.
   */
  private injectProviders(injectAll: boolean, exclude: Set<string>) {
    const providers = this.getProviders();

    for (const provider of providers) {
      // If no 'span' annotation is attached to the class or provider, it and its methods are all excluded.
      if (this.isExcluded(provider.metatype)) {
        continue;
      }

      const isExcludedFromInjectAll = exclude.has(provider.name);
      if (injectAll && !isExcludedFromInjectAll) {
        Reflect.defineMetadata(Constants.SPAN_METADATA, 1, provider.metatype);
      }
      const isProviderDecorated = this.isDecorated(provider.metatype);
      const methodNames = this.metadataScanner.getAllMethodNames(
        provider.metatype.prototype,
      );

      for (const methodName of methodNames) {
        const method = provider.metatype.prototype[methodName];

        // Already applied or method has been excluded so skip
        if (this.isAffected(method) || this.isExcluded(method)) {
          continue;
        }

        // If span annotation is attached to class, @Span is applied to all methods.
        if (isProviderDecorated || this.isDecorated(method)) {
          const spanName =
            this.getSpanName(method) || `${provider.name}.${methodName}`;
          provider.metatype.prototype[methodName] = this.wrap(method, spanName);

          this.logger.log(
            `Mapped ${provider.name}.${methodName}`,
            this.constructor.name,
          );
        }
      }
    }
  }

  /**
   * Injects controllers with span annotations.
   * @param injectAll - Flag indicating whether to inject all controllers.
   * @param exclude - Set of controllers to exclude from injection.
   */
  private injectControllers(injectAll: boolean, exclude: Set<string>) {
    const controllers = this.getControllers();

    for (const controller of controllers) {
      // If no 'span' annotation is attached to the class or provider, it and its methods are all excluded.
      if (this.isExcluded(controller.metatype)) {
        continue;
      }

      const isExcludedFromInjectAll = exclude.has(controller.name);
      if (injectAll && !isExcludedFromInjectAll) {
        Reflect.defineMetadata(Constants.SPAN_METADATA, 1, controller.metatype);
      }
      const isControllerDecorated = this.isDecorated(controller.metatype);
      const methodNames = this.metadataScanner.getAllMethodNames(
        controller.metatype.prototype,
      );

      for (const methodName of methodNames) {
        const method = controller.metatype.prototype[methodName];

        // Already applied or method has been excluded so skip
        if (this.isAffected(method) || this.isExcluded(method)) {
          continue;
        }

        // If span annotation is attached to class, @Span is applied to all methods.
        if (isControllerDecorated || this.isDecorated(method)) {
          const spanName =
            this.getSpanName(method) || `${controller.name}.${methodName}`;
          controller.metatype.prototype[methodName] = this.wrap(
            method,
            spanName,
          );

          this.logger.log(
            `Mapped ${controller.name}.${methodName}`,
            this.constructor.name,
          );
        }
      }
    }
  }
}
