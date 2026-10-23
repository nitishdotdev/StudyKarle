import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

export default function useAuthenticatedImage(path) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    function () {
      if (!path) {
        setSrc(null);
        setFailed(false);
        return undefined;
      }

      let objectUrl = null;
      let cancelled = false;
      setSrc(null);
      setFailed(false);

      axiosClient
        .get(path, { responseType: "blob", skipCache: true })
        .then(function (res) {
          if (cancelled) return;
          const type = res.data && res.data.type ? res.data.type : "";
          if (type && type.indexOf("json") !== -1) {
            setFailed(true);
            return;
          }
          objectUrl = URL.createObjectURL(res.data);
          setSrc(objectUrl);
        })
        .catch(function () {
          if (!cancelled) setFailed(true);
        });

      return function () {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    },
    [path]
  );

  return { src: src, failed: failed };
}
