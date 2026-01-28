import {
  IPlugin,
  Mutable,
  Data,
  Heading,
  Image,
  Parent,
  PhrasingContent,
  RootContent,
  BlockContent,
  TableRow,
  Html,
  Literal,
} from "../../core/src";
import { standardizeColor } from "./utils";
import { AlignmentType, BorderStyle, IBorderOptions } from "docx";

/**
 * HTML inline tags supported by the plugin for conversion.
 */
const INLINE_TAGS = [
  "A",
  "ABBR",
  "ACRONYM", // Deprecated but still inline
  "B",
  "BDI",
  "BDO",
  "BIG", // Deprecated but still inline
  "BR",
  "BUTTON", // Technically inline-block, but often treated inline
  "CITE",
  "CODE",
  "DATA",
  "DATALIST",
  "DEL",
  "DFN",
  "EM",
  "I",
  "IMG",
  "INPUT",
  "INS",
  "KBD",
  "LABEL",
  "MARK",
  "METER",
  "NOSCRIPT",
  "OBJECT",
  "OUTPUT",
  "Q",
  "RUBY",
  "RP",
  "RT",
  "S",
  "SAMP",
  "SCRIPT",
  "SELECT",
  "SLOT",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "svg",
  "TEMPLATE",
  "TEXTAREA",
  "TIME",
  "U",
  "TT", // Deprecated
  "VAR",
  "WBR",
] as const;

const EMPTY_TAGS = ["br", "hr", "img", "input"];

/**
 * Mapping of DOM tag names to MDAST node types.
 */
const DOM_TO_MDAST_MAP = {
  A: "link",
  B: "strong",
  BR: "break",
  EM: "emphasis",
  STRONG: "strong",
  I: "emphasis",
  IMG: "image",
  DEL: "delete",
  S: "delete",
} as const;

/**
 * CSS border styles that are recognized for conversion.
 */
const CSS_BORDER_STYLES = [
  "solid",
  "dashed",
  "dotted",
  "double",
  "none",
  "ridge",
  "groove",
  "inset",
  "outset",
];

interface HtmlNode extends Html {
  tag: string;
  children: (RootContent | PhrasingContent)[];
}

/**
 * Parsed CSS border representation.
 */
type CssBorder = { width?: number; color?: string; style?: string };

/**
 * Border settings parsed from individual sides.
 */
type CssBorders = Partial<Record<"border" | "top" | "bottom" | "left" | "right", CssBorder>>;

/**
 * Extracts individual border styles from a CSS style string.
 *
 * @param borderString - Raw style string from the `style` attribute.
 * @returns Parsed border information by edge.
 */
const parseCssBorders = (borderString: string | null): CssBorders => {
  if (!borderString) return {};
  const borders: CssBorders = {};

  // Match individual border properties (border-left, border-right, etc.)
  const borderMatches = borderString.match(/border(-\w+)?:\s*[^;]+/gi);
  if (!borderMatches) return {};

  for (const match of borderMatches) {
    const [property, value] = match.split(":").map(s => s.trim());
    const parts = value.split(/\s+/);

    // Extract width, style, and color
    const width = parts.find(p => p.endsWith("px"))?.replace("px", "");
    const style = parts.find(p => CSS_BORDER_STYLES.includes(p.toLowerCase()));
    const color = parts.find(
      p => !p.endsWith("px") && !CSS_BORDER_STYLES.includes(p.toLowerCase()),
    );

    // Determine border key (e.g., borderLeft, borderTop)
    const key = property === "border" ? "border" : property.replace("border-", "");

    // Assign parsed values to the correct property
    borders[key as keyof CssBorders] = {
      ...(width ? { width: parseInt(width, 1) } : {}),
      ...(style ? { style } : {}),
      ...(color ? { color } : {}),
    };
  }

  return borders;
};

/**
 * Maps CSS border styles to docx-compatible border styles.
 */
const STYLE_MAP = {
  solid: BorderStyle.SINGLE,
  dashed: BorderStyle.DASHED,
  dotted: BorderStyle.DOTTED,
  double: BorderStyle.DOUBLE,
  none: BorderStyle.NONE,
  ridge: BorderStyle.THREE_D_EMBOSS,
  groove: BorderStyle.THREE_D_ENGRAVE,
  inset: BorderStyle.INSET,
  outset: BorderStyle.OUTSET,
} as const;

/**
 * Converts a parsed CSS border to a docx-compatible IBorderOptions.
 *
 * @param cssBorder - Parsed border properties.
 * @returns docx-compatible border settings or undefined.
 */
const getDocxBorder = (cssBorder?: CssBorder) => {
  if (!cssBorder || !Object.keys(cssBorder).length) return undefined;
  const { width, color, style } = cssBorder;
  const border: Mutable<IBorderOptions> = {
    style: style ? STYLE_MAP[style as keyof typeof STYLE_MAP] : BorderStyle.SINGLE,
  };
  if (width) border.size = width;
  if (color) border.color = standardizeColor(color);
  return border;
};

/**
 * Parses inline or block style metadata from a DOM node.
 *
 * @param el - DOM element to extract style from.
 * @param inline - Flag indicating if the style is for inline content.
 * @returns Style metadata as `Data`.
 * skipcq: JS-R1005
 */
const parseStyles = (el: Node, inline = true): Data => {
  const data: Data = {};
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return data;
  const { textAlign, fontWeight, fontStyle, textDecoration, textTransform, color } = el.style;
  const style = el.getAttribute("style");
  const borders = parseCssBorders(style);
  data.style = style ?? undefined;
  if (inline && borders.border) {
    data.border = getDocxBorder(borders.border);
  } else if (Object.keys(borders).length) {
    const leftBorder = { ...borders.border, ...borders.left };
    const rightBorder = { ...borders.border, ...borders.right };
    const topBorder = { ...borders.border, ...borders.top };
    const bottomBorder = { ...borders.border, ...borders.bottom };
    data.border = {
      left: getDocxBorder(leftBorder),
      right: getDocxBorder(rightBorder),
      top: getDocxBorder(topBorder),
      bottom: getDocxBorder(bottomBorder),
    };
  }

  if (textAlign) {
    const alignKey = textAlign.toUpperCase();
    if (Object.keys(AlignmentType).includes(alignKey))
      data.alignment = AlignmentType[alignKey as keyof typeof AlignmentType];
    else if (alignKey === "JUSTIFY") data.alignment = AlignmentType.JUSTIFIED;
  }

  if (/bold/.test(fontWeight) || parseInt(fontWeight) >= 500) data.bold = true;

  if (/(italic|oblique)/.test(fontStyle)) data.italics = true;

  switch (textDecoration) {
    case "underline":
      data.underline = {};
      break;
    case "overline":
      data.emphasisMark = {};
      break;
    case "line-through":
      data.strike = true;
      break;
  }

  if (textTransform === "uppercase") data.allCaps = true;

  if (textTransform === "lowercase") data.smallCaps = true;

  if (color) data.color = standardizeColor(color);

  const tagName = el.tagName;
  if (tagName === "SUP") data.superScript = true;
  else if (tagName === "SUB") data.subScript = true;
  else if (["STRONG", "B"].includes(tagName)) data.bold = true;
  else if (["EM", "I"].includes(tagName)) data.italics = true;
  else if (["DEL", "S"].includes(tagName)) data.strike = true;
  else if (["U", "INS"].includes(tagName)) data.underline = {};
  else if (tagName === "MARK") {
    data.highlight = "yellow";
    data.emphasisMark = {};
  } else if (tagName === "PRE") {
    data.pre = true;
  } else if (tagName === "INPUT") {
    data.type = (el as HTMLInputElement).type;
    data.name = (el as HTMLInputElement).name;
    data.value = (el as HTMLInputElement).value ?? (el as HTMLInputElement).defaultValue;
    data.checked = (el as HTMLInputElement).checked ?? (el as HTMLInputElement).defaultChecked;
  }
  data.tag = tagName.toLowerCase() as keyof HTMLElementTagNameMap;
  return data;
};

/**
 * Converts an inline HTML DOM node into MDAST `PhrasingContent`.
 *
 * @param el - DOM node to process.
 * @returns PhrasingContent-compatible node.
 */
const processInlineDOMNode = (el: Node, isPre = false): PhrasingContent => {
  if (!(el instanceof HTMLElement || el instanceof SVGElement))
    return {
      type: "text",
      value: (isPre ? el.textContent : el.textContent?.replace(/^\s+|\s+$/g, " ")) ?? "",
    };

  const children = Array.from(el.childNodes).map(cNode => processInlineDOMNode(cNode, isPre));
  const data = parseStyles(el);
  const attributes: Record<string, string> = el
    .getAttributeNames()
    .reduce((acc, cur) => ({ ...acc, [cur]: el.getAttribute(cur) }), {});

  const tagName = el.tagName;
  switch (tagName) {
    case "BR":
      return { type: "break" };
    case "IMG":
      return {
        type: "image",
        url: attributes.src ?? "",
        alt: attributes.alt ?? "",
        data: { ...data, ...attributes },
      } as Image;
    case "svg":
      return {
        type: "svg",
        value: el.outerHTML,
        data,
      };
    case "EM":
    case "I":
    case "STRONG":
    case "B":
    case "DEL":
    case "S":
      return {
        type: DOM_TO_MDAST_MAP[tagName],
        children,
        data,
      };
    case "A":
      return {
        type: "link",
        url: attributes.href ?? "",
        children,
        data,
      };
    case "INPUT":
      return /(radio|checkbox)/.test((el as HTMLInputElement).type)
        ? { type: "checkbox", data }
        : {
            type: "text",
            value: data.value ?? `_${(el as HTMLInputElement).value || "_".repeat(20)}_`,
            data: {
              ...data,
              border: { style: BorderStyle.OUTSET },
            },
          };
  }
  // Security Note: script, iframe tags will be removed as fragment
  return { type: "fragment", children, data };
};

/**
 * Converts DOM structure into a paragraph or fragment of block nodes.
 *
 * @param el - Root DOM node to process.
 * @param data - Optional metadata to apply.
 * @returns A BlockContent node or fragment node.
 */
const createFragmentWithParentNodes = (el: Node, data?: Data): BlockContent => {
  const childNodes = Array.from(el.childNodes);
  const children: BlockContent[] = [];
  const tmp: Node[] = [];
  for (const node of childNodes) {
    if (
      (node instanceof HTMLElement || node instanceof SVGElement) &&
      !INLINE_TAGS.includes(node.tagName as (typeof INLINE_TAGS)[number])
    ) {
      if (tmp.length) {
        children.push({
          type: "paragraph",
          children: tmp.map(tNode => processInlineDOMNode(tNode, data?.pre)),
        });
        tmp.length = 0;
      }
      // skipcq: JS-0357
      children.push(processDOMNode(node));
    } else tmp.push(node);
  }
  if (tmp.length)
    children.push({
      type: "paragraph",
      children: tmp.map(tNode => processInlineDOMNode(tNode, data?.pre)),
    });
  return children.length === 1
    ? { ...children[0], data: { ...data, ...children[0].data } }
    : {
        type: "fragment",
        children,
        data,
      };
};

/**
 * Generates MDAST `tableRow` nodes from DOM table rows.
 *
 * @param el - Table DOM node.
 * @param data_ - Optional style metadata.
 * @returns List of table rows.
 */
const createRows = (el: HTMLElement, data_?: Data): TableRow[] =>
  Array.from(el.children)
    .map(tr => {
      const data = { ...data_, ...parseStyles(tr as HTMLElement) };
      return tr.tagName === "TR"
        ? ({
            type: "tableRow",
            children: Array.from(tr.children).map(col => ({
              type: "tableCell",
              children: [createFragmentWithParentNodes(col, { ...data, tag: undefined })],
              data: { ...data, tag: col.tagName.toLowerCase() },
            })),
            data,
          } as TableRow)
        : // to handle tbody and thead as it is not present in md
          createRows(tr as HTMLElement, data);
    })
    .flat();

/**
 * Default table border style for DOCX tables.
 */
const border: IBorderOptions = { style: "single" };
const defaultBorder = { left: border, right: border, top: border, bottom: border };

/**
 * Converts block-level HTML elements into MDAST `BlockContent` nodes.
 *
 * @param el - HTML or svg element to process.
 * @returns Converted block content node.
 */
const processDOMNode = (el: HTMLElement | SVGElement): BlockContent => {
  const data = parseStyles(el);
  const tagName = el.tagName;
  switch (tagName) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6":
      return {
        type: "heading",
        depth: parseInt(tagName[1]),
        children: Array.from(el.childNodes).map(cNode => processInlineDOMNode(cNode)),
        data,
      } as Heading;
    case "PRE":
    case "P":
    case "DIV":
    case "DETAILS":
    case "SUMMARY":
    case "FORM":
    case "LI":
      return createFragmentWithParentNodes(el, data);
    case "UL":
    case "OL":
      return {
        type: "list",
        ordered: tagName === "OL",
        children: Array.from(el.childNodes).map(node => ({
          type: "listItem",
          children: [createFragmentWithParentNodes(node)],
          data,
        })),
      };
    case "HR":
      return { type: "thematicBreak", data };
    case "BLOCKQUOTE":
      return {
        type: "blockquote",
        children: Array.from(el.childNodes).map(node => createFragmentWithParentNodes(node)),
        data,
      };
    case "TABLE": {
      const children = createRows(el as HTMLElement);
      return {
        type: "table",
        children,
        data,
      };
    }
    case "STYLE":
      return {
        type: "paragraph",
        children: [{ type: "text", value: `Not supported yet!\n\n${el.textContent}` }],
        data: { ...data, pre: true, border: defaultBorder },
      };
  }
  return { type: "paragraph", children: [processInlineDOMNode(el)], data };
};

/** process inline AST nodes */
const processInlineNode = (node: HtmlNode) => {
  const value = node.value?.trim() ?? "";
  const tag = value.split(" ")[0].slice(1);
  const el = document.createElement("div");
  el.innerHTML = value.endsWith("/>") ? value : `${value}</${tag}>`;
  Object.assign(node, {
    ...processInlineDOMNode(el.children[0]),
    children: node.children ?? [],
  });
};

/**
 * Consolidates inline HTML tag children inside valid tag-matching groups.
 *
 * @param pNode - MDAST parent node.
 */
const preprocess = (pNode: Parent, isRoot = true) => {
  const children: RootContent[] = [];
  const htmlNodeStack: HtmlNode[] = [];

  for (const node of pNode.children) {
    if ((node as Parent).children?.length) preprocess(node as Parent, false);
    const valueRaw = (node as Literal).value;
    // node.value could be a promise too, e.g., mermaid SVG
    const value = typeof valueRaw === "string" ? valueRaw : "";
    // match only inline non-self-closing html nodes.
    const tag = value?.split?.(" ")[0].replace(/^<|\/?>$/g, "");
    if (node.type === "html" && !EMPTY_TAGS.includes(tag) && /^<[^>]*[^/]>$/.test(value)) {
      // ending tag
      if (tag[0] === "/") {
        const hNode = htmlNodeStack.shift();
        if (!hNode) {
          console.warn(
            `[HTML Plugin] Invalid HTML detected: closing tag without matching opening tag: ${value}`,
          );
          continue;
        }
        processInlineNode(hNode);
        (htmlNodeStack[0]?.children ?? children).push(hNode);
      } else {
        htmlNodeStack.unshift({ ...node, children: [], tag });
      }
    } else if (htmlNodeStack.length) {
      htmlNodeStack[0].children.push(node);
    } else {
      children.push(node);
    }

    const isSelfClosingTag =
      node.type === "html" && (EMPTY_TAGS.includes(tag) || /^<[^>]*\/>$/.test(value));

    // self closing tags
    if (isSelfClosingTag && !isRoot) {
      // @ts-expect-error -- ok
      processInlineNode(node);
    } else if ((isSelfClosingTag && isRoot) || (node.type === "html" && !/^<[^>]*>$/.test(value))) {
      // block html
      const el = document.createElement("div");
      el.innerHTML = value;
      Object.assign(node, createFragmentWithParentNodes(el));
    }
  }
  pNode.children = children;
};

/**
 * HTML plugin for MDAST-to-DOCX conversion.
 * Converts inline and block-level HTML content within markdown into structured MDAST nodes.
 *
 * Supports `<br>`, `<img>`, `<strong>`, `<em>`, `<table>`, `<ul>`, `<input>`, and other inline tags.
 * Should be used before `image`, `table`, or other content plugins in the pipeline.
 *
 * @returns Configured HTML plugin for MDAST parsing.
 */
// @ts-expect-error -- we are not using the definitions
export const htmlPlugin: () => IPlugin = () => {
  return {
    preprocess,
  };
};
