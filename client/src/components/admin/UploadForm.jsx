import React, { useEffect, useState } from "react";
import Input from "../common/Input";
import Button from "../common/Button";
import {
  fetchAdminSubjects,
  uploadNote,
  fetchSubjectUnits,
} from "../../api/adminApi"; // fetchSubjectUnits added
import { useToast } from "../../context/ToastContext";

export default function UploadForm({ onUploaded }) {
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subjectId: "",
    unitId: "", // ← ADDED
    status: "published",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(function () {
    fetchAdminSubjects()
      .then(setSubjects)
      .catch(function () {
        toast.error("Failed to load subjects");
      });
  }, []);

  useEffect(function () {
    if (!form.subjectId) return;
    let active = true;
    fetchSubjectUnits(form.subjectId)
      .then((rows) => { if (active) setUnits(rows); })
      .catch(() => { if (active) toast.error("Failed to load units"); });
    return () => { active = false; };
  }, [form.subjectId]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "subjectId") setUnits([]);
    setForm(function (prev) {
      return name === "subjectId"
        ? { ...prev, subjectId: value, unitId: "" }
        : { ...prev, [name]: value };
    });
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected && selected.type !== "application/pdf") {
      setErrors(function (prev) {
        return { ...prev, file: "Only PDF files are supported" };
      });
      setFile(null);
      return;
    }
    setErrors(function (prev) {
      return { ...prev, file: undefined };
    });
    setFile(selected || null);
  }

  function validate() {
    const next = {};
    if (!form.title || form.title.trim().length < 2) {
      next.title = "Title must be at least 2 characters";
    }
    if (!form.subjectId) {
      next.subjectId = "Please select a subject";
    }
    if (!form.unitId) {
      // ← ADDED
      next.unitId = "Please select a unit";
    }
    if (!file) {
      next.file = "A PDF file is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("description", form.description);
    formData.append("subjectId", form.subjectId);
    formData.append("unitId", form.unitId); // ← ADDED
    formData.append("status", form.status);
    formData.append("file", file);

    setSubmitting(true);
    setUploadProgress(0);
    uploadNote(formData, setUploadProgress)
      .then(function (note) {
        toast.success("Note uploaded successfully");
        setForm({
          title: "",
          description: "",
          subjectId: "",
          unitId: "",
          status: "published",
        }); // ← reset unitId
        setFile(null);
        e.target.reset();
        if (onUploaded) {
          onUploaded(note);
        }
      })
      .catch(function (err) {
        toast.error(err.response?.data?.message || err.message);
      })
      .finally(function () {
        setSubmitting(false);
        setUploadProgress(0);
      });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="upload-title"
        label="Title"
        name="title"
        value={form.title}
        onChange={handleChange}
        error={errors.title}
      />

      <div>
        <label htmlFor="upload-subjectId" className="block text-sm font-medium text-gray-700">
          Subject
        </label>
        <select
          id="upload-subjectId"
          name="subjectId"
          value={form.subjectId}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="">Select Subject</option>
          {subjects.map(function (s) {
            return (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            );
          })}
        </select>
        {errors.subjectId && (
          <p className="text-red-600 text-sm mt-1">{errors.subjectId}</p>
        )}
      </div>

      {/* NEW: Unit Dropdown */}
      <div>
        <label htmlFor="upload-unitId" className="block text-sm font-medium text-gray-700">Unit</label>
        <select
          id="upload-unitId"
          name="unitId"
          value={form.unitId}
          onChange={handleChange}
          disabled={!form.subjectId || units.length === 0}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="">Select Unit</option>
          {units.map(function (u) {
            return (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            );
          })}
        </select>
        {errors.unitId && (
          <p className="text-red-600 text-sm mt-1">{errors.unitId}</p>
        )}
      </div>

      <Input
        id="upload-description"
        label="Description"
        name="description"
        value={form.description}
        onChange={handleChange}
        error={errors.description}
      />

      <div>
        <label htmlFor="upload-status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="upload-status"
          name="status"
          value={form.status}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div>
        <label htmlFor="upload-file" className="block text-sm font-medium text-gray-700">
          PDF File
        </label>
        <input
          id="upload-file"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="mt-1 block w-full"
        />
        {errors.file && (
          <p className="text-red-600 text-sm mt-1">{errors.file}</p>
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting
          ? uploadProgress > 0
            ? "Uploading... " + uploadProgress + "%"
            : "Uploading..."
          : "Upload Note"}
      </Button>

      {submitting && uploadProgress > 0 ? (
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: uploadProgress + "%" }}
          />
        </div>
      ) : null}
    </form>
  );
}
