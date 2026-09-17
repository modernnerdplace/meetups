// Kleine markdown-renderer. Bewust geen extra dependency: de omschrijvingen van
// een meetup zijn koppen, alinea's, lijsten, links en af en toe wat code.
// Alle invoer wordt eerst ge-escaped, dus er kan geen ruwe HTML doorheen.

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(raw: string) {
  const url = raw.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(url)) return url;
  return "#";
}

/** Inline opmaak op al ge-escapete tekst. */
function inline(text: string): string {
  const codes: string[] = [];
  // Code eerst apart zetten, zodat sterretjes daarbinnen met rust worden gelaten.
  let out = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `@@mnpcode${codes.length - 1}@@`;
  });

  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
      return `<img src="${safeHref(src)}" alt="${alt}" loading="lazy" />`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      const url = safeHref(href);
      const external = /^https?:/i.test(url);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${url}"${attrs}>${label}</a>`;
    })
    .replace(/(^|[^\w])\*\*([^*]+)\*\*/g, "$1<strong>$2</strong>")
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_([^_\n]+)_/g, "$1<em>$2</em>")
    // Kale URL's klikbaar maken.
    .replace(
      /(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g,
      (_m, pre: string, url: string) =>
        `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https?:\/\//, "")}</a>`,
    );

  return out.replace(/@@mnpcode(\d+)@@/g, (_m, i: string) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source.replace(/\r\n/g, "\n")).split("\n");
  const html: string[] = [];
  let i = 0;

  // Een enkele regelovergang blijft staan als <br>. De omschrijvingen uit
  // meetup.com zetten hun programma regel voor regel neer, zonder lege regel.
  const flushParagraph = (buffer: string[]) => {
    if (buffer.length === 0) return;
    html.push(`<p>${buffer.map((line) => inline(line)).join("<br />")}</p>`);
    buffer.length = 0;
  };

  const paragraph: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Codeblok
    if (/^\s*```/.test(line)) {
      flushParagraph(paragraph);
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${code.join("\n")}</code></pre>`);
      continue;
    }

    // Lege regel
    if (line.trim() === "") {
      flushParagraph(paragraph);
      i += 1;
      continue;
    }

    // Streep
    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      flushParagraph(paragraph);
      html.push("<hr />");
      i += 1;
      continue;
    }

    // Kop
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      const level = Math.min(heading[1].length + 1, 5); // h1 blijft voor de paginatitel
      html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // Citaat
    if (/^\s*&gt;\s?/.test(line)) {
      flushParagraph(paragraph);
      const quote: string[] = [];
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*&gt;\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote><p>${inline(quote.join(" ").trim())}</p></blockquote>`);
      continue;
    }

    // Lijst
    const bullet = /^\s*[-*+]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      flushParagraph(paragraph);
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        let item = lines[i].replace(marker, "");
        i += 1;
        // Doorlopende regels binnen hetzelfde punt.
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          !bullet.test(lines[i]) &&
          !numbered.test(lines[i]) &&
          !/^(#{1,4})\s/.test(lines[i])
        ) {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(`<li>${inline(item.trim())}</li>`);
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph(paragraph);
  return html.join("\n");
}

/** Markdown terugbrengen tot platte tekst, voor een meta-description. */
export function markdownToText(source: string, limit = 180) {
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}
