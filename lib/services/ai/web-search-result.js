const MAX_CITATIONS = 100;
const MAX_SOURCES = 50;
const MAX_TITLE_LENGTH = 240;
const MAX_URL_LENGTH = 2_000;
const MAX_METADATA_BYTES = 64 * 1024;

function safeUrl(value) {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.toString().length > MAX_URL_LENGTH) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedUrl(value) {
  const url = safeUrl(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function title(value, url) {
  const text = typeof value === "string" ? value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim() : "";
  return (text && !/^(untitled source|web source)$/i.test(text)
    ? text
    : new URL(url).hostname).slice(0, MAX_TITLE_LENGTH);
}

function outputItems(response) {
  return Array.isArray(response?.output) ? response.output : [];
}

function outputText(item) {
  if (item?.type !== "message" || !Array.isArray(item.content)) return "";
  return item.content
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function citationFromAnnotation(annotation, outputIndex, contentIndex, itemId) {
  if (annotation?.type !== "url_citation") return null;
  const url = safeUrl(annotation.url);
  if (!url || !Number.isInteger(annotation.start_index) || !Number.isInteger(annotation.end_index)) {
    return null;
  }
  if (annotation.start_index < 0 || annotation.end_index < annotation.start_index) return null;
  return {
    type: "url_citation",
    startIndex: annotation.start_index,
    endIndex: annotation.end_index,
    title: title(annotation.title, url),
    url,
    outputIndex,
    contentIndex,
    itemId: itemId || null,
  };
}

function sourceFromValue(source) {
  const url = safeUrl(source?.url);
  if (!url) return null;
  return { title: title(source?.title, url), url };
}

function capMetadata(citations, sources) {
  let result = { citations: citations.slice(0, MAX_CITATIONS), sources: sources.slice(0, MAX_SOURCES) };
  while (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_METADATA_BYTES) {
    if (result.citations.length > 0) result = { ...result, citations: result.citations.slice(0, -1) };
    else if (result.sources.length > 0) result = { ...result, sources: result.sources.slice(0, -1) };
    else break;
  }
  return result;
}

export function dedupeSources(sources = []) {
  const merged = new Map();
  for (const value of sources) {
    const source = sourceFromValue(value);
    if (!source) continue;
    const key = normalizedUrl(source.url);
    const previous = merged.get(key);
    if (!previous) merged.set(key, source);
    else if (previous.title === new URL(previous.url).hostname && source.title !== new URL(source.url).hostname) {
      merged.set(key, { ...previous, title: source.title });
    }
  }
  return [...merged.values()];
}

export function parseWebSearchResponse(response) {
  const citations = [];
  const sources = [];
  const actions = [];
  const items = outputItems(response);
  const textParts = [];

  items.forEach((item, outputIndex) => {
    if (item?.type === "web_search_call") {
      const itemSources = Array.isArray(item.action?.sources) ? item.action.sources : [];
      for (const source of itemSources) {
        const parsed = sourceFromValue(source);
        if (parsed) sources.push(parsed);
      }
      actions.push({
        itemId: item.id || null,
        outputIndex,
        status: item.status || null,
        type: item.type,
      });
      return;
    }
    const text = outputText(item);
    if (!text) return;
    textParts.push(text);
    item.content.forEach((part, contentIndex) => {
      const annotations = Array.isArray(part.annotations) ? part.annotations : [];
      for (const annotation of annotations) {
        const parsed = citationFromAnnotation(annotation, outputIndex, contentIndex, item.id);
        if (parsed) {
          citations.push(parsed);
          sources.push({ title: parsed.title, url: parsed.url });
        }
      }
    });
  });

  const capped = capMetadata(citations, dedupeSources(sources));
  return {
    ok: true,
    text: typeof response?.output_text === "string" ? response.output_text : textParts.join(""),
    annotations: capped.citations,
    citations: capped.citations,
    sources: capped.sources,
    searchActions: actions.slice(0, MAX_SOURCES),
    responseId: response?.id || null,
    provider: "openai",
    searchUsed: items.some((item) => item?.type === "web_search_call"),
    untrustedExternalData: true,
  };
}

export function parseWebSearchEvent(event) {
  if (!event || typeof event !== "object") return null;
  if (event.type === "response.output_text.delta") {
    return { type: "delta", text: typeof event.delta === "string" ? event.delta : "" };
  }
  if (event.type === "response.web_search_call.in_progress" || event.type === "response.web_search_call.searching" || event.type === "response.web_search_call.completed") {
    return {
      type: "search",
      itemId: event.item_id || null,
      status: event.type.split(".").at(-1),
    };
  }
  return null;
}
