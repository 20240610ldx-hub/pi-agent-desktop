import { getAgentDir, ModelRuntime, type CreateModelRuntimeOptions } from "@earendil-works/pi-coding-agent";
import { createPilaudeCredentialStore } from "./credential-store";
import { resolveRequestHeaderValues } from "./model-header-secrets";
import { AsyncLocalStorage } from "node:async_hooks";
import { ModelsError, type AssistantMessageEventStream } from "@earendil-works/pi-ai";
import { createModelRequestRedactor, redactModelError, redactModelEvent } from "./model-request-redaction";

/** All Pilaude model/auth entry points share the app-owned encrypted store. */
export async function createPilaudeModelRuntime(options: CreateModelRuntimeOptions = {}): Promise<ModelRuntime> {
  const runtime = await ModelRuntime.create({ ...options, credentials: options.credentials ?? createPilaudeCredentialStore(getAgentDir()) });
  const requests = new AsyncLocalStorage<{ values: unknown[]; redact: (text: string) => string }>();
  const getAuth = runtime.getAuth.bind(runtime);
  runtime.getAuth = async (model, overrides) => {
    const resolved = await (typeof model === "string" ? getAuth(model, overrides) : getAuth(model, overrides))
      .catch(error => {
        const message = "Provider credentials could not be resolved. Check provider settings.";
        if (error instanceof DOMException) throw new DOMException(message, error.name);
        if (error instanceof ModelsError) throw new ModelsError(error.code, message);
        throw new Error(message);
      });
    if (!resolved) return resolved;
    const headers = resolved.auth.headers && await resolveRequestHeaderValues(resolved.auth.headers, { ...resolved.env, ...overrides?.env });
    const request = requests.getStore();
    if (request) {
      request.values.push(resolved.auth.apiKey, ...Object.values(headers ?? {}));
      request.redact = createModelRequestRedactor(request.values);
    }
    return { ...resolved, auth: { ...resolved.auth, headers } };
  };
  const protectStream = <A extends unknown[]>(run: (...args: A) => AssistantMessageEventStream) => (...args: A) => {
    const request = { values: [] as unknown[], redact: (text: string) => text };
    return requests.run(request, () => {
      const stream = run(...args);
      const push = stream.push.bind(stream);
      const end = stream.end.bind(stream);
      stream.push = event => push(redactModelEvent(event, request.redact));
      stream.end = message => end(redactModelError(message, request.redact));
      return stream;
    });
  };
  runtime.stream = protectStream(runtime.stream.bind(runtime));
  runtime.streamSimple = protectStream(runtime.streamSimple.bind(runtime));
  runtime.streamDeferred = protectStream(runtime.streamDeferred.bind(runtime));
  const protectResult = <A extends unknown[], T>(run: (...args: A) => Promise<T>) => (...args: A): Promise<T> => {
    const request = { values: [] as unknown[], redact: (text: string) => text };
    return requests.run(request, async () => {
      try { return redactModelError(await run(...args), request.redact); }
      catch (error) {
        const message = request.redact(error instanceof Error ? error.message : "Model request failed.");
        if (error instanceof DOMException) throw new DOMException(message, error.name);
        throw new Error(message);
      }
    });
  };
  runtime.generateImages = protectResult(runtime.generateImages.bind(runtime));
  runtime.classify = protectResult(runtime.classify.bind(runtime));
  runtime.cancelDeferred = protectResult(runtime.cancelDeferred.bind(runtime));
  return runtime;
}
