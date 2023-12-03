/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').RootContent} RootContent
 * @typedef {import('vfile').VFile} VFile
 */

/// <reference types="mdast-util-math" />

import { concatToken, formatMath, formatText } from "./helper.js";
import { shouldAddSpace } from "./rule.js";

export default function remarkLfmFmt() {
  /** @param {RootContent} node */
  function findFirstDescendant(node) {
    if ("children" in node) {
      return findFirstDescendant(node.children[0]);
    }

    return node;
  }

  /** @param {RootContent} node */
  function findLastDescendant(node) {
    if ("children" in node) {
      return findLastDescendant(node.children[node.children.length - 1]);
    }

    return node;
  }

  /**
   * Format all the node in the syntax tree.
   *
   * @param {RootContent} node
   */
  function format(node) {
    switch (node.type) {
      // BlockContent for children
      case "blockquote":
      case "list":
      case "table":
      case "tableRow": {
        node.children.forEach((child) => format(child));
        break;
      }

      case "delete":
      case "emphasis":
      case "heading":
      case "link":
      case "linkReference":
      case "listItem":
      case "paragraph":
      case "strong":
      case "tableCell": {
        let lastAddSpace = false;

        for (let i = 0; i < node.children.length; i++) {
          format(node.children[i]);

          if (i == 0) continue;

          const lastNode = findLastDescendant(node.children[i - 1]);
          const thisNode = findFirstDescendant(node.children[i]);

          if (lastNode.type === "text") {
            if (thisNode.type === "text") {
              const { left, right, addSpace, addSpaceNext } = concatToken(
                lastNode.value,
                thisNode.value,
                lastAddSpace
              );
              lastNode.value = left;
              thisNode.value = right;
              lastAddSpace = addSpaceNext;
              if (addSpace) {
                // @ts-expect-error 我也不知道这里的类型推断是怎么样的 总之很阴间就是了！又不是不能用
                node.children = [
                  ...node.children.slice(0, i),
                  { type: "text", value: " " },
                  ...node.children.slice(i),
                ];
                i++;
              }
            } else if (
              thisNode.type === "inlineMath" ||
              thisNode.type === "inlineCode"
            ) {
              const lastStr = lastNode.value.trimEnd();
              if (
                shouldAddSpace(
                  lastStr[lastStr.length - 1],
                  "A",
                  lastStr !== lastNode.value
                )
              ) {
                lastNode.value = lastStr + " ";
              } else {
                lastNode.value = lastStr;
              }
            }
          } else if (
            lastNode.type === "inlineMath" ||
            lastNode.type === "inlineCode"
          ) {
            if (thisNode.type === "text") {
              const thisStr = thisNode.value.trimStart();
              if (shouldAddSpace("A", thisStr[0], thisStr !== thisNode.value)) {
                thisNode.value = " " + thisStr;
              } else {
                thisNode.value = thisStr;
              }
            }
          } else {
            lastAddSpace = false;
          }
        }

        break;
      }

      case "text": {
        node.value = formatText(node.value);
        break;
      }

      case "inlineMath":
      case "math": {
        node.value = formatMath(node.value);
        break;
      }

      // Do nothing.
      case "yaml":
      case "html":
      case "code":
      case "inlineCode":
      case "break":
      case "thematicBreak":
      case "image":
      case "imageReference":
      case "definition":
      case "footnoteDefinition":
      case "footnoteReference":
        break;
    }
  }

  /**
   * The plugin.
   *
   * @param {Root} tree
   *   Tree.
   * @param {VFile} file
   *   VFile.
   * @returns
   *   Nothing.
   */
  return (tree, file) => {
    tree.children.forEach((node) => format(node));
  };
}
