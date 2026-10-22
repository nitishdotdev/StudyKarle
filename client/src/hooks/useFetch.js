import { useCallback, useEffect, useState } from 'react';

export default function useFetch(fetcher, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(function () {
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setErrorDetails(null);
    return fetcher()
      .then(function (result) {
        setData(result);
      })
      .catch(function (err) {
        setError(err.message || 'Failed to load data');
        setErrorStatus(err.status || 0);
        setErrorDetails(err.details || null);
      })
      .finally(function () {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || []);

  useEffect(
    function () {
      load();
    },
    [load]
  );

  return { data, error, errorStatus, errorDetails, loading, reload: load, setData };
}
