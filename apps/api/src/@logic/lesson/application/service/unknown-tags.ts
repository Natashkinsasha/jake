import { Logger } from "@nestjs/common";

const logger = new Logger("UnknownTagStrip");

/**
 * Matches any XML-like tag: <tagname ...>...</tagname> or self-closing <tagname ... />
 * Captures the tag name for logging.
 */
const SELF_CLOSING_TAG_RE = /<([a-z_][a-z0-9_]*)\b[^>]*\/>/gi;
const FULL_TAG_RE = /<([a-z_][a-z0-9_]*)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function stripUnknownTags(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replaceAll(FULL_TAG_RE, (match, tagName: string) => {
    logger.warn(`Unknown LLM tag stripped (full): <${tagName}> — content: ${match.slice(0, 200)}`);
    return "";
  });

  cleaned = cleaned.replaceAll(SELF_CLOSING_TAG_RE, (match, tagName: string) => {
    logger.warn(`Unknown LLM tag stripped (self-closing): <${tagName} /> — content: ${match.slice(0, 200)}`);
    return "";
  });

  return cleaned;
}

/**
 * Streaming-safe unknown tag buffer.
 * Buffers text that starts with `<` and might be an incomplete tag.
 * Must be the LAST buffer in the pipeline (after all known tag extractors).
 */
export class UnknownTagBuffer {
  private buffer = "";

  push(chunk: string): string {
    this.buffer += chunk;

    // Look for a `<` that might start an unknown tag
    const openIdx = this.buffer.lastIndexOf("<");

    if (openIdx === -1) {
      // No open bracket — everything is safe
      const text = this.buffer;
      this.buffer = "";
      return stripUnknownTags(text);
    }

    const afterOpen = this.buffer.slice(openIdx);

    // If it looks like it could be the start of a tag but isn't closed yet, buffer it
    if (/^<[a-z_]/i.test(afterOpen) && !afterOpen.includes(">")) {
      const safeText = this.buffer.slice(0, openIdx);
      this.buffer = afterOpen;
      return stripUnknownTags(safeText);
    }

    // Otherwise the `<` is either not a tag or it's a complete tag — process everything
    const text = this.buffer;
    this.buffer = "";
    return stripUnknownTags(text);
  }

  flush(): string {
    const text = this.buffer;
    this.buffer = "";
    // At stream end, if there's an incomplete tag, strip it too
    return stripUnknownTags(text);
  }
}
