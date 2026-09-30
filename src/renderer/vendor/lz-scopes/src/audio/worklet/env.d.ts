// Minimal AudioWorkletGlobalScope typings (not part of lib.dom).
declare const sampleRate: number;
declare const currentFrame: number;
declare const currentTime: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, ctor: new (options?: unknown) => AudioWorkletProcessor): void;
