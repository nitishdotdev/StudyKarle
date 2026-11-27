import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import ErrorState from "../../components/common/ErrorState";
import PageLoader from "../../components/common/PageLoader";
import axiosClient from "../../api/axiosClient";
import useFetch from "../../hooks/useFetch";

const endpoint = "/admin/course-publications";

function PublicationEditor({ folderId, onSave }) {
  const { data, loading, error, reload } = useFetch(function () {
    return axiosClient.get(endpoint + "/" + folderId, { skipCache: true }).then((res) => res.data.data);
  }, [folderId]);
  const [published, setPublished] = useState(false);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(function () {
    if (!data) return;
    setPublished(Boolean(data.publication?.published));
    setSelected(data.files.filter((file) => file.item_key).map((file) => file.id));
  }, [data]);

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setSaveError("");
    setSaving(true);
    try {
      const { data: response } = await axiosClient.put(endpoint + "/" + folderId, { published, fileIds: selected });
      const publication = response.data;
      setMessage(publication.published ? "Course publication saved." : "Course is hidden from the public catalog.");
      onSave();
      reload();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || loading) return <PageLoader />;

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <fieldset disabled={saving} className="space-y-4">
        <legend className="mb-3 text-lg font-semibold">{data.folder.path}</legend>
        <label className="flex gap-2">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          Publish this course
        </label>
        {data.publication?.published ? <a className="text-primary underline" href={"/courses/" + data.publication.slug}>View public course</a> : null}
        <p className="text-sm">Select the materials whose titles and folder labels may appear publicly.</p>
        {data.files.length ? (
          <ul className="max-h-96 space-y-2 overflow-auto">
            {data.files.map(function (file) {
              return (
                <li key={file.id}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(file.id)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelected((previous) => checked ? [...previous, file.id] : previous.filter((id) => id !== file.id));
                      }}
                    />
                    {file.path}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : <p>This course has no synced materials.</p>}
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">
          {saving ? "Saving…" : "Save publication"}
        </button>
      </fieldset>
      {message ? <p role="status">{message}</p> : null}
      {saveError ? <p role="alert">{saveError}</p> : null}
    </form>
  );
}

export default function AdminCoursePublicationsPage() {
  const [folderId, setFolderId] = useState("");
  const { data, loading, error, reload } = useFetch(function () {
    return axiosClient.get(endpoint, { skipCache: true }).then((res) => res.data.data.courses);
  }, []);

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl space-y-4 p-4">
        <h1 className="text-2xl font-bold">Course publications</h1>
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {loading && !data ? <PageLoader /> : null}
        {data?.length ? (
          <label className="block">
            <span className="block font-semibold">Course folder</span>
            <select
              className="mt-2 w-full rounded-lg border p-2"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
            >
              <option value="">Select a course</option>
              {data.map((course) => <option key={course.id} value={course.id}>{course.path}{course.published ? " (Published)" : ""}</option>)}
            </select>
          </label>
        ) : !loading && !error ? <p>No course folders have been synced.</p> : null}
        {folderId ? <PublicationEditor key={folderId} folderId={folderId} onSave={reload} /> : null}
      </section>
    </AppShell>
  );
}
