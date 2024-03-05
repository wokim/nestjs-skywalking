# nestjs-skywalking

A skywalking module for Nest framework (node.js) using [skywalking-backend-js](https://www.npmjs.com/package/skywalking-backend-js) library.

## Installation

Install nestjs-skywalking using npm:

```bash
npm install nestjs-skywalking --save
```

Or using yarn:

```bash
yarn add nestjs-skywalking
```

## Tracing Setup

Before using the nestjs-skywalking module, you need to initialize the SkyWalking agent by creating a tracing.ts file and importing it at the start of your application.

### Creating the `tracing.ts` File

Create a tracing.ts file at the root of your project with the following content:

```typescript
// tracing.ts
import agent from 'skywalking-backend-js';

agent.start({
  // Replace with your SkyWalking OAP server address. It can be replaced by setting the SW_AGENT_COLLECTOR_BACKEND_SERVICES environment variable.
  collectorAddress: 'skywalking.oap.address:port',
});
```

### Importing `tracing.ts` in `main.ts`

Ensure that the SkyWalking agent is initialized before the NestJS application by importing tracing.ts at the beginning of your main.ts file:

```typescript
// main.ts
import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

## Usage

After setting up the tracing, you can now utilize the nestjs-skywalking module in your application.

### Initializing SkyWalking Module

```typescript
import { Module } from '@nestjs/common';
import { SkyWalkingModule } from 'nestjs-skywalking';

@Module({
  imports: [
    SkyWalkingModule.forRoot({
      // Enable automatic span creation for all controllers
      controllers: true,
      // Enable automatic span creation for all providers
      providers: true,
      // Exclude HealthController from automatic span creation
      excludeControllers: ['HealthController'],
      // Exclude AuthService from automatic span creation
      excludeProviders: ['AuthService'],
    }),
  ],
})
export class AppModule {}
```

### Span and NoSpan Annotations

`nestjs-skywalking` provides `@Span` and `@NoSpan` annotations that allow you to easily control span creation within your NestJS application. These annotations offer flexibility and compatibility with various scenarios.

```typescript
import { Span, NoSpan } from 'nestjs-skywalking';

// If 'controllers: true' is set during SkyWalkingModule initialization,
// @Span() annotation here is optional for automatic span creation on all controller methods.
@Controller('your-controller')
export class YourController {
  // Use @NoSpan() to exclude specific methods from automatic span creation.
  @NoSpan()
  methodWithoutSpan() {
    // This method will not create a span
  }
}
```

### Examples

#### Basic Usage with Sync and Async Methods

```typescript
import { Span, NoSpan } from 'nestjs-skywalking';

@Controller('your-controller')
export class YourController {
  @Span('syncMethod')
  syncMethod() {
    // Synchronous method logic
  }

  @Span('asyncMethod')
  async asyncMethod() {
    // Asynchronous method logic
  }
}
```

#### Mixing with Other Annotations

```typescript
import { Span } from 'nestjs-skywalking';
import { Get } from '@nestjs/common';

@Controller('your-controller')
export class YourController {
  @Get('/your-route')
  @Span('endpointSpan')
  yourEndpoint() {
    // Endpoint logic
  }
}
```

#### Automatic Error Tagging

The `@Span` annotation not only facilitates span creation but also enhances error handling within your application. When a method annotated with `@Span` throws an error, the `nestjs-skywalking` module automatically catches the error, logs it as tags within the span, and then rethrows the error. This ensures that your error handling logic remains unaffected while still capturing valuable tracing information.

```typescript
import { Span } from 'nestjs-skywalking';

@Injectable()
class YourService {
  @Span('methodWithSpan')
  methodWithSpan() {
    // Any error thrown within this method is automatically caught and tagged in the span.
    // It logs tags like error.name, error.message, error.stack, and then rethrows the error.
    throw new Error('Example error');
  }
}
```

## Advanced Usage

In `nestjs-skywalking`, you can enrich your tracing data by manually adding tags or logging errors within your spans. This allows for more detailed and contextual insights into your application's operations.

### Adding Custom Tags to Spans

You can add custom tags to the current span to provide additional context or information about the operation being traced. This is useful for debugging and monitoring purposes.

```typescript
import { Injectable } from '@nestjs/common';
import { Span, TraceService } from 'nestjs-skywalking';

@Injectable()
class YourService {
  constructor(private readonly traceService: TraceService) {}

  @Span('operationName')
  async methodWithSpan() {
    return new Promise<number>((resolve) => {
      // Adding custom tags to the current span
      this.traceService.addTags({ key1: 'value1', key2: 'value2' });

      setTimeout(() => resolve(42), 100);
    });
  }
}
```

In this example, `methodWithSpan` is traced with `@Span('operationName')`, and during its execution, custom tags are added for more detailed tracing information.

### Logging Errors as Tags in Spans

To assist with error tracking and analysis, you can log errors directly into the span:

```typescript
import { Injectable } from '@nestjs/common';
import { Span, TraceService } from 'nestjs-skywalking';

@Injectable()
class YourService {
  constructor(private readonly traceService: TraceService) {}

  @Span('operationName')
  methodWithSpan() {
    try {
      // Simulate an operation that may throw an error
      throw new Error('example error');
    } catch (error) {
      // Log the error as a tag in the current span
      this.traceService.addError(error);
    } finally {
      return 42;
    }
  }
}
```

In the above example, any error occurring within methodWithSpan is caught and logged into the span using this.traceService.addError(error), allowing for easier identification and analysis of issues.

By utilizing TraceService to manually add tags or log errors, you enhance the observability of your application, providing clearer insights into its behavior and performance.

## Acknowledgements

This project was inspired by the [nestjs-otel](https://github.com/pragmaticivan/nestjs-otel) and [nestjs-opentelemetry](https://github.com/MetinSeylan/Nestjs-OpenTelemetry#readme) projects. We are grateful for their contributions to the NestJS and observability communities.

## License

nestjs-skywalking is Apache 2.0 licensed.
