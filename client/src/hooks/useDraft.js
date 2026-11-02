import { useEffect, useRef } from "react";
import { discardDraft, readDraft, saveDraft } from "../utils/draftStore";

export default function useDraft(name, values, setValues, options) {
  const restored = useRef(false);
  const debounceMs = (options && options.debounceMs) || 400;
  const restoreOnMount = !options || options.restore !== false;

  useEffect(
    function () {
      if (!restoreOnMount || restored.current || !name || typeof setValues !== "function") {
        return;
      }
      const draft = readDraft(name);
      restored.current = true;
      if (!draft) {
        return;
      }
      setValues(function (prev) {
        const next = Object.assign({}, prev);
        Object.keys(draft).forEach(function (key) {
          if (key === "savedAt") {
            return;
          }
          if (next[key] === undefined || next[key] === "") {
            next[key] = draft[key];
          }
        });
        return next;
      });
    },
    [name, setValues, restoreOnMount]
  );

  useEffect(
    function () {
      if (!name || !values) {
        return undefined;
      }
      const timer = setTimeout(function () {
        saveDraft(name, values);
      }, debounceMs);
      return function () {
        clearTimeout(timer);
      };
    },
    [name, values, debounceMs]
  );

  return {
    discard: function () {
      discardDraft(name);
    },
  };
}
