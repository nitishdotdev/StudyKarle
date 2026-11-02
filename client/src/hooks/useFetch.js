import { useCallback, useEffect, useRef, useState } from "react";

export default function useFetch(fetcher, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const requestIdRef = useRef(0);
  const loadIdentityRef = useRef(null);

  const load = useCallback(function () {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setErrorDetails(null);
    return fetcher()
      .then(function (result) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setData(result);
        hasDataRef.current = true;
      })
      .catch(function (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setError(err.message || "Failed to load data");
        setErrorStatus(err.status || 0);
        setErrorDetails(err.details || null);
      })
      .finally(function () {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || []);

  useEffect(
    function () {
      if (loadIdentityRef.current !== load) {
        loadIdentityRef.current = load;
        hasDataRef.current = false;
        setData(null);
        setError(null);
        setErrorStatus(null);
        setErrorDetails(null);
      }
      load();
    },
    [load]
  );

  return {
    data: data,
    error: error,
    errorStatus: errorStatus,
    errorDetails: errorDetails,
    loading: loading,
    refreshing: loading && hasDataRef.current,
    reload: load,
    setData: setData,
  };
}
