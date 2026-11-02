import { useEffect, useState } from "react";

export default function useDelayedFlag(active, delayMs) {
  const [visible, setVisible] = useState(false);

  useEffect(
    function () {
      if (!active) {
        setVisible(false);
        return undefined;
      }
      const delay = typeof delayMs === "number" ? delayMs : 200;
      const timer = setTimeout(function () {
        setVisible(true);
      }, delay);
      return function () {
        clearTimeout(timer);
      };
    },
    [active, delayMs]
  );

  return visible;
}
