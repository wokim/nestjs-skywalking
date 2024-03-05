export enum Constants {
  // The following constants are used to store the SkyWalking trace context in the request.
  NO_SPAN_METADATA = 'SKYWALKING_NO_SPAN_METADATA',
  SPAN_METADATA = 'SKYWALKING_SPAN_METADATA',
  SPAN_METADATA_ACTIVE = 'SKYWALKING_SPAN_METADATA_ACTIVE',

  // The following constants are used to inject the SkyWalking trace context into the application.
  TRACE_INJECTORS = 'SKYWALKING_TRACE_INJECTORS',
}
