/**
 * Whether a pooled browser is actually alive (issue #254).
 *
 * `browser.connected` is the only health signal the pool had, and it is the
 * wrong one. It reports whether the DevTools *transport* is open -- the
 * WebSocket or pipe -- not whether anything at the other end still answers.
 * A Chromium whose browser process is wedged (the state #254 reproduces by
 * aborting a scrape mid-flight over a slow proxy) keeps that transport open
 * and keeps reporting `connected === true`, while every command sent down it
 * hangs until Puppeteer's 180s `protocolTimeout` expires. The pool handed such
 * a session to the next request matching its proxy and User-Agent, and
 * `browser.newPage()` failed with `ProtocolError: Network.enable timed out`
 * for every one of them until the idle timer eventually closed it.
 *
 * So the check is a real CDP round trip. `Browser.getVersion` is the cheapest
 * command there is -- it is answered by the browser process itself, needs no
 * page or target, and changes no state -- which makes it a liveness probe
 * rather than a flag that has gone stale.
 */

import type { BrowserSession } from '../types.js';

/**
 * How long the probe waits for the browser to answer.
 *
 * Generously above a healthy round trip (sub-millisecond on a local pipe) and
 * far below Puppeteer's own 180s `protocolTimeout`, which is the delay this
 * exists to avoid paying.
 */
export const CDP_PROBE_TIMEOUT_MS = 5000;

/** The part of a child process this needs. Satisfied by `ChildProcess`. */
export interface ProbeProcess {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
}

/** The part of a Puppeteer `Browser` this needs. */
export interface CdpProbeTarget {
  readonly connected: boolean;
  version(): Promise<string>;
  process(): ProbeProcess | null;
}

/** Whether the OS process behind a browser has already gone. */
export function isProcessGone(proc: ProbeProcess | null | undefined): boolean {
  if (!proc) return false;
  return proc.exitCode !== null || proc.signalCode !== null;
}

/**
 * Sends one CDP command and reports whether it was answered in time.
 *
 * Never throws and never leaves a timer behind. A rejected command counts as
 * dead: `Browser.getVersion` does not fail on a browser that is working.
 */
export async function probeCdp(
  target: CdpProbeTarget,
  timeoutMs: number = CDP_PROBE_TIMEOUT_MS
): Promise<boolean> {
  if (!target.connected) return false;
  if (isProcessGone(target.process())) return false;

  let timer: NodeJS.Timeout | undefined;
  try {
    const answered = target.version().then(
      () => true,
      () => false
    );
    const expired = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), timeoutMs);
      timer.unref?.();
    });
    return await Promise.race([answered, expired]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Whether this session may serve a request.
 *
 * A session still launching has nothing to probe: it is judged by its
 * `launchPromise`, which the caller awaits anyway.
 */
export async function isSessionResponsive(
  session: BrowserSession,
  timeoutMs: number = CDP_PROBE_TIMEOUT_MS
): Promise<boolean> {
  if (session.tainted) return false;
  if (!session.browser) return session.launchPromise !== null;
  return probeCdp(session.browser, timeoutMs);
}

/**
 * Errors that mean the DevTools connection, not the page, is the problem.
 *
 * Deliberately narrow. A navigation or selector timeout says the *site* was
 * slow and the browser is fine, so it must not match -- throwing away a
 * healthy browser on every slow retailer would trade this bug for a worse
 * one. What matches is Puppeteer's own `ProtocolError`, the CDP command
 * failures it reports as "Protocol error (...)", the `protocolTimeout`
 * message behind `Network.enable timed out`, and the closed-transport errors
 * that mean the browser went away mid-command.
 */
const PROTOCOL_ERROR_PATTERN =
  /protocol error|protocoltimeout|target closed|session closed|connection closed|websocket is not open|browser has disconnected/i;

export function isProtocolError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.name === 'ProtocolError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return PROTOCOL_ERROR_PATTERN.test(message);
}
