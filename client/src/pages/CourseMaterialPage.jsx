import React from "react";
import { useParams } from "react-router-dom";
import { resolvePublicCourseItem } from "../api/publicCourseApi";
import AppShell from "../components/layout/AppShell";
import ErrorState from "../components/common/ErrorState";
import NotFoundState from "../components/common/NotFoundState";
import PageLoader from "../components/common/PageLoader";
import useFetch from "../hooks/useFetch";
import DriveFilePage from "./DriveFilePage";

export default function CourseMaterialPage() {
  const { slug, itemKey } = useParams();
  const { data, loading, error, errorStatus, reload } = useFetch(
    function () { return resolvePublicCourseItem(slug, itemKey); },
    [slug, itemKey]
  );

  if (loading) return <PageLoader />;
  if (errorStatus === 404) {
    return <AppShell><NotFoundState title="Course material not found" /></AppShell>;
  }
  if (error || !data) {
    return <AppShell><ErrorState message={error || "Couldn't open course material"} onRetry={reload} /></AppShell>;
  }
  return <DriveFilePage key={data} courseNodeId={data} courseSlug={slug} courseItemKey={itemKey} />;
}
