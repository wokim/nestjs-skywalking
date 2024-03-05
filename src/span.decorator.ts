import { SetMetadata } from '@nestjs/common';
import { Constants } from './constants';

/**
 * Decorator function that sets the metadata for a span.
 * @param name - The name of the span.
 * @returns A decorator function that sets the metadata for a span.
 */
export const Span = (name?: string) =>
  SetMetadata(Constants.SPAN_METADATA, name);

/**
 * Decorator function that marks a method or route handler as not being traced by SkyWalking.
 * This decorator sets the metadata value to true for the given method or route handler.
 */
export const NoSpan = () => SetMetadata(Constants.NO_SPAN_METADATA, true);
