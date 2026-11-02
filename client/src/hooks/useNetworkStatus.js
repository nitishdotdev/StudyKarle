import { useEffect, useState } from "react";
import { getBrowserOnline } from "../utils/networkStatus";

export default function useNetworkStatus() {
  const [online, setOnline] = useState(getBrowserOnline);

  useEffect(function () {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return function () {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { online: online, offline: !online };
}
