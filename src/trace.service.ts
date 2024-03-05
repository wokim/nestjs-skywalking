import { Injectable } from '@nestjs/common';
import { ContextManager } from 'skywalking-backend-js';

@Injectable()
/**
 * Service for managing traces and spans.
 */
export class TraceService {
  get currentSpan() {
    return ContextManager.currentSpan;
  }

  get contextManager() {
    return ContextManager;
  }

  /**
   * Add tags to the current span.
   * @param tags - The tags to be added.
   */
  addTags(tags: { [key: string]: any }) {
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
