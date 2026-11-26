import axiosClient from "./axiosClient";

export function fetchPublicCourses() {
  return axiosClient.get("/public/courses").then(function (res) {
    return (res.data && res.data.data && res.data.data.courses) || [];
  });
}

export function fetchPublicCourse(slug) {
  return axiosClient
    .get("/public/courses/" + encodeURIComponent(slug))
    .then(function (res) {
      return (res.data && res.data.data && res.data.data.course) || null;
    });
}

export function trackCourseEvent(slug, eventType) {
  if (!slug || !eventType) return Promise.resolve();
  return axiosClient
    .post("/public/courses/" + encodeURIComponent(slug) + "/events", {
      eventType: eventType,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    })
    .catch(function () {
      // Analytics tracking is best-effort and must never interrupt browsing.
      return null;
    });
}
