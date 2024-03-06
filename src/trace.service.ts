import { Injectable } from '@nestjs/common';
import { ContextManager } from 'skywalking-backend-js';
import { NoSpan } from './span.decorator';

@Injectable()
@NoSpan()
export class TraceService {
  /**
   * Gets the current span.
   * @returns The current span.
   */
  get currentSpan() {
    return ContextManager.currentSpan;
  }

  /**
   * Gets the current context.
   * @returns The current context.
   */
  get currentContext() {
    return ContextManager.current;
  }

  /**
   * Returns the context manager.
   * @returns The context manager instance.
   */
  get contextManager() {
    return ContextManager;
  }

  /**
   * Add tags to the current span.
   * @param tags - The tags to be added.
   */
  addTags(tags: { [key: string]: string }) {
    for (const key in tags) {
      if (tags.hasOwnProperty(key)) {
        this.currentSpan.tag({
          key: key,
          val: tags[key],
          overridable: false,
        });
      }
    }
  }

  /**
   * Add an error to the current span as an 'Error' tag.
   * @param error - The error to be added.
   */
  addError(error: Error) {
    this.currentSpan.tag({
      key: 'error.name',
      val: error.name,
      overridable: false,
    });
    this.currentSpan.tag({
      key: 'error.message',
      val: error.message,
      overridable: false,
    });
    this.currentSpan.tag({
      key: 'error.stack',
      val: error.stack || '',
      overridable: false,
    });
  }
}
