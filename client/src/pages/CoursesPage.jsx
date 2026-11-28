import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCourses } from "../api/publicCourseApi";
import Spinner from "../components/common/Spinner";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(function () {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPublicCourses()
      .then(function (list) {
        if (active) setCourses(list);
      })
      .catch(function () {
        if (active) setError("Could not load courses right now. Please try again.");
      })
      .finally(function () {
        if (active) setLoading(false);
      });
    return function () {
      active = false;
    };
  }, []);

  const years = useMemo(
    function () {
      const set = new Set();
      courses.forEach(function (c) {
        if (c.yearNumber) set.add(c.yearNumber);
      });
      return Array.from(set).sort(function (a, b) {
        return a - b;
      });
    },
    [courses]
  );

  const filtered = useMemo(
    function () {
      const q = query.trim().toLowerCase();
      return courses.filter(function (c) {
        if (yearFilter !== "all" && String(c.yearNumber || "") !== yearFilter) {
          return false;
        }
        if (q && !c.title.toLowerCase().includes(q) && !c.yearLabel.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      });
    },
    [courses, yearFilter, query]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Browse courses</h1>
        <p className="mt-2 text-text-secondary">
          Find published notes, past papers, and solutions by subject.
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <input
          type="search"
          value={query}
          onChange={function (e) {
            setQuery(e.target.value);
          }}
          placeholder="Search subjects"
          aria-label="Search courses"
          className="w-full sm:max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
        />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by year">
          <button
            type="button"
            aria-pressed={yearFilter === "all"}
            onClick={function () {
              setYearFilter("all");
            }}
            className={
              "px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors " +
              (yearFilter === "all"
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
            }
          >
            All Years
          </button>
          {years.map(function (yr) {
            const val = String(yr);
            return (
              <button
                key={yr}
                type="button"
                aria-pressed={yearFilter === val}
                onClick={function () {
                  setYearFilter(val);
                }}
                className={
                  "px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors " +
                  (yearFilter === val
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
                }
              >
                Year {yr}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          {courses.length
            ? "No courses match your search or year filter."
            : "No courses have been published yet."}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(function (course) {
            return (
              <Link
                key={course.slug}
                to={"/courses/" + course.slug}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {course.yearLabel}
                    </span>
                    {course.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        {course.priceFormatted} Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        Account Access
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                    {course.title}
                  </h2>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-800">
                      {course.counts.notes} Notes
                    </span>
                    <span className="rounded bg-purple-50 px-2 py-1 font-medium text-purple-800">
                      {course.counts.pyqs} PYQs
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
                      {course.counts.solutions} Solutions
                    </span>
                  </div>
                  <span className="text-primary font-semibold whitespace-nowrap ml-2">
                    View &rarr;
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
