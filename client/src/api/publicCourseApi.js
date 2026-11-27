import axiosClient from "./axiosClient";

export function fetchPublicCourses() {
  return axiosClient.get("/public/courses", { skipCache: true }).then(function (res) {
    return (res.data && res.data.data && res.data.data.courses) || [];
  });
}

export function fetchPublicCourse(slug) {
  return axiosClient
    .get("/public/courses/" + encodeURIComponent(slug), { skipCache: true })
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

export function resolvePublicCourseItem(slug, itemKey) {
  const location = "/public/courses/" + encodeURIComponent(slug) + "/items/" + encodeURIComponent(itemKey);
  return axiosClient.get(location, { skipCache: true }).then(function (res) {
    return res.data.data.driveId;
  });
}
